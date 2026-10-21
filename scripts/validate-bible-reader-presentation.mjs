import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { renderBibleReadingDocument, positionBibleStudyPanel } from '../js/bible/BibleReaderPresentation.js';
import { escapeBibleHtml } from '../js/utils/text.js';
import { readingIcon } from '../js/utils/readingIcons.js';
import { LocalRv1909Provider } from '../js/bible/LocalRv1909Provider.js';
import { normalizeBibleVoiceText, getBibleVoicePoint, getBibleCaretPoint } from '../js/bible/BibleReaderSelection.js';
import { createBibleReadingKey } from '../js/bible/bibleInternalTest.js';

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const readerCSS = readFileSync(new URL('../css/bible-reader.css', import.meta.url), 'utf8');
const verseCSS = /body \.bible-reader-view \.bible-reader-content \.verse-item\s*\{([^}]+)\}/.exec(readerCSS)?.[1];
assert(verseCSS?.includes('transition: color .15s ease, background-color .15s ease, box-shadow .15s ease;'),
    'Typography and line height must not animate after the scroll anchor is restored');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, predicate) {
    if (predicate(node)) return node;
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
        if (child?.type) { const match = find(child, predicate); if (match) return match; }
    }
}
const bible = JSON.parse(readFileSync(new URL('../data/rv1909.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const local = new LocalRv1909Provider({ fetchImpl: async () => ({ ok: true, json: async () => bible }) });
let chapter;
const context = vm.createContext({ escapeBibleHtml, readingIcon, renderBibleReadingDocument, console,
    RV1909_VERSION_ID: 'rv1909',
    normalizeBibleVoiceText, getBibleCaretPoint, getBibleVoicePoint, createBibleReadingKey,
    bibleRepository: { getChapter: async () => chapter },
    BIBLE_FOOTNOTE_SUPERSCRIPTS: Object.fromEntries([...'0123456789'].map((d, i) => [d, [...'⁰¹²³⁴⁵⁶⁷⁸⁹'][i]])) });
for (const node of tree.body.filter(n => n.type === 'FunctionDeclaration')) {
    vm.runInContext(source.slice(node.start, node.end), context);
}
const renderChapter = vm.runInContext('getBibleChapter', context);
let totalVerses = 0;
const booksNode = find(tree, n => n.type === 'Property' && n.key.name === 'bibleBooks');
const books = vm.runInContext(`(${source.slice(booksNode.value.start, booksNode.value.end)})`, context);
for (const book of books) {
    for (let number = 1; number <= book.chapters; number++) {
        chapter = await local.getChapter(book.id, number);
        const rendered = await renderChapter(book.id, number, 'rv1909');
        assert.equal((rendered.content.match(/class="verse-item verse-selectable"/g) || []).length, chapter.verses.length);
        assert.equal((rendered.content.match(/<p class="bible-reading-paragraph">/g) || []).length, 1, 'No fabricated paragraph boundaries');
        for (const verse of chapter.verses) {
            assert(rendered.content.includes(`<span class="verse-text">${escapeBibleHtml(verse.text)}</span>`));
            assert(rendered.content.includes(`aria-label="Seleccionar versículo ${verse.number}"`));
        }
        assert.equal(rendered.content.includes('bible-reading-verse-lines'), ['psa', 'pro', 'sng', 'lam'].includes(book.id));
        totalVerses += chapter.verses.length;
    }
}
assert(totalVerses > 30000);
chapter = { bookId: 'jhn', verses: [{ number: 1, text: '<unsafe> Texto', footnotes: ['Una nota <img src=x>'] }, { number: 2, text: 'Otro texto', crossReferences: ['Juan 1:1'] }] };
let rendered = await renderChapter('jhn', 1, 'nvi', { sectionHeadingsByVerse: { 2: [{ title: '<Seccion>', marker: 's1' }] } });
assert.equal((rendered.content.match(/<p class="bible-reading-paragraph">/g) || []).length, 2);
assert(rendered.content.includes('&lt;Seccion&gt;')); assert(!rendered.content.includes('<unsafe>'));
assert(rendered.content.includes('aria-label="Nota al pie 1"')); assert(rendered.content.includes('aria-label="Nota al pie 2"'));
assert(rendered.content.includes('data-refs=')); assert(!rendered.content.includes('<img'));
console.log(`OK: ${totalVerses} verses preserve exact text/identities, poetry lines, source headings, safe notes and accessible numbering`);

function method(name) {
    const node = find(tree, n => n.type === 'Property' && n.key.name === name);
    assert(node, name);
    const code = source.slice(node.value.start, node.value.end);
    return vm.runInContext(`(${node.method ? `${node.value.async ? 'async ' : ''}function${code}` : code})`, context);
}

const voiceVerses = method('getBibleChapterVoiceVerses');
const footnoteToken = `[[REF:f:${encodeURIComponent('Nota editorial: consultar Juan 1:1.')}]]`;
const crossReferenceToken = `[[REF:c:${encodeURIComponent('Génesis 1:1; Hebreos 11:3.')}]]`;
const annotatedChapter = Object.freeze({ verses: Object.freeze([
    Object.freeze({ number: 1, text: footnoteToken }),
    Object.freeze({ number: 2, text: `Palabra${footnoteToken}viva ${crossReferenceToken}, y verdadera.`,
        subtitle: 'No pronunciar encabezado', footnotes: Object.freeze(['No pronunciar nota']),
        crossReferences: Object.freeze(['No pronunciar referencia']) }),
    Object.freeze({ number: 3, text: `Mismo texto; ${footnoteToken}${crossReferenceToken} mismo texto. (Juan 3:16) 12 piedras [señal].` })
]) });
const originalChapter = JSON.stringify(annotatedChapter);
const cleanedVoice = voiceVerses(annotatedChapter, 'Génesis', 1);
assert.equal(cleanedVoice.length, 2);
assert.equal(cleanedVoice[0].number, 2); assert.equal(cleanedVoice[0].text, 'Palabra viva, y verdadera.');
assert.equal(cleanedVoice[0].spokenText, 'Génesis capítulo 1. Palabra viva, y verdadera.');
assert.equal(cleanedVoice[1].spokenText, 'Mismo texto; mismo texto. (Juan 3:16) 12 piedras [señal].');
assert.equal(JSON.stringify(annotatedChapter), originalChapter, 'Speech cleanup must not alter Bible data or study aids');
assert.equal(voiceVerses({ verses: [{ number: 1, text: crossReferenceToken }] }, 'Génesis', 1).length, 0);
assert.equal(voiceVerses(null, 'Génesis', 1).length, 0);
chapter = annotatedChapter;
const annotatedRendering = await renderChapter('gen', 1, 'nbla');
assert(annotatedRendering.content.includes('data-refs='));
assert(annotatedRendering.content.includes(encodeURIComponent('Nota editorial: consultar Juan 1:1.')));
assert.equal(annotatedRendering.verses, annotatedChapter.verses);
console.log('OK: speech omits inline notes/references without removing literal Bible text, numbers, brackets or visible study aids');

let fail = false, stored = { textSize: 'large', spacing: 'compact', focusMode: true }, applied = 0;
const app = { storage: { get: () => stored, set: (key, value) => { if (fail) return false; stored = structuredClone(value); return true; } },
    captureBibleReaderScrollAnchor: () => ({ verseNumber: 9 }), restoreBibleReaderScrollAnchor: anchor => assert.equal(anchor.verseNumber, 9),
    applyBibleReadingSettingsToDOM: () => applied++, mountBibleReadingSettingsPanel() {}, updateBibleReaderContextBarUI() {}, showToast() {} };
for (const name of ['loadBibleReadingSettings', 'saveBibleReadingSettings', 'getBibleReaderClassNames', 'setBibleReadingSetting']) app[name] = method(name);
app.loadBibleReadingSettings(); assert.equal(app.bibleReadingSettings.layout, 'flow');
assert(app.setBibleReadingSetting('layout', 'verses')); assert.equal(stored.layout, 'verses');
app.loadBibleReadingSettings(); assert.equal(app.bibleReadingSettings.layout, 'verses');
assert.equal(app.bibleReadingSettings.textSize, 'large'); assert(app.getBibleReaderClassNames().includes('bible-reader-layout-verses'));
fail = true; assert.equal(app.setBibleReadingSetting('layout', 'flow'), false); assert.equal(app.bibleReadingSettings.layout, 'verses');
assert.equal(applied, 1); assert.equal(app.setBibleReadingSetting('layout', '<unsafe>'), undefined);

let locationState = null, legacyState = null, locationQuota = false;
context.sessionStorage = { getItem: () => legacyState, removeItem: () => { legacyState = null; } };
const continuity = { currentView: 'bible-reading', selectedBibleBook: 'gen', selectedBibleChapter: 1,
    currentBibleVersion: 'rv1909', bibleBooks: books,
    getBibleReaderVersions: () => ['rv1909', 'nbla', 'nvi', 'biblia-libre'].map(id => ({ id })),
    storage: { get: () => locationState, set: (key, value) => {
        if (locationQuota) return false; locationState = structuredClone(value); return true;
    } },
    $content: { querySelector: () => ({ offsetTop: 200 }) } };
for (const name of ['getBibleReadingStateKey', 'getLegacyBibleLastLocationKey', 'normalizeBibleReadingState',
    'getBibleLastLocation', 'saveBibleLastLocation', 'saveBibleReadingScrollPosition']) continuity[name] = method(name);
const visibleChapter = { book: { id: 'gen' }, chapter: 2, element: { getBoundingClientRect: () => ({ top: -500 }) } };
continuity.continuousReader = { anchor: () => ({ entry: visibleChapter, verse: { dataset: { verseNumber: '12' } }, top: 180 }),
    activeEntry: () => { assert.fail('The anchor entry, not a stale header or a second layout read, identifies the chapter'); } };
assert(continuity.saveBibleReadingScrollPosition());
assert.equal(locationState.chapter, 2); assert.equal(locationState.verseNumber, 12);
assert.equal(locationState.verseOffset, 180); assert.equal(locationState.scrollY, 700);
assert(continuity.saveBibleLastLocation('gen', 2)); assert.equal(locationState.verseNumber, 12);
assert.equal(locationState.verseOffset, 180, 'Reopening the same chapter preserves the exact anchor');
const validLocation = JSON.stringify(locationState);
locationQuota = true; assert.equal(continuity.saveBibleLastLocation('gen', 3), false);
assert.equal(JSON.stringify(locationState), validLocation, 'A failed location write preserves the prior location');
legacyState = validLocation; locationState = null;
assert.equal(continuity.getBibleLastLocation().chapter, 2); assert(legacyState, 'Failed migration retains the legacy position');
locationQuota = false; assert.equal(continuity.getBibleLastLocation().chapter, 2); assert.equal(legacyState, null);
const corruptLocation = continuity.normalizeBibleReadingState({ ...locationState, scrollY: Infinity, verseOffset: NaN, verseNumber: 12.8 });
assert.equal(corruptLocation.scrollY, 0); assert.equal(corruptLocation.verseOffset, 0); assert.equal(corruptLocation.verseNumber, 12);
assert.equal(continuity.normalizeBibleReadingState({ ...locationState, chapter: 51 }), null);

const frames = [], restoreTimers = [], scrolls = [], releasedClasses = [];
let restorationSaves = 0;
context.requestAnimationFrame = callback => frames.push(callback);
context.cancelAnimationFrame = () => {};
context.setTimeout = callback => restoreTimers.push(callback);
context.window = { scrollY: 1000, scrollTo: options => scrolls.push(options.top) };
context.document = { documentElement: { classList: { remove: name => releasedClasses.push(name) } },
    body: { classList: { remove: name => releasedClasses.push(name) } } };
const restoring = { currentView: 'bible-reading', selectedBibleBook: 'gen', selectedBibleChapter: 2,
    currentBibleVersion: 'rv1909', _bibleReaderEpoch: 1, bibleNoSmoothRestoreFromCalendar: true,
    getBibleLastLocation: () => locationState,
    $content: { querySelector: () => ({ getBoundingClientRect: () => ({ top: 220 }) }) },
    saveBibleReadingScrollPosition: () => restorationSaves++ };
restoring.restore = method('restoreBibleReadingScrollPosition');
restoring.restore(); frames.shift()(); frames.shift()(); restoreTimers.shift()();
assert.deepEqual(scrolls, [1040, 1040]); assert.equal(restorationSaves, 1);
assert.equal(restoring.bibleSuppressScrollSave, false); assert.equal(releasedClasses.length, 2);
restoring.restore(); restoring.currentView = 'home'; frames.shift()();
assert.equal(scrolls.length, 2, 'A stale restore cannot move a different screen');
assert.equal(restoring.bibleSuppressScrollSave, false); assert.equal(restorationSaves, 1);
restoring.currentView = 'bible-reading'; restoring.restore(); frames.shift()();
restoring._bibleReaderEpoch++; frames.shift()();
assert.equal(scrolls.length, 3, 'An obsolete second frame cannot overwrite a newer chapter');
restoring.restore(); frames.shift()(); frames.shift()();
restoring._bibleReaderEpoch++; restoring.restore();
restoreTimers.shift()(); assert(restoring.bibleSuppressScrollSave, 'An old timer cannot unlock a newer restore');
frames.shift()(); frames.shift()(); restoreTimers.shift()();
assert.equal(restorationSaves, 2); assert.equal(restoring.bibleSuppressScrollSave, false);
restoring.restore(); restoring._bibleScrollRestoreCancel(); frames.shift()();
assert.equal(restorationSaves, 2);
for (const name of ['handleRoute', 'renderBibleReading', 'switchBibleReaderVersion']) {
    assert(method(name).toString().includes('this._bibleScrollRestoreCancel?.()'), `${name}: cancel pending scroll restoration`);
}
const anchorVerse = { getAttribute: () => '12', getBoundingClientRect: () => ({ top: 180, bottom: 220 }) };
const anchorEntry = { book: { id: 'gen' }, chapter: 2, element: { querySelectorAll: () => [anchorVerse] } };
let currentTop = 900, anchorSelector;
const layoutAnchor = { currentView: 'bible-reading', currentBibleVersion: 'nbla', _bibleReaderEpoch: 1,
    selectedBibleBook: 'gen', selectedBibleChapter: 1, continuousReader: { activeEntry: () => anchorEntry },
    $content: { querySelector: selector => {
        if (selector === '.bible-reader-fixed-header') return { getBoundingClientRect: () => ({ bottom: 165 }) };
        anchorSelector = selector;
        return { getBoundingClientRect: () => ({ top: currentTop }) };
    } } };
const stableAnchor = method('captureBibleReaderScrollAnchor').call(layoutAnchor);
assert.equal(stableAnchor.chapter, 2); assert.equal(stableAnchor.bookId, 'gen');
context.window.scrollBy = options => { scrolls.push(options.top); currentTop -= options.top; };
layoutAnchor.restore = method('restoreBibleReaderScrollAnchor');
layoutAnchor.restore(stableAnchor);
assert.equal(currentTop, 180, 'Reflow restores synchronously before the chapter observer sees displaced content');
assert(anchorSelector.includes('bible-nbla-gen-2'), 'Anchor identity, not a delayed header, determines the target');
layoutAnchor.selectedBibleChapter = 3; frames.shift()(); assert.equal(currentTop, 180);
layoutAnchor.restore(stableAnchor); const oldFrame = frames.shift();
layoutAnchor.restore({ ...stableAnchor, top: 200 });
currentTop = 700; oldFrame(); assert.equal(currentTop, 700, 'A superseded typography frame cannot move the page');
layoutAnchor.currentView = 'home'; frames.shift()(); assert.equal(currentTop, 700);
layoutAnchor.currentView = 'bible-reading'; layoutAnchor.restore(stableAnchor);
currentTop = 700; layoutAnchor._bibleReaderEpoch++; frames.shift()(); assert.equal(currentTop, 700);
let fontsLoaded;
context.document.fonts = { ready: new Promise(resolve => { fontsLoaded = resolve; }) };
layoutAnchor.restore(stableAnchor); frames.shift()();
currentTop = 400; fontsLoaded(); await Promise.resolve();
frames.shift()();
assert.equal(currentTop, 180, 'A font swap after first paint preserves the same verse and viewport offset');
context.document.fonts.ready = new Promise(resolve => { fontsLoaded = resolve; });
let scrollIntent;
context.window.addEventListener = (type, listener) => { if (type === 'wheel') scrollIntent = listener; };
context.window.removeEventListener = () => {};
layoutAnchor.restore(stableAnchor); frames.shift()();
scrollIntent({ type: 'wheel' }); currentTop = 50; fontsLoaded(); await Promise.resolve();
assert.equal(currentTop, 50, 'A late font load must not undo the reader\'s subsequent scroll');
delete context.document; delete context.window; delete context.requestAnimationFrame; delete context.setTimeout;
console.log('OK: visible chapter/verse persistence, quota-safe legacy migration, finite anchors and cancellable restoration across navigation/version races');

const legacyNode = find(tree, n => n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.property.name === 'toggleReferenceBubble');
const legacy = vm.runInContext(`(${source.slice(legacyNode.right.start, legacyNode.right.end)})`, context);
let opened;
legacy.call({ mountBibleFootnotePopover: (...args) => opened = args }, null, { textContent: '2', getAttribute: () => encodeURIComponent(JSON.stringify({ f: ['<script>literal</script>', 'Segunda linea'], c: ['Juan 1:1'] })) });
assert.equal(opened[1], 2); assert.equal(opened[2], '<script>literal</script>\n\nSegunda linea\n\nJuan 1:1');
assert(source.includes('bible-footnote-popover-text">${this.escapeHtml(text)}'));
console.log('OK: preference migration/persistence/quota rollback, verse anchors and shared escaped legacy notes');

for (const name of ['renderBibleReading', 'switchBibleReaderVersion', 'mountContinuousBibleReader', 'hydrateBibleChapterFootnotes']) {
    assert(!method(name).toString().includes('renderBibleChapterVoiceControl'), `${name}: one audio toolbar, including version switches`);
}
context.navigator = {};
context.window = { getSelection: () => null };
context.clearTimeout = () => {};
let selections = 0;
const surface = { closest: () => ({ getAttribute: () => 'bible-gen-1' }) };
const verse = { classList: { add() {} }, closest: () => surface, getAttribute: () => 'Exact verse text' };
const select = method('handleVerseClick');
const selectionApp = { currentView: 'bible-reading', closeBibleCrossReferencePopover() {}, clearVerseSelection() {}, showSelectionPanelForVerse: () => selections++ };
selectionApp.handleVerseClick = select;
const click = number => ({ type: 'click', target: { closest: selector => selector === '.verse-selectable' ? verse : selector === '.verse-number, .verse-note-icon' && number ? {} : null } });
select.call(selectionApp, click(false)); assert.equal(selections, 1);
select.call(selectionApp, click(true)); assert.equal(selections, 2); assert.equal(selectionApp.currentSelectedText, 'Exact verse text');
let capturedSelection = false;
context.window.getSelection = () => ({ toString: () => 'Native word' });
selectionApp.captureBibleVoiceSelection = () => { capturedSelection = true; };
select.call(selectionApp, click(false)); assert.equal(selections, 2); assert(capturedSelection);
context.window.getSelection = () => null;
let pendingTap;
context.setTimeout = callback => { pendingTap = callback; return 1; };
verse.isConnected = true;
select.call(selectionApp, { ...click(false), detail: 1 }); assert.equal(selections, 2);
pendingTap(); assert.equal(selections, 3, 'A single text tap opens actions after the double-click interval');
console.log('OK: text taps and verse numbers open annotation actions without taking over native word selection');

let tailText = 'mor de Dios.', caretRangeCreated = false;
const textNode = { nodeType: 3, parentElement: { closest: () => null } };
const caretDoc = { createRange: () => ({ selectNodeContents() {}, setStart(node, offset) {
    caretRangeCreated = true; this.startContainer = node; this.startOffset = offset;
},
    cloneContents: () => ({ querySelectorAll: () => [{ remove() {} }], textContent: tailText }) }),
    caretPositionFromPoint: () => ({ offsetNode: textNode, offset: 5 }) };
const verseText = { contains: node => node === textNode, ownerDocument: caretDoc };
const pointVerse = { ownerDocument: caretDoc, querySelector: () => verseText,
    getAttribute: name => name === 'data-verse-number' ? '12' : 'Todo muestra el amor de Dios.',
    closest: () => ({ getAttribute: () => 'bible-gen-2' }) };
const point = getBibleCaretPoint({ clientX: 50, clientY: 200 }, pointVerse);
assert(caretRangeCreated); assert.equal(point.verseNumber, 12); assert.equal(point.offset, 16); assert.equal(point.readingKey, 'bible-gen-2');
caretDoc.caretPositionFromPoint = null;
caretDoc.caretRangeFromPoint = () => ({ startContainer: textNode, startOffset: 5 });
assert.equal(getBibleCaretPoint({ clientX: 50, clientY: 200 }, pointVerse).offset, 16);
tailText = 'Texto distinto'; assert.equal(getBibleVoicePoint({ startContainer: textNode, startOffset: 5 }, pointVerse), null);
textNode.parentElement.closest = () => ({}); assert.equal(getBibleVoicePoint({ startContainer: textNode }, pointVerse), null);
textNode.parentElement.closest = () => null;
tailText = 'amor de Dios.';
caretDoc.createRange = () => { throw new DOMException('Detached range', 'InvalidStateError'); };
assert.equal(getBibleCaretPoint({ clientX: 50, clientY: 200 }, pointVerse), null);
assert.equal(getBibleVoicePoint({ startContainer: textNode, startOffset: 1000 }, pointVerse), null);
caretDoc.caretPositionFromPoint = () => { throw new DOMException('Stale caret', 'IndexSizeError'); };
assert.equal(getBibleCaretPoint({ clientX: 50, clientY: 200 }, pointVerse), null);
console.log('OK: caret starts at the complete word, supports both browser APIs and ignores reference buttons/stale ranges');

let spoken, toolbar, highlighted = false;
const audioEvents = [];
const audioAction = { getAttribute: () => 'reader-context-audio' };
function makeToolbar(html = '') {
    return { html, contains: element => element === audioAction,
        replaceWith: next => { toolbar = next; },
        querySelector: () => ({ focus: () => { audioEvents.push('focus'); } }) };
}
toolbar = makeToolbar();
context.document = { activeElement: audioAction,
    querySelectorAll: selector => selector === '.bible-voice-current' && highlighted
        ? [{ classList: { remove: () => { highlighted = false; } } }] : [],
    createRange: () => ({ createContextualFragment: html => ({ firstElementChild: makeToolbar(html) }) }) };
context.window = { getSelection: () => null, speechSynthesis: { getVoices: () => [], cancel() {}, speak: utterance => { spoken = utterance; } } };
context.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
const audio = { selectedBibleBook: 'gen', selectedBibleChapter: 1, bibleBooks: [{ id: 'gen', name: 'Genesis' }],
    currentBibleVersion: 'rv1909', captureBibleReaderScrollAnchor: () => ({ verseNumber: 1 }),
    currentBibleChapterData: { verses: [{ number: 1, text: `Primero${footnoteToken} sin notas.`, footnotes: ['No pronunciar nota'] },
        { number: 2, text: `Segundo${crossReferenceToken} sin referencias.`, crossReferences: ['No pronunciar referencia'] }] },
    bibleChapterVoice: { status: 'idle' }, $content: { querySelector: () => toolbar }, escapeHtml: escapeBibleHtml,
    continuousReader: { findVoice: () => ({ element: { querySelector: () => ({ classList: { add: () => { highlighted = true; } } }) } }) },
    isNativeTextToSpeechAvailable: () => false, stopDailyReadingVoice() {}, selectSpanishVoice: () => null,
    trackAnalyticsEvent: event => audioEvents.push(event), showToast: message => assert.fail(message) };
for (const name of ['getBibleChapterVoiceVerses', 'getBibleChapterVoiceStatus', 'renderBibleReaderContextBar',
    'updateBibleReaderContextBarUI', 'updateBibleChapterVoiceUI', 'createBibleChapterVoiceToken',
    'isBibleChapterVoiceTokenActive', 'invalidateBibleChapterVoiceToken', 'stopBibleChapterSpeechEngine',
    'speakBibleChapterVerse', 'playBibleChapterVoiceSequence', 'startBibleChapterVoice', 'pauseBibleChapterVoice',
    'resumeBibleChapterVoice', 'stopBibleChapterVoice', 'toggleBibleChapterVoice', 'toggleBibleChapterVoiceFromContext',
    'getBibleReaderAudioContext', 'startBibleReaderContextVoice']) audio[name] = method(name);
const flushVoice = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
audio.currentBibleChapterData.versionId = 'nvi';
assert.equal(audio.getBibleReaderAudioContext(), null, 'Do not read stale data during a version switch');
delete audio.currentBibleChapterData.versionId;
audio.toggleBibleChapterVoiceFromContext();
assert.equal(audio.bibleChapterVoice.status, 'playing'); assert(highlighted);
assert(toolbar.html.includes('Pausar audio del capítulo')); assert(toolbar.html.includes('reader-context-audio-stop'));
assert.equal(spoken.text, 'Genesis capítulo 1. Primero sin notas.'); assert(audioEvents.includes('focus'));
const firstUtterance = spoken;
const resumeOffset = spoken.text.indexOf('sin notas');
spoken.onboundary({ charIndex: resumeOffset });
audio.toggleBibleChapterVoiceFromContext();
assert.equal(audio.bibleChapterVoice.status, 'paused'); assert(toolbar.html.includes('Reanudar audio del capítulo'));
firstUtterance.onboundary({ charIndex: 0 }); assert.equal(audio.bibleChapterVoice.currentCharOffset, resumeOffset);
await flushVoice();
audio.toggleBibleChapterVoiceFromContext(); assert.equal(audio.bibleChapterVoice.status, 'playing');
assert.equal(spoken.text, 'sin notas.');
spoken.onend(); await flushVoice(); assert.equal(audio.bibleChapterVoice.currentVerseIndex, 1);
assert.equal(spoken.text, 'Segundo sin referencias.');
spoken.onend(); await flushVoice(); assert.equal(audio.bibleChapterVoice.status, 'idle');
assert(!highlighted); assert(toolbar.html.includes('Escuchar capítulo')); assert(audioEvents.includes('audio_complete'));
audio.toggleBibleChapterVoiceFromContext(); audio.stopBibleChapterVoice(true); await flushVoice();
assert.equal(audio.bibleChapterVoice.status, 'idle'); assert(!toolbar.html.includes('reader-context-audio-stop'));
audio.startBibleReaderContextVoice(audio.getBibleReaderAudioContext(), { verseNumber: 2, offset: 8 });
assert.equal(audio.bibleChapterVoice.currentVerseIndex, 1); assert.equal(spoken.text, 'sin referencias.');
audio.pauseBibleChapterVoice();
const visibleEntry = { book: audio.bibleBooks[0], chapter: 2, data: audio.currentBibleChapterData };
audio.continuousReader.activeEntry = () => visibleEntry;
audio.continuousReader.entries = [visibleEntry];
assert(!audio.renderBibleReaderContextBar('Genesis', 2).includes('Reanudar audio del capítulo'));
audio.toggleBibleChapterVoiceFromContext();
assert.equal(audio.bibleChapterVoice.key, 'Genesis-2', 'Visible chapter replaces audio belonging to a different chapter');
audio.stopBibleChapterVoice(true); await flushVoice();
audio.bibleSpeechPoint = { readingKey: createBibleReadingKey('rv1909', 'gen', 2), verseNumber: 2, offset: 8 };
audio.hideSelectionPanel = () => { audio.bibleSpeechPoint = null; };
audio.playBibleVoiceFromSelection = method('playBibleVoiceFromSelection');
audio.playBibleVoiceFromSelection(); assert.equal(audio.bibleChapterVoice.key, 'Genesis-2');
assert.equal(spoken.text, 'sin referencias.'); audio.stopBibleChapterVoice(true); await flushVoice();
delete audio.continuousReader.activeEntry;
audio.bibleSpeechPoint = { readingKey: createBibleReadingKey('rv1909', 'gen', 1), verseNumber: 2, offset: 8 };
assert(audio.renderBibleReaderContextBar('Genesis', 1).includes('Escuchar desde aquí'));
audio.toggleBibleChapterVoiceFromContext(); assert.equal(spoken.text, 'sin referencias.');
assert.equal(audio.bibleSpeechPoint, null); audio.stopBibleChapterVoice(true); await flushVoice();
let nativeText, finishNative, nativeBoundary, removedNativeListeners = 0;
context.window.Capacitor = { Plugins: { TextToSpeech: { speak: options => {
    nativeText = options.text;
    return new Promise(resolve => { finishNative = resolve; });
}, addListener: async (event, callback) => {
    assert.equal(event, 'onRangeStart'); nativeBoundary = callback;
    return { remove: () => { removedNativeListeners++; } };
} } } };
audio.isNativeTextToSpeechAvailable = () => true;
audio.stopNativeTextToSpeech = () => {};
audio.toggleBibleChapterVoiceFromContext();
await flushVoice();
assert.equal(nativeText, 'Genesis capítulo 1. Primero sin notas.', 'Native speech receives the same clean text as Web Speech');
nativeBoundary({ start: resumeOffset }); audio.pauseBibleChapterVoice();
assert.equal(removedNativeListeners, 1); assert.equal(audio.bibleChapterVoice.currentCharOffset, resumeOffset);
audio.resumeBibleChapterVoice(); await flushVoice(); assert.equal(nativeText, 'sin notas.');
audio.stopBibleChapterVoice(true); finishNative(); await flushVoice();
assert.equal(audio.bibleChapterVoice.status, 'idle');
assert.equal(removedNativeListeners, 2);
let resolveListener, delayedSpeakCalls = 0, delayedRemovals = 0;
context.window.Capacitor.Plugins.TextToSpeech = {
    addListener: () => new Promise(resolve => { resolveListener = resolve; }),
    speak: async () => { delayedSpeakCalls++; }
};
audio.toggleBibleChapterVoiceFromContext(); audio.stopBibleChapterVoice(true);
resolveListener({ remove: async () => { delayedRemovals++; } }); await flushVoice();
assert.equal(delayedSpeakCalls, 0, 'Stopping during listener registration must never start stale speech');
assert.equal(delayedRemovals, 1);
context.window.Capacitor.Plugins.TextToSpeech = { speak: options => {
    nativeText = options.text; return new Promise(resolve => { finishNative = resolve; });
} };
audio.toggleBibleChapterVoiceFromContext(); await flushVoice(); audio.pauseBibleChapterVoice();
assert.equal(audio.bibleChapterVoice.currentCharOffset, 0);
audio.resumeBibleChapterVoice(); await flushVoice();
assert.equal(nativeText, 'Genesis capítulo 1. Primero sin notas.', 'Without boundary events resume repeats the current verse safely');
audio.stopBibleChapterVoice(true); finishNative(); await flushVoice();
delete context.document; delete context.window; delete context.SpeechSynthesisUtterance;
console.log('OK: web/native speech receives no study markers; single audio toolbar starts/pauses/resumes/stops, advances verses and retains focus');

context.localStorage = { setItem() {} };
const previousReturn = { view: 'bible-search', label: 'Volver a la busqueda', scrollY: 120 };
const navigation = { currentView: 'bible-reading', bibleBooks: [{ id: 'gen', name: 'Genesis' }], selectedBibleBook: 'gen', selectedBibleChapter: 1,
    currentBibleVersion: 'rv1909', bibleStudyReturn: previousReturn, captureBibleReaderScrollAnchor: () => ({ verseNumber: 7, top: 220 }),
    closeBibleCrossReferencePopover() {}, navigateToVerse(book, chapter) { this.selectedBibleBook = book; this.selectedBibleChapter = chapter; },
    navigate(view) { this.currentView = view; } };
method('navigateToBibleCrossReference').call(navigation, { getAttribute: key => ({ 'data-book-id': 'jhn', 'data-chapter': '1', 'data-verse': '3' })[key] });
assert.equal(navigation.selectedBibleBook, 'jhn'); assert.equal(navigation.bibleStudyReturn.bookId, 'gen');
method('returnToBibleStudy').call(navigation);
assert.equal(navigation.selectedBibleBook, 'gen'); assert.equal(navigation.selectedBibleChapter, 1);
assert.equal(navigation.currentBibleVersion, 'rv1909'); assert.equal(navigation.targetVerse, 7);
assert.equal(navigation.bibleStudyRestoreAnchor.top, 220); assert.equal(navigation.bibleStudyReturn, previousReturn);
console.log('OK: full reference navigation returns to the original book, version and verse anchor without losing a search return');

let annotationRendered = false;
const annotationRefresh = { currentView: 'bible-reading',
    getBibleReaderAudioContext: () => ({ book: { id: 'gen' }, chapter: 2 }),
    captureBibleReaderScrollAnchor: () => ({ verseNumber: 12, top: 230 }),
    async renderBibleReading() {
        assert.equal(this.selectedBibleBook, 'gen'); assert.equal(this.selectedBibleChapter, 2);
        assert.equal(this.bibleStudyRestoreAnchor.verseNumber, 12); annotationRendered = true;
    } };
await method('rerenderCurrentReadingView').call(annotationRefresh, 'bible-gen-2', true);
assert(annotationRendered);
console.log('OK: annotation refresh keeps the visible chapter and verse anchor');

let width = 393;
const classes = new Set();
const panel = { isConnected: true, style: { setProperty() {} }, classList: { add: name => classes.add(name), remove() {}, toggle: (name, on) => on ? classes.add(name) : classes.delete(name) }, getBoundingClientRect: () => ({ height: 300 }) };
globalThis.window = { get innerWidth() { return width; }, innerHeight: 852 };
globalThis.document = { querySelector: selector => ({ getBoundingClientRect: () => selector.includes('header') ? { right: 740, top: 56 } : { top: 760 } }) };
assert(positionBibleStudyPanel({ isConnected: true }, panel)); assert.equal(panel.style.width, '369px'); assert(!classes.has('is-docked'));
assert(parseFloat(panel.style.top) >= 0); assert(parseFloat(panel.style.left) >= 0);
width = 1440; assert(positionBibleStudyPanel({ isConnected: true }, panel)); assert(classes.has('is-docked')); assert.equal(panel.style.width, '296px');
assert.equal(positionBibleStudyPanel({ isConnected: false }, panel), false);
delete globalThis.window; delete globalThis.document;
console.log('OK: mobile bottom panel, desktop dock, disconnected anchors and viewport containment');
