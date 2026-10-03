"use strict";

const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");
const { sameVersion, validatePlan, checkInventory, deletionUnits } = require("./accountDeletionExecution");
const { requestReference, inventoryHash } = require("./accountDeletionInventory");
const { parseArgs } = require("./executeAccountDeletion");

const project = "demo-deletion-execution", uid = "fixture", reference = requestReference(uid);
const plan = { schemaVersion: 1, mode: "prepared-account-deletion", project, uid, reference,
  auth: { uid, disabled: true, privileged: false }, frozenAt: 1, requiresSpecificScopeApproval: true,
  candidates: [{ path: "communityPosts/fixture", updateTime: "2026-10-02T01:00:00.123456789Z" },
    { path: "communityPostPrivate/fixture", updateTime: "2026-10-02T01:00:00Z" }], transforms: [], storageCandidates: [], storageBackups: [] };
const validate = input => { const text = JSON.stringify(input); return validatePlan(text, project, inventoryHash(text)); };

assert(sameVersion(new Timestamp(Date.parse("2026-10-02T01:00:00Z") / 1000, 123456789), plan.candidates[0].updateTime));
assert(!sameVersion(new Timestamp(Date.parse("2026-10-02T01:00:00Z") / 1000, 123456788), plan.candidates[0].updateTime));
assert.equal(validate(plan).plan.uid, uid);
assert.equal(deletionUnits(plan).length, 1, "Public/private identities must stay in one transaction");
assert.throws(() => validatePlan(JSON.stringify(plan), project, "0".repeat(64)), /HASH_MISMATCH/);
for (const changed of [{ ...plan, project: "different-project" }, { ...plan, reference: "0".repeat(64) },
  { ...plan, auth: { ...plan.auth, privileged: true } }, { ...plan, auth: { ...plan.auth, disabled: false } },
  { ...plan, candidates: [...plan.candidates, plan.candidates[0]] },
  { ...plan, candidates: [{ ...plan.candidates[0], path: "communityReports/private" }] },
  { ...plan, candidates: [{ ...plan.candidates[0], path: "userProfiles/../private" }] },
  { ...plan, candidates: [{ ...plan.candidates[0], path: "communityConfiguration/moderation" }] },
  { ...plan, candidates: [{ ...plan.candidates[0], updateTime: "invalid" }] },
  { ...plan, transforms: [{ path: "userProfiles/other", updateTime: plan.candidates[0].updateTime, kind: "remove-outbox-recipient" }] },
  { ...plan, storageCandidates: [{ name: "private-backups/real", generation: "1", metageneration: "1" }] }]) assert.throws(() => validate(changed));
assert.throws(() => checkInventory({ mode: "read-only-account-inventory", schemaVersion: 1, project, uid, reference, auth: { uid },
  candidates: [], review: [{ reason: "report-retention-and-redaction-review" }] }, project), /MANUAL_REVIEW/);
const base = [`--project=${project}`, `--confirm-project=${project}`, "--firebase-cli-auth-module=fixture", "--execute", "--plan=fixture", `--plan-sha256=${"a".repeat(64)}`];
assert.equal(parseArgs(base).apply, false);
for (const extra of [["--apply"], ["--prepare"], ["--execute"], ["--skip-guards"], ["--apply", "--report=fixture"]]) assert.throws(() => parseArgs([...base, ...extra]));
console.log("OK: nanosecond preconditions, bound project/request, private pairs, forbidden scope, strict dry-run and exact apply confirmations");
