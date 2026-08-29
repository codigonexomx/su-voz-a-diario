"use strict";

const INVISIBLE_OR_CONTROL_PATTERN = /[\p{C}\u200B-\u200F\u202A-\u202E\u2060-\u206F]/gu;
const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;
const ALLOWED_NAME_PATTERN = /^[\p{L}\p{N} -]+$/u;
const EMOJI_PATTERN = /[\p{Extended_Pictographic}]/u;

const RESERVED_NAMES = new Set([
  "admin",
  "administrator",
  "administrador",
  "administradora",
  "moderador",
  "moderadora",
  "moderator",
  "soporte",
  "support",
  "sistema",
  "system",
  "anonimo",
  "anonymous",
  "su voz",
  "su voz a diario",
  "suvoz",
  "suvoz a diario",
  "su voz diario",
  "suvoz diario",
]);

const AVATAR_IDS = new Set([
  "dove",
  "cross",
  "bible",
  "lamb",
  "olive-branch",
  "flame",
  "water-drop",
  "sunrise",
  "star",
  "candle",
  "wheat",
  "grapes",
  "fish",
  "lion",
  "anchor",
  "mountain",
  "sea",
  "rainbow",
  "crown",
  "key",
  "man",
  "woman",
  "manBeard",
  "grandpa",
  "grandma",
  "boy",
  "girl",
  "person",
  "child",
  "angel",
  "man_light",
  "woman_light",
  "man_beard_light",
  "woman_long_light",
  "grandpa_light",
  "grandma_light",
  "boy_light",
  "girl_light",
  "man_dark",
  "woman_dark",
  "man_elder",
  "woman_elder",
  "music-note",
  "lyre",
  "trumpet",
  "shofar",
  "drum",
  "praying-hands",
  "prayer-beads",
  "chapel",
  "church",
  "synagogue",
  "worship",
]);

const COLOR_IDS = new Set([
  "blue-01",
  "green-01",
  "purple-01",
  "gold-01",
  "red-01",
  "orange-01",
  "rose-01",
  "teal-01",
  "brown-01",
  "gray-01",
  "navy-01",
  "silver-01",
]);

function foldAccents(value) {
  const nTildeLower = "__SUVOZ_NTILDE_LOWER__";
  const nTildeUpper = "__SUVOZ_NTILDE_UPPER__";

  return String(value || "")
    .replace(/ñ/g, nTildeLower)
    .replace(/Ñ/g, nTildeUpper)
    .normalize("NFD")
    .replace(COMBINING_MARKS_PATTERN, "")
    .replace(new RegExp(nTildeLower, "g"), "ñ")
    .replace(new RegExp(nTildeUpper, "g"), "Ñ");
}

function normalizeDisplayName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(INVISIBLE_OR_CONTROL_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value) {
  return foldAccents(normalizeDisplayName(value))
    .toLocaleLowerCase("es-MX")
    .replace(/\s+/g, " ")
    .trim();
}

function validateDisplayName(value) {
  const displayName = normalizeDisplayName(value);
  const normalizedName = normalizeName(displayName);
  const visibleLength = Array.from(displayName).length;

  if (!displayName) {
    return { valid: false, code: "NAME_REQUIRED", displayName, normalizedName };
  }

  if (visibleLength < 3) {
    return { valid: false, code: "NAME_TOO_SHORT", displayName, normalizedName };
  }

  if (visibleLength > 24) {
    return { valid: false, code: "NAME_TOO_LONG", displayName, normalizedName };
  }

  if (EMOJI_PATTERN.test(displayName) || !ALLOWED_NAME_PATTERN.test(displayName)) {
    return { valid: false, code: "NAME_INVALID_CHARS", displayName, normalizedName };
  }

  if (displayName.startsWith("-") || displayName.endsWith("-") || displayName.includes("--")) {
    return { valid: false, code: "NAME_INVALID_HYPHEN", displayName, normalizedName };
  }

  if (RESERVED_NAMES.has(normalizedName)) {
    return { valid: false, code: "NAME_RESERVED", displayName, normalizedName };
  }

  return { valid: true, code: "OK", displayName, normalizedName };
}

function validateAvatarId(avatarId) {
  return typeof avatarId === "string" && AVATAR_IDS.has(avatarId);
}

function validateColorId(colorId) {
  return typeof colorId === "string" && COLOR_IDS.has(colorId);
}

function isValidCommunityProfile(profile) {
  return Boolean(
    profile &&
    typeof profile.displayName === "string" &&
    typeof profile.normalizedName === "string" &&
    validateAvatarId(profile.avatarId) &&
    validateColorId(profile.colorId)
  );
}

function createAuthorSnapshot(profile) {
  if (!isValidCommunityProfile(profile)) {
    return null;
  }

  return {
    displayName: normalizeDisplayName(profile.displayName),
    avatarId: profile.avatarId,
    colorId: profile.colorId,
  };
}

function createIdentifiedPostDocument({ reference, text, date, ownerUid, authorSnapshot, timestamp }) {
  return {
    reference,
    text,
    date,
    ownerUid,
    authorSnapshot,
    name: authorSnapshot.displayName,
    isAnonymous: false,
    createdAt: timestamp,
    lastActivityAt: timestamp,
    schemaVersion: 2,
  };
}

function createAnonymousPostDocument({ reference, text, date, timestamp }) {
  return {
    reference,
    text,
    date,
    name: "Anónimo",
    isAnonymous: true,
    createdAt: timestamp,
    lastActivityAt: timestamp,
    schemaVersion: 3,
  };
}

function createCommunityPostPrivateDocument({ ownerUid, timestamp }) {
  return {
    ownerUid,
    createdAt: timestamp,
    schemaVersion: 3,
  };
}

function createIdentifiedReplyDocument({ postId, text, date, ownerUid, authorSnapshot, timestamp }) {
  return {
    postId,
    text,
    date,
    ownerUid,
    authorSnapshot,
    name: authorSnapshot.displayName,
    isAnonymous: false,
    avatarSeed: ownerUid,
    createdAt: timestamp,
    schemaVersion: 2,
  };
}

function createAnonymousReplyDocument({ postId, text, date, timestamp }) {
  return {
    postId,
    text,
    date,
    name: "Anónimo",
    isAnonymous: true,
    createdAt: timestamp,
    schemaVersion: 3,
  };
}

function createCommunityReplyPrivateDocument({ ownerUid, postId, timestamp }) {
  return {
    ownerUid,
    postId,
    createdAt: timestamp,
    schemaVersion: 3,
  };
}

function canClaimNameReservation(reservation, requesterUid, nowMillis) {
  if (!reservation?.uid) {
    return { canClaim: true, code: "OK" };
  }

  if (reservation.uid === requesterUid) {
    return { canClaim: true, code: "OK" };
  }

  if (
    reservation.status === "cooldown" &&
    Number.isFinite(reservation.releaseAtMillis) &&
    reservation.releaseAtMillis <= nowMillis
  ) {
    return { canClaim: true, code: "OK" };
  }

  return {
    canClaim: false,
    code: reservation.status === "cooldown" ? "NAME_RESERVED" : "NAME_TAKEN",
  };
}

module.exports = {
  AVATAR_IDS,
  COLOR_IDS,
  RESERVED_NAMES,
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
  normalizeName,
  validateAvatarId,
  validateColorId,
  validateDisplayName,
};
