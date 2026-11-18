import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { validatePackage, lookupVerse } from '../js/bible/commentaryLookup.js';

// The editorial project holds the unchanged English source, DeepSeek deliveries,
// exact patches and assisted reviews. This importer never translates the prose.
const base = process.argv[2];
if (!base) throw new Error('Uso: node scripts/import-matthew-henry.mjs /ruta/al/proyecto-editorial');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async path => {
    const bytes = await readFile(path);
    return { value: JSON.parse(bytes), sha256: hash(bytes) };
};
const progress = (await read(join(resolve(base), 'translation-progress.json'))).value;
const batches = progress.batches.filter(batch => batch.id.startsWith('mhcc-b66-'));
assert.equal(batches.length, 6, 'Se requieren los seis lotes completos de Apocalipsis.');
const counts = [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21];
const entries = [], deliveries = [], translationNotes = [];
let sourceWords = 0;
for (const batch of batches) {
    assert.match(batch.status, /^(?:assisted-reviewed(?:-with-editorial-notes)?|draft-assisted-review-complete-source-uncertainties-open)$/, `Revisión pendiente: ${batch.id}`);
    const source = await read(join(base, 'lotes', batch.id + '.json'));
    const delivery = await read(join(base, batch.translationFile));
    const review = await read(join(base, batch.reviewFile));
    assert.equal(delivery.sha256, batch.translationSha256);
    assert.equal(review.sha256, batch.reviewSha256);
    assert.equal(review.value.responseSha256, delivery.sha256, 'La revisión debe corresponder a la entrega exacta.');
    assert.equal(review.value.sourceBatchSha256, source.sha256, 'La revisión debe corresponder al original exacto.');
    assert.equal(review.value.blocksNextDraftBatch, false, 'Hay correcciones pendientes.');
    assert.equal(delivery.value.translator, 'DeepSeek');
    assert.equal(delivery.value.completed, true);
    assert.deepEqual(delivery.value.pendingEntryIds, []);
    const originals = source.value.chapters.flatMap(chapter => chapter.entries);
    assert.deepEqual(delivery.value.entries.map(entry => entry.id), originals.map(entry => entry.id));
    for (const [index, original] of originals.entries()) {
        const translated = delivery.value.entries[index];
        const { chapter, verses, text: english } = original.sourceEntry;
        assert.equal(hash(english), original.textSha256);
        assert.equal(typeof translated.text_es, 'string');
        assert(translated.text_es.trim());
        assert.deepEqual(verses, Array.from({ length: verses.at(-1) - verses[0] + 1 }, (_, i) => verses[0] + i));
        sourceWords += original.sourceWordCount;
        const title = `Apocalipsis ${chapter}:${verses[0]}${verses.length > 1 ? '–' + verses.at(-1) : ''}`;
        entries.push({
            id: original.id, kind: 'commentary', title, authorChapter: chapter,
            parentId: null, order: entries.length, depth: 0,
            mappingStatus: 'confirmed', mappingBasis: { type: 'explicit-source-verse-heading', sourceOsis: original.sourceEntry.osis },
            ranges: [{ start: { bookId: 'rev', chapter, verse: verses[0] }, end: { bookId: 'rev', chapter, verse: verses.at(-1) } }],
            text: translated.text_es, textSha256: hash(translated.text_es),
            sourceTextSha256: original.textSha256, sourceSpans: [], sourcePages: [],
            notesGroupId: null, assetIds: [],
            translationNotes: translated.notes || [],
            review: { translation: 'DeepSeek', fidelity: 'assisted-reviewed', humanReview: 'pending', deliverySha256: delivery.sha256 }
        });
        for (const note of translated.notes || []) translationNotes.push({ entryId: original.id, note });
    }
    deliveries.push({ batchId: batch.id, revision: batch.revision, sourceSha256: source.sha256,
        translationSha256: delivery.sha256, reviewSha256: review.sha256, reviewStatus: batch.status });
}
assert.equal(entries.length, 62);
assert.equal(sourceWords, 17220);
const pkg = {
    schemaVersion: '1.0',
    work: {
        id: 'matthew-henry-apocalipsis', title: 'Comentario conciso de Apocalipsis',
        author: 'Matthew Henry', displayLabel: 'Matthew Henry · Comentario conciso',
        attribution: 'Comentario conciso de Matthew Henry y sus continuadores',
        language: 'es', translator: 'DeepSeek',
        originalEnglish: { title: "Matthew Henry's Concise Commentary on the Whole Bible", module: 'MHCC', version: '2.0' },
        copyrightNotice: 'El módulo inglés MHCC 2.0 se distribuye como dominio público por CrossWire SWORD. Traducción propia al español para Su Voz a Diario.',
        editionNote: 'Traducción de MHCC 2.0, edición abreviada. El comentario de Apocalipsis de la obra extensa fue completado por William Tong; no se atribuye cada frase de esta abreviación a una autoría individual.',
        translationReview: 'Traducción de DeepSeek cotejada con el original mediante revisión asistida. Revisión humana independiente pendiente.'
    },
    book: { id: 'rev', number: 66, name: 'Apocalipsis', chapterVerseCounts: counts },
    preferredBibleVersion: 'rvr60', compatibleBibleVersions: ['rvr60', 'rvr60-strong'],
    source: { module: 'MHCC', version: '2.0', language: 'en', sourceCorpusSha256: progress.sourceCorpusSha256,
        moduleUrl: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=MHCC',
        textSourceUrl: 'https://ccel.org/ccel/h/henry/mhcc/cache/mhcc.txt', sourceWordCount: sourceWords },
    translation: { translator: 'DeepSeek', assistedReview: 'complete', humanReview: 'pending', deliveries,
        editorialNotes: translationNotes, proseChangedByImporter: false },
    readingOrder: entries.map(entry => entry.id), chapterIds: entries.filter(entry => entry.ranges[0].start.verse === 1).map(entry => entry.id),
    entries, notes: [], noteGroups: [], assets: [], frontMatter: [], indexes: [],
    quality: { completeBook: true, chapters: 22, entries: 62, verses: 404, sourceWords,
        translatedBy: 'DeepSeek', allEntriesAssistedReviewed: true, humanReview: 'pending',
        proseRewrittenOrSummarizedByImporter: false, unmappedVerses: [],
        knownLimitations: ['El cotejo asistido no equivale a una revisión humana independiente.', 'Se conservan el contenido y las interpretaciones históricas de la edición abreviada, incluidos los giros y las irregularidades menores de la fuente.'] }
};
validatePackage(pkg);
for (let chapter = 1; chapter <= counts.length; chapter++) {
    for (let verse = 1; verse <= counts[chapter - 1]; verse++) {
        assert.equal(lookupVerse(pkg, { bookId: 'rev', chapter, verse }).length, 1, `Cobertura ${chapter}:${verse}`);
    }
}
assert(!/\/(?:Users|Volumes)\//.test(JSON.stringify(pkg)), 'El paquete público no debe contener rutas locales.');
const serialized = JSON.stringify(pkg) + '\n';
await writeFile(new URL('../data/commentaries/matthew-henry-apocalipsis.json', import.meta.url), serialized);
await writeFile(new URL('../data/commentaries/MATTHEW-HENRY-NOTICE.txt', import.meta.url), [
    pkg.work.attribution, pkg.work.originalEnglish.title, 'Fuente: MHCC 2.0 · CrossWire SWORD / GetBible / CCEL.',
    pkg.work.copyrightNotice, pkg.work.editionNote, pkg.work.translationReview,
    'El texto del comentario se mantiene separado de la Biblia RVR1960 y de las meditaciones del lector.', ''
].join('\n'));
console.log(JSON.stringify({ workId: pkg.work.id, chapters: 22, entries: entries.length, verses: 404,
    sourceWords, translationNotes: translationNotes.length, bytes: Buffer.byteLength(serialized), sha256: hash(serialized) }));
