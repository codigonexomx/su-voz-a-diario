import assert from 'node:assert/strict';
import { parse } from 'node-html-parser';

export const normalizeReferenceText = value => String(value || '').replace(/\s+/gu, ' ').trim();
const SOURCE_BOOK_ABBREVIATIONS = 'Gn Ex Lv Nm Dt Jos Jue Rt 1_S 2_S 1_R 2_R 1_Cr 2_Cr Esd Neh Est Job Sal Pr Ec Cnt Is Jer Lm Ez Dn Os Jl Am Abd Jon Mi Nah Hab Sof Hag Zac Mal Mt Mr Lc Jn Hch Ro 1_Co 2_Co Gá Ef Fil Col 1_Ts 2_Ts 1_Ti 2_Ti Tit Flm He Stg 1_P 2_P 1_Jn 2_Jn 3_Jn Jud Ap'.split(' ').map(s => s.replace('_', ' '));
const PSALM_119_LETTERS = 'Bet Guímel Dálet He Vau Zain Chet Tet Yod Caf Lámed Mem Nun Sámec Ayin Pe Tsade Cof Resh Sin Tau'.split(' ');
export const RVR1960_HTML_OFFSET_NORMALIZATIONS = Object.freeze({
    repeatedPunctuation: ['2CH.8.13', 'COL.2.16', 'PHM.1.10'],
    psalm119HeadingFragments: 21
});
const hasClass = (node, value) => node?.nodeType === 1 && (node.getAttribute('class') || '').split(/\s+/).includes(value);

/** Strict parser for the punctuation and abbreviated books used by the pinned edition. */
export function createRvr1960ReferenceParser(books) {
    assert.equal(books.length, SOURCE_BOOK_ABBREVIATIONS.length);
    const aliases = new Map(SOURCE_BOOK_ABBREVIATIONS.map((alias, index) => [alias, books[index]]));
    const aliasPattern = [...aliases.keys()].sort((a, b) => b.length - a.length)
        .map(alias => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const bookPattern = new RegExp(`^(${aliasPattern})(?:\\.|(?=\\s))\\s+(.+)$`, 'u');
    function validate(point) {
        const book = books.find(b => b.abbrev === point.bookId);
        assert(book && Number.isInteger(point.chapter) && Number.isInteger(point.verse) &&
            point.chapter >= 1 && point.chapter <= book.chapters.length && point.verse >= 1 &&
            point.verse <= book.chapters[point.chapter - 1].length,
        `Referencia fuera del corpus: ${JSON.stringify(point)}`);
    }
    return function parseReferences(original) {
        let text = normalizeReferenceText(original);
        if (text.startsWith('(') && text.endsWith(')')) text = text.slice(1, -1);
        const references = [];
        let book = null;
        let chapter = null;
        for (const rawClause of text.split(';')) {
            // Keep editorial qualifiers in the clickable citation without repeating its source text.
            const gloss = /\(Gr\.\)/.test(rawClause) ? ' (Gr.)' : '';
            const clause = rawClause.replace(/\s*\(Gr\.\)/g, '').trim().replace(/\.$/, '').trim();
            assert(clause, `Cita vacía: ${original}`);
            const explicit = clause.match(bookPattern);
            let numbers = clause;
            if (explicit) {
                book = aliases.get(explicit[1]);
                chapter = book.chapters.length === 1 ? 1 : null;
                numbers = explicit[2];
            }
            assert(book, `Libro no reconocido: ${original} [${clause}]`);
            const title = numbers.match(/^(\d+)\s+tít(?:ulo)?\.?$/u);
            if (title) {
                chapter = Number(title[1]);
                const start = { bookId: book.abbrev, chapter, verse: 1 };
                validate(start);
                references.push({ id: `${book.abbrev}.${chapter}.title`, start, end: { ...start },
                    label: `${book.name} ${chapter}, título`, title: true, titleOnly: true });
                continue;
            }
            for (const group of numbers.split(',')) {
                const pieces = group.trim().split(/[-—–]/u);
                assert(pieces.length <= 2, `Rango no reconocido: ${original}`);
                const points = pieces.map(piece => {
                    const endBook = piece.trim().match(bookPattern);
                    if (endBook) { book = aliases.get(endBook[1]); chapter = book.chapters.length === 1 ? 1 : null; }
                    const parts = (endBook ? endBook[2] : piece.trim()).split('.');
                    assert(parts.length <= 2 && parts.every(part => /^\d+$/.test(part)),
                        `Cita no reconocida: ${original} [${piece}]`);
                    let verse;
                    if (parts.length === 2) { chapter = Number(parts[0]); verse = Number(parts[1]); }
                    else { verse = Number(parts[0]); }
                    assert(chapter !== null, `Falta capítulo: ${original} [${piece}]`);
                    const point = { bookId: book.abbrev, chapter, verse };
                    validate(point);
                    return point;
                });
                const [start] = points;
                const end = points[1] || { ...start };
                const startBook = books.find(b => b.abbrev === start.bookId);
                const endBook = books.find(b => b.abbrev === end.bookId);
                const crossBook = start.bookId !== end.bookId;
                assert(crossBook ? books.indexOf(endBook) > books.indexOf(startBook) :
                    end.chapter > start.chapter || (end.chapter === start.chapter && end.verse >= start.verse),
                    `Rango invertido: ${original}`);
                const suffix = crossBook ? `–${endBook.name} ${end.chapter}:${end.verse}` : end.chapter !== start.chapter ? `–${end.chapter}:${end.verse}` :
                    end.verse !== start.verse ? `–${end.verse}` : '';
                references.push({ id: `${start.bookId}.${start.chapter}.${start.verse}-${end.bookId}.${end.chapter}.${end.verse}`,
                    start, end, label: `${startBook.name} ${start.chapter}:${start.verse}${suffix}${gloss}` });
            }
        }
        assert(references.length, `Referencia sin destino: ${original}`);
        return references;
    };
}

/** Extract all original x/f notes and parallel-passage blocks without changing verse text. */
export function extractRvr1960ChapterAnnotations(chapter, verses, parseReferences) {
    const dom = parse(chapter.html);
    const elements = dom.querySelectorAll('*');
    const order = new Map(elements.map((node, index) => [node, index]));
    const annotations = new Map();
    const reconstructed = new Map();
    const meaningfulVerses = [];
    for (const verseNode of dom.querySelectorAll('.verse')) {
        const usfm = verseNode.getAttribute('data-usfm');
        assert(usfm?.startsWith(chapter.usfm + '.'), `Ancla ajena al capítulo: ${usfm}`);
        const number = Number(usfm.slice(chapter.usfm.length + 1));
        assert(Number.isInteger(number) && number >= 1 && number <= verses.length);
        const pieces = [];
        const notePositions = [];
        function walk(node) {
            if (hasClass(node, 'note')) {
                notePositions.push({ node, prefix: pieces.join('') });
                return;
            }
            if (hasClass(node, 'content')) {
                pieces.push(node.textContent);
                return;
            }
            for (const child of node.childNodes || []) walk(child);
        }
        walk(verseNode);
        const fragment = normalizeReferenceText(pieces.join(''));
        // The raw HTML incorrectly retains each next acrostic title in the preceding verse.
        // The structured source items already separate these exact 21 fragments.
        if (chapter.usfm === 'PSA.119' && number % 8 === 0 &&
            fragment === PSALM_119_LETTERS[number / 8 - 1]) {
            assert.equal(notePositions.length, 0);
            continue;
        }
        const prior = reconstructed.get(number) || '';
        if (fragment) {
            meaningfulVerses.push({ node: verseNode, number, order: order.get(verseNode) });
            reconstructed.set(number, [prior, fragment].filter(Boolean).join(' '));
        }
        for (const { node, prefix } of notePositions) {
            const offset = (prior ? prior.length + (fragment ? 1 : 0) : 0) + normalizeReferenceText(prefix).length;
            annotations.set(node, { anchor: 'verse', number, offset });
        }
    }
    // HTML is an independent view of the same text. Reject offsets if it disagrees.
    for (let number = 1; number <= verses.length; number++) {
        let extracted = reconstructed.get(number);
        if (RVR1960_HTML_OFFSET_NORMALIZATIONS.repeatedPunctuation.includes(`${chapter.usfm}.${number}`)) {
            const position = extracted.indexOf(',,') + 1;
            assert(position > 0 && extracted.indexOf(',,', position) === -1);
            extracted = extracted.slice(0, position) + extracted.slice(position + 1);
            for (const location of annotations.values()) {
                if (location.number === number && location.offset > position) location.offset -= 1;
            }
        }
        if (chapter.usfm === 'HAB.3' && number === 19) {
            const closing = 'Al jefe de los cantores, sobre mis instrumentos de cuerdas.';
            if (!extracted.endsWith(closing)) extracted += ` ${closing}`;
        }
        assert.equal(extracted, verses[number - 1], `Texto HTML difiere de corpus en ${chapter.usfm}.${number}`);
    }
    const result = { verses: {}, headings: {} };
    const sourceNodes = elements.filter(node => hasClass(node, 'note') || hasClass(node, 'r'));
    for (let index = 0; index < sourceNodes.length; index++) {
        const node = sourceNodes[index];
        const parallel = hasClass(node, 'r');
        const kind = parallel ? 'parallel' : hasClass(node, 'x') ? 'cross-reference' :
            hasClass(node, 'f') ? 'footnote' : null;
        assert(kind, `Tipo de nota desconocido en ${chapter.usfm}`);
        const body = parallel ? node : node.querySelector('.body');
        assert(body, `Nota sin cuerpo en ${chapter.usfm}`);
        const text = normalizeReferenceText(body.textContent);
        assert(text, `Nota vacía en ${chapter.usfm}`);
        let location = annotations.get(node);
        if (!location) {
            // Empty repeated verse wrappers after section headings are not anchors.
            const nextVerse = meaningfulVerses.find(item => item.order > order.get(node));
            assert(nextVerse, `Nota de título sin texto siguiente en ${chapter.usfm}`);
            location = { anchor: 'heading', number: nextVerse.number };
        }
        const references = kind === 'footnote' ? [] : parseReferences(text);
        const annotation = { id: `${chapter.usfm.toLowerCase()}.${kind}.${index + 1}`,
            kind, anchor: location.anchor, text, references };
        if (location.anchor === 'verse') {
            assert(location.offset >= 0 && location.offset <= verses[location.number - 1].length);
            annotation.offset = location.offset;
        }
        const target = location.anchor === 'verse' ? result.verses : result.headings;
        (target[location.number] ||= []).push(annotation);
    }
    assert.equal(Object.values(result.verses).flat().length + Object.values(result.headings).flat().length, sourceNodes.length);
    return result;
}
