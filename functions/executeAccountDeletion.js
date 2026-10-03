"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { createReadTransport, inventoryHash, buildInventory } = require("./accountDeletionInventory");
const { writePrivateInventory } = require("./inventoryAccountDeletion");
const { createTransport, validateBackup } = require("./communityOrphanCleanup");
const { checkInventory, freezeAccount, prepareDeletion, validatePlan, executeDeletion, finalizeDeletion } = require("./accountDeletionExecution");

function parseArgs(args) {
  const fields = ["project", "confirm-project", "request", "inventory", "inventory-sha256", "plan", "plan-sha256", "backup-operation", "storage-backup-manifest", "out", "report", "confirm-records", "confirm-storage-versions", "firebase-cli-auth-module"];
  const flags = ["--freeze", "--prepare", "--execute", "--finalize", "--apply"];
  if (args.some(arg => !flags.includes(arg) && !fields.some(name => arg.startsWith(`--${name}=`)))
    || new Set(args.map(arg => arg.split("=")[0])).size !== args.length) throw new Error("INVALID_ARGUMENT");
  const value = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const project = value("project"), cliModule = value("firebase-cli-auth-module"), apply = args.includes("--apply");
  const modes = ["freeze", "prepare", "execute", "finalize"].filter(mode => args.includes(`--${mode}`));
  if (modes.length !== 1 || !/^[a-z][a-z0-9-]{4,62}$/.test(project || "") || value("confirm-project") !== project || !cliModule) throw new Error("CONFIRMED_PROJECT_AND_MODE_REQUIRED");
  const mode = modes[0];
  if (mode === "freeze" ? !value("inventory") || !/^[a-f0-9]{64}$/.test(value("inventory-sha256") || "")
    : mode === "prepare" ? apply || !/^[a-f0-9]{64}$/.test(value("request") || "") || !value("out") || !value("backup-operation")
      : !value("plan") || !/^[a-f0-9]{64}$/.test(value("plan-sha256") || "")) throw new Error("MODE_INPUT_INVALID");
  if (apply && !value("report")) throw new Error("PRIVATE_JOURNAL_REQUIRED");
  if (mode === "finalize" && !apply) throw new Error("FINALIZATION_REQUIRES_EXPLICIT_APPLY");
  if (mode === "execute" && apply && (!/^\d+$/.test(value("confirm-records") || "") || !/^\d+$/.test(value("confirm-storage-versions") || ""))) throw new Error("EXACT_SCOPE_CONFIRMATION_REQUIRED");
  return { project, cliModule, mode, apply, value };
}

function privatePath(file) {
  const directory = path.resolve(__dirname, "../artifacts/validation");
  if (typeof file !== "string" || !path.isAbsolute(file) || path.dirname(file) !== directory
    || !/^[A-Za-z0-9_-]+\.(json|jsonl)$/.test(path.basename(file)) || fs.realpathSync(directory) !== directory) throw new Error("PRIVATE_ARTIFACT_PATH_REQUIRED");
  return file;
}

function privateRead(file) {
  privatePath(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 32000000 || stat.mode & 0o077) throw new Error("PRIVATE_FILE_REQUIRED");
    return fs.readFileSync(fd, "utf8");
  } finally { fs.closeSync(fd); }
}

function openJournal(file) {
  const fd = fs.openSync(privatePath(file), "wx", 0o600);
  return { record: value => { fs.writeFileSync(fd, JSON.stringify({ at: new Date().toISOString(), ...value }) + "\n"); fs.fsyncSync(fd); },
    close: () => fs.closeSync(fd) };
}

async function main(args = process.argv.slice(2)) {
  const { project, cliModule, mode, apply, value } = parseArgs(args);
  if (project.startsWith("demo-") || ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"].some(key => process.env[key])) throw new Error("PRODUCTION_CLI_FORBIDS_EMULATOR_ENVIRONMENT");
  const text = mode === "freeze" ? privateRead(value("inventory")) : ["execute", "finalize"].includes(mode) ? privateRead(value("plan")) : null;
  let inventory, validated;
  if (mode === "freeze") {
    if (inventoryHash(text) !== value("inventory-sha256")) throw new Error("INVENTORY_HASH_MISMATCH");
    inventory = JSON.parse(text); checkInventory(inventory, project);
  }
  if (["execute", "finalize"].includes(mode)) {
    validated = validatePlan(text, project, value("plan-sha256"));
    if (mode === "execute" && apply && (Number(value("confirm-records")) !== validated.plan.candidates.length + validated.plan.transforms.length
      || Number(value("confirm-storage-versions")) !== validated.plan.storageCandidates.length)) throw new Error("SCOPE_COUNT_MISMATCH");
  }
  const cli = require(cliModule), account = cli.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error("FIREBASE_CLI_LOGIN_REQUIRED");
  const getToken = async () => (await cli.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"])).access_token;
  const app = initializeApp({ projectId: project, storageBucket: `${project}.firebasestorage.app`,
    credential: { getAccessToken: async () => ({ access_token: await getToken(), expires_in: 3600 }) } });
  const db = getFirestore(app), auth = getAuth(app), transport = createReadTransport(project, { getToken });
  let journal;
  try {
    if (mode === "freeze") {
      const fresh = await buildInventory({ project, reference: inventory.reference, transport, getUser: uid => auth.getUser(uid) });
      checkInventory(fresh, project);
      if (JSON.stringify(fresh.candidates) !== JSON.stringify(inventory.candidates) || fresh.accountRequestUpdateTime !== inventory.accountRequestUpdateTime
        || JSON.stringify(fresh.auth) !== JSON.stringify(inventory.auth)) throw new Error("INVENTORY_CHANGED");
      if (!apply) { console.log(JSON.stringify({ mode: "dry-run-freeze", remoteWrites: 0, accountDeleted: false })); return; }
      journal = openJournal(value("report")); journal.record({ phase: "freeze-attempt", inventoryHash: inventoryHash(text) });
      const result = await freezeAccount({ inventory: fresh, project, db, auth });
      journal.record({ phase: "freeze-complete", ...result }); console.log(JSON.stringify(result)); return;
    }
    if (mode === "prepare") {
      const storageBackups = value("storage-backup-manifest") ? JSON.parse(privateRead(value("storage-backup-manifest"))) : [];
      const plan = await prepareDeletion({ project, reference: value("request"), transport, db, auth, bucket: getStorage(app).bucket(), storageBackups, backupOperation: value("backup-operation") });
      const operation = await createTransport(project, { getToken }).backup(plan.backupOperation);
      validateBackup(operation, { plan });
      const output = JSON.stringify(plan, null, 2) + "\n"; writePrivateInventory(value("out"), output);
      console.log(JSON.stringify({ mode: plan.mode, records: plan.candidates.length, redactions: plan.transforms.length,
        storageVersions: plan.storageCandidates.length, planSha256: inventoryHash(output), remoteWrites: 0 })); return;
    }
    if (mode === "finalize") {
      journal = openJournal(value("report")); journal.record({ phase: "finalization-start", planHash: validated.hash });
      console.log(JSON.stringify(await finalizeDeletion({ validated, db, auth, transport, bucket: getStorage(app).bucket(), record: journal.record }))); return;
    }
    const backup = await createTransport(project, { getToken }).backup(validated.plan.backupOperation);
    validateBackup(backup, validated);
    if (!apply) {
      const fresh = await prepareDeletion({ project, reference: validated.plan.reference, transport, db, auth,
        bucket: getStorage(app).bucket(), storageBackups: validated.plan.storageBackups, backupOperation: validated.plan.backupOperation });
      if (JSON.stringify(fresh.candidates) !== JSON.stringify(validated.plan.candidates) || JSON.stringify(fresh.transforms) !== JSON.stringify(validated.plan.transforms)
        || JSON.stringify(fresh.storageCandidates) !== JSON.stringify(validated.plan.storageCandidates)) throw new Error("PLAN_CHANGED");
      console.log(JSON.stringify({ mode: "dry-run-deletion", records: fresh.candidates.length, redactions: fresh.transforms.length, storageVersions: fresh.storageCandidates.length, remoteWrites: 0 })); return;
    }
    journal = openJournal(value("report")); journal.record({ phase: "execution-start", planHash: validated.hash });
    console.log(JSON.stringify(await executeDeletion({ validated, db, auth, transport, bucket: getStorage(app).bucket(), backup, record: journal.record })));
  } finally { journal?.close(); await db.terminate(); }
}

if (require.main === module) main().catch(error => { console.error(error.code ? "ACCOUNT_DELETION_FAILED_REVIEW_PRIVATE_JOURNAL" : error.message); process.exitCode = 1; });
module.exports = { parseArgs, privateRead, openJournal, main };
