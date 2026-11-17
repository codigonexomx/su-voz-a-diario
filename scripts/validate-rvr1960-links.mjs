import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { LocalRvr1960Provider } from '../js/bible/LocalRvr1960Provider.js';
import { escapeBibleHtml } from '../js/utils/text.js';
import { renderBibleReadingDocument } from '../js/bible/BibleReaderPresentation.js';
import { parseBibleReadingKey } from '../js/bible/bibleInternalTest.js';

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const names = ['createMeditationReferenceModel', 'getNotebookReferenceVersion', 'loadPinnedReferenceText',
    'showReferencePreview', 'closeReferencePreview', 'isChapterLoaded', 'handleReferenceClick'];
const definitions = new Map();
const sessionDefinitions = new Map();
function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'AssignmentExpression' && node.left.object?.name === 'App'
        && names.includes(node.left.property?.name)) definitions.set(node.left.property.name, source.slice(node.right.start, node.right.end));
    if (node.type === 'Property' && ['toggleNote', 'openMeditationSession', 'getDailyReadingVersionId', 'meditateOnSelectedPassage'].includes(node.key?.name)) {
        sessionDefinitions.set(node.key.name, source.slice(node.value.start, node.value.end));
    }
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
        if (child && typeof child === 'object') visit(child);
    }
}
visit(tree);
assert.equal(definitions.size, names.length);
const preferences = new Map();
let requests = [], popover, focused = 0;
const classList = () => {
    const values = new Set();
    return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
};
const context = vm.createContext({
    WeakMap, parseBibleReadingKey, RVR1960_VERSION_ID: 'rvr60', localStorage: { setItem: (key, value) => preferences.set(key, value) },
    setTimeout: callback => callback(),
    document: { querySelector: () => null, getElementById: () => popover, removeEventListener() {} },
    BibleReferenceService: { getBookId: () => 'gen',
        generateVersesHTML: (verses, start, end) => verses.filter(v => v.number >= start && v.number <= end).map(v => v.text).join(' ') },
    getBibleChapter: (book, chapter, version) => new Promise((resolve, reject) => requests.push({ book, chapter, version, resolve, reject }))
});
const methods = Object.fromEntries([...definitions].map(([name, definition]) => [name, vm.runInContext(`(${definition})`, context)]));
function makeApp() {
    requests = []; preferences.clear(); focused = 0;
    const elements = { '.ref-preview-title': { textContent: '' }, '.ref-preview-body': { innerHTML: '' },
        '.ref-preview-actions': { style: {} } };
    popover = { isConnected: true, classList: classList(), querySelector: selector => elements[selector], focus() {} };
    const app = { ...methods, currentMeditationSessionId: 'session-a', currentBibleVersion: 'nbla', sessionOverrideBibleVersion: 'nbla',
        bibleBooks: [{ id: 'gen', name: 'Génesis' }],
        getBibleReaderVersions: () => ['rv1909', 'rvr60', 'rvr60-strong', 'nbla', 'nvi', 'biblia-libre'].map(id => ({ id })),
        getBibleVersionLabel: id => id === 'rvr60' ? 'RVR1960' : id.toUpperCase(),
        generateUUID: () => 'new-reference', devotionalReferences: { teaching: [] },
        _getOrCreatePopover: () => popover, positionReferencePreview() {}, _setupPopoverActions(_p, step, refId) { this.actionRef = [step, refId]; },
        hideSelectionPanel() {}, clearVerseSelection() { this.selectionCleared = true; },
        scrollToTargetVerse() { this.scrolled = true; }, navigate(view) { this.destination = view; },
        saveBibleLastLocation(book, chapter, options) { this.saved = { book, chapter, options, versionAtSave: this.currentBibleVersion }; }
    };
    return app;
}
const chip = () => ({ isConnected: true, focus() { focused++; } });
const ref = (id, versionId) => ({ id, bookId: 'gen', book: 'Génesis', chapter: 1, verseStart: 1, verseEnd: 2,
    label: `Génesis 1:1-2 ${id}`, ...(versionId ? { versionId } : {}) });
function finish(request, text = 'Texto correcto', versionId = request.version) {
    request.resolve({ versionId, bookId: request.book, chapter: request.chapter, verses: [{ number: 1, text }, { number: 2, text: 'final' }] });
}
const body = () => popover.querySelector('.ref-preview-body').innerHTML;

let app = makeApp();
const created = app.createMeditationReferenceModel({ bookName: 'Génesis', chapterNum: 1, minVerse: 1, maxVerse: 2 });
assert.equal(created.versionId, 'rvr60'); assert.equal(created.bookId, 'gen'); assert.equal(created.label, 'Génesis 1:1-2');
assert.equal(app.getNotebookReferenceVersion(created), 'rvr60', 'New references do not inherit the session or reader version');
const historical = ref('historical'); const snapshot = JSON.stringify(historical);
assert.equal(app.getNotebookReferenceVersion(historical), 'nbla');
app.sessionOverrideBibleVersion = 'rv1909'; assert.equal(app.getNotebookReferenceVersion(historical), 'rv1909');
app.sessionOverrideBibleVersion = 'ntv'; assert.equal(app.getNotebookReferenceVersion(historical), 'rvr60');
app.sessionOverrideBibleVersion = 'tla'; assert.equal(app.getNotebookReferenceVersion(historical), 'rvr60');
app.sessionOverrideBibleVersion = null; app.currentBibleVersion = 'nvi';
assert.equal(app.getNotebookReferenceVersion(historical), 'rvr60', 'A global reader choice does not redefine a notebook reference');
app.sessionOverrideBibleVersion = 'nbla';
assert.equal(app.getNotebookReferenceVersion(ref('explicit', 'rvr60-strong')), 'rvr60-strong');
assert.equal(app.getNotebookReferenceVersion(ref('unsupported', 'invented')), 'nbla');
assert.equal(JSON.stringify(historical), snapshot, 'Reading old references never migrates their stored metadata');

app = makeApp(); app.currentView = 'bible-reading'; app.selectedBibleBook = 'gen'; app.selectedBibleChapter = 1;
app.currentBibleChapterData = { versionId: 'nbla' };
app.devotionalReferences.teaching = [created];
app.handleReferenceClick(created.id, 'teaching');
assert.equal(app.currentBibleVersion, 'rvr60'); assert.equal(preferences.get('current-bible-version'), 'rvr60');
assert.equal(app.destination, 'bible-reading'); assert.equal(app.scrolled, undefined, 'A chapter in another version must reload');
assert.equal(app.saved.versionAtSave, 'rvr60'); assert.equal(app.saved.options.versionId, 'rvr60');
assert.equal(app.targetVerseStart, 1); assert.equal(app.targetVerseEnd, 2); assert.equal(app.selectionCleared, true);
assert.equal(app.sessionOverrideBibleVersion, 'nbla', 'Navigating a new citation does not relabel its historical session');
app.currentBibleChapterData = { versionId: 'rvr60' }; app.destination = null;
app.handleReferenceClick(created.id, 'teaching'); assert.equal(app.scrolled, true); assert.equal(app.destination, null);
app.currentView = 'reading'; app.currentVersion = 'rvr60';
assert.equal(app.isChapterLoaded('gen', 1, 'rvr60'), false, 'A daily passage is not the versioned Bible chapter shell');
app = makeApp(); app.currentView = 'home'; app.devotionalReferences.teaching = [historical];
app.handleReferenceClick(historical.id, 'teaching'); assert.equal(app.saved.options.versionId, 'nbla');
assert.equal(JSON.stringify(historical), snapshot);

// Two previews of the same version resolve in reverse order: only the newest owns the panel.
app = makeApp(); const first = ref('first', 'rvr60'), second = ref('second', 'rvr60');
app.devotionalReferences.teaching = [first, second];
const firstPreview = app.showReferencePreview(first.id, 'teaching', chip());
const secondPreview = app.showReferencePreview(second.id, 'teaching', chip());
assert.equal(requests[0].version, 'rvr60'); assert.equal(requests[1].version, 'rvr60');
finish(requests[1], 'SEGUNDO'); await secondPreview;
finish(requests[0], 'PRIMERO'); await firstPreview;
assert(body().includes('SEGUNDO') && !body().includes('PRIMERO'));
assert(popover.querySelector('.ref-preview-title').textContent.includes('second (RVR1960)'));
assert.equal(app.actionRef[1], 'second');
const oldError = app.showReferencePreview(first.id, 'teaching', chip());
const newer = app.showReferencePreview(second.id, 'teaching', chip());
finish(requests[3], 'VIGENTE'); await newer; requests[2].reject(new Error('old failure')); await oldError;
assert(body().includes('VIGENTE') && !body().includes('Error'));

// Closing, replacing the DOM, changing sessions and deleting references invalidate both success and failure.
for (const change of ['close', 'disconnect', 'chip', 'session', 'delete', 'version']) {
    for (const failure of [false, true]) {
        app = makeApp(); const item = ref('pending'); app.devotionalReferences.teaching = [item]; const anchor = chip();
        const pending = app.showReferencePreview(item.id, 'teaching', anchor);
        const loading = body();
        if (change === 'close') app.closeReferencePreview();
        if (change === 'disconnect') popover.isConnected = false;
        if (change === 'chip') anchor.isConnected = false;
        if (change === 'session') app.currentMeditationSessionId = 'session-b';
        if (change === 'delete') app.devotionalReferences.teaching = [];
        if (change === 'version') app.sessionOverrideBibleVersion = 'nvi';
        if (failure) requests[0].reject(new Error('late failure')); else finish(requests[0], 'OBSOLETO');
        await pending; assert.equal(body(), loading, `${change} rejects stale ${failure ? 'error' : 'success'}`);
        assert.equal(app.actionRef, undefined);
        if (change === 'close') assert.equal(focused, 1);
    }
}
app = makeApp(); app.devotionalReferences.teaching = [first];
let pending = app.showReferencePreview(first.id, 'teaching', chip());
finish(requests[0], 'Wrong source', 'nbla'); await pending;
assert(body().includes('Error') && !body().includes('Wrong source'));
pending = app.showReferencePreview(first.id, 'teaching', chip());
requests[1].reject(new Error('current failure')); await pending; assert(body().includes('Error'));

// Pinned previews use a per-container request identity; an old call cannot replace a newer one.
app = makeApp(); app.devotionalReferences.teaching = [first, second];
let slot = { isConnected: true, innerHTML: 'loading' };
const pin1 = app.loadPinnedReferenceText('teaching', first, slot);
const pin2 = app.loadPinnedReferenceText('teaching', second, slot);
finish(requests[1], 'ANCLADO'); await pin2; requests[0].reject(new Error('old failure')); await pin1;
assert(slot.innerHTML.includes('ANCLADO') && !slot.innerHTML.includes('Error'));
for (const change of ['disconnect', 'session', 'delete', 'version']) {
    for (const failure of [false, true]) {
        app = makeApp(); const item = ref('pinned'); app.devotionalReferences.teaching = [item];
        slot = { isConnected: true, innerHTML: 'loading' };
        const operation = app.loadPinnedReferenceText('teaching', item, slot);
        assert.equal(requests[0].version, 'nbla', 'Old pinned references retain the supported historical translation');
        if (change === 'disconnect') slot.isConnected = false;
        if (change === 'session') app.currentMeditationSessionId = 'session-b';
        if (change === 'delete') app.devotionalReferences.teaching = [];
        if (change === 'version') app.sessionOverrideBibleVersion = 'nvi';
        if (failure) requests[0].reject(new Error('late failure')); else finish(requests[0], 'OBSOLETO');
        await operation; assert.equal(slot.innerHTML, 'loading', `${change} invalidates pinned ${failure ? 'error' : 'success'}`);
    }
}
app = makeApp(); app.devotionalReferences.teaching = [created]; slot = { isConnected: true, innerHTML: '' };
pending = app.loadPinnedReferenceText('teaching', created, slot);
assert.equal(requests[0].version, 'rvr60'); finish(requests[0], 'NUEVA'); await pending; assert(slot.innerHTML.includes('NUEVA'));
console.log('OK: new notebook links use RVR1960; historical versions and metadata survive; navigation reloads the right version; preview and pinned success/error races, close, sessions, deletion and disconnected DOM are guarded');

// New daily sessions describe the translation actually read, not the independent Bible-reader preference.
const storedSessions = new Map();
let nextSession = 0;
context.crypto = { randomUUID: () => `session-${++nextSession}` };
context.MeditationSessionStorage = { get: id => storedSessions.get(id),
    getAllMetadata: () => [...storedSessions.values()], save: session => storedSessions.set(session.id, session) };
context.MeditationSessionUIStateStorage = { load: () => ({}), save() {} };
const sessionMethods = Object.fromEntries([...sessionDefinitions].map(([name, definition]) => [name, vm.runInContext(`(${definition})`, context)]));
assert.equal(sessionDefinitions.size, 4);
for (const dailyVersion of ['rvr60', 'ntv', 'tla']) {
    storedSessions.clear(); app = makeApp();
    Object.assign(app, sessionMethods, { currentVersion: dailyVersion,
        attachMeditationMetadataSync: session => { session.metadata = { translation: session.bibleVersion }; },
        invalidateMeditationLibraryCache() {}, resolveMeditationMetadata: async () => ({}) });
    app.toggleNote('2026-11-17', { date: '2026-11-17', versions: { rvr60: 'RVR1960', ntv: 'NTV', tla: 'TLA' } });
    const session = storedSessions.get(app.currentMeditationSessionId);
    assert.equal(session.bibleVersion, dailyVersion);
    assert.equal(session.metadata.translation, dailyVersion);
    assert.equal(app.sessionOverrideBibleVersion, dailyVersion);
    assert.equal(app.currentBibleVersion, 'nbla', 'Creating a daily meditation does not relabel the independent Bible reader');
    assert.equal(app.getNotebookReferenceVersion(ref('old')), 'rvr60', 'Daily-only editions resolve notebook Bible links to the available RVR1960 provider');
    app.toggleNote('2026-11-17'); assert.equal(app.sessionOverrideBibleVersion, null);
}
storedSessions.clear();
const previousSession = { id: 'historical-session', readingId: '2026-10-01', bibleVersion: 'nbla',
    notes: { dios: 'Contenido sintético' }, references: { teaching: [historical] } };
storedSessions.set(previousSession.id, previousSession);
app = makeApp(); Object.assign(app, sessionMethods, { resolveMeditationMetadata: async () => ({}) });
const beforeSession = JSON.stringify(previousSession);
app.currentBibleVersion = 'nbla'; app.openMeditationSession(previousSession.id);
assert.equal(app.sessionOverrideBibleVersion, 'nbla', 'An equal global version still establishes a historical session override');
app.currentBibleVersion = 'rvr60'; assert.equal(app.getNotebookReferenceVersion(historical), 'nbla');
assert.equal(JSON.stringify(previousSession), beforeSession, 'Opening an old meditation preserves its translation, notes and references');

const resolverNode = tree.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'getBibleReaderVersionId');
const resolveReaderVersion = vm.runInContext(`(${source.slice(resolverNode.start, resolverNode.end)})`, context);
context.window = { App: app };
assert.equal(resolveReaderVersion(), 'nbla');
for (const unsupported of ['ntv', 'tla', 'invented']) {
    app.sessionOverrideBibleVersion = unsupported; assert.equal(resolveReaderVersion(), 'rvr60');
}

// Exercise the real rendering helper, rather than assuming it retains provider metadata for previews.
const provider = new LocalRvr1960Provider({ fetchImpl: async file => ({ ok: true,
    json: async () => JSON.parse(readFileSync(new URL('../' + file, import.meta.url), 'utf8')) }) });
const renderContext = vm.createContext({ escapeBibleHtml, renderBibleReadingDocument, RVR1960_VERSION_ID: 'rvr60',
    RV1909_VERSION_ID: 'rv1909', bibleRepository: { getChapter: (version, book, chapter) => {
        assert.equal(version, 'rvr60'); return provider.getChapter(book, chapter);
    } }, BIBLE_FOOTNOTE_SUPERSCRIPTS: Object.fromEntries([...'0123456789'].map((digit, i) => [digit, [...'⁰¹²³⁴⁵⁶⁷⁸⁹'][i]])) });
for (const node of tree.body.filter(item => item.type === 'FunctionDeclaration')) vm.runInContext(source.slice(node.start, node.end), renderContext);
const renderedChapter = await vm.runInContext('getBibleChapter', renderContext)('gen', 1, 'rvr60');
assert.equal(renderedChapter.versionId, 'rvr60'); assert.equal(renderedChapter.bookId, 'gen');
assert(renderedChapter.content.includes('En el principio')); assert.equal(renderedChapter.verses.length, 31);
console.log('OK: daily meditation metadata uses RVR1960/NTV/TLA actually selected; equal-version historical sessions keep their override; unavailable editions resolve honestly; real chapter rendering preserves versionId');


// Real catalog regression: April 7 has no TLA. The selected preference must not relabel displayed RVR1960.
const april = JSON.parse(readFileSync(new URL('../data/readings/2026-04.json', import.meta.url), 'utf8'))
    .find(reading => reading.date === '2026-04-07');
assert(april.versions.rvr60 && april.versions.ntv && !april.versions.tla);
function dailyApp() {
    storedSessions.clear();
    const value = makeApp();
    Object.assign(value, sessionMethods, { currentVersion: 'tla', currentView: 'home',
        getTodayDateStr: () => april.date, getHomeViewingDate: () => april.date,
        attachMeditationMetadataSync: session => { session.metadata = { translation: session.bibleVersion }; },
        invalidateMeditationLibraryCache() {}, resolveMeditationMetadata: async () => ({}),
        getReadingByDate: async () => april, stopIntroVideo() {}, trackAnalyticsOnce() {}, trackAnalyticsEvent() {},
        getReadingAnalyticsParams: () => ({}), showToast(message) { this.toast = message; },
        openDeepeningShell(reading) { this.shellReading = reading; },
        getBibleSelectionReferenceLabel: () => 'Génesis 1:1', stopBibleChapterVoice() {},
        openMeditationLibraryEditor: async id => { value.editorSession = id; }
    });
    return value;
}
app = dailyApp();
assert.equal(app.getDailyReadingVersionId(april), 'rvr60');
app.toggleNote(april.date, april);
let stored = storedSessions.get(app.currentMeditationSessionId);
assert.equal(stored.bibleVersion, 'rvr60'); assert.equal(stored.metadata.translation, 'rvr60');
assert.equal(app.getDailyReadingVersionId({ versions: { ntv: 'Sólo NTV' } }, 'tla'), 'ntv');
assert.equal(app.getDailyReadingVersionId({ text: 'Texto heredado RVR1960' }, 'ntv'), 'rvr60');
assert.equal(app.getDailyReadingVersionId(null), null);

app = dailyApp(); app.currentSelectedText = 'Texto seleccionado sintético'; app.currentSelectionDate = april.date;
await app.meditateOnSelectedPassage(); stored = storedSessions.get(app.editorSession);
assert.equal(stored.bibleVersion, 'rvr60'); assert.equal(stored.metadata.translation, 'rvr60');
assert(stored.notes.aprendizaje.includes('(RVR1960)') && !stored.notes.aprendizaje.includes('(TLA)'));
app = dailyApp(); app.currentSelectedText = 'Texto RV1909 sintético'; app.currentSelectionDate = 'bible-gen-1';
await app.meditateOnSelectedPassage(); stored = storedSessions.get(app.editorSession);
assert.equal(stored.bibleVersion, 'rvr60', 'The new daily meditation describes its daily reading');
assert(stored.notes.aprendizaje.includes('(RV1909)') && !stored.notes.aprendizaje.includes('(RVR1960)'),
    'An explicitly selected RV1909 quotation retains its own attribution inside the new meditation');

const clickStart = source.indexOf('// Notas\n    const noteBtn =');
const clickEnd = source.indexOf('const completeSessionBtn =', clickStart);
assert(clickStart > 0 && clickEnd > clickStart);
const clickNote = vm.runInContext(`(async function(e) { ${source.slice(clickStart, clickEnd)} })`, context);
function noteEvent() {
    const button = { isConnected: true, getAttribute: () => april.date, closest: () => ({}) };
    return { button, event: { target: { closest: () => button } } };
}
app = dailyApp(); context.window = { location: { hash: '#home' } };
let click = noteEvent(); await clickNote.call(app, click.event);
stored = storedSessions.get(app.currentMeditationSessionId);
assert.equal(stored.bibleVersion, 'rvr60'); assert.equal(app.shellReading, april);
for (const change of ['route', 'date', 'disconnected', 'missing']) {
    app = dailyApp(); context.window = { location: { hash: '#home' } }; click = noteEvent();
    let resolveReading; app.getReadingByDate = () => new Promise(resolve => { resolveReading = resolve; });
    const opening = clickNote.call(app, click.event);
    if (change === 'route') context.window.location.hash = '#calendar';
    if (change === 'date') app.getHomeViewingDate = () => '2026-04-08';
    if (change === 'disconnected') click.button.isConnected = false;
    resolveReading(change === 'missing' ? null : april); await opening;
    assert.equal(storedSessions.size, 0, `${change} cannot create a late or incorrectly attributed meditation`);
    assert.equal(app.shellReading, undefined);
}
app = dailyApp(); context.window = { location: { hash: '#home' } }; click = noteEvent();
let finishMetadata, metadataCalls = 0;
app.resolveMeditationMetadata = () => ++metadataCalls === 1 ? Promise.resolve({})
    : new Promise(resolve => { finishMetadata = resolve; });
const lateShell = clickNote.call(app, click.event);
await new Promise(resolve => setImmediate(resolve));
assert.equal(typeof finishMetadata, 'function');
context.window.location.hash = '#calendar'; finishMetadata({}); await lateShell;
assert.equal(app.shellReading, undefined, 'Metadata finishing late cannot reopen a meditation over a newer route');
console.log('OK: real April 7 lacks TLA; new sessions and daily quotations use displayed RVR1960, explicit RV1909 quotations stay RV1909, and async opening rejects changed routes/dates/disconnected buttons/missing readings');
