import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

function find(node, predicate) {
    if (predicate(node)) return node;
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
        if (child?.type) { const result = find(child, predicate); if (result) return result; }
    }
}
function declaration(file, name) {
    const source = readFileSync(file, 'utf8');
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const node = find(tree, n => n.type === 'FunctionDeclaration' && n.id?.name === name);
    assert(node, name);
    return source.slice(node.start, node.end);
}
const source = readFileSync('js/app.js', 'utf8');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const appNode = find(tree, n => n.type === 'VariableDeclarator' && n.id?.name === 'App').init;
const stored = new Map();
const session = { id: 'synthetic-session', readingId: '2026-10-23', status: 'draft', notes: { dios: 'Synthetic private draft' } };
let closeAllowed = true, mounted, route, restored, reads = 0;
const context = vm.createContext({
    window: { location: { hash: '#reading/2026-10-23' }, sessionStorage: {
        getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key)
    }, DeepeningShell: { getState: () => ({ meditation: { activeStepId: 'teaching', scrollTop: 121, caret: { stepId: 'teaching', offset: 7 } }, reading: { version: 'ntv', scrollTop: 237 } }), unmount: async () => closeAllowed } },
    MeditationSessionStorage: { get: id => id === session.id ? session : null },
    history: { pushState: (_a, _b, hash) => { context.window.location.hash = hash; } },
});
function method(name) {
    const node = appNode.properties.find(n => n.key?.name === name).value;
    return vm.runInContext(`(${source.slice(node.start, node.end)})`, context);
}
const app = {
    openNoteDate: '2026-10-23', currentMeditationSessionId: session.id,
    data: [{ date: session.readingId }],
    getMeditationLearningReturn: method('getMeditationLearningReturn'),
    openMeditationLearning: method('openMeditationLearning'),
    returnToMeditationFromLearning: method('returnToMeditationFromLearning'),
    navigate: (...args) => { route = args; }, handleRoute: async () => {},
    getReadingByDate: async date => { reads++; return { date }; },
    openMeditationSession: id => { restored = id; },
    openDeepeningShell: (reading, state) => { mounted = { reading, state }; return {}; }, showToast() {}
};
closeAllowed = false;
assert.equal(await app.openMeditationLearning('dios', session.readingId), false);
assert.equal(route, undefined, 'Failed persistence must not navigate or destroy the editor');
assert.equal(stored.size, 0);
closeAllowed = true;
for (const lesson of ['dios', 'ensenanza', 'aplicacion', 'oracion']) {
    assert.equal(await app.openMeditationLearning(lesson, session.readingId), true);
    assert.deepEqual(route, ['workshop', lesson]);
    const serialized = stored.get('su-voz-meditation-learning-return');
    assert(!serialized.includes(session.notes.dios), 'Return context contains no meditation text');
    app.meditationLearningReturn = null;
    assert.equal(app.getMeditationLearningReturn().lesson, lesson, 'Return survives a page reload');
    assert.equal(await app.returnToMeditationFromLearning(), true);
    assert.equal(restored, session.id);
    assert.equal(mounted.state.meditation.activeStepId, 'teaching');
    assert.equal(mounted.state.meditation.caret.offset, 7);
    assert.equal(mounted.state.reading.scrollTop, 237);
    assert.equal(mounted.state.reading.version, 'ntv');
    assert.equal(mounted.state.focusEditor, true);
    assert.equal(stored.size, 0);
}
await app.openMeditationLearning('ensenanza', session.readingId);
let finishRoute;
app.handleRoute = () => new Promise(resolve => { finishRoute = resolve; });
mounted = null;
const returning = app.returnToMeditationFromLearning();
assert(mounted, 'A cached return mounts and requests editor focus synchronously within the user tap');
assert.equal(mounted.state.focusEditor, true);
finishRoute(); assert.equal(await returning, true);
app.handleRoute = async () => {};
await app.openMeditationLearning('oracion', session.readingId);
app.data = [];
assert.equal(await app.returnToMeditationFromLearning(), true, 'An uncached reading can still be recovered asynchronously');
assert.equal(reads, 1);
app.data = [{ date: session.readingId }];
assert.equal(await app.openMeditationLearning('unknown', session.readingId), false);
assert.equal(await app.openMeditationLearning('dios', '2026-10-22'), false);
await app.openMeditationLearning('oracion', session.readingId);
session.status = 'archived'; restored = null;
assert.equal(await app.returnToMeditationFromLearning(), false);
assert.equal(restored, null, 'An archived session is never reopened or replaced');
session.status = 'draft';
app.handleRoute = async () => { context.window.location.hash = '#calendar'; };
assert.equal(await app.returnToMeditationFromLearning(), false, 'A late return cannot override newer navigation');
assert.equal(restored, null);
assert.equal(reads, 1, 'Ordinary returns never wait for an already loaded reading');
for (const invalid of ['{', 'null', '{"date":"bad","sessionId":"x","lesson":"dios"}']) {
    app.meditationLearningReturn = null; stored.set('su-voz-meditation-learning-return', invalid);
    assert.equal(app.getMeditationLearningReturn(), null);
}
console.log('OK: four exact lesson links, failed-save navigation guard, same date/session/step/caret/version/scroll return, reload, archived data and late navigation');

let closes = 0, flushSucceeds = false;
const closeButton = { closest: selector => selector === '[data-deepening-close]' ? closeButton : null };
const clickContext = vm.createContext({ root: { contains: () => true }, stepPointerFocus: null,
    flushAutoSave: () => flushSucceeds, options: { onClose: () => { closes++; } } });
const click = vm.runInContext(`(${declaration('js/MeditationDocument.js', 'onClick')})`, clickContext);
click({ target: closeButton }); assert.equal(closes, 0);
flushSucceeds = true; click({ target: closeButton }); assert.equal(closes, 1);
const backupOrder = [];
clickContext.flushAutoSave = () => { backupOrder.push('latest-draft'); return false; };
clickContext.options.onBackup = () => { backupOrder.push('export'); };
click({ target: { closest: selector => selector === '[data-deepening-backup]' ? {} : null } });
assert.deepEqual(backupOrder, ['latest-draft', 'export'], 'Backup includes the newest text even when persistence still fails');
const target = { hidden: false, innerHTML: 'keep', style: { removeProperty() {} }, removeEventListener() {} };
let cleaned = 0;
const shellContext = vm.createContext({ getRoot: () => target, closing: false,
    meditationDocument: { flushAutoSave: () => false }, mountedOptions: {},
});
const unmount = vm.runInContext(`(${declaration('js/DeepeningShell.js', 'unmount')})`, shellContext);
assert.equal(await unmount(), false);
assert.equal(target.innerHTML, 'keep'); assert.equal(target.hidden, false);
Object.assign(shellContext, { meditationDocument: { flushAutoSave: () => true, destroy: () => true },
    mountedOptions: { onRestore: () => { cleaned++; } }, blurActiveShellElement() {}, nextFrame: async () => {},
    keyboardManager: null, meditationActionsPanel: null, closeDocumentViewer() {}, readingDocument: null,
    restorePositionRecord: null, unlockBackground() {}, handleShellKeydown() {}, closeHelp() {} });
assert.equal(await unmount(), true); assert.equal(target.hidden, true); assert.equal(cleaned, 1);
assert.equal(await unmount(), true); assert.equal(cleaned, 1, 'Closing is idempotent');
console.log('OK: actual close handler and shell preserve the editor on failed save; successful close restores once');

let focused, escapeCloses = 0;
const controls = Array.from({ length: 3 }, (_, index) => ({ getClientRects: () => [{}], closest: () => null,
    focus: () => { focused = index; } }));
const keyContext = vm.createContext({ documentViewerOverlay: null, helpOverlay: null,
    getRoot: () => ({ querySelectorAll: () => controls }), document: { activeElement: controls[2] },
    unmount: async () => { escapeCloses++; return false; }, closeHelp: () => { keyContext.helpOverlay = null; } });
const keydown = vm.runInContext(`(${declaration('js/DeepeningShell.js', 'handleShellKeydown')})`, keyContext);
let prevented = 0;
keydown({ key: 'Tab', preventDefault: () => { prevented++; } });
assert.equal(focused, 0);
keyContext.document.activeElement = controls[0];
keydown({ key: 'Tab', shiftKey: true, preventDefault: () => { prevented++; } });
assert.equal(focused, 2);
keydown({ key: 'Escape', preventDefault: () => { prevented++; } });
assert.equal(escapeCloses, 1);
keyContext.helpOverlay = {};
keydown({ key: 'Escape', preventDefault: () => { prevented++; } });
assert.equal(keyContext.helpOverlay, null);
assert.equal(escapeCloses, 1, 'Escape closes the questions before the meditation');
keyContext.documentViewerOverlay = {};
keydown({ key: 'Escape' });
assert.equal(escapeCloses, 1, 'Escape in the review must not close the underlying editor');
assert.equal(prevented, 4);
console.log('OK: actual modal keyboard handler wraps focus, uses guarded close and isolates the document viewer');

function reviewFixture({ resumeEditing = false, connected = true } = {}) {
    const order = [];
    const button = { removeEventListener() {} };
    const reviewContext = vm.createContext({
        documentViewerOverlay: { querySelector: () => button, removeEventListener() {}, remove() { order.push('remove-review'); } },
        documentViewerFocusReturnElement: { isConnected: connected, focus() { order.push('restore-control'); } },
        documentViewerResumeEditing: resumeEditing, documentViewer: {},
        handleDocumentViewerCloseClick() {}, handleDocumentViewerFinish() {}, handleDocumentViewerKeydown() {},
        clearDocumentViewerPdfState() {}, restoreDocumentViewerBackground() { order.push('restore-background'); },
        meditationDocument: { focusEditor() { order.push('resume-editor'); } }
    });
    const closeReview = vm.runInContext(`(${declaration('js/DeepeningShell.js', 'closeDocumentViewer')})`, reviewContext);
    return { order, reviewContext, closeReview };
}
const editingReview = reviewFixture({ resumeEditing: true });
editingReview.closeReview();
assert.deepEqual(editingReview.order, ['remove-review', 'restore-background', 'resume-editor']);
assert.equal(editingReview.reviewContext.documentViewerResumeEditing, false);
editingReview.closeReview();
assert.equal(editingReview.order.length, 3, 'A second close cannot re-open the keyboard');
const browsingReview = reviewFixture(); browsingReview.closeReview();
assert.deepEqual(browsingReview.order, ['remove-review', 'restore-background', 'restore-control']);
const finishingReview = reviewFixture({ resumeEditing: true }); finishingReview.closeReview({ restoreFocus: false });
assert.deepEqual(finishingReview.order, ['remove-review', 'restore-background'], 'Finishing never briefly re-opens the editor');
console.log('OK: closing review resumes editing synchronously after removing inert background, preserves browsing focus and skips keyboard on finish');

const body = {};
const selection = { rangeCount: 1, getRangeAt: () => ({ cloneRange: () => ({ offset: 7 }) }),
    removeAllRanges() {}, addRange: range => { assert.equal(range.offset, 7); } };
const readingContext = vm.createContext({ root: { contains: () => true },
    document: { activeElement: body }, window: { getSelection: () => selection },
    preservedEditable: null, preservedSelection: null, preservedReadingScrollTop: null,
    getVerseItemFromEvent: event => event.target.verse || null,
    isEditableElement: element => element === editor, clearNonEditableSelection() {},
    setActiveVerse: verse => { readingContext.activeVerse = verse.number; },
});
const editor = { isConnected: true, focus: () => { readingContext.document.activeElement = editor; } };
for (const name of ['preserveWritingFocus', 'restoreWritingFocus', 'clearWritingFocus']) {
    readingContext[name] = vm.runInContext(`(${declaration('js/ReadingDocument.js', name)})`, readingContext);
}
const pointerDown = vm.runInContext(`(${declaration('js/ReadingDocument.js', 'onPointerDown')})`, readingContext);
const mouseDown = vm.runInContext(`(${declaration('js/ReadingDocument.js', 'onReadingMouseDown')})`, readingContext);
const verseClick = vm.runInContext(`(${declaration('js/ReadingDocument.js', 'onClick')})`, readingContext);
for (const number of [3, 4, 5]) {
    readingContext.document.activeElement = editor;
    const event = { button: 0, target: { verse: { number } }, preventDefault() { this.prevented = true; }, stopPropagation() {} };
    pointerDown(event);
    readingContext.document.activeElement = body;
    mouseDown(event);
    assert.equal(event.prevented, true);
    assert.equal(readingContext.document.activeElement, editor, 'Compatibility mousedown restores the same editor synchronously');
    verseClick(event);
    assert.equal(readingContext.document.activeElement, editor);
    assert.equal(readingContext.activeVerse, number);
    assert.equal(readingContext.preservedEditable, null, 'Pointer intent cannot leak into later browsing');
}
readingContext.document.activeElement = body;
const browseVerse = { target: { verse: { number: 8 } }, preventDefault() {}, stopPropagation() {} };
pointerDown(browseVerse); verseClick(browseVerse);
assert.equal(readingContext.document.activeElement, body, 'Selecting a verse when not writing never opens a keyboard');
console.log('OK: consecutive verse selections retain editing focus and caret, including the WebKit compatibility path; browsing stays unfocused');
let voiceToggles = 0, voiceStops = 0, versionChanges = 0;
Object.assign(readingContext, { activeVersion: 'ntv', preserveReadingPosition() {},
    setVersion: () => { versionChanges++; }, requestAnimationFrame: callback => callback(), syncVoiceControl() {},
    options: { onVoiceToggle: () => { voiceToggles++; }, onVoiceStop: () => { voiceStops++; } } });
for (const name of ['data-deepening-version', 'data-deepening-voice-toggle', 'data-deepening-voice-stop']) {
    const control = { hasAttribute: attribute => attribute === name, getAttribute: () => 'ntv' };
    const event = { button: 0, target: { closest: selector => selector.includes(`[${name}]`) ? control : null },
        preventDefault() {}, stopPropagation() {} };
    readingContext.document.activeElement = editor;
    pointerDown(event); readingContext.document.activeElement = body; mouseDown(event); verseClick(event);
    assert.equal(readingContext.document.activeElement, editor, `${name} retains writing focus`);
    assert.equal(readingContext.preservedEditable, null);
}
assert.equal(voiceToggles, 1); assert.equal(voiceStops, 1); assert.equal(versionChanges, 1);
console.log('OK: version, audio and stop controls retain editing focus without changing their callbacks');

const helpPanel = { attributes: {}, innerHTML: '', scrollTop: 99, listeners: new Map(),
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.listeners.set(name, callback); },
    removeEventListener(name) { this.listeners.delete(name); }, remove() { this.removed = true; } };
let helpStep = { label: 'Dios <texto>', intro: 'Orientación', questions: ['Pregunta uno', 'Pregunta dos'], lesson: 'dios' };
let expanded = false, helpFocus = 0, helpLearned = 0, helpCanSave = false, helpVisibilityChecks = 0;
const helpContext = vm.createContext({ helpOverlay: null, helpWasEditing: false,
    document: { createElement: () => helpPanel, activeElement: { closest: () => ({}) } },
    getRoot: () => ({ querySelector: selector => {
        assert.equal(selector, '.deepening-shell', 'Help belongs inside the modal dialog');
        return { append: panel => assert.equal(panel, helpPanel) };
    } }),
    meditationDocument: { getHelp: () => helpStep, setHelpExpanded: value => { expanded = value; },
        focusEditor: () => { helpFocus++; }, ensureCaretVisible: () => { helpVisibilityChecks++; }, flushAutoSave: () => helpCanSave },
    mountedOptions: { onLearn: () => { helpLearned++; } } });
for (const name of ['escapePreviewHtml', 'preserveHelpEditing', 'closeHelp', 'handleHelpClick', 'refreshHelp', 'toggleHelp']) {
    helpContext[name] = vm.runInContext(`(${declaration('js/DeepeningShell.js', name)})`, helpContext);
}
helpContext.toggleHelp();
assert.equal(helpVisibilityChecks, 1, 'Opening questions keeps the current caret visible in a long response');
assert(expanded); assert(helpPanel.innerHTML.includes('Dios &lt;texto&gt;'));
assert(helpPanel.innerHTML.includes('Pregunta uno') && helpPanel.innerHTML.includes('Pregunta dos'));
assert.equal(helpPanel.scrollTop, 0);
helpStep = { ...helpStep, label: 'Enseñanza', questions: ['Pregunta contextual'], lesson: 'ensenanza' };
helpContext.refreshHelp();
assert(!helpPanel.innerHTML.includes('Pregunta uno')); assert(helpPanel.innerHTML.includes('Pregunta contextual'));
assert.equal(helpPanel.attributes['aria-label'], 'Más ayuda: Enseñanza');
let keptEditing = 0;
helpContext.preserveHelpEditing({ type: 'pointerdown', button: 0, preventDefault: () => { keptEditing++; } });
helpContext.document.activeElement = { closest: () => null };
helpContext.preserveHelpEditing({ type: 'mousedown', button: 0, preventDefault: () => { keptEditing++; } });
assert.equal(keptEditing, 2); assert.equal(helpFocus, 1);
const learnHelp = { target: { closest: selector => selector === '[data-deepening-help-learn]' ? {} : null } };
helpContext.handleHelpClick(learnHelp); assert.equal(helpLearned, 0, 'Questions cannot navigate past a failed save');
helpCanSave = true; helpContext.handleHelpClick(learnHelp); assert.equal(helpLearned, 1);
helpContext.toggleHelp(); assert(!expanded); assert.equal(helpPanel.listeners.size, 0);
assert.equal(helpVisibilityChecks, 2, 'Closing questions rechecks visibility without changing the writing position');
console.log('OK: contextual questions remain separate from writing, preserve focus, escape content and protect navigation on failed persistence');
