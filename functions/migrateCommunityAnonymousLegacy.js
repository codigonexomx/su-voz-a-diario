"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const dryRun = !process.argv.includes("--write");

function isLegacyAnonymousPost(data) {
  return Boolean(
    data &&
    data.name === "Anónimo" &&
    typeof data.ownerUid === "string" &&
    data.ownerUid.length > 0 &&
    data.isAnonymous === true &&
    data.schemaVersion !== 3 &&
    typeof data.text === "string" &&
    typeof data.reference === "string" &&
    typeof data.date === "string"
  );
}

function isLegacyAnonymousReply(data) {
  return Boolean(
    data &&
    data.name === "Anónimo" &&
    typeof data.ownerUid === "string" &&
    data.ownerUid.length > 0 &&
    data.isAnonymous === true &&
    data.schemaVersion !== 3 &&
    typeof data.postId === "string" &&
    typeof data.text === "string" &&
    typeof data.date === "string"
  );
}

function isAlreadyMigrated(data, privateExists) {
  return Boolean(data?.isAnonymous === true && data?.schemaVersion === 3 && privateExists);
}

function publicPostUpdate() {
  return {
    ownerUid: FieldValue.delete(),
    authorSnapshot: FieldValue.delete(),
    avatarSeed: FieldValue.delete(),
    avatarId: FieldValue.delete(),
    colorId: FieldValue.delete(),
    normalizedName: FieldValue.delete(),
    profileId: FieldValue.delete(),
    name: "Anónimo",
    isAnonymous: true,
    schemaVersion: 3,
  };
}

function publicReplyUpdate() {
  return {
    ownerUid: FieldValue.delete(),
    authorSnapshot: FieldValue.delete(),
    avatarSeed: FieldValue.delete(),
    avatarId: FieldValue.delete(),
    colorId: FieldValue.delete(),
    normalizedName: FieldValue.delete(),
    profileId: FieldValue.delete(),
    name: "Anónimo",
    isAnonymous: true,
    schemaVersion: 3,
  };
}

function privatePostDocument(data) {
  return {
    ownerUid: data.ownerUid,
    createdAt: data.createdAt || FieldValue.serverTimestamp(),
    migratedAt: FieldValue.serverTimestamp(),
    migratedFromLegacy: true,
    schemaVersion: 3,
  };
}

function privateReplyDocument(data) {
  return {
    ownerUid: data.ownerUid,
    postId: data.postId,
    createdAt: data.createdAt || FieldValue.serverTimestamp(),
    migratedAt: FieldValue.serverTimestamp(),
    migratedFromLegacy: true,
    schemaVersion: 3,
  };
}

async function classifyPosts() {
  const result = {
    found: 0,
    migrable: [],
    ambiguous: [],
    alreadyMigrated: [],
  };
  const snapshot = await db.collection("communityPosts")
    .where("name", "==", "Anónimo")
    .get();

  for (const document of snapshot.docs) {
    result.found += 1;
    const data = document.data();
    const privateSnapshot = await db.collection("communityPostPrivate").doc(document.id).get();

    if (isAlreadyMigrated(data, privateSnapshot.exists)) {
      result.alreadyMigrated.push(document.id);
    } else if (isLegacyAnonymousPost(data)) {
      result.migrable.push(document.id);
    } else {
      result.ambiguous.push(document.id);
    }
  }

  return result;
}

async function classifyReplies() {
  const result = {
    found: 0,
    migrable: [],
    ambiguous: [],
    alreadyMigrated: [],
  };
  const snapshot = await db.collection("communityReplies")
    .where("name", "==", "Anónimo")
    .get();

  for (const document of snapshot.docs) {
    result.found += 1;
    const data = document.data();
    const privateSnapshot = await db.collection("communityReplyPrivate").doc(document.id).get();

    if (isAlreadyMigrated(data, privateSnapshot.exists)) {
      result.alreadyMigrated.push(document.id);
    } else if (isLegacyAnonymousReply(data)) {
      result.migrable.push(document.id);
    } else {
      result.ambiguous.push(document.id);
    }
  }

  return result;
}

async function migratePosts(ids) {
  for (const id of ids) {
    const publicRef = db.collection("communityPosts").doc(id);
    const privateRef = db.collection("communityPostPrivate").doc(id);

    await db.runTransaction(async (transaction) => {
      const publicSnapshot = await transaction.get(publicRef);
      const privateSnapshot = await transaction.get(privateRef);

      if (!publicSnapshot.exists || privateSnapshot.exists) {
        return;
      }

      const data = publicSnapshot.data();
      if (!isLegacyAnonymousPost(data)) {
        return;
      }

      transaction.update(publicRef, publicPostUpdate());
      transaction.set(privateRef, privatePostDocument(data));
    });
  }
}

async function migrateReplies(ids) {
  for (const id of ids) {
    const publicRef = db.collection("communityReplies").doc(id);
    const privateRef = db.collection("communityReplyPrivate").doc(id);

    await db.runTransaction(async (transaction) => {
      const publicSnapshot = await transaction.get(publicRef);
      const privateSnapshot = await transaction.get(privateRef);

      if (!publicSnapshot.exists || privateSnapshot.exists) {
        return;
      }

      const data = publicSnapshot.data();
      if (!isLegacyAnonymousReply(data)) {
        return;
      }

      transaction.update(publicRef, publicReplyUpdate());
      transaction.set(privateRef, privateReplyDocument(data));
    });
  }
}

async function main() {
  const posts = await classifyPosts();
  const replies = await classifyReplies();

  const summary = {
    mode: dryRun ? "dry-run" : "write",
    postsFound: posts.found,
    postsMigrable: posts.migrable.length,
    postsAmbiguous: posts.ambiguous.length,
    postsAlreadyMigrated: posts.alreadyMigrated.length,
    repliesFound: replies.found,
    repliesMigrable: replies.migrable.length,
    repliesAmbiguous: replies.ambiguous.length,
    repliesAlreadyMigrated: replies.alreadyMigrated.length,
    postIds: posts,
    replyIds: replies,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    return;
  }

  if (posts.ambiguous.length || replies.ambiguous.length) {
    throw new Error("Hay documentos ambiguos. Revisa el dry-run antes de escribir.");
  }

  await migratePosts(posts.migrable);
  await migrateReplies(replies.migrable);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
