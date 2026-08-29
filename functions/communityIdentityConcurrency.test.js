"use strict";

const assert = require("node:assert/strict");
const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const {
  validateAvatarId,
  validateColorId,
  validateDisplayName,
} = require("./communityIdentity");

if (getApps().length === 0) {
  initializeApp({ projectId: "demo-su-voz-concurrency" });
}

const db = getFirestore();

async function reserveForTest(uid, displayName, avatarId = "dove", colorId = "blue-01") {
  const validation = validateDisplayName(displayName);
  assert.equal(validation.valid, true);
  assert.equal(validateAvatarId(avatarId), true);
  assert.equal(validateColorId(colorId), true);

  const nameRef = db.collection("communityNames").doc(validation.normalizedName);
  const profileRef = db.collection("communityProfiles").doc(uid);

  return db.runTransaction(async (transaction) => {
    const nameSnapshot = await transaction.get(nameRef);
    const reservedUid = nameSnapshot.exists ? nameSnapshot.get("uid") : null;

    if (reservedUid && reservedUid !== uid) {
      throw new Error("NAME_TAKEN");
    }

    const now = FieldValue.serverTimestamp();
    transaction.set(nameRef, {
      uid,
      displayName: validation.displayName,
      status: "active",
      reservedAt: nameSnapshot.exists ? nameSnapshot.get("reservedAt") || now : now,
      updatedAt: now,
    }, { merge: true });

    transaction.set(profileRef, {
      displayName: validation.displayName,
      normalizedName: validation.normalizedName,
      avatarId,
      colorId,
      createdAt: now,
      updatedAt: now,
      profileVersion: 1,
    }, { merge: true });

    return uid;
  });
}

async function run() {
  await Promise.all([
    db.collection("communityNames").doc("david").delete(),
    db.collection("communityProfiles").doc("uid-a").delete(),
    db.collection("communityProfiles").doc("uid-b").delete(),
  ]);

  const results = await Promise.allSettled([
    reserveForTest("uid-a", "David", "dove", "blue-01"),
    reserveForTest("uid-b", "David", "lion", "green-01"),
  ]);

  const successes = results.filter((result) => result.status === "fulfilled");
  const failures = results.filter((result) => result.status === "rejected");

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.match(String(failures[0].reason?.message || failures[0].reason), /NAME_TAKEN|transaction/i);

  const reservation = await db.collection("communityNames").doc("david").get();
  assert.equal(reservation.exists, true);
  assert.equal(["uid-a", "uid-b"].includes(reservation.get("uid")), true);

  console.log("community identity concurrency test passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
