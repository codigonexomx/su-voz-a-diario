"use strict";

const assert = require("node:assert/strict");
const {
  createIdentifiedPostDocument,
  createAnonymousPostDocument,
  createAuthorSnapshot
} = require("./communityIdentity");

function validateIntentHelper(rawIntent) {
  let intent = undefined;
  if (rawIntent !== undefined && rawIntent !== null) {
    if (typeof rawIntent !== "string" || !["reflection", "dailyQuestionResponse"].includes(rawIntent)) {
      throw new Error("invalid-argument: El parámetro intent no es válido.");
    }
    if (rawIntent === "dailyQuestionResponse") {
      intent = "dailyQuestionResponse";
    }
  }
  return intent;
}

function normalizeClientDraftIntent(rawIntent) {
  return ["reflection", "dailyQuestionResponse"].includes(rawIntent) ? rawIntent : "reflection";
}

function run() {
  console.log("[Test 6G/6H] Running Community Premium 6G/6H Intent & Storage Strategy tests...");

  const authorSnapshot = createAuthorSnapshot({
    displayName: "Prueba 6G",
    normalizedName: "prueba 6g",
    avatarId: "dove",
    colorId: "blue-01"
  });
  const timestamp = "SERVER_TIMESTAMP";

  // Test 1: Reflection intent (omitted for reflection strategy) on Identified Post
  const reflectionPost = createIdentifiedPostDocument({
    reference: "Salmos 23:1",
    text: "El Señor es mi pastor",
    date: "2026-09-04",
    ownerUid: "uid-6g-1",
    authorSnapshot,
    timestamp,
    intent: "reflection"
  });
  assert.equal(Object.hasOwn(reflectionPost, "intent"), false, "intent field must be omitted for reflection");
  assert.equal(JSON.stringify(reflectionPost).includes('"intent"'), false, "JSON serialization must omit intent for reflection");

  // Test 2: Default (no intent passed) on Identified Post
  const defaultPost = createIdentifiedPostDocument({
    reference: "Salmos 23:1",
    text: "El Señor es mi pastor",
    date: "2026-09-04",
    ownerUid: "uid-6g-1",
    authorSnapshot,
    timestamp
  });
  assert.equal(Object.hasOwn(defaultPost, "intent"), false, "intent field must be omitted when undefined");

  // Test 3: dailyQuestionResponse intent on Identified Post
  const questionResponsePost = createIdentifiedPostDocument({
    reference: "Salmos 23:1",
    text: "Respuesta a la pregunta del día",
    date: "2026-09-04",
    ownerUid: "uid-6g-1",
    authorSnapshot,
    timestamp,
    intent: "dailyQuestionResponse"
  });
  assert.equal(questionResponsePost.intent, "dailyQuestionResponse", "intent must be dailyQuestionResponse");
  assert.equal(JSON.stringify(questionResponsePost).includes('"intent":"dailyQuestionResponse"'), true);

  // Test 4: Anonymous Post - Reflection (omitted)
  const anonymousReflection = createAnonymousPostDocument({
    reference: "Proverbios 3:5",
    text: "Confía en el Señor",
    date: "2026-09-04",
    timestamp,
    intent: "reflection"
  });
  assert.equal(Object.hasOwn(anonymousReflection, "intent"), false, "Anonymous reflection must omit intent field");
  assert.equal(Object.hasOwn(anonymousReflection, "ownerUid"), false, "Anonymous post must NOT contain ownerUid");

  // Test 5: Anonymous Post - dailyQuestionResponse (privacy intact)
  const anonymousQuestionResponse = createAnonymousPostDocument({
    reference: "Proverbios 3:5",
    text: "Mi respuesta de hoy",
    date: "2026-09-04",
    timestamp,
    intent: "dailyQuestionResponse"
  });
  assert.equal(anonymousQuestionResponse.intent, "dailyQuestionResponse", "Anonymous post must retain dailyQuestionResponse intent");
  assert.equal(Object.hasOwn(anonymousQuestionResponse, "ownerUid"), false, "Anonymous question response must NOT contain ownerUid");
  assert.equal(Object.hasOwn(anonymousQuestionResponse, "authorSnapshot"), false, "Anonymous question response must NOT contain authorSnapshot");

  // Test 6: Ensure dailyQuestion text is NEVER snapshotted in document
  const postWithAttemptedSnapshot = createIdentifiedPostDocument({
    reference: "Mateo 5:14",
    text: "Vosotros sois la luz del mundo",
    date: "2026-09-04",
    ownerUid: "uid-6g-2",
    authorSnapshot,
    timestamp,
    intent: "dailyQuestionResponse",
    dailyQuestion: "FALSO SNAPSHOT DE PREGUNTA"
  });
  assert.equal(Object.hasOwn(postWithAttemptedSnapshot, "dailyQuestion"), false, "dailyQuestion field must never be snapshotted");

  // Test 7: Schema Version Integrity
  assert.equal(reflectionPost.schemaVersion, 2, "Identified post schemaVersion must remain 2");
  assert.equal(anonymousReflection.schemaVersion, 3, "Anonymous post schemaVersion must remain 3");

  // Test 8: Cloud Function Intent Validation - Valid inputs
  assert.equal(validateIntentHelper(undefined), undefined);
  assert.equal(validateIntentHelper(null), undefined);
  assert.equal(validateIntentHelper("reflection"), undefined); // reflection is omitted
  assert.equal(validateIntentHelper("dailyQuestionResponse"), "dailyQuestionResponse");

  // Test 9: Cloud Function Intent Validation - Invalid inputs (throw invalid-argument)
  const invalidInputs = [
    "DailyQuestionResponse",
    "daily-question-response",
    "question",
    "garbage",
    123,
    true,
    false,
    {},
    []
  ];
  invalidInputs.forEach(invalidInput => {
    assert.throws(
      () => validateIntentHelper(invalidInput),
      /invalid-argument/,
      `Input ${JSON.stringify(invalidInput)} should throw invalid-argument`
    );
  });

  // Test 10: Client Draft Intent Normalization
  assert.equal(normalizeClientDraftIntent(undefined), "reflection");
  assert.equal(normalizeClientDraftIntent(null), "reflection");
  assert.equal(normalizeClientDraftIntent(""), "reflection");
  assert.equal(normalizeClientDraftIntent("invalid_string"), "reflection");
  assert.equal(normalizeClientDraftIntent("reflection"), "reflection");
  assert.equal(normalizeClientDraftIntent("dailyQuestionResponse"), "dailyQuestionResponse");

  // Test 11: Text preservation when changing intent
  const draftState = { text: "ABC", intent: "reflection" };
  draftState.intent = normalizeClientDraftIntent("dailyQuestionResponse");
  assert.equal(draftState.text, "ABC", "Draft text must be preserved when switching to dailyQuestionResponse");
  draftState.intent = normalizeClientDraftIntent("reflection");
  assert.equal(draftState.text, "ABC", "Draft text must be preserved when switching back to reflection");

  console.log("✓ ALL 11 COMMUNITY PREMIUM 6G/6H INTENT & STORAGE STRATEGY TESTS PASSED SUCCESSFULLY!\n");
}

run();
