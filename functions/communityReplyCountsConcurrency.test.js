"use strict";

const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");
const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore, Timestamp } = require("firebase-admin/firestore");
const {
  createAnonymousPostDocument,
  createAnonymousReplyDocument,
  createCommunityPostPrivateDocument,
  createCommunityReplyPrivateDocument,
  createIdentifiedPostDocument,
  createIdentifiedReplyDocument,
} = require("./communityIdentity");

if (getApps().length === 0) {
  initializeApp({ projectId: "demo-su-voz-concurrency" });
}

const db = getFirestore();

// Helper to simulate createCommunityReply logic atomically
async function createReplyHelper({ postId, uid, text, isAnonymous }) {
  const timestamp = FieldValue.serverTimestamp();
  const postRef = db.collection("communityPosts").doc(postId);

  if (isAnonymous) {
    const replyRef = db.collection("communityReplies").doc();
    const privateRef = db.collection("communityReplyPrivate").doc(replyRef.id);
    const batch = db.batch();

    batch.set(replyRef, createAnonymousReplyDocument({
      postId,
      text,
      date: new Date().toISOString(),
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
    return replyRef.id;
  } else {
    const replyRef = db.collection("communityReplies").doc();
    const batch = db.batch();

    batch.set(replyRef, createIdentifiedReplyDocument({
      postId,
      text,
      date: new Date().toISOString(),
      ownerUid: uid,
      authorSnapshot: {
        displayName: `User-${uid}`,
        avatarId: "dove",
        colorId: "blue-01",
      },
      timestamp,
    }));

    batch.update(postRef, {
      replyCount: FieldValue.increment(1),
      lastActivityAt: timestamp,
    });

    await batch.commit();
    return replyRef.id;
  }
}

// Helper to simulate deleteCommunityReply logic transactionally
async function deleteReplyHelper({ replyId, uid }) {
  const replyRef = db.collection("communityReplies").doc(replyId);
  const privateRef = db.collection("communityReplyPrivate").doc(replyId);

  await db.runTransaction(async (transaction) => {
    const replySnapshot = await transaction.get(replyRef);

    if (!replySnapshot.exists) {
      throw new Error("REPLY_NOT_FOUND");
    }

    const reply = replySnapshot.data();
    const privateSnapshot = reply?.isAnonymous
      ? await transaction.get(privateRef)
      : null;

    const postRef = reply?.postId ? db.collection("communityPosts").doc(reply.postId) : null;
    const postSnapshot = postRef ? await transaction.get(postRef) : null;

    const isOwner = reply?.ownerUid === uid ||
      (reply?.isAnonymous && privateSnapshot?.exists && privateSnapshot.get("ownerUid") === uid);

    if (!isOwner) {
      throw new Error("NOT_OWNER");
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
}

// Verification helper checking invariant on a post
async function verifyPostInvariant(postId) {
  const postSnapshot = await db.collection("communityPosts").doc(postId).get();
  assert.equal(postSnapshot.exists, true, `Post ${postId} should exist`);

  const replyCount = postSnapshot.get("replyCount");
  assert.equal(typeof replyCount, "number", `Post ${postId} replyCount should be a number`);
  assert.ok(replyCount >= 0, `Post ${postId} replyCount should never be negative (got ${replyCount})`);

  const repliesSnapshot = await db
    .collection("communityReplies")
    .where("postId", "==", postId)
    .get();

  assert.equal(
    replyCount,
    repliesSnapshot.size,
    `Post ${postId} replyCount (${replyCount}) must match actual docs count (${repliesSnapshot.size})`
  );
}

async function run() {
  console.log("[Test Suite] Starting replyCount concurrency and invariant tests...");

  // Setup test post 1
  const post1Ref = db.collection("communityPosts").doc("test-post-1");
  await post1Ref.set(createIdentifiedPostDocument({
    reference: "Salmo 23",
    text: "El Señor es mi pastor",
    date: "2026-09-03",
    ownerUid: "author-1",
    authorSnapshot: { displayName: "Autor", avatarId: "dove", colorId: "blue-01" },
    timestamp: FieldValue.serverTimestamp(),
  }));

  // T1: Post starts with replyCount = 0
  await verifyPostInvariant("test-post-1");

  // T2: First reply -> replyCount = 1
  const reply1Id = await createReplyHelper({
    postId: "test-post-1",
    uid: "user-a",
    text: "Amén, hermosa reflexión",
    isAnonymous: false,
  });
  await verifyPostInvariant("test-post-1");

  // T3 / C2: Parallel creation of 3 replies
  const [r2, r3, r4] = await Promise.all([
    createReplyHelper({ postId: "test-post-1", uid: "user-b", text: "Reply 2", isAnonymous: false }),
    createReplyHelper({ postId: "test-post-1", uid: "user-c", text: "Reply 3 (Anon)", isAnonymous: true }),
    createReplyHelper({ postId: "test-post-1", uid: "user-d", text: "Reply 4", isAnonymous: false }),
  ]);
  await verifyPostInvariant("test-post-1");

  // T4: Deleting 1 reply -> decrements count
  await deleteReplyHelper({ replyId: r2, uid: "user-b" });
  await verifyPostInvariant("test-post-1");

  // T5: Concurrent deletion of 2 replies
  await Promise.all([
    deleteReplyHelper({ replyId: r3, uid: "user-c" }),
    deleteReplyHelper({ replyId: r4, uid: "user-d" }),
  ]);
  await verifyPostInvariant("test-post-1");

  // Delete last reply -> replyCount = 0
  await deleteReplyHelper({ replyId: reply1Id, uid: "user-a" });
  await verifyPostInvariant("test-post-1");

  // T8: Duplicate deletion attempt -> should throw error and stay 0
  await assert.rejects(
    async () => {
      await deleteReplyHelper({ replyId: reply1Id, uid: "user-a" });
    },
    /REPLY_NOT_FOUND/
  );
  await verifyPostInvariant("test-post-1");

  // T6 / C4: Concurrent creation and deletion on same post
  const r5Id = await createReplyHelper({ postId: "test-post-1", uid: "user-e", text: "Reply 5", isAnonymous: false });
  await Promise.all([
    createReplyHelper({ postId: "test-post-1", uid: "user-f", text: "Reply 6", isAnonymous: false }),
    deleteReplyHelper({ replyId: r5Id, uid: "user-e" }),
  ]);
  await verifyPostInvariant("test-post-1");

  // T9: Anonymous reply ownership & privacy test
  const anonReplyId = await createReplyHelper({
    postId: "test-post-1",
    uid: "user-secret",
    text: "Respuesta confidencial",
    isAnonymous: true,
  });

  // Verify public reply doc has NO ownerUid
  const anonPublicDoc = await db.collection("communityReplies").doc(anonReplyId).get();
  assert.equal(anonPublicDoc.get("isAnonymous"), true);
  assert.equal(Object.hasOwn(anonPublicDoc.data(), "ownerUid"), false);

  // Verify private reply doc has ownerUid
  const anonPrivateDoc = await db.collection("communityReplyPrivate").doc(anonReplyId).get();
  assert.equal(anonPrivateDoc.exists, true);
  assert.equal(anonPrivateDoc.get("ownerUid"), "user-secret");

  // Attempt unauthorized delete -> should fail
  await assert.rejects(
    async () => {
      await deleteReplyHelper({ replyId: anonReplyId, uid: "hacker-uid" });
    },
    /NOT_OWNER/
  );
  await verifyPostInvariant("test-post-1");

  // Authorized delete -> succeeds and deletes private doc
  await deleteReplyHelper({ replyId: anonReplyId, uid: "user-secret" });
  const anonPrivateDocAfter = await db.collection("communityReplyPrivate").doc(anonReplyId).get();
  assert.equal(anonPrivateDocAfter.exists, false);
  await verifyPostInvariant("test-post-1");

  console.log("[Test Suite] C1-C8 concurrency & anonymity scenarios passed!");

  // T11: Test Backfill Script (>500 historic posts test & idempotency)
  console.log("[Test Suite] Testing backfill script with historic posts...");

  const testPostIds = [];
  const batchSize = 520; // Tests pagination (>500 requirement)

  // Seed 520 historic posts without replyCount field
  for (let i = 0; i < batchSize; i += 100) {
    const batch = db.batch();
    for (let j = i; j < Math.min(batchSize, i + 100); j++) {
      const pId = `historic-post-${j}`;
      testPostIds.push(pId);
      const postRef = db.collection("communityPosts").doc(pId);
      // Omit replyCount field to simulate historic posts
      batch.set(postRef, {
        reference: "Mateo 5",
        text: `Historic post ${j}`,
        date: "2026-01-01",
        createdAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
        schemaVersion: 2,
      });
    }
    await batch.commit();
  }

  // Add 2 replies to historic-post-0, 1 reply to historic-post-1
  await createReplyHelper({ postId: "historic-post-0", uid: "u1", text: "h0 r1", isAnonymous: false });
  await createReplyHelper({ postId: "historic-post-0", uid: "u2", text: "h0 r2", isAnonymous: false });
  await createReplyHelper({ postId: "historic-post-1", uid: "u3", text: "h1 r1", isAnonymous: false });

  // Reset replyCount on historic-post-0 and historic-post-1 to undefined (simulating pre-existing data)
  await db.collection("communityPosts").doc("historic-post-0").update({ replyCount: FieldValue.delete() });
  await db.collection("communityPosts").doc("historic-post-1").update({ replyCount: FieldValue.delete() });

  // Run backfill script in --apply mode via node command
  console.log("[Test Suite] Running backfill script --apply...");
  execSync("node backfillCommunityReplyCounts.js --apply", {
    cwd: __dirname,
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080" },
    stdio: "inherit",
  });

  // Verify backfill accuracy on sample historic posts
  const hp0 = await db.collection("communityPosts").doc("historic-post-0").get();
  assert.equal(hp0.get("replyCount"), 2, "historic-post-0 should have replyCount = 2 after backfill");

  const hp1 = await db.collection("communityPosts").doc("historic-post-1").get();
  assert.equal(hp1.get("replyCount"), 1, "historic-post-1 should have replyCount = 1 after backfill");

  const hp500 = await db.collection("communityPosts").doc("historic-post-500").get();
  assert.equal(hp500.get("replyCount"), 0, "historic-post-500 should have replyCount = 0 after backfill");

  // Re-run backfill to verify idempotency (should modify 0 posts)
  console.log("[Test Suite] Testing backfill script idempotency...");
  const secondRunOutput = execSync("node backfillCommunityReplyCounts.js --apply", {
    cwd: __dirname,
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080" },
    encoding: "utf8",
  });

  assert.ok(
    secondRunOutput.includes('"postsNeedingUpdate": 0') || secondRunOutput.includes('"postsUpdated": 0'),
    "Second backfill run must make 0 updates (idempotent)"
  );

  console.log("[Test Suite] ALL TESTS PASSED SUCCESSFULLY!");
}

run().catch((error) => {
  console.error("[Test Suite Error]", error);
  process.exitCode = 1;
});
