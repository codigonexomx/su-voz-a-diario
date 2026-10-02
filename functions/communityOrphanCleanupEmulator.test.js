"use strict";

const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { hashPlan, validatePlan, executeCleanup, createTransport } = require("./communityOrphanCleanup");
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host || "")) throw new Error("LOCAL_EMULATOR_REQUIRED; production forbidden");
const project = "demo-orphan-cleanup", root = `projects/${project}/databases/(default)/documents/`;
initializeApp({ projectId: project });
const db = getFirestore();
const transport = createTransport(project, { host });

async function run() {
  const cleared = await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: "DELETE" });
  assert(cleared.ok);
  for (const [path, fields] of [
    ["communityReplies/orphan", { postId: "missing" }], ["communityReplyPrivate/orphan", { ownerUid: "private-fixture" }],
    ["communityReactions/orphan", { postId: "missing" }], ["communityPostPrivate/missing", { ownerUid: "private-fixture" }],
    ["communityPosts/live", { text: "Fixture only" }], ["communityReactions/live-reaction", { postId: "live" }],
    ["communityReplies/private-appears", { postId: "missing" }], ["communityReactions/changed", { postId: "missing" }],
  ]) await db.doc(path).set(fields);
  const definitions = [
    ["reply", "communityReplies/orphan", "missing"], ["reply-private-associated", "communityReplyPrivate/orphan", "missing"],
    ["reaction", "communityReactions/orphan", "missing"], ["post-private", "communityPostPrivate/missing", "missing"],
    ["reaction", "communityReactions/live-reaction", "live"], ["reply", "communityReplies/private-appears", "missing"],
    ["reaction", "communityReactions/changed", "missing"],
  ];
  const rows = await transport.read(definitions.map(([, path]) => root + path));
  const timestamps = new Map(rows.map(row => [row.found.name, row.found.updateTime]));
  const candidates = definitions.map(([kind, path, parentId]) => ({ kind, name: root + path, parentId, updateTime: timestamps.get(root + path) }));
  const counts = {}; for (const item of candidates) counts[item.kind] = (counts[item.kind] || 0) + 1;
  const data = JSON.stringify({ project, mode: "read-only-plan", counts, candidates, parentAbsenceRechecked: true,
    requiresFreshTransactionalRecheckBeforeDeletion: true, requiresSpecificScopeApproval: true });
  const validated = validatePlan(data, project, hashPlan(data));
  await db.doc("communityReplyPrivate/private-appears").set({ ownerUid: "unplanned-fixture" });
  await db.doc("communityReactions/changed").update({ preserved: true });
  let result = await executeCleanup(validated, transport);
  assert.equal(result.eligible, 4); assert.equal(result.deleted, 0); assert.equal(result.skipped, 3);
  assert((await db.doc("communityReplies/orphan").get()).exists);
  result = await executeCleanup(validated, transport, { apply: true });
  assert.equal(result.deleted, 4); assert.equal(result.skipped, 3);
  for (const path of ["communityReplies/orphan", "communityReplyPrivate/orphan", "communityReactions/orphan", "communityPostPrivate/missing"]) assert.equal((await db.doc(path).get()).exists, false);
  for (const path of ["communityPosts/live", "communityReactions/live-reaction", "communityReplies/private-appears", "communityReplyPrivate/private-appears", "communityReactions/changed"]) assert((await db.doc(path).get()).exists);
  result = await executeCleanup(validated, transport, { apply: true });
  assert.equal(result.deleted, 0); assert.equal(result.alreadyAbsent, 4);
  await db.doc("communityReactions/precondition").set({ postId: "missing" });
  await assert.rejects(transport.commit([{ delete: root + "communityReactions/precondition", currentDocument: { updateTime: "2020-01-01T00:00:00Z" } }]), /FIRESTORE_HTTP_/);
  assert((await db.doc("communityReactions/precondition").get()).exists);
  assert.throws(() => createTransport("production-project", { host }), /LOCAL_DEMO/);
  assert.throws(() => createTransport(project, { host: "localhost:8080" }), /LOCAL_DEMO/);
  console.log("OK: real REST emulator transactions, paired atomic cleanup, dry-run and replay; live/changed/unapproved records survive; stale preconditions reject");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
