"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { logger } = require("firebase-functions");
const {
  onDocumentCreated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { onCall, blockedAccounts } = require("./accountDeletionAccess");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  getContentOwner, eventRef, incrementRecipientOnce, incrementCommunityOnce, deletePostCascade,
} = require("./communityActivity");
const {
  getRemoteBibleBooks,
  getRemoteBibleChapter,
  searchRemoteBible,
} = require("./bibleProxy");
const {
  canClaimNameReservation,
  createAuthorSnapshot,
  createAnonymousPostDocument,
  createAnonymousReplyDocument,
  createCommunityPostPrivateDocument,
  createCommunityReplyPrivateDocument,
  createIdentifiedPostDocument,
  createIdentifiedReplyDocument,
  isValidCommunityProfile,
  normalizeDisplayName,
  validateAvatarId,
  validateColorId,
  validateDisplayName,
} = require("./communityIdentity");
const {
  createPrayerRequestLogic,
  getPrayerOwnershipLogic,
  deletePrayerRequestLogic,
  markPrayerRequestAnsweredLogic,
  togglePrayerCommitmentLogic,
  getPrayerCommitmentStatusLogic,
} = require("./communityPrayer");
const communitySafety = require("./communitySafety");
for (const name of ["acceptCommunityTerms", "reportCommunityContent", "blockCommunityAuthor", "unblockCommunityAuthor", "getCommunitySafetyState", "listCommunityReports", "resolveCommunityReport", "requestAccountDeletion", "listAccountDeletionRequests", "detachAccountPushDevice"]) {
  exports[name] = communitySafety[name];
}

if (getApps().length === 0) {
  initializeApp();
}

const DAILY_SCHEDULE = "*/5 * * * *";
const TIME_ZONE = "America/Mexico_City";
const MAX_MULTICAST_TOKENS = 500;
const MAX_FIRESTORE_BATCH_WRITES = 500;
const MAX_FIRESTORE_IN_VALUES = 30;
const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

function chunk(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getCurrentReminderTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find(({ type }) => type === "hour")?.value;
  const minute = parts.find(({ type }) => type === "minute")?.value;

  if (!hour || !minute) {
    throw new Error(`No se pudo calcular la hora actual en ${TIME_ZONE}.`);
  }

  return `${hour}:${minute}`;
}

async function getCommunityPostOwner(db, postId) {
  return getContentOwner(db, "communityPosts", "communityPostPrivate", postId);
}

exports.togglePrayerCommitment = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para indicar que estás orando."
      );
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    return togglePrayerCommitmentLogic(
      db,
      FieldValue,
      uid,
      request.data?.requestId
    );
  }
);

exports.getPrayerCommitmentStatus = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para verificar tus compromisos de oración."
      );
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    return getPrayerCommitmentStatusLogic(db, uid, request.data?.requestIds);
  }
);

async function getActiveRecipientsByUid(db, uids) {
  const recipientsByUid = new Map();
  const uniqueUids = [...new Set(uids.filter(Boolean))];

  for (const uidBatch of chunk(uniqueUids, MAX_FIRESTORE_IN_VALUES)) {
    const snapshot = await db
      .collection("pushTokens")
      .where("uid", "in", uidBatch)
      .get();

    for (const document of snapshot.docs) {
      if (document.get("notificationsEnabled") !== true) {
        continue;
      }

      const uid = document.get("uid");
      const documents = recipientsByUid.get(uid) || [];
      documents.push(document);
      recipientsByUid.set(uid, documents);
    }
  }

  return recipientsByUid;
}

async function sendCommunityBadgeUpdates(db, updates, context = {}) {
  if (!updates.length) {
    return {
      usersWithActivity: 0,
      usersWithTokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidTokensDeleted: 0,
    };
  }

  const recipientsByUid = await getActiveRecipientsByUid(
    db,
    updates.map(({ uid }) => uid)
  );
  const updatesByBadgeCount = new Map();

  for (const update of updates) {
    const documents = recipientsByUid.get(update.uid);

    if (!documents?.length) {
      continue;
    }

    const recipients = getRecipients(documents);
    const groupedRecipients = updatesByBadgeCount.get(update.badgeCount) || [];
    groupedRecipients.push(...recipients);
    updatesByBadgeCount.set(update.badgeCount, groupedRecipients);
  }

  const totals = {
    usersWithActivity: updates.length,
    usersWithTokens: [...recipientsByUid.keys()].length,
    successCount: 0,
    failureCount: 0,
    invalidTokensDeleted: 0,
  };

  for (const [badgeCount, recipients] of updatesByBadgeCount.entries()) {
    const result = await sendNotification(db, recipients, {
      type: "community-badge",
      badgeCount: String(badgeCount),
      postId: context.postId || "",
      title: "Su Voz a Diario",
      body: "Hay nueva actividad en Comunidad.",
      url: context.postId
        ? `https://suvoz.app/#community/${encodeURIComponent(context.postId)}`
        : "https://suvoz.app/#community",
      tag: "community-activity",
    });

    totals.successCount += result.successCount;
    totals.failureCount += result.failureCount;
    totals.invalidTokensDeleted += result.invalidTokensDeleted;
  }

  return totals;
}

async function updateCommunityPostActivity(db, postId, candidateTimestamp) {
  if (typeof postId !== "string" || postId.length === 0) {
    return false;
  }

  const activityTimestamp = candidateTimestamp instanceof Timestamp
    ? candidateTimestamp
    : Timestamp.now();
  const postRef = db.collection("communityPosts").doc(postId);

  return db.runTransaction(async (transaction) => {
    const postSnapshot = await transaction.get(postRef);

    if (!postSnapshot.exists) {
      return false;
    }

    const currentTimestamp = postSnapshot.get("lastActivityAt");
    if (
      currentTimestamp instanceof Timestamp &&
      currentTimestamp.toMillis() >= activityTimestamp.toMillis()
    ) {
      return false;
    }

    transaction.update(postRef, {
      lastActivityAt: activityTimestamp,
    });
    return true;
  });
}

function hasNewCommunityReaction(before, after) {
  const beforeReactions = before?.reactions || {};
  const afterReactions = after?.reactions || {};

  return ["useful", "thanks"].some(
    (reaction) =>
      afterReactions[reaction] === true &&
      beforeReactions[reaction] !== true
  );
}

function sanitizeCommunityText(value, maxLength) {
  const text = String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .trim();

  if (!text) {
    throw new HttpsError("invalid-argument", "TEXT_REQUIRED");
  }

  const plainText = text.replace(/<[^>]+>/g, "").trim();
  if (!plainText) {
    throw new HttpsError("invalid-argument", "TEXT_REQUIRED");
  }

  if (plainText.length > maxLength) {
    throw new HttpsError("invalid-argument", "TEXT_TOO_LONG");
  }

  return text;
}

function sanitizeCommunityReference(value) {
  const reference = String(value || "Lectura del día")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return reference || "Lectura del día";
}

function sanitizeCommunityDate(value) {
  const date = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError("invalid-argument", "DATE_INVALID");
  }

  return date;
}

async function getRequiredCommunityAuthorSnapshot(db, uid) {
  const profileSnapshot = await db.collection("communityProfiles").doc(uid).get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
  const authorSnapshot = createAuthorSnapshot(profile);

  if (!authorSnapshot || !isValidCommunityProfile(profile)) {
    throw new HttpsError("failed-precondition", "COMMUNITY_PROFILE_REQUIRED");
  }

  return authorSnapshot;
}

function getNameReservationState(nameSnapshot) {
  if (!nameSnapshot.exists) {
    return null;
  }

  const releaseAt = nameSnapshot.get("releaseAt");

  return {
    uid: nameSnapshot.get("uid") || null,
    status: nameSnapshot.get("status") || "active",
    releaseAtMillis: releaseAt instanceof Timestamp ? releaseAt.toMillis() : null,
  };
}

function sanitizeCommunityDocumentId(value, fieldName = "ID_INVALID") {
  const id = String(value || "").trim();

  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new HttpsError("invalid-argument", fieldName);
  }

  return id;
}

function getLimitedUniqueIds(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(
    values
      .map((value) => String(value || "").trim())
      .filter((value) => /^[A-Za-z0-9_-]{1,128}$/.test(value))
  )].slice(0, 50);
}

function isAnonymousSchema3(documentData) {
  return documentData?.isAnonymous === true && documentData?.schemaVersion === 3;
}

function isOwnerOfPublicDocument(documentData, uid) {
  return Boolean(documentData?.ownerUid && documentData.ownerUid === uid);
}

async function resolvePostOwnership(db, postId, uid) {
  const postSnapshot = await db.collection("communityPosts").doc(postId).get();

  if (!postSnapshot.exists) {
    return false;
  }

  const post = postSnapshot.data();
  if (isOwnerOfPublicDocument(post, uid)) {
    return true;
  }

  if (!isAnonymousSchema3(post)) {
    return false;
  }

  const privateSnapshot = await db.collection("communityPostPrivate").doc(postId).get();
  return privateSnapshot.exists && privateSnapshot.get("ownerUid") === uid;
}

async function resolveReplyOwnership(db, replyId, uid) {
  const replySnapshot = await db.collection("communityReplies").doc(replyId).get();

  if (!replySnapshot.exists) {
    return false;
  }

  const reply = replySnapshot.data();
  if (isOwnerOfPublicDocument(reply, uid)) {
    return true;
  }

  if (!isAnonymousSchema3(reply)) {
    return false;
  }

  const privateSnapshot = await db.collection("communityReplyPrivate").doc(replyId).get();
  return privateSnapshot.exists && privateSnapshot.get("ownerUid") === uid;
}

async function deleteInvalidTokens(db, documents) {
  const batches = chunk(documents, MAX_MULTICAST_TOKENS);

  for (const documentsBatch of batches) {
    const writeBatch = db.batch();

    for (const document of documentsBatch) {
      writeBatch.delete(document.ref);
    }

    await writeBatch.commit();
  }
}

function getRecipients(documents) {
  const recipientsByToken = new Map();

  for (const document of documents) {
    const token = document.get("token");

    if (typeof token !== "string" || token.length === 0) {
      continue;
    }

    const recipient = recipientsByToken.get(token);

    if (recipient) {
      recipient.documents.push(document);
    } else {
      recipientsByToken.set(token, {
        token,
        documents: [document],
      });
    }
  }

  return [...recipientsByToken.values()];
}

async function sendNotification(db, recipients, data) {
  let successCount = 0;
  let failureCount = 0;
  const invalidDocuments = [];

  for (const recipientBatch of chunk(recipients, MAX_MULTICAST_TOKENS)) {
    const blocked = await blockedAccounts(db, recipientBatch.flatMap(item => item.documents.map(doc => doc.get("uid"))));
    const activeBatch = recipientBatch.filter(item => item.documents.some(doc => !blocked.has(doc.get("uid"))));
    if (!activeBatch.length) continue;
    const response = await getMessaging().sendEachForMulticast({
      tokens: activeBatch.map(({ token }) => token),
      notification: {
        title: data.title || "Su Voz a Diario",
        body: data.body || "Tienes una nueva notificación.",
      },
      data,
      android: {
        priority: "high",
        notification: {
          channelId: "default",
          sound: "default",
          tag: data.tag || "su-voz-notification",
        },
      },
      webpush: {
        fcmOptions: {
          link: data.url,
        },
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((result, index) => {
      const errorCode = result.error?.code;

      if (!result.success && INVALID_TOKEN_CODES.has(errorCode)) {
        invalidDocuments.push(...activeBatch[index].documents);
      }
    });
  }

  if (invalidDocuments.length > 0) {
    await deleteInvalidTokens(db, invalidDocuments);
  }

  return {
    successCount,
    failureCount,
    invalidTokensDeleted: invalidDocuments.length,
  };
}

exports.sendTestNotification = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para probar las notificaciones."
      );
    }

    const db = getFirestore();
    const snapshot = await db
      .collection("pushTokens")
      .where("uid", "==", request.auth.uid)
      .get();
    const activeDocuments = snapshot.docs.filter(
      (document) => document.get("notificationsEnabled") === true
    );
    const recipients = getRecipients(activeDocuments);

    if (recipients.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "No hay tokens activos para este usuario."
      );
    }

    const result = await sendNotification(db, recipients, {
      title: "Su Voz a Diario",
      body: "Las notificaciones están configuradas correctamente.",
      url: "https://suvoz.app/#home",
      tag: "notification-test",
    });

    logger.info("Notificación de prueba procesada.", {
      uid: request.auth.uid,
      recipients: recipients.length,
      ...result,
    });

    return result;
  }
);

exports.checkCommunityNameAvailability = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para comprobar un nombre."
      );
    }

    const validation = validateDisplayName(request.data?.displayName);
    if (!validation.valid) {
      return {
        available: false,
        code: validation.code,
        displayName: validation.displayName,
        normalizedName: validation.normalizedName,
      };
    }

    const db = getFirestore();
    const nameSnapshot = await db
      .collection("communityNames")
      .doc(validation.normalizedName)
      .get();

    const now = Timestamp.now();
    const claim = canClaimNameReservation(
      getNameReservationState(nameSnapshot),
      request.auth.uid,
      now.toMillis()
    );

    return {
      available: claim.canClaim,
      code: claim.code,
      displayName: validation.displayName,
      normalizedName: validation.normalizedName,
    };
  }
);

exports.reserveCommunityNameAndProfile = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para crear tu distintivo."
      );
    }

    const uid = request.auth.uid;
    const validation = validateDisplayName(request.data?.displayName);
    if (!validation.valid) {
      throw new HttpsError("invalid-argument", validation.code);
    }

    const avatarId = normalizeDisplayName(request.data?.avatarId);
    const colorId = normalizeDisplayName(request.data?.colorId);

    if (!validateAvatarId(avatarId)) {
      throw new HttpsError("invalid-argument", "AVATAR_INVALID");
    }

    if (!validateColorId(colorId)) {
      throw new HttpsError("invalid-argument", "COLOR_INVALID");
    }

    const db = getFirestore();
    const nameRef = db.collection("communityNames").doc(validation.normalizedName);
    const profileRef = db.collection("communityProfiles").doc(uid);

    const result = await db.runTransaction(async (transaction) => {
      const nameSnapshot = await transaction.get(nameRef);
      const profileSnapshot = await transaction.get(profileRef);

      const previousProfile = profileSnapshot.exists ? profileSnapshot.data() : null;
      const previousNormalizedName = previousProfile?.normalizedName || null;
      const nameChanged = Boolean(
        previousNormalizedName &&
        previousNormalizedName !== validation.normalizedName
      );
      const now = Timestamp.now();
      const claim = canClaimNameReservation(
        getNameReservationState(nameSnapshot),
        uid,
        now.toMillis()
      );

      if (!claim.canClaim) {
        throw new HttpsError(
          claim.code === "NAME_RESERVED" ? "failed-precondition" : "already-exists",
          claim.code
        );
      }

      if (
        nameChanged &&
        previousNormalizedName
      ) {
        const previousNameRef = db.collection("communityNames").doc(previousNormalizedName);
        const previousNameSnapshot = await transaction.get(previousNameRef);
        const previousNameUid = previousNameSnapshot.exists ? previousNameSnapshot.get("uid") : null;

        if (previousNameUid === uid) {
          const releaseAt = Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000);
          transaction.set(previousNameRef, {
            uid,
            displayName: previousProfile.displayName || previousNormalizedName,
            status: "cooldown",
            releaseAt,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }

      const serverNow = FieldValue.serverTimestamp();

      transaction.set(nameRef, {
        uid,
        displayName: validation.displayName,
        status: "active",
        releaseAt: FieldValue.delete(),
        reservedAt: nameSnapshot.exists ? nameSnapshot.get("reservedAt") || serverNow : serverNow,
        updatedAt: serverNow,
      }, { merge: true });

      transaction.set(profileRef, {
        displayName: validation.displayName,
        normalizedName: validation.normalizedName,
        avatarId,
        colorId,
        createdAt: previousProfile?.createdAt || serverNow,
        updatedAt: serverNow,
        profileVersion: 1,
      }, { merge: true });

      return {
        uid,
        displayName: validation.displayName,
        normalizedName: validation.normalizedName,
        avatarId,
        colorId,
        profileVersion: 1,
      };
    });

    return {
      success: true,
      profile: result,
    };
  }
);

exports.createCommunityPost = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para publicar en Comunidad."
      );
    }

    const uid = communitySafety.requireUser(request);
    const reference = sanitizeCommunityReference(request.data?.reference);
    const text = sanitizeCommunityText(request.data?.text, 1200);
    const date = sanitizeCommunityDate(request.data?.date);
    const isAnonymous = request.data?.isAnonymous === true;
    const rawIntent = request.data?.intent;
    let intent = undefined;

    if (rawIntent !== undefined && rawIntent !== null) {
      if (typeof rawIntent !== "string" || !["reflection", "dailyQuestionResponse"].includes(rawIntent)) {
        throw new HttpsError(
          "invalid-argument",
          "El parámetro intent no es válido."
        );
      }
      if (rawIntent === "dailyQuestionResponse") {
        intent = "dailyQuestionResponse";
      }
    }

    const db = getFirestore();

    if (isAnonymous) {
      await communitySafety.requireCommunityTerms(db, uid, request.data);
      await communitySafety.consumeRateLimit(db, uid, "post");
      const postRef = db.collection("communityPosts").doc();
      const privateRef = db.collection("communityPostPrivate").doc(postRef.id);
      const batch = db.batch();
      const timestamp = FieldValue.serverTimestamp();

      batch.set(postRef, createAnonymousPostDocument({
        reference,
        text,
        date,
        timestamp,
        intent,
      }));

      batch.set(privateRef, createCommunityPostPrivateDocument({
        ownerUid: uid,
        timestamp,
      }));

      await batch.commit();

      return {
        success: true,
        id: postRef.id,
      };
    }

    const authorSnapshot = await getRequiredCommunityAuthorSnapshot(db, uid);

    await communitySafety.requireCommunityTerms(db, uid, request.data);
    await communitySafety.consumeRateLimit(db, uid, "post");
    const timestamp = FieldValue.serverTimestamp();
    const postRef = await db.collection("communityPosts").add(createIdentifiedPostDocument({
      reference,
      text,
      date,
      ownerUid: uid,
      authorSnapshot,
      timestamp,
      intent,
    }));

    return {
      success: true,
      id: postRef.id,
    };
  }
);

exports.createCommunityReply = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para responder en Comunidad."
      );
    }

    const uid = communitySafety.requireUser(request);
    const postId = sanitizeCommunityDocumentId(request.data?.postId, "POST_ID_INVALID");
    const text = sanitizeCommunityText(request.data?.text, 300);
    const date = sanitizeCommunityDate(request.data?.date);
    const isAnonymous = request.data?.isAnonymous === true;

    const db = getFirestore();
    const postSnapshot = await db.collection("communityPosts").doc(postId).get();

    if (!postSnapshot.exists) {
      throw new HttpsError("not-found", "POST_NOT_FOUND");
    }

    if (postSnapshot.get("moderationStatus") === "hidden") throw new HttpsError("failed-precondition", "CONTENT_UNAVAILABLE");
    await communitySafety.requireCommunityTerms(db, uid, request.data);
    await communitySafety.consumeRateLimit(db, uid, "reply");

    if (isAnonymous) {
      const replyRef = db.collection("communityReplies").doc();
      const privateRef = db.collection("communityReplyPrivate").doc(replyRef.id);
      const postRef = db.collection("communityPosts").doc(postId);
      const batch = db.batch();
      const timestamp = FieldValue.serverTimestamp();

      batch.set(replyRef, createAnonymousReplyDocument({
        postId,
        text,
        date,
        timestamp,
      }));

      batch.set(privateRef, createCommunityReplyPrivateDocument({
        ownerUid: uid,
        postId,
        timestamp,
      }));

      batch.update(postRef, {
        replyCount: FieldValue.increment(1),
        lastActivityAt: timestamp,
      });

      await batch.commit();

      return {
        success: true,
        id: replyRef.id,
      };
    }

    const authorSnapshot = await getRequiredCommunityAuthorSnapshot(db, uid);

    const timestamp = FieldValue.serverTimestamp();
    const replyRef = db.collection("communityReplies").doc();
    const postRef = db.collection("communityPosts").doc(postId);
    const batch = db.batch();

    batch.set(replyRef, createIdentifiedReplyDocument({
      postId,
      text,
      date,
      ownerUid: uid,
      authorSnapshot,
      timestamp,
    }));

    batch.update(postRef, {
      replyCount: FieldValue.increment(1),
      lastActivityAt: timestamp,
    });

    await batch.commit();

    return {
      success: true,
      id: replyRef.id,
    };
  }
);

exports.getCommunityOwnership = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para comprobar ownership."
      );
    }

    const uid = request.auth.uid;
    const postIds = getLimitedUniqueIds(request.data?.postIds);
    const replyIds = getLimitedUniqueIds(request.data?.replyIds);
    const db = getFirestore();
    const posts = {};
    const replies = {};

    await Promise.all(postIds.map(async (postId) => {
      posts[postId] = await resolvePostOwnership(db, postId, uid);
    }));

    await Promise.all(replyIds.map(async (replyId) => {
      replies[replyId] = await resolveReplyOwnership(db, replyId, uid);
    }));

    return {
      posts,
      replies,
    };
  }
);

exports.deleteCommunityPost = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para eliminar contenido."
      );
    }

    const uid = request.auth.uid;
    const postId = sanitizeCommunityDocumentId(request.data?.postId, "POST_ID_INVALID");
    const db = getFirestore();
    const postRef = db.collection("communityPosts").doc(postId);
    const postSnapshot = await postRef.get();

    if (!postSnapshot.exists) {
      throw new HttpsError("not-found", "POST_NOT_FOUND");
    }

    const post = postSnapshot.data();
    const isOwner = isOwnerOfPublicDocument(post, uid)
      || (
        isAnonymousSchema3(post) &&
        (await db.collection("communityPostPrivate").doc(postId).get()).get("ownerUid") === uid
      );

    if (!isOwner) {
      throw new HttpsError("permission-denied", "NOT_OWNER");
    }

    await deletePostCascade(db, postId);

    return {
      success: true,
    };
  }
);

exports.createPrayerRequest = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para publicar una petición de oración."
      );
    }

    const uid = communitySafety.requireUser(request);
    const db = getFirestore();

    await communitySafety.requireCommunityTerms(db, uid, request.data);
    await communitySafety.consumeRateLimit(db, uid, "prayer");
    return createPrayerRequestLogic(
      db,
      FieldValue,
      uid,
      request.data,
      getRequiredCommunityAuthorSnapshot
    );
  }
);

exports.getPrayerOwnership = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para comprobar ownership de peticiones."
      );
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    return getPrayerOwnershipLogic(db, uid, request.data?.requestIds);
  }
);

exports.deletePrayerRequest = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para eliminar tu petición de oración."
      );
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    return deletePrayerRequestLogic(db, uid, request.data?.requestId);
  }
);

exports.markPrayerRequestAnswered = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para actualizar tu petición de oración."
      );
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    return markPrayerRequestAnsweredLogic(
      db,
      FieldValue,
      uid,
      request.data?.requestId,
      request.data?.answeredText
    );
  }
);

exports.deleteCommunityReply = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para eliminar contenido."
      );
    }

    const uid = request.auth.uid;
    const replyId = sanitizeCommunityDocumentId(request.data?.replyId, "REPLY_ID_INVALID");
    const db = getFirestore();
    const replyRef = db.collection("communityReplies").doc(replyId);
    const privateRef = db.collection("communityReplyPrivate").doc(replyId);

    await db.runTransaction(async (transaction) => {
      const replySnapshot = await transaction.get(replyRef);

      if (!replySnapshot.exists) {
        throw new HttpsError("not-found", "REPLY_NOT_FOUND");
      }

      const reply = replySnapshot.data();
      const privateSnapshot = isAnonymousSchema3(reply)
        ? await transaction.get(privateRef)
        : null;

      const postRef = reply?.postId ? db.collection("communityPosts").doc(reply.postId) : null;
      const postSnapshot = postRef ? await transaction.get(postRef) : null;

      const isOwner = isOwnerOfPublicDocument(reply, uid) ||
        (isAnonymousSchema3(reply) && privateSnapshot?.exists && privateSnapshot.get("ownerUid") === uid);

      if (!isOwner) {
        throw new HttpsError("permission-denied", "NOT_OWNER");
      }

      transaction.delete(replyRef);
      if (privateSnapshot?.exists) {
        transaction.delete(privateRef);
      }

      if (postSnapshot?.exists) {
        const currentCount = Number(postSnapshot.get("replyCount")) || 0;
        const nextCount = Math.max(0, currentCount - 1);
        transaction.update(postRef, {
          replyCount: nextCount,
        });
      }
    });

    return {
      success: true,
    };
  }
);

exports.sendDailyNotification = onSchedule(
  {
    schedule: DAILY_SCHEDULE,
    timeZone: TIME_ZONE,
    region: "us-central1",
    retryCount: 0,
  },
  async () => {
    const db = getFirestore();
    const currentReminderTime = getCurrentReminderTime();
    const snapshot = await db
      .collection("pushTokens")
      .where("notificationsEnabled", "==", true)
      .where("reminderTime", "==", currentReminderTime)
      .get();

    const recipients = getRecipients(snapshot.docs);

    if (recipients.length === 0) {
      logger.info("No hay tokens para el recordatorio diario.", {
        currentReminderTime,
        tokensFound: 0,
        successCount: 0,
        failureCount: 0,
      });
      return;
    }

    const result = await sendNotification(db, recipients, {
      title: "Su Voz a Diario",
      body: "Es momento de escuchar Su voz hoy.",
      url: "https://suvoz.app/#home",
      tag: "daily-reminder",
    });

    logger.info("Recordatorio diario procesado.", {
      currentReminderTime,
      tokensFound: recipients.length,
      ...result,
    });
  }
);

exports.countNewCommunityPost = onDocumentCreated(
  {
    document: "communityPosts/{postId}",
    region: "us-central1",
    retry: true,
    maxInstances: 10,
  },
  async (event) => {
    const post = event.data?.data();
    const db = getFirestore();
    await updateCommunityPostActivity(
      db,
      event.params.postId,
      post?.createdAt || event.data?.createTime
    );
    const actorUid = await getCommunityPostOwner(db, event.params.postId);
    if (!actorUid) return;
    const updatedUsers = await incrementCommunityOnce(db, event.id, actorUid, event.params.postId);

    logger.info("Actividad de publicación contabilizada.", {
      postId: event.params.postId,
      updatedUsers,
    });
  }
);

exports.countNewCommunityReply = onDocumentCreated(
  {
    document: "communityReplies/{replyId}",
    region: "us-central1",
    retry: true,
    maxInstances: 10,
  },
  async (event) => {
    const reply = event.data?.data();
    const db = getFirestore();
    await updateCommunityPostActivity(
      db,
      reply?.postId,
      reply?.createdAt || event.data?.createTime
    );
    const postOwnerUid = await getCommunityPostOwner(db, reply?.postId);
    const actorUid = await getContentOwner(db, "communityReplies", "communityReplyPrivate", event.params.replyId);
    const update = actorUid && postOwnerUid !== actorUid
      ? await incrementRecipientOnce(db, "reply", event.id, postOwnerUid, reply?.postId)
      : null;

    logger.info("Actividad de respuesta contabilizada.", {
      replyId: event.params.replyId,
      postId: reply?.postId || null,
      badgeCount: update?.badgeCount || 0,
    });
  }
);

exports.countNewCommunityReaction = onDocumentWritten(
  {
    document: "communityReactions/{reactionId}",
    region: "us-central1",
    retry: true,
    maxInstances: 10,
  },
  async (event) => {
    const before = event.data?.before?.exists
      ? event.data.before.data()
      : null;
    const after = event.data?.after?.exists
      ? event.data.after.data()
      : null;

    if (!after || !hasNewCommunityReaction(before, after)) {
      return;
    }

    const reaction = after;
    const db = getFirestore();
    const postOwnerUid = await getCommunityPostOwner(db, reaction?.postId);
    const update = postOwnerUid !== reaction?.userId
      ? await incrementRecipientOnce(db, "reaction", event.id, postOwnerUid, reaction?.postId)
      : null;

    logger.info("Actividad de reacción contabilizada.", {
      reactionId: event.params.reactionId,
      postId: reaction?.postId || null,
      badgeCount: update?.badgeCount || 0,
    });
  }
);

exports.deliverCommunityBadgeUpdates = onDocumentCreated(
  { document: "communityActivityDeliveries/{deliveryId}", region: "us-central1", retry: true, maxInstances: 10 },
  async event => {
    const db = getFirestore();
    const ref = db.collection("communityActivityDeliveries").doc(event.params.deliveryId);
    const delivery = await ref.get();
    if (!delivery.exists || delivery.get("delivered") === true) return;
    const updates = delivery.get("updates") || [];
    const snapshots = updates.length ? await db.getAll(...updates.map(item => db.collection("userActivity").doc(item.uid))) : [];
    const current = snapshots.filter(item => item.exists && item.get("unreadCommunityCount") > 0)
      .map(item => ({ uid: item.id, badgeCount: item.get("unreadCommunityCount") }));
    const result = await sendCommunityBadgeUpdates(db, current, { postId: delivery.get("postId") });
    if (result.failureCount > result.invalidTokensDeleted) throw new Error("Community badge delivery failed; retry pending");
    await ref.update({ delivered: true, deliveredAt: FieldValue.serverTimestamp() });
  }
);

async function updateCommunityMetrics(event) {
  const db = getFirestore();
  const post = event.data?.data();
  const userId = await getCommunityPostOwner(db, event.params.postId);
  if (!userId) return;
  const created = post?.createdAt || event.data?.createTime;
  const date = created?.toDate?.() || new Date(event.time);
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const day = format.format(date);
  const previousDay = format.format(new Date(date.getTime() - 86400000));
  const metricRef = db.collection("userMetrics").doc(userId);
  const ledger = eventRef(db, "metrics", `${event.params.postId}:${created?.toMillis?.() || event.time}`);
  await db.runTransaction(async transaction => {
    const [seen, snapshot] = await transaction.getAll(ledger, metricRef);
    if ((await blockedAccounts(db, [userId], transaction)).has(userId)) return;
    if (seen.exists) return;
    const metrics = snapshot.data() || {};
    const legacyDate = metrics.lastActiveDate?.toDate?.();
    const lastDay = metrics.communityStreakDate
      || (legacyDate && Number.isFinite(legacyDate.getTime()) ? format.format(legacyDate) : null);
    const newStreak = !lastDay || day > lastDay
      ? (lastDay === previousDay ? (metrics.currentStreak || 0) + 1 : 1)
      : (metrics.currentStreak || 1);
    const first = !Array.isArray(metrics.achievements) || !metrics.achievements.includes("firstEcho");
    transaction.set(metricRef, {
      userId, postsCreated: FieldValue.increment(1),
      currentStreak: newStreak, longestStreak: Math.max(newStreak, metrics.longestStreak || 0),
      communityStreakDate: lastDay && lastDay > day ? lastDay : day,
      lastActiveDate: FieldValue.serverTimestamp(),
      ...(first ? { achievements: FieldValue.arrayUnion("firstEcho") } : {}),
    }, { merge: true });
    transaction.create(ledger, { completed: true, createdAt: FieldValue.serverTimestamp() });
    if (first) transaction.create(db.collection("notifications").doc(`${ledger.id}-achievement`), {
      userId, type: "achievement", title: "Logro desbloqueado", body: 'Has ganado el logro "Primer Eco"',
      isRead: false, createdAt: FieldValue.serverTimestamp(),
    });
  });
}

exports.updateMetricsOnPost = onDocumentCreated(
  { document: "communityPosts/{postId}", region: "us-central1", retry: true, maxInstances: 10 }, updateCommunityMetrics
);
// Preserve the deployed trigger name; both paths share a post-specific ledger.
exports.updateStreakOnPost = onDocumentCreated(
  { document: "communityPosts/{postId}", region: "us-central1", retry: true, maxInstances: 10 }, updateCommunityMetrics
);

exports.notifyPostOwnerInApp = onDocumentCreated(
  {
    document: "communityReplies/{replyId}",
    region: "us-central1",
    retry: true,
    maxInstances: 10,
  },
  async (event) => {
    const reply = event.data?.data();
    if (!reply?.postId) return;

    const db = getFirestore();
    const postOwnerUid = await getCommunityPostOwner(db, reply.postId);

    const actorUid = await getContentOwner(db, "communityReplies", "communityReplyPrivate", event.params.replyId);
    if (actorUid && postOwnerUid && postOwnerUid !== actorUid) {
      const replyAuthor = reply.authorSnapshot?.displayName || reply.name || "Alguien de la comunidad";
      const notification = db.collection("notifications").doc(eventRef(db, "reply-notification", event.params.replyId).id);
      await db.runTransaction(async transaction => {
        const previous = await transaction.get(notification);
        if ((await blockedAccounts(db, [actorUid, postOwnerUid], transaction)).size || previous.exists) return;
        transaction.create(notification, {
        userId: postOwnerUid,
        type: "newReply",
        title: "Nueva respuesta",
        body: `${replyAuthor} respondió a tu reflexión.`,
        postId: reply.postId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        });
      });
    }
  }
);

exports.cleanupOldData = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: TIME_ZONE,
    region: "us-central1",
  },
  async () => {
    const db = getFirestore();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    let removed = 0;
    const pending = await db.collection("communityDeletionJobs").limit(100).get();
    for (const job of pending.docs) await deletePostCascade(db, job.id);
    for (;;) {
      const oldPosts = await db.collection("communityPosts").where("createdAt", "<", cutoffDate).limit(100).get();
      if (oldPosts.empty) break;
      for (const post of oldPosts.docs) {
        await deletePostCascade(db, post.id);
        removed++;
      }
    }
    logger.info("Limpieza de publicaciones y datos asociados completada.", { removed });
  }
);

exports.getRemoteBibleBooks = getRemoteBibleBooks;
exports.getRemoteBibleChapter = getRemoteBibleChapter;
exports.searchRemoteBible = searchRemoteBible;
