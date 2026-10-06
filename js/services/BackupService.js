import { legacyJourneyBackup, validateJourneyBackup, restoreJourney } from './JourneyService.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = () => { throw new Error('Archivo de respaldo no valido'); };
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export function prepareLocalBackup(data, { uid = null, settings = {} } = {}) {
    if (!object(data)) fail();
    const personal = data.journeyBackup ?? legacyJourneyBackup(data);
    validateJourneyBackup(personal);
    const entries = {};
    let profile = null;
    if (data.userProfile !== undefined) {
        if (!object(data.userProfile)) fail();
        profile = {};
        for (const [key, fallback, limit] of [['avatarIcon', '🕊️', 32], ['avatarColor', '#4A90D9', 7], ['avatarCategory', 'Símbolos Bíblicos', 80]]) {
            const value = data.userProfile[key] ?? fallback;
            if (typeof value !== 'string' || !value || value.length > limit) fail();
            profile[key] = value;
        }
        if (!/^#[0-9a-f]{6}$/i.test(profile.avatarColor)) fail();
        profile.userId = uid || 'local_user';
        profile.updatedAt = new Date().toISOString();
        if (uid) {
            if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) fail();
            entries[`suvoz_avatar_profile_${uid}`] = JSON.stringify(profile);
        }
    }
    if (data.communityPreferences !== undefined) {
        const prefs = data.communityPreferences;
        if (!object(prefs) || (prefs.isAnonymous !== undefined && typeof prefs.isAnonymous !== 'boolean')
            || (prefs.name !== undefined && prefs.name !== null && (typeof prefs.name !== 'string' || prefs.name.length > 30))) fail();
        entries.communityPrefs = JSON.stringify({ isAnonymous: prefs.isAnonymous !== false,
            name: prefs.name || null, lastUpdated: new Date().toISOString() });
    }
    let nextSettings = null;
    if (data.settings !== undefined) {
        if (!object(data.settings)) fail();
        const incoming = {};
        for (const key of ['autoSaveNotes', 'notificationsEnabled']) {
            if (data.settings[key] !== undefined) {
                if (typeof data.settings[key] !== 'boolean') fail();
                incoming[key] = data.settings[key];
            }
        }
        if (data.settings.reminderTime !== undefined) {
            if (typeof data.settings.reminderTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.settings.reminderTime)) fail();
            incoming.reminderTime = data.settings.reminderTime;
        }
        if (data.settings.fontSize !== undefined) {
            if (!Number.isFinite(data.settings.fontSize) || data.settings.fontSize < 0.5 || data.settings.fontSize > 3) fail();
            incoming.fontSize = data.settings.fontSize;
            entries['reading-size'] = String(incoming.fontSize);
        }
        if (data.settings.reminderDays !== undefined) {
            if (!Array.isArray(data.settings.reminderDays) || data.settings.reminderDays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) fail();
            incoming.reminderDays = [...new Set(data.settings.reminderDays)];
        }
        // Restoring a file must not change this device's push consent or server registration.
        incoming.notificationsEnabled = settings.notificationsEnabled === true;
        if (incoming.notificationsEnabled) {
            delete incoming.reminderTime;
            delete incoming.reminderDays;
        }
        if (incoming.reminderDays) entries['su-voz-reminder-days'] = JSON.stringify(incoming.reminderDays);
        nextSettings = { ...settings, ...incoming };
        entries['su-voz-settings'] = JSON.stringify(nextSettings);
    }
    if (!Object.keys(personal.entries).length && !Object.keys(entries).length && !profile) fail();
    return { personal, entries, profile, settings: nextSettings };
}

export function restoreLocalBackup(storage, plan) {
    const before = new Map();
    const transaction = {
        getItem: key => storage.getItem(key),
        key: index => storage.key(index),
        get length() { return storage.length; },
        setItem(key, value) {
            if (!before.has(key)) before.set(key, storage.getItem(key));
            storage.setItem(key, value);
        },
        removeItem(key) {
            if (!before.has(key)) before.set(key, storage.getItem(key));
            storage.removeItem(key);
        }
    };
    try {
        restoreJourney(transaction, plan.personal);
        for (const [key, raw] of Object.entries(plan.entries)) transaction.setItem(key, raw);
    } catch (error) {
        const rollbackErrors = [];
        for (const [key, raw] of [...before].reverse()) {
            try { raw === null ? storage.removeItem(key) : storage.setItem(key, raw); }
            catch (failure) { rollbackErrors.push(failure); }
        }
        if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], 'No se pudo revertir por completo. Conserva el respaldo y no repitas la importacion.');
        throw error;
    }
}
