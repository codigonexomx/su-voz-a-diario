"use strict";

const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall: firebaseOnCall } = require("firebase-functions/v2/https");

const CALL_TIMEOUT_SECONDS = 60;
const QUIESCENCE_MS = 120000;

function guardRef(db, uid) {
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("ACCOUNT_UID_INVALID");
  return db.collection("accountDeletionGuards").doc(uid);
}

async function blockedAccounts(db, uids, transaction) {
  const ids = [...new Set(uids.filter(Boolean))];
  if (!ids.length) return new Set();
  const refs = ids.map(uid => guardRef(db, uid));
  const records = transaction ? await transaction.getAll(...refs) : await db.getAll(...refs);
  return new Set(records.filter(record => record.exists).map(record => record.id));
}

async function assertAccountActive(db, uid, transaction) {
  if ((await blockedAccounts(db, [uid], transaction)).has(uid)) {
    throw new HttpsError("failed-precondition", "ACCOUNT_DELETION_IN_PROGRESS");
  }
}

// Existing calls admitted before a freeze finish within the bounded timeout.
function onCall(options, handler) {
  const timeoutSeconds = Math.min(options.timeoutSeconds || CALL_TIMEOUT_SECONDS, CALL_TIMEOUT_SECONDS);
  return firebaseOnCall({ ...options, timeoutSeconds }, async request => {
    if (request.auth?.uid) await assertAccountActive(getFirestore(), request.auth.uid);
    return handler(request);
  });
}

module.exports = { guardRef, blockedAccounts, assertAccountActive, onCall, CALL_TIMEOUT_SECONDS, QUIESCENCE_MS };
