import {
    getCrossReferenceBookId,
    normalizeBibleBookId
} from './bibleBookIds.js';

export const SECTION_HEADINGS_PATH = './data/section-headings-español.json';

function normalizeHeadingEntries(entries) {
    if (!Array.isArray(entries)) return [];

    return entries
        .map(entry => {
            const title = String(entry?.title ?? '');

            if (!title) return null;

            return Object.freeze({
                marker: String(entry?.marker || '').trim().toLowerCase(),
                level: Number(entry?.level),
                kind: String(entry?.kind || 'section').trim(),
                title
            });
        })
        .filter(Boolean);
}

function createHeadingsByChapter(headings) {
    const headingsByChapter = new Map();

    Object.entries(headings).forEach(([reference, entries]) => {
        const lastDot = reference.lastIndexOf('.');
        if (lastDot <= 0) return;

        const chapterKey = reference.slice(0, lastDot);
        const verse = Number(reference.slice(lastDot + 1));

        if (!Number.isInteger(verse) || verse < 1) return;

        const normalizedEntries = normalizeHeadingEntries(entries);
        if (!normalizedEntries.length) return;

        if (!headingsByChapter.has(chapterKey)) {
            headingsByChapter.set(chapterKey, new Map());
        }

        headingsByChapter.get(chapterKey).set(verse, normalizedEntries);
    });

    return headingsByChapter;
}

export class SectionHeadingsRepository {
    constructor({
        dataPath = SECTION_HEADINGS_PATH,
        fetchImpl = (...args) => fetch(...args)
    } = {}) {
        this.dataPath = dataPath;
        this.fetchImpl = fetchImpl;
        this.dataCache = null;
        this.headingsByChapter = null;
        this.loadPromise = null;
        this.chapterCache = new Map();
    }

    async load() {
        if (this.dataCache) return this.dataCache;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = this.fetchImpl(this.dataPath)
            .then(async response => {
                if (!response?.ok) {
                    throw new Error('No se pudieron cargar los encabezados de sección.');
                }

                const raw = await response.text();
                const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

                if (!data || typeof data.headings !== 'object' || Array.isArray(data.headings)) {
                    throw new Error('El archivo de encabezados de sección no tiene el formato esperado.');
                }

                this.headingsByChapter = createHeadingsByChapter(data.headings);
                this.dataCache = data;
                return this.dataCache;
            })
            .finally(() => {
                this.loadPromise = null;
            });

        return this.loadPromise;
    }

    getChapterKey(bookId, chapter) {
        const canonicalBookId = normalizeBibleBookId(bookId);
        const crossReferenceBookId = getCrossReferenceBookId(canonicalBookId);
        const normalizedChapter = Number(chapter);

        if (
            !crossReferenceBookId ||
            !Number.isInteger(normalizedChapter) ||
            normalizedChapter < 1
        ) {
            return '';
        }

        return `${crossReferenceBookId}.${normalizedChapter}`;
    }

    async getForChapter(bookId, chapter) {
        const chapterKey = this.getChapterKey(bookId, chapter);

        if (!chapterKey) return {};
        if (this.chapterCache.has(chapterKey)) {
            return this.chapterCache.get(chapterKey);
        }

        await this.load();
        const indexedHeadings = this.headingsByChapter.get(chapterKey);
        const headingsByVerse = Object.fromEntries(indexedHeadings || []);
        const frozenHeadingsByVerse = Object.freeze(headingsByVerse);

        this.chapterCache.set(chapterKey, frozenHeadingsByVerse);
        return frozenHeadingsByVerse;
    }
}
