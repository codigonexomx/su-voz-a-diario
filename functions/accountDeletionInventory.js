"use strict";

const { createHash } = require("node:crypto");

const COLLECTIONS = Object.freeze([
  "accountDeletionRequests", "communityConfiguration", "communityPosts", "communityPostPrivate",
  "communityReplies", "communityReplyPrivate", "communityPrayerRequests", "communityPrayerPrivate",
  "communityPrayerCommitments", "communityReactions", "communityProfiles", "communityNames",
  "userProfiles", "userActivity", "userMetrics", "communityClock", "pushTokens", "notifications",
  "savedPosts", "favoritePosts", "communityTerms", "communityRateLimits", "communityBlocks",
  "communityReports", "communityActivityEvents", "communityActivityDeliveries", "communityDeletionJobs",
]);
const DIRECT = new Set(["communityProfiles", "userProfiles", "userActivity", "userMetrics", "communityClock", "communityTerms"]);
const OWNER_BY_COLLECTION = Object.freeze({ communityNames: "uid", pushTokens: "uid", notifications: "userId",
  communityReactions: "userId", communityPrayerCommitments: "ownerUid", savedPosts: "userId", favoritePosts: "userId" });
const RATE_ACTIONS = ["post", "reply", "prayer", "report", "block", "bible", "account"];
const OWNER_FIELDS = ["ownerUid", "uid", "userId", "authorUid"];
const MASK = [...OWNER_FIELDS, "reportedBy", "resolvedBy", "postId", "requestId", "type", "id", "cursor", "updates", "status", "moderatorUid"];
const validProject = value => typeof value === "string" && /^[a-z][a-z0-9-]{4,62}$/.test(value);
const validUid = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const requestReference = uid => createHash("sha256").update(`account-deletion:${uid}`).digest("hex");
const inventoryHash = text => createHash("sha256").update(text).digest("hex");
const validSegment = value => typeof value === "string" && value.length > 0 && value !== "." && value !== ".." && !/[\/\u0000-\u001f\u007f]/.test(value);
const validPath = path => typeof path === "string" && path.split("/").every(validSegment);

function decodeValue(value) {
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "booleanValue")) return value.booleanValue;
  if (Object.hasOwn(value, "nullValue")) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeValue);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeValue(item)]));
  return undefined;
}

function authSummary(user) {
  return { uid: user.uid, disabled: user.disabled === true, emailVerified: user.emailVerified === true,
    linked: Boolean(user.email), emailDigest: user.email ? inventoryHash(user.email.toLowerCase()) : null,
    privileged: user.customClaims?.moderator === true || user.customClaims?.admin === true };
}

async function buildInventory({ project, reference, transport, getUser, now = () => new Date().toISOString(), maxDocuments = 20000 }) {
  if (!validProject(project) || !/^[a-f0-9]{64}$/.test(reference || "")) throw new Error("PROJECT_OR_REQUEST_INVALID");
  if (!Number.isInteger(maxDocuments) || maxDocuments < 1 || maxDocuments > 20000) throw new Error("INVENTORY_LIMIT_INVALID");
  const requestPath = `accountDeletionRequests/${reference}`;
  const request = await transport.get(requestPath);
  if (!request || request.data.status !== "pending" || !validUid(request.data.uid) || requestReference(request.data.uid) !== reference
    || typeof request.updateTime !== "string" || !Number.isFinite(Date.parse(request.updateTime))) {
    throw new Error("AUTHENTICATED_PENDING_REQUEST_REQUIRED");
  }
  const uid = request.data.uid, user = authSummary(await getUser(uid));
  const moderator = await transport.get("communityConfiguration/moderation");
  if (user.uid !== uid || user.privileged || moderator?.data.moderatorUid === uid) throw new Error("PROTECTED_ADMIN_ACCOUNT");
  const startedAt = now(), roots = await transport.collections("");
  const review = [], candidates = new Map(), documents = new Map(), visited = new Set(), counted = new Set(), scanParents = new Set();
  const counters = new Map(), storage = [];
  const flag = (path, reason) => { review.push({ path, reason }); if (documents.has(path)) scanParents.add(path); };
  const remember = record => {
    if (!record || !validPath(record.path) || record.path.split("/").length % 2 !== 0 || !record.data || typeof record.data !== "object") throw new Error("DOCUMENT_INVALID");
    if (!counted.has(record.path)) { counted.add(record.path); if (counted.size > maxDocuments) throw new Error("INVENTORY_LIMIT_EXCEEDED"); }
    if (record.updateTime && (!Number.isFinite(Date.parse(record.updateTime)) || typeof record.updateTime !== "string")) throw new Error("DOCUMENT_TIMESTAMP_INVALID");
    documents.set(record.path, record);
    return record;
  };
  const add = (record, reason) => {
    if (!record) return;
    scanParents.add(record.path);
    if (!record.updateTime) { flag(record.path, "missing-parent-document"); return; }
    if (!candidates.has(record.path)) candidates.set(record.path, { path: record.path, updateTime: record.updateTime, reason });
  };
  if (!Array.isArray(roots) || roots.length > 100 || roots.some(id => !validSegment(id)) || new Set(roots).size !== roots.length) throw new Error("ROOT_COLLECTIONS_INVALID");
  for (const collection of roots) {
    if (!COLLECTIONS.includes(collection)) { flag(collection, "unreviewed-root-collection"); continue; }
    for (const record of await transport.list(collection)) {
      if (record.path.split("/").length !== 2 || record.path.split("/")[0] !== collection) throw new Error("COLLECTION_READ_INVALID");
      remember(record);
    }
  }
  const rootsOf = collection => [...documents.values()].filter(item => item.path.split("/").length === 2 && item.path.startsWith(collection + "/"));
  const ownIds = (collection, privateCollection) => {
    const ids = new Set();
    for (const record of [...rootsOf(collection), ...rootsOf(privateCollection)]) {
      const owners = OWNER_FIELDS.map(key => record.data[key]).filter(value => typeof value === "string" && value);
      if (owners.includes(uid)) ids.add(record.path.split("/")[1]);
    }
    for (const id of ids) {
      const pair = [documents.get(`${collection}/${id}`), documents.get(`${privateCollection}/${id}`)].filter(Boolean);
      const owners = new Set(pair.flatMap(record => OWNER_FIELDS.map(key => record.data[key]).filter(value => typeof value === "string" && value)));
      if (owners.size > 1) { flag(`${collection}/${id}`, "conflicting-ownership"); ids.delete(id); continue; }
      pair.forEach(record => add(record, "owned-content"));
    }
    return ids;
  };
  const postIds = ownIds("communityPosts", "communityPostPrivate");
  const replyIds = ownIds("communityReplies", "communityReplyPrivate");
  const prayerIds = ownIds("communityPrayerRequests", "communityPrayerPrivate");
  for (const record of documents.values()) {
    const [collection, id] = record.path.split("/"), data = record.data;
    if (collection === "accountDeletionRequests" || collection === "communityConfiguration") continue;
    const directOwned = DIRECT.has(collection) && id === uid;
    const owned = directOwned || Object.hasOwn(OWNER_BY_COLLECTION, collection) && data[OWNER_BY_COLLECTION[collection]] === uid;
    if (directOwned) scanParents.add(record.path);
    if (["communityPosts", "communityPostPrivate", "communityReplies", "communityReplyPrivate", "communityPrayerRequests", "communityPrayerPrivate"].includes(collection)) continue;
    if (collection === "communityReports") {
      if (data.reportedBy === uid || data.resolvedBy === uid || data.type === "post" && postIds.has(data.id) || data.type === "reply" && replyIds.has(data.id) || data.type === "prayer" && prayerIds.has(data.id)) flag(record.path, "report-retention-and-redaction-review");
      continue;
    }
    if (collection === "communityActivityDeliveries") {
      if (Array.isArray(data.updates) && data.updates.some(update => update?.uid === uid) || postIds.has(data.postId)) flag(record.path, "shared-outbox-review-preserve-other-recipients");
      continue;
    }
    if (collection === "communityActivityEvents") {
      if (data.cursor === uid || OWNER_FIELDS.some(field => data[field] === uid)) flag(record.path, "replay-ledger-review");
      continue;
    }
    if (collection === "communityDeletionJobs") {
      if (data.ownerUid === uid || postIds.has(id)) flag(record.path, "unfinished-cascade-review");
      continue;
    }
    if (collection === "communityBlocks") continue;
    const rateLimit = collection === "communityRateLimits" && RATE_ACTIONS.some(action => id === `${uid}_${action}`);
    const associated = ["communityReactions", "notifications", "savedPosts", "favoritePosts"].includes(collection) && postIds.has(data.postId)
      || collection === "communityPrayerCommitments" && prayerIds.has(data.requestId);
    if (owned || rateLimit || associated) add(record, associated && !owned ? "associated-with-owned-parent" : "owned-record");
    else if (OWNER_FIELDS.some(field => data[field] === uid)) flag(record.path, "personal-reference-in-other-account-record");
    if (collection === "communityPrayerCommitments" && owned && !prayerIds.has(data.requestId)) counters.set(`prayer:${data.requestId}`, { type: "prayingCount", parentId: data.requestId });
  }
  for (const reply of rootsOf("communityReplies")) {
    if (postIds.has(reply.data.postId)) {
      add(reply, "reply-associated-with-owned-post");
      add(documents.get(`communityReplyPrivate/${reply.path.split("/")[1]}`), "private-reply-associated-with-owned-post");
    } else if (replyIds.has(reply.path.split("/")[1])) counters.set(`post:${reply.data.postId}`, { type: "replyCount", parentId: reply.data.postId });
  }
  // showMissing includes block roots whose parent was removed but whose authors still exist.
  for (const root of rootsOf("communityBlocks")) {
    const rootOwned = root.path === `communityBlocks/${uid}`;
    for (const collection of await transport.collections(root.path)) {
      if (collection !== "authors") { flag(`${root.path}/${collection}`, "unreviewed-block-subcollection"); continue; }
      for (const record of await transport.list(`${root.path}/authors`)) {
        remember(record);
        if (rootOwned || record.path === `${root.path}/authors/${uid}`) add(record, rootOwned ? "owned-block" : "block-targeting-account");
      }
    }
    if (rootOwned && root.updateTime) add(root, "owned-block-root");
  }
  const pendingChildren = [...scanParents];
  for (let index = 0; index < pendingChildren.length; index++) {
    const parent = pendingChildren[index];
    if (visited.has(parent)) continue;
    visited.add(parent);
    for (const collection of await transport.collections(parent)) {
      for (const record of await transport.list(`${parent}/${collection}`)) {
        if (!record.path.startsWith(`${parent}/${collection}/`) || record.path.split("/").length !== parent.split("/").length + 2) throw new Error("NESTED_READ_INVALID");
        remember(record); pendingChildren.push(record.path);
        if (!candidates.has(record.path)) flag(record.path, "unreviewed-nested-document");
      }
    }
  }
  const files = await transport.storage();
  if (!Array.isArray(files) || files.length > maxDocuments) throw new Error("INVENTORY_LIMIT_EXCEEDED");
  const storageVersions = new Set();
  for (const file of files) {
    if (file.ownerUid !== uid && file.uid !== uid) {
      if (!file.ownerUid && !file.uid && file.name?.startsWith("community/audio/") && file.name.endsWith(`-${uid}.webm`)) flag(file.name, "audio-path-without-verified-ownership");
      continue;
    }
    if (file.ownerUid && file.uid && file.ownerUid !== file.uid) { flag(file.name, "conflicting-storage-ownership"); continue; }
    if (!file.name?.startsWith("community/audio/") || !validPath(file.name)) { flag(file.name, "owned-storage-outside-audio-scope"); continue; }
    if (!/^\d+$/.test(file.generation || "") || !/^\d+$/.test(file.metageneration || "")) throw new Error("STORAGE_GENERATION_REQUIRED");
    const version = `${file.name}:${file.generation}`;
    if (storageVersions.has(version)) throw new Error("DUPLICATE_STORAGE_VERSION");
    storageVersions.add(version);
    storage.push({ name: file.name, generation: file.generation, metageneration: file.metageneration });
  }
  const afterRequest = await transport.get(requestPath), afterModerator = await transport.get("communityConfiguration/moderation");
  if (afterRequest?.updateTime !== request.updateTime || afterRequest?.data.status !== "pending" || afterRequest?.data.uid !== uid
    || afterModerator?.updateTime !== moderator?.updateTime || JSON.stringify(authSummary(await getUser(uid))) !== JSON.stringify(user)) throw new Error("ACCOUNT_OR_REQUEST_CHANGED");
  const counts = {};
  for (const candidate of candidates.values()) counts[candidate.path.split("/")[0]] = (counts[candidate.path.split("/")[0]] || 0) + 1;
  for (const counter of counters.values()) if (!validUid(counter.parentId)) flag("counter", "invalid-parent-reference");
  return { schemaVersion: 1, mode: "read-only-account-inventory", project, reference, uid, auth: user, startedAt, completedAt: now(),
    transactionalSnapshot: false, approvedForDeletion: false, requiresFreshOwnershipRecheck: true,
    requiresScopeApproval: true, requiresBackupAndAccessRevocation: true, accountRequestUpdateTime: request.updateTime,
    counts, candidates: [...candidates.values()].sort((a, b) => a.path.localeCompare(b.path)),
    storageCandidates: storage, counterReviews: [...counters.values()], review,
    excludedLocalData: true, excludedProviderManagedAnalytics: true, requiresManagedBackupRetentionReview: true,
    note: "Inventory only. No executable deletion plan, account change, retention decision or guarantee of complete erasure." };
}

function createReadTransport(project, { getToken, host, maxEntries = 20000, requestFetch = fetch } = {}) {
  if (!validProject(project) || host && (!/^127\.0\.0\.1:\d+$/.test(host) || !project.startsWith("demo-"))) throw new Error("LOCAL_DEMO_EMULATOR_REQUIRED");
  const root = `projects/${project}/databases/(default)/documents`, origin = host ? `http://${host}/v1/` : "https://firestore.googleapis.com/v1/";
  const encoded = path => path.split("/").map(encodeURIComponent).join("/");
  const documentUrl = path => { if (path && !validPath(path)) throw new Error("PATH_INVALID"); return origin + root + (path ? "/" + encoded(path) : ""); };
  async function read(url, body, missingAllowed = false) {
    const token = host ? "owner" : await getToken();
    const response = await requestFetch(url, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    if (missingAllowed && response.status === 404) return null;
    if (!response.ok) throw new Error(`INVENTORY_READ_HTTP_${response.status}`);
    return response.json();
  }
  const mask = params => MASK.forEach(field => params.append("mask.fieldPaths", field));
  const normalize = record => {
    if (!record.name?.startsWith(root + "/")) throw new Error("PROJECT_RESPONSE_MISMATCH");
    const path = record.name.slice(root.length + 1);
    if (!validPath(path)) throw new Error("DOCUMENT_PATH_INVALID");
    const data = Object.fromEntries(MASK.filter(key => record.fields?.[key]).map(key => [key, decodeValue(record.fields[key])]));
    if (Array.isArray(data.updates)) data.updates = data.updates.map(item => ({ uid: item?.uid }));
    return { path, updateTime: record.updateTime || null, data };
  };
  async function pages(load, key) {
    const all = [], seen = new Set(); let pageToken;
    do {
      const result = await load(pageToken);
      if (result[key] !== undefined && !Array.isArray(result[key])) throw new Error("PAGINATED_RESPONSE_INVALID");
      all.push(...(result[key] || []));
      if (all.length > maxEntries) throw new Error("INVENTORY_LIMIT_EXCEEDED");
      pageToken = result.nextPageToken;
      if (pageToken && (typeof pageToken !== "string" || seen.has(pageToken))) throw new Error("PAGINATION_INVALID");
      if (pageToken) seen.add(pageToken);
    } while (pageToken);
    return all;
  }
  return {
    get: async path => { const params = new URLSearchParams(); mask(params); const record = await read(documentUrl(path) + "?" + params, undefined, true); return record ? normalize(record) : null; },
    list: async collection => {
      if (!validPath(collection) || collection.split("/").length % 2 !== 1) throw new Error("COLLECTION_PATH_INVALID");
      const items = await pages(pageToken => { const params = new URLSearchParams({ pageSize: "500", showMissing: "true" }); mask(params); if (pageToken) params.set("pageToken", pageToken); return read(documentUrl(collection) + "?" + params); }, "documents");
      const seen = new Set();
      return items.map(record => { const item = normalize(record); if (!item.path.startsWith(collection + "/") || item.path.split("/").length !== collection.split("/").length + 1 || seen.has(item.path)) throw new Error("COLLECTION_RESPONSE_INVALID"); seen.add(item.path); return item; });
    },
    collections: async parent => {
      if (parent && (!validPath(parent) || parent.split("/").length % 2 !== 0)) throw new Error("PARENT_PATH_INVALID");
      const items = await pages(pageToken => read(documentUrl(parent) + ":listCollectionIds", { pageSize: 500, ...(pageToken ? { pageToken } : {}) }), "collectionIds");
      if (items.some(id => !validSegment(id)) || new Set(items).size !== items.length) throw new Error("COLLECTION_IDS_INVALID");
      return items;
    },
    storage: async () => {
      if (host) throw new Error("STORAGE_FIXTURE_REQUIRED_FOR_EMULATOR");
      const bucket = `${project}.firebasestorage.app`;
      const items = await pages(pageToken => { const params = new URLSearchParams({ maxResults: "500", versions: "true", fields: "items(name,generation,metageneration,metadata),nextPageToken" }); if (pageToken) params.set("pageToken", pageToken); return read(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?${params}`); }, "items");
      return items.map(item => ({ name: item.name, generation: item.generation, metageneration: item.metageneration, ownerUid: item.metadata?.ownerUid, uid: item.metadata?.uid }));
    },
  };
}

module.exports = { COLLECTIONS, MASK, requestReference, inventoryHash, authSummary, buildInventory, createReadTransport };
