"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { HttpsError } = require("firebase-functions/v2/https");

const {
  sanitizePrayerText,
  sanitizeAnsweredText,
  createAnonymousPrayerDocument,
  createIdentifiedPrayerDocument,
  createPrayerPrivateDocument,
  resolvePrayerOwnership,
  createPrayerRequestLogic,
  getPrayerOwnershipLogic,
  deletePrayerRequestLogic,
  markPrayerRequestAnsweredLogic,
  togglePrayerCommitmentLogic,
  getPrayerCommitmentStatusLogic,
} = require("./communityPrayer");

describe("communityPrayer 3B.1 Privacy & Core Unit Tests", () => {
  const timestamp = { seconds: 1700000000 };
  const mockAuthorSnapshot = {
    displayName: "María Elena",
    avatarId: "dove",
    colorId: "blue-01",
  };

  const FORBIDDEN_PRIVACY_KEYS = ["ownerUid", "uid", "userId", "profileId", "email"];

  function assertNoForbiddenPrivacyKeys(doc, isAnonymous = false) {
    for (const key of FORBIDDEN_PRIVACY_KEYS) {
      assert.equal(
        doc[key],
        undefined,
        `Privacy Violation: Public document must NOT contain '${key}'`
      );
    }

    if (isAnonymous) {
      assert.equal(
        doc.authorSnapshot,
        undefined,
        "Privacy Violation: Anonymous public document must NOT contain 'authorSnapshot'"
      );
    }
  }

  // 1 & 25: Identificada + Distintivo válido -> permitida con authorSnapshot validado en servidor
  it("Test 1 & 25: Identificada + Distintivo válido utiliza perfil validado en servidor", async () => {
    let writtenPublicDoc = null;
    let writtenPrivateDoc = null;

    const mockDb = {
      collection() {
        return {
          doc() {
            return { id: "req_ident_100" };
          },
        };
      },
      batch() {
        return {
          set(ref, data) {
            if (data.isAnonymous === false) writtenPublicDoc = data;
            if (data.ownerUid) writtenPrivateDoc = data;
          },
          async commit() {},
        };
      },
    };

    const mockFieldValue = { serverTimestamp: () => timestamp };
    const getRequiredCommunityAuthorSnapshot = async (db, uid) => {
      assert.equal(uid, "user_maria");
      return mockAuthorSnapshot;
    };

    const res = await createPrayerRequestLogic(
      mockDb,
      mockFieldValue,
      "user_maria",
      { text: "Petición identificada por mi salud", isAnonymous: false },
      getRequiredCommunityAuthorSnapshot
    );

    assert.equal(res.success, true);
    assert.equal(res.id, "req_ident_100");
    assert.equal(writtenPublicDoc.name, "María Elena");
    assert.deepEqual(writtenPublicDoc.authorSnapshot, mockAuthorSnapshot);
    assertNoForbiddenPrivacyKeys(writtenPublicDoc, false);
    assert.equal(writtenPrivateDoc.ownerUid, "user_maria");
  });

  // 2: Identificada sin Distintivo -> rechazada (COMMUNITY_PROFILE_REQUIRED)
  it("Test 2: Identificada sin Distintivo es rechazada por el servidor", async () => {
    const mockDb = {
      collection() {
        return { doc() { return { id: "req_test" }; } };
      },
      batch() {
        return { set() {}, async commit() {} };
      },
    };
    const mockFieldValue = { serverTimestamp: () => timestamp };
    const getRequiredCommunityAuthorSnapshot = async () => {
      throw new HttpsError("failed-precondition", "COMMUNITY_PROFILE_REQUIRED");
    };

    await assert.rejects(
      async () => {
        await createPrayerRequestLogic(
          mockDb,
          mockFieldValue,
          "user_no_profile",
          { text: "Petición identificada sin perfil", isAnonymous: false },
          getRequiredCommunityAuthorSnapshot
        );
      },
      (err) => err instanceof HttpsError && err.message === "COMMUNITY_PROFILE_REQUIRED"
    );
  });

  // 3: Anónima sin Distintivo -> permitida
  it("Test 3: Anónima sin Distintivo es permitida", async () => {
    let writtenPublicDoc = null;
    const mockDb = {
      collection() {
        return { doc() { return { id: "req_anon_200" }; } };
      },
      batch() {
        return {
          set(ref, data) {
            if (data.isAnonymous === true) writtenPublicDoc = data;
          },
          async commit() {},
        };
      },
    };
    const mockFieldValue = { serverTimestamp: () => timestamp };

    const res = await createPrayerRequestLogic(
      mockDb,
      mockFieldValue,
      "user_no_profile",
      { text: "Petición anónima por mi trabajo", isAnonymous: true },
      null
    );

    assert.equal(res.success, true);
    assert.equal(writtenPublicDoc.name, "Anónimo");
    assert.equal(writtenPublicDoc.isAnonymous, true);
    assertNoForbiddenPrivacyKeys(writtenPublicDoc, true);
  });

  // 4, 6 & 15: Petición identificada pública NO contiene ownerUid, uid, userId, profileId, email
  it("Test 4, 6 & 15: Structural privacy inspection for Identified public document", () => {
    const doc = createIdentifiedPrayerDocument({
      text: "Oración pública identificada",
      authorSnapshot: mockAuthorSnapshot,
      timestamp,
    });

    assert.equal(doc.name, "María Elena");
    assert.equal(doc.isAnonymous, false);
    assertNoForbiddenPrivacyKeys(doc, false);

    const keys = Object.keys(doc).sort();
    assert.deepEqual(keys, [
      "authorSnapshot",
      "createdAt",
      "isAnonymous",
      "name",
      "prayingCount",
      "schemaVersion",
      "status",
      "text",
    ]);
  });

  // 5, 7 & 15: Petición anónima pública NO contiene ownerUid, uid, userId, profileId, email, authorSnapshot
  it("Test 5, 7 & 15: Structural privacy inspection for Anonymous public document", () => {
    const doc = createAnonymousPrayerDocument({
      text: "Oración pública anónima",
      timestamp,
    });

    assert.equal(doc.name, "Anónimo");
    assert.equal(doc.isAnonymous, true);
    assertNoForbiddenPrivacyKeys(doc, true);

    const keys = Object.keys(doc).sort();
    assert.deepEqual(keys, [
      "createdAt",
      "isAnonymous",
      "name",
      "prayingCount",
      "schemaVersion",
      "status",
      "text",
    ]);
  });

  // 8 & 9: Documento privado contiene ownerUid correcto para identificadas y anónimas
  it("Test 8 & 9: Documento privado contiene ownerUid correcto", () => {
    const privIdent = createPrayerPrivateDocument({ ownerUid: "user_ident_123", timestamp });
    assert.equal(privIdent.ownerUid, "user_ident_123");
    assert.equal(privIdent.schemaVersion, 1);

    const privAnon = createPrayerPrivateDocument({ ownerUid: "user_anon_456", timestamp });
    assert.equal(privAnon.ownerUid, "user_anon_456");
    assert.equal(privAnon.schemaVersion, 1);
  });

  // 10, 11 & 12: Validaciones de texto (vacío, < 3 chars, > 800 chars)
  it("Test 10, 11 & 12: Validaciones de longitud de texto", () => {
    // Vacío
    assert.throws(
      () => sanitizePrayerText("", 800),
      { code: "invalid-argument", message: "PRAYER_TEXT_TOO_SHORT" }
    );

    // Too short (< 3)
    assert.throws(
      () => sanitizePrayerText("  ab  ", 800),
      { code: "invalid-argument", message: "PRAYER_TEXT_TOO_SHORT" }
    );

    // Too long (> 800)
    const longText = "x".repeat(801);
    assert.throws(
      () => sanitizePrayerText(longText, 800),
      { code: "invalid-argument", message: "PRAYER_TEXT_TOO_LONG" }
    );

    // Válido
    assert.equal(sanitizePrayerText("  Dios me dé paz  ", 800), "Dios me dé paz");
  });

  // 13 & 14: Validaciones de isAnonymous e unauthenticated
  it("Test 13 & 14: Autenticación y tipo de isAnonymous", async () => {
    const mockDb = { collection() { return { doc() { return { id: "req_1" }; } }; }, batch() { return { set() {}, async commit() {} }; } };
    const mockFieldValue = { serverTimestamp: () => timestamp };

    const getRequiredCommunityAuthorSnapshot = async () => mockAuthorSnapshot;
    const res = await createPrayerRequestLogic(
      mockDb,
      mockFieldValue,
      "user_1",
      { text: "Petición con flag no booleano", isAnonymous: "yes" },
      getRequiredCommunityAuthorSnapshot
    );
    assert.equal(res.success, true);
  });

  // 15, 16 & 17: Unified ownership resolution & getPrayerOwnership booleans
  it("Test 15, 16 & 17: Uniform ownership checks for identified and anonymous prayers", async () => {
    const mockDb = {
      collection(col) {
        return {
          doc(docId) {
            return {
              async get() {
                if (col === "communityPrayerPrivate" && docId === "req_ident") {
                  return { exists: true, get: (f) => (f === "ownerUid" ? "user_author" : null) };
                }
                if (col === "communityPrayerPrivate" && docId === "req_anon") {
                  return { exists: true, get: (f) => (f === "ownerUid" ? "user_author" : null) };
                }
                return { exists: false };
              },
            };
          },
          where() {
            return {
              async get() {
                return { docs: [] };
              },
            };
          },
        };
      },
      batch() {
        return { delete() {}, async commit() {} };
      },
    };

    // Owner checks
    assert.equal(await resolvePrayerOwnership(mockDb, "req_ident", "user_author"), true);
    assert.equal(await resolvePrayerOwnership(mockDb, "req_anon", "user_author"), true);

    // Non-owner checks
    assert.equal(await resolvePrayerOwnership(mockDb, "req_ident", "user_stranger"), false);
    assert.equal(await resolvePrayerOwnership(mockDb, "req_anon", "user_stranger"), false);

    // getPrayerOwnershipLogic returns boolean map without exposing UIDs
    const ownershipRes = await getPrayerOwnershipLogic(mockDb, "user_author", ["req_ident", "req_anon", "req_other"]);
    assert.deepEqual(ownershipRes.requests, {
      req_ident: true,
      req_anon: true,
      req_other: false,
    });

    // Delete permission test
    assert.equal((await deletePrayerRequestLogic(mockDb, "user_author", "req_ident")).success, true);

    await assert.rejects(
      async () => { await deletePrayerRequestLogic(mockDb, "user_stranger", "req_ident"); },
      (err) => err instanceof HttpsError && err.code === "permission-denied"
    );
  });

  // 18, 19 & 20: markPrayerRequestAnswered authorization and text sanitization
  it("Test 18, 19 & 20: markPrayerRequestAnswered logic & limits", async () => {
    let updatePayload = null;
    const mockDb = {
      collection(col) {
        return {
          doc(docId) {
            return {
              async get() {
                if (col === "communityPrayerPrivate" && docId === "req_answered") {
                  return { exists: true, get: (f) => (f === "ownerUid" ? "user_owner" : null) };
                }
                return { exists: false };
              },
              async update(payload) {
                updatePayload = payload;
              },
            };
          },
        };
      },
    };
    const mockFieldValue = { serverTimestamp: () => timestamp };

    // Owner can mark answered
    const res = await markPrayerRequestAnsweredLogic(
      mockDb,
      mockFieldValue,
      "user_owner",
      "req_answered",
      "  Dios escuchó nuestra oración.  "
    );
    assert.equal(res.success, true);
    assert.equal(updatePayload.status, "answered");
    assert.equal(updatePayload.answeredText, "Dios escuchó nuestra oración.");
    assert.deepEqual(updatePayload.answeredAt, timestamp);

    // Non-owner rejected
    await assert.rejects(
      async () => {
        await markPrayerRequestAnsweredLogic(
          mockDb,
          mockFieldValue,
          "user_stranger",
          "req_answered",
          "Test"
        );
      },
      (err) => err instanceof HttpsError && err.code === "permission-denied"
    );
  });

  // 21: Malicious payload stripping
  it("Test 21: Malicious payload fields (ownerUid, prayingCount, status) are stripped", async () => {
    let writtenPublicDoc = null;
    const mockDb = {
      collection() { return { doc() { return { id: "req_hacked" }; } }; },
      batch() {
        return {
          set(ref, data) {
            if (data.isAnonymous !== undefined) writtenPublicDoc = data;
          },
          async commit() {},
        };
      },
    };
    const mockFieldValue = { serverTimestamp: () => timestamp };

    const maliciousData = {
      text: "Texto de la petición legítima",
      isAnonymous: true,
      ownerUid: "hacker_uid",
      uid: "hacker_uid",
      email: "hacker@evil.com",
      prayingCount: 99999,
      status: "answered",
      schemaVersion: 99,
      createdAt: { seconds: 1 },
    };

    await createPrayerRequestLogic(
      mockDb,
      mockFieldValue,
      "real_user",
      maliciousData,
      null
    );

    // Verify injected fields were IGNORED
    assert.equal(writtenPublicDoc.ownerUid, undefined);
    assert.equal(writtenPublicDoc.uid, undefined);
    assert.equal(writtenPublicDoc.email, undefined);
    assert.equal(writtenPublicDoc.prayingCount, 0); // Always 0
    assert.equal(writtenPublicDoc.status, "active"); // Always active
    assert.equal(writtenPublicDoc.schemaVersion, 1); // Always 1
    assert.deepEqual(writtenPublicDoc.createdAt, timestamp); // Server timestamp
  });

  // 22, 23 & 24: Standard initial defaults
  it("Test 22, 23 & 24: Default prayingCount = 0, status = active, serverTimestamp", () => {
    const docIdent = createIdentifiedPrayerDocument({
      text: "Petición estándar",
      authorSnapshot: mockAuthorSnapshot,
      timestamp,
    });
    assert.equal(docIdent.prayingCount, 0);
    assert.equal(docIdent.status, "active");
    assert.deepEqual(docIdent.createdAt, timestamp);

    const docAnon = createAnonymousPrayerDocument({
      text: "Petición anónima estándar",
      timestamp,
    });
    assert.equal(docAnon.prayingCount, 0);
    assert.equal(docAnon.status, "active");
    assert.deepEqual(docAnon.createdAt, timestamp);
  });

  // 26: usuario autenticado activa compromiso (OFF -> ON)
  it("Test 26: usuario autenticado activa compromiso (OFF -> ON)", async () => {
    let commitmentCreated = null;
    let requestUpdated = null;
    let currentCount = 0;

    const mockDb = {
      collection(col) {
        return {
          doc(id) {
            return { id, col };
          },
        };
      },
      async runTransaction(updateFunction) {
        const transaction = {
          async get(ref) {
            if (ref.col === "communityPrayerRequests" && ref.id === "req_1") {
              return { exists: true, get: (f) => (f === "status" ? "active" : f === "prayingCount" ? currentCount : null) };
            }
            if (ref.col === "communityPrayerCommitments") {
              return { exists: false };
            }
            return { exists: false };
          },
          set(ref, data) { commitmentCreated = data; },
          update(ref, data) { requestUpdated = data; },
          delete() {},
        };
        return updateFunction(transaction);
      },
    };
    const mockFieldValue = { serverTimestamp: () => timestamp };

    const res = await togglePrayerCommitmentLogic(mockDb, mockFieldValue, "user_123", "req_1");
    assert.equal(res.success, true);
    assert.equal(res.active, true);
    assert.equal(res.prayingCount, 1);
    assert.equal(commitmentCreated.requestId, "req_1");
    assert.equal(commitmentCreated.ownerUid, "user_123");
    assert.equal(requestUpdated.prayingCount, 1);
  });

  // 27: usuario autenticado desactiva compromiso (ON -> OFF)
  it("Test 27: usuario autenticado desactiva compromiso (ON -> OFF)", async () => {
    let commitmentDeleted = false;
    let requestUpdated = null;

    const mockDb = {
      collection(col) {
        return {
          doc(id) {
            return { id, col };
          },
        };
      },
      async runTransaction(updateFunction) {
        const transaction = {
          async get(ref) {
            if (ref.col === "communityPrayerRequests" && ref.id === "req_1") {
              return { exists: true, get: (f) => (f === "status" ? "active" : f === "prayingCount" ? 5 : null) };
            }
            if (ref.col === "communityPrayerCommitments") {
              return { exists: true };
            }
            return { exists: false };
          },
          set() {},
          update(ref, data) { requestUpdated = data; },
          delete() { commitmentDeleted = true; },
        };
        return updateFunction(transaction);
      },
    };
    const mockFieldValue = { serverTimestamp: () => timestamp };

    const res = await togglePrayerCommitmentLogic(mockDb, mockFieldValue, "user_123", "req_1");
    assert.equal(res.success, true);
    assert.equal(res.active, false);
    assert.equal(res.prayingCount, 4);
    assert.equal(commitmentDeleted, true);
    assert.equal(requestUpdated.prayingCount, 4);
  });

  // 28: usuario sin Distintivo puede usarlo
  it("Test 28: usuario sin Distintivo puede usar toggle", async () => {
    const mockDb = {
      collection() { return { doc() { return {}; } }; },
      async runTransaction(fn) {
        return fn({
          async get(ref) {
            return { exists: true, get: (f) => (f === "status" ? "active" : 0) };
          },
          set() {}, update() {}, delete() {},
        });
      },
    };
    const res = await togglePrayerCommitmentLogic(mockDb, { serverTimestamp: () => timestamp }, "user_no_badge", "req_1");
    assert.equal(res.success, true);
  });

  // 29: petición anónima acepta compromiso
  it("Test 29: petición anónima acepta compromiso igual que identificada", async () => {
    const mockDb = {
      collection() { return { doc() { return {}; } }; },
      async runTransaction(fn) {
        return fn({
          async get() { return { exists: true, get: (f) => (f === "status" ? "active" : 2) }; },
          set() {}, update() {}, delete() {},
        });
      },
    };
    const res = await togglePrayerCommitmentLogic(mockDb, { serverTimestamp: () => timestamp }, "user_abc", "req_anon_99");
    assert.equal(res.success, true);
  });

  // 30: unauthenticated sin auth rechazado
  it("Test 30: sin auth es rechazado", async () => {
    await assert.rejects(
      async () => togglePrayerCommitmentLogic({}, {}, null, "req_1"),
      (err) => err instanceof HttpsError && err.code === "unauthenticated"
    );
  });

  // 31: requestId inválido rechazado
  it("Test 31: requestId inválido es rechazado", async () => {
    await assert.rejects(
      async () => togglePrayerCommitmentLogic({}, {}, "user_1", ""),
      (err) => err instanceof HttpsError && err.code === "invalid-argument"
    );
  });

  // 32: petición inexistente rechazada
  it("Test 32: petición inexistente es rechazada", async () => {
    const mockDb = {
      collection() { return { doc() { return {}; } }; },
      async runTransaction(fn) {
        return fn({
          async get() { return { exists: false }; },
        });
      },
    };
    await assert.rejects(
      async () => togglePrayerCommitmentLogic(mockDb, {}, "user_1", "req_ghost"),
      (err) => err instanceof HttpsError && err.code === "not-found"
    );
  });

  // 33: petición answered no acepta nuevos compromisos
  it("Test 33: petición answered no acepta compromisos", async () => {
    const mockDb = {
      collection() { return { doc() { return {}; } }; },
      async runTransaction(fn) {
        return fn({
          async get() { return { exists: true, get: (f) => (f === "status" ? "answered" : 10) }; },
        });
      },
    };
    await assert.rejects(
      async () => togglePrayerCommitmentLogic(mockDb, {}, "user_1", "req_answered_123"),
      (err) => err instanceof HttpsError && err.code === "failed-precondition"
    );
  });

  // 34: decremento nunca negativo
  it("Test 34: decremento nunca produce prayingCount negativo", async () => {
    let updatedCount = null;
    const mockDb = {
      collection() { return { doc() { return {}; } }; },
      async runTransaction(fn) {
        return fn({
          async get(ref) {
            // Count is 0 but commitment exists accidentally
            return { exists: true, get: (f) => (f === "status" ? "active" : 0) };
          },
          delete() {},
          update(ref, data) { updatedCount = data.prayingCount; },
        });
      },
    };
    const res = await togglePrayerCommitmentLogic(mockDb, { serverTimestamp: () => timestamp }, "user_1", "req_zero");
    assert.equal(res.prayingCount, 0);
    assert.equal(updatedCount, 0);
  });

  // 35: respuesta toggle no contiene UID ni datos privados
  it("Test 35: respuesta toggle no contiene UIDs ni datos privados", async () => {
    const mockDb = {
      collection() { return { doc() { return {}; } }; },
      async runTransaction(fn) {
        return fn({
          async get() { return { exists: true, get: (f) => (f === "status" ? "active" : 3) }; },
          set() {}, update() {}, delete() {},
        });
      },
    };
    const res = await togglePrayerCommitmentLogic(mockDb, { serverTimestamp: () => timestamp }, "user_123", "req_1");
    assert.equal(res.ownerUid, undefined);
    assert.equal(res.uid, undefined);
    assert.equal(res.userId, undefined);
    assert.deepEqual(Object.keys(res).sort(), ["active", "prayingCount", "success"]);
  });

  // 36: getPrayerCommitmentStatusLogic batch status no contiene UIDs
  it("Test 36: getPrayerCommitmentStatusLogic batch status no contiene UIDs", async () => {
    const mockDb = {
      collection() {
        return {
          doc(docId) {
            return {
              async get() {
                if (docId === "req_1_user_abc") return { exists: true };
                return { exists: false };
              },
            };
          },
        };
      },
    };

    const res = await getPrayerCommitmentStatusLogic(mockDb, "user_abc", ["req_1", "req_2"]);
    assert.deepEqual(res.commitments, {
      req_1: true,
      req_2: false,
    });
    assert.equal(res.ownerUid, undefined);
    assert.equal(res.uid, undefined);
  });

  // 37: eliminación de petición limpia compromisos asociados
  it("Test 37: eliminación de petición limpia compromisos privados asociados", async () => {
    let deletedDocs = [];
    const mockDb = {
      collection(col) {
        return {
          doc(docId) {
            return {
              async get() {
                if (col === "communityPrayerPrivate" && docId === "req_del") {
                  return { exists: true, get: (f) => (f === "ownerUid" ? "user_owner" : null) };
                }
                return { exists: false };
              },
            };
          },
          where() {
            return {
              async get() {
                return {
                  docs: [
                    { ref: { id: "req_del_user1" } },
                    { ref: { id: "req_del_user2" } },
                  ],
                };
              },
            };
          },
        };
      },
      batch() {
        return {
          delete(ref) { deletedDocs.push(ref); },
          async commit() {},
        };
      },
    };

    const res = await deletePrayerRequestLogic(mockDb, "user_owner", "req_del");
    assert.equal(res.success, true);
    assert.equal(deletedDocs.length, 4); // main doc + private doc + 2 commitment docs
  });
});
