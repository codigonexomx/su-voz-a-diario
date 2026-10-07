import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const checks = [
    'validate-reading-catalog', 'validate-readings-q4-2026', 'validate-tla-readings',
    'validate-analytics-service', 'validate-journey', 'validate-app-connections',
    'validate-community-voice', 'validate-library-upgrade', 'validate-continuous-reader',
    'validate-bible-continuous-voice', 'validate-bible-study', 'validate-bible-without-strong',
    'validate-bible-phase3', 'validate-bible-phase6', 'validate-bible-phase7',
    'validate-bottom-nav', 'validate-deepening-keyboard', 'validate-deepening-steps', 'validate-glass-nav', 'validate-deep-links',
    'test-community-hotfix-203', 'audit-bottom-nav', 'validate-stabilization', 'validate-account-recovery',
    'validate-community-global', 'validate-local-backup', 'validate-app-check', 'validate-private-assets',
].map(name => [`scripts/${name}.mjs`]);
checks.push(['scripts/validate-readings-q4-2026.mjs', '--require-complete']);
checks.push(['scripts/check-reading-coverage.mjs']);
for (const name of [
    'bibleProxy', 'communityIdentity', 'communityPrayer', 'migrateCommunityAnonymousLegacy',
    'backfillCommunityReplyCounts', 'communityDiscovery', 'communityEditorialModel',
    'communityUIIntegration6C', 'communityIntent6G', 'communityOrphanCleanup', 'accountDeletionInventory', 'accountDeletionExecution',
]) checks.push([`functions/${name}.test.js`]);
checks.push(['--check', 'functions/index.js']);

if (process.argv.includes('--emulator')) {
    if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
        throw new Error('A local Firestore emulator is required. Production is forbidden.');
    }
    if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')) {
        throw new Error('A local Auth emulator is required. Production is forbidden.');
    }
    checks.push(['scripts/test-account-auth-emulator.mjs']);
    checks.push(['scripts/test-account-deletion-rules.mjs']);
    for (const file of ['scripts/test-community-rules.mjs', 'functions/stabilization.test.js',
        'functions/communityIdentityConcurrency.test.js', 'functions/communityPrayerConcurrency.test.js',
        'functions/communityReplyCountsConcurrency.test.js', 'functions/communityOrphanCleanupEmulator.test.js',
        'functions/accountDeletionInventoryEmulator.test.js', 'functions/accountDeletionExecutionEmulator.test.js']) checks.push([file]);
}

const failed = [];
const results = [];
for (const args of checks) {
    console.log(`\nCHECK: ${args.join(' ')}`);
    if (process.argv.includes('--emulator') && args.some(arg => arg.includes('Concurrency.test'))) {
        const cleared = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-su-voz-concurrency/databases/(default)/documents`, { method: 'DELETE' });
        if (!cleared.ok) throw new Error('Could not isolate concurrency fixtures in the demo emulator');
    }
    const result = spawnSync(process.execPath, args, {
        cwd: root, encoding: 'utf8', maxBuffer: 12000000, timeout: 180000,
        env: { ...process.env, GCLOUD_PROJECT: args.some(arg => arg.includes('Concurrency.test'))
            ? 'demo-su-voz-concurrency' : 'demo-su-voz-stability' },
    });
    const output = (result.stdout || '') + (result.stderr || '');
    results.push({ command: args, status: result.status, output });
    console.log(process.argv.includes('--verbose') ? output : output.trim().split('\n').slice(-12).join('\n'));
    if (result.status !== 0) {
        failed.push(args.join(' '));
        if (result.error) console.error(result.error.message);
    }
}
mkdirSync(new URL('../artifacts/validation/', import.meta.url), { recursive: true });
writeFileSync(new URL('../artifacts/validation/tests.json', import.meta.url), JSON.stringify({ node: process.version, results }, null, 2));
console.log(`\nResult: ${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) { console.error('Failed:\n' + failed.join('\n')); process.exitCode = 1; }
