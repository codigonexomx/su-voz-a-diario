"use strict";

const { createHash } = require("node:crypto");
const { FieldPath, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

async function getContentOwner(db, collectionName, privateCollection, id) {
  if (typeof id !== "string" || !id || id.includes("/")) return null;
  const publicDoc = await db.collection(collectionName).doc(id).get();
  if (!publicDoc.exists) return null;
  const publicUid = publicDoc.get("ownerUid");
  if (typeof publicUid === "string" && publicUid) return publicUid;
  const privateDoc = await db.collection(privateCollection).doc(id).get();
  return privateDoc.exists ? privateDoc.get("ownerUid") || null : null;
}

function eventRef(db, kind, eventId) {
  if (typeof eventId !== "string" || !eventId) throw new Error("Activity event ID required");
  const id = createHash("sha256").update(`${kind}:${eventId}`).digest("hex");
  return db.collection("communityActivityEvents").doc(id);
}

async function incrementRecipientOnce(db, kind, eventId, uid, postId = "") {
  if (!uid) return null;
  const ledger = eventRef(db, kind, eventId);
  const activity = db.collection("userActivity").doc(uid);
  return db.runTransaction(async transaction => {
    const [seen, snapshot] = await transaction.getAll(ledger, activity);
    if (seen.exists) return null;
    transaction.create(ledger, { completed: true, createdAt: FieldValue.serverTimestamp() });
    if (!snapshot.exists) return null;
    const current = snapshot.get("unreadCommunityCount");
    const badgeCount = Number.isInteger(current) && current >= 0 ? current + 1 : 1;
    transaction.update(activity, { unreadCommunityCount: badgeCount });
    transaction.create(db.collection("communityActivityDeliveries").doc(ledger.id), {
      updates: [{ uid, badgeCount }], postId, createdAt: FieldValue.serverTimestamp(), delivered: false,
    });
    return { uid, badgeCount };
  });
}

// Cursor and increments commit together. Retries resume without repeating earlier pages.
async function incrementCommunityOnce(db, eventId, actorUid, postId) {
  const ledger = eventRef(db, "post", eventId);
  let total = 0;
  for (;;) {
    const result = await db.runTransaction(async transaction => {
      const progress = await transaction.get(ledger);
      if (progress.get("completed") === true) return null;
      let query = db.collection("userActivity").orderBy(FieldPath.documentId()).limit(100);
      if (progress.get("cursor")) query = query.startAfter(progress.get("cursor"));
      const page = await transaction.get(query);
      const updates = [];
      for (const document of page.docs) {
        if (document.id === actorUid) continue;
        const count = document.get("unreadCommunityCount");
        const badgeCount = Number.isInteger(count) && count >= 0 ? count + 1 : 1;
        transaction.update(document.ref, { unreadCommunityCount: badgeCount });
        updates.push({ uid: document.id, badgeCount });
      }
      const completed = page.size < 100;
      transaction.set(ledger, {
        cursor: page.docs.at(-1)?.id || progress.get("cursor") || null,
        completed,
        createdAt: progress.get("createdAt") || FieldValue.serverTimestamp(),
      });
      if (updates.length) {
        const deliveryId = createHash("sha256").update(`${ledger.id}:${progress.get("cursor") || "first"}`).digest("hex");
        transaction.create(db.collection("communityActivityDeliveries").doc(deliveryId), {
          updates, postId, createdAt: FieldValue.serverTimestamp(), delivered: false,
        });
      }
      return { updates, completed };
    });
    if (!result) return total;
    total += result.updates.length;
    if (result.completed) return total;
  }
}

async function deletePostCascade(db, postId) {
  const parent = db.collection("communityPosts").doc(postId);
  const job = db.collection("communityDeletionJobs").doc(postId);
  const privateRef = db.collection("communityPostPrivate").doc(postId);
  // Capture ownership and remove the parent atomically; a concurrent retry cannot erase the job.
  const jobData = await db.runTransaction(async transaction => {
    const [existing, post, privateDoc] = await transaction.getAll(job, parent, privateRef);
    const data = existing.exists ? existing.data() : {
      postId, ownerUid: post.get("ownerUid") || privateDoc.get("ownerUid") || null,
      audioURL: post.get("audioURL") || null, createdAt: FieldValue.serverTimestamp(),
    };
    if (!existing.exists) transaction.create(job, data);
    transaction.delete(parent);
    transaction.delete(privateRef);
    return data;
  });
  for (;;) {
    const replies = await db.collection("communityReplies").where("postId", "==", postId).limit(200).get();
    if (replies.empty) break;
    const batch = db.batch();
    for (const reply of replies.docs) {
      batch.delete(reply.ref);
      batch.delete(db.collection("communityReplyPrivate").doc(reply.id));
    }
    await batch.commit();
  }
  for (const collectionName of ["communityReactions", "notifications"]) {
    for (;;) {
      const page = await db.collection(collectionName).where("postId", "==", postId).limit(400).get();
      if (page.empty) break;
      const batch = db.batch();
      page.docs.forEach(document => batch.delete(document.ref));
      await batch.commit();
    }
  }
  const audioURL = jobData.audioURL;
  if (audioURL && jobData.ownerUid) {
    let url;
    try { url = new URL(audioURL); } catch { url = null; }
    const bucket = url?.hostname === "firebasestorage.googleapis.com" ? getStorage().bucket() : null;
    const prefix = bucket ? `/v0/b/${bucket.name}/o/` : "";
    if (url?.hostname === "firebasestorage.googleapis.com" && url.pathname.startsWith(prefix)) {
      let path;
      try { path = decodeURIComponent(url.pathname.slice(prefix.length)); } catch { path = ""; }
      if (path.startsWith("community/audio/") && !path.includes("..")) {
        const file = bucket.file(path);
        try {
          const [metadata] = await file.getMetadata();
          if ((metadata.metadata?.ownerUid || metadata.metadata?.uid) === jobData.ownerUid) await file.delete();
        } catch (error) { if (Number(error.code) !== 404) throw error; }
      }
    }
  }
  await job.delete();
}

module.exports = { getContentOwner, eventRef, incrementRecipientOnce, incrementCommunityOnce, deletePostCascade };
