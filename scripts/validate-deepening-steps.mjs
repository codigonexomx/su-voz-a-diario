import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/MeditationDocument.js', import.meta.url), 'utf8');

function fixture({ reducedMotion = false } = {}) {
    const timers = new Map();
    const frames = new Map();
    const handlers = new Map();
    const saved = [];
    const animations = [];
    let id = 0;
    let caret = 2;
    const body = {};
    const document = { activeElement: body, addEventListener() {}, removeEventListener() {} };
    const selection = {
        rangeCount: 1,
        getRangeAt: () => ({ startContainer: editor, startOffset: caret,
            cloneRange: () => ({ selectNodeContents() {}, setEnd() {}, toString: () => 'x'.repeat(caret),
                collapse() {}, getBoundingClientRect: () => ({ top: 60, bottom: 80, height: 20 }) }) }),
        removeAllRanges() {},
        addRange(range) { caret = range.offset; }
    };
    document.createRange = () => ({ offset: 0,
        selectNodeContents(element) { this.offset = element.innerText.length; },
        collapse() {},
        setStart(node, offset) { this.offset = offset; }
    });
    document.createTreeWalker = element => {
        let read = false;
        return { nextNode: () => read ? null : (read = true, { textContent: element.innerText }) };
    };
    const classes = () => ({ toggle() {}, contains: () => false, add() {}, remove() {} });
    const editor = {
        innerText: 'Initial God response',
        set innerHTML(value) { this.innerText = value.replace(/<br>/g, '\n'); },
        get innerHTML() { return this.innerText; },
        closest: selector => selector === '[data-deepening-editor]' ? editor : null,
        contains: node => node === editor,
        setAttribute() {},
        focus() { document.activeElement = editor; },
        getBoundingClientRect: () => ({ top: 50, bottom: 100 })
    };
    const steps = ['god', 'teaching', 'application', 'prayer'].map(stepId => ({
        classList: classes(), setAttribute() {}, removeAttribute() {},
        getAttribute: name => name === 'data-step' ? stepId : null,
        closest: selector => selector === '.deepening-step' ? steps.find(step => step.getAttribute('data-step') === stepId) : null
    }));
    const panels = steps.map(step => ({
        hidden: step.getAttribute('data-step') !== 'god',
        getAttribute: () => step.getAttribute('data-step'),
        animate(keyframes, options) {
            const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true; } };
            animations.push(animation);
            return animation;
        }
    }));
    const root = {
        scrollTop: 0, scrollHeight: 200, clientHeight: 300, classList: classes(),
        contains: element => element === editor || steps.includes(element),
        querySelector(selector) {
            if (selector === '[data-deepening-editor]') return editor;
            if (selector.includes('data-step-panel')) return panels.find(panel => !panel.hidden);
            return null;
        },
        querySelectorAll: selector => selector === '.deepening-step' ? steps : panels,
        getBoundingClientRect: () => ({ top: 0, bottom: 300 }),
        addEventListener(name, callback) { handlers.set(name, callback); },
        removeEventListener(name, callback) { if (handlers.get(name) === callback) handlers.delete(name); }
    };
    const window = {
        getSelection: () => selection, matchMedia: () => ({ matches: reducedMotion }),
        clearTimeout: key => timers.delete(key),
        setTimeout(callback) { const key = ++id; timers.set(key, callback); return key; },
        DocumentFactory: { create: value => value }
    };
    const context = vm.createContext({ window, document, NodeFilter: { SHOW_TEXT: 4 }, console,
        getComputedStyle: () => ({ lineHeight: '24px' }),
        requestAnimationFrame(callback) { const key = ++id; frames.set(key, callback); return key; },
        cancelAnimationFrame: key => frames.delete(key)
    });
    vm.runInContext(source, context);
    const notebook = window.MeditationDocument.create({
        initialNote: { dios: editor.innerText, aprendizaje: 'Teaching response', oracion: 'Prayer response' },
        onAutoSave(note, ui) { saved.push(JSON.parse(JSON.stringify({ note, ui }))); }
    });
    notebook.mount({ innerHTML: '', querySelector: () => root });
    function emit(type, target = editor, extra = {}) {
        const event = { type, target, button: 0, pointerType: 'touch', detail: 1,
            defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
        handlers.get(type)?.(event);
        return event;
    }
    function flush() {
        for (let count = 0; frames.size; count++) {
            assert(count < 20, 'Frame callbacks must settle');
            const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback());
        }
        const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback());
    }
    flush();
    return { notebook, editor, document, body, steps, panels, animations, handlers, saved, emit, flush,
        getCaret: () => caret, setCaret: value => { caret = value; } };
}

const touch = fixture();
touch.editor.focus();
touch.editor.innerText = 'Unsaved God response';
touch.setCaret(5);
touch.emit('pointerdown', touch.steps[1]);
// Model the iOS compatibility-event path separately from pointerdown.
const mouseDown = touch.emit('mousedown', touch.steps[1]);
assert(mouseDown.defaultPrevented, 'Compatibility mousedown must not dismiss the editing keyboard');
touch.emit('click', touch.steps[1]);
assert.equal(touch.document.activeElement, touch.editor, 'The same editor keeps focus');
assert.equal(touch.editor.innerText, 'Teaching response');
assert.equal(touch.getCaret(), 'Teaching response'.length);
touch.editor.innerText = 'Updated teaching';
touch.setCaret(4);
touch.emit('pointerdown', touch.steps[0]); touch.emit('mousedown', touch.steps[0]); touch.emit('click', touch.steps[0]);
assert.equal(touch.editor.innerText, 'Unsaved God response');
assert.equal(touch.getCaret(), 5, 'Returning restores that step cursor');
touch.flush();
assert.equal(touch.saved.at(-1).note.dios, 'Unsaved God response');
assert.equal(touch.saved.at(-1).note.aprendizaje, 'Updated teaching');
assert.equal(touch.animations.length, 2, 'Exactly one page animation per step change');
assert(touch.animations[0].cancelled, 'Rapid switches cancel the previous transition');
assert.notDeepEqual(touch.animations[0].keyframes, touch.animations[1].keyframes, 'Forward/backward motions differ');

const blurred = fixture();
blurred.editor.focus(); blurred.emit('pointerdown', blurred.steps[3]);
blurred.document.activeElement = blurred.body;
blurred.emit('mousedown', blurred.steps[3]); blurred.emit('click', blurred.steps[3]);
assert.equal(blurred.document.activeElement, blurred.editor, 'A tap restores editing synchronously if the browser moved focus');
assert.equal(blurred.editor.innerText, 'Prayer response');

const browse = fixture();
browse.emit('pointerdown', browse.steps[1]); browse.emit('mousedown', browse.steps[1]);
browse.document.activeElement = browse.steps[1]; browse.emit('click', browse.steps[1]);
assert.equal(browse.document.activeElement, browse.steps[1], 'Browsing does not force open a keyboard');
assert.equal(browse.editor.innerText, 'Teaching response');
browse.emit('pointerdown', browse.steps[3]); browse.emit('pointercancel', browse.steps[3]);
browse.emit('click', browse.steps[3], { detail: 0 });
assert.equal(browse.document.activeElement, browse.steps[1], 'Cancelled pointer intent cannot reopen editing');

const keyboard = fixture();
keyboard.editor.focus(); keyboard.emit('pointerdown', keyboard.steps[1]);
keyboard.emit('keydown', keyboard.steps[1], { key: 'Enter' }); keyboard.document.activeElement = keyboard.steps[1];
keyboard.emit('click', keyboard.steps[1], { detail: 0 });
assert.equal(keyboard.document.activeElement, keyboard.steps[1], 'Keyboard activation keeps navigation focus');

const composing = fixture();
composing.editor.focus(); composing.emit('compositionstart'); composing.editor.innerText = 'Composing text';
composing.emit('pointerdown', composing.steps[1]); composing.emit('mousedown', composing.steps[1]); composing.emit('click', composing.steps[1]);
assert.equal(composing.editor.innerText, 'Composing text', 'An IME composition is not replaced mid-word');
composing.emit('compositionend');
composing.editor.innerText = 'Composition completed';
composing.emit('input'); composing.flush();
assert.equal(composing.editor.innerText, 'Teaching response');
assert.equal(composing.saved.at(-1).note.dios, 'Composition completed', 'The final IME input stays in its original step');

const superseded = fixture();
superseded.editor.focus(); superseded.emit('compositionstart');
superseded.editor.innerText = 'Final composed draft'; superseded.emit('click', superseded.steps[1]);
superseded.emit('compositionend'); superseded.emit('click', superseded.steps[3]); superseded.flush();
assert.equal(superseded.editor.innerText, 'Prayer response', 'A fresh choice supersedes a queued IME transition');
assert.equal(superseded.saved.at(-1).note.dios, 'Final composed draft');

const closing = fixture();
closing.editor.focus(); closing.emit('compositionstart'); closing.editor.innerText = 'Draft before closing';
closing.emit('click', closing.steps[1]); closing.emit('compositionend'); closing.notebook.destroy(); closing.flush();
assert.equal(closing.saved.at(-1).note.dios, 'Draft before closing', 'Closing preserves the draft and cancels the queued transition');
assert.equal(closing.animations.length, 0);

const reduced = fixture({ reducedMotion: true });
reduced.emit('click', reduced.steps[1], { detail: 0 });
assert.equal(reduced.animations.length, 0, 'Reduced motion disables the page effect');
touch.notebook.destroy();
assert.equal(touch.handlers.size, 0, 'Closing removes every notebook listener');
assert(touch.animations.at(-1).cancelled, 'Closing cancels the page animation');

assert.equal(source, await readFile(new URL('../www/js/MeditationDocument.js', import.meta.url), 'utf8'),
    'Android web mirror must match');
console.log('Profundizar steps: OK (iOS compatibility focus, mouse/touch, browsing, keyboard, caret per step, drafts, IME, motion, cleanup)');
