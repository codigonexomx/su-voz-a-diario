import { getDateString, getPreviousDateString, calculateLongestStreak } from '../utils/progress.js';

export const JOURNEY_KEY = 'su-voz-journey-v1';
const fields = ['dios', 'aprendizaje', 'respuesta', 'oracion'];
export const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && getDateString(new Date(`${value}T12:00:00`)) === value;
const read = (storage, key, fallback) => {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
};
const hasText = note => fields.some(key => String(note?.[key] || '').trim());
const sessionKey = key => key.startsWith('su-voz-meditation-') && key !== 'su-voz-meditation-index' && !key.startsWith('su-voz-meditation-uistate-');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validNotes = notes => object(notes) && fields.every(field => notes[field] === undefined || typeof notes[field] === 'string');
const validState = state => object(state) && state.version === 1 && Array.isArray(state.events)
    && state.events.every(e => object(e) && typeof e.id === 'string' && ['reading','meditation'].includes(e.type) && validDay(e.localDate) && validDay(e.readingDate) && Number.isFinite(Date.parse(e.occurredAt)))
    && object(state.reviews) && Object.values(state.reviews).every(r => object(r) && typeof r.text === 'string' && Number.isFinite(Date.parse(r.updatedAt)));
export function loadJourney(storage) {
    const state = read(storage, JOURNEY_KEY, { version: 1, events: [], reviews: {}, hideStreak: false });
    if (!validState(state)) throw new Error('No se pudo leer el historial de Mi camino');
    return state;
}
export function recordPractice(storage, type, readingDate, sessionId = '', now = new Date()) {
    if (!['reading', 'meditation'].includes(type) || !validDay(readingDate) || readingDate > getDateString(now)) return;
    const state = loadJourney(storage);
    const localDate = getDateString(now);
    const id = `${type}:${sessionId || readingDate}:${localDate}`;
    if (state.events.some(event => event.id === id)) return;
    state.events.push({ id, type, readingDate, sessionId, localDate, occurredAt: now.toISOString(), offsetMinutes: now.getTimezoneOffset() });
    storage.setItem(JOURNEY_KEY, JSON.stringify(state));
}
export function saveReview(storage, id, text, now = new Date()) {
    const state = loadJourney(storage);
    if (!id || !String(text).trim()) throw new Error('Escribe primero tu revisión.');
    state.reviews[id] = { text: String(text).trim().slice(0, 4000), updatedAt: now.toISOString() };
    storage.setItem(JOURNEY_KEY, JSON.stringify(state));
}
export function getJourney(storage, now = new Date(), month = getDateString(now).slice(0, 7)) {
    const state = loadJourney(storage), today = getDateString(now);
    const sessions = [], legacy = [], readDates = read(storage, 'su-voz-read-dates', []);
    if (!Array.isArray(readDates)) throw new Error('Historial de lecturas inválido');
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (sessionKey(key)) {
            const value = read(storage, key, null);
            if (!value || typeof value.id !== 'string' || !value.notes) continue;
            sessions.push(value);
        } else if (key.startsWith('su-voz-note-')) {
            const date = key.slice('su-voz-note-'.length), notes = read(storage, key, {});
            if (validDay(date) && hasText(notes)) legacy.push({ id: `legacy:${date}`, readingId: date, notes, status: 'legacy', updatedAt: Number(notes._lastEditedAt || 0), legacy: true });
        }
    }
    // Legacy is a date-level mirror, not a second session. Never write or delete it here.
    const representedDates = new Set(sessions.map(s => s.readingId));
    const all = [...sessions, ...legacy.filter(s => !representedDates.has(s.readingId))];
    const active = all.filter(s => s.status !== 'archived' && hasText(s.notes));
    active.sort((a,b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0) || a.id.localeCompare(b.id));
    const days = [...new Set(state.events.map(e => e.localDate).filter(d => validDay(d) && d <= today))].sort();
    let cursor = days.includes(today) ? today : getPreviousDateString(today), current = 0;
    while (days.includes(cursor)) { current++; cursor = getPreviousDateString(cursor); }
    const week = [];
    for (let i = 6; i >= 0; i--) { const date = new Date(now); date.setDate(date.getDate() - i); const day = getDateString(date); week.push({ date: day, active: days.includes(day) }); }
    const contentMonth = active.filter(s => String(s.readingId).startsWith(month));
    return { state, today, month, sessions: active, allSessions: all, week, current, longest: calculateLongestStreak(days), days,
        readDates: [...new Set(readDates.filter(validDay))],
        legacyStreak: read(storage, 'su-voz-streak', null),
        continuation: active.find(s => s.status === 'draft'),
        application: active.find(s => String(s.notes.respuesta || '').trim()),
        memories: [...active.filter(s => s.favorite), ...active.filter(s => !s.favorite)].slice(0, 3),
        monthPractice: days.filter(d => d.startsWith(month)).length,
        monthReflections: new Set(contentMonth.map(s => s.readingId)).size,
        monthPrayers: new Set(contentMonth.filter(s => String(s.notes.oracion || '').trim()).map(s => s.readingId)).size
    };
}

// Narrow whitelist: no account credentials, community drafts or analytics identifiers.
const backupKey = key => key === JOURNEY_KEY || key === 'su-voz-read-dates' || key === 'su-voz-streak' || key === 'su-voz-legacy-migrated' || sessionKey(key) || key === 'su-voz-meditation-index' || /^(su-voz-meditation-uistate-|su-voz-note-|su-voz-devotional-refs-|su-voz-devotional-uistate-|su-voz-highlights-|su-voz-selection-notes-|su-voz-deepening-ui-)/.test(key);
export function exportJourney(storage) {
    const entries = {};
    for (let i=0; i<storage.length; i++) { const key = storage.key(i); if (backupKey(key)) entries[key] = storage.getItem(key); }
    return { version: 1, entries };
}
export function validateJourneyBackup(backup) {
    if (backup?.version !== 1 || !backup.entries || Array.isArray(backup.entries) || typeof backup.entries !== 'object') throw new Error('Respaldo de Mi camino inválido');
    for (const [key, raw] of Object.entries(backup.entries)) {
        if (!backupKey(key) || typeof raw !== 'string') throw new Error('El respaldo contiene una clave no permitida');
        const value = JSON.parse(raw);
        if (sessionKey(key) && (!value || typeof value.id !== 'string' || key !== `su-voz-meditation-${value.id}` || !validNotes(value.notes))) throw new Error('Sesión inválida');
        if (key.startsWith('su-voz-note-') && !validNotes(value)) throw new Error('Nota inválida');
        if (key === JOURNEY_KEY && !validState(value)) throw new Error('Actividad inválida');
        if (key === 'su-voz-read-dates' && (!Array.isArray(value) || value.some(d => !validDay(d)))) throw new Error('Fechas inválidas');
        if (key === 'su-voz-meditation-index' && !Array.isArray(value)) throw new Error('Índice inválido');
    }
}
export function restoreJourney(storage, backup) {
    validateJourneyBackup(backup);
    const before = exportJourney(storage);
    // An explicit local safety copy protects overwritten legacy/session versions.
    storage.setItem('su-voz-journey-before-import', JSON.stringify(before));
    try {
        for (const [key, raw] of Object.entries(backup.entries)) {
            if (key === 'su-voz-meditation-index') continue;
            if (key === 'su-voz-read-dates') {
                storage.setItem(key, JSON.stringify([...new Set([...read(storage,key,[]), ...JSON.parse(raw)])]));
            } else if (key === JOURNEY_KEY && storage.getItem(key)) {
                const local = loadJourney(storage), incoming = JSON.parse(raw);
                const events = new Map([...local.events, ...incoming.events].map(e=>[e.id,e]));
                const reviews = { ...local.reviews };
                for (const [id,review] of Object.entries(incoming.reviews)) if (!reviews[id] || review.updatedAt > reviews[id].updatedAt) reviews[id]=review;
                storage.setItem(key, JSON.stringify({ ...incoming, events:[...events.values()], reviews }));
            } else if (sessionKey(key) && storage.getItem(key)) {
                const local = read(storage,key,{}), incoming = JSON.parse(raw);
                if (Number(incoming.updatedAt || 0) > Number(local.updatedAt || 0)) storage.setItem(key, raw);
            } else storage.setItem(key,raw);
        }
        const index=[];
        for(let i=0;i<storage.length;i++) { const key=storage.key(i); if(sessionKey(key)) { const s=read(storage,key,null); if(s?.id) {const {notes,references,...meta}=s; index.push(meta);} } }
        storage.setItem('su-voz-meditation-index',JSON.stringify(index));
    } catch(error) {
        const keys=[]; for(let i=0;i<storage.length;i++) if(backupKey(storage.key(i))) keys.push(storage.key(i));
        for(const key of keys) if(!(key in before.entries)) storage.removeItem(key);
        for(const [key,raw] of Object.entries(before.entries)) storage.setItem(key,raw);
        throw error;
    }
}

// Old backups become the same validated, reversible transaction as new backups.
export function legacyJourneyBackup(data) {
    const entries = {};
    for (const [field,key] of [['readDates','su-voz-read-dates'],['streak','su-voz-streak']]) {
        if(data[field] !== undefined) entries[key]=JSON.stringify(data[field]);
    }
    for(const [field,prefix] of [['notes','su-voz-note-'],['highlights','su-voz-highlights-'],['selectionNotes','su-voz-selection-notes-']]) {
        if(data[field] === undefined) continue;
        if(!object(data[field])) throw new Error('Contenido antiguo inválido');
        for(const [date,value] of Object.entries(data[field])) {
            if(!validDay(date) || (field==='notes' ? !object(value) : !Array.isArray(value))) throw new Error('Contenido antiguo inválido');
            entries[prefix+date]=JSON.stringify(value);
        }
    }
    const backup={version:1,entries};validateJourneyBackup(backup);return backup;
}
