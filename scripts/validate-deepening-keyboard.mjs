import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const files = ['js/KeyboardViewportManager.js', 'js/KeyboardManager.js', 'css/deepening-shell.css'];
const [viewportSource, keyboardSource, css] = await Promise.all(
    files.map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8'))
);

function eventTarget() {
    const listeners = new Map();
    return {
        addEventListener(type, callback) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(callback);
        },
        removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
        dispatchEvent(event) { listeners.get(event.type)?.forEach(callback => callback(event)); }
    };
}

function style() {
    const values = new Map();
    return {
        setProperty: (name, value) => values.set(name, value),
        removeProperty: name => values.delete(name),
        getPropertyValue: name => values.get(name) || ''
    };
}

function fixture({ native = false, coarse = true, visualViewport = true } = {}) {
    const frames = new Map();
    const timers = new Map();
    let nextId = 0;
    const root = { style: style(), getBoundingClientRect: () => ({ height: 844 }) };
    const classes = new Set();
    const shell = {
        style: style(),
        classList: {
            toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
            remove: name => classes.delete(name),
            contains: name => classes.has(name)
        }
    };
    const editor = {
        isContentEditable: true,
        closest: () => editor,
        getBoundingClientRect() {
            const { top } = notebook.getBoundingClientRect();
            return { top: top + 32, bottom: top + 52, height: 20 };
        },
        blur() { document.activeElement = null; }
    };
    let caret = null;
    const notebook = {
        ...eventTarget(),
        scrollTop: 0,
        contains: element => element === editor,
        closest: () => shell,
        getBoundingClientRect() {
            const top = Number.parseFloat(root.style.getPropertyValue('--deepening-viewport-top')) || 0;
            const height = Number.parseFloat(root.style.getPropertyValue('--deepening-shell-height')) || 844;
            return { top: top + height * 0.55, bottom: top + height - 8 };
        }
    };
    const document = {
        ...eventTarget(), activeElement: null, visibilityState: 'visible', hidden: false,
        documentElement: { clientWidth: 390, clientHeight: 844, style: style() },
        getElementById: () => root
    };
    const window = {
        ...eventTarget(), innerWidth: 390, innerHeight: 844,
        screen: { width: 390, height: 844, orientation: { type: 'portrait-primary' } },
        matchMedia: () => ({ matches: coarse }),
        Capacitor: { isNativePlatform: () => native },
        getSelection: () => caret ? {
            rangeCount: 1,
            getRangeAt: () => ({ cloneRange: () => ({ collapse() {}, getBoundingClientRect: () => caret }) })
        } : null
    };
    if (visualViewport) window.visualViewport = {
        ...eventTarget(), width: 390, height: 844, offsetTop: 0, scale: 1
    };
    const context = vm.createContext({
        window, document, navigator: {},
        HTMLInputElement: class {}, HTMLTextAreaElement: class {},
        CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
        requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        setTimeout(callback) { const id = ++nextId; timers.set(id, callback); return id; },
        clearTimeout: id => timers.delete(id)
    });
    vm.runInContext(viewportSource, context);
    vm.runInContext(keyboardSource, context);
    const manager = window.KeyboardManager.create();
    manager.init(notebook);
    function flush() {
        for (let iteration = 0; frames.size; iteration++) {
            assert(iteration < 20, 'Viewport updates must settle without a layout loop');
            const current = [...frames.values()];
            frames.clear();
            current.forEach(callback => callback());
        }
    }
    flush();
    function change({ height = 844, offset = 0, focus = true, type = 'resize' } = {}) {
        document.activeElement = focus ? editor : null;
        if (window.visualViewport) {
            window.visualViewport.height = height;
            window.visualViewport.offsetTop = offset;
            window.visualViewport.dispatchEvent({ type });
        } else {
            window.innerHeight = height;
            window.dispatchEvent({ type });
        }
        flush();
    }
    return { window, document, root, shell, notebook, editor, manager, flush, change,
        setCaret: rect => { caret = rect; } };
}

const ios = fixture();
ios.change({ height: 420, offset: 0 });
assert.equal(ios.root.style.getPropertyValue('--deepening-shell-height'), '420px');
assert(ios.shell.classList.contains('is-keyboard-open'));
let changes = 0;
const unsubscribe = ios.window.KeyboardViewportManager.subscribe(() => { changes++; });
const beforePan = changes;
// Safari can pan after its resize event, without changing the visible height.
ios.change({ height: 420, offset: 180, type: 'scroll' });
assert.equal(ios.root.style.getPropertyValue('--deepening-viewport-top'), '180px',
    'The editor must follow an iOS keyboard pan instead of leaving a gap above the keyboard');
assert.equal(changes, beforePan + 1, 'Offset-only changes must reach subscribers');
assert.equal(ios.window.KeyboardViewportManager.getState().visibleOffsetTop, 180);
const bottom = Number.parseFloat(ios.root.style.getPropertyValue('--deepening-viewport-top'))
    + Number.parseFloat(ios.root.style.getPropertyValue('--deepening-shell-height'));
assert.equal(bottom, 180 + 420, 'The shell must reach the bottom of the visual viewport');
ios.change({ height: 420, offset: 210.5, type: 'scroll' });
assert.equal(ios.root.style.getPropertyValue('--deepening-viewport-top'), '210.5px');
const scrollBefore = ios.notebook.scrollTop;
ios.setCaret({ top: 620, bottom: 640, height: 20 });
ios.manager.ensureCursorVisible(); ios.flush();
assert(ios.notebook.scrollTop > scrollBefore, 'A hidden caret scrolls inside the notebook');
const { top } = ios.notebook.getBoundingClientRect();
ios.setCaret({ top: top + 32, bottom: top + 52, height: 20 });
const visibleCaretScroll = ios.notebook.scrollTop;
ios.manager.ensureCursorVisible(); ios.flush();
assert.equal(ios.notebook.scrollTop, visibleCaretScroll, 'A visible caret must not trigger scrolling');
ios.setCaret(null);
ios.change({ height: 844, offset: 210.5 });
assert.equal(ios.root.style.getPropertyValue('--deepening-viewport-top'), '0px',
    'A stale iOS offset after keyboard dismissal must not leave a translated shell');
assert.equal(ios.root.style.getPropertyValue('--deepening-shell-height'), '844px');
assert(!ios.shell.classList.contains('is-keyboard-open'));
ios.change({ height: 420, offset: 180 });
ios.change({ height: 420, offset: 180, focus: false, type: 'scroll' });
assert.equal(ios.root.style.getPropertyValue('--deepening-viewport-top'), '0px');
ios.change({ height: 420, offset: 180 });
ios.manager.destroy();
assert.equal(ios.root.style.getPropertyValue('--deepening-viewport-top'), '');
ios.change({ height: 420, offset: 240 });
assert.equal(ios.root.style.getPropertyValue('--deepening-viewport-top'), '', 'Closed editors unsubscribe');
unsubscribe();
ios.manager.init(ios.notebook); ios.flush();
assert.equal(ios.root.style.getPropertyValue('--deepening-viewport-top'), '240px', 'Reopening recalibrates');

const android = fixture({ native: true });
android.window.innerHeight = 350;
android.change({ height: 350 });
assert.equal(android.root.style.getPropertyValue('--deepening-shell-height'), '350px');
assert.equal(android.root.style.getPropertyValue('--deepening-viewport-top'), '0px');
android.change();
assert(!android.shell.classList.contains('is-keyboard-open'));

const desktop = fixture({ coarse: false });
desktop.window.innerHeight = 650;
desktop.change({ height: 650, offset: 20 });
assert(!desktop.shell.classList.contains('is-keyboard-open'));
assert.equal(desktop.root.style.getPropertyValue('--deepening-viewport-top'), '0px');

const zoom = fixture();
zoom.window.visualViewport.scale = 2;
zoom.change({ height: 420, offset: 180 });
assert(!zoom.shell.classList.contains('is-keyboard-open'));
assert.equal(zoom.root.style.getPropertyValue('--deepening-viewport-top'), '0px');

const fallback = fixture({ visualViewport: false });
fallback.change({ height: 400 });
assert.equal(fallback.root.style.getPropertyValue('--deepening-shell-height'), '400px');
assert.equal(fallback.root.style.getPropertyValue('--deepening-viewport-top'), '0px');

const rotated = fixture();
rotated.change({ height: 420, offset: 180 });
rotated.window.screen.orientation.type = 'landscape-primary';
rotated.window.innerWidth = rotated.window.visualViewport.width = 844;
rotated.window.innerHeight = 390;
rotated.change({ height: 200, offset: 80 });
assert(rotated.shell.classList.contains('is-keyboard-open'));
assert.equal(rotated.root.style.getPropertyValue('--deepening-shell-height'), '200px');
assert.equal(rotated.root.style.getPropertyValue('--deepening-viewport-top'), '80px');
rotated.change({ height: 390 });
assert(!rotated.shell.classList.contains('is-keyboard-open'));
assert.equal(rotated.root.style.getPropertyValue('--deepening-viewport-top'), '0px');

const toolbar = fixture();
toolbar.change({ height: 790, offset: 30 });
assert(!toolbar.shell.classList.contains('is-keyboard-open'), 'Browser toolbar movement is not a keyboard');
assert.equal(toolbar.root.style.getPropertyValue('--deepening-viewport-top'), '0px');

assert.match(css, /#deepening-root\s*\{[^}]*inset:\s*var\(--deepening-viewport-top,\s*0px\)\s+0\s+auto\s*;/,
    'Only the fixed Profundizar root follows the keyboard viewport');
for (const file of files) {
    assert.equal(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'),
        await readFile(new URL(`../www/${file}`, import.meta.url), 'utf8'), `Android source mirror: ${file}`);
}
console.log('Profundizar keyboard regression checks: OK (iOS pan, dismissal, caret, Android, desktop, zoom, fallback, rotation, toolbar)');
