"use strict";

const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")) throw new Error("Local Firestore emulator required; production is forbidden");
initializeApp({ projectId: "demo-su-voz-stability", storageBucket: "demo-su-voz-stability.test" });
const db = getFirestore();
const backend = require("./index");
const safety = require("./communitySafety");
const activity = require("./communityActivity");

async function request(name, uid, data = {}, token = {}) {
  return backend[name].run({ auth: { uid, token }, data });
}
function event(id, postId, data, replyId) {
  return { id, time: new Date().toISOString(), params: replyId ? { replyId } : { postId }, data: { data: () => data, createTime: Timestamp.now() } };
}
async function seed(path, value) { await db.doc(path).set(value); }

async function run() {
  for (const name of ["communityPosts", "communityPostPrivate", "communityReplies", "communityReplyPrivate", "communityReactions", "communityActivityEvents", "communityActivityDeliveries", "communityDeletionJobs", "communityReports", "communityRateLimits", "communityBlocks", "communityConfiguration", "communityTerms", "communityPrayerRequests", "communityPrayerPrivate", "userActivity", "userMetrics", "notifications", "pushTokens", "accountDeletionRequests"]) {
    await db.recursiveDelete(db.collection(name));
  }
  const author = "private-author-uid", reader = "reader-uid";
  for (const uid of [author, reader]) await seed(`userActivity/${uid}`, { unreadCommunityCount: 0, lastCommunitySeenAt: Timestamp.now() });
  await request("acceptCommunityTerms", author, { version: safety.TERMS_VERSION, accepted: true });
  const created = await request("createCommunityPost", author, {
    text: "Reflexión ficticia para pruebas locales", reference: "Juan 3:16", date: "2026-10-01", isAnonymous: true, termsVersion: safety.TERMS_VERSION,
  });
  const post = (await db.collection("communityPosts").doc(created.id).get()).data();
  assert.equal(post.ownerUid, undefined);
  assert.equal(await activity.getContentOwner(db, "communityPosts", "communityPostPrivate", created.id), author);
  const postEvent = event("post-event", created.id, post);
  await backend.countNewCommunityPost.run(postEvent);
  await backend.countNewCommunityPost.run(postEvent);
  assert.equal((await db.doc(`userActivity/${author}`).get()).get("unreadCommunityCount"), 0);
  assert.equal((await db.doc(`userActivity/${reader}`).get()).get("unreadCommunityCount"), 1);
  const fanoutSeed = db.batch();
  for (let i = 0; i < 130; i++) fanoutSeed.set(db.doc(`userActivity/fanout-${String(i).padStart(3, "0")}`), { unreadCommunityCount: 0 });
  await fanoutSeed.commit();
  await Promise.all([activity.incrementCommunityOnce(db, "concurrent-pages", author, created.id), activity.incrementCommunityOnce(db, "concurrent-pages", author, created.id)]);
  for (const doc of (await db.collection("userActivity").get()).docs) {
    if (doc.id.startsWith("fanout-")) assert.equal(doc.get("unreadCommunityCount"), 1);
  }
  assert.equal((await db.doc(`userActivity/${author}`).get()).get("unreadCommunityCount"), 0);

  await request("acceptCommunityTerms", reader, { version: safety.TERMS_VERSION, accepted: true });
  const reply = await request("createCommunityReply", reader, { postId: created.id, text: "Respuesta ficticia de otro usuario", date: "2026-10-01", isAnonymous: true, termsVersion: safety.TERMS_VERSION });
  const replyData = (await db.doc(`communityReplies/${reply.id}`).get()).data();
  const replyEvent = event("reply-event", created.id, replyData, reply.id);
  await backend.countNewCommunityReply.run(replyEvent);
  await backend.countNewCommunityReply.run(replyEvent);
  assert.equal((await db.doc(`userActivity/${author}`).get()).get("unreadCommunityCount"), 1);
  await backend.notifyPostOwnerInApp.run(replyEvent);
  await backend.notifyPostOwnerInApp.run(replyEvent);
  assert.equal((await db.collection("notifications").where("type", "==", "newReply").get()).size, 1);
  await backend.updateMetricsOnPost.run(postEvent);
  await backend.updateStreakOnPost.run({ ...postEvent, id: "another-trigger-id" });
  assert.equal((await db.doc(`userMetrics/${author}`).get()).get("postsCreated"), 1);
  assert.equal((await db.doc(`userMetrics/${author}`).get()).get("currentStreak"), 1);
  const legacyAuthor = "legacy-metrics-author";
  await seed("communityPosts/legacy-metrics-post", { ownerUid: legacyAuthor });
  await seed(`userMetrics/${legacyAuthor}`, { currentStreak: 4, longestStreak: 4, lastActiveDate: Timestamp.fromDate(new Date("2026-09-30T18:00:00Z")) });
  await backend.updateMetricsOnPost.run(event("legacy-metrics-event", "legacy-metrics-post", { createdAt: Timestamp.fromDate(new Date("2026-10-01T18:00:00Z")) }));
  assert.equal((await db.doc(`userMetrics/${legacyAuthor}`).get()).get("currentStreak"), 5, "Legacy streak survives the first upgraded event");
  const deliveries = await db.collection("communityActivityDeliveries").get();
  for (const delivery of deliveries.docs) {
    await backend.deliverCommunityBadgeUpdates.run({ params: { deliveryId: delivery.id } });
    assert.equal((await delivery.ref.get()).get("delivered"), true);
  }
  assert.equal((await db.collection("pushTokens").get()).size, 0);
  console.log("OK: anonymous ownership, self activity exclusion, replay-safe counters/metrics, outbox, zero real push tokens");

  await seed("communityPrayerRequests/audit-prayer", { text: "Oración ficticia", isAnonymous: true });
  await seed("communityPrayerPrivate/audit-prayer", { ownerUid: author });
  const block = await request("blockCommunityAuthor", reader, { type: "post", id: created.id });
  const state = await request("getCommunitySafetyState", reader, { post: [created.id], prayer: ["audit-prayer"], reply: [reply.id] });
  assert.equal(state.hidden.post[created.id], true);
  assert.equal(state.hidden.prayer["audit-prayer"], true);
  assert.equal(state.hidden.reply[reply.id], false);
  assert(!JSON.stringify(state).includes(author), "Blocked anonymous UID must never be returned");
  await request("unblockCommunityAuthor", reader, { key: block.key });
  assert.equal((await request("getCommunitySafetyState", reader, { post: [created.id] })).hidden.post[created.id], undefined);
  await assert.rejects(request("blockCommunityAuthor", author, { type: "post", id: created.id }), error => error.code === "invalid-argument");
  console.log("OK: blocking across posts/prayers without disclosing anonymous UID; unblock and self-block protection");

  await request("reportCommunityContent", reader, { type: "post", id: created.id, reason: "Spam o promoción", comments: "Datos ficticios" });
  await request("reportCommunityContent", reader, { type: "post", id: created.id, reason: "Spam o promoción" });
  assert.equal((await db.collection("communityReports").get()).size, 1);
  await assert.rejects(request("listCommunityReports", reader), error => error.code === "permission-denied");
  await assert.rejects(request("listCommunityReports", reader, {}, { moderator: true }), error => error.code === "permission-denied");
  await seed("communityConfiguration/moderation", { moderatorUid: "sole-moderator" });
  const queue = await request("listCommunityReports", "sole-moderator", {}, { moderator: true });
  assert.equal(queue.reports.length, 1);
  const reference = queue.reports[0].reference;
  await request("resolveCommunityReport", "sole-moderator", { reference, decision: "hide" }, { moderator: true });
  assert.equal((await db.doc(`communityPosts/${created.id}`).get()).get("moderationStatus"), "hidden");
  await assert.rejects(request("createCommunityReply", reader, { postId: created.id, text: "Respuesta ficticia", date: "2026-10-01", isAnonymous: true, termsVersion: safety.TERMS_VERSION }), error => error.code === "failed-precondition");
  await request("resolveCommunityReport", "sole-moderator", { reference, decision: "restore" }, { moderator: true });
  assert.equal((await db.doc(`communityPosts/${created.id}`).get()).get("moderationStatus"), "visible");
  console.log("OK: private reports, duplicate suppression, single pinned moderator, reversible removal");

  await assert.rejects(request("requestAccountDeletion", reader, {}), error => error.code === "invalid-argument");
  await assert.rejects(request("requestAccountDeletion", reader, { confirmed: true }, { auth_time: 1, email: "unverified@example.test" }), error => error.code === "failed-precondition");
  await request("requestAccountDeletion", reader, { confirmed: true }, { firebase: { sign_in_provider: "anonymous" }, email: "unverified@example.test" });
  await request("requestAccountDeletion", reader, { confirmed: true }, { firebase: { sign_in_provider: "anonymous" } });
  const deletion = await db.collection("accountDeletionRequests").get();
  assert.equal(deletion.size, 1); assert.equal(deletion.docs[0].get("email"), null);
  assert.equal((await db.doc(`communityPosts/${created.id}`).get()).exists, true, "Request is not falsely represented as immediate deletion");
  await assert.rejects(request("listAccountDeletionRequests", reader), error => error.code === "permission-denied");
  assert.equal((await request("listAccountDeletionRequests", "sole-moderator", {}, { moderator: true })).requests.length, 1);
  console.log("OK: private, deduplicated account requests, explicit consent, recent authentication and no destructive action");
  await db.doc("pushTokens/test-device").set({ uid: reader, token: "fixture-not-a-real-token" });
  await assert.rejects(request("detachAccountPushDevice", author, { deviceId: "test-device" }), error => error.code === "permission-denied");
  assert.equal((await db.doc("pushTokens/test-device").get()).exists, true);
  await request("detachAccountPushDevice", reader, { deviceId: "test-device" });
  await request("detachAccountPushDevice", reader, { deviceId: "test-device" });
  assert.equal((await db.doc("pushTokens/test-device").get()).exists, false);
  await assert.rejects(request("detachAccountPushDevice", reader, { deviceId: "../unsafe" }), error => error.code === "invalid-argument");
  console.log("OK: push detachment requires current ownership, retries missing records safely and rejects invalid paths");

  await assert.rejects(safety.requireCommunityTerms(db, "no-terms", { termsVersion: safety.TERMS_VERSION }), error => error.code === "failed-precondition");
  await safety.requireCommunityTerms(db, author, { termsVersion: safety.TERMS_VERSION });
  for (let i = 0; i < 5; i++) await safety.consumeRateLimit(db, "rate-user", "post", 1000);
  await assert.rejects(safety.consumeRateLimit(db, "rate-user", "post", 1000), error => error.code === "resource-exhausted");
  await safety.consumeRateLimit(db, "rate-user", "post", 3600000);
  process.env.COMMUNITY_ENFORCE_APP_CHECK = "true";
  assert.throws(() => safety.requireUser({ auth: { uid: reader } }), error => error.code === "failed-precondition");
  assert.equal(safety.requireUser({ auth: { uid: reader }, app: { appId: "test-app" } }), reader);
  for (const name of ["createCommunityPost", "createCommunityReply", "createPrayerRequest"]) {
    await assert.rejects(request(name, reader, {}), error => error.code === "failed-precondition");
  }
  delete process.env.COMMUNITY_ENFORCE_APP_CHECK;
  console.log("OK: recorded terms, rate limits/window reset and controlled App Check enforcement");

  await seed("communityPosts/old-post", { text: "Antiguo ficticio", ownerUid: author, createdAt: Timestamp.fromMillis(Date.now() - 100 * 86400000) });
  await seed("communityPostPrivate/old-post", { ownerUid: author });
  for (let start = 0; start < 520; start += 200) {
    const batch = db.batch();
    for (let i = start; i < Math.min(520, start + 200); i++) {
      batch.set(db.doc(`communityReplies/old-reply-${i}`), { postId: "old-post", text: "Ficticio" });
      batch.set(db.doc(`communityReplyPrivate/old-reply-${i}`), { postId: "old-post", ownerUid: reader });
    }
    await batch.commit();
  }
  await seed("communityReactions/old-reaction", { postId: "old-post" });
  await seed("notifications/old-notification", { postId: "old-post" });
  await backend.cleanupOldData.run({});
  assert.equal((await db.doc("communityPosts/old-post").get()).exists, false);
  assert.equal((await db.doc("communityPostPrivate/old-post").get()).exists, false);
  assert.equal((await db.collection("communityReplies").where("postId", "==", "old-post").get()).size, 0);
  assert.equal((await db.doc("communityReplyPrivate/old-reply-519").get()).exists, false);
  assert.equal((await db.doc("communityReactions/old-reaction").get()).exists, false);
  assert.equal((await db.doc("notifications/old-notification").get()).exists, false);
  await seed("communityDeletionJobs/interrupted-post", { postId: "interrupted-post", ownerUid: author });
  await seed("communityReplies/interrupted-reply", { postId: "interrupted-post" });
  await seed("communityReplyPrivate/interrupted-reply", { ownerUid: author });
  await backend.cleanupOldData.run({});
  assert.equal((await db.doc("communityReplies/interrupted-reply").get()).exists, false);
  assert.equal((await db.doc("communityDeletionJobs/interrupted-post").get()).exists, false);
  await seed("communityPosts/concurrent-delete", { ownerUid: author, audioURL: "https://firebasestorage.googleapis.com/v0/b/demo-su-voz-stability.test/o/%ZZ" });
  await Promise.all([activity.deletePostCascade(db, "concurrent-delete"), activity.deletePostCascade(db, "concurrent-delete")]);
  assert.equal((await db.doc("communityPosts/concurrent-delete").get()).exists, false);
  assert.equal((await db.doc("communityDeletionJobs/concurrent-delete").get()).exists, false);
  console.log("OK: cascade cleanup across 520 replies/private records, reactions, notifications and interrupted-job recovery");
}

run().then(() => db.terminate()).catch(async error => { console.error(error); await db.terminate(); process.exitCode = 1; });
