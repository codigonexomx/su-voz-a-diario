import { BIBLE_BOOK_DEFINITIONS, normalizeBibleBookId } from './bibleBookIds.js';
import { BIBLE_SOURCE_LOCAL, createBibleChapter } from './bibleModel.js';

export const TLA_VERSION_ID = 'tla';
export const TLA_VERSION_LABEL = 'TLA';
export const TLA_VERSION_NAME = 'Traducción en Lenguaje Actual';
const BOOK_IDS = new Set(BIBLE_BOOK_DEFINITIONS.map(book => book.id));
const CHAPTER_COUNTS = Object.freeze({
    gen: 50, exo: 40, lev: 27, num: 36, deu: 34, jos: 24, jdg: 21, rut: 4,
    '1sa': 31, '2sa': 24, '1ki': 22, '2ki': 25, '1ch': 29, '2ch': 36,
    ezr: 10, neh: 13, est: 10, job: 42, psa: 150, pro: 31, ecc: 12, sng: 8,
    isa: 66, jer: 52, lam: 5, ezk: 48, dan: 12, hos: 14, jol: 3, amo: 9,
    oba: 1, jon: 4, mic: 7, nam: 3, hab: 3, zep: 3, hag: 2, zec: 14, mal: 4,
    mat: 28, mrk: 16, luk: 24, jhn: 21, act: 28, rom: 16, '1co': 16, '2co': 13,
    gal: 6, eph: 6, php: 4, col: 4, '1th': 5, '2th': 3, '1ti': 6, '2ti': 4,
    tit: 3, phm: 1, heb: 13, jas: 5, '1pe': 5, '2pe': 3, '1jn': 5,
    '2jn': 1, '3jn': 1, jud: 1, rev: 22
});
const BLOCK_TYPES = new Set(['verse', 'heading1', 'heading2', 'label', 'section1', 'section2']);
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
    if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${name} inválido: ${value}`);
    return number;
}

function numberLabel(numbers) {
    return numbers.length > 1 && numbers.every((value, index) => !index || value === numbers[index - 1] + 1)
        ? `${numbers[0]}-${numbers[numbers.length - 1]}` : numbers.join(',');
}

/** TLA preparada, contrato BibleRepository de Su Voz a Diario. Sin dependencias externas. */
export class LocalTlaProvider {
    constructor({ dataPath = './data/tla.json', fetchImpl = (...args) => fetch(...args) } = {}) {
        this.versionId = TLA_VERSION_ID;
        this.versionLabel = TLA_VERSION_LABEL;
        this.versionName = TLA_VERSION_NAME;
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
            if (!response?.ok) throw new Error('No se pudo cargar la Biblia TLA local.');
            const data = await response.json();
            const valid = data?.schemaVersion === 1 && data.versionId === 'tla' &&
                Array.isArray(data.books) && data.books.length === BOOK_IDS.size &&
                new Set(data.books.map(book => book.id)).size === BOOK_IDS.size &&
                data.books.every(book => BOOK_IDS.has(book.id) && typeof book.name === 'string' &&
                    Array.isArray(book.chapters) && book.chapters.length === CHAPTER_COUNTS[book.id] &&
                    book.chapters.every((chapter, index) => chapter.number === index + 1 &&
                        Array.isArray(chapter.blocks) && chapter.blocks.some(block => block?.type === 'verse') &&
                        chapter.blocks.every(block => BLOCK_TYPES.has(block.type) &&
                            Array.isArray(block.lines) && block.lines.every(line => typeof line === 'string') &&
                            Array.isArray(block.verseNumbers) &&
                            (block.type !== 'verse' || (block.verseNumbers.length > 0 &&
                                block.verseNumbers.every((number, numberIndex) =>
                                    Number.isSafeInteger(number) && number > 0 &&
                                    (!numberIndex || number > block.verseNumbers[numberIndex - 1])))))));
            if (!valid) throw new Error('El archivo TLA no corresponde al esquema preparado, versión 1.');
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
        if (!raw) throw new Error(`No se encontró ${bookId} ${chapterNumber} en TLA.`);

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
                number: group.numbers[0], text,
                reference: `${book.name} ${number}:${numberLabel(group.numbers)}`,
                subtitle: group.subtitle, sourceNotes,
                headingNotes: (raw.notes || []).filter(note => group.headingIndices.includes(note.blockIndex))
            };
        });
        const normalized = createBibleChapter({
            versionId: this.versionId, versionLabel: this.versionLabel,
            versionName: this.versionName, source: this.source,
            bookId: id, sourceBookId: id, bookName: book.name, chapter: number, verses
        });
        // Compatibilidad con bibleModel anterior y posterior a NTV: conservar metadatos.
        // Se añaden después de normalizar aunque el modelo ya los soporte.
        return Object.freeze({
            ...normalized,
            verses: Object.freeze(normalized.verses.map((verse, index) => Object.freeze({
                ...verse,
                verseNumbers: Object.freeze(grouped[index].numbers),
                displayNumber: numberLabel(grouped[index].numbers),
                sourceBlockIndices: Object.freeze(grouped[index].indices),
                parts: Object.freeze(grouped[index].parts)
            }))),
            blocks: raw.blocks,
            notes: raw.notes || [],
            tables: raw.tables || [],
            parallelReferences: raw.parallelReferences || [],
            supplementalContent: raw.supplementalContent || [],
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
        const keepPositionedContent = content => Number.isInteger(content.beforeBlockIndex)
            ? retained.has(content.beforeBlockIndex)
            : Number.isInteger(content.afterBlockIndex) ? retained.has(content.afterBlockIndex) : true;
        const supplementalContent = verses.length ? chapter.supplementalContent.filter(keepPositionedContent) : [];
        const supplementalIds = new Set(supplementalContent.map(content => content.id));
        const notes = verses.length ? chapter.notes.filter(note => note.supplementalContentId
            ? supplementalIds.has(note.supplementalContentId)
            : retained.has(note.blockIndex) || note.verseNumbers?.some(value => numberSet.has(value)) ||
                (note.blockIndex == null && !note.verseNumbers?.length)) : [];
        // La referencia paralela precede a su bloque de destino. Si no tiene
        // destino posterior, se conserva junto al bloque anterior o al capítulo.
        const parallelReferences = verses.length ? chapter.parallelReferences.filter(keepPositionedContent) : [];
        const tables = verses.length ? chapter.tables.filter(table =>
            table.sourceBlockIndices?.some(index => retained.has(index)) ||
            (Number.isInteger(table.blockIndex) && retained.has(table.blockIndex)) ||
            table.verseNumbers?.some(number => numberSet.has(number))) : [];
        return Object.freeze({
            ...chapter,
            verses: Object.freeze(verses),
            blocks: blockIndices.map(index => chapter.blocks[index]),
            sourceBlockIndices: blockIndices,
            notes,
            parallelReferences,
            supplementalContent,
            tables,
            requestedRange: { from, to: toVerse == null ? null : to },
            includedVerseNumbers: numbers,
            includesWholeVerseGroups: numbers.some(number => number < from || number > to)
        });
    }

    /** HTML escapado para versions.tla. Respeta el orden de bloques y fragmentos. */
    async renderPassageHtml(bookId, chapterNumber, fromVerse = 1, toVerse = null, { includeNotes = false, includeTables = true } = {}) {
        const passage = await this.getPassage(bookId, chapterNumber, fromVerse, toVerse);
        if (!passage.verses.length) return '';
        const output = [];
        let paragraph = [];
        const seen = new Set();
        const flush = () => { if (paragraph.length) output.push(`<p>${paragraph.join(' ')}</p>`); paragraph = []; };
        const tableHtml = table => '<table class="tla-source-table"><tbody>' + (table.rows || []).map(row =>
            '<tr>' + row.map(cell => {
                const tag = cell.tag === 'th' ? 'th' : 'td';
                const rowSpan = Number.isSafeInteger(cell.rowSpan) && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '';
                const colSpan = Number.isSafeInteger(cell.colSpan) && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
                return `<${tag}${rowSpan}${colSpan}>${escapeHtml(cell.text)}</${tag}>`;
            }).join('') + '</tr>'
        ).join('') + '</tbody></table>';
        const positionedContent = [
            ...passage.supplementalContent.map(content => ({ ...content, contentType: 'supplemental' })),
            ...passage.parallelReferences.map(content => ({ ...content, contentType: 'parallel' }))
        ].sort((a, b) => (a.sourceOrder ?? Number.MAX_SAFE_INTEGER) - (b.sourceOrder ?? Number.MAX_SAFE_INTEGER));
        const renderedContent = new Set();
        const renderPositionedContent = predicate => {
            for (const content of positionedContent.filter(predicate)) {
                if (renderedContent.has(content.id)) continue;
                flush();
                if (content.contentType === 'parallel') {
                    output.push(`<p class="tla-parallel-references" aria-label="Pasajes paralelos">${escapeHtml(content.text)}</p>`);
                } else if (content.kind === 'chapterLabel') {
                    output.push(`<p class="tla-chapter-label">${escapeHtml(content.text)}</p>`);
                } else if (content.kind === 'unnumberedScripture') {
                    output.push(`<p class="tla-unnumbered-scripture" data-supplemental-id="${escapeHtml(content.id)}">${(content.lines || [content.text]).map(escapeHtml).join('<br>')}</p>`);
                }
                renderedContent.add(content.id);
            }
        };
        renderPositionedContent(content => content.beforeBlockIndex == null && content.afterBlockIndex == null);
        for (const [index, block] of passage.blocks.entries()) {
            const sourceIndex = passage.sourceBlockIndices[index];
            renderPositionedContent(content => content.beforeBlockIndex === sourceIndex);
            const text = block.lines.map(escapeHtml).join('<br>');
            if (block.type !== 'verse') {
                flush();
                if (block.type === 'section1') output.push(`<h2 class="tla-section-title">${text}</h2>`);
                else if (block.type === 'section2') output.push(`<p class="tla-section-reference">${text}</p>`);
                else if (block.type === 'heading2') output.push(`<h4>${text}</h4>`);
                else if (block.type === 'label') output.push(`<p class="tla-label"><em>${text}</em></p>`);
                else output.push(`<h3>${text}</h3>`);
            } else {
                if (block.newParagraph) flush();
                const key = groupKey(block.verseNumbers);
                const label = seen.has(key) ? '' : `<sup>${escapeHtml(numberLabel(block.verseNumbers))}</sup> `;
                seen.add(key);
                const blockTables = includeTables ? passage.tables.filter(table =>
                    table.blockIndex === sourceIndex &&
                    Number.isInteger(table.lineStart) && Number.isInteger(table.lineEndExclusive) &&
                    table.lineStart >= 0 && table.lineEndExclusive > table.lineStart &&
                    table.lineEndExclusive <= block.lines.length
                ).sort((a, b) => a.lineStart - b.lineStart) : [];
                if (!blockTables.length) {
                    paragraph.push(`<span data-verse-numbers="${escapeHtml(key)}">${label}${text}</span>`);
                } else {
                    // La tabla sustituye exclusivamente las líneas de datos que
                    // ya estaban en el bloque. No se añade una segunda copia.
                    flush();
                    output.push(`<div class="tla-verse-table" data-verse-numbers="${escapeHtml(key)}">`);
                    let lineIndex = 0;
                    let pendingLabel = label;
                    const appendLines = lines => {
                        if (lines.length || pendingLabel) {
                            output.push(`<p>${pendingLabel}${lines.map(escapeHtml).join('<br>')}</p>`);
                            pendingLabel = '';
                        }
                    };
                    for (const table of blockTables) {
                        if (table.lineStart < lineIndex) throw new Error('Las tablas TLA tienen intervalos de líneas superpuestos.');
                        appendLines(block.lines.slice(lineIndex, table.lineStart));
                        output.push(tableHtml(table));
                        lineIndex = table.lineEndExclusive;
                    }
                    appendLines(block.lines.slice(lineIndex));
                    output.push('</div>');
                }
            }
            renderPositionedContent(content => content.afterBlockIndex === sourceIndex &&
                !passage.sourceBlockIndices.includes(content.beforeBlockIndex));
        }
        flush();
        if (includeNotes && passage.notes.length) {
            output.push('<section class="tla-notes" aria-label="Notas de la traducción"><h4>Notas</h4><ul>');
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
            for (const content of chapter.supplementalContent) {
                if (content.kind !== 'unnumberedScripture' || !normalizeSearch(content.text).includes(needle)) continue;
                results.push({
                    id: content.id, versionId: this.versionId, versionLabel: this.versionLabel,
                    bookId: book.id, bookName: book.name, chapter: chapter.chapter,
                    verse: null, verseNumbers: [], displayNumber: '', text: content.text,
                    reference: `${book.name} ${chapter.chapter}`, chapterOnly: true,
                    supplementalContentId: content.id
                });
                if (results.length >= cap) return results;
            }
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
