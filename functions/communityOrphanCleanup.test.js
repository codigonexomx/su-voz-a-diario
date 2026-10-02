"use strict";

const assert = require("node:assert/strict");
const { hashPlan, validatePlan, validateBackup, executeCleanup } = require("./communityOrphanCleanup");
const project = "demo-orphan-cleanup", root = `projects/${project}/databases/(default)/documents/`;
const updated = "2026-10-01T01:00:00.123456Z";
const candidate = (kind, collection, id, parentId = "absent") => ({ kind, name: root + collection + "/" + id, parentId, updateTime: updated });
function planFor(candidates) {
  const counts = {};
  for (const item of candidates) counts[item.kind] = (counts[item.kind] || 0) + 1;
  return { mode: "read-only-plan", project, generatedAt: "2026-10-02T02:00:00Z", backupOperation: `projects/${project}/databases/(default)/operations/export`, counts,
    parentAbsenceRechecked: true, requiresFreshTransactionalRecheckBeforeDeletion: true, requiresSpecificScopeApproval: true, candidates: structuredClone(candidates) };
}
const validate = plan => { const data = JSON.stringify(plan); return validatePlan(data, project, hashPlan(data)); };
function fakeTransport(items, overrides = {}) {
  const records = new Map(items.map(item => [item.name, { name: item.name, updateTime: item.updateTime, fields: { postId: { stringValue: item.parentId } } }]));
  const calls = { commits: [], rollbacks: 0, begins: [] };
  return { records, calls, begin: async apply => { calls.begins.push(apply); return "transaction"; },
    read: async names => names.map(name => records.has(name) ? { found: records.get(name) } : { missing: name }),
    commit: async writes => { calls.commits.push(writes); for (const write of writes) records.delete(write.delete); },
    rollback: async () => { calls.rollbacks++; }, ...overrides };
}

async function run() {
  const reply = candidate("reply", "communityReplies", "reply");
  const identity = candidate("reply-private-associated", "communityReplyPrivate", "reply");
  const reaction = candidate("reaction", "communityReactions", "reaction");
  const privatePost = candidate("post-private", "communityPostPrivate", "absent");
  const validated = validate(planFor([reply, identity, reaction, privatePost]));
  assert.equal(validated.units.length, 3);
  assert.throws(() => validatePlan(JSON.stringify(planFor([reply])), project, "0".repeat(64)), /HASH_MISMATCH/);
  for (const mutation of [
    p => { p.project = "other-project"; },
    p => { p.candidates[0].name = root + "communityPosts/live"; },
    p => { p.candidates[0].name = root + "communityReplies/a/subcollection/b"; },
    p => { p.candidates[0].kind = "constructor"; },
    p => { p.candidates[0].updateTime = "invalid"; },
    p => { p.candidates[0].parentId = "../live"; },
    p => { p.counts.reply = 100; },
    p => { p.candidates.push(p.candidates[0]); },
    p => { p.requiresSpecificScopeApproval = false; },
  ]) {
    const plan = planFor([reply]); mutation(plan); assert.throws(() => validate(plan));
  }
  assert.throws(() => validate(planFor([identity])), /UNPAIRED/);
  assert.throws(() => validate(planFor([candidate("post-private", "communityPostPrivate", "other")])), /PARENT_INVALID/);
  const exportOperation = { name: validated.plan.backupOperation, done: true,
    response: { "@type": "type.googleapis.com/google.firestore.admin.v1.ExportDocumentsResponse", outputUriPrefix: `gs://${project}.firebasestorage.app/private-backups/test` },
    metadata: { operationState: "SUCCESSFUL", endTime: "2026-10-02T01:00:00Z" } };
  validateBackup(exportOperation, validated, Date.parse("2026-10-02T03:00:00Z"));
  assert.throws(() => validateBackup({ ...exportOperation, error: { code: 1 } }, validated), /BACKUP_REQUIRED/);
  assert.throws(() => validateBackup({ ...exportOperation, response: { ...exportOperation.response, outputUriPrefix: "gs://other/export" } }, validated), /BACKUP_REQUIRED/);
  assert.throws(() => validateBackup(exportOperation, validated, Date.parse("2026-10-04T03:00:00Z")), /FRESH_BACKUP/);

  let transport = fakeTransport([reply, identity, reaction, privatePost]);
  let result = await executeCleanup(validated, transport);
  assert.equal(result.eligible, 4); assert.equal(result.deleted, 0);
  assert.equal(transport.calls.commits.length, 0); assert.deepEqual(transport.calls.begins, [false]);
  assert.equal(transport.records.size, 4); assert.equal(transport.calls.rollbacks, 1);
  const journal = [];
  result = await executeCleanup(validated, transport, { apply: true, record: entry => journal.push(entry) });
  assert.equal(result.deleted, 4); assert.equal(transport.records.size, 0);
  assert.equal(transport.calls.commits[0].length, 4);
  for (const write of transport.calls.commits[0]) assert.deepEqual(write.currentDocument, { updateTime: updated });
  assert.equal(journal[0].phase, "commit-attempt");
  result = await executeCleanup(validated, transport, { apply: true });
  assert.equal(result.alreadyAbsent, 4); assert.equal(result.deleted, 0);
  assert.equal(transport.calls.commits.length, 1);

  transport = fakeTransport([reply, identity, reaction, privatePost]);
  transport.records.set(root + "communityPosts/absent", { name: root + "communityPosts/absent" });
  result = await executeCleanup(validated, transport, { apply: true });
  assert.equal(result.skipped, 4); assert.equal(result.reasons["parent-present"], 4); assert.equal(result.deleted, 0);
  transport = fakeTransport([reply, identity, reaction, privatePost]);
  transport.records.get(identity.name).updateTime = "2026-10-02T01:00:00Z";
  result = await executeCleanup(validated, transport, { apply: true });
  assert.equal(result.skipped, 2); assert.equal(result.deleted, 2);
  assert(transport.records.has(reply.name) && transport.records.has(identity.name));
  transport = fakeTransport([reply, identity]);
  result = await executeCleanup(validate(planFor([reply])), transport, { apply: true });
  assert.equal(result.reasons["unplanned-private-record"], 1); assert.equal(result.deleted, 0);
  transport = fakeTransport([reaction]);
  transport.records.get(reaction.name).fields.postId.stringValue = "other-parent";
  result = await executeCleanup(validate(planFor([reaction])), transport, { apply: true });
  assert.equal(result.reasons["parent-reference-changed"], 1); assert.equal(result.deleted, 0);
  for (const rows of [[], [{ missing: root + "unapproved/document" }], [{ missing: reply.name }, { missing: reply.name }]]) {
    transport = fakeTransport([reply], { read: async () => rows });
    await assert.rejects(executeCleanup(validate(planFor([reply])), transport, { apply: true }), /TRANSACTION_READ/);
    assert.equal(transport.calls.commits.length, 0); assert.equal(transport.calls.rollbacks, 1);
  }
  transport = fakeTransport([reply], { commit: async () => { throw new Error("ABORTED_CONCURRENT_CHANGE"); } });
  await assert.rejects(executeCleanup(validate(planFor([reply])), transport, { apply: true }), /CONCURRENT_CHANGE/);
  assert.equal(transport.records.size, 1); assert.equal(transport.calls.begins.length, 1);
  transport = fakeTransport([reply]);
  await assert.rejects(executeCleanup(validate(planFor([reply])), transport, { apply: true, record: () => { throw new Error("JOURNAL_FAILED"); } }), /JOURNAL_FAILED/);
  assert.equal(transport.calls.commits.length, 0);
  const many = Array.from({ length: 103 }, (_, i) => candidate("reaction", "communityReactions", `r-${i}`));
  transport = fakeTransport(many);
  result = await executeCleanup(validate(planFor(many)), transport, { apply: true });
  assert.equal(result.deleted, 103); assert.deepEqual(transport.calls.commits.map(items => items.length), [50, 50, 3]);
  console.log("OK: exact hashed scope, private pairs, live parents, changed records, incomplete reads, backup freshness, dry-run, replay and bounded commits");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
