"use strict";

const { createHash } = require("node:crypto");

const COLLECTIONS = Object.freeze({
  reply: "communityReplies",
  reaction: "communityReactions",
  "post-private": "communityPostPrivate",
  "reply-private-associated": "communityReplyPrivate",
});
const validId = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const hashPlan = data => createHash("sha256").update(data).digest("hex");

function validatePlan(data, project, expectedHash) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash || "") || hashPlan(data) !== expectedHash) throw new Error("PLAN_HASH_MISMATCH");
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(project || "")) throw new Error("PROJECT_INVALID");
  const plan = JSON.parse(data);
  const root = `projects/${project}/databases/(default)/documents/`;
  if (plan.project !== project || plan.mode !== "read-only-plan" || plan.parentAbsenceRechecked !== true ||
      plan.requiresFreshTransactionalRecheckBeforeDeletion !== true || plan.requiresSpecificScopeApproval !== true ||
      !Array.isArray(plan.candidates) || !plan.candidates.length || plan.candidates.length > 10000) throw new Error("PLAN_INVALID");
  const byName = new Map(), counts = {};
  for (const item of plan.candidates) {
    if (!Object.hasOwn(COLLECTIONS, item.kind) || !validId(item.parentId) ||
        typeof item.updateTime !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(item.updateTime) ||
        !Number.isFinite(Date.parse(item.updateTime))) throw new Error("CANDIDATE_INVALID");
    const prefix = root + COLLECTIONS[item.kind] + "/";
    if (typeof item.name !== "string" || !item.name.startsWith(prefix) || !validId(item.name.slice(prefix.length)) || byName.has(item.name)) throw new Error("CANDIDATE_PATH_INVALID");
    if (item.kind === "post-private" && item.name.slice(prefix.length) !== item.parentId) throw new Error("PARENT_INVALID");
    byName.set(item.name, item);
    counts[item.kind] = (counts[item.kind] || 0) + 1;
  }
  if (!plan.counts || Object.keys(plan.counts).length !== Object.keys(counts).length ||
      Object.entries(counts).some(([kind, count]) => plan.counts[kind] !== count)) throw new Error("PLAN_COUNTS_MISMATCH");
  // A reply and its private identity are a single deletion unit, including an absence guard.
  const units = [];
  for (const item of plan.candidates) {
    if (item.kind === "reply-private-associated") {
      const reply = byName.get(root + "communityReplies/" + item.name.split("/").at(-1));
      if (!reply || reply.kind !== "reply" || reply.parentId !== item.parentId) throw new Error("PRIVATE_REPLY_UNPAIRED");
      continue;
    }
    const privateName = item.kind === "reply" ? root + "communityReplyPrivate/" + item.name.split("/").at(-1) : null;
    const privateItem = privateName ? byName.get(privateName) : null;
    units.push({ parent: root + "communityPosts/" + item.parentId, candidates: privateItem ? [item, privateItem] : [item],
      absentGuard: privateName && !privateItem ? privateName : null });
  }
  return { plan, root, units, count: plan.candidates.length, hash: expectedHash };
}

function validateBackup(operation, validated, now = Date.now()) {
  const { plan } = validated;
  if (typeof plan.backupOperation !== "string" || !plan.backupOperation.startsWith(`projects/${plan.project}/databases/(default)/operations/`) ||
      operation.name !== plan.backupOperation || operation.done !== true || operation.error ||
      operation.response?.["@type"] !== "type.googleapis.com/google.firestore.admin.v1.ExportDocumentsResponse" ||
      operation.metadata?.operationState !== "SUCCESSFUL" ||
      !operation.response.outputUriPrefix?.startsWith(`gs://${plan.project}.firebasestorage.app/private-backups/`)) throw new Error("COMPLETED_BACKUP_REQUIRED");
  const finished = Date.parse(operation.metadata.endTime);
  const generated = Date.parse(plan.generatedAt);
  if (!Number.isFinite(finished) || !Number.isFinite(generated) || finished > generated || generated > now || now - finished > 86400000) throw new Error("FRESH_BACKUP_REQUIRED");
}

function selectWrites(units, records) {
  const writes = [], counts = { eligible: 0, alreadyAbsent: 0, skipped: 0 }, reasons = {};
  for (const unit of units) {
    let reason;
    if (records.get(unit.parent)) reason = "parent-present";
    else if (unit.absentGuard && records.get(unit.absentGuard)) reason = "unplanned-private-record";
    else {
      for (const item of unit.candidates) {
        const current = records.get(item.name);
        if (current && current.updateTime !== item.updateTime) { reason = "document-changed"; break; }
        if (current && (item.kind === "reply" || item.kind === "reaction") && current.fields?.postId?.stringValue !== item.parentId) { reason = "parent-reference-changed"; break; }
      }
    }
    if (reason) {
      counts.skipped += unit.candidates.length;
      reasons[reason] = (reasons[reason] || 0) + unit.candidates.length;
      continue;
    }
    for (const item of unit.candidates) {
      if (!records.get(item.name)) counts.alreadyAbsent++;
      else { writes.push({ delete: item.name, currentDocument: { updateTime: item.updateTime } }); counts.eligible++; }
    }
  }
  return { writes, counts, reasons };
}

async function executeCleanup(validated, transport, { apply = false, record = () => {} } = {}) {
  const totals = { planned: validated.count, eligible: 0, alreadyAbsent: 0, skipped: 0, deleted: 0, reasons: {} };
  // Bound transactions and keep paired documents in the same commit.
  for (let offset = 0; offset < validated.units.length; offset += 50) {
    const units = validated.units.slice(offset, offset + 50);
    const names = [...new Set(units.flatMap(unit => [unit.parent, ...unit.candidates.map(item => item.name), ...(unit.absentGuard ? [unit.absentGuard] : [])]))];
    const transaction = await transport.begin(apply);
    let committed = false;
    try {
      const rows = await transport.read(names, transaction);
      const records = new Map();
      for (const row of rows) {
        const name = row.found?.name || row.missing;
        if (!names.includes(name) || records.has(name)) throw new Error("TRANSACTION_READ_INVALID");
        records.set(name, row.found || null);
      }
      if (records.size !== names.length) throw new Error("TRANSACTION_READ_INCOMPLETE");
      const selected = selectWrites(units, records);
      const batch = { batch: offset / 50, ...selected.counts, reasons: selected.reasons, deleted: 0 };
      if (apply && selected.writes.length) {
        // A persisted pre-commit record makes an interrupted/ambiguous result auditable.
        record({ phase: "commit-attempt", batch: batch.batch, candidates: selected.writes.length });
        await transport.commit(selected.writes, transaction);
        committed = true;
        batch.deleted = selected.writes.length;
      }
      record({ phase: "batch-complete", ...batch });
      for (const key of ["eligible", "alreadyAbsent", "skipped", "deleted"]) totals[key] += batch[key];
      for (const [reason, count] of Object.entries(batch.reasons)) totals.reasons[reason] = (totals.reasons[reason] || 0) + count;
    } finally {
      if (!committed) await transport.rollback(transaction);
    }
  }
  return totals;
}

function createTransport(project, { host, getToken } = {}) {
  if (host && (!/^127\.0\.0\.1:\d+$/.test(host) || !project.startsWith("demo-"))) throw new Error("LOCAL_DEMO_EMULATOR_REQUIRED");
  const origin = host ? `http://${host}/v1/` : "https://firestore.googleapis.com/v1/";
  const documents = `projects/${project}/databases/(default)/documents`;
  async function request(resource, body) {
    const token = host ? "owner" : await getToken();
    const response = await fetch(origin + resource, {
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      method: body ? "POST" : "GET", ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`FIRESTORE_HTTP_${response.status}`);
    return response.json();
  }
  return {
    begin: async apply => {
      const result = await request(documents + ":beginTransaction", { options: apply ? { readWrite: {} } : { readOnly: {} } });
      if (typeof result.transaction !== "string" || !result.transaction) throw new Error("TRANSACTION_MISSING");
      return result.transaction;
    },
    read: (names, transaction) => request(documents + ":batchGet", { documents: names, transaction, mask: { fieldPaths: ["postId"] } }),
    commit: (writes, transaction) => request(documents + ":commit", { writes, transaction }),
    rollback: transaction => request(documents + ":rollback", { transaction }),
    backup: operation => request(operation),
  };
}

module.exports = { hashPlan, validatePlan, validateBackup, selectWrites, executeCleanup, createTransport };
