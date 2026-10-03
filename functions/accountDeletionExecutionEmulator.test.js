"use strict";

const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { buildInventory, createReadTransport, requestReference, inventoryHash } = require("./accountDeletionInventory");
const { freezeAccount, prepareDeletion, validatePlan, executeDeletion, finalizeDeletion, SUPPORT_VERSION } = require("./accountDeletionExecution");
const { QUIESCENCE_MS } = require("./accountDeletionAccess");

const host = process.env.FIRESTORE_EMULATOR_HOST, authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST, storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if ([host, authHost, storageHost].some(value => !/^127\.0\.0\.1:\d+$/.test(value || ""))) throw new Error("LOCAL_FIRESTORE_AUTH_STORAGE_REQUIRED; production forbidden");
const project = "demo-account-erasure", uid = "erasure-fixture", reference = requestReference(uid);
initializeApp({ projectId: project, storageBucket: `${project}.firebasestorage.app` });
const db = getFirestore(), auth = getAuth(), bucket = getStorage().bucket();
const backend = require("./index"), activity = require("./communityActivity");

async function run() {
  for (const url of [`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, `http://${authHost}/emulator/v1/projects/${project}/accounts`]) assert((await fetch(url, { method: "DELETE" })).ok);
  await auth.createUser({ uid, email: "erasure@example.test", emailVerified: true });
  const rows = [
    [`accountDeletionRequests/${reference}`, { uid, status: "pending", email: "erasure@example.test" }],
    ["communityConfiguration/moderation", { moderatorUid: "different-moderator" }],
    [`communityProfiles/${uid}`, { displayName: "Fictitious" }],
    [`userProfiles/${uid}`, { name: "Fictitious" }], ["userProfiles/other", { name: "Other fictitious profile" }],
    [`userActivity/${uid}`, { unreadCommunityCount: 0 }], ["userActivity/other", { unreadCommunityCount: 4 }],
    ["communityPosts/own", { text: "Fictitious anonymous post", replyCount: 1 }], ["communityPostPrivate/own", { ownerUid: uid }],
    ["communityPosts/other", { ownerUid: "other", replyCount: 5 }],
    ["communityReplies/associated", { ownerUid: "other", postId: "own" }], ["communityReplyPrivate/associated", { ownerUid: "other" }],
    ["communityReplies/own", { postId: "other" }], ["communityReplyPrivate/own", { ownerUid: uid }],
    ["communityReactions/associated", { postId: "own", userId: "other" }], ["communityReactions/unrelated", { postId: "other", userId: "other" }],
    ["communityPrayerRequests/own", { text: "Fictitious prayer" }], ["communityPrayerPrivate/own", { ownerUid: uid }],
    ["communityPrayerRequests/other", { prayingCount: 3 }],
    ["communityPrayerCommitments/own", { ownerUid: uid, requestId: "other" }], ["communityPrayerCommitments/associated", { ownerUid: "other", requestId: "own" }],
    ["communityActivityDeliveries/shared", { updates: [{ uid, badgeCount: 1 }, { uid: "other", badgeCount: 4 }], postId: "own", delivered: true }],
    ["communityActivityEvents/ledger", { cursor: uid, completed: true }],
    ["pushTokens/fixture", { uid, token: "not-a-real-push-token", notificationsEnabled: false }],
    [`communityBlocks/${uid}/authors/other`, { key: "fixture" }],
  ];
  for (const [path, data] of rows) await db.doc(path).set(data);
  const file = bucket.file("community/audio/erasure-fixture.webm");
  await file.save(Buffer.from("non-audio fixture bytes"), { resumable: false, contentType: "audio/webm", metadata: { metadata: { ownerUid: uid } } });
  const reader = createReadTransport(project, { host });
  const transport = { ...reader, storage: async () => {
    const [files] = await bucket.getFiles();
    return files.map(file => ({ name: file.name, generation: String(file.metadata.generation), metageneration: String(file.metadata.metageneration), ownerUid: file.metadata.metadata?.ownerUid }));
  } };
  let inventory = await buildInventory({ project, reference, transport, getUser: id => auth.getUser(id) });
  await assert.rejects(freezeAccount({ inventory, project, db, auth }), /DEPLOYED_ACCESS_GUARDS/);
  assert.equal((await auth.getUser(uid)).disabled, false);
  assert.equal((await db.doc(`accountDeletionGuards/${uid}`).get()).exists, false);
  await db.doc("communityConfiguration/accountDeletion").set({ version: SUPPORT_VERSION, enabled: true, firestoreGuard: true, storageGuard: true, callTimeoutSeconds: 60 });
  await db.doc("communityReports/private-fixture").set({ reportedBy: uid, contentText: "Private fictitious report" });
  const reviewInventory = await buildInventory({ project, reference, transport, getUser: id => auth.getUser(id) });
  await assert.rejects(freezeAccount({ inventory: reviewInventory, project, db, auth }), /MANUAL_REVIEW/);
  await db.doc("communityReports/private-fixture").delete();
  const frozen = await freezeAccount({ inventory, project, db, auth });
  assert.equal(frozen.deleted, 0); assert.equal((await auth.getUser(uid)).disabled, true);
  await assert.rejects(backend.acceptCommunityTerms.run({ auth: { uid }, data: { version: "2026-10-01", accepted: true } }), /ACCOUNT_DELETION_IN_PROGRESS/);
  const oldPostEvent = { id: "late-event", params: { postId: "own" }, time: new Date().toISOString(), data: { data: () => ({ createdAt: Timestamp.now() }) } };
  await backend.updateMetricsOnPost.run(oldPostEvent);
  assert.equal((await db.doc(`userMetrics/${uid}`).get()).exists, false);
  await activity.incrementRecipientOnce(db, "reply", "late-recipient", uid, "other");
  assert.equal((await db.doc(`userActivity/${uid}`).get()).get("unreadCommunityCount"), 0);
  await activity.incrementCommunityOnce(db, "late-actor", uid, "own");
  assert.equal((await db.doc("userActivity/other").get()).get("unreadCommunityCount"), 4);
  const backupOperation = `projects/${project}/databases/(default)/operations/fixture-backup`;
  await assert.rejects(prepareDeletion({ project, reference, transport, db, auth, backupOperation }), /QUIESCENT/);
  const now = () => Date.now() + QUIESCENCE_MS + 1000;
  await assert.rejects(prepareDeletion({ project, reference, transport, db, auth, bucket, backupOperation, now }), /AUDIO_BACKUP_REQUIRED/);
  const [sourceMetadata] = await file.getMetadata();
  const backupFile = bucket.file(`private-backups/account-audio/${reference}/fixture.webm`);
  await file.copy(backupFile);
  await backupFile.setMetadata({ metadata: { ownerUid: null, accountDeletionReference: reference,
    sourceGeneration: String(sourceMetadata.generation), sourceNameSha256: inventoryHash(file.name) } });
  const [backupMetadata] = await backupFile.getMetadata();
  const storageBackups = [{ source: { name: file.name, generation: String(sourceMetadata.generation), metageneration: String(sourceMetadata.metageneration),
    size: String(sourceMetadata.size), ...(sourceMetadata.md5Hash ? { md5Hash: sourceMetadata.md5Hash } : {}), ...(sourceMetadata.crc32c ? { crc32c: sourceMetadata.crc32c } : {}) },
    backup: { name: backupFile.name, generation: String(backupMetadata.generation), metageneration: String(backupMetadata.metageneration) } }];
  const plan = await prepareDeletion({ project, reference, transport, db, auth, bucket, storageBackups, backupOperation, now });
  const text = JSON.stringify(plan), validated = validatePlan(text, project, inventoryHash(text));
  assert.equal(plan.storageCandidates.length, 1);
  const backup = { name: backupOperation, done: true, metadata: { operationState: "SUCCESSFUL", endTime: new Date().toISOString() },
    response: { "@type": "type.googleapis.com/google.firestore.admin.v1.ExportDocumentsResponse", outputUriPrefix: `gs://${project}.firebasestorage.app/private-backups/fixture` } };
  const input = { validated, db, auth, transport, bucket, backup, now };
  await assert.rejects(executeDeletion({ ...input, backup: { ...backup, done: false }, record() {} }), /COMPLETED_BACKUP/);
  await assert.rejects(executeDeletion({ ...input, backup: { ...backup, metadata: { ...backup.metadata, collectionIds: ["userProfiles"] } }, record() {} }), /FULL_FIRESTORE_BACKUP/);
  await db.doc("notifications/late-fixture").set({ userId: uid });
  await assert.rejects(executeDeletion({ ...input, record() {} }), /UNAPPROVED_OR_CHANGED/);
  await db.doc("notifications/late-fixture").delete();
  const attempts = [];
  await assert.rejects(executeDeletion({ ...input, record: value => { attempts.push(value); if (value.phase === "firestore-complete") throw new Error("FIXTURE_INTERRUPTION"); } }), /FIXTURE_INTERRUPTION/);
  assert.equal((await db.doc(`accountDeletionRequests/${reference}`).get()).get("status"), "pending");
  assert.equal((await auth.getUser(uid)).disabled, true);
  assert.equal((await db.doc("communityPosts/other").get()).get("replyCount"), 4);
  assert.equal((await db.doc("communityPrayerRequests/other").get()).get("prayingCount"), 2);
  const interruptedAuth = {
    getUser: id => auth.getUser(id),
    deleteUser: async id => { await auth.deleteUser(id); throw new Error("FIXTURE_AUTH_RESPONSE_LOST"); },
  };
  await assert.rejects(executeDeletion({ ...input, auth: interruptedAuth, record: value => attempts.push(value) }), /AUTH_RESPONSE_LOST/);
  assert.equal((await db.doc(`accountDeletionRequests/${reference}`).get()).get("status"), "pending");
  await assert.rejects(auth.getUser(uid), error => error.code === "auth/user-not-found");
  await db.doc(`userProfiles/${uid}`).set({ name: "Fictitious late administrative write" });
  await assert.rejects(finalizeDeletion({ validated, db, auth, transport, bucket, record() {} }), /REMAINING_DATA/);
  await db.doc(`userProfiles/${uid}`).delete();
  const result = await finalizeDeletion({ validated, db, auth, transport, bucket, record: value => attempts.push(value) });
  assert.equal(result.completed, true);
  await assert.rejects(auth.getUser(uid), error => error.code === "auth/user-not-found");
  assert.equal((await db.doc("communityPosts/other").get()).get("replyCount"), 4, "Retry never decrements twice");
  assert.equal((await db.doc("communityPrayerRequests/other").get()).get("prayingCount"), 2);
  assert.equal((await db.doc("userProfiles/other").get()).get("name"), "Other fictitious profile");
  assert.equal((await db.doc("communityReactions/unrelated").get()).exists, true);
  assert.deepEqual((await db.doc("communityActivityDeliveries/shared").get()).get("updates"), [{ uid: "other", badgeCount: 4 }]);
  assert.equal((await db.doc("communityActivityDeliveries/shared").get()).get("postId"), undefined);
  assert.equal((await db.doc("communityActivityEvents/ledger").get()).get("completed"), true);
  assert.equal((await db.doc("communityActivityEvents/ledger").get()).get("cursor"), undefined);
  const receipt = (await db.doc(`accountDeletionRequests/${reference}`).get()).data();
  assert.equal(receipt.status, "completed"); assert.equal(receipt.uid, undefined); assert.equal(receipt.email, undefined);
  assert.equal((await file.exists())[0], false);
  assert.equal((await backupFile.exists())[0], true, "Private audio snapshot is retained separately, never declared erased");
  assert.equal((await db.doc(`accountDeletionGuards/${uid}`).get()).get("status"), "completed");
  await backend.updateMetricsOnPost.run(oldPostEvent);
  assert.equal((await db.doc(`userMetrics/${uid}`).get()).exists, false);
  assert(attempts.some(item => item.phase === "auth-delete-attempt"));
  console.log("OK: local Firestore/Auth/Storage erasure; freeze, bounded calls, quiescence, late jobs, exact approval, interrupted transaction resume and lost Auth response finalization, counters once, private pairs, preserved other accounts/outbox/ledgers and verified Auth/Storage removal. Backup is a documented fixture, not a real managed-restore test.");
}

run().then(() => db.terminate()).catch(async error => { console.error(error); await db.terminate(); process.exitCode = 1; });
