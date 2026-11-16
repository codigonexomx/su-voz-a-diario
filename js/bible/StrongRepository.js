import { BIBLE_BOOK_DEFINITIONS } from './bibleBookIds.js';

const BOOK_IDS = new Set(BIBLE_BOOK_DEFINITIONS.map(book => book.id));
const LANGUAGES = new Set(['hebrew', 'greek']);
const EMPTY_SPANS = Object.freeze([]);

export function normalizeStrongId(value) {
    const match = String(value || '').trim().toUpperCase().match(/^([HG])0*(\d{1,5})$/);
    const number = match ? Number(match[2]) : 0;
    return number > 0 ? `${match[1]}${number}` : '';
}

function searchText(value) {
    return String(value || '').normalize('NFD').replace(/\p{M}/gu, '')
        .toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function splitsSurrogate(text, offset) {
    return offset > 0 && offset < text.length && /[\uD800-\uDBFF]/.test(text[offset - 1])
        && /[\uDC00-\uDFFF]/.test(text[offset]);
}

export class StrongRepository {
    constructor({ dataPath = './data/strong', fetchImpl = (...args) => fetch(...args) } = {}) {
        this.dataPath = String(dataPath).replace(/\/$/, '');
        this.fetchImpl = fetchImpl;
        this.bookCache = new Map();
        this.bookPromises = new Map();
        this.dictionaryCache = new Map();
        this.dictionaryPromises = new Map();
        this.searchCache = new Map();
    }

    async readJson(path, description) {
        const response = await this.fetchImpl(path);
        if (!response?.ok) throw new Error(`No se pudo cargar ${description}. Intenta nuevamente.`);
        return response.json();
    }

    async loadBook(bookId) {
        const id = String(bookId || '').trim().toLowerCase();
        if (!BOOK_IDS.has(id)) throw new Error('El libro solicitado para Strong no es válido.');
        if (this.bookCache.has(id)) return this.bookCache.get(id);
        if (this.bookPromises.has(id)) return this.bookPromises.get(id);
        const promise = (async () => {
            const data = await this.readJson(`${this.dataPath}/books/${id}.json`, 'las palabras Strong de este libro');
            if (!isRecord(data) || data.bookId !== id || !Array.isArray(data.chapters) || !data.chapters.length) {
                throw new Error('El mapa de palabras Strong no tiene el formato esperado.');
            }
            const chapters = data.chapters.map(chapter => {
                if (!isRecord(chapter?.verses)) throw new Error('Faltan los versículos del mapa Strong.');
                const verses = Object.create(null);
                for (const [number, rawSpans] of Object.entries(chapter.verses)) {
                    if (!/^[1-9]\d*$/.test(number) || !Array.isArray(rawSpans)) {
                        throw new Error('El mapa Strong contiene un versículo inválido.');
                    }
                    let previousEnd = 0;
                    const spans = rawSpans.map(span => {
                        if (!isRecord(span) || !Number.isInteger(span.start) || !Number.isInteger(span.end)
                            || span.start < previousEnd || span.end <= span.start || typeof span.text !== 'string'
                            || !span.text.trim() || !Array.isArray(span.ids) || !span.ids.length) {
                            throw new Error('El mapa Strong contiene una palabra o posición inválida.');
                        }
                        const ids = span.ids.map(normalizeStrongId);
                        if (ids.some(value => !value)) throw new Error('El mapa Strong contiene un número inválido.');
                        previousEnd = span.end;
                        return Object.freeze({ start: span.start, end: span.end, text: span.text,
                            ids: Object.freeze([...new Set(ids)]) });
                    });
                    verses[number] = Object.freeze(spans);
                }
                const unaligned = Object.create(null);
                if (chapter.unaligned !== undefined && !isRecord(chapter.unaligned)) {
                    throw new Error('El mapa Strong contiene números sin correspondencia inválidos.');
                }
                for (const [number, rawIds] of Object.entries(chapter.unaligned || {})) {
                    if (!/^[1-9]\d*$/.test(number) || !Array.isArray(rawIds)) {
                        throw new Error('El mapa Strong contiene una lista de números inválida.');
                    }
                    const ids = rawIds.map(normalizeStrongId);
                    if (ids.some(value => !value)) throw new Error('El mapa Strong contiene un número inválido.');
                    unaligned[number] = Object.freeze([...new Set(ids)]);
                }
                const headings = Object.create(null);
                if (chapter.headings !== undefined && !isRecord(chapter.headings)) {
                    throw new Error('El mapa Strong contiene encabezados inválidos.');
                }
                for (const [number, rawIds] of Object.entries(chapter.headings || {})) {
                    if (!/^[1-9]\d*$/.test(number) || !Array.isArray(rawIds)) {
                        throw new Error('El mapa Strong contiene una lista de encabezado inválida.');
                    }
                    const ids = rawIds.map(normalizeStrongId);
                    if (ids.some(value => !value)) throw new Error('El encabezado Strong contiene un número inválido.');
                    headings[number] = Object.freeze([...new Set(ids)]);
                }
                return Object.freeze({ verses: Object.freeze(verses), unaligned: Object.freeze(unaligned), headings: Object.freeze(headings) });
            });
            const book = Object.freeze({ bookId: id, chapters: Object.freeze(chapters) });
            this.bookCache.set(id, book);
            return book;
        })().finally(() => this.bookPromises.delete(id));
        this.bookPromises.set(id, promise);
        return promise;
    }

    async getChapterSpans(bookId, chapterNumber, verses) {
        const id = String(bookId || '').trim().toLowerCase();
        const number = Number(chapterNumber);
        if (!Number.isInteger(number) || number < 1 || !Array.isArray(verses) || !verses.length) {
            throw new Error('El capítulo solicitado para Strong no es válido.');
        }
        const book = await this.loadBook(id);
        try {
            const chapter = book.chapters[number - 1];
            if (!chapter) throw new Error('No se encontró el mapa Strong de este capítulo.');
            const result = Object.create(null);
            const validNumbers = new Set();
            verses.forEach((verse, index) => {
                const verseNumber = typeof verse === 'string' ? index + 1 : Number(verse?.number);
                const text = typeof verse === 'string' ? verse : verse?.text;
                if (!Number.isInteger(verseNumber) || verseNumber < 1 || validNumbers.has(String(verseNumber))
                    || typeof text !== 'string') throw new Error('No se pudo validar el texto del capítulo Strong.');
                validNumbers.add(String(verseNumber));
                const spans = chapter.verses[verseNumber] || EMPTY_SPANS;
                for (const span of spans) {
                    if (span.end > text.length || text.slice(span.start, span.end) !== span.text
                        || splitsSurrogate(text, span.start) || splitsSurrogate(text, span.end)) {
                        throw new Error('Las palabras Strong no coinciden con el texto RVR1960 de este capítulo.');
                    }
                }
                result[verseNumber] = spans;
            });
            if ([...Object.keys(chapter.verses), ...Object.keys(chapter.unaligned), ...Object.keys(chapter.headings)].some(key => !validNumbers.has(key))) {
                throw new Error('El mapa Strong contiene versículos ajenos a este capítulo.');
            }
            return Object.freeze(result);
        } catch (error) {
            // A mismatching cached file must not prevent retry after a corrected download.
            this.bookCache.delete(id);
            throw error;
        }
    }

    async getChapterUnalignedIds(bookId, chapterNumber) {
        const number = Number(chapterNumber);
        if (!Number.isInteger(number) || number < 1) throw new Error('El capítulo solicitado para Strong no es válido.');
        const book = await this.loadBook(bookId);
        const chapter = book.chapters[number - 1];
        if (!chapter) throw new Error('No se encontró el mapa Strong de este capítulo.');
        return chapter.unaligned;
    }

    async getChapterHeadingIds(bookId, chapterNumber) {
        const number = Number(chapterNumber);
        if (!Number.isInteger(number) || number < 1) throw new Error('El capítulo solicitado para Strong no es válido.');
        const book = await this.loadBook(bookId);
        const chapter = book.chapters[number - 1];
        if (!chapter) throw new Error('No se encontró el mapa Strong de este capítulo.');
        return chapter.headings;
    }

    async loadDictionary(language) {
        if (!LANGUAGES.has(language)) throw new Error('El idioma del diccionario Strong no es válido.');
        if (this.dictionaryCache.has(language)) return this.dictionaryCache.get(language);
        if (this.dictionaryPromises.has(language)) return this.dictionaryPromises.get(language);
        const promise = (async () => {
            const raw = await this.readJson(`${this.dataPath}/${language}.json`, 'el diccionario Strong');
            if (!isRecord(raw) || !Object.keys(raw).length) throw new Error('El diccionario Strong está vacío o dañado.');
            const dictionary = Object.create(null);
            const prefix = language === 'hebrew' ? 'H' : 'G';
            for (const [key, value] of Object.entries(raw)) {
                const id = normalizeStrongId(key);
                if (!id || id[0] !== prefix || !isRecord(value) || normalizeStrongId(value.id) !== id
                    || dictionary[id] || typeof value.lemma !== 'string' || typeof value.definition !== 'string'
                    || !value.definition.trim() || (value.language !== language
                        && !(language === 'hebrew' && value.language === 'aramaic'))) {
                    throw new Error('El diccionario Strong contiene una entrada inválida.');
                }
                const related = Array.isArray(value.related) ? value.related.map(normalizeStrongId) : [];
                if (related.some(item => !item)) throw new Error('El diccionario Strong contiene una remisión inválida.');
                dictionary[id] = Object.freeze({
                    ...value, id,
                    transliteration: String(value.transliteration || ''),
                    pronunciation: String(value.pronunciation || ''),
                    related: Object.freeze([...new Set(related)])
                });
            }
            Object.freeze(dictionary);
            this.dictionaryCache.set(language, dictionary);
            this.searchCache.set(language, Object.values(dictionary).map(entry => ({
                entry,
                lemma: searchText(entry.lemma),
                transliteration: searchText(entry.transliteration),
                text: searchText([entry.id, entry.lemma, entry.transliteration, entry.pronunciation,
                    entry.definition, entry.derivation || ''].join(' '))
            })));
            return dictionary;
        })().finally(() => this.dictionaryPromises.delete(language));
        this.dictionaryPromises.set(language, promise);
        return promise;
    }

    async lookup(value) {
        const id = normalizeStrongId(value);
        if (!id) return null;
        const dictionary = await this.loadDictionary(id[0] === 'H' ? 'hebrew' : 'greek');
        return dictionary[id] || null;
    }

    async search({ query = '', language = 'all', limit = 30 } = {}) {
        const value = String(query || '').trim().slice(0, 120);
        if (!value) return [];
        if (!['all', 'hebrew', 'aramaic', 'greek'].includes(language)) {
            throw new Error('El idioma de búsqueda Strong no es válido.');
        }
        const maximum = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(100, Math.floor(Number(limit)))) : 30;
        const languages = language === 'all' ? ['hebrew', 'greek'] : [language === 'aramaic' ? 'hebrew' : language];
        await Promise.all(languages.map(item => this.loadDictionary(item)));
        const rawId = value.replace(/^#\s*/, '');
        const exactId = normalizeStrongId(rawId);
        const numericId = /^0*\d{1,5}$/.test(rawId) ? Number(rawId) : null;
        const needle = searchText(value);
        const tokens = needle.split(' ').filter(Boolean);
        const matches = [];
        for (const name of languages) for (const row of this.searchCache.get(name)) {
            if (language === 'aramaic' && row.entry.language !== 'aramaic') continue;
            if (exactId || numericId !== null) {
                if (row.entry.id === exactId || (!exactId && Number(row.entry.id.slice(1)) === numericId)) {
                    matches.push({ entry: row.entry, score: 0 });
                }
                continue;
            }
            if (!tokens.every(token => row.text.includes(token))) continue;
            const score = row.lemma === needle || row.transliteration === needle ? 0
                : row.lemma.startsWith(needle) || row.transliteration.startsWith(needle) ? 1 : 2;
            matches.push({ entry: row.entry, score });
        }
        matches.sort((a, b) => a.score - b.score || a.entry.id[0].localeCompare(b.entry.id[0])
            || Number(a.entry.id.slice(1)) - Number(b.entry.id.slice(1)));
        return matches.slice(0, maximum).map(match => match.entry);
    }
}
