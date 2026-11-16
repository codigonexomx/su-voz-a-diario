// Reproducible, offline import of the two pinned RVR1960 source files.
// Usage: node scripts/import-rvr1960.mjs /path/to/Fuentes
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { BIBLE_BOOK_DEFINITIONS } from '../js/bible/bibleBookIds.js';
import { createRvr1960ReferenceParser, extractRvr1960ChapterAnnotations,
    RVR1960_HTML_OFFSET_NORMALIZATIONS } from './lib/rvr1960References.mjs';

const sourceDir = process.argv[2];
if (!sourceDir) throw new Error('Indica la carpeta Fuentes con las descargas originales.');
const root = new URL('../', import.meta.url);
const sources = [
    { repository: 'mrk214/bible-data-es-spa', commit: '5ff220dbb819a9506bf23e9311c261ebd9522dd4',
      file: 'data/es___spa___spa/RVR1960_vid_149.json', local: 'mrk214/RVR1960_vid_149.json',
      blob: 'd9f8e26d6540575a052ee54f82c8dd7341b9e3ca' },
    { repository: 'thiagobodruk/bible', commit: '4c8b8a4a7bd75fee381e1b55523b152191d6a1a5',
      file: 'json/es_rvr1960.json', local: 'thiagobodruk/es_rvr1960.json',
      blob: 'a6647b2eaaaf12bed8ee1d171954b9079f832aef' }
];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const input = sources.map(source => {
    const bytes = fs.readFileSync(path.join(sourceDir, source.local));
    const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(gitBlob, source.blob, 'El original debe coincidir con la revisión fijada.');
    source.sha256 = sha256(bytes);
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
});
const [rich, comparison] = input;
assert.equal(rich.local_abbreviation, 'RVR1960');
assert.equal(rich.books.length, 66);
assert.equal(comparison.length, 66);
const comparisonAbbrevs = 'gn ex lv nm dt js jz rt 1sm 2sm 1rs 2rs 1cr 2cr ed ne et jó sl pv ec ct is jr lm ez dn os jl am ob jn mq na hc sf ag zc ml mt mc lc jo atos rm 1co 2co gl ef fp cl 1ts 2ts 1tm 2tm tt fm hb tg 1pe 2pe 1jo 2jo 3jo jd ap'.split(' ');
const duplicateChapters = [];
const joinedFragments = [];
const musicalLabels = [];
const terminalLabels = [];
const books = rich.books.map((book, bookIndex) => {
    const id = book.usfm.toLowerCase();
    assert.equal(id, BIBLE_BOOK_DEFINITIONS[bookIndex].id);
    assert.equal(comparison[bookIndex].abbrev, comparisonAbbrevs[bookIndex]);
    const uniqueChapters = new Map();
    for (const chapter of book.chapters) {
        if (uniqueChapters.has(chapter.usfm)) {
            assert.deepEqual(chapter, uniqueChapters.get(chapter.usfm), 'No se descartan capítulos distintos.');
            duplicateChapters.push(chapter.usfm);
        } else uniqueChapters.set(chapter.usfm, chapter);
    }
    const chapterHeadings = [];
    const chapters = [...uniqueChapters.values()].map((chapter, chapterIndex) => {
        assert.equal(chapter.usfm, `${book.usfm}.${chapterIndex + 1}`);
        const verses = [];
        const headings = {};
        let pendingHeadings = [];
        let previousNumber = 0;
        for (const item of chapter.items) {
            const text = item.lines.join(' ').replace(/\s+/gu, ' ').trim();
            assert(text, `Elemento vacío: ${chapter.usfm}`);
            if (item.type === 'verse') {
                assert.equal(item.verse_numbers.length, 1, 'Los rangos requieren una conversión explícita.');
                const number = item.verse_numbers[0];
                assert(Number.isInteger(number) && number > 0);
                assert(number === verses.length + 1 || number === previousNumber);
                if (pendingHeadings.length) {
                    headings[number] = [headings[number], ...pendingHeadings].filter(Boolean).join(' · ');
                    pendingHeadings = [];
                }
                if (verses[number - 1]) {
                    joinedFragments.push(`${chapter.usfm}.${number}`);
                    verses[number - 1] += ` ${text}`;
                } else verses.push(text);
                previousNumber = number;
            } else if (item.type === 'label' && /^(?:Higaion\. )?Selah$/.test(text)) {
                assert(previousNumber > 0);
                verses[previousNumber - 1] += ` ${text}`;
                musicalLabels.push(`${chapter.usfm}.${previousNumber}`);
            } else {
                assert(['heading1', 'section1', 'label'].includes(item.type));
                pendingHeadings.push(text);
            }
        }
        if (pendingHeadings.length) {
            // This source stores the musical closing instruction outside Habakkuk 3:19.
            assert.equal(chapter.usfm, 'HAB.3');
            assert.deepEqual(pendingHeadings, ['Al jefe de los cantores, sobre mis instrumentos de cuerdas.']);
            verses[previousNumber - 1] += ` ${pendingHeadings.join(' ')}`;
            terminalLabels.push(`${chapter.usfm}.${previousNumber}`);
        }
        assert.equal(verses.length, comparison[bookIndex].chapters[chapterIndex].length,
            `Número de versículos discrepante en ${chapter.usfm}`);
        assert(verses.every(text => typeof text === 'string' && text && !/[<>\uFFFD\u0000-\u0008]/u.test(text)));
        chapterHeadings.push(headings);
        return verses;
    });
    assert.equal(chapters.length, comparison[bookIndex].chapters.length);
    return { abbrev: id, name: book.human.replace(/^S\. /, ''), chapters, chapterHeadings };
});
assert.deepEqual(duplicateChapters, ['OBA.1', 'PHM.1', '2JN.1', '3JN.1', 'JUD.1']);
const counts = { books: books.length, chapters: books.reduce((n, b) => n + b.chapters.length, 0),
    verses: books.reduce((n, b) => n + b.chapters.reduce((sum, c) => sum + c.length, 0), 0) };
assert.deepEqual(counts, { books: 66, chapters: 1189, verses: 31104 });
// Keep the first import's biblical text and headings byte-for-byte intact.
const coreContent = JSON.stringify(books) + '\n';
assert.equal(sha256(coreContent), 'fbe1285cdf3611ad670c76c5fcf2fc051a150429d2bf55be1b133565b387cd11');
const parseReferences = createRvr1960ReferenceParser(books);
const annotationCounts = { crossReferences: 0, footnotes: 0, parallels: 0,
    verseAnnotations: 0, headingAnnotations: 0, referenceTargets: 0, titleTargets: 0, unresolved: 0 };
const annotationKindCounts = { 'cross-reference': 'crossReferences', footnote: 'footnotes', parallel: 'parallels' };
for (let index = 0; index < books.length; index++) {
    const sourceChapters = new Map(rich.books[index].chapters.map(chapter => [chapter.usfm, chapter]));
    books[index].chapterAnnotations = books[index].chapters.map((verses, chapterIndex) => {
        const source = sourceChapters.get(rich.books[index].usfm + '.' + (chapterIndex + 1));
        const annotations = extractRvr1960ChapterAnnotations(source, verses, parseReferences);
        for (const [anchor, groups] of Object.entries(annotations)) {
            for (const note of Object.values(groups).flat()) {
                annotationCounts[annotationKindCounts[note.kind]] += 1;
                annotationCounts[anchor === 'verses' ? 'verseAnnotations' : 'headingAnnotations'] += 1;
                annotationCounts.referenceTargets += note.references.length;
                annotationCounts.titleTargets += note.references.filter(reference => reference.titleOnly).length;
            }
        }
        return annotations;
    });
}
assert.equal(annotationCounts.crossReferences, 3482);
assert.equal(annotationCounts.footnotes, 302);
assert.equal(annotationCounts.parallels, 567);
assert.equal(annotationCounts.verseAnnotations, 3771);
assert.equal(annotationCounts.headingAnnotations, 580);
assert.equal(annotationCounts.referenceTargets, 6395);
const content = JSON.stringify(books) + '\n';
const metadata = {
    versionId: 'rvr60', name: 'Reina-Valera 1960', language: 'es',
    source: sources[0], comparisonSource: sources[1],
    copyright: rich.copyright.text,
    formatLicense: fs.readFileSync(path.join(sourceDir, 'mrk214/LICENSE'), 'utf8'),
    note: 'La licencia del formato no sustituye los derechos del texto bíblico. La integración se realiza por instrucción del propietario del proyecto.',
    normalization: { duplicateChapters, joinedFragments, musicalLabels, terminalLabels,
        description: 'Texto de mrk214 sin mezclar traducciones ni corregir palabras. Líneas unidas por espacios. Títulos y epígrafes separados del texto; Selah/Higaion y colofón final conservados. Cinco capítulos idénticos duplicados eliminados.' },
    counts, contentSha256: sha256(content), coreContentSha256: sha256(coreContent),
    annotations: { counts: annotationCounts,
        coverage: 'Todas las 3482 referencias cruzadas, 302 notas textuales y 567 grupos de pasajes paralelos del HTML original. Los 6395 destinos explícitos x/r se resuelven y validan contra el corpus. Las notas f conservan su prosa íntegra sin inferir citas ambiguas.',
        htmlOffsetNormalizations: RVR1960_HTML_OFFSET_NORMALIZATIONS,
        description: 'Las referencias de epígrafes se asocian al título que precede al próximo versículo con texto. Los destinos de título se identifican como título, no como versículo 1. Se preservan las comas y las letras acrósticas del corpus estructurado; sólo se ajusta su correspondencia con el HTML original para calcular offsets.' },
    books: books.map(book => ({ id: book.abbrev, chapterVerseCounts: book.chapters.map(chapter => chapter.length) }))
};
fs.writeFileSync(new URL('data/rvr1960.json', root), content);
fs.writeFileSync(new URL('data/rvr1960-source.json', root), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify({ ...counts, bytes: Buffer.byteLength(content), sha256: metadata.contentSha256,
    duplicateChapters: duplicateChapters.length, joinedFragments: joinedFragments.length,
    musicalLabels: musicalLabels.length, terminalLabels: terminalLabels.length, annotations: annotationCounts }));
