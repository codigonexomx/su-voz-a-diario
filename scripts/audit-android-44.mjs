import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, constants, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const { parseStringPromise } = createRequire(import.meta.url)('xml2js');
assert(process.argv.slice(2).every(arg => arg === '--candidate45'), 'Unsupported release audit option');
const release = process.argv.includes('--candidate45')
    ? { code: 45, name: '1.5.13', pwa: 260 }
    : { code: 44, name: '1.5.12', pwa: 259 };
const root = process.cwd();
const out = path.join(root, `artifacts/android-${release.name}-${release.code}-release`);
const source = path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab');
const bundle = path.join(out, `su-voz-${release.name}-${release.code}.aab`);
const java = '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (program, args) => execFileSync(program, args, { maxBuffer: 100000000 });
const tool = args => run(java + 'java', ['-jar', '/private/tmp/bundletool-all-1.18.3.jar', ...args]).toString();
const baseline = 'artifacts/android-1.5.11-43/su-voz-1.5.11-43.aab';
const frozen = [
    [baseline, '1e8d3ed45de42b34948c106ac0a8642929f00be6a4f755b58fecd5d11da99ae7'],
    ['artifacts/android-1.5.10-42/su-voz-1.5.10-42.aab', '91d395748fd208e2cae68ae8d7decea43b76f3bae9dd9caad65b34023d93cd92'],
    ['artifacts/android-1.5.12-44/su-voz-1.5.12-44.aab', '725eea6219fdf0e236847262b575173853820e1f1dd58706b3181cc1bcdbc4d3'],
    ['artifacts/android-1.5.12-44-final/su-voz-1.5.12-44.aab', '6a2704537f1314a1ba15e19474b95363d606edd25b021a085785e68e7c2c303d'],
    ...(release.code === 45 ? [
        ['artifacts/android-1.5.12-44-release/su-voz-1.5.12-44.aab', 'db7ebcc369fe3b84d3921ac5b6203d25e219d8639f35d5de318f2d654da3d617'],
        ['artifacts/android-1.5.12-44-release/app-release.apk', '4ccd55c8c66da6a34e64907e604535e43e014289111aa816fb64dbb7e3c4d8fe']
    ] : [])
];
for (const [file, expected] of frozen) assert.equal(hash(readFileSync(file)), expected, file);
const checks = JSON.parse(readFileSync('artifacts/validation/tests.json', 'utf8'));
assert.equal(checks.results.length, 52);
assert(checks.results.every(check => check.status === 0));
mkdirSync(out, { recursive: true, mode: 0o700 });
if (!existsSync(bundle)) copyFileSync(source, bundle, constants.COPYFILE_EXCL);
assert.equal(hash(readFileSync(source)), hash(readFileSync(bundle)), 'Do not overwrite a frozen candidate');
const write = (name, value) => writeFileSync(path.join(out, name), value, { mode: 0o600 });
write('tests.json', JSON.stringify(checks, null, 2));
write('bundle-validation.log', tool(['validate', `--bundle=${bundle}`]));
const config = JSON.parse(tool(['dump', 'config', `--bundle=${bundle}`]));
assert.equal(config.optimizations.uncompressNativeLibraries.alignment, 'PAGE_ALIGNMENT_16K');
write('bundle-config.json', JSON.stringify(config, null, 2));
const manifestXml = tool(['dump', 'manifest', `--bundle=${bundle}`, '--module=base']);
const manifest = (await parseStringPromise(manifestXml)).manifest;
const oldManifest = (await parseStringPromise(tool(['dump', 'manifest', `--bundle=${path.resolve(baseline)}`, '--module=base']))).manifest;
assert.equal(manifest.$.package, 'app.suvoz');
assert.equal(manifest.$['android:versionCode'], String(release.code));
assert.equal(manifest.$['android:versionName'], release.name);
assert.equal(manifest['uses-sdk'][0].$['android:targetSdkVersion'], '36');
assert.equal(manifest['uses-sdk'][0].$['android:minSdkVersion'], '24');
const permissions = value => value['uses-permission'].map(item => item.$).sort((a, b) => a['android:name'].localeCompare(b['android:name']));
assert.deepEqual(permissions(manifest), permissions(oldManifest));
write('android-manifest.xml', manifestXml);
const signature = run(java + 'jarsigner', ['-verify', bundle]).toString();
assert(signature.includes('jar verified.'));
write('signature-verification.log', signature);
const certificate = file => run(java + 'keytool', ['-J-Duser.language=en', '-printcert', '-jarfile', file]).toString()
    .match(/SHA256:\s*([A-Fa-f0-9:]+)/)?.[1]?.replaceAll(':', '').toLowerCase();
assert.equal(certificate(bundle)?.length, 64);
assert.equal(certificate(bundle), certificate(baseline));
const names = run('/usr/bin/unzip', ['-Z1', bundle]).toString().trim().split('\n');
const extract = name => run('/usr/bin/unzip', ['-p', bundle, name]);
const entries = new Map(names.filter(name => name.startsWith('base/assets/public/') && !name.endsWith('/'))
    .map(name => [name.slice('base/assets/public/'.length).normalize('NFC'), name]));
const compared = new Set();
function compare(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) { compare(file); continue; }
        const relative = path.relative(path.join(root, 'www'), file).normalize('NFC');
        if (relative === '.nojekyll' || relative.startsWith('.well-known/')) continue;
        assert(entries.has(relative), relative);
        assert.equal(hash(extract(entries.get(relative))), hash(readFileSync(file)), relative);
        compared.add(relative);
    }
}
compare(path.join(root, 'www'));
const extras = [...entries.keys()].filter(name => !compared.has(name));
assert(extras.every(name => ['capacitor.js', 'capacitor_plugins.js', 'cordova.js', 'cordova_plugins.js'].includes(name)));
assert(extract('base/assets/public/sw.js').toString().includes(`const APP_VERSION = '${release.pwa}'`));
const nativeConfig = JSON.parse(extract('base/assets/capacitor.config.json'));
assert.equal(nativeConfig.appId, 'app.suvoz');
assert(!nativeConfig.server?.url);
const plugins = JSON.parse(extract('base/assets/capacitor.plugins.json'));
assert(plugins.some(plugin => plugin.classpath?.endsWith('.FirebaseAppCheckPlugin')));
assert(!names.some(name => /(?:^|\/)(?:keystore\.properties|marketing|functions|node_modules|artifacts)(?:\/|$)|\.log$|\.keystore$|\.test\.js$/.test(name)));
const libraries = [];
for (const name of names.filter(name => /^base\/lib\/.*\.so$/.test(name))) {
    const filename = name.replaceAll('/', '_');
    write(filename, extract(name));
    const loads = run('/usr/bin/objdump', ['-p', path.join(out, filename)]).toString().split('\n').filter(line => /^\s*LOAD\s/.test(line));
    const exponents = loads.map(line => Number(line.match(/align\s+2\*\*(\d+)/)?.[1]));
    assert(loads.length && exponents.every(value => Number.isFinite(value) && value >= 14));
    libraries.push({ name, loadSegmentAlignmentExponents: exponents });
}
assert(libraries.length >= 4);
const lint = await parseStringPromise(readFileSync('android/app/build/reports/lint-results-release.xml', 'utf8'));
const issues = (lint.issues.issue || []).map(issue => ({ id: issue.$.id, severity: issue.$.severity, message: issue.$.message }));
assert(!issues.some(issue => ['Error', 'Fatal'].includes(issue.severity)));
write('lint-summary.json', JSON.stringify(issues, null, 2));
for (const [file, expected] of frozen) assert.equal(hash(readFileSync(file)), expected);
let nativeBackupQa = null;
const nativeResultPath = path.join(out, 'native-backup-qa/backup44.json');
if (existsSync(nativeResultPath)) {
    const environment = JSON.parse(readFileSync(path.join(out, 'native-backup-qa/environment.json'), 'utf8'));
    const nativeResult = JSON.parse(readFileSync(nativeResultPath, 'utf8'));
    assert.equal(environment.correspondingAabSha256, hash(readFileSync(bundle)));
    assert.equal(environment.productionWrites, false);
    assert.equal(environment.physicalDeviceTouched, false);
    assert.equal(nativeResult.syntheticDataOnly, true);
    nativeBackupQa = { result: nativeResult, environment };
}
const result = { auditedAt: new Date().toISOString(), bundle, sha256: hash(readFileSync(bundle)),
    sourceBaseCommit: run('git', ['rev-parse', 'HEAD']).toString().trim(),
    versionCode: release.code, versionName: release.name, pwa: release.pwa, minSdk: 24, targetSdk: 36,
    bundletoolValidated: true, sameUploadCertificate: true, signatureVerified: true,
    runtimeAssetsCompared: compared.size, runtimeAssetsMatch: true, privateFilesExcluded: true,
    newPermissions: false, appCheckBridgeBundled: true, appCheckEnabled: false,
    nativeLibraries: libraries, zipAlignment: 'PAGE_ALIGNMENT_16K', pageSizeDeviceQa: false,
    lintErrors: 0, lintWarnings: issues.filter(issue => issue.severity === 'Warning').length,
    emulatorChecksPassed: 52, nativeBackupQa, prior42And43Unchanged: true,
    uploadedToPlay: false, physicalQa: false, productionPublished: false };
write('audit-release.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
