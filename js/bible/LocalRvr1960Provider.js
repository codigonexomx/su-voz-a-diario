import { BIBLE_BOOK_DEFINITIONS } from './bibleBookIds.js';
import { BIBLE_SOURCE_LOCAL, createBibleChapter } from './bibleModel.js';

export const RVR1960_VERSION_ID = 'rvr60';
export const RVR1960_VERSION_LABEL = 'RVR1960';
export const RVR1960_VERSION_NAME = 'Reina-Valera 1960';
const BOOK_IDS = new Set(BIBLE_BOOK_DEFINITIONS.map(book => book.id));

export class LocalRvr1960Provider {
    constructor({
        dataPath = './data/rvr1960.json',
        fetchImpl = (...args) => fetch(...args)
    } = {}) {
        this.versionId = RVR1960_VERSION_ID;
        this.versionLabel = RVR1960_VERSION_LABEL;
        this.versionName = RVR1960_VERSION_NAME;
        this.source = BIBLE_SOURCE_LOCAL;
        this.dataPath = dataPath;
        this.fetchImpl = fetchImpl;
        this.bibleCache = null;
        this.loadPromise = null;
    }

    getCanonicalBookId(sourceBookId) {
        const id = String(sourceBookId || '').trim().toLowerCase();
        return BOOK_IDS.has(id) ? id : '';
    }

    async loadBible() {
        if (this.bibleCache) return this.bibleCache;
        if (this.loadPromise) return this.loadPromise;
        this.loadPromise = (async () => {
            const response = await this.fetchImpl(this.dataPath);
            if (!response?.ok) throw new Error('No se pudo cargar la Biblia RVR1960 local.');
            const data = await response.json();
            if (!Array.isArray(data) || data.length !== BIBLE_BOOK_DEFINITIONS.length ||
                data.some((book, index) => book?.abbrev !== BIBLE_BOOK_DEFINITIONS[index].id ||
                    !book.name || !Array.isArray(book.chapters) || !book.chapters.length ||
                    book.chapters.some(chapter => !Array.isArray(chapter) || !chapter.length ||
                        chapter.some(text => typeof text !== 'string' || !text.trim())))) {
                throw new Error('El archivo RVR1960 no tiene el formato esperado.');
            }
            this.bibleCache = data;
            return data;
        })().finally(() => { this.loadPromise = null; });
        return this.loadPromise;
    }

    async getBooks() {
        return (await this.loadBible()).map(book => Object.freeze({
            id: book.abbrev,
            name: book.name,
            chapters: book.chapters.length,
            sourceBookId: book.abbrev
        }));
    }

    async getChapter(bookId, chapterNumber) {
        const id = this.getCanonicalBookId(bookId);
        const chapter = Number(chapterNumber);
        if (!id) throw new Error(`No se encontró el libro en RVR1960: ${bookId}`);
        if (!Number.isInteger(chapter) || chapter < 1) {
            throw new Error(`Capítulo RVR1960 inválido: ${chapterNumber}`);
        }
        const book = (await this.loadBible()).find(item => item.abbrev === id);
        const verses = book.chapters[chapter - 1];
        if (!verses) throw new Error(`No se encontró el capítulo ${chapterNumber} en RVR1960.`);
        return createBibleChapter({
            versionId: this.versionId,
            versionLabel: this.versionLabel,
            versionName: this.versionName,
            source: this.source,
            bookId: id,
            sourceBookId: id,
            bookName: book.name,
            chapter,
            verses: verses.map((text, index) => ({
                number: index + 1, text,
                subtitle: book.chapterHeadings?.[chapter - 1]?.[index + 1] || '',
                sourceNotes: book.chapterAnnotations?.[chapter - 1]?.verses?.[index + 1] || [],
                headingNotes: book.chapterAnnotations?.[chapter - 1]?.headings?.[index + 1] || []
            }))
        });
    }
}
