import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { MeditationSessionStorage as storage } from '../js/MeditationSessionStorage.js';
import { ContinuousReader } from '../js/bible/ContinuousReader.js';
import { handleJourney } from '../js/JourneyView.js';
import { exportJourney, validateJourneyBackup, restoreJourney } from '../js/services/JourneyService.js';

let parsedFiles = 0;
function validateSyntax(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) validateSyntax(path);
        else if (/\.(js|mjs)$/.test(entry.name)) {
            parse(readFileSync(path, 'utf8'), { ecmaVersion: 'latest', sourceType: directory.startsWith('functions') ? 'script' : 'module' });
            parsedFiles++;
        }
    }
}
for (const directory of ['js', 'functions', 'scripts']) validateSyntax(directory);
parse(readFileSync('sw.js', 'utf8'), { ecmaVersion: 'latest', sourceType: 'script' });
console.log(`OK: syntax of ${parsedFiles + 1} JavaScript files`);

function findNode(node, predicate) {
    if (predicate(node)) return node;
    for (const value of Object.values(node)) {
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child?.type) { const found = findNode(child, predicate); if (found) return found; }
        }
    }
}
function functionSource(file, name) {
    const text = readFileSync(file, 'utf8');
    const tree = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
    const node = findNode(tree, item => item.type === 'FunctionDeclaration' && item.id?.name === name);
    assert(node, name);
    return text.slice(node.start, node.end);
}
const values = new Map();
let failKey;
globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { if (key === failKey) throw new DOMException('full', 'QuotaExceededError'); values.set(key, value); },
    removeItem: key => values.delete(key), key: index => [...values.keys()][index], get length() { return values.size; },
};
const session = { id: 'audit', readingId: '2026-10-01', notes: { dios: 'Texto conservado' }, updatedAt: 1 };
storage.save(session);
values.set(storage.getIndexKey(), '{}');
assert.equal(storage.getAllMetadata()[0].id, 'audit');
storage.save({ ...session, updatedAt: 2 });
assert(Array.isArray(JSON.parse(values.get(storage.getIndexKey()))));
const before = values.get(storage.getSessionKey(session.id));
failKey = storage.getIndexKey();
assert.throws(() => storage.save({ ...session, updatedAt: 3 }), { name: 'QuotaExceededError' });
assert.equal(values.get(storage.getSessionKey(session.id)), before, 'Partial session writes roll back');
assert.equal(storage.get('audit').updatedAt, 3, 'Failed edits stay available in memory');
assert.equal(storage.pendingSessions.size, 1);
failKey = undefined;
storage.save(storage.get('audit'));
assert.equal(storage.pendingSessions.size, 0);
console.log('OK: corrupted index recovery, quota rollback, draft preservation and retry');

const staticCache = { match: async () => new Response('precache') };
const dynamicCache = { match: async () => undefined };
const context = vm.createContext({ Response, Request, console, fetch: async () => { throw new Error('offline'); },
    CACHE_NAME: 'current', DYNAMIC_CACHE: 'dynamic', caches: { open: async name => name === 'current' ? staticCache : dynamicCache } });
const networkFirst = vm.runInContext(`${functionSource('sw.js', 'networkFirstStrategy')}; networkFirstStrategy`, context);
assert.equal(await (await networkFirst(new Request('https://example.test/index.html'))).text(), 'precache');
staticCache.match = async () => undefined;
assert.equal((await networkFirst(new Request('https://example.test/missing'))).status, 503);
console.log('OK: offline static fallback and explicit missing-resource response');

globalThis.window = { innerHeight: 800 };
let loads = 0;
const reader = Object.create(ContinuousReader.prototype);
Object.assign(reader, { alive: () => true, entries: [{}], activeEntry: () => reader.entries[0], activate: () => {},
    top: { getBoundingClientRect: () => ({ top: 200, bottom: 250 }) }, bottom: { getBoundingClientRect: () => ({ top: 300, bottom: 350 }) },
    failed: new Set(), autoLoadDirections: new Set([-1, 1]), extend: async () => { loads++; } });
for (let index = 0; index < 20; index++) reader.update();
assert.equal(loads, 2, 'Programmatic/layout scroll cannot cascade beyond one prefetch per direction');
reader.autoLoadDirections = new Set([-1, 1]); reader.entries = Array(8).fill(reader.entries[0]); reader.update();
assert.equal(loads, 2, 'Automatic chapter window is bounded');
console.log('OK: continuous reader does not cascade and respects automatic chapter limit');

const saveContext = vm.createContext({ root: {}, options: { onAutoSave: () => { throw new Error('quota'); }, onSaveError: () => {} },
    getCurrentNote: () => ({ dios: 'draft' }), getUIState: () => ({}), noteSignature: JSON.stringify,
    uiStateSignature: JSON.stringify, lastSavedNoteSignature: 'old', lastSavedUIStateSignature: 'old', console: { error: () => {} } });
const flush = vm.runInContext(`${functionSource('js/MeditationDocument.js', 'flushAutoSave')}; flushAutoSave`, saveContext);
assert.equal(flush(), false);
assert.equal(saveContext.lastSavedNoteSignature, 'old', 'Failed save cannot advance saved signature');
saveContext.options.onAutoSave = () => true;
assert.equal(flush(), true);
assert.notEqual(saveContext.lastSavedNoteSignature, 'old');
console.log('OK: autosave failure is reported and remains retryable');

const app = readFileSync('js/app.js', 'utf8');
let backupCalls = 0;
await handleJourney({ exportAllData: () => { backupCalls++; } }, { dataset: { journey: 'backup' } });
assert.equal(backupCalls, 1, 'Mi camino calls the implemented backup method');
const appTree = parse(app, { ecmaVersion: 'latest', sourceType: 'module' });
const exportNode = findNode(appTree, node => node.type === 'Property' && node.key.name === 'exportAllData');
let exported;
const backupContext = vm.createContext({ Blob, localStorage, exportJourney, MeditationSessionStorage: storage,
    window: { ShareService: { exportBackup: async blob => { exported = JSON.parse(await blob.text()); return { downloaded: true }; } } },
    alert: () => {}, console,
});
const exportBackup = vm.runInContext(`(${app.slice(exportNode.value.start, exportNode.value.end)})`, backupContext);
failKey = storage.getIndexKey();
assert.throws(() => storage.save({ ...session, updatedAt: 4 }));
failKey = undefined;
const exportingApp = { currentUser: null, getUserCommunityPreferences: () => ({}), getReadDates: () => [],
    getTodayDateStr: () => '2026-10-01', getNoteKey: date => `su-voz-note-${date}`, showToast: () => {},
    pendingMeditationNotes: { '2026-10-01': { dios: 'Draft preserved', aprendizaje: '', respuesta: '', oracion: '' } },
    storage: { get: key => JSON.parse(values.get(key)) },
};
await exportBackup.call(exportingApp);
validateJourneyBackup(exported.journeyBackup);
assert.equal(JSON.parse(exported.journeyBackup.entries[storage.getSessionKey('audit')]).updatedAt, 4);
assert.equal(exported.notes['2026-10-01'].dios, 'Draft preserved');
const restoredValues = new Map();
const restoreStorage = { getItem: key => restoredValues.get(key) ?? null, setItem: (key, value) => restoredValues.set(key, value),
    removeItem: key => restoredValues.delete(key), key: index => [...restoredValues.keys()][index], get length() { return restoredValues.size; } };
restoreJourney(restoreStorage, exported.journeyBackup);
assert.equal(JSON.parse(restoredValues.get(storage.getSessionKey('audit'))).updatedAt, 4);
assert.equal(JSON.parse(restoredValues.get('su-voz-note-2026-10-01')).dios, 'Draft preserved');
storage.pendingSessions.clear();
console.log('OK: actual full backup exports pending drafts and restores them in isolated storage');

let clicked = 0, appended = 0, revoked = 0;
const timers = [];
const shareWindow = {};
const shareContext = vm.createContext({ window: shareWindow, console, setTimeout: callback => timers.push(callback),
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => { revoked++; } },
    document: { createElement: () => ({ style: {}, click: () => { clicked++; }, remove: () => {} }), body: { appendChild: () => { appended++; } } },
    FileReader: class { readAsDataURL() { this.result = 'data:application/json;base64,e30='; this.onload(); } },
});
vm.runInContext(readFileSync('js/ShareService.js', 'utf8'), shareContext);
await shareWindow.ShareService.exportBackup(new Blob(['{}']), 'backup.json');
assert.equal(clicked, 1); assert.equal(appended, 1); assert.equal(revoked, 0);
timers[0](); assert.equal(revoked, 1, 'Blob URL survives until the download starts');
let nativeWrites = 0, nativeShares = 0;
shareWindow.Capacitor = { isNativePlatform: () => true, Plugins: {
    Filesystem: { writeFile: async options => { assert.match(options.path, /^backups\//); nativeWrites++; }, getUri: async () => ({ uri: 'file:fixture.json' }) },
    Share: { share: async () => { nativeShares++; } },
} };
assert.equal((await shareWindow.ShareService.exportBackup(new Blob(['{}']), 'backup.json')).shared, true);
assert.equal(nativeWrites, 1); assert.equal(nativeShares, 1);
shareWindow.Capacitor.Plugins.Share.share = async () => { throw { name: 'AbortError' }; };
assert.equal((await shareWindow.ShareService.exportBackup(new Blob(['{}']), 'backup.json')).canceled, true);
console.log('OK: web backup download lifecycle, native file export and cancellation without false success');
assert.match(app, /action === 'library-backup'\) \{ this\.exportAllData\(\)/);
assert.match(app, /pendingSessions/);
assert.match(readFileSync('js/DeepeningShell.js', 'utf8'), /onSaveError: options\.onSaveError/);
const version = /pwaVersion: '([0-9]+)'/.exec(app)[1];
assert.match(readFileSync('js/acquisitionLanding.js', 'utf8'), new RegExp(`pwaVersion: '${version}'`));
console.log('OK: backup button, pending-draft export, error propagation and Analytics version parity');
