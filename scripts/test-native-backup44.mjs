import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const adb = '/Users/ricardogarcia/Library/Android/sdk/platform-tools/adb';
assert(process.argv.slice(2).every(arg => ['--candidate45', '--navigation', '--landscape'].includes(arg)), 'Unsupported native QA option');
const release = process.argv.includes('--candidate45')
    ? { code: 45, name: '1.5.13' }
    : { code: 44, name: '1.5.12' };
const navigation = process.argv.includes('--navigation');
const orientation = process.argv.includes('--landscape') ? 'landscape' : 'portrait';
const phase = navigation ? `navigation${release.code}` : 'backup44';
const run = args => execFileSync(adb, ['-s', 'emulator-5562', ...args], { encoding: 'utf8', timeout: 180000, maxBuffer: 4000000 });
const deadline = Date.now() + 120000;
let ready = false;
while (Date.now() < deadline) {
    try { ready = run(['shell', 'getprop', 'sys.boot_completed']).trim() === '1'; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
}
assert(ready, 'Only the explicitly named disposable emulator may be used');
assert.equal(run(['shell', 'getprop', 'ro.kernel.qemu']).trim(), '1');
assert(run(['emu', 'avd', 'name']).split(/\r?\n/).map(line => line.trim()).includes('SuVoz_Audit44'));
run(['shell', 'cmd', 'connectivity', 'airplane-mode', 'enable']);
run(['shell', 'svc', 'wifi', 'disable']);
run(['shell', 'svc', 'data', 'disable']);
assert.equal(run(['shell', 'settings', 'get', 'global', 'airplane_mode_on']).trim(), '1');
// Network is disabled before any Su Voz process or Firebase provider can initialize.
assert(!/^default\s/m.test(run(['shell', 'ip', 'route'])), 'No external IPv4 default route allowed');
assert(!/^default\s/m.test(run(['shell', 'ip', '-6', 'route'])), 'No external IPv6 default route allowed');
run(['install', '-r', 'android/app/build/outputs/apk/release/app-release.apk']);
run(['install', '-r', 'android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk']);
const installed = run(['shell', 'dumpsys', 'package', 'app.suvoz']);
assert(new RegExp(`versionCode=${release.code}\\b`).test(installed) && installed.includes(`versionName=${release.name}`));
for (const file of ['css/styles.css', 'js/app.js', 'js/avatarGenerator.js', 'js/services/BackupService.js', 'js/core/securityConfig.js']) {
    const actual = execFileSync('/usr/bin/unzip', ['-p', 'android/app/build/outputs/apk/release/app-release.apk', 'assets/public/' + file]);
    assert(actual.equals(readFileSync('www/' + file)), 'Native QA APK uses current runtime: ' + file);
}
const output = run(['shell', 'am', 'instrument', '-w', '-e', 'phase', phase, '-e', 'orientation', orientation,
    'app.suvoz.test/app.suvoz.NavAuditInstrumentation']);
const releaseDirectory = `artifacts/android-${release.name}-${release.code}-release`;
const outputDir = releaseDirectory + '/' + (navigation ? 'native-navigation-qa/' + orientation : 'native-backup-qa');
mkdirSync(outputDir, { recursive: true, mode: 0o700 });
writeFileSync(outputDir + '/instrumentation.log', output);
assert(output.includes('SuVoz Android navigation QA: PASS'), output);
const files = navigation
    ? [`${phase}.json`, ...['gestural', 'threebutton'].flatMap(mode => [
        ...['home', 'bible', 'calendar', 'community', 'stats', 'keyboard'].map(route => `${phase}-${mode}-${route}.png`)
    ])]
    : ['backup44.json', 'backup44-settings.png'];
for (const file of files) run(['pull', '/sdcard/Android/data/app.suvoz/files/nav-qa/' + file, outputDir + '/' + file]);
const result = JSON.parse(readFileSync(outputDir + '/' + phase + '.json', 'utf8'));
if (navigation) {
    assert.equal(result.passed, true);
    assert.equal(result.orientation, orientation);
    assert.deepEqual(result.modes.map(mode => mode.mode), ['gestural', 'threebutton']);
    assert(result.modes.every(mode => mode.keyboardOpenClose && mode.rows.length === 5
        && mode.keyboard?.focus === 'bible-search-input' && mode.keyboard.fieldVisible));
} else {
    assert.equal(result.versionCode, release.code);
    assert.equal(result.syntheticDataOnly, true);
}
const pageSize = run(['shell', 'getconf', 'PAGESIZE']).trim();
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(outputDir + '/environment.json', JSON.stringify({
    recordedAt: new Date().toISOString(), avd: 'SuVoz_Audit44', pageSizeBytes: Number(pageSize),
    externalNetworkBlockedBeforeInstall: true, physicalDeviceTouched: false,
    versionCode: release.code, orientation, navigationQa: navigation,
    nativeFileResultInjectedByInstrumentation: !navigation, manualPickerUiQa: false, productionWrites: false,
    testedApkSha256: sha256('android/app/build/outputs/apk/release/app-release.apk'),
    correspondingAabSha256: sha256(`${releaseDirectory}/su-voz-${release.name}-${release.code}.aab`)
}, null, 2));
console.log(JSON.stringify(result, null, 2));
