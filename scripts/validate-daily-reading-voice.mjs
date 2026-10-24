import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { DailyReadingNarrator, chunkDailyVoiceText } from '../js/reading/DailyReadingNarrator.js';
import { normalizeBibleVoiceText } from '../js/bible/BibleReaderSelection.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const queue = [{ text: 'Primer versiculo.', verseIndex: 0 }, { text: 'Segundo versiculo.', verseIndex: 1 }];
function web() {
    const spoken = [], states = [], completed = [], errors = [];
    const calls = { pause: 0, resume: 0, cancel: 0 };
    const synthesis = { paused: false, getVoices: () => [], speak: value => spoken.push(value),
        pause: () => { calls.pause++; synthesis.paused = true; },
        resume: () => { calls.resume++; synthesis.paused = false; }, cancel: () => calls.cancel++ };
    const narrator = new DailyReadingNarrator({ synthesis, Utterance: class { constructor(text) { this.text = text; } },
        selectVoice: () => null, onState: state => states.push(state),
        onComplete: value => completed.push(value), onError: () => errors.push(true) });
    return { narrator, spoken, states, completed, errors, calls, synthesis };
}
const w = web();
w.narrator.start('2026-10-24', queue, 'ntv');
assert.equal(w.spoken[0].text, queue[0].text);
assert.equal(w.states.at(-1).verseIndex, 0);
w.narrator.pause();
assert.equal(w.states.at(-1).status, 'paused');
w.narrator.resume();
assert.equal(w.states.at(-1).status, 'speaking');
assert.equal(w.spoken.length, 1, 'Web resume keeps the same engine utterance and exact position');
assert.equal(w.calls.pause, 1); assert.equal(w.calls.resume, 1);
w.spoken[0].onend(); await settle();
assert.equal(w.spoken[1].text, queue[1].text);
assert.equal(w.states.at(-1).verseIndex, 1);
w.spoken[1].onend(); await settle();
assert.equal(w.states.at(-1).status, 'idle');
assert.deepEqual(w.completed, [{ date: '2026-10-24', version: 'ntv' }]);

const stale = web();
stale.narrator.start('A', queue, 'rvr60');
const old = stale.spoken[0];
stale.narrator.start('B', [queue[1]], 'tla');
old.onboundary({ charIndex: 8 }); old.onend(); await settle();
assert.equal(stale.narrator.state.date, 'B');
assert.equal(stale.spoken.length, 2, 'An old completion cannot enqueue another verse');
assert.equal(stale.narrator.offset, 0);
stale.narrator.stop(); stale.spoken[1].onerror({ error: 'canceled' }); await settle();
assert.equal(stale.narrator.state.status, 'idle');
assert.equal(stale.errors.length, 0); assert.equal(stale.completed.length, 0);

const boundary = web();
boundary.narrator.start('A', queue, 'tla');
boundary.narrator.pause();
boundary.spoken[0].onend(); await settle();
assert.equal(boundary.spoken.length, 1, 'An end callback during pause must not start the next verse');
boundary.narrator.resume();
assert.equal(boundary.synthesis.paused, false, 'Resume after a verse boundary releases the global web pause');
assert.equal(boundary.spoken[1].text, queue[1].text);
boundary.spoken[1].onerror({ error: 'synthesis-failed' }); await settle();
assert.equal(boundary.errors.length, 1); assert.equal(boundary.completed.length, 0);
assert.equal(boundary.narrator.state.status, 'idle');
const replacePaused = web();
replacePaused.narrator.start('A', queue, 'ntv'); replacePaused.narrator.pause();
replacePaused.narrator.start('B', queue, 'tla');
assert.equal(replacePaused.synthesis.paused, false, 'Replacing a paused reading never leaves the new queue muted');
replacePaused.narrator.stop();
const skipped = web();
skipped.narrator.start('A', queue, 'tla');
const cancellations = skipped.calls.cancel;
skipped.narrator.stop(false);
assert.equal(skipped.calls.cancel, cancellations, 'Shared-engine stop can invalidate callbacks without canceling another player');
skipped.spoken[0].onend(); await settle(); assert.equal(skipped.spoken.length, 1);
console.log('OK: real web sequencing, same-utterance pause/resume, stop, failures, late boundaries, replacement and completion-once');

const nativeSpoken = [], nativeStates = [], nativeComplete = [], nativeErrors = [], listeners = [], removed = [];
const native = { stop: async () => {}, addListener: async (name, fn) => {
    assert.equal(name, 'onRangeStart'); listeners.push(fn);
    const id = listeners.length; return { remove: async () => removed.push(id) };
}, speak: options => new Promise((resolve, reject) => nativeSpoken.push({ ...options, resolve, reject })) };
const n = new DailyReadingNarrator({ native, onState: state => nativeStates.push(state),
    onComplete: value => nativeComplete.push(value), onError: () => nativeErrors.push(true) });
n.start('A', [{ text: 'Alpha beta gamma.', verseIndex: 0 }, queue[1]], 'ntv'); await settle();
assert.equal(nativeSpoken.length, 1);
listeners[0]({ start: 6 });
n.pause(); assert.equal(n.state.status, 'paused');
n.resume(); await settle();
assert.equal(nativeSpoken[1].text, 'beta gamma.', 'Native resume starts at its last reported word, not the passage beginning');
assert.equal(nativeStates.at(-1).verseIndex, 0);
listeners[0]({ start: 12 }); nativeSpoken[0].resolve(); await settle();
assert.equal(nativeSpoken.length, 2, 'Stopped native speak completion cannot start another verse');
assert.equal(n.offset, 6, 'An old range listener cannot corrupt the new position');
nativeSpoken[1].resolve(); await settle();
assert.equal(nativeSpoken[2].text, queue[1].text);
assert.equal(nativeStates.at(-1).verseIndex, 1);
nativeSpoken[2].resolve(); await settle();
assert.equal(n.state.status, 'idle'); assert.equal(nativeComplete.length, 1);
assert.equal(nativeErrors.length, 0); assert(removed.includes(1)); assert(removed.includes(2)); assert(removed.includes(3));

let releaseListener, lateRemoved = 0, lateSpoken = 0;
const lateNative = new DailyReadingNarrator({ native: { stop: async () => {},
    addListener: () => new Promise(resolve => { releaseListener = resolve; }),
    speak: async () => lateSpoken++ }, onState: () => {}, onComplete: () => assert.fail('Stopped run completed'), onError: () => {} });
lateNative.start('A', queue, 'ntv'); await settle(); lateNative.stop();
releaseListener({ remove: async () => lateRemoved++ }); await settle();
assert.equal(lateSpoken, 0); assert.equal(lateRemoved, 1, 'A listener resolving after stop is removed immediately');

let withoutEvents = 0, withoutEventsComplete = 0;
const fallback = new DailyReadingNarrator({ native: { stop: async () => {},
    addListener: async () => { throw Error('not supported'); }, speak: async () => withoutEvents++ },
    onState: () => {}, onComplete: () => withoutEventsComplete++, onError: () => assert.fail('Word events are optional') });
fallback.start('B', queue, 'tla'); await settle();
assert.equal(withoutEvents, 2); assert.equal(withoutEventsComplete, 1);
let nativeFailures = 0, falseCompletions = 0;
const brokenNative = new DailyReadingNarrator({ native: { stop: async () => {}, speak: async () => { throw Error('engine unavailable'); } },
    onState: () => {}, onComplete: () => falseCompletions++, onError: () => nativeFailures++ });
brokenNative.start('A', queue, 'ntv'); await settle();
assert.equal(brokenNative.state.status, 'idle'); assert.equal(nativeFailures, 1); assert.equal(falseCompletions, 0);
console.log('OK: native verse sequence, word-position resume, canceled promises, exact listener cleanup and no-word-events fallback');

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, name) {
    if (node.type === 'Property' && node.key.name === name) return node;
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
        if (child?.type) { const result = find(child, name); if (result) return result; }
    }
}
const context = vm.createContext({ Symbol, normalizeBibleVoiceText, chunkDailyVoiceText, document: {}, window: {} });
function method(name) {
    const node = find(tree, name); assert(node, name);
    return vm.runInContext(`(${source.slice(node.value.start, node.value.end)})`, context);
}
let started = 0, readResolve;
const app = { currentVersion: 'ntv', isNativeTextToSpeechAvailable: () => true,
    stopBibleChapterVoice: () => {}, stopDailyReadingVoice() { this.dailyReadingVoiceRequest = null; },
    getReadingByDate: () => new Promise(resolve => { readResolve = resolve; }),
    getDailyReadingVoiceQueue: () => queue, bindDailyReadingFollow: () => {},
    trackAnalyticsOnce: () => {}, trackAnalyticsEvent: () => {}, getReadingAnalyticsParams: () => ({}),
    getDailyReadingNarrator: () => ({ start: () => started++ }) };
const loading = method('startDailyReadingVoice').call(app, 'A', 'Texto');
app.stopDailyReadingVoice(); readResolve({ date: 'A' }); await loading;
assert.equal(started, 0, 'Leaving while the reading loads cannot start background audio');
let changedVersion = 0;
method('pauseOrResumeDailyReadingVoice').call({ dailyReadingVoice: { date: 'A', version: 'rvr60', status: 'paused' },
    dailyReadingNarrator: { resume: () => assert.fail('Wrong translation resumed') },
    startDailyReadingVoice: (date, text, version) => { assert.equal(version, 'ntv'); changedVersion++; } }, 'A', 'Texto', 'ntv');
assert.equal(changedVersion, 1);

const fields = [{ getAttribute: () => 'El amor 144.000 permanece.' }, { getAttribute: () => 'Otro versiculo.' }];
context.document.createElement = () => ({ innerHTML: '', querySelectorAll: () => fields });
const queueApp = { getDailyReadingText: () => '<sup>1</sup>Texto', renderVerseText: () => '<div></div>',
    getNativeTextToSpeechChunks: method('getNativeTextToSpeechChunks') };
const built = method('getDailyReadingVoiceQueue').call(queueApp, { date: 'A', reference: 'Juan 1:1-2' }, 'ntv', 'fallback');
assert.equal(built[0].verseIndex, 0); assert.equal(built[1].verseIndex, 1);
assert(built[0].text.includes('144.000')); assert(built[0].text.startsWith('Juan 1:1-2.'));
assert(!built[1].text.includes('Juan'));
const longText = ('Texto 144.000, numero 2220 y palabra. ').repeat(200).trim();
const chunks = chunkDailyVoiceText(longText);
assert(chunks.every(value => value.length <= 2800)); assert.equal(chunks.join(' '), longText);
assert.equal(chunkDailyVoiceText('x'.repeat(5601)).join('').length, 5601);
console.log('OK: actual queue preserves literal Bible numbers and verse identities, and stale reading loads cannot start playback');

let moves = 0;
const classSet = new Set();
const verse = { classList: { add: name => classSet.add(name), remove: name => classSet.delete(name) },
    getBoundingClientRect: () => ({ top: 700 }), scrollIntoView: () => moves++ };
const shell = { getAttribute: () => 'A', querySelectorAll: () => [verse] };
context.document = { querySelectorAll: () => [shell], querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 124 }) }),
    body: { classList: { contains: () => false } }, visibilityState: 'visible' };
context.window = { innerHeight: 800, getSelection: () => ({ isCollapsed: true }) };
const visual = { dailyReadingVoice: { status: 'speaking', date: 'A', verseIndex: 0 }, dailyReadingFollow: true };
const position = method('updateDailyReadingVoicePosition');
position.call(visual); assert(classSet.has('daily-voice-current')); assert.equal(moves, 1);
position.call(visual); assert.equal(moves, 1, 'Button state updates never repeatedly move the same verse');
visual.dailyReadingVoice.status = 'idle'; position.call(visual); assert.equal(classSet.size, 0);
visual.dailyReadingVoice.status = 'speaking'; visual.dailyReadingFollow = false;
position.call(visual); assert.equal(moves, 1, 'Exploring the text suspends automatic scrolling, not the current-verse mark');
visual.dailyReadingVoice.status = 'idle'; position.call(visual);
visual.dailyReadingVoice.status = 'speaking'; visual.dailyReadingFollow = true;
context.window.getSelection = () => ({ isCollapsed: false }); position.call(visual);
assert.equal(moves, 1, 'Native text selection is never replaced or scrolled away');
const followListeners = new Map();
context.window.addEventListener = (name, fn) => followListeners.set(name, fn);
const follow = method('bindDailyReadingFollow');
follow.call(visual); follow.call(visual); assert.equal(followListeners.size, 4);
followListeners.get('wheel')(); assert.equal(visual.dailyReadingFollow, false);
visual.dailyReadingFollow = true;
followListeners.get('keydown')({ key: 'ArrowDown', target: { closest: () => ({}) } });
assert.equal(visual.dailyReadingFollow, true, 'Typing and editor cursor movement do not change following');
followListeners.get('touchmove')(); assert.equal(visual.dailyReadingFollow, false);
visual.dailyReadingFollow = true;
followListeners.get('pointerdown')({ target: { closest: () => ({}) } });
assert.equal(visual.dailyReadingFollow, false);
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
assert.equal(sw.split("'./js/reading/DailyReadingNarrator.js'").length - 1, 2, 'Narrator is included in both offline asset lists');
console.log('OK: independent narration mark, no repeated jump, manual exploration, native selection, single listener registration and offline asset');
