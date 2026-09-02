"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

const INVISIBLE_OR_CONTROL_PATTERN = /[\p{C}\u200B-\u200F\u202A-\u202E\u2060-\u206F]/gu;

function sanitizePrayerText(rawText, maxChars = 800) {
  if (typeof rawText !== "string") {
    throw new HttpsError("invalid-argument", "PRAYER_TEXT_REQUIRED");
  }

  const cleanText = rawText
    .replace(INVISIBLE_OR_CONTROL_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanText || cleanText.length < 3) {
    throw new HttpsError("invalid-argument", "PRAYER_TEXT_TOO_SHORT");
  }

  if (cleanText.length > maxChars) {
    throw new HttpsError("invalid-argument", "PRAYER_TEXT_TOO_LONG");
  }

  return cleanText;
}

function sanitizeAnsweredText(rawText, maxChars = 400) {
  if (!rawText) return null;
  if (typeof rawText !== "string") return null;

  const cleanText = rawText
    .replace(INVISIBLE_OR_CONTROL_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanText) return null;
  return cleanText.slice(0, maxChars);
}

function createAnonymousPrayerDocument({ text, timestamp }) {
  return {
    text,
    name: "Anónimo",
    isAnonymous: true,
    status: "active",
    prayingCount: 0,
    createdAt: timestamp,
    schemaVersion: 1,
  };
}

function createIdentifiedPrayerDocument({ text, authorSnapshot, timestamp }) {
  return {
    text,
    name: authorSnapshot.displayName,
    isAnonymous: false,
    authorSnapshot,
    status: "active",
    prayingCount: 0,
    createdAt: timestamp,
    schemaVersion: 1,
  };
}

function createPrayerPrivateDocument({ ownerUid, timestamp }) {
  return {
    ownerUid,
    createdAt: timestamp,
    schemaVersion: 1,
  };
}

async function resolvePrayerOwnership(db, requestId, uid) {
  if (!requestId || !uid || typeof requestId !== "string" || typeof uid !== "string") {
    return false;
  }

  const cleanRequestId = requestId.trim();
  const cleanUid = uid.trim();
  if (!cleanRequestId || !cleanUid) return false;

  const privateSnap = await db.collection("communityPrayerPrivate").doc(cleanRequestId).get();
  if (!privateSnap.exists) return false;

  return privateSnap.get("ownerUid") === cleanUid;
}

async function createPrayerRequestLogic(db, FieldValue, uid, data, getRequiredCommunityAuthorSnapshot) {
  const text = sanitizePrayerText(data?.text, 800);
  const isAnonymous = data?.isAnonymous === true;
  const timestamp = FieldValue.serverTimestamp();

  const requestRef = db.collection("communityPrayerRequests").doc();
  const privateRef = db.collection("communityPrayerPrivate").doc(requestRef.id);
  const batch = db.batch();

  if (isAnonymous) {
    batch.set(requestRef, createAnonymousPrayerDocument({
      text,
      timestamp,
    }));

    batch.set(privateRef, createPrayerPrivateDocument({
      ownerUid: uid,
      timestamp,
    }));
  } else {
    const authorSnapshot = await getRequiredCommunityAuthorSnapshot(db, uid);

    batch.set(requestRef, createIdentifiedPrayerDocument({
      text,
      authorSnapshot,
      timestamp,
    }));

    batch.set(privateRef, createPrayerPrivateDocument({
      ownerUid: uid,
      timestamp,
    }));
  }

  await batch.commit();

  return {
    success: true,
    id: requestRef.id,
  };
}

async function getPrayerOwnershipLogic(db, uid, rawRequestIds) {
  if (!Array.isArray(rawRequestIds)) {
    return { requests: {} };
  }

  const uniqueIds = Array.from(
    new Set(rawRequestIds.filter(id => typeof id === "string" && id.trim().length > 0))
  ).slice(0, 50);

  const requests = {};

  await Promise.all(uniqueIds.map(async (requestId) => {
    requests[requestId] = await resolvePrayerOwnership(db, requestId, uid);
  }));

  return { requests };
}

async function deletePrayerRequestLogic(db, uid, requestId) {
  if (!requestId || typeof requestId !== "string") {
    throw new HttpsError("invalid-argument", "REQUEST_ID_INVALID");
  }

  const cleanRequestId = requestId.trim();
  const isOwner = await resolvePrayerOwnership(db, cleanRequestId, uid);

  if (!isOwner) {
    throw new HttpsError("permission-denied", "NOT_OWNER");
  }

  const commitmentsSnap = await db
    .collection("communityPrayerCommitments")
    .where("requestId", "==", cleanRequestId)
    .get();

  const BATCH_SIZE = 450;
  const docsToDelete = [
    db.collection("communityPrayerRequests").doc(cleanRequestId),
    db.collection("communityPrayerPrivate").doc(cleanRequestId),
    ...commitmentsSnap.docs.map((docSnap) => docSnap.ref),
  ];

  for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docsToDelete.slice(i, i + BATCH_SIZE);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  return { success: true };
}

async function togglePrayerCommitmentLogic(db, FieldValue, uid, requestId) {
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }

  if (!requestId || typeof requestId !== "string") {
    throw new HttpsError("invalid-argument", "REQUEST_ID_INVALID");
  }

  const cleanRequestId = requestId.trim();
  if (!cleanRequestId) {
    throw new HttpsError("invalid-argument", "REQUEST_ID_INVALID");
  }

  const requestRef = db.collection("communityPrayerRequests").doc(cleanRequestId);
  const commitmentRef = db.collection("communityPrayerCommitments").doc(`${cleanRequestId}_${uid}`);

  return db.runTransaction(async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists) {
      throw new HttpsError("not-found", "PRAYER_REQUEST_NOT_FOUND");
    }

    if (requestSnap.get("status") === "answered") {
      throw new HttpsError("failed-precondition", "PRAYER_REQUEST_ANSWERED");
    }

    const commitmentSnap = await transaction.get(commitmentRef);
    const currentCount = Number.isInteger(requestSnap.get("prayingCount"))
      ? requestSnap.get("prayingCount")
      : 0;

    if (commitmentSnap.exists) {
      const newCount = Math.max(0, currentCount - 1);
      transaction.delete(commitmentRef);
      transaction.update(requestRef, { prayingCount: newCount });
      return { success: true, active: false, prayingCount: newCount };
    } else {
      const newCount = currentCount + 1;
      transaction.set(commitmentRef, {
        requestId: cleanRequestId,
        ownerUid: uid,
        createdAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      });
      transaction.update(requestRef, { prayingCount: newCount });
      return { success: true, active: true, prayingCount: newCount };
    }
  });
}

async function getPrayerCommitmentStatusLogic(db, uid, rawRequestIds) {
  if (!uid || typeof uid !== "string") {
    return { commitments: {} };
  }

  if (!Array.isArray(rawRequestIds)) {
    return { commitments: {} };
  }

  const uniqueIds = Array.from(
    new Set(rawRequestIds.filter(id => typeof id === "string" && id.trim().length > 0))
  ).slice(0, 50);

  const commitments = {};

  await Promise.all(
    uniqueIds.map(async (requestId) => {
      const commitmentSnap = await db
        .collection("communityPrayerCommitments")
        .doc(`${requestId}_${uid}`)
        .get();
      commitments[requestId] = commitmentSnap.exists;
    })
  );

  return { commitments };
}

async function markPrayerRequestAnsweredLogic(db, FieldValue, uid, requestId, rawAnsweredText) {
  if (!requestId || typeof requestId !== "string") {
    throw new HttpsError("invalid-argument", "REQUEST_ID_INVALID");
  }

  const cleanRequestId = requestId.trim();
  const isOwner = await resolvePrayerOwnership(db, cleanRequestId, uid);

  if (!isOwner) {
    throw new HttpsError("permission-denied", "NOT_OWNER");
  }

  const answeredText = sanitizeAnsweredText(rawAnsweredText, 400);
  const timestamp = FieldValue.serverTimestamp();

  const updatePayload = {
    status: "answered",
    answeredAt: timestamp,
  };

  if (answeredText) {
    updatePayload.answeredText = answeredText;
  }

  await db.collection("communityPrayerRequests").doc(cleanRequestId).update(updatePayload);

  return { success: true };
}

module.exports = {
  sanitizePrayerText,
  sanitizeAnsweredText,
  createAnonymousPrayerDocument,
  createIdentifiedPrayerDocument,
  createPrayerPrivateDocument,
  resolvePrayerOwnership,
  createPrayerRequestLogic,
  getPrayerOwnershipLogic,
  deletePrayerRequestLogic,
  markPrayerRequestAnsweredLogic,
  togglePrayerCommitmentLogic,
  getPrayerCommitmentStatusLogic,
};
