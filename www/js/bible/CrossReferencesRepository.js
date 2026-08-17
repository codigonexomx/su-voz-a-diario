import {
    getCanonicalBibleBookIdFromCrossReference,
    getCrossReferenceBookId,
    normalizeBibleBookId
} from './bibleBookIds.js';

export const CROSS_REFERENCES_PATH = './data/cross-references.json';

function parseVerseEndpoint(value) {
    const match = String(value || '').trim().match(/^([^\.]+)\.(\d+)\.(\d+)$/);

    if (!match) return null;

    const bookId = getCanonicalBibleBookIdFromCrossReference(match[1]);
    const chapter = Number(match[2]);
    const verse = Number(match[3]);

    if (!bookId || !Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) {
        return null;
    }

    return { bookId, chapter, verse };
}

export function parseCrossReferenceReference(value) {
    const rawReference = String(value || '').trim();
    if (!rawReference) return null;

    const [startValue, endValue] = rawReference.split('-');
    const start = parseVerseEndpoint(startValue);
    const end = parseVerseEndpoint(endValue || startValue);

    if (!start || !end) return null;

    return Object.freeze({
        id: rawReference,
        start: Object.freeze(start),
        end: Object.freeze(end),
        isRange: Boolean(endValue)
    });
}

function normalizeReferenceEntries(entries) {
    if (!Array.isArray(entries)) return [];

    return entries
        .map(entry => {
            const reference = parseCrossReferenceReference(entry?.[0]);
            const votes = Number(entry?.[1]);

            if (!reference || !Number.isFinite(votes)) return null;

            return Object.freeze({
                ...reference,
                votes
            });
        })
        .filter(Boolean);
}

export class CrossReferencesRepository {
    constructor({
        dataPath = CROSS_REFERENCES_PATH,
        fetchImpl = (...args) => fetch(...args)
    } = {}) {
        this.dataPath = dataPath;
        this.fetchImpl = fetchImpl;
        this.dataCache = null;
        this.loadPromise = null;
        this.verseCache = new Map();
        this.chapterCache = new Map();
    }

    async load() {
        if (this.dataCache) return this.dataCache;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = this.fetchImpl(this.dataPath)
            .then(async response => {
                if (!response?.ok) {
                    throw new Error('No se pudieron cargar las referencias cruzadas.');
                }

                const raw = await response.text();
                const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

                if (!data || typeof data.references !== 'object' || Array.isArray(data.references)) {
                    throw new Error('El archivo de referencias cruzadas no tiene el formato esperado.');
                }

                this.dataCache = data;
                return this.dataCache;
            })
            .finally(() => {
                this.loadPromise = null;
            });

        return this.loadPromise;
    }

    getVerseKey(bookId, chapter, verse) {
        const crossReferenceBookId = getCrossReferenceBookId(bookId);
        const normalizedChapter = Number(chapter);
        const normalizedVerse = Number(verse);

        if (
            !crossReferenceBookId ||
            !Number.isInteger(normalizedChapter) ||
            normalizedChapter < 1 ||
            !Number.isInteger(normalizedVerse) ||
            normalizedVerse < 1
        ) {
            return '';
        }

        return `${crossReferenceBookId}.${normalizedChapter}.${normalizedVerse}`;
    }

    async getForVerse(bookId, chapter, verse) {
        const canonicalBookId = normalizeBibleBookId(bookId);
        const key = this.getVerseKey(canonicalBookId, chapter, verse);

        if (!key) return [];
        if (this.verseCache.has(key)) return this.verseCache.get(key);

        const data = await this.load();
        const references = Object.freeze(
            normalizeReferenceEntries(data.references[key])
        );

        this.verseCache.set(key, references);
        return references;
    }

    async getForChapter(bookId, chapter) {
        const canonicalBookId = normalizeBibleBookId(bookId);
        const crossReferenceBookId = getCrossReferenceBookId(canonicalBookId);
        const normalizedChapter = Number(chapter);
        const cacheKey = `${canonicalBookId}.${normalizedChapter}`;

        if (!crossReferenceBookId || !Number.isInteger(normalizedChapter) || normalizedChapter < 1) {
            return {};
        }

        if (this.chapterCache.has(cacheKey)) {
            return this.chapterCache.get(cacheKey);
        }

        await this.load();
        const prefix = `${crossReferenceBookId}.${normalizedChapter}.`;
        const chapterReferences = {};

        Object.keys(this.dataCache.references).forEach(key => {
            if (!key.startsWith(prefix)) return;

            const source = parseVerseEndpoint(key);
            if (!source) return;

            const references = Object.freeze(normalizeReferenceEntries(this.dataCache.references[key]));
            this.verseCache.set(key, references);
            chapterReferences[source.verse] = references;
        });

        const frozenChapterReferences = Object.freeze(chapterReferences);
        this.chapterCache.set(cacheKey, frozenChapterReferences);
        return frozenChapterReferences;
    }
}
