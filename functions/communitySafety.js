"use strict";

const { createHash } = require("node:crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { onCall } = require("./accountDeletionAccess");
const { getContentOwner } = require("./communityActivity");

const TERMS_VERSION = "2026-10-01";
const CONTENT = Object.freeze({
  post: ["communityPosts", "communityPostPrivate"],
  reply: ["communityReplies", "communityReplyPrivate"],
  prayer: ["communityPrayerRequests", "communityPrayerPrivate"],
});
const REASONS = ["Contenido inapropiado", "Spam o promoción", "Contenido ofensivo", "Información engañosa", "Acoso o bullying", "Otro motivo"];
const LIMITS = { post: [5, 3600000], reply: [30, 3600000], prayer: [5, 3600000], report: [20, 3600000], block: [50, 3600000], bible: [120, 60000], account: [3, 86400000] };

function requireUser(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  // Enable only after all supported clients have an App Check provider configured.
  if (process.env.COMMUNITY_ENFORCE_APP_CHECK === "true" && !request.app) {
    throw new HttpsError("failed-precondition", "APP_CHECK_REQUIRED");
  }
  return request.auth.uid;
}

function validateTarget(data) {
  if (!Object.hasOwn(CONTENT, data?.type) || typeof data?.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(data.id)) {
    throw new HttpsError("invalid-argument", "CONTENT_ID_INVALID");
  }
  return { type: data.type, id: data.id };
}

async function consumeRateLimit(db, uid, action, now = Date.now()) {
  const [limit, duration] = LIMITS[action];
  const ref = db.collection("communityRateLimits").doc(`${uid}_${action}`);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const bucket = Math.floor(now / duration);
    const count = snapshot.get("bucket") === bucket ? snapshot.get("count") || 0 : 0;
    if (count >= limit) throw new HttpsError("resource-exhausted", "Has realizado varias acciones. Espera un momento antes de intentarlo de nuevo.");
    transaction.set(ref, { bucket, count: count + 1, updatedAt: FieldValue.serverTimestamp() });
  });
}

async function requireCommunityTerms(db, uid, data) {
  if (data?.termsVersion === TERMS_VERSION) {
    const accepted = await db.collection("communityTerms").doc(uid).get();
    if (accepted.get("version") === TERMS_VERSION) return;
  }
  if (process.env.COMMUNITY_REQUIRE_TERMS === "true" || data?.termsVersion) {
    throw new HttpsError("failed-precondition", "COMMUNITY_TERMS_REQUIRED");
  }
  // Legacy native clients need a coordinated release before server enforcement.
}

async function isModerator(db, request) {
  if (request.auth?.token?.moderator !== true) return false;
  const config = await db.collection("communityConfiguration").doc("moderation").get();
  return Boolean(config.exists && config.get("moderatorUid") === request.auth.uid);
}

async function requireModerator(db, request) {
  if (!(await isModerator(db, request))) throw new HttpsError("permission-denied", "MODERATOR_REQUIRED");
}

const options = { region: "us-central1", maxInstances: 10 };

const detachAccountPushDevice = onCall(options, async request => {
  const uid = requireUser(request);
  const deviceId = request.data?.deviceId;
  if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(deviceId)) throw new HttpsError("invalid-argument", "DEVICE_ID_INVALID");
  const db = getFirestore();
  await db.runTransaction(async transaction => {
    const ref = db.collection("pushTokens").doc(deviceId);
    const record = await transaction.get(ref);
    if (!record.exists) return;
    if (record.get("uid") !== uid) throw new HttpsError("permission-denied", "NOT_OWNER");
    transaction.delete(ref);
  });
  return { success: true };
});

const requestAccountDeletion = onCall(options, async request => {
  const uid = requireUser(request);
  if (request.data?.confirmed !== true) throw new HttpsError("invalid-argument", "DELETION_CONFIRMATION_REQUIRED");
  const token = request.auth.token || {};
  if (token.firebase?.sign_in_provider !== "anonymous" && (!Number.isFinite(token.auth_time) || Date.now() / 1000 - token.auth_time > 300)) {
    throw new HttpsError("failed-precondition", "RECENT_AUTH_REQUIRED");
  }
  const db = getFirestore();
  await consumeRateLimit(db, uid, "account");
  const key = createHash("sha256").update(`account-deletion:${uid}`).digest("hex");
  const ref = db.collection("accountDeletionRequests").doc(key);
  await db.runTransaction(async transaction => {
    const previous = await transaction.get(ref);
    if (previous.exists) return;
    transaction.create(ref, { uid, email: token.email_verified === true ? token.email || null : null,
      status: "pending", requestedAt: FieldValue.serverTimestamp() });
  });
  return { received: true, reference: key.slice(0, 12) };
});

const listAccountDeletionRequests = onCall(options, async request => {
  requireUser(request);
  const db = getFirestore();
  await requireModerator(db, request);
  const records = await db.collection("accountDeletionRequests").where("status", "==", "pending").limit(50).get();
  return { requests: records.docs.map(record => ({ reference: record.id, email: record.get("email") || null,
    requestedAt: record.get("requestedAt")?.toMillis?.() || 0 })) };
});

const acceptCommunityTerms = onCall(options, async request => {
  const uid = requireUser(request);
  if (request.data?.version !== TERMS_VERSION || request.data?.accepted !== true) {
    throw new HttpsError("invalid-argument", "COMMUNITY_TERMS_REQUIRED");
  }
  await getFirestore().collection("communityTerms").doc(uid).set({ version: TERMS_VERSION, acceptedAt: FieldValue.serverTimestamp() });
  return { success: true, version: TERMS_VERSION };
});

const reportCommunityContent = onCall(options, async request => {
  const uid = requireUser(request);
  const target = validateTarget(request.data);
  if (!REASONS.includes(request.data?.reason) || typeof (request.data?.comments || "") !== "string" || (request.data?.comments || "").length > 500) {
    throw new HttpsError("invalid-argument", "REPORT_REASON_INVALID");
  }
  const db = getFirestore();
  const content = await db.collection(CONTENT[target.type][0]).doc(target.id).get();
  if (!content.exists) throw new HttpsError("not-found", "CONTENT_NOT_FOUND");
  await consumeRateLimit(db, uid, "report");
  const key = createHash("sha256").update(`${uid}:${target.type}:${target.id}`).digest("hex");
  const report = db.collection("communityReports").doc(key);
  await db.runTransaction(async transaction => {
    const previous = await transaction.get(report);
    if (previous.exists) return;
    transaction.create(report, {
      ...target, reportedBy: uid, reason: request.data.reason,
      comments: (request.data.comments || "").trim(),
      contentText: String(content.get("text") || "").slice(0, 4000),
      status: "pending", createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { success: true, reference: key.slice(0, 12) };
});

const blockCommunityAuthor = onCall(options, async request => {
  const uid = requireUser(request);
  const target = validateTarget(request.data);
  const db = getFirestore();
  const [collection, privateCollection] = CONTENT[target.type];
  const targetUid = await getContentOwner(db, collection, privateCollection, target.id);
  if (!targetUid) throw new HttpsError("not-found", "CONTENT_AUTHOR_UNAVAILABLE");
  if (targetUid === uid) throw new HttpsError("invalid-argument", "CANNOT_BLOCK_SELF");
  await consumeRateLimit(db, uid, "block");
  const key = createHash("sha256").update(`${uid}:${targetUid}`).digest("hex");
  await db.collection("communityBlocks").doc(uid).collection("authors").doc(targetUid).set({
    key, createdAt: FieldValue.serverTimestamp(),
  });
  return { success: true, key };
});

const unblockCommunityAuthor = onCall(options, async request => {
  const uid = requireUser(request);
  if (!/^[a-f0-9]{64}$/.test(request.data?.key || "")) throw new HttpsError("invalid-argument", "BLOCK_ID_INVALID");
  const db = getFirestore();
  const matches = await db.collection("communityBlocks").doc(uid).collection("authors").where("key", "==", request.data.key).limit(1).get();
  for (const item of matches.docs) await item.ref.delete();
  return { success: true };
});

const getCommunitySafetyState = onCall(options, async request => {
  const uid = requireUser(request);
  const db = getFirestore();
  const blocked = await db.collection("communityBlocks").doc(uid).collection("authors").get();
  const blockedUids = new Set(blocked.docs.map(item => item.id));
  const hidden = {};
  for (const type of Object.keys(CONTENT)) {
    const ids = [...new Set(Array.isArray(request.data?.[type]) ? request.data[type] : [])];
    if (ids.length > 50 || ids.some(id => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))) throw new HttpsError("invalid-argument", "CONTENT_ID_INVALID");
    hidden[type] = {};
    if (blockedUids.size) await Promise.all(ids.map(async id => {
      const owner = await getContentOwner(db, ...CONTENT[type], id);
      hidden[type][id] = blockedUids.has(owner);
    }));
  }
  return { hidden, blocked: blocked.docs.map(item => ({ key: item.get("key") })), moderator: await isModerator(db, request) };
});

const listCommunityReports = onCall(options, async request => {
  requireUser(request);
  const db = getFirestore();
  await requireModerator(db, request);
  const status = request.data?.status === "resolved" ? "resolved" : "pending";
  const reports = await db.collection("communityReports").where("status", "==", status).limit(50).get();
  return { reports: reports.docs.map(item => ({
    reference: item.id, type: item.get("type"), id: item.get("id"), reason: item.get("reason"),
    comments: item.get("comments"), contentText: item.get("contentText"), decision: item.get("decision") || null, createdAt: item.get("createdAt")?.toMillis?.() || 0,
  })).sort((a, b) => a.createdAt - b.createdAt) };
});

const resolveCommunityReport = onCall(options, async request => {
  requireUser(request);
  const db = getFirestore();
  await requireModerator(db, request);
  if (!/^[a-f0-9]{64}$/.test(request.data?.reference || "") || !["dismiss", "hide", "restore"].includes(request.data?.decision)) {
    throw new HttpsError("invalid-argument", "REPORT_DECISION_INVALID");
  }
  const reportRef = db.collection("communityReports").doc(request.data.reference);
  await db.runTransaction(async transaction => {
    const report = await transaction.get(reportRef);
    if (!report.exists) throw new HttpsError("not-found", "REPORT_NOT_FOUND");
    if (report.get("status") !== "pending" && !(request.data.decision === "restore" && report.get("decision") === "hide")) return;
    if (request.data.decision === "restore" && report.get("decision") !== "hide") throw new HttpsError("failed-precondition", "REPORT_DECISION_INVALID");
    const target = validateTarget(report.data());
    const content = db.collection(CONTENT[target.type][0]).doc(target.id);
    const snapshot = await transaction.get(content);
    if (request.data.decision === "hide" && snapshot.exists) {
      transaction.update(content, { moderationStatus: "hidden", moderatedAt: FieldValue.serverTimestamp() });
    }
    if (request.data.decision === "restore" && snapshot.exists) transaction.update(content, { moderationStatus: "visible", moderatedAt: FieldValue.serverTimestamp() });
    transaction.update(reportRef, { status: "resolved", decision: request.data.decision, resolvedAt: FieldValue.serverTimestamp(), resolvedBy: request.auth.uid });
  });
  return { success: true };
});

module.exports = {
  TERMS_VERSION, consumeRateLimit, requireCommunityTerms, requireUser, isModerator,
  acceptCommunityTerms, reportCommunityContent, blockCommunityAuthor, unblockCommunityAuthor,
  getCommunitySafetyState, listCommunityReports, resolveCommunityReport,
  requestAccountDeletion, listAccountDeletionRequests,
  detachAccountPushDevice,
};
