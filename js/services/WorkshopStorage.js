import { WORKSHOP_LESSONS, WORKSHOP_PASSAGES, WORKSHOP_SOURCES } from '../workshop/WorkshopContent.js';

export const WORKSHOP_KEY = 'su-voz-workshop-v1';
const lessonIds = WORKSHOP_LESSONS.map(lesson => lesson.id);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = () => { throw new Error('El avance de las lecciones no tiene un formato válido.'); };
export const createWorkshopState = () => ({ version: 1, updatedAt: 0, lastLesson: null,
    reviewed: [], passages: {}, stages: {}, drafts: {}, answers: {} });

export function validateWorkshopState(value) {
    if (!object(value) || Object.keys(value).some(key => !['version', 'updatedAt', 'lastLesson', 'reviewed', 'passages', 'stages', 'drafts', 'answers'].includes(key))
        || value.version !== 1 || !Number.isFinite(value.updatedAt) || value.updatedAt < 0
        || (value.lastLesson !== null && !lessonIds.includes(value.lastLesson))
        || !Array.isArray(value.reviewed) || value.reviewed.length > lessonIds.length
        || value.reviewed.some(id => !lessonIds.includes(id)) || new Set(value.reviewed).size !== value.reviewed.length) fail();
    for (const field of ['passages', 'stages', 'drafts', 'answers']) {
        if (!object(value[field]) || Object.keys(value[field]).some(id => !lessonIds.includes(id))) fail();
    }
    for (const [id, passage] of Object.entries(value.passages)) {
        if (!WORKSHOP_SOURCES[lessonIds.indexOf(id)].includes(passage)) fail();
    }
    for (const field of ['stages', 'answers']) {
        if (Object.values(value[field]).some(step => !Number.isInteger(step) || step < 0 || step > 2)) fail();
    }
    for (const [lesson, passages] of Object.entries(value.drafts)) {
        if (!object(passages) || Object.keys(passages).some(id => !WORKSHOP_SOURCES[lessonIds.indexOf(lesson)].includes(id))) fail();
        for (const stages of Object.values(passages)) {
            if (!object(stages) || Object.keys(stages).some(step => !['0', '1', '2'].includes(step))
                || Object.values(stages).some(text => typeof text !== 'string' || text.length > 2000)) fail();
        }
    }
    if (JSON.stringify(value).length > 1000000) fail();
    return value;
}

export function loadWorkshop(storage) {
    const raw = storage.getItem(WORKSHOP_KEY);
    if (raw === null) return createWorkshopState();
    if (raw.length > 1000000) fail();
    return validateWorkshopState(JSON.parse(raw));
}

export function saveWorkshop(storage, state, now = Date.now()) {
    const next = { ...state, updatedAt: now };
    validateWorkshopState(next);
    storage.setItem(WORKSHOP_KEY, JSON.stringify(next));
    return next;
}

export function mergeWorkshopStates(local, incoming) {
    validateWorkshopState(local); validateWorkshopState(incoming);
    const [older, newer] = local.updatedAt > incoming.updatedAt ? [incoming, local] : [local, incoming];
    const merged = JSON.parse(JSON.stringify(newer));
    merged.reviewed = [...new Set([...older.reviewed, ...newer.reviewed])];
    for (const field of ['passages', 'stages', 'answers']) merged[field] = { ...older[field], ...newer[field] };
    merged.drafts = JSON.parse(JSON.stringify(older.drafts));
    for (const [lesson, passages] of Object.entries(newer.drafts)) {
        merged.drafts[lesson] ||= {};
        for (const [id, stages] of Object.entries(passages)) {
            merged.drafts[lesson][id] = { ...merged.drafts[lesson][id], ...stages };
        }
    }
    return validateWorkshopState(merged);
}

export function getWorkshopPassage(id, bible) {
    const passage = WORKSHOP_PASSAGES[id];
    if (!passage || !Array.isArray(bible)) throw new Error('No se encontró este pasaje.');
    const verses = [];
    for (const [abbrev, chapter, from, to] of passage.ranges) {
        const text = bible.find(book => book.abbrev === abbrev)?.chapters?.[chapter - 1];
        if (!Array.isArray(text) || from < 1 || to < from || to > text.length) throw new Error('El pasaje no está disponible.');
        for (let number = from; number <= to; number++) {
            if (typeof text[number - 1] !== 'string') throw new Error('El pasaje está incompleto.');
            verses.push({ number: `${chapter}:${number}`, text: text[number - 1] });
        }
    }
    return { ...passage, verses };
}
