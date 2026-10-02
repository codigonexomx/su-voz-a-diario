"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { buildInventory, createReadTransport, inventoryHash } = require("./accountDeletionInventory");

function parseArgs(args) {
  const fields = ["project", "confirm-project", "request", "out", "firebase-cli-auth-module"];
  if (args.some(arg => arg !== "--pending-count" && !fields.some(name => arg.startsWith(`--${name}=`))) || new Set(args.map(arg => arg.split("=")[0])).size !== args.length) throw new Error("INVALID_ARGUMENT; read-only, no apply option");
  const value = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const project = value("project"), cliModule = value("firebase-cli-auth-module"), pending = args.includes("--pending-count");
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(project || "") || value("confirm-project") !== project || !cliModule) throw new Error("CONFIRMED_PROJECT_AND_AUTH_REQUIRED");
  if (pending ? value("request") || value("out") : !/^[a-f0-9]{64}$/.test(value("request") || "") || !value("out")) throw new Error("ONE_READ_ONLY_MODE_REQUIRED");
  return { project, cliModule, pending, reference: value("request"), output: value("out") };
}

function validateOutput(output) {
  const directory = path.resolve(__dirname, "../artifacts/validation");
  if (!path.isAbsolute(output) || path.dirname(output) !== directory || !/^[A-Za-z0-9_-]+\.json$/.test(path.basename(output))) throw new Error("PRIVATE_ARTIFACT_PATH_REQUIRED");
  if (fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory) !== directory) throw new Error("PRIVATE_ARTIFACT_DIRECTORY_REQUIRED");
}

function writePrivateInventory(output, data) {
  validateOutput(output);
  const fd = fs.openSync(output, "wx", 0o600);
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

async function main(args = process.argv.slice(2)) {
  const { project, cliModule, pending, reference, output } = parseArgs(args);
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error("PRODUCTION_CLI_FORBIDS_EMULATOR_ENVIRONMENT");
  if (!pending) validateOutput(output);
  const cli = require(cliModule), account = cli.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error("FIREBASE_CLI_LOGIN_REQUIRED");
  const getToken = async () => (await cli.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"])).access_token;
  const credential = { getAccessToken: async () => ({ access_token: await getToken(), expires_in: 3600 }) };
  const app = initializeApp({ projectId: project, credential });
  const transport = createReadTransport(project, { getToken });
  if (pending) {
    const records = await transport.list("accountDeletionRequests");
    console.log(JSON.stringify({ mode: "read-only", pendingRequests: records.filter(record => record.data.status === "pending").length, remoteWrites: 0 }));
    return;
  }
  const inventory = await buildInventory({ project, reference, transport, getUser: uid => getAuth(app).getUser(uid) });
  const data = JSON.stringify(inventory, null, 2) + "\n";
  writePrivateInventory(output, data);
  console.log(JSON.stringify({ mode: inventory.mode, counts: inventory.counts, storageCandidates: inventory.storageCandidates.length,
    counterReviews: inventory.counterReviews.length, reviewRequired: inventory.review.length, inventorySha256: inventoryHash(data), remoteWrites: 0, approvedForDeletion: false }));
}

if (require.main === module) main().catch(error => { console.error(error.code ? "ACCOUNT_INVENTORY_FAILED" : error.message); process.exitCode = 1; });
module.exports = { parseArgs, writePrivateInventory, main };
