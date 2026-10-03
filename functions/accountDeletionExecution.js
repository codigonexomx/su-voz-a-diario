"use strict";

const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const { buildInventory, authSummary, inventoryHash, requestReference, COLLECTIONS } = require("./accountDeletionInventory");
const { guardRef, QUIESCENCE_MS } = require("./accountDeletionAccess");
const { validateBackup } = require("./communityOrphanCleanup");

const SUPPORT_VERSION = "account-deletion-v1";
const supportedReviews = new Set(["shared-outbox-review-preserve-other-recipients", "replay-ledger-review"]);
const deletableCollections = new Set(COLLECTIONS.filter(name => !["accountDeletionRequests", "accountDeletionGuards", "communityConfiguration", "communityReports", "communityActivityEvents", "communityActivityDeliveries", "communityDeletionJobs"].includes(name)));
const validTimestamp = text => typeof text === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(text) && Number.isFinite(Date.parse(text));

function sameVersion(timestamp, text) {
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(text || "");
  return Boolean(timestamp && match && timestamp.seconds === Date.parse(match[1] + "Z") / 1000
    && timestamp.nanoseconds === Number((match[2] || "").padEnd(9, "0")));
}

async function requireSupport(db) {
  const config = await db.doc("communityConfiguration/accountDeletion").get();
  if (config.get("version") !== SUPPORT_VERSION || config.get("enabled") !== true
    || config.get("firestoreGuard") !== true || config.get("storageGuard") !== true
    || config.get("callTimeoutSeconds") !== 60) throw new Error("DEPLOYED_ACCESS_GUARDS_REQUIRED");
}

function checkInventory(inventory, project) {
  if (inventory?.mode !== "read-only-account-inventory" || inventory.schemaVersion !== 1 || inventory.project !== project
    || requestReference(inventory.uid) !== inventory.reference || inventory.auth?.uid !== inventory.uid
    || inventory.auth.privileged || !Array.isArray(inventory.candidates) || !Array.isArray(inventory.review)
    || inventory.candidates.length > 20000 || inventory.review.some(item => !supportedReviews.has(item.reason))) {
    throw new Error("INVENTORY_REQUIRES_MANUAL_REVIEW");
  }
}

async function assertSubject(db, auth, inventory) {
  const user = authSummary(await auth.getUser(inventory.uid));
  const request = await db.doc(`accountDeletionRequests/${inventory.reference}`).get();
  const moderator = await db.doc("communityConfiguration/moderation").get();
  if (user.privileged || moderator.get("moderatorUid") === inventory.uid) throw new Error("PROTECTED_ADMIN_ACCOUNT");
  if (user.uid !== inventory.uid || user.emailDigest !== inventory.auth.emailDigest || user.linked !== inventory.auth.linked
    || user.emailVerified !== inventory.auth.emailVerified || request.get("uid") !== inventory.uid || request.get("status") !== "pending"
    || !sameVersion(request.updateTime, inventory.accountRequestUpdateTime)) throw new Error("ACCOUNT_OR_REQUEST_CHANGED");
  return user;
}

async function freezeAccount({ inventory, project, db, auth }) {
  checkInventory(inventory, project);
  await requireSupport(db);
  await assertSubject(db, auth, inventory);
  const guard = guardRef(db, inventory.uid), requestRef = db.doc(`accountDeletionRequests/${inventory.reference}`);
  await db.runTransaction(async transaction => {
    const [existing, request, moderator] = await transaction.getAll(guard, requestRef, db.doc("communityConfiguration/moderation"));
    if (moderator.get("moderatorUid") === inventory.uid) throw new Error("PROTECTED_ADMIN_ACCOUNT");
    if (request.get("uid") !== inventory.uid || request.get("status") !== "pending"
      || !sameVersion(request.updateTime, inventory.accountRequestUpdateTime)) throw new Error("ACCOUNT_OR_REQUEST_CHANGED");
    if (existing.exists) {
      if (existing.get("reference") !== inventory.reference || existing.get("status") !== "frozen") throw new Error("ACCOUNT_GUARD_CHANGED");
      return;
    }
    transaction.create(guard, { reference: inventory.reference, status: "frozen", frozenAt: FieldValue.serverTimestamp() });
  });
  await auth.updateUser(inventory.uid, { disabled: true });
  await auth.revokeRefreshTokens(inventory.uid);
  const frozenAt = (await guard.get()).get("frozenAt");
  return { mode: "account-frozen-not-deleted", earliestPlanAt: new Date(frozenAt.toMillis() + QUIESCENCE_MS).toISOString(), deleted: 0 };
}

async function assertPaused({ db, auth, inventory, now = Date.now }) {
  await requireSupport(db);
  const user = await assertSubject(db, auth, inventory);
  const guard = await guardRef(db, inventory.uid).get();
  const frozenAt = guard.get("frozenAt");
  if (!user.disabled || guard.get("reference") !== inventory.reference || !["frozen", "deleting"].includes(guard.get("status"))
    || !(frozenAt instanceof Timestamp) || now() - frozenAt.toMillis() < QUIESCENCE_MS) throw new Error("QUIESCENT_FROZEN_ACCOUNT_REQUIRED");
  return guard;
}

async function verifyAudioBackups({ plan, bucket, originalsRequired = false }) {
  if (!Array.isArray(plan.storageBackups) || plan.storageBackups.length !== plan.storageCandidates.length) throw new Error("VERIFIED_AUDIO_BACKUP_REQUIRED");
  for (const item of plan.storageCandidates) {
    const copy = plan.storageBackups.find(copy => copy.source?.name === item.name && copy.source?.generation === item.generation);
    if (!copy || copy.source.metageneration !== item.metageneration || !copy.backup?.name?.startsWith(`private-backups/account-audio/${plan.reference}/`)
      || copy.backup.name.split("/").some(part => !part || part === "." || part === "..")
      || !/^\d+$/.test(copy.backup.generation || "") || !/^\d+$/.test(copy.backup.metageneration || "")
      || typeof copy.source.size !== "string" || !/^\d+$/.test(copy.source.size)
      || !copy.source.md5Hash && !copy.source.crc32c) throw new Error("AUDIO_BACKUP_MANIFEST_INVALID");
    const [backup] = await bucket.file(copy.backup.name, { generation: copy.backup.generation }).getMetadata();
    if (String(backup.generation) !== copy.backup.generation || String(backup.metageneration) !== copy.backup.metageneration
      || String(backup.size) !== copy.source.size || backup.metadata?.accountDeletionReference !== plan.reference
      || backup.metadata?.sourceGeneration !== item.generation || backup.metadata?.sourceNameSha256 !== inventoryHash(item.name)
      || copy.source.md5Hash && backup.md5Hash !== copy.source.md5Hash || copy.source.crc32c && backup.crc32c !== copy.source.crc32c) throw new Error("AUDIO_BACKUP_CHANGED");
    try {
      const [source] = await bucket.file(item.name, { generation: item.generation }).getMetadata();
      if (String(source.generation) !== item.generation || String(source.metageneration) !== item.metageneration
        || String(source.size) !== copy.source.size || (source.metadata?.ownerUid || source.metadata?.uid) !== plan.uid
        || copy.source.md5Hash && source.md5Hash !== copy.source.md5Hash || copy.source.crc32c && source.crc32c !== copy.source.crc32c) throw new Error("STORAGE_CHANGED_NO_DELETE");
    } catch (error) { if (Number(error.code) !== 404 || originalsRequired) throw error; }
  }
}

async function prepareDeletion({ project, reference, transport, db, auth, bucket, storageBackups = [], backupOperation, now = Date.now }) {
  const inventory = await buildInventory({ project, reference, transport, getUser: uid => auth.getUser(uid) });
  checkInventory(inventory, project);
  const guard = await assertPaused({ db, auth, inventory, now });
  const transforms = [];
  for (const review of inventory.review) {
    const record = await db.doc(review.path).get();
    if (!record.exists) throw new Error("REVIEW_RECORD_CHANGED");
    if (review.reason === "replay-ledger-review" && record.get("completed") !== true) throw new Error("UNFINISHED_LEDGER_REQUIRES_REVIEW");
    if (review.reason === "replay-ledger-review" && (record.get("cursor") !== inventory.uid
      || ["ownerUid", "uid", "userId", "authorUid"].some(field => record.get(field) === inventory.uid))) throw new Error("LEDGER_IDENTITY_REQUIRES_REVIEW");
    transforms.push({ path: review.path, updateTime: record.updateTime.toDate().toISOString().replace(/\.\d{3}Z$/, `.${String(record.updateTime.nanoseconds).padStart(9, "0")}Z`),
      kind: review.reason === "replay-ledger-review" ? "clear-completed-cursor" : "remove-outbox-recipient" });
  }
  const plan = { schemaVersion: 1, mode: "prepared-account-deletion", project, reference, uid: inventory.uid,
    auth: inventory.auth, accountRequestUpdateTime: inventory.accountRequestUpdateTime,
    generatedAt: new Date(now()).toISOString(), backupOperation, frozenAt: guard.get("frozenAt").toMillis(),
    candidates: inventory.candidates, storageCandidates: inventory.storageCandidates, storageBackups, transforms,
    counts: inventory.counts, requiresSpecificScopeApproval: true, retainedPrivateGuard: true,
    excludesLocalNotesAndProviderAnalytics: true };
  await verifyAudioBackups({ plan, bucket, originalsRequired: true });
  return plan;
}

function validatePlan(text, project, expectedHash) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash || "") || inventoryHash(text) !== expectedHash) throw new Error("PLAN_HASH_MISMATCH");
  const plan = JSON.parse(text);
  if (plan.mode !== "prepared-account-deletion" || plan.schemaVersion !== 1 || plan.project !== project
    || requestReference(plan.uid) !== plan.reference || plan.auth?.uid !== plan.uid || plan.auth.disabled !== true
    || plan.auth.privileged || plan.requiresSpecificScopeApproval !== true || !Number.isFinite(plan.frozenAt)
    || !Array.isArray(plan.candidates) || !Array.isArray(plan.transforms) || !Array.isArray(plan.storageCandidates)
    || !Array.isArray(plan.storageBackups) || plan.storageBackups.length !== plan.storageCandidates.length) throw new Error("PLAN_INVALID");
  const paths = new Set();
  for (const item of [...plan.candidates, ...plan.transforms]) {
    if (typeof item.path !== "string" || paths.has(item.path)
      || !item.path.split("/").every(part => part && part !== "." && part !== ".." && !/[\u0000-\u001f\u007f]/.test(part))
      || item.path.split("/").length % 2 || !validTimestamp(item.updateTime)) throw new Error("PLAN_PATH_OR_VERSION_INVALID");
    paths.add(item.path);
  }
  if (plan.candidates.length + plan.transforms.length > 20000 || plan.candidates.some(item => !deletableCollections.has(item.path.split("/")[0]))
    || plan.transforms.some(item => item.kind === "clear-completed-cursor" ? !/^communityActivityEvents\/[^/]+$/.test(item.path)
      : item.kind === "remove-outbox-recipient" ? !/^communityActivityDeliveries\/[^/]+$/.test(item.path) : true)) throw new Error("PLAN_INVALID");
  const files = new Set();
  for (const item of plan.storageCandidates) {
    if (typeof item.name !== "string" || !item.name.startsWith("community/audio/") || !item.name.split("/").every(part => part && part !== "." && part !== "..")
      || !/^\d+$/.test(item.generation || "") || !/^\d+$/.test(item.metageneration || "") || files.has(`${item.name}:${item.generation}`)) throw new Error("STORAGE_PLAN_INVALID");
    files.add(`${item.name}:${item.generation}`);
  }
  return { plan, hash: expectedHash };
}

function deletionUnits(plan) {
  const units = new Map();
  for (const item of plan.candidates) {
    const [collection, id] = item.path.split("/");
    const pair = { communityPosts: "post", communityPostPrivate: "post", communityReplies: "reply", communityReplyPrivate: "reply", communityPrayerRequests: "prayer", communityPrayerPrivate: "prayer" }[collection];
    const key = pair ? `${pair}:${id}` : item.path;
    if (!units.has(key)) units.set(key, []);
    units.get(key).push(item);
  }
  return [...units.entries()].sort(([a], [b]) => Number(!/^(post|prayer):/.test(a)) - Number(!/^(post|prayer):/.test(b)) || a.localeCompare(b)).map(([, items]) => items);
}

async function verifyRemainingData({ plan, db, auth, transport, authMustBeAbsent = false }) {
  const getUser = async uid => {
    if (!authMustBeAbsent) return auth.getUser(uid);
    try { await auth.getUser(uid); }
    catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      // The approved guard anchors the UID; this adapter proves Auth absence twice during the inventory.
      return { uid, disabled: true, customClaims: {} };
    }
    throw new Error("AUTH_ACCOUNT_REMAINS");
  };
  const inventory = await buildInventory({ project: plan.project, reference: plan.reference, transport, getUser });
  checkInventory(inventory, plan.project);
  if (inventory.candidates.length || inventory.storageCandidates.length || inventory.review.length) throw new Error("REMAINING_DATA_REQUIRES_REVIEW");
  for (const item of plan.candidates) {
    if ((await db.doc(item.path).get()).exists || (await db.doc(item.path).listCollections()).length) throw new Error("REMAINING_APPROVED_DATA");
  }
  const ownedPosts = new Set(plan.candidates.filter(item => /^community(PostPrivate|Posts)\//.test(item.path)).map(item => item.path.split("/")[1]));
  for (const id of ownedPosts) {
    for (const collection of ["communityReplies", "communityReactions", "notifications", "savedPosts", "favoritePosts"]) {
      if (!(await db.collection(collection).where("postId", "==", id).limit(1).get()).empty) throw new Error("LATE_ASSOCIATED_RECORD_REQUIRES_NEW_APPROVAL");
    }
  }
  for (const item of plan.candidates.filter(item => /^communityPrayer(Requests|Private)\//.test(item.path))) {
    if (!(await db.collection("communityPrayerCommitments").where("requestId", "==", item.path.split("/")[1]).limit(1).get()).empty) throw new Error("LATE_ASSOCIATED_RECORD_REQUIRES_NEW_APPROVAL");
  }
}

async function completeRequest({ validated, db, transaction }) {
  const { plan, hash } = validated, guard = guardRef(db, plan.uid), request = db.doc(`accountDeletionRequests/${plan.reference}`);
  const [lock, pending, moderator] = await transaction.getAll(guard, request, db.doc("communityConfiguration/moderation"));
  if (lock.get("status") !== "deleting" || lock.get("planHash") !== hash || lock.get("reference") !== plan.reference
    || lock.get("authDeletionStarted") !== true || pending.get("uid") !== plan.uid || pending.get("status") !== "pending"
    || !sameVersion(pending.updateTime, plan.accountRequestUpdateTime) || moderator.get("moderatorUid") === plan.uid) throw new Error("ACCOUNT_OR_REQUEST_CHANGED");
  transaction.set(request, { status: "completed", completedAt: FieldValue.serverTimestamp() });
  transaction.update(guard, { status: "completed", completedAt: FieldValue.serverTimestamp() });
}

async function finalizeDeletion({ validated, db, auth, transport, bucket, record }) {
  if (typeof record !== "function") throw new Error("DURABLE_PRIVATE_JOURNAL_REQUIRED");
  await requireSupport(db);
  const { plan, hash } = validated, guard = await guardRef(db, plan.uid).get();
  if (guard.get("status") !== "deleting" || guard.get("planHash") !== hash || guard.get("authDeletionStarted") !== true) throw new Error("AUTHORIZED_AUTH_DELETION_REQUIRED");
  await verifyAudioBackups({ plan, bucket });
  await verifyRemainingData({ plan, db, auth, transport, authMustBeAbsent: true });
  record({ phase: "finalization-attempt", remoteDeletions: 0 });
  await db.runTransaction(transaction => completeRequest({ validated, db, transaction }));
  record({ phase: "finalization-complete", remoteDeletions: 0 });
  return { completed: true, remoteDeletions: 0, retainedPrivateGuard: true };
}

async function assertScope(plan, fresh, firstExecution) {
  checkInventory(fresh, plan.project);
  const approved = new Map(plan.candidates.map(item => [item.path, item.updateTime]));
  const transforms = new Map(plan.transforms.map(item => [item.path, item]));
  for (const item of fresh.candidates) if (approved.get(item.path) !== item.updateTime) throw new Error("UNAPPROVED_OR_CHANGED_RECORD");
  for (const item of fresh.review) if (!transforms.has(item.path)) throw new Error("UNAPPROVED_REVIEW_RECORD");
  const storage = new Set(plan.storageCandidates.map(item => JSON.stringify(item)));
  for (const item of fresh.storageCandidates) if (!storage.has(JSON.stringify(item))) throw new Error("UNAPPROVED_STORAGE_VERSION");
  if (firstExecution && (fresh.candidates.length !== plan.candidates.length || fresh.review.length !== plan.transforms.length
    || fresh.storageCandidates.length !== plan.storageCandidates.length)) throw new Error("PLAN_SCOPE_MISMATCH");
}

async function executeDeletion({ validated, db, auth, transport, bucket, backup, record, now = Date.now }) {
  const { plan, hash } = validated;
  if (typeof record !== "function") throw new Error("DURABLE_PRIVATE_JOURNAL_REQUIRED");
  validateBackup(backup, { plan }, now());
  if (backup.metadata?.collectionIds !== undefined && (!Array.isArray(backup.metadata.collectionIds) || backup.metadata.collectionIds.length)) throw new Error("FULL_FIRESTORE_BACKUP_REQUIRED");
  const guard = await assertPaused({ db, auth, inventory: plan, now });
  if (guard.get("frozenAt").toMillis() !== plan.frozenAt || guard.get("planHash") && guard.get("planHash") !== hash) throw new Error("ACCOUNT_GUARD_CHANGED");
  const fresh = await buildInventory({ project: plan.project, reference: plan.reference, transport, getUser: uid => auth.getUser(uid) });
  await assertScope(plan, fresh, !guard.get("planHash"));
  await verifyAudioBackups({ plan, bucket, originalsRequired: !guard.get("planHash") });
  const guardReference = guardRef(db, plan.uid);
  await db.runTransaction(async transaction => {
    const lock = await transaction.get(guardReference);
    if (lock.get("reference") !== plan.reference || lock.get("frozenAt")?.toMillis() !== plan.frozenAt
      || !["frozen", "deleting"].includes(lock.get("status")) || lock.get("planHash") && lock.get("planHash") !== hash) throw new Error("ACCOUNT_GUARD_CHANGED");
    transaction.update(guardReference, { status: "deleting", planHash: hash });
  });
  const checkLock = async transaction => {
    const [lock, request, moderator] = await transaction.getAll(guardReference, db.doc(`accountDeletionRequests/${plan.reference}`), db.doc("communityConfiguration/moderation"));
    if (lock.get("planHash") !== hash || lock.get("status") !== "deleting" || request.get("uid") !== plan.uid
      || request.get("status") !== "pending" || !sameVersion(request.updateTime, plan.accountRequestUpdateTime)
      || moderator.get("moderatorUid") === plan.uid) throw new Error("ACCOUNT_OR_REQUEST_CHANGED");
  };
  const units = deletionUnits(plan);
  let deleted = 0;
  for (let offset = 0; offset < units.length; offset += 40) {
    const items = units.slice(offset, offset + 40).flat();
    record({ phase: "firestore-attempt", batch: offset / 40, planned: items.length });
    const removed = await db.runTransaction(async transaction => {
      await checkLock(transaction);
      const rows = await transaction.getAll(...items.map(item => db.doc(item.path)));
      const adjustments = new Map();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], item = items[i];
        if (!row.exists) continue;
        if (!sameVersion(row.updateTime, item.updateTime)) throw new Error("RECORD_CHANGED_NO_DELETE");
        const collection = item.path.split("/")[0];
        const counter = collection === "communityReplies" ? ["communityPosts", row.get("postId"), "replyCount"]
          : collection === "communityPrayerCommitments" ? ["communityPrayerRequests", row.get("requestId"), "prayingCount"] : null;
        if (counter && /^[A-Za-z0-9_-]{1,128}$/.test(counter[1] || "")) {
          const path = `${counter[0]}/${counter[1]}`;
          const value = adjustments.get(path) || { field: counter[2], count: 0 }; value.count++; adjustments.set(path, value);
        } else if (counter) throw new Error("COUNTER_PARENT_INVALID");
      }
      const parents = adjustments.size ? await transaction.getAll(...[...adjustments.keys()].map(path => db.doc(path))) : [];
      for (const parent of parents) {
        if (!parent.exists || items.some(item => item.path === parent.ref.path)) continue;
        const adjustment = adjustments.get(parent.ref.path), count = parent.get(adjustment.field);
        if (!Number.isInteger(count) || count < adjustment.count) throw new Error("COUNTER_REPAIR_REQUIRED");
      }
      for (const parent of parents) {
        if (!parent.exists || items.some(item => item.path === parent.ref.path)) continue;
        const adjustment = adjustments.get(parent.ref.path);
        transaction.update(parent.ref, { [adjustment.field]: parent.get(adjustment.field) - adjustment.count });
      }
      rows.filter(row => row.exists).forEach(row => transaction.delete(row.ref));
      return rows.filter(row => row.exists).length;
    });
    deleted += removed;
    record({ phase: "firestore-complete", batch: offset / 40, deleted: removed });
  }
  const ownedPosts = new Set(plan.candidates.filter(item => /^community(PostPrivate|Posts)\//.test(item.path)).map(item => item.path.split("/")[1]));
  for (const item of plan.transforms) {
    record({ phase: "redaction-attempt", kind: item.kind });
    await db.runTransaction(async transaction => {
      await checkLock(transaction);
      const row = await transaction.get(db.doc(item.path));
      if (!row.exists) return;
      const needsChange = item.kind === "clear-completed-cursor" ? row.get("cursor") === plan.uid
        : (row.get("updates") || []).some(update => update.uid === plan.uid) || ownedPosts.has(row.get("postId"));
      if (!needsChange) return;
      if (!sameVersion(row.updateTime, item.updateTime)) throw new Error("OUTBOX_OR_LEDGER_CHANGED");
      if (item.kind === "clear-completed-cursor") {
        if (row.get("completed") !== true) throw new Error("UNFINISHED_LEDGER_REQUIRES_REVIEW");
        transaction.update(row.ref, { cursor: FieldValue.delete() });
      } else {
        transaction.update(row.ref, { updates: (row.get("updates") || []).filter(update => update.uid !== plan.uid),
          ...(ownedPosts.has(row.get("postId")) ? { postId: FieldValue.delete() } : {}) });
      }
    });
    record({ phase: "redaction-complete", kind: item.kind });
  }
  for (const item of plan.storageCandidates) {
    const file = bucket.file(item.name, { generation: item.generation,
      preconditionOpts: { ifGenerationMatch: item.generation, ifMetagenerationMatch: item.metageneration } });
    record({ phase: "storage-attempt", generation: item.generation });
    try {
      const [metadata] = await file.getMetadata();
      if (metadata.generation !== item.generation || metadata.metageneration !== item.metageneration
        || (metadata.metadata?.ownerUid || metadata.metadata?.uid) !== plan.uid) throw new Error("STORAGE_CHANGED_NO_DELETE");
      await file.delete();
    } catch (error) { if (Number(error.code) !== 404) throw error; }
    record({ phase: "storage-complete", generation: item.generation });
  }
  await verifyRemainingData({ plan, db, auth, transport });
  await verifyAudioBackups({ plan, bucket });
  await assertPaused({ db, auth, inventory: plan, now });
  record({ phase: "auth-delete-attempt", firestoreVerified: true, storageVerified: true });
  await db.runTransaction(async transaction => {
    await checkLock(transaction);
    transaction.update(guardReference, { authDeletionStarted: true });
  });
  await auth.deleteUser(plan.uid);
  try { await auth.getUser(plan.uid); throw new Error("AUTH_ACCOUNT_REMAINS"); }
  catch (error) { if (error.code !== "auth/user-not-found") throw error; }
  await db.runTransaction(transaction => completeRequest({ validated, db, transaction }));
  record({ phase: "account-complete", deleted, storageVersions: plan.storageCandidates.length });
  return { completed: true, deleted, storageVersions: plan.storageCandidates.length, retainedPrivateGuard: true };
}

module.exports = { SUPPORT_VERSION, sameVersion, checkInventory, requireSupport, freezeAccount, prepareDeletion, validatePlan, deletionUnits, executeDeletion, finalizeDeletion };
