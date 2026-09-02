"use strict";

const assert = require("node:assert/strict");
const { describe, it, before, after } = require("node:test");
const { initializeApp, getApps, deleteApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const {
  createPrayerRequestLogic,
  togglePrayerCommitmentLogic,
  getPrayerCommitmentStatusLogic,
  deletePrayerRequestLogic,
  markPrayerRequestAnsweredLogic,
} = require("./communityPrayer");

const host = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIRESTORE_EMULATOR_HOST = host;

describe("communityPrayer Real Concurrency & Cleanup Tests (Firestore Emulator)", () => {
  let app;
  let db;

  before(() => {
    if (getApps().length === 0) {
      app = initializeApp({ projectId: "demo-su-voz-concurrency" });
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
  });

  after(async () => {
    if (app) {
      await deleteApp(app);
    }
  });

  async function createTestPrayerRequest(requestId, status = "active", ownerUid = "user_owner") {
    const requestRef = db.collection("communityPrayerRequests").doc(requestId);
    const privateRef = db.collection("communityPrayerPrivate").doc(requestId);

    const batch = db.batch();
    batch.set(requestRef, {
      text: `Petición de prueba ${requestId}`,
      name: "Anónimo",
      isAnonymous: true,
      status,
      prayingCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    });
    batch.set(privateRef, {
      ownerUid,
      createdAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    });
    await batch.commit();
  }

  async function countCommitmentsInDb(requestId) {
    const snap = await db
      .collection("communityPrayerCommitments")
      .where("requestId", "==", requestId)
      .get();
    return snap.docs.length;
  }

  async function getPrayingCountInDb(requestId) {
    const snap = await db.collection("communityPrayerRequests").doc(requestId).get();
    return snap.exists ? (snap.get("prayingCount") || 0) : null;
  }

  // C1: Concurrencia Mismo Usuario (Doble Toggle)
  it("C1: Doble toggle concurrente del mismo usuario produce alternancia consistente e invariante mantenida", async () => {
    const reqId = "req_c1";
    await createTestPrayerRequest(reqId);

    // Launch 2 concurrent toggles for same user
    await Promise.all([
      togglePrayerCommitmentLogic(db, FieldValue, "user_same", reqId),
      togglePrayerCommitmentLogic(db, FieldValue, "user_same", reqId),
    ]);

    const finalCount = await getPrayingCountInDb(reqId);
    const commitmentsCount = await countCommitmentsInDb(reqId);

    // After 2 toggles from OFF: OFF -> ON -> OFF, so count = 0, commitments = 0
    assert.equal(finalCount, 0);
    assert.equal(commitmentsCount, 0);
    assert.equal(finalCount, commitmentsCount, "INVARIANTE: prayingCount debe ser igual al número de compromisos");
  });

  // C2: Concurrencia Dos Usuarios Distintos (Simultáneos ON)
  it("C2: Dos usuarios distintos activando compromiso simultáneamente incrementan a 2", async () => {
    const reqId = "req_c2";
    await createTestPrayerRequest(reqId);

    const results = await Promise.all([
      togglePrayerCommitmentLogic(db, FieldValue, "user_alpha", reqId),
      togglePrayerCommitmentLogic(db, FieldValue, "user_beta", reqId),
    ]);

    assert.equal(results[0].success, true);
    assert.equal(results[1].success, true);

    const finalCount = await getPrayingCountInDb(reqId);
    const commitmentsCount = await countCommitmentsInDb(reqId);

    assert.equal(finalCount, 2);
    assert.equal(commitmentsCount, 2);
    assert.equal(finalCount, commitmentsCount, "INVARIANTE: prayingCount debe ser igual al número de compromisos");
  });

  // C3: Concurrencia Desactivación (A OFF mientras B permanece ON)
  it("C3: Usuario A desactiva mientras Usuario B permanece activo reduce count a 1", async () => {
    const reqId = "req_c3";
    await createTestPrayerRequest(reqId);

    // Setup 2 commitments
    await togglePrayerCommitmentLogic(db, FieldValue, "user_alpha", reqId);
    await togglePrayerCommitmentLogic(db, FieldValue, "user_beta", reqId);

    // User Alpha toggles OFF
    const resOff = await togglePrayerCommitmentLogic(db, FieldValue, "user_alpha", reqId);
    assert.equal(resOff.active, false);

    const finalCount = await getPrayingCountInDb(reqId);
    const commitmentsCount = await countCommitmentsInDb(reqId);

    assert.equal(finalCount, 1);
    assert.equal(commitmentsCount, 1);
    assert.equal(finalCount, commitmentsCount, "INVARIANTE: prayingCount debe ser igual al número de compromisos");
  });

  // C4: Concurrencia Mixta (3 Usuarios simultáneos ON)
  it("C4: 3 usuarios simultáneos activando producen count = 3 y 3 compromisos", async () => {
    const reqId = "req_c4";
    await createTestPrayerRequest(reqId);

    await Promise.all([
      togglePrayerCommitmentLogic(db, FieldValue, "user_1", reqId),
      togglePrayerCommitmentLogic(db, FieldValue, "user_2", reqId),
      togglePrayerCommitmentLogic(db, FieldValue, "user_3", reqId),
    ]);

    const finalCount = await getPrayingCountInDb(reqId);
    const commitmentsCount = await countCommitmentsInDb(reqId);

    assert.equal(finalCount, 3);
    assert.equal(commitmentsCount, 3);
    assert.equal(finalCount, commitmentsCount, "INVARIANTE: prayingCount debe ser igual al número de compromisos");
  });

  // C5: Concurrencia Mixta Desactivación (A y B OFF simultáneamente desde count 2)
  it("C5: A y B desactivando simultáneamente desde count 2 dejan count = 0 y 0 compromisos", async () => {
    const reqId = "req_c5";
    await createTestPrayerRequest(reqId);

    await togglePrayerCommitmentLogic(db, FieldValue, "user_1", reqId);
    await togglePrayerCommitmentLogic(db, FieldValue, "user_2", reqId);

    await Promise.all([
      togglePrayerCommitmentLogic(db, FieldValue, "user_1", reqId),
      togglePrayerCommitmentLogic(db, FieldValue, "user_2", reqId),
    ]);

    const finalCount = await getPrayingCountInDb(reqId);
    const commitmentsCount = await countCommitmentsInDb(reqId);

    assert.equal(finalCount, 0);
    assert.equal(commitmentsCount, 0);
    assert.equal(finalCount, commitmentsCount, "INVARIANTE: prayingCount debe ser igual al número de compromisos");
  });

  // C6: Operación sobre petición eliminada concurrentemente
  it("C6: Toggle sobre petición eliminada lanza error not-found", async () => {
    const reqId = "req_c6";
    await createTestPrayerRequest(reqId, "active", "user_owner");

    // Delete request
    await deletePrayerRequestLogic(db, "user_owner", reqId);

    // Toggle should fail
    await assert.rejects(
      async () => togglePrayerCommitmentLogic(db, FieldValue, "user_stranger", reqId),
      (err) => err.code === "not-found"
    );
  });

  // D1 - D5: Pruebas de Cleanup en Firestore Emulator
  it("D1: Cleanup con 0 compromisos elimina petición y documento privado", async () => {
    const reqId = "req_d1";
    await createTestPrayerRequest(reqId, "active", "user_owner");

    const res = await deletePrayerRequestLogic(db, "user_owner", reqId);
    assert.equal(res.success, true);

    const reqSnap = await db.collection("communityPrayerRequests").doc(reqId).get();
    const privSnap = await db.collection("communityPrayerPrivate").doc(reqId).get();
    assert.equal(reqSnap.exists, false);
    assert.equal(privSnap.exists, false);
  });

  it("D2: Cleanup con 1 compromiso elimina todo sin dejar huérfanos", async () => {
    const reqId = "req_d2";
    await createTestPrayerRequest(reqId, "active", "user_owner");
    await togglePrayerCommitmentLogic(db, FieldValue, "user_1", reqId);

    await deletePrayerRequestLogic(db, "user_owner", reqId);
    assert.equal(await countCommitmentsInDb(reqId), 0);
  });

  it("D3: Cleanup con 10 compromisos elimina todo en batch", async () => {
    const reqId = "req_d3";
    await createTestPrayerRequest(reqId, "active", "user_owner");

    for (let i = 0; i < 10; i++) {
      await togglePrayerCommitmentLogic(db, FieldValue, `user_${i}`, reqId);
    }

    await deletePrayerRequestLogic(db, "user_owner", reqId);
    assert.equal(await countCommitmentsInDb(reqId), 0);
  });

  it("D4: Cleanup con 100 compromisos elimina todo en batch", async () => {
    const reqId = "req_d4";
    await createTestPrayerRequest(reqId, "active", "user_owner");

    // Seed 100 commitments directly
    const batch = db.batch();
    for (let i = 0; i < 100; i++) {
      const ref = db.collection("communityPrayerCommitments").doc(`${reqId}_user_${i}`);
      batch.set(ref, { requestId: reqId, ownerUid: `user_${i}`, createdAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
    }
    await batch.commit();

    await deletePrayerRequestLogic(db, "user_owner", reqId);
    assert.equal(await countCommitmentsInDb(reqId), 0);
  });

  it("D5: Cleanup con 520 compromisos (>500 limit) borra todo mediante batch chunking", async () => {
    const reqId = "req_d5";
    await createTestPrayerRequest(reqId, "active", "user_owner");

    // Seed 520 commitments across multiple batches
    const commitmentsToCreate = 520;
    for (let b = 0; b < commitmentsToCreate; b += 400) {
      const batch = db.batch();
      for (let i = b; i < Math.min(commitmentsToCreate, b + 400); i++) {
        const ref = db.collection("communityPrayerCommitments").doc(`${reqId}_user_${i}`);
        batch.set(ref, { requestId: reqId, ownerUid: `user_${i}`, createdAt: FieldValue.serverTimestamp(), schemaVersion: 1 });
      }
      await batch.commit();
    }

    assert.equal(await countCommitmentsInDb(reqId), 520);

    // Execute chunked delete
    const res = await deletePrayerRequestLogic(db, "user_owner", reqId);
    assert.equal(res.success, true);

    const remainingCommitments = await countCommitmentsInDb(reqId);
    assert.equal(remainingCommitments, 0, "No debe haber documentos huérfanos tras eliminar más de 500 compromisos");
  });

  // Petición Respondida & Conservación Histórica
  it("Petición respondida bloquea nuevos compromisos pero conserva los preexistentes", async () => {
    const reqId = "req_answered_test";
    await createTestPrayerRequest(reqId, "active", "user_owner");

    // User A and B pray
    await togglePrayerCommitmentLogic(db, FieldValue, "user_a", reqId);
    await togglePrayerCommitmentLogic(db, FieldValue, "user_b", reqId);

    // Owner marks as answered
    await markPrayerRequestAnsweredLogic(db, FieldValue, "user_owner", reqId, "¡Dios respondió!");

    // New user C attempts to toggle -> blocked!
    await assert.rejects(
      async () => togglePrayerCommitmentLogic(db, FieldValue, "user_c", reqId),
      (err) => err.code === "failed-precondition"
    );

    // Existing commitments and historical prayingCount are preserved!
    const countInDb = await getPrayingCountInDb(reqId);
    const commitmentsCount = await countCommitmentsInDb(reqId);

    assert.equal(countInDb, 2);
    assert.equal(commitmentsCount, 2);
  });
});
