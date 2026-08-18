import {
    getCrossReferenceBookId,
    normalizeBibleBookId
} from './bibleBookIds.js';

export const FOOTNOTES_PATH = './data/footnotes-espanol-rv1909-FINAL.json';

function normalizeFootnoteEntry(entry) {
    const id = String(entry?.id || '').trim();
    const text = String(entry?.text || '').trim();
    const anchor = entry?.rv1909_anchor;

    if (!id || !text || !anchor || typeof anchor !== 'object' || Array.isArray(anchor)) {
        return null;
    }

    const placement = String(anchor.placement || '').trim();
    const rawOffset = Number(anchor.char_offset);

    return Object.freeze({
        ...entry,
        id,
        text,
        rv1909_anchor: Object.freeze({
            ...anchor,
            placement,
            char_offset: Number.isInteger(rawOffset) ? rawOffset : null,
            display: anchor.display === true
        })
    });
}

function createFootnotesByChapter(footnotes) {
    const footnotesByChapter = new Map();

    Object.entries(footnotes).forEach(([reference, entries]) => {
        const lastDot = reference.lastIndexOf('.');
        if (lastDot <= 0) return;

        const chapterKey = reference.slice(0, lastDot);
        const verse = Number(reference.slice(lastDot + 1));

        if (!Number.isInteger(verse) || verse < 0) return;

        const normalizedEntries = Array.isArray(entries)
            ? entries.map(normalizeFootnoteEntry).filter(Boolean)
            : [];

        if (!normalizedEntries.length) return;

        if (!footnotesByChapter.has(chapterKey)) {
            footnotesByChapter.set(chapterKey, new Map());
        }

        footnotesByChapter.get(chapterKey).set(
            verse,
            Object.freeze(normalizedEntries)
        );
    });

    return footnotesByChapter;
}

function countFootnotes(footnotes) {
    return Object.values(footnotes).reduce(
        (total, entries) => total + (Array.isArray(entries) ? entries.length : 0),
        0
    );
}

export class FootnotesRepository {
    constructor({
        dataPath = FOOTNOTES_PATH,
        fetchImpl = (...args) => fetch(...args)
    } = {}) {
        this.dataPath = dataPath;
        this.fetchImpl = fetchImpl;
        this.dataCache = null;
        this.footnotesByChapter = null;
        this.loadPromise = null;
        this.chapterCache = new Map();
    }

    async load() {
        if (this.dataCache) return this.dataCache;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = this.fetchImpl(this.dataPath)
            .then(async response => {
                if (!response?.ok) {
                    throw new Error('No se pudieron cargar las notas al pie de RV1909.');
                }

                const raw = await response.text();
                const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

                if (!data || typeof data.footnotes !== 'object' || Array.isArray(data.footnotes)) {
                    throw new Error('El archivo de notas al pie no tiene el formato esperado.');
                }

                const totalFootnotes = countFootnotes(data.footnotes);
                const uniqueIds = new Set();
                let anchoredFootnotes = 0;

                Object.values(data.footnotes).forEach(entries => {
                    (Array.isArray(entries) ? entries : []).forEach(entry => {
                        if (entry?.id) uniqueIds.add(String(entry.id));
                        if (entry?.rv1909_anchor && typeof entry.rv1909_anchor === 'object') {
                            anchoredFootnotes += 1;
                        }
                    });
                });

                if (
                    totalFootnotes !== 4846
                    || uniqueIds.size !== 4846
                    || anchoredFootnotes !== 4846
                ) {
                    throw new Error('El archivo de notas al pie no contiene los 4,846 registros RV1909 esperados.');
                }

                this.footnotesByChapter = createFootnotesByChapter(data.footnotes);
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
            !crossReferenceBookId
            || !Number.isInteger(normalizedChapter)
            || normalizedChapter < 1
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
        const indexedFootnotes = this.footnotesByChapter.get(chapterKey);
        const footnotesByVerse = Object.fromEntries(indexedFootnotes || []);
        const frozenFootnotesByVerse = Object.freeze(footnotesByVerse);

        this.chapterCache.set(chapterKey, frozenFootnotesByVerse);
        return frozenFootnotesByVerse;
    }
}
