"use strict";

const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { buildInventory, createReadTransport, requestReference } = require("./accountDeletionInventory");

const host = process.env.FIRESTORE_EMULATOR_HOST, authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host || "") || !/^127\.0\.0\.1:\d+$/.test(authHost || "")) throw new Error("LOCAL_EMULATORS_REQUIRED; production forbidden");
const project = "demo-account-deletion-inventory", uid = "inventory-fixture", reference = requestReference(uid);
initializeApp({ projectId: project });
const db = getFirestore(), auth = getAuth();

async function run() {
  for (const url of [`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, `http://${authHost}/emulator/v1/projects/${project}/accounts`]) assert((await fetch(url, { method: "DELETE" })).ok);
  await auth.createUser({ uid, email: "inventory-fixture@example.test", emailVerified: true });
  const rows = [
    [`accountDeletionRequests/${reference}`, { uid, status: "pending" }],
    ["communityConfiguration/moderation", { moderatorUid: "different-fixture" }],
    ["communityPosts/anonymous", { text: "Private test content must not enter inventory" }],
    ["communityPostPrivate/anonymous", { ownerUid: uid }],
    ["communityReplies/associated", { ownerUid: "other-fixture", postId: "anonymous" }],
    ["communityReplyPrivate/associated", { ownerUid: "other-fixture" }],
    ["pushTokens/device", { uid, token: "Private fixture token" }],
    [`communityBlocks/${uid}/authors/other-fixture`, { key: "fixture" }],
    [`userProfiles/${uid}/unexpected/data`, { note: "Private fixture nested text" }],
    ["communityReports/fixture", { reportedBy: uid, contentText: "Private fixture report" }],
  ];
  for (const [path, data] of rows) await db.doc(path).set(data);
  const before = new Map(); for (const [path] of rows) before.set(path, (await db.doc(path).get()).updateTime.toMillis());
  const reader = createReadTransport(project, { host });
  const transport = { ...reader, storage: async () => [{ name: "community/audio/fixture.webm", ownerUid: uid, generation: "1", metageneration: "1" }] };
  const result = await buildInventory({ project, reference, transport, getUser: id => auth.getUser(id) });
  const paths = new Set(result.candidates.map(item => item.path));
  for (const path of ["communityPosts/anonymous", "communityPostPrivate/anonymous", "communityReplies/associated", "communityReplyPrivate/associated", "pushTokens/device", `communityBlocks/${uid}/authors/other-fixture`]) assert(paths.has(path), path);
  assert(result.review.some(item => item.path === `userProfiles/${uid}/unexpected/data`));
  const serialized = JSON.stringify(result);
  for (const privateText of ["Private test content", "Private fixture token", "Private fixture nested", "Private fixture report", "inventory-fixture@example.test"]) assert(!serialized.includes(privateText));
  for (const [path] of rows) assert.equal((await db.doc(path).get()).updateTime.toMillis(), before.get(path));
  assert.equal((await auth.getUser(uid)).disabled, false);
  assert.equal(result.approvedForDeletion, false);
  await auth.setCustomUserClaims(uid, { moderator: true });
  await assert.rejects(buildInventory({ project, reference, transport, getUser: id => auth.getUser(id) }), /PROTECTED_ADMIN/);
  console.log("OK: real read-only Firestore REST masks/pagination/absent-parent discovery and Auth emulator; all fixtures unchanged; moderator protected; Storage is an explicit metadata fixture");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
