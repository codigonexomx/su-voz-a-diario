"use strict";

const assert = require("node:assert/strict");
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
  normalizeName,
  validateAvatarId,
  validateColorId,
  validateDisplayName,
} = require("./communityIdentity");

function run() {
  assert.equal(normalizeName("Richard"), "richard");
  assert.equal(normalizeName(" RICHARD  "), "richard");
  assert.equal(normalizeName(" Richard"), "richard");
  assert.equal(normalizeName("José"), "jose");
  assert.equal(normalizeName("Jose"), "jose");
  assert.equal(normalizeName("Niño"), "niño");

  assert.equal(validateDisplayName("Richard").valid, true);
  assert.equal(validateDisplayName("Pedro").valid, true);
  assert.equal(validateDisplayName("Jo").code, "NAME_TOO_SHORT");
  assert.equal(validateDisplayName("Administrador").code, "NAME_RESERVED");
  assert.equal(validateDisplayName("David 😊").code, "NAME_INVALID_CHARS");
  assert.equal(validateDisplayName("David--Pedro").code, "NAME_INVALID_HYPHEN");

  assert.equal(validateAvatarId("dove"), true);
  assert.equal(validateAvatarId("lion"), true);
  assert.equal(validateAvatarId("dove") && validateColorId("blue-01"), true);
  assert.equal(validateAvatarId("lion") && validateColorId("green-01"), true);
  assert.equal(validateAvatarId("dove") && validateColorId("blue-01") && validateDisplayName("Pedro").valid, true);
  assert.equal(validateAvatarId("not-real"), false);

  assert.equal(validateColorId("blue-01"), true);
  assert.equal(validateColorId("green-01"), true);
  assert.equal(validateColorId("#4A90D9"), false);

  const profile = {
    displayName: "Richard",
    normalizedName: "richard",
    avatarId: "dove",
    colorId: "blue-01",
  };
  assert.equal(isValidCommunityProfile(profile), true);
  assert.deepEqual(createAuthorSnapshot(profile), {
    displayName: "Richard",
    avatarId: "dove",
    colorId: "blue-01",
  });
  assert.equal(isValidCommunityProfile({ ...profile, avatarId: "🕊️" }), false);

  const authorSnapshot = createAuthorSnapshot(profile);
  const timestamp = "SERVER_TIMESTAMP";
  const identifiedPost = createIdentifiedPostDocument({
    reference: "Juan 3",
    text: "Dios amó",
    date: "2026-08-29",
    ownerUid: "uid-richard",
    authorSnapshot,
    timestamp,
  });
  assert.equal(identifiedPost.ownerUid, "uid-richard");
  assert.deepEqual(identifiedPost.authorSnapshot, authorSnapshot);
  assert.equal(identifiedPost.isAnonymous, false);
  assert.equal(identifiedPost.schemaVersion, 2);

  const anonymousPost = createAnonymousPostDocument({
    reference: "Juan 3",
    text: "Dios amó",
    date: "2026-08-29",
    timestamp,
  });
  assert.equal(anonymousPost.name, "Anónimo");
  assert.equal(anonymousPost.isAnonymous, true);
  assert.equal(anonymousPost.schemaVersion, 3);
  assert.equal(Object.hasOwn(anonymousPost, "ownerUid"), false);
  assert.equal(Object.hasOwn(anonymousPost, "authorSnapshot"), false);
  assert.equal(Object.hasOwn(anonymousPost, "avatarSeed"), false);
  assert.equal(JSON.stringify(anonymousPost).includes("Richard"), false);
  assert.equal(JSON.stringify(anonymousPost).includes("dove"), false);
  assert.equal(JSON.stringify(anonymousPost).includes("blue-01"), false);

  const privatePost = createCommunityPostPrivateDocument({
    ownerUid: "uid-richard",
    timestamp,
  });
  assert.deepEqual(privatePost, {
    ownerUid: "uid-richard",
    createdAt: timestamp,
    schemaVersion: 3,
  });

  const identifiedReply = createIdentifiedReplyDocument({
    postId: "post-1",
    text: "Amén",
    date: "2026-08-29",
    ownerUid: "uid-richard",
    authorSnapshot,
    timestamp,
  });
  assert.equal(identifiedReply.ownerUid, "uid-richard");
  assert.deepEqual(identifiedReply.authorSnapshot, authorSnapshot);
  assert.equal(identifiedReply.avatarSeed, "uid-richard");
  assert.equal(identifiedReply.schemaVersion, 2);

  const anonymousReply = createAnonymousReplyDocument({
    postId: "post-1",
    text: "Amén",
    date: "2026-08-29",
    timestamp,
  });
  assert.equal(anonymousReply.name, "Anónimo");
  assert.equal(anonymousReply.isAnonymous, true);
  assert.equal(anonymousReply.schemaVersion, 3);
  assert.equal(Object.hasOwn(anonymousReply, "ownerUid"), false);
  assert.equal(Object.hasOwn(anonymousReply, "authorSnapshot"), false);
  assert.equal(Object.hasOwn(anonymousReply, "avatarSeed"), false);

  const privateReply = createCommunityReplyPrivateDocument({
    ownerUid: "uid-richard",
    postId: "post-1",
    timestamp,
  });
  assert.deepEqual(privateReply, {
    ownerUid: "uid-richard",
    postId: "post-1",
    createdAt: timestamp,
    schemaVersion: 3,
  });

  const now = Date.parse("2026-08-29T00:00:00.000Z");
  const cooldownMs = 30 * 24 * 60 * 60 * 1000;
  assert.deepEqual(canClaimNameReservation(null, "uid-a", now), {
    canClaim: true,
    code: "OK",
  });
  assert.deepEqual(canClaimNameReservation({ uid: "uid-a", status: "active" }, "uid-a", now), {
    canClaim: true,
    code: "OK",
  });
  assert.deepEqual(canClaimNameReservation({
    uid: "uid-b",
    status: "active",
  }, "uid-a", now), {
    canClaim: false,
    code: "NAME_TAKEN",
  });
  assert.deepEqual(canClaimNameReservation({
    uid: "uid-a",
    status: "cooldown",
    releaseAtMillis: now + cooldownMs,
  }, "uid-a", now), {
    canClaim: true,
    code: "OK",
  });
  assert.deepEqual(canClaimNameReservation({
    uid: "uid-b",
    status: "cooldown",
    releaseAtMillis: now + cooldownMs,
  }, "uid-a", now), {
    canClaim: false,
    code: "NAME_RESERVED",
  });
  assert.deepEqual(canClaimNameReservation({
    uid: "uid-b",
    status: "cooldown",
    releaseAtMillis: now - 1,
  }, "uid-a", now), {
    canClaim: true,
    code: "OK",
  });
}

run();
console.log("communityIdentity tests passed");
