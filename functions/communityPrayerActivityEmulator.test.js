"use strict";

const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")) throw new Error("Local emulator required; production is forbidden");
initializeApp({ projectId: "demo-su-voz-prayer-activity" });
const db = getFirestore(), backend = require("./index");
const { queuePrayerActivity, prayerNoticeContext, getPrayerDeliveryUpdates, listMyPrayerRequests } = require("./communityPrayerActivity");
const now = Timestamp.now();
const put = (path, data) => db.doc(path).set(data);
const activity = uid => put(`userActivity/${uid}`, { unreadCommunityCount: 0, lastCommunitySeenAt: now });
async function seedPrayer(id, owner = "owner") {
  await put(`communityPrayerRequests/${id}`, { text: "PRIVATE-FIXTURE-PETITION", isAnonymous: true, status: "active", prayingCount: 0, createdAt: now });
  await put(`communityPrayerPrivate/${id}`, { ownerUid: owner, createdAt: now });
}
async function commit(uid, id = "prayer") {
  await put(`communityPrayerCommitments/${id}_${uid}`, { requestId: id, ownerUid: uid, createdAt: now });
  return db.doc(`communityPrayerCommitments/${id}_${uid}`).get();
}
async function count(uid) { return (await db.doc(`userActivity/${uid}`).get()).get("unreadCommunityCount"); }
async function notices(uid) { return (await db.collection("notifications").where("userId", "==", uid).get()).docs; }

(async () => {
  for (const collection of ["communityPrayerRequests", "communityPrayerPrivate", "communityPrayerCommitments", "userActivity", "notifications", "communityActivityEvents", "communityActivityDeliveries", "accountDeletionGuards"]) {
    const previous = await db.collection(collection).get();
    for (let offset = 0; offset < previous.size; offset += 400) {
      const batch = db.batch(); previous.docs.slice(offset, offset + 400).forEach(item => batch.delete(item.ref)); await batch.commit();
    }
  }
  await db.doc("communityBlocks/blocked/authors/owner").delete();
  await db.doc("communityBlocks/reader/authors/owner").delete();
  await seedPrayer("prayer");
  await Promise.all(["owner", "reader", "blocked", "frozen", ...Array.from({ length: 105 }, (_, i) => `person-${i}`)].map(activity));
  await put("communityBlocks/blocked/authors/owner", { key: "fictional-block" });
  await put("accountDeletionGuards/frozen", { status: "frozen" });
  await Promise.all([backend.notifyNewPrayerRequest.run({ params: { requestId: "prayer" } }), backend.notifyNewPrayerRequest.run({ params: { requestId: "prayer" } })]);
  assert.equal((await db.collection("notifications").where("type", "==", "newPrayer").get()).size, 106);
  assert.equal(await count("reader"), 1); assert.equal(await count("owner"), 0);
  assert.equal(await count("blocked"), 0); assert.equal(await count("frozen"), 0);
  assert(!(await notices("reader")).some(item => JSON.stringify(item.data()).includes("PRIVATE-FIXTURE")));
  assert((await db.collection("communityActivityDeliveries").get()).size >= 2);
  console.log("OK: 100+ recipients, duplicate/concurrent creation, self exclusion, anonymous text omitted, blocks and frozen accounts");

  const support = await commit("reader");
  const supportEvent = { data: support, params: { commitmentId: support.id } };
  await backend.notifyPrayerSupport.run(supportEvent); await backend.notifyPrayerSupport.run(supportEvent);
  assert.equal(await count("owner"), 1);
  const anotherSupport = await commit("person-0");
  await backend.notifyPrayerSupport.run({ data: anotherSupport });
  assert.equal(await count("owner"), 2, "A distinct supporter generates its own notice");
  await support.ref.delete(); await commit("reader"); await backend.notifyPrayerSupport.run(supportEvent);
  assert.equal(await count("owner"), 2, "Toggling off/on cannot spam the author");
  await queuePrayerActivity(db, "prayer", "prayerSupport", "owner"); assert.equal(await count("owner"), 2);
  const supportNotices = (await notices("owner")).filter(item => item.get("type") === "prayerSupport");
  assert.equal(supportNotices.length, 2);
  assert(supportNotices.every(item => !JSON.stringify(item.data()).includes("reader")));
  console.log("OK: support reaches the author once per supporter, no self notices, no supporter identity disclosed");

  await commit("blocked"); await commit("frozen");
  await put("communityPrayerRequests/prayer", { ...(await db.doc("communityPrayerRequests/prayer").get()).data(), status: "answered" });
  const answeredEvent = { params: { requestId: "prayer" }, data: { before: { get: () => "active" }, after: await db.doc("communityPrayerRequests/prayer").get() } };
  await backend.notifyPrayerAnswered.run(answeredEvent); await backend.notifyPrayerAnswered.run(answeredEvent);
  assert.equal(await count("reader"), 2); assert.equal(await count("person-0"), 2);
  assert.equal(await count("person-1"), 1, "Only current supporters receive answer updates");
  assert.equal(await count("blocked"), 0); assert.equal(await count("frozen"), 0);
  await backend.notifyNewPrayerRequest.run({ params: { requestId: "prayer" } }); assert.equal(await count("person-1"), 1);
  const delivery = { prayerId: "prayer", notificationType: "prayerAnswered" };
  assert.deepEqual(await getPrayerDeliveryUpdates(db, delivery, [{ uid: "reader", badgeCount: 2 }]), [{ uid: "reader", badgeCount: 2 }]);
  await db.doc("communityPrayerCommitments/prayer_reader").delete();
  assert.deepEqual(await getPrayerDeliveryUpdates(db, delivery, [{ uid: "reader", badgeCount: 2 }]), []);
  await commit("reader");
  await put("communityBlocks/reader/authors/owner", { key: "new-block" });
  assert.deepEqual(await getPrayerDeliveryUpdates(db, delivery, [{ uid: "reader", badgeCount: 2 }]), []);
  await db.doc("communityBlocks/reader/authors/owner").delete();
  await db.doc("communityPrayerRequests/prayer").update({ moderationStatus: "hidden" });
  assert.deepEqual(await getPrayerDeliveryUpdates(db, delivery, [{ uid: "reader", badgeCount: 2 }]), []);
  assert.equal(await queuePrayerActivity(db, "prayer", "prayerAnswered", "owner"), 0);
  await db.doc("communityPrayerRequests/prayer").delete();
  assert.deepEqual(await getPrayerDeliveryUpdates(db, delivery, [{ uid: "reader", badgeCount: 2 }]), []);
  await put("notifications/unrelated", { userId: "reader", prayerId: "other-prayer" });
  await backend.cleanupDeletedPrayerActivity.run({ params: { prayerId: "prayer" } });
  await backend.cleanupDeletedPrayerActivity.run({ params: { prayerId: "prayer" } });
  assert.equal((await db.collection("notifications").where("prayerId", "==", "prayer").get()).size, 0);
  assert.equal((await db.collection("communityPrayerCommitments").where("requestId", "==", "prayer").get()).size, 0);
  assert((await db.doc("notifications/unrelated").get()).exists);
  const cleanupBatch = db.batch();
  for (let i = 0; i < 450; i++) cleanupBatch.set(db.doc(`notifications/cleanup-${i}`), { prayerId: "removed-prayer", userId: "reader" });
  await cleanupBatch.commit();
  await backend.cleanupDeletedPrayerActivity.run({ params: { prayerId: "removed-prayer" } });
  assert.equal((await db.collection("notifications").where("prayerId", "==", "removed-prayer").get()).size, 0);
  console.log("OK: answered updates only for active supporters, retries, late creation, newly blocked, hidden and removed targets");

  for (let i = 0; i < 22; i++) {
    const id = `owned-${i}`; await seedPrayer(id, "list-owner");
    await db.doc(`communityPrayerPrivate/${id}`).update({ createdAt: Timestamp.fromMillis(i + 1) });
  }
  const first = await listMyPrayerRequests(db, "list-owner", { mode: "mine" });
  assert.equal(first.posts.length, 20); assert(first.hasMore); assert(first.cursor);
  const last = await listMyPrayerRequests(db, "list-owner", { mode: "mine", cursor: first.cursor });
  assert.equal(last.posts.length, 2); assert(!last.hasMore);
  assert.equal(new Set([...first.posts, ...last.posts].map(item => item.id)).size, 22);
  assert(!JSON.stringify(first.posts).includes("list-owner"));
  await assert.rejects(listMyPrayerRequests(db, "other-user", { mode: "mine", cursor: first.cursor }), error => error.code === "invalid-argument");
  await assert.rejects(listMyPrayerRequests(db, "list-owner", { mode: "mine", cursor: "../unsafe" }), error => error.code === "invalid-argument");
  await assert.rejects(listMyPrayerRequests(db, "list-owner", null), error => error.code === "invalid-argument");
  await commit("reader", "owned-0");
  const following = await listMyPrayerRequests(db, "reader", { mode: "following" });
  assert.deepEqual(following.posts.map(item => item.id), ["owned-0"]);
  await db.doc("communityPrayerRequests/owned-0").update({ moderationStatus: "hidden" });
  assert.equal((await listMyPrayerRequests(db, "reader", { mode: "following" })).posts.length, 0);
  await assert.rejects(backend.listMyPrayerRequests.run({ data: { mode: "mine" } }), error => error.code === "unauthenticated");
  assert.equal(prayerNoticeContext("../unsafe", "newPrayer"), null);
  assert.equal(prayerNoticeContext("prayer", "unknown"), null);
  console.log("OK: private owned/following pagination, more than 20 own requests, hidden parents and cursor/auth isolation");
})().catch(error => { console.error(error); process.exitCode = 1; });
