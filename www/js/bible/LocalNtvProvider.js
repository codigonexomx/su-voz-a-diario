import { BIBLE_BOOK_DEFINITIONS, normalizeBibleBookId } from './bibleBookIds.js';
import { BIBLE_SOURCE_LOCAL, createBibleChapter } from './bibleModel.js';

export const NTV_VERSION_ID = 'ntv';
export const NTV_VERSION_LABEL = 'NTV';
export const NTV_VERSION_NAME = 'Nueva Traducción Viviente';
const BOOK_IDS = new Set(BIBLE_BOOK_DEFINITIONS.map(book => book.id));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));
const normalizeSearch = value => String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
const blockText = block => block.lines.join('\n');
const groupKey = numbers => numbers.join(',');
const overlap = (numbers, from, to) => numbers.some(number => number >= from && number <= to);

function positiveInteger(value, name) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) throw new Error(`${name} inválido: ${value}`);
    return number;
}

function numberLabel(numbers) {
    return numbers.length > 1 && numbers.every((value, index) => !index || value === numbers[index - 1] + 1)
        ? `${numbers[0]}-${numbers[numbers.length - 1]}` : numbers.join(',');
}

/** NTV preparada, contrato BibleRepository de Su Voz a Diario. Sin dependencias externas. */
export class LocalNtvProvider {
    constructor({ dataPath = './data/ntv.json', fetchImpl = (...args) => fetch(...args) } = {}) {
        this.versionId = NTV_VERSION_ID;
        this.versionLabel = NTV_VERSION_LABEL;
        this.versionName = NTV_VERSION_NAME;
        this.source = BIBLE_SOURCE_LOCAL;
        this.dataPath = dataPath;
        this.fetchImpl = fetchImpl;
        this.bibleCache = null;
        this.loadPromise = null;
        this.booksById = new Map();
    }

    getCanonicalBookId(value) {
        const id = normalizeBibleBookId(value);
        return BOOK_IDS.has(id) ? id : '';
    }

    async loadBible() {
        if (this.bibleCache) return this.bibleCache;
        if (this.loadPromise) return this.loadPromise;
        this.loadPromise = (async () => {
            const response = await this.fetchImpl(this.dataPath);
            if (!response?.ok) throw new Error('No se pudo cargar la Biblia NTV local.');
            const data = await response.json();
            const valid = data?.schemaVersion === 1 && data.versionId === 'ntv' &&
                Array.isArray(data.books) && data.books.length === BOOK_IDS.size &&
                new Set(data.books.map(book => book.id)).size === BOOK_IDS.size &&
                data.books.every(book => BOOK_IDS.has(book.id) && typeof book.name === 'string' &&
                    Array.isArray(book.chapters) && book.chapters.length &&
                    book.chapters.every((chapter, index) => chapter.number === index + 1 &&
                        Array.isArray(chapter.blocks) && chapter.blocks.every(block =>
                            Array.isArray(block.lines) && block.lines.every(line => typeof line === 'string') &&
                            Array.isArray(block.verseNumbers) &&
                            (block.type !== 'verse' || (block.verseNumbers.length > 0 &&
                                block.verseNumbers.every(number => Number.isInteger(number) && number > 0))))));
            if (!valid) throw new Error('El archivo NTV no corresponde al esquema preparado, versión 1.');
            this.booksById = new Map(data.books.map(book => [book.id, book]));
            this.bibleCache = data;
            return data;
        })().finally(() => { this.loadPromise = null; });
        return this.loadPromise;
    }

    async getBooks() {
        const data = await this.loadBible();
        return data.books.map(book => Object.freeze({
            id: book.id, name: book.name, chapters: book.chapters.length,
            sourceBookId: book.id, testament: BOOK_IDS.has(book.id) &&
                BIBLE_BOOK_DEFINITIONS.findIndex(item => item.id === book.id) < 39 ? 'ot' : 'nt'
        }));
    }

    async getChapter(bookId, chapterNumber) {
        await this.loadBible();
        const id = this.getCanonicalBookId(bookId);
        const number = positiveInteger(chapterNumber, 'Capítulo');
        const book = this.booksById.get(id);
        const raw = book?.chapters[number - 1];
        if (!raw) throw new Error(`No se encontró ${bookId} ${chapterNumber} en NTV.`);

        // El mismo versículo puede estar dividido por etiquetas o encabezados.
        // Se agregan todos sus fragmentos; nunca se sobrescribe un texto anterior.
        const groups = new Map();
        let precedingHeadings = [];
        let precedingHeadingIndices = [];
        raw.blocks.forEach((block, blockIndex) => {
            if (block.type !== 'verse') {
                precedingHeadings.push(blockText(block));
                precedingHeadingIndices.push(blockIndex);
                return;
            }
            const key = groupKey(block.verseNumbers);
            if (!groups.has(key)) groups.set(key, {
                numbers: [...block.verseNumbers], parts: [], indices: [], headingIndices: [],
                subtitle: precedingHeadings.join('\n')
            });
            const group = groups.get(key);
            group.parts.push(blockText(block));
            group.indices.push(blockIndex);
            group.headingIndices.push(...precedingHeadingIndices);
            precedingHeadings = [];
            precedingHeadingIndices = [];
        });
        const grouped = [...groups.values()];
        const verses = grouped.map(group => {
            const text = group.parts.join('\n');
            // Los offsets del archivo ya son relativos al texto COMPLETO del grupo.
            // Las notas de un versículo fragmentado pueden tener blockIndex=null.
            const sourceNotes = (raw.notes || []).filter(note =>
                group.indices.includes(note.blockIndex) ||
                note.verseNumbers?.some(number => group.numbers.includes(number))
            ).map(note => {
                const output = { ...note };
                if (!Number.isInteger(note.offset) || note.offset < 0 || note.offset > text.length) {
                    delete output.offset;
                }
                return output;
            });
            return {
                number: group.numbers[0],
                verseNumbers: group.numbers,
                displayNumber: numberLabel(group.numbers),
                sourceBlockIndices: group.indices,
                parts: group.parts,
                text,
                reference: `${book.name} ${number}:${numberLabel(group.numbers)}`,
                subtitle: group.subtitle,
                sourceNotes,
                headingNotes: (raw.notes || []).filter(note => group.headingIndices.includes(note.blockIndex))
            };
        });
        return createBibleChapter({
            versionId: this.versionId, versionLabel: this.versionLabel,
            versionName: this.versionName, source: this.source,
            bookId: id, sourceBookId: id, bookName: book.name, chapter: number, verses,
            blocks: raw.blocks,
            notes: raw.notes || [],
            tables: raw.tables || [],
            copyright: this.bibleCache.copyright
        });
    }

    async getVerse(bookId, chapterNumber, verseNumber) {
        const number = positiveInteger(verseNumber, 'Versículo');
        const chapter = await this.getChapter(bookId, chapterNumber);
        return chapter.verses.find(verse => verse.verseNumbers.includes(number)) || null;
    }

    /** Intervalo dentro de UN capítulo. Un grupo se entrega entero, una sola vez. */
    async getPassage(bookId, chapterNumber, fromVerse = 1, toVerse = null) {
        const chapter = await this.getChapter(bookId, chapterNumber);
        const from = positiveInteger(fromVerse, 'Versículo inicial');
        const to = toVerse == null ? Number.MAX_SAFE_INTEGER : positiveInteger(toVerse, 'Versículo final');
        if (to < from) throw new Error('El versículo final debe ser mayor o igual al inicial.');
        const verses = chapter.verses.filter(verse => overlap(verse.verseNumbers, from, to));
        const selected = new Set(verses.flatMap(verse => verse.sourceBlockIndices));
        const indices = [...selected].sort((a, b) => a - b);
        let first = indices[0] ?? 0;
        while (first > 0 && chapter.blocks[first - 1].type !== 'verse') first -= 1;
        let last = indices[indices.length - 1] ?? -1;
        // Algunos salmos terminan con una etiqueta (p. ej. Interludio) después del
        // último versículo; forma parte del capítulo y no debe desaparecer.
        if (last >= 0 && chapter.blocks.slice(last + 1).every(block => block.type !== 'verse')) {
            last = chapter.blocks.length - 1;
        }
        const blockIndices = chapter.blocks.map((_, index) => index)
            .filter(index => index >= first && index <= last &&
                (chapter.blocks[index].type !== 'verse' || selected.has(index)));
        const retained = new Set(blockIndices);
        const numbers = [...new Set(verses.flatMap(verse => verse.verseNumbers))].sort((a, b) => a - b);
        const numberSet = new Set(numbers);
        const notes = verses.length ? chapter.notes.filter(note =>
            retained.has(note.blockIndex) || note.verseNumbers?.some(value => numberSet.has(value)) ||
            (note.blockIndex == null && !note.verseNumbers?.length)) : [];
        return Object.freeze({
            ...chapter,
            verses: Object.freeze(verses),
            blocks: blockIndices.map(index => chapter.blocks[index]),
            sourceBlockIndices: blockIndices,
            notes,
            requestedRange: { from, to: toVerse == null ? null : to },
            includedVerseNumbers: numbers,
            includesWholeVerseGroups: numbers.some(number => number < from || number > to)
        });
    }

    /** HTML escapado para versions.ntv. Respeta el orden de bloques y fragmentos. */
    async renderPassageHtml(bookId, chapterNumber, fromVerse = 1, toVerse = null, { includeNotes = false } = {}) {
        const passage = await this.getPassage(bookId, chapterNumber, fromVerse, toVerse);
        if (!passage.verses.length) return '';
        const output = [];
        let paragraph = [];
        const seen = new Set();
        const flush = () => { if (paragraph.length) output.push(`<p>${paragraph.join(' ')}</p>`); paragraph = []; };
        for (const block of passage.blocks) {
            const text = block.lines.map(escapeHtml).join('<br>');
            if (block.type !== 'verse') {
                flush();
                output.push(block.type === 'label' ? `<p class="ntv-label"><em>${text}</em></p>` : `<h3>${text}</h3>`);
                continue;
            }
            if (block.newParagraph) flush();
            const key = groupKey(block.verseNumbers);
            const label = seen.has(key) ? '' : `<sup>${escapeHtml(numberLabel(block.verseNumbers))}</sup> `;
            seen.add(key);
            paragraph.push(`<span data-verse-numbers="${escapeHtml(key)}">${label}${text}</span>`);
        }
        flush();
        if (includeNotes && passage.notes.length) {
            output.push('<section class="ntv-notes" aria-label="Notas de la traducción"><h4>Notas</h4><ul>');
            for (const note of passage.notes) {
                const reference = note.reference ? `${escapeHtml(note.reference)}: ` : '';
                output.push(`<li>${reference}${escapeHtml(note.text)}</li>`);
            }
            output.push('</ul></section>');
        }
        return output.join('\n');
    }

    async renderChapterHtml(bookId, chapterNumber, options = {}) {
        return this.renderPassageHtml(bookId, chapterNumber, 1, null, options);
    }

    /** Búsqueda local sencilla; un resultado por grupo, sin repetir fragmentos. */
    async search(query, { limit = 50 } = {}) {
        const needle = normalizeSearch(query);
        if (needle.length < 2) return [];
        const cap = Math.min(500, positiveInteger(limit, 'Límite'));
        const data = await this.loadBible();
        const results = [];
        for (const book of data.books) for (const sourceChapter of book.chapters) {
            const chapter = await this.getChapter(book.id, sourceChapter.number);
            for (const verse of chapter.verses) {
                if (!normalizeSearch(verse.text).includes(needle)) continue;
                results.push({
                    id: `${book.id}.${chapter.chapter}.${verse.number}`,
                    versionId: this.versionId, versionLabel: this.versionLabel,
                    bookId: book.id, bookName: book.name, chapter: chapter.chapter,
                    verse: verse.number, verseNumbers: verse.verseNumbers,
                    displayNumber: verse.displayNumber, text: verse.text, reference: verse.reference
                });
                if (results.length >= cap) return results;
            }
        }
        return results;
    }
}
