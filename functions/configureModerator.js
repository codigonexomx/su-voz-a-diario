"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

async function main() {
  const args = process.argv.slice(2);
  const value = name => args.find(argument => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
  const projectId = value("project"), expectedEmail = value("expected-email");
  const cliModule = value("firebase-cli-auth-module");
  if (!projectId || !expectedEmail) throw new Error("Provide --project and --expected-email. Optional --uid. Dry-run is the default; --apply is required to write.");
  let credential;
  if (cliModule) {
    const cli = require(cliModule);
    const account = cli.getGlobalDefaultAccount();
    if (!account?.tokens?.refresh_token) throw new Error("Firebase CLI login required");
    credential = { getAccessToken: async () => {
      const token = await cli.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"]);
      return { access_token: token.access_token, expires_in: 3600 };
    } };
  }
  initializeApp({ projectId, ...(credential ? { credential } : {}) });
  const auth = getAuth();
  const user = value("uid") ? await auth.getUser(value("uid")) : await auth.getUserByEmail(expectedEmail);
  const uid = user.uid;
  if (user.disabled || !user.emailVerified || user.email?.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error("Moderator must be an enabled account with the verified, explicitly confirmed email. No anonymous account is granted access.");
  }
  let ref;
  if (credential) {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/communityConfiguration/moderation`;
    const request = async (method, body) => {
      const token = await credential.getAccessToken();
      const response = await fetch(url + (method === "PATCH" ? "?updateMask.fieldPaths=moderatorUid&updateMask.fieldPaths=updatedAt" : ""), {
        method, headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 404 && method === "GET") return {};
      if (!response.ok) throw new Error(`Private moderator configuration failed: HTTP ${response.status}`);
      return response.json();
    };
    ref = {
      get: async () => { const record = await request("GET"); return { get: key => record.fields?.[key]?.stringValue }; },
      set: data => request("PATCH", { fields: { moderatorUid: { stringValue: data.moderatorUid }, updatedAt: { timestampValue: new Date().toISOString() } } }),
    };
  } else ref = getFirestore().collection("communityConfiguration").doc("moderation");
  const before = await ref.get();
  const previousUid = before.get("moderatorUid");
  if (previousUid && previousUid !== uid && !args.includes("--replace-confirmed")) throw new Error("A different moderator is configured. Explicit --replace-confirmed is required.");
  if (!args.includes("--apply")) { console.log("DRY-RUN OK: account verified; one private moderator would be configured. No writes."); return; }
  // The database pin is authoritative: stale claims cannot grant another account access.
  await ref.set({ moderatorUid: uid, updatedAt: FieldValue.serverTimestamp() });
  await auth.setCustomUserClaims(uid, { ...(user.customClaims || {}), moderator: true });
  if (previousUid && previousUid !== uid) {
    const oldUser = await auth.getUser(previousUid);
    const claims = { ...(oldUser.customClaims || {}) };
    delete claims.moderator;
    await auth.setCustomUserClaims(previousUid, claims);
  }
  const [record, config] = await Promise.all([auth.getUser(uid), ref.get()]);
  if (record.customClaims?.moderator !== true || config.get("moderatorUid") !== uid) throw new Error("Moderator verification failed");
  console.log("OK: exactly one moderator pinned. Refresh the user's ID token or reopen the app.");
}

main().catch(error => { console.error(error.code === "auth/user-not-found" ? "Moderator account does not exist yet. Link and verify the confirmed email first." : error.code ? `Moderator configuration failed: ${error.code}` : error.message); process.exitCode = 1; });
