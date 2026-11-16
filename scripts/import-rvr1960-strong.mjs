// Import literal Strong-reference positions from the pinned RVR1960+ 2019 MySword module.
// Positions do NOT establish word-level translation equivalence. The source can place a
// number inside a multiword expression (e.g. 'había [H6213] hecho'). UI must link numbers,
// not assert that each captured text fragment translates the corresponding lemma.
// Usage: node scripts/import-rvr1960-strong.mjs /path/to/RVR1960+.bbl.mybible [report-directory]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourcePath = process.argv[2];
assert(sourcePath, 'Indica el módulo RVR1960+.bbl.mybible revisión 2019 descargado.');
const sourceHash = '4fcc8382769712618007c77cdf90a81220646ba26fac848106f5eba1273d5fe7';
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(hash(fs.readFileSync(sourcePath)), sourceHash, 'El módulo debe coincidir con la descarga fijada.');
const base = JSON.parse(fs.readFileSync(path.join(root, 'data/rvr1960.json'), 'utf8'));
const core = base.map(({abbrev, name, chapters, chapterHeadings}) => ({abbrev, name, chapters, chapterHeadings}));
const coreHash = hash(JSON.stringify(core) + '\n');
assert.equal(coreHash, 'fbe1285cdf3611ad670c76c5fcf2fc051a150429d2bf55be1b133565b387cd11', 'Revisar cualquier cambio del texto RVR1960 antes de trasladar referencias.');
const cltPython = '/Library/Developer/CommandLineTools/usr/bin/python3';
const python = process.env.PYTHON || (fs.existsSync(cltPython) ? cltPython : 'python3');
const source = JSON.parse(execFileSync(python, ['-c', `import sqlite3,json,sys,pathlib
p=pathlib.Path(sys.argv[1]).resolve()
c=sqlite3.connect(p.as_uri()+'?mode=ro&immutable=1',uri=True)
assert c.execute('pragma integrity_check').fetchone()[0]=='ok'
print(json.dumps({'rows':c.execute('select Book,Chapter,Verse,Scripture from Bible order by Book,Chapter,Verse').fetchall(),'details':c.execute('select Description,Abbreviation,Comments,Version,VersionDate,PublishDate from Details').fetchone()},ensure_ascii=False))`, path.resolve(sourcePath)], {encoding: 'utf8', maxBuffer: 96 * 1024 * 1024}));
assert.equal(source.rows.length, 31104);
assert.equal(source.details[1], 'RVR1960+');
const words = text => [...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map(match => ({text: match[0], start: match.index, end: match.index + match[0].length}));
// Only case/accent orthography and punctuation are relaxed. No semantic guesses.
const normalizeWord = word => word.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');
const equalWords = (left, right) => left.length === right.length && left.every((word, index) => normalizeWord(word.text) === normalizeWord(right[index].text));
const unique = values => [...new Set(values)];
const sourceIds = new Set();
const counts = {sourceBooks: 66, sourceChapters: 1189, sourceVerses: 31104, baseVerses: 31104, alignedVerses: 0, differingVerses: 0, missingVerses: 0, spans: 0, sourceStrongOccurrences: 0, validSourceStrongOccurrences: 0, invalidSourceStrongOccurrences: 0, alignedStrongOccurrences: 0, unalignedStrongOccurrences: 0, sourceHeadings: 0, headingStrongOccurrences: 0, uniqueStrongIds: 0};
const differences = [], missing = [], detached = [], invalidSourceCodes = [], sourceHeadings = [];
const seen = new Set();
const outputs = base.map(book => ({bookId: book.abbrev, chapters: book.chapters.map(() => ({verses: {}, unaligned: {}}))}));

function sourceReferences(scripture, reference) {
    assert(!/&(?:#|[a-z]+;)/i.test(scripture), 'Las entidades requieren decodificación explícita.');
    const sourceWords = [], anchors = [], unanchored = [], headingIds = [];
    let pending = null, lastAnchor = null;
    const readCode = (raw, scope = 'verse') => {
        counts.sourceStrongOccurrences++;
        if (!/^[HG][1-9]\d*$/.test(raw) || Number(raw.slice(1)) > (raw[0] === 'H' ? 8674 : 5624)) {
            counts.invalidSourceStrongOccurrences++;
            invalidSourceCodes.push({reference, rawCode: raw, scope, reason: 'Código fuera del rango Strong; se conserva sin dividir números concatenados por inferencia.'});
            return null;
        }
        counts.validSourceStrongOccurrences++;
        sourceIds.add(raw);
        return raw;
    };
    for (const token of scripture.matchAll(/<p align="center">[\s\S]*?<\/p>|<Tv>[\s\S]*?<\/Tv>|<Sg>[\s\S]*?<\/Sg>|<[^>]+>|[^<]+/g)) {
        const value = token[0];
        if (value.startsWith('<p align="center">')) {
            counts.sourceHeadings++;
            const titleIds = [];
            for (const match of value.matchAll(/<Sg>(.*?)<\/Sg>/g)) {
                const id = readCode(match[1], 'psalm-heading');
                if (id) { headingIds.push(id); titleIds.push(id); counts.headingStrongOccurrences++; }
            }
            sourceHeadings.push({reference, text: value.replace(/<Tv>[\s\S]*?<\/Tv>|<Sg>[\s\S]*?<\/Sg>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), ids: unique(titleIds)});
            pending = null; lastAnchor = null;
            continue;
        }
        if (value.startsWith('<Tv>')) continue; // Morphology is not Spanish scripture.
        if (value.startsWith('<Sg>')) {
            const id = readCode(value.slice(4, -5));
            if (!id) continue;
            if (pending) {
                lastAnchor = {...pending, ids: [id]}; anchors.push(lastAnchor); pending = null;
            } else if (lastAnchor) lastAnchor.ids.push(id);
            else unanchored.push(id);
            continue;
        }
        assert(!value.startsWith('<'), `Etiqueta desconocida: ${value}`);
        const fragmentWords = words(value);
        if (fragmentWords.length) {
            pending = {first: sourceWords.length, last: sourceWords.length + fragmentWords.length - 1};
            sourceWords.push(...fragmentWords); lastAnchor = null;
        }
        // Bullet explicitly signals an original-language word without a Spanish equivalent.
        if (/•\s*$/.test(value)) { pending = null; lastAnchor = null; }
    }
    return {sourceWords, anchors, unanchored, headingIds};
}

for (const [bookNumber, chapter, verse, scripture] of source.rows) {
    const book = base[bookNumber - 1];
    const text = book?.chapters?.[chapter - 1]?.[verse - 1];
    assert.equal(typeof text, 'string', `Versículo fuera del corpus: ${bookNumber}.${chapter}.${verse}`);
    const key = `${book.abbrev}.${chapter}.${verse}`;
    assert(!seen.has(key)); seen.add(key);
    const parsed = sourceReferences(scripture, key);
    const targetWords = words(text);
    const output = outputs[bookNumber - 1].chapters[chapter - 1];
    if (parsed.headingIds.length) { output.headings ||= {}; output.headings[verse] = unique(parsed.headingIds); }
    const allIds = [...parsed.anchors.flatMap(anchor => anchor.ids), ...parsed.unanchored];
    let remaining;
    if (equalWords(parsed.sourceWords, targetWords)) {
        counts.alignedVerses++;
        const spans = parsed.anchors.map(anchor => {
            const start = targetWords[anchor.first].start, end = targetWords[anchor.last].end;
            counts.alignedStrongOccurrences += anchor.ids.length;
            return {start, end, text: text.slice(start, end), ids: unique(anchor.ids)};
        });
        for (let index = 0; index < spans.length; index++) {
            const span = spans[index];
            assert(span.start < span.end && text.slice(span.start, span.end) === span.text);
            if (index) assert(spans[index - 1].end <= span.start, 'Anclas solapadas.');
        }
        if (spans.length) output.verses[verse] = spans;
        counts.spans += spans.length;
        remaining = parsed.unanchored;
        if (remaining.length) detached.push({reference: key, ids: unique(remaining)});
    } else {
        counts.differingVerses++;
        remaining = allIds;
        differences.push({reference: key, sourceWords: parsed.sourceWords.map(word => word.text).join(' '), baseText: text, ids: unique(allIds)});
    }
    counts.unalignedStrongOccurrences += remaining.length;
    if (remaining.length) output.unaligned[verse] = unique(remaining);
}
for (const book of base) for (const [chapterIndex, chapter] of book.chapters.entries()) for (const [verseIndex] of chapter.entries()) {
    const key = `${book.abbrev}.${chapterIndex + 1}.${verseIndex + 1}`;
    if (!seen.has(key)) { missing.push(key); counts.missingVerses++; }
}
assert.deepEqual(missing, []);
assert.equal(counts.sourceStrongOccurrences, 491610);
assert.equal(counts.invalidSourceStrongOccurrences, 5);
assert.equal(counts.alignedStrongOccurrences + counts.unalignedStrongOccurrences + counts.headingStrongOccurrences, counts.validSourceStrongOccurrences, 'No se pierden códigos Strong válidos.');
assert.equal(counts.validSourceStrongOccurrences + counts.invalidSourceStrongOccurrences, counts.sourceStrongOccurrences);
counts.uniqueStrongIds = sourceIds.size;
const alignedIds = new Set(), unalignedIds = new Set(), headingIds = new Set();
counts.alignedStrongIdsAfterDedup = 0; counts.unalignedStrongIdsAfterDedup = 0; counts.versesWithUnaligned = 0; counts.headingStrongIdsAfterDedup = 0;
for (const book of outputs) for (const chapter of book.chapters) {
    for (const spans of Object.values(chapter.verses)) for (const span of spans) {
        counts.alignedStrongIdsAfterDedup += span.ids.length; span.ids.forEach(id => alignedIds.add(id));
    }
    for (const ids of Object.values(chapter.headings || {})) {
        counts.headingStrongIdsAfterDedup += ids.length; ids.forEach(id => headingIds.add(id));
    }
    for (const ids of Object.values(chapter.unaligned)) {
        counts.unalignedStrongIdsAfterDedup += ids.length; counts.versesWithUnaligned++; ids.forEach(id => unalignedIds.add(id));
    }
}
counts.distinctAlignedIds = alignedIds.size; counts.distinctUnalignedIds = unalignedIds.size; counts.distinctHeadingIds = headingIds.size;
const outDir = path.join(root, 'data/strong/books');
fs.mkdirSync(outDir, {recursive: true});
const files = outputs.map(book => {
    const bytes = JSON.stringify(book) + '\n';
    fs.writeFileSync(path.join(outDir, `${book.bookId}.json`), bytes);
    return {bookId: book.bookId, path: `data/strong/books/${book.bookId}.json`, bytes: Buffer.byteLength(bytes), sha256: hash(bytes), chapters: book.chapters.length};
});
const manifest = {
    schemaVersion: 1, referenceMode: 'literal-source-position',
    versionId: 'rvr60-strong', baseVersionId: 'rvr60', baseCoreContentSha256: coreHash,
    source: {
        name: source.details[0], abbreviation: source.details[1], version: source.details[3], versionDate: source.details[4], publishDate: source.details[5],
        sha256: sourceHash, file: 'RVR1960+.bbl.mybible',
        downloadPage: 'https://drive.google.com/file/d/176PZnPR_wo_b9NQY_nBWQZZSrc3vVO2f/view',
        archiveSha256: 'ad6ef9c82a54760462f57da77c9f75a2ec0bd2a0930aae264c578eca5ae75049',
        sourcePage: 'https://bibliotecahispana.net/index.php/2019/06/22/rvr1960-reina-valera-1960-strong-morfologias/',
        attribution: 'Equipo Biblioteca Hispana Internacional. Página de edición: revisión junio 2019; módulo interno versión 2.5, fecha de publicación declarada 31/01/2020.',
        usageNotice: 'El módulo declara uso personal, prohíbe venta o utilización comercial y no declara vinculación con los propietarios del copyright. No se afirma licencia abierta de redistribución.'
    },
    policy: {
        alignment: 'Referencias Strong colocadas en la posición literal de la fuente RVR1960+. No es una alineación léxica certificada. El código puede aparecer dentro de una expresión: había [H6213] hecho. Los campos start/end/text registran contexto y posición; no afirman que el fragmento sea una traducción del lema. La interfaz debe enlazar los números, no etiquetar el fragmento como palabra equivalente.',
        transfer: 'Se trasladan posiciones sólo cuando la secuencia completa de palabras del versículo coincide, admitiendo caso, acentos y puntuación. Nunca se deduce equivalencia desde otra versión ni se corrigen códigos por inferencia.',
        unaligned: 'Códigos sin ancla y de versículos textualmente diferentes se preservan como otras entradas del versículo, sin asociación con palabras españolas.',
        headings: '116 encabezados de Salmos propios de la fuente no se insertan en el texto RVR. Sus códigos se conservan por separado en chapter.headings[verso] y se presentan como referencias del título, nunca como referencias del versículo.',
        invalid: 'Cinco códigos concatenados fuera del rango Strong se preservan literalmente en invalidSourceCodes; no se dividen ni se inventan enlaces.',
        offsets: 'Índices UTF-16 sobre el texto RVR1960 intacto; end es la posición del número en el texto normalizado.'
    },
    counts, missingVerses: missing, invalidSourceCodes, headingReferences: sourceHeadings, files
};
fs.writeFileSync(path.join(root, 'data/strong/rvr1960-map-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const reportDir = process.argv[3] || path.dirname(path.resolve(sourcePath));
fs.mkdirSync(reportDir, {recursive: true});
fs.writeFileSync(path.join(reportDir, 'RVR1960+ 2019 - auditoria de referencias.json'), JSON.stringify({counts, missing, invalidSourceCodes, sourceHeadings, differences, detached}, null, 2) + '\n');
fs.writeFileSync(path.join(reportDir, 'RVR1960+ 2019 - ficha original.html'), source.details[2]);
console.log(JSON.stringify({...counts, bytes: files.reduce((sum, file) => sum + file.bytes, 0), manifest: 'data/strong/rvr1960-map-manifest.json'}));
