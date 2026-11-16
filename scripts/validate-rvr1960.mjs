import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { parse } from 'acorn';
import { LocalRvr1960Provider, RVR1960_VERSION_ID } from '../js/bible/LocalRvr1960Provider.js';
import { BibleRepository } from '../js/bible/BibleRepository.js';
import { BIBLE_BOOK_DEFINITIONS } from '../js/bible/bibleBookIds.js';
import { createBibleReadingKey, parseBibleReadingKey, canAccessRemoteBibleVersions, getInternalBibleTestVersion } from '../js/bible/bibleInternalTest.js';
import { adjacentChapter } from '../js/bible/ContinuousReader.js';
import { renderBibleReadingDocument } from '../js/bible/BibleReaderPresentation.js';
import { escapeBibleHtml } from '../js/utils/text.js';

let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error('Esta prueba no permite internet.'); };
const bytes = readFileSync(new URL('../data/rvr1960.json', import.meta.url));
const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const bible = JSON.parse(text);
const manifest = JSON.parse(readFileSync(new URL('../data/rvr1960-source.json', import.meta.url), 'utf8'));
assert.deepEqual(manifest.counts, { books: 66, chapters: 1189, verses: 31104 });
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.contentSha256, 'The bundled text must match its verified import manifest');
assert.equal(bible.length, 66);
assert.deepEqual(bible.map(book => book.abbrev), BIBLE_BOOK_DEFINITIONS.map(book => book.id));
assert.deepEqual(manifest.books.map(book => book.id), bible.map(book => book.abbrev));

let chapters = 0;
let verses = 0;
for (const [bookIndex, book] of bible.entries()) {
    assert.equal(typeof book.name, 'string');
    assert(book.name.trim());
    assert.deepEqual(book.chapters.map(chapter => chapter.length), manifest.books[bookIndex].chapterVerseCounts,
        'Verse numbering must match the imported source in ' + book.abbrev);
    for (const [chapterIndex, chapter] of book.chapters.entries()) {
        chapters++;
        assert(chapter.length > 0);
        for (const [verseIndex, verse] of chapter.entries()) {
            const reference = book.abbrev + ' ' + (chapterIndex + 1) + ':' + (verseIndex + 1);
            assert.equal(typeof verse, 'string', reference);
            assert(verse.trim(), reference + ' must not be empty');
            assert.equal(verse, verse.trim(), reference + ' must not contain outer whitespace');
            assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/u.test(verse), reference + ' invalid Unicode/control character');
            assert(!/<[^>]*>|&(?:[a-z]+|#\d+|#x[0-9a-f]+);|\[\[REF:|\\u[0-9a-f]{4}/i.test(verse), reference + ' must contain plain text, not markup or encoded residues');
            verses++;
        }
    }
}
assert.equal(chapters, 1189);
assert.equal(verses, 31104);
assert.match(bible[0].chapters[0][0], /^En el principio creó Dios los cielos y la tierra\.$/u);
assert.match(bible.find(book => book.abbrev === 'psa').chapters[22][0], /Jehová es mi pastor/u);
assert.match(bible.find(book => book.abbrev === 'jhn').chapters[2][15], /Porque de tal manera amó Dios al mundo/u);
assert.match(bible.at(-1).chapters.at(-1).at(-1), /Jesucristo.*Amén/u);

let loads = 0;
let releaseLoad;
const provider = new LocalRvr1960Provider({
    fetchImpl: async path => {
        assert.equal(path, './data/rvr1960.json');
        loads++;
        await new Promise(resolve => { releaseLoad = resolve; });
        return { ok: true, json: async () => bible };
    }
});
const concurrent = [provider.loadBible(), provider.getChapter('gen', 1), provider.getBooks()];
releaseLoad();
const [loaded, genesis, catalog] = await Promise.all(concurrent);
assert.equal(loaded, bible);
assert.equal(loads, 1, 'Concurrent initial requests must share one load');
assert.equal(await provider.loadBible(), bible);
assert.equal(genesis.versionId, 'rvr60');
assert.equal(genesis.source, 'local');
assert.deepEqual(catalog.map(book => book.id), bible.map(book => book.abbrev));
for (const book of bible) {
    assert.equal(provider.getCanonicalBookId(' ' + book.abbrev.toUpperCase() + ' '), book.abbrev);
    for (let number = 1; number <= book.chapters.length; number++) {
        const chapter = await provider.getChapter(book.abbrev, number);
        assert.equal(chapter.versionId, 'rvr60');
        assert.equal(chapter.bookId, book.abbrev);
        assert.equal(chapter.sourceBookId, book.abbrev);
        assert.equal(chapter.chapter, number);
        assert.equal(chapter.chapterNumber, number);
        assert.equal(chapter.versionName, 'Reina-Valera 1960');
        assert.equal(chapter.verses.length, book.chapters[number - 1].length);
        chapter.verses.forEach((verse, index) => {
            assert.equal(verse.number, index + 1);
            assert.equal(verse.text, book.chapters[number - 1][index], 'Provider must not rewrite imported Scripture');
            assert.equal(verse.reference, book.name + ' ' + number + ':' + (index + 1));
            if (book.chapterHeadings) assert.equal(verse.subtitle, book.chapterHeadings[number - 1]?.[index + 1] || '');
        });
        assert(Object.isFrozen(chapter));
        assert(Object.isFrozen(chapter.verses));
    }
    await assert.rejects(provider.getChapter(book.abbrev, book.chapters.length + 1));
}
assert.equal(loads, 1, 'Reading all chapters must reuse the local cache');
assert.equal(provider.getCanonicalBookId('unknown'), '');
for (const invalid of [0, -1, 1.5, Infinity, NaN, 'invalid']) {
    await assert.rejects(provider.getChapter('gen', invalid));
}
await assert.rejects(provider.getChapter('unknown', 1));

let attempts = 0;
const retry = new LocalRvr1960Provider({ fetchImpl: async () => {
    attempts++;
    if (attempts === 1) return { ok: false };
    if (attempts === 2) return { ok: true, json: async () => ({ error: true }) };
    if (attempts === 3) throw new Error('Temporary read failure');
    return { ok: true, json: async () => bible };
}});
for (let index = 0; index < 3; index++) {
    await assert.rejects(retry.loadBible());
    assert.equal(retry.loadPromise, null, 'Failed loads must allow a retry');
    assert.equal(retry.bibleCache, null, 'Failed data must not enter cache');
}
assert.equal(await retry.loadBible(), bible);
assert.equal(attempts, 4);
const repository = new BibleRepository([provider]);
assert.equal((await repository.getVersions())[0].id, 'rvr60');
assert.equal((await repository.getChapter('rvr60', 'rev', 22)).verses.at(-1).number, 21);
assert.equal((await repository.getBooks('rvr60')).length, 66);

for (const versionId of ['rvr60', 'rv1909', 'nbla', 'nvi', 'biblia-libre']) {
    for (const bookId of ['gen', '1sa', 'jhn', '3jn', 'rev']) {
        const key = createBibleReadingKey(versionId, bookId, 1);
        assert.deepEqual(parseBibleReadingKey(key), { versionId, bookId, chapter: 1 });
    }
}
assert.notEqual(createBibleReadingKey('rvr60', 'jhn', 3), createBibleReadingKey('rv1909', 'jhn', 3));
assert.equal(createBibleReadingKey('rv1909', 'jhn', 3), 'bible-jhn-3', 'Existing annotations keep their keys');
assert.equal(getInternalBibleTestVersion({ __bibleInternalPreview: true, __bibleTestVersion: 'rvr60' }), null,
    'Bundled RVR1960 must not widen internal remote-version overrides');

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, predicate) {
    if (predicate(node)) return node;
    for (const value of Object.values(node)) {
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child?.type) { const match = find(child, predicate); if (match) return match; }
        }
    }
}
const records = new Map();
const localStorage = {
    get length() { return records.size; },
    key: index => [...records.keys()][index],
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, String(value)),
    removeItem: key => records.delete(key)
};
const silentConsole = { log() {}, info() {}, warn() {}, error() {} };
const context = vm.createContext({
    console: silentConsole, localStorage, sessionStorage: localStorage, window: { scrollY: 120 },
    RVR1960_VERSION_ID, RV1909_VERSION_ID: 'rv1909',
    parseBibleReadingKey, createBibleReadingKey, canAccessRemoteBibleVersions, escapeBibleHtml,
    localRvr1960Provider: provider,
    localRv1909Provider: { loadBible: async () => [{ abbrev: 'jo', chapters: [['antigua palabra']] }], getCanonicalBookId: id => id === 'jo' ? 'jhn' : '' }
});
function method(name) {
    const node = find(tree, item => item.type === 'Property' && item.key.name === name && item.value.type === 'FunctionExpression');
    assert(node, 'App method not found: ' + name);
    const code = source.slice(node.value.start, node.value.end);
    return vm.runInContext('(' + (node.method ? (node.value.async ? 'async ' : '') + 'function' + code : code) + ')', context);
}
const booksNode = find(tree, node => node.type === 'Property' && node.key.name === 'bibleBooks');
const books = vm.runInContext('(' + source.slice(booksNode.value.start, booksNode.value.end) + ')', context);
assert.deepEqual(Array.from(books, book => book.id), bible.map(book => book.abbrev));
assert.deepEqual(Array.from(books, book => book.chapters), bible.map(book => book.chapters.length));
assert.equal(adjacentChapter(books, 'gen', 1, -1), null);
assert.equal(adjacentChapter(books, 'rev', 22, 1), null);
assert.equal(adjacentChapter(books, 'gen', 50, 1).book.id, 'exo');
assert.equal(adjacentChapter(books, 'mat', 1, -1).book.id, 'mal');

const app = {
    currentBibleVersion: 'rvr60', bibleBooks: books, bibleApiIdMap: { JHN: 'jhn' },
    bibleSearchIndexReady: false, bibleSearchIndexVersion: '', bibleSearchData: [],
    bibleSearchQuery: '', bibleSearchResults: [], bibleSearchFilter: 'all', bibleSearchBook: '',
    bibleSearchPage: 1, bibleSearchPageSize: 20, bibleSearchRequestId: 0,
    getTestamentFromBookId: id => bible.findIndex(book => book.abbrev === id) < 39 ? 'old' : 'new',
    getBibleBookById: id => books.find(book => book.id === id), escapeHtml: escapeBibleHtml,
    updateBibleSearchResults() {}, showToast() {}, parseBibleReferenceQuery: () => null,
    saveBibleLastLocation() {}, navigate(view) { this.currentView = view; }
};
for (const name of [
    'getBibleReaderVersions', 'getBibleVersionLabel', 'getLocalBibleSearchVersionId',
    'normalizeBibleWord', 'tokenizeBibleText', 'loadLocalBibleSearchData', 'buildLocalBibleSearchIndex',
    'matchesBibleFilter', 'searchLocalBible', 'applyBibleSearchPagination', 'performBibleSearch',
    'renderBibleSearchResults', 'renderBiblePagination', 'highlightSearchTerm', 'navigateToVerse',
    'normalizeBibleReadingState', 'parseBibleMemoryDate', 'getBibleMemoryItems'
]) app[name] = method(name);
assert(app.getBibleReaderVersions().some(version => version.id === 'rvr60'));
await app.loadLocalBibleSearchData();
assert.equal(app.bibleSearchData.length, 31104);
assert(app.bibleSearchData.every(verse => verse.versionId === 'rvr60'));
assert.equal(app.bibleSearchIndexVersion, 'rvr60');
const oldIndex = app.bibleSearchIndex;
await app.loadLocalBibleSearchData();
assert.equal(app.bibleSearchIndex, oldIndex, 'Same-version search reuses its index');
const john = app.searchLocalBible('"de tal manera amó Dios al mundo"').find(verse => verse.bookId === 'jhn' && verse.chapter === 3 && verse.verse === 16);
assert(john);
assert.equal(john.versionId, 'rvr60');
app.bibleSearchBook = 'jhn';
assert(app.searchLocalBible('amor').every(verse => verse.bookId === 'jhn'));
app.bibleSearchBook = '';

app.currentBibleVersion = 'rv1909';
await app.performBibleSearch('antigua');
assert.equal(app.bibleSearchIndexVersion, 'rv1909');
assert.equal(app.bibleSearchResults.length, 1);
assert.equal(app.bibleSearchResults[0].text, 'antigua palabra');
assert.equal(app.bibleSearchResults[0].versionId, 'rv1909');
app.currentBibleVersion = 'nbla';
assert.equal(app.getLocalBibleSearchVersionId(), 'rv1909', 'Remote word search retains its documented local fallback');
const oldResultsHtml = app.renderBibleSearchResults();
assert(oldResultsHtml.includes('data-version-id="rv1909"'), 'Search result opens the edition containing the displayed text');

let resolveStale;
context.localRvr1960Provider = { loadBible: () => new Promise(resolve => { resolveStale = resolve; }), getCanonicalBookId: id => id };
app.currentBibleVersion = 'rvr60';
const staleLoad = app.loadLocalBibleSearchData();
app.currentBibleVersion = 'rv1909';
resolveStale(bible);
assert.equal(await staleLoad, false);
assert.equal(app.bibleSearchIndexVersion, 'rv1909', 'A late response may not replace another edition index');
context.localRvr1960Provider = provider;
app.currentBibleVersion = 'rvr60';
await app.performBibleSearch('"de tal manera amó Dios al mundo"');
assert(app.bibleSearchResults.some(verse => verse.id === 'jhn.3.16'));
assert(app.bibleSearchResults.every(verse => verse.versionId === 'rvr60'));
assert(app.renderBibleSearchResults().includes('data-version-id="rvr60"'));

const clickNode = find(tree, node => node.type === 'IfStatement' && node.test.type === 'Identifier' && node.test.name === 'navigateToVerseBtn');
assert(clickNode, 'Search result navigation handler');
context.navigateToVerseBtn = { getAttribute: name => ({ 'data-book-id': 'jhn', 'data-chapter': '3', 'data-verse': '16', 'data-version-id': 'rvr60' })[name] };
const openResult = vm.runInContext('(function(){' + source.slice(clickNode.start, clickNode.end) + '})', context);
app.currentBibleVersion = 'nvi'; app.currentView = 'bible-search';
openResult.call(app);
assert.equal(app.currentBibleVersion, 'rvr60');
assert.equal(localStorage.getItem('current-bible-version'), 'rvr60');
assert.equal(app.currentView, 'bible-reading');
assert.equal(app.selectedBibleBook, 'jhn');
assert.equal(app.targetVerse, 16);

const saved = app.normalizeBibleReadingState({ versionId: 'rvr60', bookId: 'jhn', chapter: 3, verseNumber: 16 });
assert.equal(saved.versionId, 'rvr60');
assert.equal(app.normalizeBibleReadingState({ versionId: 'invalid', bookId: 'jhn', chapter: 3 }).versionId, 'rv1909');
assert.equal(app.normalizeBibleReadingState({ versionId: 'rvr60', bookId: 'jhn', chapter: 22 }), null);
assert.equal(app.normalizeBibleReadingState({ versionId: 'rvr60', bookId: 'unknown', chapter: 1 }), null);
assert.equal(app.normalizeBibleReadingState({ versionId: 'rvr60', bookId: 'jhn', chapter: 0 }), null);
records.clear();
for (const versionId of ['rvr60', 'rv1909']) {
    const key = createBibleReadingKey(versionId, 'jhn', 3);
    localStorage.setItem('su-voz-selection-notes-' + key, JSON.stringify([{ text: 'Mismo pasaje', note: versionId + ' nota' }]));
    localStorage.setItem('su-voz-highlights-' + key, JSON.stringify([{ text: 'Mismo pasaje', color: versionId === 'rvr60' ? 'green' : 'yellow' }]));
}
app.getSelectionNotes = date => JSON.parse(localStorage.getItem('su-voz-selection-notes-' + date) || '[]');
app.getHighlights = date => JSON.parse(localStorage.getItem('su-voz-highlights-' + date) || '[]');
const memory = app.getBibleMemoryItems();
assert.equal(memory.length, 2, 'Same passage annotations must stay isolated by edition');
for (const item of memory) {
    assert.equal(item.note, item.versionId + ' nota');
    assert.deepEqual(Array.from(item.colors), [item.versionId === 'rvr60' ? 'green' : 'yellow']);
}

context.renderBibleReadingDocument = renderBibleReadingDocument;
context.bibleRepository = repository;
context.BIBLE_FOOTNOTE_SUPERSCRIPTS = Object.fromEntries([...'0123456789'].map((digit, index) => [digit, [...'⁰¹²³⁴⁵⁶⁷⁸⁹'][index]]));
for (const node of tree.body.filter(node => node.type === 'FunctionDeclaration')) {
    vm.runInContext(source.slice(node.start, node.end), context);
}
const renderChapter = vm.runInContext('getBibleChapter', context);
const rendered = await renderChapter('jhn', 3, 'rvr60');
assert.equal((rendered.content.match(/class="verse-item verse-selectable"/g) || []).length, 36);
assert(rendered.copyrightHtml.includes('data-translation="rvr60"'));
assert(rendered.copyrightHtml.includes('Sociedades Bíblicas'));
assert(!rendered.content.includes('reading-copyright'), 'Copyright stays outside the selectable Scripture text');
assert(rendered.content.includes(escapeBibleHtml(john.text)));
assert.equal(networkCalls, 0);
console.log('OK: RVR1960 — 66 books, 1189 chapters, 31104 verses, manifest hash/counts, Unicode, cache/retry, chapter identity, boundaries, version keys, search switching/races, correct-result navigation, annotation isolation and copyright.');
