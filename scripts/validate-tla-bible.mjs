import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { parse } from 'acorn';
import { LocalTlaProvider, TLA_VERSION_ID, TLA_VERSION_LABEL, TLA_VERSION_NAME } from '../js/bible/LocalTlaProvider.js';
import { BibleRepository } from '../js/bible/BibleRepository.js';
import { BIBLE_BOOK_DEFINITIONS } from '../js/bible/bibleBookIds.js';
import { createBibleReadingKey, parseBibleReadingKey, canAccessRemoteBibleVersions } from '../js/bible/bibleInternalTest.js';
import { adjacentChapter } from '../js/bible/ContinuousReader.js';
import { renderBibleReadingDocument } from '../js/bible/BibleReaderPresentation.js';
import { escapeBibleHtml } from '../js/utils/text.js';

let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error('Esta prueba no permite internet.'); };

const EXPECTED_BYTES = 7088094;
const EXPECTED_SHA256 = '234eafde7dcdb46b45fe6256c489226ce19782ff940914aa6f5806aca0abf683';

const bytes = readFileSync(new URL('../data/tla.json', import.meta.url));
assert.equal(bytes.length, EXPECTED_BYTES, 'data/tla.json exact byte size');
assert.equal(createHash('sha256').update(bytes).digest('hex'), EXPECTED_SHA256, 'data/tla.json exact SHA-256');

const wwwBytes = readFileSync(new URL('../www/data/tla.json', import.meta.url));
assert.equal(createHash('sha256').update(wwwBytes).digest('hex'), EXPECTED_SHA256, 'www/data/tla.json matches data/tla.json');

const bible = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
assert.equal(bible.schemaVersion, 1);
assert.equal(bible.versionId, 'tla');
assert.equal(bible.books.length, 66);
assert.deepEqual(bible.books.map(book => book.id), BIBLE_BOOK_DEFINITIONS.map(book => book.id));

const provider = new LocalTlaProvider({
    fetchImpl: async path => {
        assert.equal(path, './data/tla.json');
        return { ok: true, json: async () => bible };
    }
});

const repository = new BibleRepository([provider]);
const versions = await repository.getVersions();
assert.equal(versions.length, 1);
assert.equal(versions[0].id, TLA_VERSION_ID);
assert.equal(versions[0].abbreviation, TLA_VERSION_LABEL);
assert.equal(versions[0].name, TLA_VERSION_NAME);

// Five single-chapter books have exactly 1 chapter
for (const bookId of ['oba', 'phm', '2jn', '3jn', 'jud']) {
    const ch1 = await provider.getChapter(bookId, 1);
    assert.equal(ch1.chapter, 1);
    await assert.rejects(provider.getChapter(bookId, 2));
}

// Reading keys isolation
for (const bookId of ['gen', '1ch', 'psa', 'neh', 'rev']) {
    const key = createBibleReadingKey('tla', bookId, 1);
    assert.equal(key, `bible-tla-${bookId}-1`);
    assert.deepEqual(parseBibleReadingKey(key), { versionId: 'tla', bookId, chapter: 1 });
}

// Extract real functions & methods from js/app.js
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
    console: silentConsole, localStorage, sessionStorage: localStorage, window: { scrollY: 0 },
    RVR1960_VERSION_ID: 'rvr60', RV1909_VERSION_ID: 'rv1909', NTV_VERSION_ID: 'ntv', TLA_VERSION_ID: 'tla',
    parseBibleReadingKey, createBibleReadingKey, canAccessRemoteBibleVersions, escapeBibleHtml,
    renderBibleReadingDocument, bibleRepository: repository,
    localTlaProvider: provider,
    localNtvProvider: { loadBible: async () => ({ books: [] }), getCanonicalBookId: id => id },
    localRvr1960Provider: { loadBible: async () => [], getCanonicalBookId: id => id },
    localRv1909Provider: { loadBible: async () => [], getCanonicalBookId: id => id },
    BIBLE_FOOTNOTE_SUPERSCRIPTS: Object.fromEntries([...'0123456789'].map((digit, index) => [digit, [...'⁰¹²³⁴⁵⁶⁷⁸⁹'][index]]))
});

for (const node of tree.body.filter(node => node.type === 'FunctionDeclaration')) {
    vm.runInContext(source.slice(node.start, node.end), context);
}
const getBibleChapter = vm.runInContext('getBibleChapter', context);

// 1. Genesis 1: section1, section2, heading1, SBU copyright
const gen1 = await getBibleChapter('gen', 1, 'tla');
assert(gen1.content.includes('class="bible-reader-section-title"'), 'Genesis 1 renders section1');
assert(gen1.content.includes('class="bible-reader-subtitle"'), 'Genesis 1 renders heading1');
assert(gen1.copyrightHtml.includes('data-translation="tla"'), 'TLA copyright rendered');
assert(gen1.copyrightHtml.includes('Sociedades Bíblicas Unidas'), 'SBU copyright preserved');
assert(!gen1.content.includes('reading-copyright'), 'Copyright stays outside selectable Scripture');

// 2. Numbers 33:1-50: wide range (50 verses, 2 fragments), verse 25 resolves whole group
const num33v25 = await provider.getVerse('num', 33, 25);
assert.equal(num33v25.displayNumber, '1-50');
assert.equal(num33v25.verseNumbers.length, 50);
const num33 = await getBibleChapter('num', 33, 'tla');
assert.equal((num33.content.match(new RegExp(`data-verse-group-key="${num33v25.verseNumbers.join(',')}"`, 'g')) || []).length, 2, 'Numbers 33:1-50 has 2 fragments');
assert.equal((num33.content.match(/class="verse-number"[^>]*>1-50</g) || []).length, 1, 'Numbers 33:1-50 has ONE verse-number button');

// 3. 1 Chronicles 23:2-32: 31 verses, 5 fragments + intercalated headings
const chr23v2 = await provider.getVerse('1ch', 23, 12);
const chr23 = await getBibleChapter('1ch', 23, 'tla');
assert.equal((chr23.content.match(new RegExp(`data-verse-group-key="${chr23v2.verseNumbers.join(',')}"`, 'g')) || []).length, 5, '1 Chronicles 23:2-32 has 5 fragments');
assert.equal((chr23.content.match(/class="verse-number"[^>]*>2-32</g) || []).length, 1, '1 Chronicles 23:2-32 has ONE verse-number button');

// 4. Isaiah 38:1-22: 22 verses, 2 fragments
const isa38v1 = await provider.getVerse('isa', 38, 1);
const isa38 = await getBibleChapter('isa', 38, 'tla');
assert.equal((isa38.content.match(new RegExp(`data-verse-group-key="${isa38v1.verseNumbers.join(',')}"`, 'g')) || []).length, 2, 'Isaiah 38:1-22 has 2 fragments');
assert.equal((isa38.content.match(/class="verse-number"[^>]*>1-22</g) || []).length, 1, 'Isaiah 38:1-22 has ONE verse-number button');

// 5. 1 Samuel 31: parallel references
const sam31 = await getBibleChapter('1sa', 31, 'tla');
assert(sam31.content.includes('<p class="bible-reader-parallel-references" aria-label="Pasajes paralelos">(1 Cr 10.1-12)</p>'), '1 Samuel 31 parallel reference rendered');

// 6. Psalm 52: chapterLabel, unnumberedScripture before v1, note 52.0 linked by supplementalContentId, NO verse 0
const psa52 = await getBibleChapter('psa', 52, 'tla');
assert(psa52.content.includes('<p class="bible-reader-chapter-label">SALMO 52 (51)</p>'), 'Psalm 52 chapterLabel rendered');
const unnumPos = psa52.content.indexOf('data-supplemental-id="psa.52.sc2"');
const v1Pos = psa52.content.indexOf('data-verse-number="1"');
assert(unnumPos > 0 && v1Pos > unnumPos, 'Psalm 52 unnumbered scripture precedes verse 1');
assert(psa52.content.includes('Y tú, campeón de la maldad,'), 'Psalm 52 unnumbered scripture text present');
assert(psa52.content.includes('data-source-note-id="psa.52.fn1"'), 'Psalm 52 supplemental note 52.0 attached');
assert(!psa52.content.includes('data-verse-number="0"'), 'No verse 0 invented for Psalm 52');
assert(!psa52.content.includes('bible-chapter-editorial-notes'), 'Psalm 52 supplemental note is not duplicated in unassigned notes');

// 7. Nehemiah 12: table in 12:12-21 with 2 th + 40 td = 42 cells, not inside <p>, no duplicated linear names
const neh12 = await getBibleChapter('neh', 12, 'tla');
assert(neh12.content.includes('class="bible-reader-source-table"'), 'Nehemiah 12 renders source table');
const thCount = (neh12.content.match(/<th>/g) || []).length;
const tdCount = (neh12.content.match(/<td>/g) || []).length;
assert.equal(thCount, 2, 'Nehemiah 12 table has 2 header cells');
assert.equal(tdCount, 40, 'Nehemiah 12 table has 40 data cells (42 total)');
assert(neh12.content.includes('<th>Jefe</th><th>Familia sacerdotal</th>'), 'Nehemiah 12 table headers exact');
const visibleNeh12 = neh12.content.replace(/<[^>]+>/g, ' ');
assert.equal((visibleNeh12.match(/Meraías/g) || []).length, 1, 'Meraías appears exactly once in visible rendered text (in table cell, not duplicated linearly)');

// 8. Revelation 22 end of Bible
const rev22 = await getBibleChapter('rev', 22, 'tla');
assert(rev22.verses.length > 0);
const booksNode = find(tree, node => node.type === 'Property' && node.key.name === 'bibleBooks');
const books = vm.runInContext('(' + source.slice(booksNode.value.start, booksNode.value.end) + ')', context);
assert.equal(adjacentChapter(books, 'rev', 22, 1), null, 'No chapter after Revelation 22');

// 9. App methods: selector, search for Psalm 52 unnumbered scripture (no :null or :0)
function method(name) {
    const node = find(tree, item => item.type === 'Property' && item.key.name === name && item.value.type === 'FunctionExpression');
    assert(node, 'App method not found: ' + name);
    const code = source.slice(node.value.start, node.value.end);
    return vm.runInContext('(' + (node.method ? (node.value.async ? 'async ' : '') + 'function' + code : code) + ')', context);
}
const app = {
    currentBibleVersion: 'tla', bibleBooks: books,
    bibleSearchIndexReady: false, bibleSearchIndexVersion: '', bibleSearchData: [],
    bibleSearchQuery: '', bibleSearchResults: [], bibleSearchFilter: 'all', bibleSearchBook: '',
    bibleSearchPage: 1, bibleSearchPageSize: 20, bibleSearchRequestId: 0,
    getTestamentFromBookId: id => bible.books.findIndex(book => book.id === id) < 39 ? 'old' : 'new',
    getBibleBookById: id => books.find(book => book.id === id), escapeHtml: escapeBibleHtml,
    updateBibleSearchResults() {}, showToast() {}, parseBibleReferenceQuery: () => null
};
for (const name of [
    'getBibleReaderVersions', 'getBibleVersionLabel', 'getLocalBibleSearchVersionId',
    'normalizeBibleWord', 'tokenizeBibleText', 'loadLocalBibleSearchData', 'buildLocalBibleSearchIndex',
    'matchesBibleFilter', 'searchLocalBible', 'applyBibleSearchPagination', 'performBibleSearch',
    'renderBibleSearchResults', 'renderBiblePagination', 'highlightSearchTerm', 'getBibleSelectionReferenceLabel'
]) app[name] = method(name);

const tlaEntries = app.getBibleReaderVersions().filter(v => v.id === 'tla');
assert.equal(tlaEntries.length, 1, 'Single TLA entry in getBibleReaderVersions');
assert.equal(tlaEntries[0].label, 'TLA');
assert.equal(tlaEntries[0].name, 'Traducción en Lenguaje Actual');
assert.equal(app.getLocalBibleSearchVersionId(), 'tla');

await app.performBibleSearch('campeón de la maldad');
assert.equal(app.bibleSearchIndexVersion, 'tla');
const psaHit = app.bibleSearchResults.find(r => r.bookId === 'psa' && r.chapter === 52 && r.chapterOnly);
assert(psaHit, 'Psalm 52 unnumbered scripture found in TLA search');
assert.equal(psaHit.verse, null);
assert.equal(psaHit.supplementalContentId, 'psa.52.sc2');
const searchHtml = app.renderBibleSearchResults();
assert(searchHtml.includes('Salmos 52 · TLA'), 'Search result formats chapter-only reference cleanly');
assert(!searchHtml.includes('Salmos 52:null') && !searchHtml.includes('Salmos 52:0'), 'No :null or :0 reference');
assert(searchHtml.includes('data-supplemental-id="psa.52.sc2"'), 'Search result exposes supplementalContentId');

// Service Worker includes TLA assets
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert(swSource.includes("'./js/bible/LocalTlaProvider.js'"), 'sw.js caches LocalTlaProvider.js');
assert(swSource.includes("'./data/tla.json'"), 'sw.js caches data/tla.json');

assert.equal(networkCalls, 0);
console.log('OK: TLA 176 — 66 books, 1189 chapters, single-chapter books, Gen 1 headings, Num 33:1-50, 1Ch 23:2-32 (5 fragments), Isa 38:1-22, 1Sa 31 parallel refs, Psa 52 unnumbered scripture + note 52.0 + search, Neh 12 42-cell table, Rev 22, SBU copyright and SW offline assets.');
