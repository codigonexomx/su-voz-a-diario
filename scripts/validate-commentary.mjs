import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CommentaryRepository, REVELATION_VERSE_COUNTS, DEFAULT_COMMENTARY_WORK_ID, COMMENTARY_WORKS } from '../js/bible/CommentaryRepository.js';
import { lookupRange, lookupVerse, validatePackage } from '../js/bible/commentaryLookup.js';
import { parseCommentaryReference } from '../js/bible/CommentaryPanel.js';

const pkg = JSON.parse(await readFile(new URL('../data/commentaries/hendriksen-apocalipsis.json', import.meta.url)));
validatePackage(pkg);
assert.equal(pkg.entries.length, 94);
assert.equal(pkg.entries.filter(entry => entry.kind === 'commentary').length, 50);
assert.equal(pkg.notes.length, 273);
assert.equal(pkg.noteGroups.length, 14);
assert.equal(pkg.source.pdfPageCount, 243);
assert(!/\/(?:Users|Volumes)\//.test(JSON.stringify(pkg)), 'editorial audit paths stay outside the public edition');
assert.deepEqual(pkg.book.chapterVerseCounts, REVELATION_VERSE_COUNTS);
const reached = new Set();
for (let chapter = 1; chapter <= 22; chapter++) {
    for (let verse = 1; verse <= REVELATION_VERSE_COUNTS[chapter - 1]; verse++) {
        const entries = lookupVerse(pkg, { bookId: 'rev', chapter, verse });
        assert.equal(entries.length, 1, `exactly one author section at ${chapter}:${verse}`);
        reached.add(entries[0].id);
    }
}
assert.equal(reached.size, 50);
const meditationRanges = [];
let readings = 0;
for (const month of ['2026-11', '2026-12']) {
    const catalog = JSON.parse(await readFile(new URL(`../data/readings/${month}.json`, import.meta.url)));
    for (const reading of catalog) {
        if (!reading.reference?.startsWith('Apocalipsis')) continue;
        const selectedRange = parseCommentaryReference(reading.reference);
        assert(selectedRange && lookupRange(pkg, selectedRange).length, `daily meditation ${reading.reference}`);
        meditationRanges.push({ reference: reading.reference, range: selectedRange });
        readings++;
    }
}
assert.equal(readings, 36);
const range = { start: { bookId: 'rev', chapter: 11, verse: 15 }, end: { bookId: 'rev', chapter: 12, verse: 6 } };
assert.deepEqual(lookupRange(pkg, range).map(entry => entry.id), ['hendriksen-x-g', 'hendriksen-xi-a']);
assert.throws(() => lookupRange(pkg, { start: range.end, end: range.start }), RangeError);
assert.throws(() => lookupVerse(pkg, { bookId: 'rev', chapter: 22, verse: 22 }), RangeError);
for (const entry of [...pkg.entries, ...pkg.notes]) {
    assert.equal(createHash('sha256').update(entry.text).digest('hex'), entry.textSha256, `text integrity ${entry.id}`);
}
const assets = new Set(pkg.assets.map(asset => asset.id));
for (const entry of pkg.entries) {
    assert(entry.assetIds.every(id => assets.has(id)), `illustration links ${entry.id}`);
}
let requests = 0;
const repository = new CommentaryRepository({ fetchImpl: async () => { requests++; return { ok: true, json: async () => pkg }; } });
await assert.rejects(repository.getForVerse({ bookId: 'gen', chapter: 1, verse: 1 }), RangeError);
assert.equal(requests, 0, 'unrelated Bible books do not download commentary');
const [matching, contents] = await Promise.all([repository.getForRange(range), repository.getContents()]);
assert.equal(requests, 1, 'parallel views share one request');
assert.equal(matching.entries.length, 2);
assert.equal(contents.entries.length, 94);
assert.equal(contents.frontMatter.length, 6);
assert.equal(contents.indexes.length, 2);
assert.equal((await repository.getEntry('hendriksen-vii-g')).entries[0].id, 'hendriksen-vii-g');
await assert.rejects(repository.getEntry('missing'), RangeError);
let attempts = 0;
const retry = new CommentaryRepository({ fetchImpl: async () => {
    attempts++; return { ok: attempts > 1, json: async () => pkg };
} });
await assert.rejects(retry.getForRange(range), /conexión/);
assert.equal((await retry.getForRange(range)).entries.length, 2, 'retry after offline failure works');
const invalid = new CommentaryRepository({ fetchImpl: async () => ({ ok: true, json: async () => ({ ...pkg, notes: [] }) }) });
await assert.rejects(invalid.load(), /notas/);
// Deliberately synthetic: this tests a second work without translating or publishing source text.
const henryWorkId = 'matthew-henry-apocalipsis';
const syntheticHenry = {
    schemaVersion: '1.0',
    work: { id: henryWorkId, title: 'Obra sintética para pruebas del repositorio' },
    book: { id: 'rev', number: 66, chapterVerseCounts: [...REVELATION_VERSE_COUNTS] },
    entries: [{ id: 'fixture-henry-section', kind: 'commentary', mappingStatus: 'confirmed',
        title: 'Entrada sintética de prueba', text: 'Contenido de prueba; no es texto de un comentario ni una traducción.',
        ranges: [range], sourceSpans: [], parentId: null, notesGroupId: null, order: 0 }],
    notes: [], noteGroups: [], assets: [], frontMatter: [], indexes: []
};
validatePackage(syntheticHenry);
const descriptors = new Map(COMMENTARY_WORKS.map(work => [work.id, work]));
const requestedPaths = [];
const deferredResponses = new Map();
const multi = new CommentaryRepository({ fetchImpl: dataPath => {
    requestedPaths.push(dataPath);
    return new Promise(resolve => deferredResponses.set(dataPath, resolve));
} });
assert.deepEqual(multi.listWorks().map(work => work.id), [DEFAULT_COMMENTARY_WORK_ID, henryWorkId]);
for (const operation of [
    () => multi.load('unknown-work'),
    () => multi.getForRange(range, 'unknown-work'),
    () => multi.getForVerse(range.start, 'unknown-work'),
    () => multi.getContents('unknown-work'),
    () => multi.getEntry('fixture-henry-section', 'unknown-work')
]) await assert.rejects(operation(), RangeError);
assert.equal(requestedPaths.length, 0, 'Unknown works must be rejected before any download');

const hendriksenRangePending = multi.getForRange(range);
const hendriksenContentsPending = multi.getContents();
const henryRangePending = multi.getForRange(range, henryWorkId);
const henryContentsPending = multi.getContents(henryWorkId);
assert.deepEqual(requestedPaths, [descriptors.get(DEFAULT_COMMENTARY_WORK_ID).dataPath, descriptors.get(henryWorkId).dataPath],
    'Parallel reads share a download within each work, and separate works use separate paths');
// Resolve the second work first: its completion must not satisfy the first work's readers.
deferredResponses.get(descriptors.get(henryWorkId).dataPath)({ ok: true, json: async () => syntheticHenry });
const [henryRange, henryContents] = await Promise.all([henryRangePending, henryContentsPending]);
assert.equal(henryRange.work.id, henryWorkId);
assert.deepEqual(henryRange.entries.map(entry => entry.id), ['fixture-henry-section']);
assert.equal(henryContents.entries[0].notesGroupId, null, 'An edition with no notes permits a null notesGroupId');
assert.deepEqual(henryContents.notes, []);
deferredResponses.get(descriptors.get(DEFAULT_COMMENTARY_WORK_ID).dataPath)({ ok: true, json: async () => pkg });
const [hendriksenRange, hendriksenContents] = await Promise.all([hendriksenRangePending, hendriksenContentsPending]);
assert.equal(hendriksenRange.work.id, DEFAULT_COMMENTARY_WORK_ID);
assert.deepEqual(hendriksenRange.entries.map(entry => entry.id), ['hendriksen-x-g', 'hendriksen-xi-a']);
assert.equal(hendriksenContents.entries.length, 94);
assert.equal((await multi.getForVerse(range.end, henryWorkId)).entries[0].id, 'fixture-henry-section');
assert.equal((await multi.getEntry('fixture-henry-section', henryWorkId)).work.id, henryWorkId);
await assert.rejects(multi.getEntry('hendriksen-x-g', henryWorkId), RangeError);
await Promise.all([multi.load(), multi.load(henryWorkId), multi.getContents(), multi.getContents(henryWorkId)]);
assert.equal(requestedPaths.length, 2, 'Cached works remain independent and avoid further downloads');

const isolationRequests = new Map();
const isolatedRetry = new CommentaryRepository({ fetchImpl: async dataPath => {
    const count = (isolationRequests.get(dataPath) || 0) + 1;
    isolationRequests.set(dataPath, count);
    if (dataPath === descriptors.get(DEFAULT_COMMENTARY_WORK_ID).dataPath) return { ok: true, json: async () => pkg };
    if (count === 1) return { ok: true, json: async () => pkg }; // Wrong work at the requested path.
    if (count === 2) return { ok: false }; // Then a transient network failure.
    return { ok: true, json: async () => syntheticHenry };
} });
const preservedHendriksen = await isolatedRetry.load();
await assert.rejects(isolatedRetry.load(henryWorkId), /obra seleccionada/,
    'A structurally valid package for another work must still be rejected');
assert.strictEqual(await isolatedRetry.load(), preservedHendriksen);
await assert.rejects(isolatedRetry.getForRange(range, henryWorkId), /conexión/);
assert.strictEqual(await isolatedRetry.load(), preservedHendriksen);
assert.equal((await isolatedRetry.getForRange(range, henryWorkId)).entries[0].id, 'fixture-henry-section',
    'Rejected identities and failed downloads must both release the work-specific pending request for retry');
assert.equal(isolationRequests.get(descriptors.get(DEFAULT_COMMENTARY_WORK_ID).dataPath), 1,
    'Retrying the second work must not evict or refetch Hendriksen');
assert.equal(isolationRequests.get(descriptors.get(henryWorkId).dataPath), 3);
assert.strictEqual(await isolatedRetry.load(), pkg, 'The original Hendriksen package remains intact');
// This public edition is mandatory: CI must fail if its delivery is missing or incomplete.
const realHenry = JSON.parse(await readFile(new URL('../data/commentaries/matthew-henry-apocalipsis.json', import.meta.url)));
validatePackage(realHenry);
assert.equal(realHenry.work.id, henryWorkId);
assert.equal(realHenry.work.displayLabel, 'Matthew Henry · Comentario conciso');
assert.equal(realHenry.work.attribution, 'Comentario conciso de Matthew Henry y sus continuadores');
assert.equal(realHenry.work.language, 'es');
assert.equal(realHenry.work.translator, 'IA');
assert.equal(realHenry.work.originalEnglish.module, 'MHCC');
assert.equal(realHenry.work.originalEnglish.version, '2.0');
assert.equal(realHenry.book.id, 'rev');
assert.equal(realHenry.book.number, 66);
assert.deepEqual(realHenry.book.chapterVerseCounts, REVELATION_VERSE_COUNTS);
assert.equal(realHenry.entries.length, 62);
assert(realHenry.entries.every(entry => entry.kind === 'commentary' && entry.mappingStatus === 'confirmed'));
assert.deepEqual(realHenry.readingOrder, realHenry.entries.map(entry => entry.id));
assert.deepEqual(realHenry.entries.map(entry => entry.order), Array.from({ length: 62 }, (_, index) => index));
assert.equal(realHenry.preferredBibleVersion, 'rvr60');
assert.deepEqual(realHenry.compatibleBibleVersions, ['rvr60', 'rvr60-strong']);
assert(!/\/(?:Users|Volumes)\//.test(JSON.stringify(realHenry)), 'Henry editorial paths stay outside the public edition');

const realHenryReached = new Set();
let realHenryVerses = 0;
for (let chapter = 1; chapter <= REVELATION_VERSE_COUNTS.length; chapter++) {
    for (let verse = 1; verse <= REVELATION_VERSE_COUNTS[chapter - 1]; verse++) {
        const matches = lookupVerse(realHenry, { bookId: 'rev', chapter, verse });
        assert.equal(matches.length, 1, 'Henry must cover ' + chapter + ':' + verse + ' exactly once');
        realHenryReached.add(matches[0].id);
        realHenryVerses++;
    }
}
assert.equal(realHenryVerses, 404);
assert.equal(realHenryReached.size, 62, 'Every Henry section must be reachable through its actual passage');
assert.equal(realHenry.chapterIds.length, 22);
assert.equal(new Set(realHenry.chapterIds).size, 22);
assert.deepEqual(realHenry.chapterIds, realHenry.entries.filter(entry => entry.ranges[0].start.verse === 1).map(entry => entry.id));
assert.deepEqual(realHenry.chapterIds.map(id => {
    const entry = realHenry.entries.find(item => item.id === id);
    assert(entry, 'Unknown chapter navigation entry: ' + id);
    assert.equal(entry.ranges[0].start.verse, 1);
    return entry.ranges[0].start.chapter;
}), Array.from({ length: 22 }, (_, index) => index + 1), 'The 22 chapter destinations must follow biblical order');
assert.equal(meditationRanges.length, 36);
for (const meditation of meditationRanges) {
    assert(lookupRange(realHenry, meditation.range).length, 'Henry meditation coverage: ' + meditation.reference);
}

const isSha256 = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
assert.equal(realHenry.source.module, 'MHCC');
assert.equal(realHenry.source.version, '2.0');
assert.equal(realHenry.source.language, 'en');
assert.equal(realHenry.source.sourceWordCount, 17220);
assert(isSha256(realHenry.source.sourceCorpusSha256));
assert.equal(realHenry.source.moduleUrl, 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=MHCC');
assert.equal(realHenry.source.textSourceUrl, 'https://ccel.org/ccel/h/henry/mhcc/cache/mhcc.txt');
assert.equal(realHenry.translation.translator, 'DeepSeek');
assert.equal(realHenry.translation.assistedReview, 'complete');
assert.equal(realHenry.translation.humanReview, 'pending');
assert.equal(realHenry.translation.proseChangedByImporter, false);
assert.equal(realHenry.translation.deliveries.length, 6);
assert.equal(new Set(realHenry.translation.deliveries.map(delivery => delivery.batchId)).size, 6);
for (const delivery of realHenry.translation.deliveries) {
    assert.match(delivery.batchId, /^mhcc-b66-/);
    assert.notEqual(delivery.revision, undefined);
    assert.match(delivery.reviewStatus, /^(?:assisted-reviewed(?:-with-editorial-notes)?|draft-assisted-review-complete-source-uncertainties-open)$/);
    for (const field of ['sourceSha256', 'translationSha256', 'reviewSha256']) {
        assert(isSha256(delivery[field]), 'Missing exact delivery provenance: ' + delivery.batchId + ' ' + field);
    }
}
const deliveryHashes = new Set(realHenry.translation.deliveries.map(delivery => delivery.translationSha256));
const indexedTranslationNotes = [];
for (const entry of realHenry.entries) {
    assert.equal(createHash('sha256').update(entry.text).digest('hex'), entry.textSha256, 'Henry exact text integrity: ' + entry.id);
    assert(isSha256(entry.sourceTextSha256), 'Henry original text fingerprint: ' + entry.id);
    assert.equal(entry.authorChapter, entry.ranges[0].start.chapter);
    assert.equal(entry.review.translation, 'DeepSeek');
    assert.equal(entry.review.fidelity, 'assisted-reviewed');
    assert.equal(entry.review.humanReview, 'pending');
    assert(deliveryHashes.has(entry.review.deliverySha256), 'Henry entry must identify one of the six exact deliveries: ' + entry.id);
    assert.equal(entry.notesGroupId, null);
    assert(Array.isArray(entry.translationNotes), 'Translation notes must remain a separate array: ' + entry.id);
    for (const note of entry.translationNotes) {
        assert(note && typeof note === 'object' && !Array.isArray(note), 'Translation note must retain its structured source issue: ' + entry.id);
        for (const key of ['id', 'sourceQuote', 'issue']) assert(typeof note[key] === 'string' && note[key].trim(), 'Missing translation note ' + key);
        assert(note.proposedReading === null || typeof note.proposedReading === 'string');
        indexedTranslationNotes.push({ entryId: entry.id, note });
    }
}
assert.equal(new Set(indexedTranslationNotes.map(item => item.note.id)).size, indexedTranslationNotes.length);
assert.deepEqual(realHenry.translation.editorialNotes, indexedTranslationNotes,
    'Every translation note must be preserved verbatim in both its entry and the editorial index');
const pendingReadingEntry = realHenry.entries.find(entry => entry.id === 'mhcc-b66-c021-v001-e001');
assert(pendingReadingEntry, 'The source section at Apocalipsis 21:1 must remain available');
assert(pendingReadingEntry.text.includes('[lectura pendiente: «in order hearts»]'), 'The uncertain source reading must remain explicitly marked, without a conjectural rewrite');
const pendingReadingNote = pendingReadingEntry.translationNotes.find(note => note.id === pendingReadingEntry.id + '-n01');
assert(pendingReadingNote, 'The pending reading must retain its separate source note');
assert.equal(pendingReadingNote.sourceQuote, 'in order hearts and nature');
assert.equal(pendingReadingNote.issue, 'La frase inglesa «in order hearts» parece corrupta en la fuente; no se conjetura su lectura y se conserva marcada.');
assert.equal(pendingReadingNote.proposedReading, null);
const heirsEntry = realHenry.entries.find(entry => entry.id === 'mhcc-b66-c021-v009-e002');
const heirsNote = heirsEntry?.translationNotes.find(note => note.id === 'N1');
assert(heirsNote, 'The source relationship in Apocalipsis 21:9 must retain its separate N1 editorial note');
assert(heirsNote.sourceQuote.includes('of the heirs'));
assert.equal(heirsNote.proposedReading, 'Conjetura no comprobada: «a los herederos de la salvación».');
assert(heirsEntry.text.includes('[N1]'), 'The difficult reading must identify its separate editorial note in the body');
assert(!heirsEntry.text.includes(heirsNote.proposedReading), 'The editorial proposal must not be merged into the translated prose');
assert(!heirsEntry.text.includes('a los herederos de la salvación'), 'The conjectural reading must not silently replace the preserved source relationship');
assert.equal(indexedTranslationNotes.length, 2, 'Both reviewed source difficulties must retain their notes');
assert.deepEqual(realHenry.notes, [], 'Translation notes must not be presented as original author footnotes');
assert.deepEqual(realHenry.noteGroups, []);
assert.equal(realHenry.quality.completeBook, true);
assert.equal(realHenry.quality.chapters, 22);
assert.equal(realHenry.quality.entries, 62);
assert.equal(realHenry.quality.verses, 404);
assert.equal(realHenry.quality.sourceWords, 17220);
assert.equal(realHenry.quality.translatedBy, 'DeepSeek');
assert.equal(realHenry.quality.allEntriesAssistedReviewed, true);
assert.equal(realHenry.quality.proseRewrittenOrSummarizedByImporter, false);
assert.deepEqual(realHenry.quality.unmappedVerses, []);
const realHenryRepository = new CommentaryRepository({ fetchImpl: async () => ({ ok: true, json: async () => realHenry }) });
const deliveredHenry = await realHenryRepository.getForRange(range, henryWorkId);
assert.equal(deliveredHenry.work.id, henryWorkId);
assert.deepEqual(deliveredHenry.entries, lookupRange(realHenry, range));
console.log('Comentarios: Hendriksen íntegro; Henry 62 secciones, 404 versículos y 36 meditaciones; procedencia DeepSeek, notas y cachés por obra correctos.');
