import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, constants, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const { parseStringPromise } = createRequire(import.meta.url)('xml2js');
assert(process.argv.slice(2).every(arg => ['--candidate45', '--candidate46', '--candidate47', '--candidate48', '--candidate49', '--candidate50', '--candidate51', '--candidate52', '--candidate53', '--candidate54', '--candidate55', '--candidate56', '--candidate57', '--candidate58', '--candidate59', '--candidate60', '--candidate61', '--candidate62', '--candidate63'].includes(arg)), 'Unsupported release audit option');
assert(process.argv.slice(2).length <= 1, 'Select only one release candidate');
const release = process.argv.includes('--candidate63')
    ? { code: 63, name: '1.5.31', pwa: 283 }
    : process.argv.includes('--candidate62')
    ? { code: 62, name: '1.5.30', pwa: 282 }
    : process.argv.includes('--candidate61')
    ? { code: 61, name: '1.5.29', pwa: 281 }
    : process.argv.includes('--candidate60')
    ? { code: 60, name: '1.5.28', pwa: 279 }
    : process.argv.includes('--candidate59')
    ? { code: 59, name: '1.5.27', pwa: 278 }
    : process.argv.includes('--candidate58')
    ? { code: 58, name: '1.5.26', pwa: 273 }
    : process.argv.includes('--candidate57')
    ? { code: 57, name: '1.5.25', pwa: 272 }
    : process.argv.includes('--candidate56')
    ? { code: 56, name: '1.5.24', pwa: 271 }
    : process.argv.includes('--candidate55')
    ? { code: 55, name: '1.5.23', pwa: 270 }
    : process.argv.includes('--candidate54')
    ? { code: 54, name: '1.5.22', pwa: 269 }
    : process.argv.includes('--candidate53')
    ? { code: 53, name: '1.5.21', pwa: 268 }
    : process.argv.includes('--candidate52')
    ? { code: 52, name: '1.5.20', pwa: 267 }
    : process.argv.includes('--candidate51')
    ? { code: 51, name: '1.5.19', pwa: 266 }
    : process.argv.includes('--candidate50')
    ? { code: 50, name: '1.5.18', pwa: 265 }
    : process.argv.includes('--candidate49')
    ? { code: 49, name: '1.5.17', pwa: 264 }
    : process.argv.includes('--candidate48')
    ? { code: 48, name: '1.5.16', pwa: 263 }
    : process.argv.includes('--candidate47')
    ? { code: 47, name: '1.5.15', pwa: 262 }
    : process.argv.includes('--candidate46')
        ? { code: 46, name: '1.5.14', pwa: 261 }
        : process.argv.includes('--candidate45')
            ? { code: 45, name: '1.5.13', pwa: 260 }
            : { code: 44, name: '1.5.12', pwa: 259 };
const root = process.cwd();
const out = path.join(root, `artifacts/android-${release.name}-${release.code}-release`);
const source = path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab');
const bundle = path.join(out, `su-voz-${release.name}-${release.code}.aab`);
const java = '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (program, args) => execFileSync(program, args, { maxBuffer: 100000000 });
const tool = args => run(java + 'java', ['-jar', path.join(root, 'artifacts/tools/bundletool-all-1.18.3.jar'), ...args]).toString();
const baseline = release.code >= 63
    ? 'artifacts/android-1.5.30-62-release/su-voz-1.5.30-62.aab'
    : release.code >= 62
    ? 'artifacts/android-1.5.29-61-release/su-voz-1.5.29-61.aab'
    : release.code >= 61
    ? 'artifacts/android-1.5.28-60-release/su-voz-1.5.28-60.aab'
    : release.code >= 60
    ? 'artifacts/android-1.5.27-59-release/su-voz-1.5.27-59.aab'
    : release.code >= 59
    ? 'artifacts/android-1.5.26-58-release/su-voz-1.5.26-58.aab'
    : 'artifacts/android-1.5.11-43/su-voz-1.5.11-43.aab';
const frozen = [
    ...(release.code >= 63 ? [
        ['artifacts/android-1.5.30-62-release/su-voz-1.5.30-62.aab', '68a700a21ed79a31811c65b0a267076059bc182009e8a75557023b3fbee62e56']
    ] : []),
    ...(release.code >= 62 ? [
        ['artifacts/android-1.5.29-61-release/su-voz-1.5.29-61.aab', '615ccafb1726239f90ab83ced629e24ceb53ac578d69f2cf946b5dcbfdbe82d9']
    ] : []),
    ...(release.code >= 61 ? [
        ['artifacts/android-1.5.28-60-release/su-voz-1.5.28-60.aab', 'c29f58d8932790e950973b8c99ec3fc6a537f80114564810b3c6477ad845f3af']
    ] : []),
    ...(release.code >= 60 ? [
        ['artifacts/android-1.5.27-59-release/su-voz-1.5.27-59.aab', 'cafdf8e14023c6c008a4ce65832f7bc4229ef0de8adfda444147e9ba35c48626']
    ] : []),
    ...(release.code >= 59 ? [
        ['artifacts/android-1.5.26-58-release/su-voz-1.5.26-58.aab', '56b5dd148929533aba12639fb2b2f152d7feb523f045cb75c93287c969cf5f1e']
    ] : []),
    ...(release.code >= 58 ? [
        ['artifacts/android-1.5.25-57-release/su-voz-1.5.25-57.aab', 'b59bb3d79c9de0868c69b045ed08ef48dee26a3dfd8d790f772c8b786018dded']
    ] : []),
    ...(release.code >= 57 ? [
        ['artifacts/android-1.5.24-56-release/su-voz-1.5.24-56.aab', 'c6ea3f16570f334b147d3a6512b0c71998d3063ab8c2cc6ea7b121a84a5b0590']
    ] : []),
    ...(release.code >= 56 ? [
        ['artifacts/android-1.5.23-55-release/su-voz-1.5.23-55.aab', '817266d64ab1284ba4dc98e15d63b51313cee13262c62077dd74dd11eb177395']
    ] : []),
    ...(release.code >= 55 ? [
        ['artifacts/android-1.5.22-54-release/su-voz-1.5.22-54.aab', '77b1f988b4918881c8fbae953c6a7e9c6b7a9439484dc48313fc3f5c8a0481df']
    ] : []),
    ...(release.code >= 54 ? [
        ['artifacts/android-1.5.21-53-release/su-voz-1.5.21-53.aab', '99f37e3f5ef854722d4f8ee493ac26eeca88060a964539326ef345d6ceb30f1c']
    ] : []),
    ...(release.code >= 53 ? [
        ['artifacts/android-1.5.20-52-release/su-voz-1.5.20-52.aab', '69c1bf98eccb516fb2212382b623847c73520feeda75ef5d24aa4f685f7be347']
    ] : []),
    ['artifacts/android-1.5.11-43/su-voz-1.5.11-43.aab', '1e8d3ed45de42b34948c106ac0a8642929f00be6a4f755b58fecd5d11da99ae7'],
    ['artifacts/android-1.5.10-42/su-voz-1.5.10-42.aab', '91d395748fd208e2cae68ae8d7decea43b76f3bae9dd9caad65b34023d93cd92'],
    ['artifacts/android-1.5.12-44/su-voz-1.5.12-44.aab', '725eea6219fdf0e236847262b575173853820e1f1dd58706b3181cc1bcdbc4d3'],
    ['artifacts/android-1.5.12-44-final/su-voz-1.5.12-44.aab', '6a2704537f1314a1ba15e19474b95363d606edd25b021a085785e68e7c2c303d'],
    ...(release.code >= 45 ? [
        ['artifacts/android-1.5.12-44-release/su-voz-1.5.12-44.aab', 'db7ebcc369fe3b84d3921ac5b6203d25e219d8639f35d5de318f2d654da3d617'],
        ['artifacts/android-1.5.12-44-release/app-release.apk', '4ccd55c8c66da6a34e64907e604535e43e014289111aa816fb64dbb7e3c4d8fe']
    ] : []),
    ...(release.code >= 46 ? [
        ['artifacts/android-1.5.13-45-release/su-voz-1.5.13-45.aab', 'e3d619b87eacd65dec99e0b2d1b756584daa02361ee19adaf06fe0283b3997b2'],
        ['artifacts/android-1.5.13-45-release/app-release.apk', '9d33db92c3b6124673aa0799e997272fbbb56b6df532110d587d9f84b89c2e6d']
    ] : []),
    ...(release.code >= 47 ? [
        ['artifacts/android-1.5.14-46-release/su-voz-1.5.14-46.aab', '21b76ddc793316dec2bce201dcc755a0e46f339d0bb8bf65dccadd1c3d28ebf6'],
        ['artifacts/android-1.5.14-46-release/app-release.apk', 'cbde57c4451020f3abeaa081ca307b6806ce3a44b48d60ba48739aea697929a4']
    ] : []),
    ...(release.code >= 48 ? [
        ['artifacts/android-1.5.15-47-release/su-voz-1.5.15-47.aab', '19289639a22578336cc5572dccbc334c5dea793fdb4e02de33e888a50320e286'],
        ['artifacts/android-1.5.15-47-release/app-release.apk', '4ef44a9855839f73d88ee07209d836d5bb4fc4d36e8f869405757a3fac08f411']
    ] : []),
    ...(release.code >= 49 ? [
        ['artifacts/android-1.5.16-48-release/su-voz-1.5.16-48.aab', 'bc273fcf5265da1e24b1e0a466771f5b195601a0330c647384f9836062905daf'],
        ['artifacts/android-1.5.16-48-release/app-release.apk', 'b91710d6ccb51879aafbad9357efa87b676689511c1273187b1a58d1da34c361']
    ] : []),
    ...(release.code >= 50 ? [
        ['artifacts/android-1.5.17-49-release/su-voz-1.5.17-49.aab', '60abb349569a45fe50b41209e87ef9860d572cea5e8273b7caf507c1d2c093f4'],
        ['artifacts/android-1.5.17-49-release/app-release.apk', 'd28cf54213b272eabe8f785284867612c4afc250eb775b13a27b0e9d4c6ee7f7']
    ] : []),
    ...(release.code >= 52 ? [
        ['artifacts/android-1.5.19-51-release/su-voz-1.5.19-51.aab', 'b150e025db583183062bdb2b197ce14162a1771a4bf56c70a30fe85d29e1b72f']
    ] : []),
    ...(release.code >= 51 ? [
        ['artifacts/android-1.5.18-50-release/su-voz-1.5.18-50.aab', 'c3510d8f1afca864ac46b5423499283613dff44d1f477dc73e1a9574650de283']
    ] : [])
];
for (const [file, expected] of frozen) assert.equal(hash(readFileSync(file)), expected, file);
const checks = JSON.parse(readFileSync('artifacts/validation/tests.json', 'utf8'));
const expectedChecks = release.code >= 61 ? 70 : release.code >= 60 ? 68 : release.code >= 59 ? 67 : release.code >= 54 ? 64 : release.code >= 53 ? 62 : release.code >= 52 ? 61 : release.code >= 51 ? 60 : release.code >= 50 ? 59 : release.code >= 49 ? 56 : release.code >= 48 ? 55 : release.code >= 47 ? 53 : 52;
assert.equal(checks.results.length, expectedChecks);
assert(checks.results.every(check => check.status === 0));
if (release.code >= 61) {
    for (const script of ['scripts/validate-commentary.mjs', 'scripts/validate-commentary-ui.mjs',
        'scripts/validate-continuous-reader.mjs']) {
        assert(checks.results.some(check => check.command[0] === script), `Required commentary check: ${script}`);
    }
}
if (release.code >= 60) {
    assert(checks.results.some(check => check.command[0] === 'scripts/validate-rvr1960-links.mjs'));
}
if (release.code >= 59) {
    for (const script of ['scripts/validate-rvr1960.mjs', 'scripts/validate-rvr1960-references.mjs',
        'scripts/validate-rvr1960-strong.mjs', 'scripts/test-account-auth-emulator.mjs',
        'functions/accountDeletionExecutionEmulator.test.js']) {
        assert(checks.results.some(check => check.command[0] === script), `Required release check: ${script}`);
    }
}
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

let strongBundle = null;
if (release.code >= 59) {
    const packaged = relative => {
        assert(entries.has(relative), `Packaged Strong dependency: ${relative}`);
        const bytes = extract(entries.get(relative));
        assert.equal(hash(bytes), hash(readFileSync(path.join(root, relative))), `Current source: ${relative}`);
        return bytes;
    };
    for (const relative of ['data/rvr1960.json', 'data/strong/NOTICE.txt',
        'js/bible/LocalRvr1960Provider.js', 'js/bible/LocalRvr1960StrongProvider.js',
        'js/bible/StrongRepository.js', 'js/bible/StrongStudyPanel.js']) packaged(relative);
    const strongManifest = JSON.parse(packaged('data/strong/rvr1960-map-manifest.json'));
    const lexiconManifest = JSON.parse(packaged('data/strong/lexicon-source.json'));
    assert.equal(strongManifest.versionId, 'rvr60-strong');
    assert.equal(strongManifest.referenceMode, 'literal-source-position');
    assert.equal(strongManifest.files.length, 66);
    assert.equal(new Set(strongManifest.files.map(file => file.bookId)).size, 66);
    assert.equal([...entries.keys()].filter(name => /^data\/strong\/books\/[^/]+\.json$/.test(name)).length, 66);
    for (const file of strongManifest.files) {
        const bytes = packaged(file.path);
        assert.equal(hash(bytes), file.sha256, file.path);
        assert.equal(bytes.length, file.bytes, file.path);
    }
    const dictionaryEntries = {};
    for (const language of ['hebrew', 'greek']) {
        const file = lexiconManifest.files[language];
        const bytes = packaged(`data/strong/${file.file}`);
        assert.equal(hash(bytes), file.sha256, file.file);
        assert.equal(bytes.length, file.bytes, file.file);
        dictionaryEntries[language] = Object.keys(JSON.parse(bytes)).length;
        assert.equal(dictionaryEntries[language], file.entries);
    }
    assert.equal(dictionaryEntries.hebrew, 8674);
    assert.equal(dictionaryEntries.greek, 5523);
    strongBundle = { versionId: strongManifest.versionId, books: strongManifest.files.length,
        dictionaryEntries, sourceAndManifestHashesMatch: true };
}

let commentaryBundle = null;
let matthewHenryBundle = null;
if (release.code >= 61) {
    const packaged = relative => {
        assert(entries.has(relative), `Packaged commentary dependency: ${relative}`);
        const bytes = extract(entries.get(relative));
        assert.equal(hash(bytes), hash(readFileSync(path.join(root, relative))), `Current source: ${relative}`);
        return bytes;
    };
    for (const relative of ['data/commentaries/NOTICE.txt', 'css/commentary-panel.css',
        'js/bible/CommentaryRepository.js', 'js/bible/commentaryLookup.js', 'js/bible/CommentaryPanel.js',
        'js/app.js', 'js/ReadingDocument.js', 'js/DeepeningShell.js',
        'data/readings/2026-11.json', 'data/readings/2026-12.json']) packaged(relative);
    const bytes = packaged('data/commentaries/hendriksen-apocalipsis.json');
    assert.equal(hash(bytes), '332e16359dfbaebad14ad659c1d01eb87b7c6efd5837acb9a0af02e63da411fa');
    const commentary = JSON.parse(bytes);
    assert.equal(commentary.source.editorialPackageSha256, 'e587f81cab2a628bf5109257c629a4b4b53e90393db119326a06402c910d5aae');
    assert.equal(commentary.source.pdfPageCount, 243);
    assert.equal(commentary.book.id, 'rev');
    assert.equal(commentary.book.chapterVerseCounts.length, 22);
    assert.equal(commentary.book.chapterVerseCounts.reduce((sum, count) => sum + count, 0), 404);
    assert.equal(commentary.entries.length, 94);
    assert.equal(commentary.entries.filter(entry => entry.kind === 'commentary').length, 50);
    assert.equal(commentary.notes.length, 273);
    assert.equal(commentary.noteGroups.length, 14);
    assert.equal(commentary.quality.detectedOcrDifferencesPending, 0);
    assert.equal(commentary.quality.bodyRewrittenOrSummarized, false);
    assert.deepEqual(commentary.quality.unmappedVerses, []);
    assert(!/\/(?:Users|Volumes)\//.test(bytes.toString()), 'Editorial audit paths stay outside the native edition');
    // validate-commentary.mjs, required above, checks every verse and all 36
    // scheduled meditations against these exact source bytes and catalogs.
    commentaryBundle = { sha256: hash(bytes), editorialPackageSha256: commentary.source.editorialPackageSha256,
        entries: 94, sections: 50, notes: 273, noteGroups: 14, verses: 404, scheduledMeditations: 36,
        coverageValidatedBy: 'scripts/validate-commentary.mjs', sourceAndBundleHashesMatch: true,
        humanReview: commentary.quality.humanReview };
    if (release.code >= 62) {
        const henryBytes = packaged('data/commentaries/matthew-henry-apocalipsis.json');
        const { validatePackage, lookupRange } = await import('../js/bible/commentaryLookup.js');
        const henry = validatePackage(JSON.parse(henryBytes));
        if (release.code >= 63) {
            assert.equal(hash(henryBytes), '3bfa323a84f86aab1a188a53ecaac4939825b097405d8b408040f6e46ce57702');
            const previous = JSON.parse(run('/usr/bin/unzip', ['-p', path.resolve(baseline),
                'base/assets/public/data/commentaries/matthew-henry-apocalipsis.json']));
            assert.deepEqual(henry.entries, previous.entries, 'Henry commentary text and verse mapping remain unchanged');
            assert.deepEqual(henry.notes, previous.notes, 'Henry notes remain unchanged');
        }
        assert.equal(henry.work.id, 'matthew-henry-apocalipsis');
        assert.equal(henry.book.id, 'rev');
        assert.deepEqual(henry.book.chapterVerseCounts, commentary.book.chapterVerseCounts);
        assert(!/\/(?:Users|Volumes)\//.test(henryBytes.toString()), 'Henry source audit paths stay outside the native edition');
        for (let chapter = 1; chapter <= 22; chapter++) {
            for (let verse = 1; verse <= henry.book.chapterVerseCounts[chapter - 1]; verse++) {
                const point = { bookId: 'rev', chapter, verse };
                assert.equal(lookupRange(henry, { start: point, end: point }).length, 1,
                    `Packaged Henry covers Revelation ${chapter}:${verse} exactly once`);
            }
        }
        const meditationEntries = lookupRange(henry, {
            start: { bookId: 'rev', chapter: 11, verse: 15 }, end: { bookId: 'rev', chapter: 12, verse: 6 }
        });
        assert.deepEqual(meditationEntries.map(entry => entry.id), ['mhcc-b66-c011-v014-e003', 'mhcc-b66-c012-v001-e001']);
        matthewHenryBundle = { sha256: hash(henryBytes), workId: henry.work.id,
            entries: henry.entries.length, sections: henry.entries.filter(entry => entry.kind === 'commentary').length,
            verses: 404, crossChapterMeditationSections: meditationEntries.length,
            sourceAndBundleHashesMatch: true, coverageValidatedBy: 'scripts/validate-commentary.mjs' };
    }
}

const nativeConfig = JSON.parse(extract('base/assets/capacitor.config.json'));
assert.equal(nativeConfig.appId, 'app.suvoz');
assert(!nativeConfig.server?.url);
const plugins = JSON.parse(extract('base/assets/capacitor.plugins.json'));
assert(plugins.some(plugin => plugin.classpath?.endsWith('.FirebaseAppCheckPlugin')));
let capacitorSecurityPatch = null;
if (release.code >= 47) {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    for (const platform of ['android', 'core', 'ios']) {
        const name = `@capacitor/${platform}`;
        assert.equal(lock.packages[`node_modules/${name}`].version, '8.5.1');
        assert.equal(JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).version, '8.5.1');
    }
    capacitorSecurityPatch = { version: '8.5.1', advisory: 'GHSA-rvm3-566m-v7fv', lockMatchesInstalledPackages: true };
}
assert(!names.some(name => /(?:^|\/)(?:keystore\.properties|marketing|functions|node_modules|artifacts)(?:\/|$)|\.log$|\.keystore$|\.test\.js$/.test(name)));
const libraries = [];
for (const name of names.filter(name => /^base\/lib\/.*\.so$/.test(name))) {
    const filename = name.replaceAll('/', '_');
    write(filename, extract(name));
    const loads = run(process.env.ANDROID_OBJDUMP || '/usr/bin/objdump', ['-p', path.join(out, filename)]).toString().split('\n').filter(line => /^\s*LOAD\s/.test(line));
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
let nativeCommentaryQa = null;
if (release.code >= 61) {
    const evidencePath = path.join(out, `native-qa/evidence/commentary${release.code}.json`);
    const environmentPath = path.join(out, 'native-qa/environment.json');
    assert(existsSync(evidencePath) && existsSync(environmentPath), 'Native commentary QA evidence is required for this candidate');
    const environment = JSON.parse(readFileSync(environmentPath, 'utf8'));
    const nativeResult = JSON.parse(readFileSync(evidencePath, 'utf8'));
    assert.equal(environment.versionCode, release.code);
    assert.equal(environment.versionName, release.name);
    assert.equal(environment.aabSha256, hash(readFileSync(bundle)), 'Native QA must refer to this exact AAB');
    assert.equal(environment.apkSha256, hash(readFileSync(path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'))),
        'Native QA must refer to the current release APK');
    assert.equal(environment.networkIsolated, true);
    assert.equal(environment.productionWrites, false);
    assert.equal(environment.physicalDeviceTouched, false);
    assert.equal(nativeResult.phase, `commentary${release.code}`);
    for (const key of ['passed', 'offline', 'syntheticDataOnly', 'rvr60', 'strong',
        'selectedVerseRetained', 'nativeBackClosesCommentaryOnly', 'otherBooksHidden']) {
        assert.equal(nativeResult[key], true, `Native commentary QA: ${key}`);
    }
    assert.equal(nativeResult.productionWrites, false);
    assert.equal(nativeResult.physicalDeviceTouched, false);
    assert.equal(nativeResult.meditationSections, 2);
    for (const key of ['mounted', 'draftPreserved', 'caretPreserved', 'focusPreserved', 'readingScrollPreserved']) {
        assert.equal(nativeResult.meditationReturn[key], true, `Native meditation return: ${key}`);
    }
    if (release.code >= 62) {
        for (const key of ['henrySelectedThroughWorkPicker', 'henryChapter1And22',
            'henryCrossChapterMeditation', 'switchedBackToHendriksen',
            'visibleNativeScenesVerified', 'screenshotsAfterWebViewPaint']) {
            assert.equal(nativeResult[key], true, `Native two-commentary QA: ${key}`);
        }
    }
    if (release.code >= 63) {
        for (const key of ['globalNavigation', 'directChapterVerseNavigation', 'originalPassageRetained',
            'returnToOriginalPassage', 'sameLocationAcrossWorks', 'fullWorkSelector', 'meditationGlobalNavigation']) {
            assert.equal(nativeResult[key], true, `Native complete-book navigation QA: ${key}`);
        }
    }
    nativeCommentaryQa = { result: nativeResult, environment };
}
const result = { auditedAt: new Date().toISOString(), bundle, sha256: hash(readFileSync(bundle)),
    sourceBaseCommit: run('git', ['rev-parse', 'HEAD']).toString().trim(),
    versionCode: release.code, versionName: release.name, pwa: release.pwa, minSdk: 24, targetSdk: 36,
    bundletoolValidated: true, sameUploadCertificate: true, signatureVerified: true, comparisonBaseline: baseline,
    runtimeAssetsCompared: compared.size, runtimeAssetsMatch: true, privateFilesExcluded: true, strongBundle, commentaryBundle,
    ...(release.code >= 62 ? { matthewHenryBundle } : {}),
    newPermissions: false, appCheckBridgeBundled: true, appCheckEnabled: false,
    nativeLibraries: libraries, zipAlignment: 'PAGE_ALIGNMENT_16K', pageSizeDeviceQa: false,
    lintErrors: 0, lintWarnings: issues.filter(issue => issue.severity === 'Warning').length,
    emulatorChecksPassed: expectedChecks, capacitorSecurityPatch, nativeBackupQa, nativeCommentaryQa, prior42And43Unchanged: true,
    uploadedToPlay: false, physicalQa: false, productionPublished: false };
write('audit-release.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
