import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CommentaryRepository, REVELATION_VERSE_COUNTS } from '../js/bible/CommentaryRepository.js';
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
let readings = 0;
for (const month of ['2026-11', '2026-12']) {
    const catalog = JSON.parse(await readFile(new URL(`../data/readings/${month}.json`, import.meta.url)));
    for (const reading of catalog) {
        if (!reading.reference?.startsWith('Apocalipsis')) continue;
        const selectedRange = parseCommentaryReference(reading.reference);
        assert(selectedRange && lookupRange(pkg, selectedRange).length, `daily meditation ${reading.reference}`);
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
console.log('Comentario: 404 versículos, 94 entradas, 273 notas; rangos, integridad, carga compartida y reintento correctos.');
