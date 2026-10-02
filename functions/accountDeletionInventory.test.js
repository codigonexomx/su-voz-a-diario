"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildInventory, createReadTransport, requestReference, inventoryHash } = require("./accountDeletionInventory");
const { parseArgs, writePrivateInventory, main } = require("./inventoryAccountDeletion");
const { validatePlan: validateOrphanPlan } = require("./communityOrphanCleanup");

const project = "demo-account-inventory", uid = "fixture-owner", reference = requestReference(uid), updated = "2026-10-02T01:00:00.123456Z";
const record = (path, data, updateTime = updated) => ({ path, data, updateTime });
const user = () => ({ uid, email: "owner@example.test", emailVerified: true, disabled: false, customClaims: {} });
const fixtures = () => [
  record(`accountDeletionRequests/${reference}`, { uid, status: "pending", email: "owner@example.test" }),
  record("communityConfiguration/moderation", { moderatorUid: "fixture-moderator" }),
  record(`communityProfiles/${uid}`, { displayName: "PRIVATE TEXT" }),
  record("userProfiles/other", { uid, text: "OTHER PRIVATE PROFILE" }),
  record("communityNames/fixture name", { uid }), record(`communityRateLimits/${uid}_post`, {}),
  record(`communityRateLimits/${uid}_other_post`, {}),
  record("communityPosts/own-post", { ownerUid: uid, text: "PRIVATE POST" }),
  record("communityPostPrivate/own-post", { ownerUid: uid }),
  record("communityPosts/foreign-post", { ownerUid: "other" }),
  record("communityReplies/foreign-reply", { ownerUid: "other", postId: "own-post" }),
  record("communityReplyPrivate/foreign-reply", { ownerUid: "other" }),
  record("communityReplies/own-reply", { postId: "foreign-post" }),
  record("communityReplyPrivate/own-reply", { ownerUid: uid }),
  record("communityReactions/own", { userId: uid, postId: "foreign-post" }),
  record("communityReactions/associated", { userId: "other", postId: "own-post" }),
  record("communityReactions/unrelated", { userId: "other", postId: "foreign-post" }),
  record("communityPrayerRequests/prayer", { text: "PRIVATE PRAYER" }),
  record("communityPrayerPrivate/prayer", { ownerUid: uid }),
  record("communityPrayerCommitments/associated", { ownerUid: "other", requestId: "prayer" }),
  record("communityPrayerCommitments/own", { ownerUid: uid, requestId: "foreign-prayer" }),
  record("notifications/own", { userId: uid, postId: "foreign-post" }),
  record("notifications/foreign", { userId: "other", authorUid: uid, postId: "foreign-post" }),
  record("pushTokens/own", { uid, token: "PRIVATE TOKEN" }),
  record("communityReports/reported", { reportedBy: uid, contentText: "PRIVATE REPORT", comments: "PRIVATE COMMENT" }),
  record("communityReports/about-post", { type: "post", id: "own-post" }),
  record("communityReports/unrelated", { reportedBy: "other", type: "post", id: "foreign-post" }),
  record("communityActivityDeliveries/shared", { updates: [{ uid }, { uid: "other" }], delivered: false }),
  record("communityActivityEvents/cursor", { cursor: uid }),
  record("communityDeletionJobs/own-post", { ownerUid: uid }),
  record(`communityBlocks/${uid}`, {}, null), record(`communityBlocks/${uid}/authors/other`, {}),
  record("communityBlocks/other", {}, null), record(`communityBlocks/other/authors/${uid}`, {}),
  record("communityBlocks/other/authors/third", {}),
  record(`userProfiles/${uid}`, {}, null), record(`userProfiles/${uid}/unknown/child`, { text: "PRIVATE NESTED" }),
  record("unreviewedCollection/item", { uid, text: "UNREVIEWED TEXT" }),
];

function fake(rows = fixtures(), files = [{ name: "community/audio/fixture.webm", ownerUid: uid, generation: "10", metageneration: "2" }]) {
  const docs = new Map(rows.map(item => [item.path, structuredClone(item)]));
  return { docs, get: async path => structuredClone(docs.get(path) || null),
    collections: async parent => [...new Set([...docs.keys()].filter(key => !parent || key.startsWith(parent + "/")).map(key => key.slice(parent ? parent.length + 1 : 0).split("/")).filter(parts => parts.length >= 2).map(parts => parts[0]))],
    list: async collection => [...docs.values()].filter(item => item.path.startsWith(collection + "/") && item.path.split("/").length === collection.split("/").length + 1).map(item => structuredClone(item)),
    storage: async () => structuredClone(files) };
}
const build = (transport, extra = {}) => buildInventory({ project, reference, transport, getUser: async () => user(), ...extra });

async function run() {
  let transport = fake(); const before = JSON.stringify([...transport.docs]);
  const result = await build(transport), paths = new Set(result.candidates.map(item => item.path));
  for (const expected of ["communityPosts/own-post", "communityPostPrivate/own-post", "communityReplies/foreign-reply", "communityReplyPrivate/foreign-reply",
    "communityReplies/own-reply", "communityReplyPrivate/own-reply", "communityReactions/own", "communityReactions/associated", "communityPrayerRequests/prayer",
    "communityPrayerPrivate/prayer", "communityPrayerCommitments/associated", "communityPrayerCommitments/own", "notifications/own", "pushTokens/own",
    `communityProfiles/${uid}`, "communityNames/fixture name", `communityRateLimits/${uid}_post`, `communityBlocks/${uid}/authors/other`, `communityBlocks/other/authors/${uid}`]) assert(paths.has(expected), expected);
  for (const excluded of ["communityPosts/foreign-post", "communityReactions/unrelated", "notifications/foreign", "userProfiles/other",
    `communityRateLimits/${uid}_other_post`, "communityBlocks/other/authors/third", `accountDeletionRequests/${reference}`]) assert(!paths.has(excluded), excluded);
  assert.equal(before, JSON.stringify([...transport.docs]));
  assert.equal(result.approvedForDeletion, false); assert.equal(result.transactionalSnapshot, false);
  assert.equal(result.storageCandidates.length, 1);
  assert(result.counterReviews.some(item => item.type === "replyCount" && item.parentId === "foreign-post"));
  assert(result.counterReviews.some(item => item.type === "prayingCount" && item.parentId === "foreign-prayer"));
  for (const reason of ["report-retention-and-redaction-review", "shared-outbox-review-preserve-other-recipients", "replay-ledger-review", "unfinished-cascade-review", "unreviewed-nested-document", "unreviewed-root-collection"]) assert(result.review.some(item => item.reason === reason), reason);
  assert(result.review.some(item => item.path === "notifications/foreign" && item.reason === "personal-reference-in-other-account-record"));
  assert(result.review.some(item => item.path === "userProfiles/other" && item.reason === "personal-reference-in-other-account-record"));
  const data = JSON.stringify(result);
  for (const secret of ["PRIVATE TEXT", "PRIVATE POST", "PRIVATE PRAYER", "PRIVATE REPORT", "PRIVATE COMMENT", "PRIVATE TOKEN", "PRIVATE NESTED", "owner@example.test"]) assert(!data.includes(secret), secret);
  assert.equal(inventoryHash(data).length, 64);
  assert.throws(() => validateOrphanPlan(data, project, inventoryHash(data)), /PLAN_INVALID/);

  await assert.rejects(buildInventory({ project, reference: "0".repeat(64), transport, getUser: async () => user() }), /PENDING_REQUEST/);
  transport = fake(); transport.docs.get(`accountDeletionRequests/${reference}`).data.status = "resolved";
  await assert.rejects(build(transport), /PENDING_REQUEST/);
  transport = fake(); transport.docs.get(`accountDeletionRequests/${reference}`).data.uid = "forged-identity";
  await assert.rejects(build(transport), /PENDING_REQUEST/);
  transport = fake(); transport.docs.get(`accountDeletionRequests/${reference}`).updateTime = null;
  await assert.rejects(build(transport), /PENDING_REQUEST/);
  for (const privileged of [{ moderator: true }, { admin: true }]) await assert.rejects(build(fake(), { getUser: async () => ({ ...user(), customClaims: privileged }) }), /PROTECTED_ADMIN/);
  transport = fake(); transport.docs.get("communityConfiguration/moderation").data.moderatorUid = uid;
  await assert.rejects(build(transport), /PROTECTED_ADMIN/);
  transport = fake(); transport.docs.get("communityPostPrivate/own-post").data.ownerUid = "other";
  const conflicting = await build(transport);
  assert(!conflicting.candidates.some(item => item.path === "communityPosts/own-post"));
  assert(conflicting.review.some(item => item.reason === "conflicting-ownership"));
  transport = fake(); const read = transport.get; let requestReads = 0;
  transport.get = async path => { const item = await read(path); if (path === `accountDeletionRequests/${reference}` && ++requestReads > 1) item.updateTime = "2026-10-02T02:00:00Z"; return item; };
  await assert.rejects(build(transport), /ACCOUNT_OR_REQUEST_CHANGED/);
  let calls = 0;
  await assert.rejects(build(fake(), { getUser: async () => ({ ...user(), disabled: ++calls > 1 }) }), /ACCOUNT_OR_REQUEST_CHANGED/);
  await assert.rejects(build(fake(), { maxDocuments: 2 }), /LIMIT_EXCEEDED/);
  const invalidFiles = [{ name: "community/audio/fixture.webm", ownerUid: uid }];
  await assert.rejects(build(fake(fixtures(), invalidFiles)), /STORAGE_GENERATION/);
  const file = { name: "community/audio/a.webm", ownerUid: uid, generation: "1", metageneration: "1" };
  await assert.rejects(build(fake(fixtures(), [file, file])), /DUPLICATE_STORAGE/);
  const storageReview = await build(fake(fixtures(), [{ ...file, name: "private-backups/a.webm" }, { ...file, name: "community/audio/b.webm", uid: "other" }]));
  assert.equal(storageReview.storageCandidates.length, 0); assert.equal(storageReview.review.filter(item => item.reason.includes("storage")).length, 2);
  const unverifiedAudio = await build(fake(fixtures(), [{ name: `community/audio/100-${uid}.webm`, generation: "1", metageneration: "1" }]));
  assert.equal(unverifiedAudio.storageCandidates.length, 0);
  assert(unverifiedAudio.review.some(item => item.reason === "audio-path-without-verified-ownership"));

  const requests = [], root = `projects/${project}/databases/(default)/documents/`;
  const raw = { name: root + "communityProfiles/fixture", updateTime: updated, fields: { uid: { stringValue: uid }, text: { stringValue: "PRIVATE OMITTED" }, updates: { arrayValue: { values: [{ mapValue: { fields: { uid: { stringValue: uid }, secret: { stringValue: "SECRET UPDATE" } } } }] } } } };
  const reader = createReadTransport(project, { getToken: async () => "fixture-token", requestFetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => url.includes(":listCollectionIds") ? { collectionIds: ["communityProfiles"] } : url.includes("pageSize=") ? { documents: [raw] } : raw };
  } });
  assert.deepEqual(await reader.collections(""), ["communityProfiles"]);
  assert.equal((await reader.get("communityProfiles/fixture")).data.text, undefined);
  assert.deepEqual((await reader.list("communityProfiles"))[0].data.updates, [{ uid }]);
  assert(requests.every(item => item.options.method === "GET" || item.options.method === "POST" && item.url.endsWith(":listCollectionIds")));
  assert(requests.filter(item => item.options.method === "GET").every(item => !new URL(item.url).searchParams.getAll("mask.fieldPaths").includes("text")));
  assert.equal(reader.commit, undefined); assert.equal(reader.delete, undefined);
  const objectRequests = [];
  const storageReader = createReadTransport(project, { getToken: async () => "fixture-token", requestFetch: async (url, options) => {
    objectRequests.push({ url, options });
    return { ok: true, json: async () => ({ items: [{ name: "community/audio/fixture.webm", generation: "10", metageneration: "2", metadata: { ownerUid: uid, privateText: "PRIVATE STORAGE TEXT" } }] }) };
  } });
  const metadata = await storageReader.storage();
  assert.equal(metadata[0].ownerUid, uid);
  assert(!JSON.stringify(metadata).includes("PRIVATE STORAGE TEXT"));
  assert(objectRequests.every(item => item.options.method === "GET" && item.url.startsWith(`https://storage.googleapis.com/storage/v1/b/${project}.firebasestorage.app/o?`) && new URL(item.url).searchParams.get("versions") === "true"));
  await assert.rejects(reader.list("communityProfiles/fixture"), /COLLECTION_PATH/);
  assert.throws(() => createReadTransport("production-project", { host: "127.0.0.1:8080" }), /LOCAL_DEMO/);
  const repeated = createReadTransport(project, { getToken: async () => "fixture", requestFetch: async () => ({ ok: true, json: async () => ({ documents: [], nextPageToken: "repeat" }) }) });
  await assert.rejects(repeated.list("communityProfiles"), /PAGINATION_INVALID/);
  const mismatch = createReadTransport(project, { getToken: async () => "fixture", requestFetch: async () => ({ ok: true, json: async () => ({ ...raw, name: raw.name.replace(project, "other-project") }) }) });
  await assert.rejects(mismatch.get("communityProfiles/fixture"), /PROJECT_RESPONSE_MISMATCH/);

  const args = [`--project=${project}`, `--confirm-project=${project}`, "--firebase-cli-auth-module=fixture", "--pending-count"];
  assert.equal(parseArgs(args).pending, true);
  for (const extra of ["--apply", "--write", "--pending-count", "--request=invalid"]) assert.throws(() => parseArgs([...args, extra]));
  await assert.rejects(main([...args, "--apply"]), /read-only/);
  const output = path.resolve(__dirname, `../artifacts/validation/account-inventory-test-${process.pid}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  try {
    writePrivateInventory(output, data);
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    assert.equal(fs.readFileSync(output, "utf8"), data);
    assert.throws(() => writePrivateInventory(output, "overwrite"));
    assert.throws(() => writePrivateInventory(path.resolve(__dirname, "../privacy.html"), data), /PRIVATE_ARTIFACT_PATH/);
  } finally { if (fs.existsSync(output)) fs.unlinkSync(output); }
  console.log("OK: read-only account inventory, authenticated request, protected moderator, exact ownership, associated records, private pairs, missing parents, metadata-only pagination, counter/retention reviews and exclusive private output");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
