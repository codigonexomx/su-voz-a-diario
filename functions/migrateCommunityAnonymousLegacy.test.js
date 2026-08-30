"use strict";

const assert = require("node:assert/strict");
const {
  isAlreadyMigrated,
  isLegacyAnonymousPost,
  isLegacyAnonymousReply,
  privatePostDocument,
  privateReplyDocument,
  publicPostUpdate,
  publicReplyUpdate,
} = require("./migrateCommunityAnonymousLegacy");

const DELETE_KEYS = new Set([
  "ownerUid",
  "authorUid",
  "uid",
  "authorSnapshot",
  "avatarSeed",
  "avatarId",
  "colorId",
  "normalizedName",
  "profileId",
]);

function applyPublicUpdate(source, update) {
  const result = { ...source };

  for (const key of Object.keys(update)) {
    if (DELETE_KEYS.has(key)) {
      delete result[key];
    } else {
      result[key] = update[key];
    }
  }

  return result;
}

function assertNoPublicIdentityLeaks(document) {
  [
    "ownerUid",
    "authorUid",
    "uid",
    "authorSnapshot",
    "avatarSeed",
    "avatarId",
    "colorId",
    "normalizedName",
    "profileId",
  ].forEach((field) => {
    assert.equal(Object.hasOwn(document, field), false, `${field} leaked`);
  });
}

function run() {
  const createdAt = "2026-06-01T12:37:06.864Z";
  const lastActivityAt = "2026-06-01T13:00:00.000Z";

  const legacyPost = {
    name: "Anónimo",
    ownerUid: "uid-post",
    text: "Reflexión legacy",
    reference: "Juan 3",
    date: "2026-06-01",
    createdAt,
    lastActivityAt,
  };

  assert.equal(isLegacyAnonymousPost(legacyPost), true);
  assert.equal(isLegacyAnonymousPost({ ...legacyPost, isAnonymous: true }), true);
  assert.equal(isLegacyAnonymousPost({ ...legacyPost, isAnonymous: false }), false);
  assert.equal(isLegacyAnonymousPost({ ...legacyPost, name: "Richard" }), false);
  assert.equal(isLegacyAnonymousPost({ ...legacyPost, ownerUid: "" }), false);
  assert.equal(isLegacyAnonymousPost({ ...legacyPost, schemaVersion: 3 }), false);
  assert.equal(isLegacyAnonymousPost({ ...legacyPost, authorSnapshot: { displayName: "Richard" } }), false);

  const migratedPost = applyPublicUpdate(legacyPost, publicPostUpdate());
  assertNoPublicIdentityLeaks(migratedPost);
  assert.equal(migratedPost.name, "Anónimo");
  assert.equal(migratedPost.isAnonymous, true);
  assert.equal(migratedPost.schemaVersion, 3);
  assert.equal(migratedPost.createdAt, createdAt);
  assert.equal(migratedPost.date, "2026-06-01");
  assert.equal(migratedPost.lastActivityAt, lastActivityAt);
  assert.equal(migratedPost.text, "Reflexión legacy");
  assert.equal(migratedPost.reference, "Juan 3");

  const privatePost = privatePostDocument({
    ...legacyPost,
    avatarSeed: "legacy-seed",
    authorSnapshot: { displayName: "Richard" },
  });
  assert.deepEqual(Object.keys(privatePost).sort(), [
    "createdAt",
    "migratedAt",
    "migratedFromLegacy",
    "ownerUid",
    "schemaVersion",
  ]);
  assert.equal(privatePost.ownerUid, "uid-post");
  assert.equal(privatePost.createdAt, createdAt);
  assert.equal(privatePost.migratedFromLegacy, true);
  assert.equal(privatePost.schemaVersion, 3);
  assert.equal(Object.hasOwn(privatePost, "name"), false);
  assert.equal(Object.hasOwn(privatePost, "text"), false);
  assert.equal(Object.hasOwn(privatePost, "avatarSeed"), false);
  assert.equal(Object.hasOwn(privatePost, "authorSnapshot"), false);
  assert.equal(Object.hasOwn(privatePost, "avatarId"), false);
  assert.equal(Object.hasOwn(privatePost, "colorId"), false);

  const legacyReply = {
    name: "Anónimo",
    ownerUid: "uid-reply",
    postId: "post-1",
    text: "Amén",
    date: "2026-04-11",
    createdAt,
  };

  assert.equal(isLegacyAnonymousReply(legacyReply), true);
  assert.equal(isLegacyAnonymousReply({ ...legacyReply, avatarSeed: "legacy-seed" }), true);
  assert.equal(isLegacyAnonymousReply({ ...legacyReply, isAnonymous: false }), false);
  assert.equal(isLegacyAnonymousReply({ ...legacyReply, postId: "" }), false);
  assert.equal(isLegacyAnonymousReply({ ...legacyReply, schemaVersion: 3 }), false);
  assert.equal(isLegacyAnonymousReply({ ...legacyReply, normalizedName: "richard" }), false);

  const migratedReply = applyPublicUpdate({ ...legacyReply, avatarSeed: "legacy-seed" }, publicReplyUpdate());
  assertNoPublicIdentityLeaks(migratedReply);
  assert.equal(migratedReply.name, "Anónimo");
  assert.equal(migratedReply.isAnonymous, true);
  assert.equal(migratedReply.schemaVersion, 3);
  assert.equal(migratedReply.createdAt, createdAt);
  assert.equal(migratedReply.date, "2026-04-11");
  assert.equal(migratedReply.postId, "post-1");

  const privateReply = privateReplyDocument({
    ...legacyReply,
    avatarSeed: "legacy-seed",
    authorSnapshot: { displayName: "Richard" },
  });
  assert.deepEqual(Object.keys(privateReply).sort(), [
    "createdAt",
    "migratedAt",
    "migratedFromLegacy",
    "ownerUid",
    "postId",
    "schemaVersion",
  ]);
  assert.equal(privateReply.ownerUid, "uid-reply");
  assert.equal(privateReply.postId, "post-1");
  assert.equal(privateReply.createdAt, createdAt);
  assert.equal(privateReply.migratedFromLegacy, true);
  assert.equal(privateReply.schemaVersion, 3);
  assert.equal(Object.hasOwn(privateReply, "name"), false);
  assert.equal(Object.hasOwn(privateReply, "text"), false);
  assert.equal(Object.hasOwn(privateReply, "avatarSeed"), false);
  assert.equal(Object.hasOwn(privateReply, "authorSnapshot"), false);
  assert.equal(Object.hasOwn(privateReply, "avatarId"), false);
  assert.equal(Object.hasOwn(privateReply, "colorId"), false);

  assert.equal(isAlreadyMigrated({ isAnonymous: true, schemaVersion: 3 }, true), true);
  assert.equal(isAlreadyMigrated({ isAnonymous: true, schemaVersion: 3 }, false), false);
}

run();
console.log("migrateCommunityAnonymousLegacy tests passed");
