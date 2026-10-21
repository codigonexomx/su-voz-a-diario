"use strict";

const { createHash } = require("node:crypto");
const { FieldPath, FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { blockedAccounts } = require("./accountDeletionAccess");
const { eventRef, getContentOwner } = require("./communityActivity");

const PRAYER_NOTICES = Object.freeze({
  newPrayer: { title: "Nueva petición de oración", body: "Una persona pide el acompañamiento de la comunidad." },
  prayerSupport: { title: "Te acompañan en oración", body: "Alguien de la comunidad está orando por tu petición." },
  prayerAnswered: { title: "Una petición tiene una actualización", body: "Una petición que acompañas se ha marcado como respondida." },
});
const validId = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const digest = value => createHash("sha256").update(value).digest("hex");

function prayerNoticeContext(prayerId, type) {
  if (!validId(prayerId) || !PRAYER_NOTICES[type]) return null;
  return { ...PRAYER_NOTICES[type], prayerId, notificationType: type,
    url: `https://suvoz.app/#community?section=prayer&prayer=${encodeURIComponent(prayerId)}`,
    tag: "community-prayer" };
}

async function queuePrayerPage(db, { prayerId, type, actorUid, uids }) {
  const notice = prayerNoticeContext(prayerId, type);
  const recipients = [...new Set(uids)].filter(uid => validId(uid) && uid !== actorUid).slice(0, 100);
  if (!notice || !validId(actorUid) || !recipients.length) return 0;
  return db.runTransaction(async transaction => {
    const [prayer, privateDoc] = await transaction.getAll(
      db.doc(`communityPrayerRequests/${prayerId}`), db.doc(`communityPrayerPrivate/${prayerId}`));
    const ownerUid = privateDoc.get("ownerUid");
    if (!prayer.exists || !validId(ownerUid) || prayer.get("moderationStatus") === "hidden"
      || (type === "prayerAnswered" ? prayer.get("status") !== "answered" : prayer.get("status") !== "active")
      || (type !== "prayerSupport" && ownerUid !== actorUid)) return 0;
    const frozen = await blockedAccounts(db, [...recipients, actorUid, ownerUid], transaction);
    if (frozen.has(actorUid) || frozen.has(ownerUid)) return 0;
    const records = await transaction.getAll(...recipients.flatMap(uid => [
      eventRef(db, type, `${prayerId}:${uid}${type === "prayerSupport" ? `:${actorUid}` : ""}`), db.doc(`userActivity/${uid}`),
      db.doc(`communityBlocks/${uid}/authors/${actorUid}`), db.doc(`communityBlocks/${actorUid}/authors/${uid}`),
      db.doc(`communityPrayerCommitments/${prayerId}_${type === "prayerSupport" ? actorUid : uid}`),
    ]));
    const updates = [];
    recipients.forEach((uid, index) => {
      const [seen, activity, blockedActor, blockedRecipient, commitment] = records.slice(index * 5, index * 5 + 5);
      if (seen.exists || frozen.has(uid) || blockedActor.exists || blockedRecipient.exists
        || type === "prayerSupport" && (uid !== ownerUid || !commitment.exists)
        || type === "prayerAnswered" && !commitment.exists) return;
      const count = activity.get("unreadCommunityCount");
      const badgeCount = Number.isInteger(count) && count >= 0 ? count + 1 : 1;
      transaction.create(seen.ref, { completed: true, createdAt: FieldValue.serverTimestamp() });
      transaction.set(activity.ref, { unreadCommunityCount: badgeCount,
        ...(!activity.exists ? { lastCommunitySeenAt: FieldValue.serverTimestamp() } : {}) }, { merge: true });
      transaction.create(db.collection("notifications").doc(seen.id), {
        userId: uid, type, prayerId, title: notice.title, body: notice.body,
        isRead: false, createdAt: FieldValue.serverTimestamp(),
      });
      updates.push({ uid, badgeCount });
    });
    if (updates.length) transaction.create(db.collection("communityActivityDeliveries").doc(
      digest(`${type}:${prayerId}:${actorUid}:${updates.map(item => item.uid).join(":")}`)), {
      updates, prayerId, notificationType: type, delivered: false, createdAt: FieldValue.serverTimestamp(),
    });
    return updates.length;
  });
}

async function queuePrayerActivity(db, prayerId, type, actorUid) {
  if (!validId(prayerId) || !PRAYER_NOTICES[type] || !validId(actorUid)) return 0;
  if (type === "prayerSupport") {
    const ownerUid = await getContentOwner(db, "communityPrayerRequests", "communityPrayerPrivate", prayerId);
    return queuePrayerPage(db, { prayerId, type, actorUid, uids: ownerUid ? [ownerUid] : [] });
  }
  let cursor = null, total = 0;
  for (;;) {
    let query = type === "newPrayer" ? db.collection("userActivity").orderBy(FieldPath.documentId())
      : db.collection("communityPrayerCommitments").where("requestId", "==", prayerId).orderBy(FieldPath.documentId());
    if (cursor) query = query.startAfter(cursor);
    const page = await query.limit(100).get();
    total += await queuePrayerPage(db, { prayerId, type, actorUid,
      uids: page.docs.map(item => type === "newPrayer" ? item.id : item.get("ownerUid")) });
    if (page.size < 100) return total;
    cursor = page.docs.at(-1);
  }
}

async function getPrayerDeliveryUpdates(db, delivery, updates) {
  const prayerId = delivery.prayerId;
  if (!prayerNoticeContext(prayerId, delivery.notificationType)) return [];
  const [prayer, privateDoc] = await db.getAll(db.doc(`communityPrayerRequests/${prayerId}`), db.doc(`communityPrayerPrivate/${prayerId}`));
  const ownerUid = privateDoc.get("ownerUid");
  if (!prayer.exists || prayer.get("moderationStatus") === "hidden" || !validId(ownerUid)
    || (delivery.notificationType === "prayerAnswered" ? prayer.get("status") !== "answered" : prayer.get("status") !== "active")
    || (await blockedAccounts(db, [ownerUid])).size) return [];
  const answered = delivery.notificationType === "prayerAnswered";
  const records = updates.length ? await db.getAll(...updates.flatMap(item => [
    db.doc(`communityBlocks/${item.uid}/authors/${ownerUid}`), db.doc(`communityBlocks/${ownerUid}/authors/${item.uid}`),
    ...(answered ? [db.doc(`communityPrayerCommitments/${prayerId}_${item.uid}`)] : []),
  ])) : [];
  const stride = answered ? 3 : 2;
  return updates.filter((item, index) => !records[index * stride].exists && !records[index * stride + 1].exists
    && (!answered || records[index * stride + 2].exists));
}

async function listMyPrayerRequests(db, uid, data = {}) {
  if (!data || typeof data !== "object") throw new HttpsError("invalid-argument", "PRAYER_LIST_INVALID");
  const following = data.mode === "following";
  if (!validId(uid) || !["mine", "following"].includes(data.mode)) throw new HttpsError("invalid-argument", "PRAYER_LIST_INVALID");
  const collection = db.collection(following ? "communityPrayerCommitments" : "communityPrayerPrivate");
  let query = collection.where("ownerUid", "==", uid).orderBy("createdAt", "desc");
  if (data.cursor) {
    if (typeof data.cursor !== "string" || data.cursor.length > 300 || data.cursor.includes("/")) throw new HttpsError("invalid-argument", "PRAYER_CURSOR_INVALID");
    const cursor = await collection.doc(data.cursor).get();
    if (!cursor.exists || cursor.get("ownerUid") !== uid) throw new HttpsError("invalid-argument", "PRAYER_CURSOR_INVALID");
    query = query.startAfter(cursor);
  }
  const page = await query.limit(20).get();
  const ids = page.docs.map(item => following ? item.get("requestId") : item.id).filter(validId);
  const parents = ids.length ? await db.getAll(...ids.map(id => db.doc(`communityPrayerRequests/${id}`))) : [];
  const posts = parents.filter(item => item.exists && item.get("moderationStatus") !== "hidden").map(item => ({ ...item.data(), id: item.id }));
  return { posts, hasMore: page.size === 20, cursor: page.docs.at(-1)?.id || null };
}

async function cleanupDeletedPrayerActivity(db, prayerId) {
  if (!validId(prayerId)) return;
  // A deletion trigger retries this bounded cleanup if a batch fails.
  for (const [collection, field] of [["notifications", "prayerId"], ["communityPrayerCommitments", "requestId"]]) {
    for (;;) {
      const page = await db.collection(collection).where(field, "==", prayerId).limit(400).get();
      if (page.empty) break;
      const batch = db.batch();
      page.docs.forEach(item => batch.delete(item.ref));
      await batch.commit();
    }
  }
}

module.exports = { PRAYER_NOTICES, prayerNoticeContext, queuePrayerActivity, getPrayerDeliveryUpdates, listMyPrayerRequests, cleanupDeletedPrayerActivity };
