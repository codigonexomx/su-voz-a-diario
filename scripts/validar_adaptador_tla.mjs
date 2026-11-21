#!/usr/bin/env node
/**
 * Validación reproducible del proveedor local TLA.
 * Paquete: node scripts/validar_adaptador_tla.mjs
 * Proyecto: node scripts/validar_adaptador_tla.mjs --app-root /ruta/su-voz-git
 * Opcionales: --data, --provider, --fixtures, --source, --report (rutas).
 * El modo paquete usa copias del contrato anterior a NTV. No acredita QA de UI.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    const name = process.argv[index];
    assert.ok(['--data', '--provider', '--fixtures', '--source', '--report', '--app-root'].includes(name), `Opción desconocida: ${name}`);
    assert.ok(process.argv[index + 1], `Falta la ruta de ${name}`);
    args.set(name, path.resolve(process.argv[index + 1]));
}
const appRoot = args.get('--app-root') || packageRoot;
const dataPath = args.get('--data') || path.join(appRoot, 'data/tla.json');
const providerPath = args.get('--provider') || path.join(appRoot, 'js/bible/LocalTlaProvider.js');
const fixtureRoot = args.get('--fixtures') || path.join(packageRoot, 'pruebas/contrato_app_referencia');
const dataBytes = await readFile(dataPath);
const data = JSON.parse(dataBytes);
const source = args.has('--source') ? JSON.parse(await readFile(args.get('--source'), 'utf8')) : null;
const rawChapters = new Map();
for (const book of source?.books || []) for (const chapter of book.chapters) {
    const key = `${book.usfm.toLowerCase()}.${Number(chapter.usfm.split('.')[1])}`;
    if (rawChapters.has(key)) assert.deepEqual(chapter, rawChapters.get(key), `Duplicado desigual: ${key}`);
    else rawChapters.set(key, chapter);
}

let tempRoot = null;
let importPath = providerPath;
let contract = 'application_files';
try {
    await access(path.join(path.dirname(providerPath), 'bibleBookIds.js'));
    await access(path.join(path.dirname(providerPath), 'bibleModel.js'));
} catch {
    assert.ok(!args.has('--app-root'), 'Faltan módulos reales de la aplicación. No se sustituyen en modo --app-root.');
    contract = 'reference_contract_before_ntv';
    tempRoot = await mkdtemp(path.join(tmpdir(), 'suvoz-tla-provider-'));
    await writeFile(path.join(tempRoot, 'package.json'), '{"type":"module"}\n');
    for (const name of ['bibleModel.js', 'bibleBookIds.js']) {
        await copyFile(path.join(fixtureRoot, name), path.join(tempRoot, name));
    }
    importPath = path.join(tempRoot, 'LocalTlaProvider.js');
    await copyFile(providerPath, importPath);
}

const counts = {
    books: 0, chapters: 0, blocks: 0, groups: 0, verseReferences: 0,
    rangeGroups: 0, fragmentedGroups: 0, notes: 0, offsets: 0,
    parallelReferences: 0, supplementalContent: 0, supplementalOffsets: 0,
    aliasesChecked: 0, sourceChaptersCompared: 0
};
const checks = [];
const record = (name, details = {}) => checks.push({ name, status: 'passed', ...details });
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
try {
    const { LocalTlaProvider, TLA_VERSION_ID, TLA_VERSION_LABEL, TLA_VERSION_NAME } = await import(pathToFileURL(importPath));
    assert.equal(TLA_VERSION_ID, 'tla');
    assert.equal(TLA_VERSION_LABEL, 'TLA');
    assert.equal(TLA_VERSION_NAME, 'Traducción en Lenguaje Actual');
    let requests = 0;
    const provider = new LocalTlaProvider({ fetchImpl: async () => { requests++; return { ok: true, json: async () => data }; } });
    const books = await provider.getBooks();
    counts.books = books.length;
    assert.equal(books.length, 66);
    assert.equal(new Set(books.map(book => book.id)).size, 66);
    assert.equal(books.filter(book => book.testament === 'ot').length, 39);
    assert.equal(books.filter(book => book.testament === 'nt').length, 27);

    for (const book of data.books) for (const raw of book.chapters) {
        counts.chapters++;
        const chapter = await provider.getChapter(book.id, raw.number);
        const context = `${book.id}.${raw.number}`;
        assert.equal(chapter.versionId, 'tla');
        assert.equal(chapter.bookId, book.id);
        assert.equal(chapter.chapter, raw.number);
        assert.deepEqual(chapter.blocks, raw.blocks, `Orden de bloques: ${context}`);
        assert.deepEqual(chapter.notes, raw.notes || [], `Notas: ${context}`);
        assert.deepEqual(chapter.tables, raw.tables || [], `Tablas: ${context}`);
        assert.deepEqual(chapter.parallelReferences, raw.parallelReferences || [], `Referencias paralelas: ${context}`);
        assert.deepEqual(chapter.supplementalContent, raw.supplementalContent || [], `Contenido HTML suplementario: ${context}`);
        counts.blocks += raw.blocks.length;
        counts.notes += chapter.notes.length;
        counts.parallelReferences += chapter.parallelReferences.length;
        counts.supplementalContent += chapter.supplementalContent.length;
        for (const note of chapter.notes) if (note.supplementalContentId) {
            const content = chapter.supplementalContent.find(item => item.id === note.supplementalContentId);
            assert.ok(content, `Nota suplementaria huérfana: ${context}:${note.id}`);
            assert.ok(content.noteIds.includes(note.id));
            if (note.offset != null) {
                assert.ok(Number.isInteger(note.offset) && note.offset >= 0 && note.offset <= content.text.length,
                    `Offset suplementario UTF-16 inválido: ${context}:${note.id}`);
                counts.supplementalOffsets++;
            }
        }

        const expected = new Map();
        raw.blocks.forEach((block, index) => {
            if (block.type !== 'verse') return;
            const key = block.verseNumbers.join(',');
            if (!expected.has(key)) expected.set(key, { numbers: block.verseNumbers, indices: [], parts: [] });
            const value = expected.get(key);
            value.indices.push(index);
            value.parts.push(block.lines.join('\n'));
        });
        assert.equal(chapter.verses.length, expected.size, `Grupos: ${context}`);
        const occupied = new Set();
        for (const [index, group] of [...expected.values()].entries()) {
            const verse = chapter.verses[index];
            counts.groups++;
            counts.verseReferences += group.numbers.length;
            assert.deepEqual(verse.verseNumbers, group.numbers, `Números explícitos: ${context}`);
            assert.deepEqual(verse.sourceBlockIndices, group.indices, `Índices: ${context}`);
            assert.deepEqual(verse.parts, group.parts, `Fragmentos: ${context}`);
            assert.equal(verse.text, group.parts.join('\n'), `Texto: ${context}`);
            for (const number of group.numbers) {
                assert.ok(!occupied.has(number), `Dos grupos para el mismo número: ${context}:${number}`);
                occupied.add(number);
            }
            if (group.numbers.length > 1) {
                counts.rangeGroups++;
                const aliases = new Set([group.numbers[0], group.numbers[Math.floor(group.numbers.length / 2)], group.numbers.at(-1)]);
                for (const alias of aliases) {
                    const resolved = await provider.getVerse(book.id, raw.number, alias);
                    assert.equal(resolved.text, verse.text, `Alias interior: ${context}:${alias}`);
                    assert.deepEqual(resolved.verseNumbers, group.numbers);
                    counts.aliasesChecked++;
                }
            }
            if (group.indices.length > 1) counts.fragmentedGroups++;
            for (const note of verse.sourceNotes) if (note.offset != null) {
                assert.ok(Number.isInteger(note.offset) && note.offset >= 0 && note.offset <= verse.text.length,
                    `Offset UTF-16 inválido: ${context}:${note.id}`);
                counts.offsets++;
            }
        }
        for (const note of chapter.notes) if (note.verseNumbers?.length) {
            const matches = chapter.verses.filter(verse => verse.verseNumbers.some(number => note.verseNumbers.includes(number)));
            assert.ok(matches.length, `Nota con referencia perdida: ${context}:${note.id}`);
            assert.ok(matches.every(verse => verse.sourceNotes.some(item => item.id === note.id)),
                `Nota no entregada al lector: ${context}:${note.id}`);
        }
        const original = rawChapters.get(context);
        if (original) {
            const groups = new Map();
            for (const item of original.items) if (item.type === 'verse') {
                const key = item.verse_numbers.join(',');
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(item.lines.join('\n'));
            }
            assert.deepEqual(chapter.verses.map(verse => verse.text), [...groups.values()].map(parts => parts.join('\n')),
                `Comparación directa con la fuente: ${context}`);
            counts.sourceChaptersCompared++;
        }
    }
    assert.equal(counts.chapters, 1189);
    if (source) assert.equal(counts.sourceChaptersCompared, 1189);
    assert.equal(requests, 1);
    record('Todos los libros, capítulos, bloques, grupos, notas y alias', { counts: { ...counts } });

    for (const [book, chapter, verse, expectedNumbers, expectedParts] of [
        ['num', 33, 25, Array.from({ length: 50 }, (_, index) => index + 1), 2],
        ['1ch', 23, 12, Array.from({ length: 31 }, (_, index) => index + 2), 5],
        ['isa', 38, 15, Array.from({ length: 22 }, (_, index) => index + 1), 2]
    ]) {
        const passage = await provider.getPassage(book, chapter, verse, verse);
        assert.equal(passage.verses.length, 1);
        assert.deepEqual(passage.includedVerseNumbers, expectedNumbers);
        assert.equal(passage.verses[0].parts.length, expectedParts);
        assert.equal(passage.includesWholeVerseGroups, true);
        assert.equal(passage.blocks.filter(block => block.type === 'verse').length, expectedParts);
        const html = await provider.renderPassageHtml(book, chapter, verse, verse);
        assert.equal((html.match(/<sup>/g) || []).length, 1);
        const positions = passage.verses[0].parts.map(part => html.indexOf(escapeHtml(part.split('\n')[0])));
        assert.ok(positions.every(position => position >= 0));
        assert.ok(positions.every((position, index) => !index || position >= positions[index - 1]));
    }
    record('Rangos extensos y fragmentos intercalados: Números 33, 1 Crónicas 23 e Isaías 38');

    for (const book of ['oba', 'phm', '2jn', '3jn', 'jud']) {
        assert.equal(books.find(item => item.id === book).chapters, 1);
        await assert.rejects(provider.getChapter(book, 2));
    }
    record('Cinco libros de un capítulo sin capítulos duplicados');

    const headings = await provider.renderChapterHtml('gen', 1);
    assert.ok(headings.includes('<h2 class="tla-section-title">'));
    assert.ok(headings.includes('<p class="tla-section-reference">'));
    assert.ok(headings.includes('<h3>'));
    const heading2Chapter = data.books.flatMap(book => book.chapters.map(chapter => ({book, chapter})))
        .find(({chapter}) => chapter.blocks.some(block => block.type === 'heading2'));
    assert.ok(heading2Chapter);
    const heading2Html = await provider.renderChapterHtml(heading2Chapter.book.id, heading2Chapter.chapter.number);
    assert.ok(heading2Html.includes('<h4>'));
    const parallelChapter = await provider.getChapter('1sa', 31);
    const parallelHtml = await provider.renderChapterHtml('1sa', 31);
    for (const reference of parallelChapter.parallelReferences) {
        assert.ok(parallelHtml.includes(escapeHtml(reference.text)), `Referencia paralela ausente: ${reference.id}`);
    }
    record('Jerarquía section1/section2/heading1/heading2 y referencias paralelas');

    const psalm52 = await provider.getChapter('psa', 52);
    const unnumbered = psalm52.supplementalContent.find(content => content.kind === 'unnumberedScripture');
    assert.ok(unnumbered, 'Debe conservarse la línea bíblica no numerada de Salmos 52.');
    assert.equal(unnumbered.text, 'Y tú, campeón de la maldad,');
    assert.ok(psalm52.notes.some(note => note.supplementalContentId === unnumbered.id));
    assert.ok(psalm52.verses.every(verse => verse.number > 0 && !verse.text.includes(unnumbered.text)));
    const psalm52Html = await provider.renderChapterHtml('psa', 52, {includeNotes: true});
    assert.ok(psalm52Html.indexOf(escapeHtml(unnumbered.text)) >= 0);
    assert.ok(psalm52Html.indexOf(escapeHtml(unnumbered.text)) < psalm52Html.indexOf('<sup>1</sup>'));
    const extraSearch = await provider.search('campeón de la maldad', {limit: 10});
    const extraResult = extraSearch.find(result => result.supplementalContentId === unnumbered.id);
    assert.ok(extraResult?.chapterOnly);
    assert.equal(extraResult.verse, null);
    assert.deepEqual(extraResult.verseNumbers, []);
    const nehemiah = await provider.getChapter('neh', 12);
    const nehemiahHtml = await provider.renderChapterHtml('neh', 12, {includeTables: true});
    const headerCells = nehemiah.tables.flatMap(table => table.rows.flat()).filter(cell => cell.tag === 'th');
    assert.equal(headerCells.length, 2);
    for (const cell of headerCells) assert.ok(nehemiahHtml.includes(escapeHtml(cell.text)));
    record('Salmos 52: línea sin número y su nota; títulos de salmos; encabezados de tabla de Nehemías 12');

    const firstNehemiahVerse = await provider.getPassage('neh', 12, 1, 1);
    assert.equal(firstNehemiahVerse.tables.length, 0);
    assert.ok(!(await provider.renderPassageHtml('neh', 12, 1, 1)).includes('<table'));
    const tabularPassage = await provider.getPassage('neh', 12, 12, 21);
    assert.equal(tabularPassage.tables.length, 1);
    const tabularHtml = await provider.renderPassageHtml('neh', 12, 12, 21);
    assert.equal((tabularHtml.match(/<table\b/g) || []).length, 1);
    const sourceTable = nehemiah.tables[0];
    const renderedCells = [...tabularHtml.matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(match => match[2]);
    assert.deepEqual(renderedCells, sourceTable.rows.flat().map(cell => escapeHtml(cell.text)));
    assert.equal(renderedCells.length, 42);
    const sourceBlock = nehemiah.blocks[sourceTable.blockIndex];
    const tableContainer = tabularHtml.match(/<div class="tla-verse-table"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    assert.ok(tableContainer);
    const outsideTable = tableContainer.replace(/<table\b[\s\S]*?<\/table>/g, '');
    const renderedParagraphs = [...outsideTable.matchAll(/<p>([\s\S]*?)<\/p>/g)]
        .map(match => match[1].replace(/<sup>[^<]*<\/sup>\s*/, '').replace(/<br>/g, '\n'));
    const expectedParagraphs = [sourceBlock.lines.slice(0, sourceTable.lineStart), sourceBlock.lines.slice(sourceTable.lineEndExclusive)]
        .filter(lines => lines.length).map(lines => escapeHtml(lines.join('\n')));
    assert.deepEqual(renderedParagraphs, expectedParagraphs, 'La introducción se conserva y las 40 líneas no reaparecen fuera de la tabla.');
    const tagStack = [];
    for (const match of tabularHtml.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi)) {
        const [, close, name] = match;
        if (name === 'br') continue;
        if (close) assert.equal(tagStack.pop(), name, 'Etiquetas HTML correctamente anidadas.');
        else {
            if (name === 'table') assert.ok(!tagStack.some(tag => tag === 'p' || tag === 'span'), 'La tabla no puede anidarse en p o span.');
            tagStack.push(name);
        }
    }
    assert.equal(tagStack.length, 0);
    record('Tabla en su posición: 42 celdas una sola vez, introducción intacta, HTML válido y filtrado por pasaje');

    const search = await provider.search('Cuando Dios comenzó a crear', { limit: 10 });
    assert.ok(search.some(result => result.bookId === 'gen' && result.chapter === 1 && result.verse === 1));
    assert.ok(search.every(result => result.versionId === 'tla'));
    assert.deepEqual(await provider.search('a'), []);
    const alias = await provider.getChapter('Juan', 3);
    assert.equal(alias.bookId, 'jhn');
    await assert.rejects(provider.getChapter('libro-inexistente', 1));
    await assert.rejects(provider.getChapter('gen', 51));
    await assert.rejects(provider.getVerse('gen', 1, 0));
    await assert.rejects(provider.getPassage('gen', 1, 3, 2));
    await assert.rejects(provider.search('Dios', { limit: 0 }));
    record('Búsqueda local, alias de libros y entradas inválidas');

    let concurrentRequests = 0;
    const concurrent = new LocalTlaProvider({ fetchImpl: async () => {
        concurrentRequests++;
        await new Promise(resolve => setTimeout(resolve, 2));
        return {ok: true, json: async () => data};
    }});
    await Promise.all([concurrent.getChapter('gen', 1), concurrent.getChapter('jhn', 3), concurrent.getBooks()]);
    assert.equal(concurrentRequests, 1);
    let retryRequests = 0;
    const retry = new LocalTlaProvider({ fetchImpl: async () => {
        retryRequests++;
        return retryRequests === 1 ? {ok: false} : {ok: true, json: async () => data};
    }});
    await assert.rejects(retry.getBooks());
    assert.equal((await retry.getBooks()).length, 66);
    assert.equal(retryRequests, 2);
    const truncated = structuredClone(data);
    truncated.books[0].chapters.pop();
    await assert.rejects(new LocalTlaProvider({fetchImpl: async () => ({ok: true, json: async () => truncated})}).getBooks());
    record('Una carga concurrente, reintento tras fallo y rechazo de archivo truncado');

    const tainted = structuredClone(data);
    const verseBlock = tainted.books[0].chapters[0].blocks.find(block => block.type === 'verse');
    verseBlock.lines = ['<img src=x onerror=alert(1)> & "texto"'];
    const safe = new LocalTlaProvider({fetchImpl: async () => ({ok: true, json: async () => tainted})});
    const escaped = await safe.renderChapterHtml('gen', 1);
    assert.ok(!escaped.includes('<img'));
    assert.ok(escaped.includes('&lt;img'));
    assert.ok(escaped.includes('&amp;'));
    record('Escape HTML del texto de origen');

    const report = {
        status: 'passed', checkedAt: new Date().toISOString(), contract,
        limitation: 'Validación de datos y contrato del proveedor; no sustituye pruebas de interfaz, caché real, Android ni publicación.',
        sourceComparison: source ? 'all_1189_unique_source_chapters' : 'normalized_data_only',
        data: { file: path.basename(dataPath), bytes: dataBytes.length, sha256: createHash('sha256').update(dataBytes).digest('hex') },
        provider: { file: path.basename(providerPath), sha256: createHash('sha256').update(await readFile(providerPath)).digest('hex') },
        counts, checks
    };
    if (args.has('--report')) {
        await mkdir(path.dirname(args.get('--report')), {recursive: true});
        await writeFile(args.get('--report'), JSON.stringify(report, null, 2) + '\n');
    }
    console.log(JSON.stringify(report, null, 2));
} finally {
    if (tempRoot) await rm(tempRoot, {recursive: true, force: true});
}
