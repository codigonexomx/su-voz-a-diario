import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { parse } from 'acorn';
import { LocalNtvProvider, NTV_VERSION_ID, NTV_VERSION_LABEL, NTV_VERSION_NAME } from '../js/bible/LocalNtvProvider.js';
import { BibleRepository } from '../js/bible/BibleRepository.js';
import { BIBLE_BOOK_DEFINITIONS } from '../js/bible/bibleBookIds.js';
import { createBibleReadingKey, parseBibleReadingKey, canAccessRemoteBibleVersions } from '../js/bible/bibleInternalTest.js';
import { adjacentChapter } from '../js/bible/ContinuousReader.js';
import { renderBibleReadingDocument } from '../js/bible/BibleReaderPresentation.js';
import { escapeBibleHtml } from '../js/utils/text.js';

let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error('Esta prueba no permite internet.'); };

const EXPECTED_BYTES = 9493217;
const EXPECTED_SHA256 = 'c788e33bfc9191f43bd0063bcd8580352af5abd155c740e055ae3cf14b74e327';

const bytes = readFileSync(new URL('../data/ntv.json', import.meta.url));
assert.equal(bytes.length, EXPECTED_BYTES, 'data/ntv.json exact byte size');
assert.equal(createHash('sha256').update(bytes).digest('hex'), EXPECTED_SHA256, 'data/ntv.json exact SHA-256');

const wwwBytes = readFileSync(new URL('../www/data/ntv.json', import.meta.url));
assert.equal(createHash('sha256').update(wwwBytes).digest('hex'), EXPECTED_SHA256, 'www/data/ntv.json matches data/ntv.json');

const bible = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
assert.equal(bible.schemaVersion, 1);
assert.equal(bible.versionId, 'ntv');
assert.equal(bible.books.length, 66);
assert.deepEqual(bible.books.map(book => book.id), BIBLE_BOOK_DEFINITIONS.map(book => book.id));

let loads = 0;
let releaseLoad;
const provider = new LocalNtvProvider({
    fetchImpl: async path => {
        assert.equal(path, './data/ntv.json');
        loads++;
        await new Promise(resolve => { releaseLoad = resolve; });
        return { ok: true, json: async () => bible };
    }
});

const concurrent = [provider.loadBible(), provider.getChapter('gen', 1), provider.getBooks()];
releaseLoad();
const [loaded, genesis1, catalog] = await Promise.all(concurrent);
assert.equal(loaded, bible);
assert.equal(loads, 1, 'Concurrent initial requests share a single load');
assert.equal(catalog.length, 66);
assert.equal(genesis1.versionId, NTV_VERSION_ID);
assert.equal(genesis1.versionLabel, NTV_VERSION_LABEL);
assert.equal(genesis1.versionName, NTV_VERSION_NAME);
assert.equal(genesis1.source, 'local');

let totalChapters = 0;
let totalBlocks = 0;
let totalVerseBlocks = 0;
let totalHeadings = 0;
let totalLabels = 0;
let totalNotes = 0;
let totalTables = 0;
let totalVerseGroups = 0;
let multiNumberGroups = 0;
let fragmentedRefs = 0;

for (const book of bible.books) {
    assert.equal(provider.getCanonicalBookId(' ' + book.id.toUpperCase() + ' '), book.id);
    for (const rawChapter of book.chapters) {
        totalChapters++;
        const ch = await provider.getChapter(book.id, rawChapter.number);
        assert(Object.isFrozen(ch));
        assert(Object.isFrozen(ch.verses));
        assert(Array.isArray(ch.blocks) && ch.blocks.length === rawChapter.blocks.length);
        assert(Array.isArray(ch.notes) && ch.notes.length === (rawChapter.notes || []).length);
        assert(Array.isArray(ch.tables) && ch.tables.length === (rawChapter.tables || []).length);

        totalBlocks += ch.blocks.length;
        totalNotes += ch.notes.length;
        totalTables += ch.tables.length;
        for (const block of ch.blocks) {
            if (block.type === 'verse') totalVerseBlocks++;
            else if (block.type === 'heading1') totalHeadings++;
            else if (block.type === 'label') totalLabels++;
        }
        for (const verse of ch.verses) {
            totalVerseGroups++;
            assert(Array.isArray(verse.verseNumbers) && verse.verseNumbers.length >= 1);
            assert(typeof verse.displayNumber === 'string' && verse.displayNumber.length >= 1);
            assert(Array.isArray(verse.sourceBlockIndices) && verse.sourceBlockIndices.length >= 1);
            assert(Array.isArray(verse.parts) && verse.parts.length >= 1);
            if (verse.verseNumbers.length > 1) multiNumberGroups++;
            if (verse.parts.length > 1) fragmentedRefs++;
        }
    }
}
assert.equal(loads, 1, 'Reading all 1,189 chapters reuses memory cache');
assert.equal(totalChapters, 1189);
assert.equal(totalBlocks, 33535);
assert.equal(totalVerseBlocks, 31092);
assert.equal(totalHeadings, 2256);
assert.equal(totalLabels, 187);
assert.equal(totalNotes, 4851);
assert.equal(totalTables, 17);
assert.equal(totalVerseGroups, 31064);
assert.equal(multiNumberGroups, 24);
assert.equal(fragmentedRefs, 27);

// Repository integration
const repository = new BibleRepository([provider]);
const versions = await repository.getVersions();
assert.equal(versions.length, 1);
assert.equal(versions[0].id, 'ntv');
assert.equal(versions[0].abbreviation, 'NTV');
assert.equal(versions[0].name, 'Nueva Traducción Viviente');

// Reading keys isolation
for (const bookId of ['gen', '1sa', 'jhn', '3jn', 'rev']) {
    const key = createBibleReadingKey('ntv', bookId, 1);
    assert.equal(key, `bible-ntv-${bookId}-1`);
    assert.deepEqual(parseBibleReadingKey(key), { versionId: 'ntv', bookId, chapter: 1 });
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
    RVR1960_VERSION_ID: 'rvr60', RV1909_VERSION_ID: 'rv1909', NTV_VERSION_ID: 'ntv',
    parseBibleReadingKey, createBibleReadingKey, canAccessRemoteBibleVersions, escapeBibleHtml,
    renderBibleReadingDocument, bibleRepository: repository,
    localNtvProvider: provider,
    localRvr1960Provider: { loadBible: async () => [], getCanonicalBookId: id => id },
    localRv1909Provider: { loadBible: async () => [], getCanonicalBookId: id => id },
    BIBLE_FOOTNOTE_SUPERSCRIPTS: Object.fromEntries([...'0123456789'].map((digit, index) => [digit, [...'⁰¹²³⁴⁵⁶⁷⁸⁹'][index]]))
});

for (const node of tree.body.filter(node => node.type === 'FunctionDeclaration')) {
    vm.runInContext(source.slice(node.start, node.end), context);
}
const getBibleChapter = vm.runInContext('getBibleChapter', context);
const renderBibleSourceBlocksDocument = vm.runInContext('renderBibleSourceBlocksDocument', context);

// 1. Genesis 1: normal reading, heading, notes, copyright
const gen1 = await getBibleChapter('gen', 1, 'ntv');
assert(gen1.content.includes('<h3 class="bible-reader-subtitle">El relato de la creación</h3>'), 'Genesis 1 heading rendered');
assert(gen1.content.includes('data-source-note-id="gen.1.fn1"'), 'Genesis 1:1 editorial note rendered');
assert(gen1.copyrightHtml.includes('data-translation="ntv"'), 'NTV copyright rendered');
assert(gen1.copyrightHtml.includes('Tyndale House Foundation'), 'NTV copyright attribution preserved');
assert(!gen1.content.includes('reading-copyright'), 'Copyright stays outside selectable Scripture');

// 2. Genesis 2:4: both fragments + intercalated heading between them
const gen2 = await getBibleChapter('gen', 2, 'ntv');
const gen2v4Matches = gen2.content.match(/data-verse-group-key="4"/g) || [];
assert.equal(gen2v4Matches.length, 2, 'Genesis 2:4 has 2 fragments');
const frag1Pos = gen2.content.indexOf('<span class="verse-text">Este es el relato de la creación de los cielos y la tierra.');
const headingPos = gen2.content.indexOf('<h3 class="bible-reader-subtitle">El hombre y la mujer en el Edén</h3>');
const frag2Pos = gen2.content.indexOf('<span class="verse-text">Cuando el Señor Dios hizo la tierra y los cielos,');
assert(frag1Pos > 0 && headingPos > frag1Pos && frag2Pos > headingPos, 'Genesis 2:4 intercalated heading sits strictly between fragment 1 and fragment 2');
assert.equal((gen2.content.match(/class="verse-number"[^>]*>4</g) || []).length, 1, 'Genesis 2:4 has only ONE verse-number button');

// 3. Song of Songs 1:4: all 3 fragments + intercalated speaker headings
const sng1 = await getBibleChapter('sng', 1, 'ntv');
const sng1v4Matches = sng1.content.match(/data-verse-group-key="4"/g) || [];
assert.equal(sng1v4Matches.length, 3, 'Song of Songs 1:4 has 3 fragments');
const sngFrag1 = sng1.content.indexOf('<span class="verse-text">¡Llévame contigo, ven, corramos!');
const sngHead1 = sng1.content.indexOf('<h3 class="bible-reader-subtitle">Las jóvenes de Jerusalén</h3>', sngFrag1);
const sngFrag2 = sng1.content.indexOf('<span class="verse-text">Cuánto nos alegramos por ti, oh rey;', sngHead1);
const sngHead2 = sng1.content.indexOf('<h3 class="bible-reader-subtitle">La joven</h3>', sngFrag2);
const sngFrag3 = sng1.content.indexOf('<span class="verse-text">Con razón te quieren las jóvenes.', sngHead2);
assert(sngFrag1 > 0 && sngHead1 > sngFrag1 && sngFrag2 > sngHead1 && sngHead2 > sngFrag2 && sngFrag3 > sngHead2,
    'Song of Songs 1:4 preserves all 3 fragments and intercalated headings in exact order');
assert.equal((sng1.content.match(/class="verse-number"[^>]*>4</g) || []).length, 1, 'Song of Songs 1:4 has only ONE verse-number button');

// 4. Numbers 1:20-21: grouped verse, single storage, both numbers resolve
const num1v20 = await provider.getVerse('num', 1, 20);
const num1v21 = await provider.getVerse('num', 1, 21);
assert.deepEqual(num1v20, num1v21, 'Numbers 1:20 and 1:21 resolve to the exact same group');
assert.equal(num1v20.displayNumber, '20-21');
assert.deepEqual([...num1v20.verseNumbers], [20, 21]);
const num1Partial = await provider.getPassage('num', 1, 21, 21);
assert.equal(num1Partial.includesWholeVerseGroups, true);
assert.deepEqual(num1Partial.includedVerseNumbers, [20, 21]);
const num1 = await getBibleChapter('num', 1, 'ntv');
assert.equal((num1.content.match(/data-verse-group-key="20,21"/g) || []).length, 1, 'Numbers 1:20-21 rendered ONCE');
assert(num1.content.includes('data-verse-display="20-21"'), 'Numbers 1:20-21 exposes displayNumber');
assert(num1.content.includes('data-verse-numbers="20,21"'), 'Numbers 1:20-21 exposes both verse numbers');
assert(num1.content.includes('>20-21</button>'), 'Numbers 1:20-21 displays 20-21 on button');
assert.equal(num1.tables.length, 2, 'Numbers 1 preserves auxiliary table data');

// 5. Psalms 3, 9, 24, 46: trailing label after last verse
for (const psalmNum of [3, 9, 24, 46]) {
    const psa = await getBibleChapter('psa', psalmNum, 'ntv');
    const lastVersePos = psa.content.lastIndexOf('class="verse-item');
    const trailingLabelPos = psa.content.lastIndexOf('<p class="bible-reader-label">');
    assert(trailingLabelPos > lastVersePos, `Psalm ${psalmNum} preserves trailing label after last verse`);
}

// 6. Matthew 17:21: numbering gap preserved without filling or renumbering
assert.equal(await provider.getVerse('mat', 17, 21), null, 'Matthew 17:21 is absent in source');
const mat17 = await getBibleChapter('mat', 17, 'ntv');
assert(!mat17.content.includes('data-verse-number="21"'), 'Matthew 17:21 is not invented');
assert(mat17.content.includes('data-verse-number="20"') && mat17.content.includes('data-verse-number="22"'), 'Matthew 17 jumps cleanly 20 -> 22');

// 7. Revelation 22: end of Bible navigation
const rev22 = await getBibleChapter('rev', 22, 'ntv');
assert.equal(rev22.verses.at(-1).number, 21, 'Revelation 22 ends at verse 21');
const booksNode = find(tree, node => node.type === 'Property' && node.key.name === 'bibleBooks');
const books = vm.runInContext('(' + source.slice(booksNode.value.start, booksNode.value.end) + ')', context);
assert.equal(adjacentChapter(books, 'rev', 22, 1), null, 'No chapter after Revelation 22');

// 8. Heading notes (Psalm 6) and unassigned chapter notes (Psalm 111)
const psa6 = await getBibleChapter('psa', 6, 'ntv');
assert(psa6.content.includes('data-source-note-id="psa.6.fn1"'), 'Psalm 6 heading/label note rendered');
const psa111 = await getBibleChapter('psa', 111, 'ntv');
assert(psa111.content.includes('bible-chapter-editorial-notes') && psa111.content.includes('data-source-note-id="psa.111.fn1"'), 'Psalm 111 unassigned chapter note rendered separately');

// 9. XSS / HTML escaping check
const xssHtml = renderBibleSourceBlocksDocument({
    versionId: 'ntv', bookId: 'gen', bookName: 'Génesis', chapter: 1,
    verses: [{
        number: 1, verseNumbers: [1], displayNumber: '1', parts: ['<script>alert(1)</script>'],
        text: '<script>alert(1)</script>',
        sourceNotes: [{ id: 'xss.1', kind: 'footnote', text: '<img src=x onerror=alert(1)>', offset: 5 }]
    }],
    blocks: [
        { type: 'heading1', verseNumbers: [], lines: ['<b>Título</b>'], newParagraph: true },
        { type: 'label', verseNumbers: [], lines: ['<i>Etiqueta</i>'], newParagraph: true },
        { type: 'verse', verseNumbers: [1], lines: ['<script>alert(1)</script>'], newParagraph: true }
    ],
    notes: []
});
assert(!xssHtml.includes('<script>'), 'Script tag escaped in verse text');
assert(!xssHtml.includes('<img '), 'Img tag escaped in footnote text');
assert(!xssHtml.includes('<b>Título</b>'), 'Heading HTML escaped');
assert(xssHtml.includes('&lt;script&gt;'), 'Escaped text preserved literally');

// 10. App methods: version selector, local search, selection reference label
function method(name) {
    const node = find(tree, item => item.type === 'Property' && item.key.name === name && item.value.type === 'FunctionExpression');
    assert(node, 'App method not found: ' + name);
    const code = source.slice(node.value.start, node.value.end);
    return vm.runInContext('(' + (node.method ? (node.value.async ? 'async ' : '') + 'function' + code : code) + ')', context);
}
const app = {
    currentBibleVersion: 'ntv', bibleBooks: books,
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

const readerVersions = app.getBibleReaderVersions();
const ntvEntries = readerVersions.filter(v => v.id === 'ntv');
assert.equal(ntvEntries.length, 1, 'Single NTV entry in getBibleReaderVersions');
assert.equal(ntvEntries[0].label, 'NTV');
assert.equal(ntvEntries[0].name, 'Nueva Traducción Viviente');
assert.equal(app.getLocalBibleSearchVersionId(), 'ntv');

await app.performBibleSearch('46.500');
assert.equal(app.bibleSearchIndexVersion, 'ntv');
assert.equal(app.bibleSearchData.length, 31064, 'NTV search index contains 31,064 unique verse groups');
const numHit = app.bibleSearchResults.find(r => r.bookId === 'num' && r.chapter === 1 && r.verse === 20);
assert(numHit, 'Numbers 1:20-21 found by search in NTV');
assert.equal(numHit.displayNumber, '20-21');
const searchHtml = app.renderBibleSearchResults();
assert(searchHtml.includes('Números 1:20-21 · NTV'), 'Search result displays full group range 20-21');
assert(searchHtml.includes('data-version-id="ntv"'), 'Search result opens NTV edition');

// Selection reference label for grouped & fragmented verses
app.currentSelectionDate = 'bible-ntv-num-1';
app.activeSelectionSurface = {
    querySelectorAll: () => [{ getAttribute: attr => ({ 'data-verse-number': '20', 'data-verse-numbers': '20,21' })[attr] }]
};
assert.equal(app.getBibleSelectionReferenceLabel(), 'Números 1:20-21');

app.currentSelectionDate = 'bible-ntv-gen-2';
app.activeSelectionSurface = {
    querySelectorAll: () => [
        { getAttribute: attr => ({ 'data-verse-number': '4', 'data-verse-numbers': '4' })[attr] },
        { getAttribute: attr => ({ 'data-verse-number': '4', 'data-verse-numbers': '4' })[attr] }
    ]
};
assert.equal(app.getBibleSelectionReferenceLabel(), 'Génesis 2:4');

// Service Worker includes NTV assets
const swSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert(swSource.includes("'./js/bible/LocalNtvProvider.js'"), 'sw.js caches LocalNtvProvider.js');
assert(swSource.includes("'./data/ntv.json'"), 'sw.js caches data/ntv.json');

assert.equal(networkCalls, 0);
console.log('OK: NTV — 66 books, 1189 chapters, 33535 blocks, 31064 groups, 4851 notes, 17 tables, Gen 1, Gen 2:4, Song 1:4, Num 1:20-21, Psa 3/9/24/46, Mat 17:21, Rev 22, heading/unassigned notes, XSS escaping, local search, selection labels and SW offline assets.');
