import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse as parseHTML } from 'node-html-parser';
import { StrongRepository, normalizeStrongId } from '../js/bible/StrongRepository.js';
import { LocalRvr1960Provider } from '../js/bible/LocalRvr1960Provider.js';
import { LocalRvr1960StrongProvider } from '../js/bible/LocalRvr1960StrongProvider.js';
import { StrongStudyPanel, renderStrongVerseText } from '../js/bible/StrongStudyPanel.js';
import { createBibleReadingKey, parseBibleReadingKey } from '../js/bible/bibleInternalTest.js';
import { normalizeBibleVoiceText, getBibleVoicePoint } from '../js/bible/BibleReaderSelection.js';
import { escapeBibleHtml } from '../js/utils/text.js';

const root = new URL('../', import.meta.url);
const bytes = path => fs.readFileSync(new URL(path, root));
const json = path => JSON.parse(bytes(path).toString('utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const bible = json('data/rvr1960.json');
const mapManifest = json('data/strong/rvr1960-map-manifest.json');
const expectedCoreHash = 'fbe1285cdf3611ad670c76c5fcf2fc051a150429d2bf55be1b133565b387cd11';
assert.equal(hash(JSON.stringify(bible.map(({ abbrev, name, chapters, chapterHeadings }) =>
    ({ abbrev, name, chapters, chapterHeadings }))) + '\n'), expectedCoreHash,
    'Adding Strong must not alter Scripture, headings, book order or verse numbers.');
assert.equal(mapManifest.baseCoreContentSha256, expectedCoreHash);
assert.deepEqual(mapManifest.missingVerses, []);
assert.equal(mapManifest.counts.sourceStrongOccurrences, 491610);
assert.equal(mapManifest.counts.validSourceStrongOccurrences, 491605);
assert.equal(mapManifest.counts.alignedStrongOccurrences + mapManifest.counts.unalignedStrongOccurrences
    + mapManifest.counts.headingStrongOccurrences, 491605);
assert.deepEqual(mapManifest.invalidSourceCodes.map(({ reference, rawCode }) => [reference, rawCode]), [
    ['exo.16.29', 'H59213651'], ['exo.16.33', 'H3240853'], ['exo.17.7', 'H52541992'],
    ['psa.69.12', 'H83547941'], ['psa.69.13', 'H8605589']
]);
assert.equal(mapManifest.files.length, 66);

let calls = 0;
const localFetch = async path => {
    calls++;
    assert.match(path, /^\.\/data\/(?:rvr1960|strong\/[^.]+)\.json$/, 'Only bundled local data is allowed.');
    return { ok: true, json: async () => json(path) };
};
const repository = new StrongRepository({ fetchImpl: localFetch });
const baseProvider = new LocalRvr1960Provider({ fetchImpl: localFetch });
const provider = new LocalRvr1960StrongProvider({ baseProvider, strongRepository: repository });
const inventory = [];
const headingInventory = [];
const uniqueIds = new Set();
let totalVerses = 0, totalSpans = 0, alignedIds = 0, unalignedIds = 0, headingIds = 0, headingCount = 0, numberedVerses = 0;
const noteMarkup = note => `<button type="button" data-note-id="${escapeBibleHtml(note.id)}">nota</button>`;
const splitsSurrogate = (text, offset) => offset > 0 && offset < text.length
    && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset]);
for (const [bookIndex, book] of bible.entries()) {
    const file = mapManifest.files[bookIndex];
    assert.equal(file.bookId, book.abbrev);
    assert.equal(file.path, `data/strong/books/${book.abbrev}.json`);
    assert.equal(bytes(file.path).length, file.bytes);
    assert.equal(hash(bytes(file.path)), file.sha256, 'Each map must match its pinned import manifest.');
    const raw = json(file.path);
    assert.equal(raw.chapters.length, book.chapters.length);
    for (let chapterNumber = 1; chapterNumber <= book.chapters.length; chapterNumber++) {
        const plain = await baseProvider.getChapter(book.abbrev, chapterNumber);
        const strong = await provider.getChapter(book.abbrev, chapterNumber);
        assert.equal(strong.versionId, 'rvr60-strong');
        assert.equal(strong.verses.length, plain.verses.length);
        for (const [index, verse] of strong.verses.entries()) {
            const reference = `${book.abbrev}.${chapterNumber}.${verse.number}`;
            totalVerses++;
            for (const key of ['text', 'reference', 'subtitle', 'sourceNotes', 'headingNotes', 'footnotes', 'crossReferences']) {
                assert.deepEqual(verse[key], plain.verses[index][key], `${reference}: preserve ${key}`);
            }
            assert.equal(plain.verses[index].strongSpans.length, 0);
            assert.equal(plain.verses[index].strongUnalignedIds.length, 0);
            assert.equal(plain.verses[index].strongHeadingIds.length, 0);
            assert(Object.isFrozen(verse.strongHeadingIds));
            assert(Object.isFrozen(verse.strongSpans)); assert(Object.isFrozen(verse.strongUnalignedIds));
            const expectedSpans = raw.chapters[chapterNumber - 1].verses[verse.number] || [];
            const expectedUnaligned = raw.chapters[chapterNumber - 1].unaligned[verse.number] || [];
            assert.deepEqual(verse.strongSpans, expectedSpans);
            assert.deepEqual(verse.strongUnalignedIds, expectedUnaligned);
            const expectedHeadings = raw.chapters[chapterNumber - 1].headings?.[verse.number] || [];
            assert.deepEqual(verse.strongHeadingIds, expectedHeadings);
            headingIds += verse.strongHeadingIds.length;
            if (verse.strongHeadingIds.length) {
                headingCount++;
                headingInventory.push([reference, [...verse.strongHeadingIds].sort()]);
                assert.equal(book.abbrev, 'psa'); assert.equal(verse.number, 1);
                assert.deepEqual(verse.strongHeadingIds, mapManifest.headingReferences.find(item => item.reference === reference).ids);
            }
            let previousEnd = 0;
            for (const span of verse.strongSpans) {
                assert(Number.isInteger(span.start) && Number.isInteger(span.end));
                assert(span.start >= previousEnd && span.end > span.start && span.end <= verse.text.length);
                assert.equal(verse.text.slice(span.start, span.end), span.text);
                assert(!splitsSurrogate(verse.text, span.start) && !splitsSurrogate(verse.text, span.end));
                previousEnd = span.end;
                assert(Object.isFrozen(span) && Object.isFrozen(span.ids));
                assert(span.ids.length); assert.equal(new Set(span.ids).size, span.ids.length);
                for (const id of span.ids) assert.equal(normalizeStrongId(id), id);
                totalSpans++; alignedIds += span.ids.length;
            }
            unalignedIds += verse.strongUnalignedIds.length;
            const ids = [...new Set([...verse.strongSpans.flatMap(span => span.ids), ...verse.strongUnalignedIds, ...verse.strongHeadingIds])].sort();
            ids.forEach(id => uniqueIds.add(id));
            if (!mapManifest.missingVerses.includes(reference)) inventory.push([reference, ids]);
            else assert.equal(ids.length, 0, 'No invented Strong IDs for verses absent from the source.');
            const rendered = parseHTML(renderStrongVerseText(verse.text, verse.strongSpans, verse.sourceNotes,
                { bookId: book.abbrev, bookName: book.name, chapter: chapterNumber, verse: verse.number }, noteMarkup));
            assert.equal(rendered.querySelectorAll('.bible-strong-marker').length, verse.strongSpans.reduce((sum, span) => sum + span.ids.length, 0),
                `${reference}: every literal source number appears as one button.`);
            assert.deepEqual(rendered.querySelectorAll('[data-note-id]').map(node => node.getAttribute('data-note-id')),
                verse.sourceNotes.map(note => note.id), `${reference}: preserve every source note in order.`);
            assert.equal(rendered.querySelectorAll('.bible-strong-word, [data-strong-word]').length, 0,
                'Do not claim a verified Spanish word-to-lemma relationship.');
            let offset = 0;
            const displayed = [];
            function visit(node) {
                if (node.nodeType === 3) { offset += node.textContent.length; return; }
                if (node.getAttribute?.('data-note-id') !== undefined) return;
                if (node.classList?.contains('bible-strong-marker')) {
                    assert.equal(node.tagName, 'BUTTON');
                    const id = node.getAttribute('data-strong-ids');
                    assert.equal(node.textContent, id);
                    displayed.push({ id, offset });
                    return;
                }
                for (const child of node.childNodes || []) visit(child);
            }
            visit(rendered);
            assert.deepEqual(displayed, verse.strongSpans.flatMap(span => span.ids.map(id => ({ id, offset: span.end }))),
                reference + ': buttons retain the original number positions.');
            rendered.querySelectorAll('.bible-strong-marker, [data-note-id]').forEach(node => node.remove());
            assert.equal(rendered.textContent, verse.text, `${reference}: visible words must be unchanged.`);
            assert.equal(normalizeBibleVoiceText(rendered.textContent), normalizeBibleVoiceText(verse.text));
            if (verse.strongSpans.length) numberedVerses++;
        }
    }
}
assert.equal(totalVerses, 31104);
assert.equal(totalSpans, 446333);
assert.equal(alignedIds, 468121);
assert.equal(unalignedIds, 19598);
assert.equal(headingIds, 471);
assert.equal(headingCount, 116);
assert.equal(hash(JSON.stringify(headingInventory)), '4adf2ffa9c43149d1a5b0813ba77e070e8349232b5244a3b24ceba2a5e18940a',
    'The 116 source Psalm superscriptions retain their own IDs, separate from verse text.');
assert.equal(uniqueIds.size, 14143);
assert.equal(inventory.length, 31104);
assert.equal(calls, 67, 'All chapters reuse one base corpus and one map request per book.');
// Independently computed from the original SQLite source using <Sg> numbers and their documented valid ranges.
// This compares every verse's set, including detached IDs, without reusing the alignment importer.
assert.equal(hash(JSON.stringify(inventory)), 'a2114351112867291e141cef8928bcb28f0b032a1794d3c7b531118c04726124',
    'All source Strong IDs must remain attached to their exact source verse.');

const sourcePath = process.argv.find(arg => arg.startsWith('--source='))?.slice('--source='.length);
if (sourcePath) {
    assert.equal(hash(fs.readFileSync(sourcePath)), mapManifest.source.sha256);
    const clt = '/Library/Developer/CommandLineTools/usr/bin/python3';
    const python = fs.existsSync(clt) ? clt : 'python3';
    const rows = JSON.parse(execFileSync(python, ['-c', `import sqlite3,json,re,sys,pathlib
c=sqlite3.connect(pathlib.Path(sys.argv[1]).resolve().as_uri()+'?mode=ro&immutable=1',uri=True)
print(json.dumps([[b,ch,v,re.findall(r'<Sg>(.*?)</Sg>',t)] for b,ch,v,t in c.execute('select Book,Chapter,Verse,Scripture from Bible order by Book,Chapter,Verse')]))`, sourcePath], { encoding: 'utf8', maxBuffer: 16000000 }));
    assert.equal(rows.reduce((sum, row) => sum + row[3].length, 0), 491610);
    const validSourceId = value => {
        const match = value.match(/^([HG])([0-9]+)$/);
        const number = Number(match?.[2]);
        return match && number > 0 && number <= (match[1] === 'H' ? 8674 : 5624) ? match[1] + number : null;
    };
    assert.equal(rows.reduce((sum, row) => sum + row[3].filter(validSourceId).length, 0), 491605);
    assert.deepEqual(inventory, rows.map(([book, chapter, verse, ids]) =>
        [`${bible[book - 1].abbrev}.${chapter}.${verse}`, [...new Set(ids.map(validSourceId).filter(Boolean))].sort()]));
}
console.log(`OK: ${totalVerses} unchanged verses, ${totalSpans} validated offset spans, ${uniqueIds.size} source IDs, all original per-verse identities and every rendered word/reference preserved.`);

const lexiconManifest = json('data/strong/lexicon-source.json');
for (const [language, file] of Object.entries(lexiconManifest.files)) {
    assert.equal(file.file, language + '.json');
    const content = bytes('data/strong/' + file.file);
    assert.equal(content.length, file.bytes); assert.equal(hash(content), file.sha256);
}
const hebrew = await repository.loadDictionary('hebrew');
const greek = await repository.loadDictionary('greek');
assert.equal(Object.keys(hebrew).length, 8674);
assert.equal(Object.keys(greek).length, 5523);
const missingIds = [...uniqueIds].filter(id => !(id[0] === 'H' ? hebrew : greek)[id]);
assert.deepEqual(missingIds, [], 'Every number used in the Bible must resolve to an actual lexicon entry.');
for (const dictionary of [hebrew, greek]) for (const [id, entry] of Object.entries(dictionary)) {
    assert.equal(await repository.lookup(id), entry);
    assert(entry.definition.trim());
    assert(!entry.definition.includes('\ufffd'));
    assert(Object.isFrozen(entry));
    for (const related of entry.related) assert((related[0] === 'H' ? hebrew : greek)[related], 'Clickable related words must exist.');
}
assert.equal(Object.values(hebrew).filter(entry => entry.language === 'aramaic').length, lexiconManifest.counts.aramaic);
assert.equal((await repository.lookup('H00430')).id, 'H430');
assert.equal(await repository.lookup('H430a'), null, 'Suffixes must not be guessed.');
assert.equal(await repository.lookup('G2717'), null, 'A historical editorial gap is not a lexical entry.');
assert.equal(await repository.lookup('G3203'), null, 'Historical numbering gaps must not be fabricated.');
assert.equal((await repository.search({ query: '#H0430' }))[0].id, 'H430');
assert.equal((await repository.search({ query: '26', language: 'greek' }))[0].id, 'G26');
assert((await repository.search({ query: 'amor', language: 'greek' })).length > 0);
assert((await repository.search({ query: hebrew.H430.lemma, language: 'hebrew' })).some(entry => entry.id === 'H430'));
assert((await repository.search({ query: greek.G26.transliteration, language: 'greek' })).some(entry => entry.id === 'G26'));
assert.equal((await repository.search({ query: 'a', limit: 2 })).length, 2);
assert.deepEqual(await repository.search({ query: '   ' }), []);
for (const versionId of ['rv1909', 'rvr60', 'rvr60-strong']) for (const bookId of ['gen', '1jn', 'rev']) {
    assert.deepEqual(parseBibleReadingKey(createBibleReadingKey(versionId, bookId, 1)), { versionId, bookId, chapter: 1 });
}
assert.notEqual(createBibleReadingKey('rvr60', 'gen', 1), createBibleReadingKey('rvr60-strong', 'gen', 1));
console.log('OK: complete Hebrew/Greek lookup, explicit historical gaps, Spanish/lemma/number search and separate reading identities.');

// Fresh instances exercise shared requests and retry instead of relying on the already warm corpus.
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const sample = { bookId: 'gen', chapters: [{ verses: { 1: [{ start: 0, end: 4, text: 'Dios', ids: ['H0430'] }] }, unaligned: {} }] };
let loadCount = 0;
const pending = defer();
const shared = new StrongRepository({ fetchImpl: async () => { loadCount++; await pending.promise; return { ok: true, json: async () => sample }; } });
const requests = [shared.getChapterSpans('gen', 1, ['Dios creó.']), shared.getChapterSpans('gen', 1, ['Dios creó.'])];
pending.resolve();
const [first, second] = await Promise.all(requests);
assert.equal(loadCount, 1); assert.equal(first[1], second[1]);
assert.deepEqual(first[1][0].ids, ['H430']);
await assert.rejects(shared.getChapterSpans('gen', 1, ['Otro texto.']), /no coinciden/);
await shared.getChapterSpans('gen', 1, ['Dios creó.']); assert.equal(loadCount, 2, 'Invalid cached maps may be fetched again.');
let attempts = 0;
const retry = new StrongRepository({ fetchImpl: async () => { if (++attempts === 1) throw new Error('offline'); return { ok: true, json: async () => ({ H430: hebrew.H430 }) }; } });
await assert.rejects(retry.lookup('H430'), /offline/);
assert.equal((await retry.lookup('H430')).id, 'H430'); assert.equal(attempts, 2);
for (const change of [
    item => { item.chapters[0].verses[1][0].ids = ['H430a']; },
    item => { item.chapters[0].verses[1].push({ start: 1, end: 3, text: 'io', ids: ['H430'] }); },
    item => { item.chapters[0].verses[1][0].end = 999; },
    item => { item.bookId = 'exo'; }
]) {
    const item = structuredClone(sample); change(item);
    const invalid = new StrongRepository({ fetchImpl: async () => ({ ok: true, json: async () => item }) });
    await assert.rejects(invalid.getChapterSpans('gen', 1, ['Dios creó.']));
}
await assert.rejects(repository.getChapterSpans('../secret', 1, ['Dios']));

// A reference within the preceding text must coexist with the Strong number without changing words.
const phrase = 'Dios & <palabra> "viva"';
const spans = [{ start: 0, end: phrase.length, text: phrase, ids: ['H430'] }];
const safe = parseHTML(renderStrongVerseText(phrase, spans, [{ id: 'x"<script>', offset: 4 }],
    { bookName: '<img src=x>', chapter: 1, verse: 1 }, noteMarkup));
assert.equal(safe.querySelectorAll('script, img').length, 0);
assert.equal(safe.querySelectorAll('.bible-strong-marker').length, 1);
assert.equal(safe.querySelectorAll('[data-note-id]').length, 1);
safe.querySelectorAll('.bible-strong-marker, [data-note-id]').forEach(node => node.remove());
assert.equal(safe.textContent, phrase);
// Browser caret extraction keeps Scripture words and strips study numbers.
const fragment = parseHTML('Dios<button class="bible-strong-marker">H430</button> creó.');
const node = { nodeType: 3, parentElement: { closest: () => null } };
const textElement = { contains: value => value === node, ownerDocument: { createRange: () => ({ selectNodeContents() {}, setStart() {}, cloneContents: () => fragment }) } };
const verseElement = { querySelector: () => textElement, getAttribute: name => ({ 'data-verse-text': 'Dios creó.', 'data-verse-number': '1' }[name]), closest: () => ({ getAttribute: () => 'bible-rvr60-strong-gen-1' }) };
assert.deepEqual(getBibleVoicePoint({ startContainer: node, startOffset: 0 }, verseElement),
    { verseNumber: 1, offset: 0, readingKey: 'bible-rvr60-strong-gen-1' });

const anchor = () => ({ isConnected: true, classList: { remove() {} }, setAttribute() {}, focus() {} });
function panelHarness(repository) {
    let current = true, renders = 0;
    const panel = new StrongStudyPanel({ repository, isContextCurrent: () => current });
    panel.state = { anchor: anchor(), panel: { remove() {} }, cleanup() {}, history: [], language: 'all' };
    panel.render = () => { renders++; };
    return { panel, setCurrent: value => { current = value; }, renders: () => renders };
}
let delayed = defer();
let harness = panelHarness({ lookup: () => delayed.promise });
let operation = harness.panel.showEntry('H430');
harness.panel.close(); const closedRenders = harness.renders(); delayed.resolve(hebrew.H430); await operation;
assert.equal(harness.panel.state, null); assert.equal(harness.renders(), closedRenders);
delayed = defer(); harness = panelHarness({ lookup: () => delayed.promise });
operation = harness.panel.showEntry('H430'); harness.setCurrent(false); const staleRenders = harness.renders();
delayed.reject(new Error('late failure')); await operation; assert.equal(harness.renders(), staleRenders);
const older = defer(), newer = defer();
harness = panelHarness({ lookup: id => id === 'H430' ? older.promise : newer.promise });
const oldOperation = harness.panel.showEntry('H430'); const newOperation = harness.panel.showEntry('G26');
newer.resolve(greek.G26); await newOperation; older.resolve(hebrew.H430); await oldOperation;
assert.equal(harness.panel.state.entry.id, 'G26');
const oldSearch = defer(), newSearch = defer();
harness = panelHarness({ search: ({ query }) => query === 'vieja' ? oldSearch.promise : newSearch.promise });
const oldSearchOperation = harness.panel.search('vieja'); const newSearchOperation = harness.panel.search('amor');
newSearch.resolve([greek.G26]); await newSearchOperation; oldSearch.reject(new Error('late')); await oldSearchOperation;
assert.equal(harness.panel.state.results[0].id, 'G26'); assert.equal(harness.panel.state.error, '');
harness = panelHarness({ lookup: async () => null });
await harness.panel.showEntry('G2717');
assert.equal(harness.panel.state.entry, null);
assert.equal(harness.panel.state.error, 'La fuente no incluye una entrada para G2717.');
const maliciousPanel = new StrongStudyPanel({ repository });
maliciousPanel.position = () => {};
globalThis.document = { activeElement: null };
maliciousPanel.state = { panel: { innerHTML: '', contains: () => false }, mode: 'entry', ids: [], history: [], word: '<svg onload=x>', reference: '"<img>',
    entry: { id: 'H430', language: 'hebrew', lemma: '<script>x</script>', transliteration: '<img>', definition: '<img src=x onerror=x>', related: ['H1" onclick="x'] } };
maliciousPanel.render(); assert.equal(parseHTML(maliciousPanel.state.panel.innerHTML).querySelectorAll('script, img, svg, [onclick]').length, 0);
console.log('OK: concurrent loading, failures/retry, malformed maps, safe mixed annotations, word-aware selection and stale dictionary/search responses.');

// Replacing the clicked search control must not make its bubbling click look like an outside click.
const documentListeners = new Map();
const panelListeners = new Map();
const retiredButton = { isConnected: true, dataset: { strongAction: 'search' }, closest(selector) { return selector === '[data-strong-action]' ? this : null; } };
const panelElement = { setAttribute() {}, focus() {}, contains: () => false, querySelector: () => null,
    addEventListener: (type, callback) => panelListeners.set(type, callback), remove() {} };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = { createElement: () => panelElement, body: { append() {} },
    addEventListener: (type, callback) => documentListeners.set(type, callback), removeEventListener() {} };
const mounted = new StrongStudyPanel({ repository });
mounted.render = () => { if (mounted.state?.mode === 'search') retiredButton.isConnected = false; };
const trigger = { isConnected: true, contains: () => false, classList: { add() {}, remove() {} }, setAttribute() {}, focus() {} };
mounted.mount(trigger, { ids: ['H430'] });
let stopped = false;
const internalClick = { target: retiredButton, stopPropagation: () => { stopped = true; }, composedPath: () => [retiredButton, panelElement, document] };
panelListeners.get('click')(internalClick);
assert(stopped); assert.equal(retiredButton.isConnected, false); assert.equal(mounted.state.mode, 'search');
// Also check the path guard directly: a detached target must still count as an internal event.
documentListeners.get('click')(internalClick);
assert(mounted.state, 'Search must stay open after replacing the clicked element.');
documentListeners.get('click')({ target: { closest: () => null }, composedPath: () => [document] });
assert.equal(mounted.state, null, 'An actual outside click still closes the dictionary.');
console.log('OK: opening dictionary search survives DOM replacement; only a real outside click closes it.');
