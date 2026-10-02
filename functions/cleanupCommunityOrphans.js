"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validatePlan, validateBackup, executeCleanup, createTransport } = require("./communityOrphanCleanup");

async function main(args = process.argv.slice(2)) {
  const allowed = ["project", "plan", "plan-sha256", "report", "firebase-cli-auth-module", "confirm-deletions", "confirm-project"];
  for (const arg of args) if (arg !== "--apply" && !allowed.some(name => arg.startsWith(`--${name}=`))) throw new Error("UNKNOWN_ARGUMENT");
  if (new Set(args.map(arg => arg.split("=")[0])).size !== args.length) throw new Error("DUPLICATE_ARGUMENT");
  const value = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const project = value("project"), planPath = value("plan"), reportPath = value("report"), cliModule = value("firebase-cli-auth-module");
  if (!project || !planPath || !reportPath || !cliModule) throw new Error("PROJECT_PLAN_REPORT_AND_AUTH_REQUIRED");
  const stat = fs.statSync(planPath);
  if (!stat.isFile() || stat.mode & 0o077 || stat.size > 5000000) throw new Error("PRIVATE_PLAN_FILE_REQUIRED");
  const validated = validatePlan(fs.readFileSync(planPath, "utf8"), project, value("plan-sha256"));
  const apply = args.includes("--apply");
  if (apply && (value("confirm-project") !== project || value("confirm-deletions") !== String(validated.count))) throw new Error("EXACT_SCOPE_CONFIRMATION_REQUIRED");
  if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error("PRODUCTION_CLI_FORBIDS_EMULATOR_ENVIRONMENT");
  const cli = require(cliModule);
  const account = cli.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error("FIREBASE_CLI_LOGIN_REQUIRED");
  const transport = createTransport(project, { getToken: async () => {
    const token = await cli.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"]);
    return token.access_token;
  } });
  if (!validated.plan.backupOperation?.startsWith(`projects/${project}/databases/(default)/operations/`) ||
      validated.plan.backupOperation.split("/").length !== 6) throw new Error("BACKUP_OPERATION_INVALID");
  validateBackup(await transport.backup(validated.plan.backupOperation), validated);
  // An exclusive, private journal is mandatory before any production commit. Never overwrite evidence.
  const parent = fs.statSync(path.dirname(reportPath));
  if (!parent.isDirectory()) throw new Error("REPORT_DIRECTORY_REQUIRED");
  const fd = fs.openSync(reportPath, "wx", 0o600);
  const record = event => { fs.writeSync(fd, JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n"); fs.fsyncSync(fd); };
  try {
    record({ phase: "start", mode: apply ? "apply" : "dry-run", project, planSha256: validated.hash, planned: validated.count });
    const totals = await executeCleanup(validated, transport, { apply, record });
    record({ phase: "complete", ...totals });
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...totals }));
  } catch (error) {
    record({ phase: "stopped", error: error.message, note: "Read the journal; an interrupted commit may have succeeded. Rerun only the identical approved plan with a new report." });
    throw error;
  } finally { fs.closeSync(fd); }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
