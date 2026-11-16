import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { parse as parseJavaScript } from 'acorn';
import { parse as parseHTML } from 'node-html-parser';
import { LocalRvr1960Provider, RVR1960_VERSION_ID } from '../js/bible/LocalRvr1960Provider.js';
import { renderBibleReadingDocument } from '../js/bible/BibleReaderPresentation.js';
import { escapeBibleHtml } from '../js/utils/text.js';
import { normalizeBibleVoiceText } from '../js/bible/BibleReaderSelection.js';
import { createRvr1960ReferenceParser } from './lib/rvr1960References.mjs';
import { createBibleReadingKey, parseBibleReadingKey } from '../js/bible/bibleInternalTest.js';

let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error('No network allowed in reference validation.'); };
const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const bible = JSON.parse(read('data/rvr1960.json'));
const byBook = new Map(bible.map(book => [book.abbrev, book]));
const hash = data => createHash('sha256').update(data).digest('hex');
const scriptureOnly = bible.map(({ abbrev, name, chapters, chapterHeadings }) => ({ abbrev, name, chapters, chapterHeadings }));
assert.equal(hash(JSON.stringify(scriptureOnly) + '\n'),
    'fbe1285cdf3611ad670c76c5fcf2fc051a150429d2bf55be1b133565b387cd11',
    'Adding references must not change any Scripture text, headings, book order or verse numbering.');

const inventory = [];
const allNotes = [];
const ids = new Set();
const counts = { 'cross-reference': 0, footnote: 0, parallel: 0 };
let headingCrossReferences = 0, headingFootnotes = 0;
function validateEndpoint(endpoint) {
    const chapter = byBook.get(endpoint?.bookId)?.chapters?.[endpoint?.chapter - 1];
    assert(chapter, `Unknown reference book/chapter: ${JSON.stringify(endpoint)}`);
    assert(Number.isInteger(endpoint.verse) && endpoint.verse >= 1 && endpoint.verse <= chapter.length,
        `Reference verse outside corpus: ${JSON.stringify(endpoint)}`);
}
for (const book of bible) {
    assert.equal(book.chapterAnnotations?.length, book.chapters.length, 'Every chapter has annotation metadata.');
    for (const [chapterIndex, annotations] of book.chapterAnnotations.entries()) {
        for (const [group, anchor] of [['verses', 'verse'], ['headings', 'heading']]) {
            for (const [number, notes] of Object.entries(annotations[group] || {})) {
                const verse = book.chapters[chapterIndex][Number(number) - 1];
                assert.equal(typeof verse, 'string', 'Annotations require a real containing/next verse.');
                assert(Array.isArray(notes));
                for (const note of notes) {
                    assert(note.id && !ids.has(note.id), `Unique annotation id required: ${note.id}`);
                    ids.add(note.id);
                    assert.equal(note.anchor, anchor);
                    assert(Object.hasOwn(counts, note.kind));
                    assert.equal(typeof note.text, 'string');
                    assert(note.text.trim());
                    assert(!/[\uFFFD<>]/u.test(note.text), 'Notes are plain Unicode text, not HTML.');
                    counts[note.kind]++;
                    if (anchor === 'heading' && note.kind === 'cross-reference') headingCrossReferences++;
                    if (anchor === 'heading' && note.kind === 'footnote') headingFootnotes++;
                    if (anchor === 'verse') {
                        assert(Number.isInteger(note.offset) && note.offset >= 0 && note.offset <= verse.length,
                            `Offset outside verse: ${note.id}`);
                        assert(!(/[\uD800-\uDBFF]/.test(verse[note.offset - 1] || '') &&
                            /[\uDC00-\uDFFF]/.test(verse[note.offset] || '')), 'Do not split Unicode code points.');
                    }
                    assert(Array.isArray(note.references));
                    if (note.kind !== 'footnote') assert(note.references.length, `Unresolved source citation: ${note.text}`);
                    for (const reference of note.references) {
                        validateEndpoint(reference.start); validateEndpoint(reference.end);
                        const startIndex = bible.indexOf(byBook.get(reference.start.bookId));
                        const endIndex = bible.indexOf(byBook.get(reference.end.bookId));
                        assert(endIndex > startIndex || (endIndex === startIndex && (reference.start.chapter < reference.end.chapter ||
                            (reference.start.chapter === reference.end.chapter && reference.start.verse <= reference.end.verse))));
                    }
                    inventory.push(JSON.stringify({ chapter: `${book.abbrev.toUpperCase()}.${chapterIndex + 1}`, kind: note.kind, text: note.text }));
                    allNotes.push({ bookId: book.abbrev, chapter: chapterIndex + 1, number: Number(number), note });
                }
            }
        }
    }
}
assert.deepEqual(counts, { 'cross-reference': 3482, footnote: 302, parallel: 567 });
assert.equal(allNotes.length, 4351);
assert.equal(headingCrossReferences, 12);
assert.equal(headingFootnotes, 1);
// Independently extracted from all .note .body and .r elements in pinned original HTML.
// Sorted multiset retains duplicates: a repeated footnote at a second word is not discarded.
assert.equal(hash(JSON.stringify(inventory.sort())),
    '5ed8d6b64d95f6bb3bfa502a170ccfb8f89adc73e4df91ca43766f9a325a3fc3',
    'All original annotation texts and chapter identities must be preserved.');

// Optionally compare against the actual downloaded HTML, independent of the importer.
const sourcePath = process.argv.find(arg => arg.startsWith('--source='))?.slice('--source='.length);
if (sourcePath) {
    assert(existsSync(sourcePath));
    const original = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const originalInventory = [];
    for (const book of original.books) {
        const seen = new Set();
        for (const chapter of book.chapters) {
            if (seen.has(chapter.usfm)) continue;
            seen.add(chapter.usfm);
            for (const element of parseHTML(chapter.html).querySelectorAll('.note, .r')) {
                const parallel = element.classList.contains('r');
                originalInventory.push(JSON.stringify({ chapter: chapter.usfm,
                    kind: parallel ? 'parallel' : element.classList.contains('x') ? 'cross-reference' : 'footnote',
                    text: (parallel ? element.textContent : element.querySelector('.body').textContent).replace(/\s+/g, ' ').trim() }));
            }
        }
    }
    assert.deepEqual(inventory, originalInventory.sort(), 'Bundled annotations equal the independently read original HTML.');
}
const findNote = (bookId, chapter, number, text) => {
    const result = allNotes.find(row => row.bookId === bookId && row.chapter === chapter && row.number === number && row.note.text === text);
    assert(result, `${bookId} ${chapter}:${number} ${text}`);
    return result.note;
};
const gen13 = findNote('gen', 1, 3, '2 Co. 4.6.');
assert.deepEqual(gen13.references[0].start, { bookId: '2co', chapter: 4, verse: 6 });
assert.equal(byBook.get('gen').chapters[0][2].slice(0, gen13.offset).trimEnd(), 'Y dijo Dios: Sea la luz;');
const gen127 = findNote('gen', 1, 27, 'Mt. 19.4; Mr. 10.6.');
assert.deepEqual(gen127.references.map(reference => reference.start), [
    { bookId: 'mat', chapter: 19, verse: 4 }, { bookId: 'mrk', chapter: 10, verse: 6 }
]);
const ex31 = allNotes.find(row => row.bookId === 'exo' && row.chapter === 31 && row.note.text === '(Ex. 35.30—36.1)');
assert(ex31); assert.equal(ex31.note.anchor, 'heading');
assert.deepEqual(ex31.note.references[0].start, { bookId: 'exo', chapter: 35, verse: 30 });
assert.deepEqual(ex31.note.references[0].end, { bookId: 'exo', chapter: 36, verse: 1 });
const gen11 = allNotes.find(row => row.bookId === 'gen' && row.chapter === 11 && row.note.text === '(1 Cr. 1.24-27)');
assert(gen11); assert.equal(gen11.number, 10, 'Skip empty repeated verse wrappers after a heading.');
assert.equal(findNote('psa', 3, 1, '2 S. 15.13—17.22.').anchor, 'heading');
assert.equal(findNote('psa', 92, 1, '92.1 Aquí equivale a sábado.').anchor, 'heading');
const titles = allNotes.flatMap(row => row.note.references).filter(reference => reference.title || reference.titleOnly);
assert(titles.length > 0, 'References to Psalm superscriptions must remain explicit.');

const provider = new LocalRvr1960Provider({ fetchImpl: async () => ({ ok: true, json: async () => bible }) });
for (const book of bible) for (const [index, metadata] of book.chapterAnnotations.entries()) {
    const chapter = await provider.getChapter(book.abbrev, index + 1);
    for (const verse of chapter.verses) {
        assert.deepEqual(verse.sourceNotes, metadata.verses?.[verse.number] || []);
        assert.deepEqual(verse.headingNotes, metadata.headings?.[verse.number] || []);
        assert.equal(verse.text, book.chapters[index][verse.number - 1]);
    }
}
console.log('OK: 4,351 original annotations, complete source-text inventory, every citation destination, heading anchors, Unicode offsets, untouched Scripture and provider propagation.');

const source = read('js/app.js');
const tree = parseJavaScript(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, predicate) {
    if (predicate(node)) return node;
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
        if (child?.type) { const result = find(child, predicate); if (result) return result; }
    }
}
const context = vm.createContext({ console, RVR1960_VERSION_ID, RV1909_VERSION_ID: 'rv1909',
    escapeBibleHtml, createBibleReadingKey, parseBibleReadingKey, renderBibleReadingDocument, normalizeBibleVoiceText,
    bibleRepository: { getChapter: (_version, book, chapter) => provider.getChapter(book, chapter) },
    window: { App: { currentBibleVersion: 'rvr60', sessionOverrideBibleVersion: 'nvi' } },
    BIBLE_FOOTNOTE_SUPERSCRIPTS: Object.fromEntries([...'0123456789'].map((digit, index) => [digit, [...'⁰¹²³⁴⁵⁶⁷⁸⁹'][index]])) });
for (const node of tree.body.filter(item => item.type === 'FunctionDeclaration')) vm.runInContext(source.slice(node.start, node.end), context);
function method(name) {
    const node = find(tree, item => item.type === 'Property' && item.key.name === name && item.value.type === 'FunctionExpression');
    assert(node, name);
    return vm.runInContext('(' + source.slice(node.value.start, node.value.end) + ')', context);
}
const renderChapter = vm.runInContext('getBibleChapter', context);
for (const [bookId, chapterNumber] of [['gen', 1], ['exo', 31], ['psa', 3], ['psa', 92]]) {
    const chapter = await provider.getChapter(bookId, chapterNumber);
    const rendered = await renderChapter(bookId, chapterNumber, 'rvr60');
    const dom = parseHTML(rendered.content);
    for (const verse of chapter.verses) {
        const element = dom.querySelector(`.verse-item[data-verse-number="${verse.number}"]`);
        assert(element);
        assert.equal(element.getAttribute('data-verse-text'), verse.text);
        assert.equal(element.getAttribute('data-verse-full'), verse.text);
    }
    assert.deepEqual(rendered.verses, chapter.verses, 'Rendered metadata preserves Scripture and annotation objects.');
}
assert.equal(networkCalls, 0);

// Exercise source grammar explicitly, including inherited chapters, single-chapter books,
// verse lists, cross-chapter/book ranges and references specifically to a Psalm title.
const parseReference = createRvr1960ReferenceParser(bible);
const endpoints = text => parseReference(text).map(({ start, end }) => [start, end]);
const point = (bookId, chapter, verse) => ({ bookId, chapter, verse });
assert.deepEqual(endpoints('1 S. 23.19; 26.1.'), [
    [point('1sa', 23, 19), point('1sa', 23, 19)], [point('1sa', 26, 1), point('1sa', 26, 1)]
]);
assert.deepEqual(endpoints('Jud. 14; Flm. 10-12.'), [
    [point('jud', 1, 14), point('jud', 1, 14)], [point('phm', 1, 10), point('phm', 1, 12)]
]);
assert.deepEqual(endpoints('2 S. 15.23,28.'), [
    [point('2sa', 15, 23), point('2sa', 15, 23)], [point('2sa', 15, 28), point('2sa', 15, 28)]
]);
assert.deepEqual(endpoints('Dt. 32.43 (Gr.)'), [[point('deu', 32, 43), point('deu', 32, 43)]]);
const titleAndText = parseReference('(Sal. 18 título; 1-50)');
assert.equal(titleAndText.length, 2);
assert.equal(titleAndText[0].titleOnly, true);
assert.equal(titleAndText[1].titleOnly, undefined);
assert.deepEqual(titleAndText[1].end, point('psa', 18, 50));
const crossBook = parseReference('1 S. 31.13—2 S. 1.2.')[0];
assert.deepEqual(crossBook.end, point('2sa', 1, 2));
for (const invalid of ['Gn. 999.1.', 'Gn. 1.999.', 'Gn. 1.5-3.', 'Inventado 1.1.', 'Gn. 1.1;']) {
    assert.throws(() => parseReference(invalid), `Reject unresolved or invalid citation: ${invalid}`);
}
assert.equal(allNotes.reduce((total, row) => total + row.note.references.length, 0), 6395);

// Verify every source note reaches a clickable marker, including all notes in titles.
// Scripture data attributes, visible verse words, clipboard text and voice stay plain.
const expectedIds = new Set(allNotes.map(row => row.note.id));
const renderedIds = new Set();
const voice = method('getBibleChapterVoiceVerses');
const copy = method('getSelectedVerseCopyData');
const books = bible.map(book => ({ id: book.abbrev, name: book.name, chapters: book.chapters.length }));
for (const book of bible) for (let number = 1; number <= book.chapters.length; number++) {
    const chapter = await provider.getChapter(book.abbrev, number);
    const rendered = await renderChapter(book.abbrev, number, 'rvr60');
    const dom = parseHTML(rendered.content);
    const voiceVerses = voice(chapter, book.name, number);
    assert.equal(voiceVerses.length, chapter.verses.length);
    for (const marker of dom.querySelectorAll('[data-source-note-id]')) {
        const id = marker.getAttribute('data-source-note-id');
        assert(expectedIds.has(id) && !renderedIds.has(id), `Expected exactly one source marker: ${id}`);
        renderedIds.add(id);
        assert.equal(marker.tagName, 'BUTTON');
        assert.equal(marker.getAttribute('data-version-id'), 'rvr60');
        const note = allNotes.find(row => row.note.id === id).note;
        if (note.kind === 'footnote') {
            assert.equal(marker.getAttribute('data-action'), 'open-bible-footnote');
            assert.equal(decodeURIComponent(marker.getAttribute('data-footnote-text')), note.text);
        } else {
            assert.equal(marker.getAttribute('data-action'), 'open-cross-reference');
            const payload = JSON.parse(decodeURIComponent(marker.getAttribute('data-source-annotation')));
            assert.equal(payload.text, note.text);
            assert.deepEqual(payload.references, note.references);
        }
        if (note.anchor === 'heading') assert.equal(marker.closest('.verse-item'), null, 'Heading notes are not attached to verse 1.');
    }
    for (const verse of chapter.verses) {
        const element = dom.querySelector(`.verse-item[data-verse-number="${verse.number}"]`);
        assert.equal(element.getAttribute('data-verse-text'), verse.text);
        assert.equal(element.getAttribute('data-verse-full'), verse.text);
        const textElement = element.querySelector('.verse-text');
        textElement.querySelectorAll('[data-source-note-id]').forEach(marker => marker.remove());
        assert.equal(textElement.textContent, verse.text, `Markers must preserve visible words: ${book.abbrev}.${number}.${verse.number}`);
        assert.equal(voiceVerses[verse.number - 1].text, normalizeBibleVoiceText(verse.text));
        if (verse.sourceNotes.length) {
            const clipboard = await copy.call({ currentSelectedVerse: element,
                currentSelectionDate: createBibleReadingKey('rvr60', book.abbrev, number),
                getSelectedTextVersionLabel: () => 'RVR1960', getSelectedTextSource: () => 'bible', bibleBooks: books });
            assert.equal(clipboard.text, verse.text);
            assert.equal(clipboard.version, 'RVR1960');
        }
    }
}
assert.equal(renderedIds.size, 4351);

// Passage reads use the edition from the source marker despite another session override.
const requestedVersions = [];
context.bibleRepository.getChapter = async (versionId, bookId, chapter) => {
    requestedVersions.push(versionId);
    return provider.getChapter(bookId, chapter);
};
const passageReader = method('getBibleCrossReferencePassage');
const passageApp = { currentBibleVersion: 'nvi', bibleCrossReferencePassageCache: new Map(), bibleBooks: books,
    normalizeBibleText: value => value.replace(/\s+/g, ' ').trim() };
const genTarget = await passageReader.call(passageApp, gen13.references[0], 'rvr60');
assert.equal(genTarget.verses[0].text, byBook.get('2co').chapters[3][5]);
const crossing = await passageReader.call(passageApp, ex31.note.references[0], 'rvr60');
assert.deepEqual(Array.from(crossing.verses, verse => [verse.chapter, verse.number]),
    [[35, 30], [35, 31], [35, 32], [35, 33], [35, 34], [35, 35], [36, 1]]);
const betweenBooks = await passageReader.call(passageApp, crossBook, 'rvr60');
assert.equal(betweenBooks.verses.length, 3);
assert.equal(betweenBooks.verses[1].text, byBook.get('2sa').chapters[0][0]);
const titlePassage = await passageReader.call(passageApp, titleAndText[0], 'rvr60');
assert.equal(titlePassage.verses.length, 0, 'A reference to the title must not substitute the first verse.');
assert(titlePassage.headings[0].includes('Al músico principal'));
assert(requestedVersions.length > 0 && requestedVersions.every(version => version === 'rvr60'));
const readsBeforeCache = requestedVersions.length;
assert.equal(await passageReader.call(passageApp, gen13.references[0], 'rvr60'), genTarget);
assert.equal(requestedVersions.length, readsBeforeCache);
await passageReader.call(passageApp, gen13.references[0], 'nvi');
assert.equal(requestedVersions.at(-1), 'nvi', 'Passage cache is isolated per edition.');

const button = attributes => ({ isConnected: true, getAttribute: name => attributes[name] ?? null });
const sourceButton = button({ 'data-book-id': 'gen', 'data-chapter': '1', 'data-verse': '3',
    'data-version-id': 'rvr60', 'data-source-annotation': encodeURIComponent(JSON.stringify(gen13)) });
const open = method('openBibleCrossReference');
const openApp = { currentBibleVersion: 'rvr60', bibleCrossReferencePopover: null,
    getBibleCrossReferencesForVerse() { assert.fail('Source edition citations must not use OpenBible votes.'); },
    mountBibleCrossReferencePopover(anchor, state) {
        this.bibleCrossReferencePopover = { ...state, anchor, popover: { focus() {} } };
    }, pushBibleCrossReferenceHistory() {}, showToast() { assert.fail('Unexpected source reference error.'); } };
await open.call(openApp, sourceButton);
assert.equal(openApp.bibleCrossReferencePopover.versionId, 'rvr60');
assert.equal(openApp.bibleCrossReferencePopover.references.length, 1);
assert.equal(openApp.bibleCrossReferencePopover.references[0].votes, undefined);
assert.equal(openApp.bibleCrossReferencePopover.sourceAnnotation.text, gen13.text);

// Closing the panel (or changing edition) while a request is pending must prevent
// both success and rejection from mounting a new panel or updating a closed one.
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const plainButton = button({ 'data-book-id': 'gen', 'data-chapter': '1', 'data-verse': '3' });
for (const outcome of ['resolve', 'reject']) for (const cancel of ['close', 'version', 'disconnect']) {
    const pending = defer();
    const app = { ...openApp, bibleCrossReferencePopover: null, currentBibleVersion: 'rvr60',
        getBibleCrossReferencesForVerse: () => pending.promise,
        mountBibleCrossReferencePopover() { assert.fail('Stale request reopened the reference panel.'); } };
    const anchor = { ...plainButton };
    const work = open.call(app, anchor);
    if (cancel === 'close') app.bibleCrossReferenceRequestId++;
    if (cancel === 'version') app.currentBibleVersion = 'nvi';
    if (cancel === 'disconnect') anchor.isConnected = false;
    pending[outcome](outcome === 'resolve' ? gen13.references : new Error('Late request failure'));
    await work;
    assert.equal(app.bibleCrossReferencePopover, null);
}
const select = method('selectBibleCrossReferenceFromPopover');
for (const outcome of ['resolve', 'reject']) for (const cancel of ['close', 'replace']) {
    const pending = defer();
    let updates = 0;
    const state = { references: gen127.references, versionId: 'rvr60',
        popover: { innerHTML: '', focus() {} }, updatePosition() { updates++; } };
    const app = { currentBibleVersion: 'nvi', bibleCrossReferencePopover: state,
        pushBibleCrossReferenceHistory() {}, renderBibleCrossReferencePanel: () => 'loading',
        getBibleCrossReferencePassage(reference, versionId) { assert.equal(versionId, 'rvr60'); return pending.promise; } };
    const work = select.call(app, 0);
    assert.equal(updates, 1);
    if (cancel === 'close') app.bibleCrossReferencePopover = null;
    else state.selectedReference = gen127.references[1];
    pending[outcome](outcome === 'resolve' ? genTarget : new Error('Late passage failure'));
    await work;
    assert.equal(updates, 1, 'A stale passage result/error must not update the panel.');
    assert.equal(state.passage, null);
}
const stored = new Map();
context.localStorage = { setItem: (key, value) => stored.set(key, value) };
const navigate = method('navigateToBibleCrossReference');
const navigations = [];
const navApp = { currentBibleVersion: 'nvi', bibleBooks: books, currentView: 'home',
    bibleCrossReferencePopover: { versionId: 'rvr60' },
    closeBibleCrossReferencePopover() { this.bibleCrossReferencePopover = null; },
    navigateToVerse(...args) { navigations.push(args); } };
navigate.call(navApp, button({ 'data-book-id': 'phm', 'data-chapter': '1', 'data-verse': '10', 'data-end-verse': '12' }));
assert.deepEqual(navigations[0], ['phm', 1, 10, 12]);
assert.equal(navApp.currentBibleVersion, 'rvr60');
assert.equal(stored.get('current-bible-version'), 'rvr60');
navigate.call(navApp, button({ 'data-book-id': 'psa', 'data-chapter': '59', 'data-verse': '1',
    'data-end-verse': '1', 'data-title-only': 'true', 'data-version-id': 'rvr60' }));
assert.deepEqual(navigations[1], ['psa', 59, null, null]);
assert.equal(networkCalls, 0);
console.log('OK: every annotation renders once; copy and voice preserve Scripture; source-edition passages, ranges, Psalm titles, navigation and late asynchronous responses validated.');
