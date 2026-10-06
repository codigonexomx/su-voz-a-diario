import assert from 'node:assert/strict';
import { prepareLocalBackup, restoreLocalBackup, MAX_BACKUP_BYTES } from '../js/services/BackupService.js';
import { exportJourney } from '../js/services/JourneyService.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const { parseStringPromise } = createRequire(import.meta.url)('xml2js');
const paths = await parseStringPromise(readFileSync('android/app/src/main/res/xml/file_paths.xml', 'utf8'));
assert.deepEqual(paths.paths['cache-path'].map(entry => entry.$.path).sort(), ['backups/', 'meditations/', 'shared-images/']);
assert.equal(Object.keys(paths.paths).length, 2, 'Only the three cache subdirectories and XML namespace are permitted');

class Storage {
    values = new Map();
    failKey;
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index]; }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) {
        if (key === this.failKey) throw new DOMException('Quota', 'QuotaExceededError');
        this.values.set(key, String(value));
    }
    removeItem(key) { this.values.delete(key); }
}
const source = new Storage();
source.setItem('su-voz-note-2026-10-01', JSON.stringify({ dios: 'Nota ficticia de QA' }));
source.setItem('su-voz-read-dates', JSON.stringify(['2026-10-01']));
const backup = { version: '2.1', journeyBackup: exportJourney(source),
    userProfile: { userId: 'not-an-account-to-import', avatarIcon: 'X', avatarColor: '#4A90D9', avatarCategory: 'QA' },
    communityPreferences: { isAnonymous: true, name: null },
    settings: { fontSize: 1.2, reminderTime: '09:00', notificationsEnabled: true, autoSaveNotes: true } };
const target = new Storage();
target.setItem('auth-fixture', 'untouched');
target.setItem('su-voz-note-2026-09-30', JSON.stringify({ dios: 'Nota previa de QA' }));
const plan = prepareLocalBackup(backup, { uid: 'qa-device-two', settings: { notificationsEnabled: false } });
restoreLocalBackup(target, plan);
assert.equal(JSON.parse(target.getItem('suvoz_avatar_profile_qa-device-two')).userId, 'qa-device-two');
assert.equal(target.getItem('suvoz_avatar_profile_not-an-account-to-import'), null);
assert.equal(JSON.parse(target.getItem('su-voz-settings')).notificationsEnabled, false);
assert.equal(target.getItem('reading-size'), '1.2');
assert.equal(target.getItem('auth-fixture'), 'untouched');
const enabled = prepareLocalBackup({ ...backup, settings: { ...backup.settings, notificationsEnabled: false, reminderDays: [1], reminderTime: '12:30' } }, {
    settings: { notificationsEnabled: true, reminderTime: '08:15', reminderDays: [2, 4] }
});
assert.equal(enabled.settings.notificationsEnabled, true);
assert.equal(enabled.settings.reminderTime, '08:15');
assert.deepEqual(enabled.settings.reminderDays, [2, 4]);
assert.equal(enabled.entries['su-voz-reminder-days'], undefined);
assert(target.getItem('su-voz-note-2026-09-30'));
restoreLocalBackup(target, plan);
assert.deepEqual(JSON.parse(target.getItem('su-voz-read-dates')), ['2026-10-01']);
for (const key of ['su-voz-settings', 'communityPrefs', 'suvoz_avatar_profile_qa-device-two', 'su-voz-meditation-index']) {
    const dest = new Storage();
    dest.setItem('su-voz-note-2026-09-30', JSON.stringify({ dios: 'Conservar' }));
    dest.setItem('auth-fixture', 'preserve-auth');
    const before = [...dest.values];
    dest.failKey = key;
    assert.throws(() => restoreLocalBackup(dest, plan), { name: 'QuotaExceededError' });
    assert.deepEqual([...dest.values], before, `Rollback after failure at ${key}`);
}
for (const data of [null, [], {}, { settings: [] }, { communityPreferences: { isAnonymous: 'false' } },
    { settings: { fontSize: '<script>' } }, { settings: { reminderTime: '99:99' } },
    { settings: { reminderDays: [-1] } }, { userProfile: { avatarColor: 'red;url(x)' } }]) {
    assert.throws(() => prepareLocalBackup(data));
}
const malicious = JSON.parse(JSON.stringify(backup));
malicious.settings.__proto__ = { extra: true };
malicious.settings = JSON.parse('{"fontSize":1.2,"__proto__":{"admin":true},"admin":true}');
assert.equal(prepareLocalBackup(malicious).settings.admin, undefined);
assert.equal({}.admin, undefined);
const legacy = new Storage();
restoreLocalBackup(legacy, prepareLocalBackup({ notes: { '2026-10-01': { dios: 'Respaldo anterior' } }, readDates: ['2026-10-01'] }));
assert.equal(JSON.parse(legacy.getItem('su-voz-note-2026-10-01')).dios, 'Respaldo anterior');
assert.equal(MAX_BACKUP_BYTES, 20971520);

const appSource = readFileSync('js/app.js', 'utf8');
const start = appSource.indexOf('importData: function(file)');
const end = appSource.indexOf('resetAllData: function()', start);
const readers = [], alerts = [], toasts = [];
let confirms = 0, reloads = 0, allowImport = false;
const uiStorage = new Storage();
uiStorage.setItem('auth-fixture', 'preserved');
const context = vm.createContext({
    prepareLocalBackup, restoreLocalBackup, MAX_BACKUP_BYTES, AggregateError,
    localStorage: uiStorage, window: {}, location: { reload: () => reloads++ },
    console: { error() {}, warn() {} }, alert: value => alerts.push(value),
    confirm: () => { confirms++; return allowImport; }, setTimeout: callback => callback(),
    FileReader: class {
        constructor() { readers.push(this); }
        readAsText(file) { this.pending = file.readError ? this.onerror() : this.onload({ target: { result: file.text } }); }
    }
});
const importData = vm.runInContext('({' + appSource.slice(start, end).trim().replace(/,$/, '') + '})', context).importData;
const app = { currentUser: { uid: 'qa-import-ui' }, settings: { notificationsEnabled: false },
    showToast: value => toasts.push(value), initTheme() {}, loadFontSize() {}, invalidateMeditationLibraryCache() {} };
async function load(text) {
    importData.call(app, { size: Buffer.byteLength(text), text });
    await readers.at(-1).pending;
}
importData.call(app, { size: MAX_BACKUP_BYTES + 1 });
assert.equal(readers.length, 0);
await load('{invalid JSON');
assert.equal(confirms, 0);
await load(JSON.stringify({ ...backup, settings: { fontSize: 'invalid' } }));
assert.equal(confirms, 0, 'Validate preferences before requesting confirmation or writing notes');
const untouched = [...uiStorage.values];
await load(JSON.stringify(backup));
assert.deepEqual([...uiStorage.values], untouched, 'Cancel does not write');
allowImport = true;
uiStorage.failKey = 'su-voz-settings';
await load(JSON.stringify(backup));
assert.deepEqual([...uiStorage.values], untouched, 'Full UI flow rolls back a late settings failure');
assert.equal(reloads, 0);
uiStorage.failKey = null;
await load(JSON.stringify(backup));
assert.equal(reloads, 1);
assert.equal(uiStorage.getItem('auth-fixture'), 'preserved');
assert.equal(JSON.parse(uiStorage.getItem('su-voz-settings')).notificationsEnabled, false);
const alertCount = alerts.length;
importData.call(app, { size: 1, readError: true });
assert.equal(alerts.length, alertCount);
assert(toasts.some(text => text.includes('No se pudo leer')));
assert(toasts.some(text => text.includes('20 MB')));
console.log('OK: atomic full backup, every late failure rolls back, auth untouched, current UID only, no notification consent import, legacy, invalid inputs and idempotence');
console.log('OK: actual importData handler, size/read/JSON failures, validation-before-confirmation, cancel, rollback after preferences failure and successful reload');
