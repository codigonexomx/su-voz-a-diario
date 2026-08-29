"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { logger } = require("firebase-functions");
const {
  onDocumentCreated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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

async function incrementUserActivity(db, uid) {
  if (typeof uid !== "string" || uid.length === 0) {
    return null;
  }

  const activityRef = db.collection("userActivity").doc(uid);
  return db.runTransaction(async (transaction) => {
    const activitySnapshot = await transaction.get(activityRef);

    if (!activitySnapshot.exists) {
      return null;
    }

    const currentCount = activitySnapshot.get("unreadCommunityCount");
    const badgeCount = Number.isInteger(currentCount) && currentCount >= 0
      ? currentCount + 1
      : 1;

    transaction.update(activityRef, {
      unreadCommunityCount: badgeCount,
    });

    return { uid, badgeCount };
  });
}

async function incrementCommunityForAllUsers(db, actorUid) {
  const snapshot = await db.collection("userActivity").get();
  const recipientDocuments = snapshot.docs.filter(
    (document) => document.id !== actorUid
  );
  const updates = [];

  for (const documentsBatch of chunk(
    recipientDocuments,
    MAX_FIRESTORE_BATCH_WRITES
  )) {
    const writeBatch = db.batch();

    for (const document of documentsBatch) {
      writeBatch.update(document.ref, {
        unreadCommunityCount: FieldValue.increment(1),
      });
    }

    await writeBatch.commit();

    const updatedSnapshots = await db.getAll(
      ...documentsBatch.map((document) => document.ref)
    );

    for (const activitySnapshot of updatedSnapshots) {
      const badgeCount = activitySnapshot.get("unreadCommunityCount");

      if (Number.isInteger(badgeCount) && badgeCount > 0) {
        updates.push({
          uid: activitySnapshot.id,
          badgeCount,
        });
      }
    }
  }

  return updates;
}

async function getCommunityPostOwner(db, postId) {
  if (typeof postId !== "string" || postId.length === 0) {
    return null;
  }

  const postSnapshot = await db.collection("communityPosts").doc(postId).get();
  return postSnapshot.exists ? postSnapshot.get("ownerUid") : null;
}

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

async function deleteDocumentsInBatches(db, refs) {
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.path, ref])).values()];

  for (const refsBatch of chunk(uniqueRefs, MAX_FIRESTORE_BATCH_WRITES)) {
    const writeBatch = db.batch();
    refsBatch.forEach((ref) => writeBatch.delete(ref));
    await writeBatch.commit();
  }
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
    const response = await getMessaging().sendEachForMulticast({
      tokens: recipientBatch.map(({ token }) => token),
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
        invalidDocuments.push(...recipientBatch[index].documents);
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

    const uid = request.auth.uid;
    const reference = sanitizeCommunityReference(request.data?.reference);
    const text = sanitizeCommunityText(request.data?.text, 1200);
    const date = sanitizeCommunityDate(request.data?.date);
    const isAnonymous = request.data?.isAnonymous === true;
    const db = getFirestore();

    if (isAnonymous) {
      const postRef = db.collection("communityPosts").doc();
      const privateRef = db.collection("communityPostPrivate").doc(postRef.id);
      const batch = db.batch();
      const timestamp = FieldValue.serverTimestamp();

      batch.set(postRef, createAnonymousPostDocument({
        reference,
        text,
        date,
        timestamp,
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

    const timestamp = FieldValue.serverTimestamp();
    const postRef = await db.collection("communityPosts").add(createIdentifiedPostDocument({
      reference,
      text,
      date,
      ownerUid: uid,
      authorSnapshot,
      timestamp,
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

    const uid = request.auth.uid;
    const postId = sanitizeCommunityDocumentId(request.data?.postId, "POST_ID_INVALID");
    const text = sanitizeCommunityText(request.data?.text, 300);
    const date = sanitizeCommunityDate(request.data?.date);
    const isAnonymous = request.data?.isAnonymous === true;

    const db = getFirestore();
    const postSnapshot = await db.collection("communityPosts").doc(postId).get();

    if (!postSnapshot.exists) {
      throw new HttpsError("not-found", "POST_NOT_FOUND");
    }

    if (isAnonymous) {
      const replyRef = db.collection("communityReplies").doc();
      const privateRef = db.collection("communityReplyPrivate").doc(replyRef.id);
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

      await batch.commit();
      await updateCommunityPostActivity(db, postId, Timestamp.now());

      return {
        success: true,
        id: replyRef.id,
      };
    }

    const authorSnapshot = await getRequiredCommunityAuthorSnapshot(db, uid);

    const timestamp = FieldValue.serverTimestamp();
    const replyRef = await db.collection("communityReplies").add(createIdentifiedReplyDocument({
      postId,
      text,
      date,
      ownerUid: uid,
      authorSnapshot,
      timestamp,
    }));

    await updateCommunityPostActivity(db, postId, Timestamp.now());

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

    const refsToDelete = [
      postRef,
      db.collection("communityPostPrivate").doc(postId),
    ];

    const [repliesSnapshot, reactionsSnapshot] = await Promise.all([
      db.collection("communityReplies").where("postId", "==", postId).get(),
      db.collection("communityReactions").where("postId", "==", postId).get(),
    ]);

    repliesSnapshot.docs.forEach((document) => {
      refsToDelete.push(document.ref);
      refsToDelete.push(db.collection("communityReplyPrivate").doc(document.id));
    });

    reactionsSnapshot.docs.forEach((document) => {
      refsToDelete.push(document.ref);
    });

    await deleteDocumentsInBatches(db, refsToDelete);

    return {
      success: true,
    };
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
    const replySnapshot = await replyRef.get();

    if (!replySnapshot.exists) {
      throw new HttpsError("not-found", "REPLY_NOT_FOUND");
    }

    const reply = replySnapshot.data();
    const isOwner = isOwnerOfPublicDocument(reply, uid)
      || (
        isAnonymousSchema3(reply) &&
        (await db.collection("communityReplyPrivate").doc(replyId).get()).get("ownerUid") === uid
      );

    if (!isOwner) {
      throw new HttpsError("permission-denied", "NOT_OWNER");
    }

    await deleteDocumentsInBatches(db, [
      replyRef,
      db.collection("communityReplyPrivate").doc(replyId),
    ]);

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
  },
  async (event) => {
    const post = event.data?.data();
    const db = getFirestore();
    await updateCommunityPostActivity(
      db,
      event.params.postId,
      post?.createdAt || event.data?.createTime
    );
    const updates = await incrementCommunityForAllUsers(
      db,
      post?.ownerUid
    );
    const pushResult = await sendCommunityBadgeUpdates(db, updates, {
      postId: event.params.postId,
    });

    logger.info("Actividad de publicación contabilizada.", {
      postId: event.params.postId,
      actorUid: post?.ownerUid || null,
      updatedUsers: updates.length,
      ...pushResult,
    });
  }
);

exports.countNewCommunityReply = onDocumentCreated(
  {
    document: "communityReplies/{replyId}",
    region: "us-central1",
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
    const update = postOwnerUid !== reply?.ownerUid
      ? await incrementUserActivity(db, postOwnerUid)
      : null;
    const pushResult = await sendCommunityBadgeUpdates(
      db,
      update ? [update] : [],
      { postId: reply?.postId }
    );

    logger.info("Actividad de respuesta contabilizada.", {
      replyId: event.params.replyId,
      postId: reply?.postId || null,
      actorUid: reply?.ownerUid || null,
      recipientUid: postOwnerUid,
      badgeCount: update?.badgeCount || 0,
      ...pushResult,
    });
  }
);

exports.countNewCommunityReaction = onDocumentWritten(
  {
    document: "communityReactions/{reactionId}",
    region: "us-central1",
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
      ? await incrementUserActivity(db, postOwnerUid)
      : null;
    const pushResult = await sendCommunityBadgeUpdates(
      db,
      update ? [update] : [],
      { postId: reaction?.postId }
    );

    logger.info("Actividad de reacción contabilizada.", {
      reactionId: event.params.reactionId,
      postId: reaction?.postId || null,
      actorUid: reaction?.userId || null,
      recipientUid: postOwnerUid,
      badgeCount: update?.badgeCount || 0,
      ...pushResult,
    });
  }
);

exports.updateMetricsOnPost = onDocumentCreated(
  {
    document: "communityPosts/{postId}",
    region: "us-central1",
  },
  async (event) => {
    const post = event.data?.data();
    if (!post?.ownerUid) return;

    const db = getFirestore();
    const userId = post.ownerUid;
    const metricRef = db.collection("userMetrics").doc(userId);

    await metricRef.set(
      {
        userId: userId,
        postsCreated: FieldValue.increment(1),
        lastActiveDate: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const metricDoc = await metricRef.get();
    const metrics = metricDoc.data() || {};

    if (
      metrics.postsCreated >= 1 &&
      !metrics.achievements?.includes("firstEcho")
    ) {
      await metricRef.update({
        achievements: FieldValue.arrayUnion("firstEcho"),
      });

      await db.collection("notifications").add({
        userId: userId,
        type: "achievement",
        title: "¡Logro desbloqueado!",
        body: 'Has ganado el logro "Primer Eco"',
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
);

exports.updateStreakOnPost = onDocumentCreated(
  {
    document: "communityPosts/{postId}",
    region: "us-central1",
  },
  async (event) => {
    const post = event.data?.data();
    if (!post?.ownerUid) return;

    const db = getFirestore();
    const userId = post.ownerUid;
    const today = new Date().toISOString().split("T")[0];

    const metricRef = db.collection("userMetrics").doc(userId);
    const metricDoc = await metricRef.get();

    if (metricDoc.exists) {
      const lastActive = metricDoc.data()?.lastActiveDate;
      const lastDate = lastActive
        ? lastActive.toDate().toISOString().split("T")[0]
        : null;

      if (lastDate !== today) {
        const yesterdayDate = new Date(Date.now() - 86400000);
        const yesterday = yesterdayDate.toISOString().split("T")[0];
        const currentStreak = metricDoc.data()?.currentStreak || 0;
        const newStreak = lastDate === yesterday ? currentStreak + 1 : 1;
        const longestStreak = Math.max(
          newStreak,
          metricDoc.data()?.longestStreak || 0
        );

        await metricRef.update({
          currentStreak: newStreak,
          longestStreak: longestStreak,
          lastActiveDate: FieldValue.serverTimestamp(),
        });
      }
    }
  }
);

exports.notifyPostOwnerInApp = onDocumentCreated(
  {
    document: "communityReplies/{replyId}",
    region: "us-central1",
  },
  async (event) => {
    const reply = event.data?.data();
    if (!reply?.postId || !reply?.ownerUid) return;

    const db = getFirestore();
    const postOwnerUid = await getCommunityPostOwner(db, reply.postId);

    if (postOwnerUid && postOwnerUid !== reply.ownerUid) {
      const replyAuthor = reply.authorSnapshot?.displayName || reply.name || "Alguien de la comunidad";
      await db.collection("notifications").add({
        userId: postOwnerUid,
        type: "newReply",
        title: "Nueva respuesta",
        body: `${replyAuthor} respondió a tu reflexión.`,
        postId: reply.postId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
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

    const oldPosts = await db
      .collection("communityPosts")
      .where("createdAt", "<", cutoffDate)
      .get();

    if (oldPosts.empty) {
      logger.info("No hay publicaciones antiguas para limpiar.");
      return;
    }

    const batches = chunk(oldPosts.docs, MAX_FIRESTORE_BATCH_WRITES);
    for (const docBatch of batches) {
      const batch = db.batch();
      docBatch.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    logger.info(`Limpiadas ${oldPosts.size} publicaciones antiguas.`);
  }
);

exports.getRemoteBibleBooks = getRemoteBibleBooks;
exports.getRemoteBibleChapter = getRemoteBibleChapter;
exports.searchRemoteBible = searchRemoteBible;
