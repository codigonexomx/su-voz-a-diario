import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const keyboardManagerSource = await readFile(new URL('../js/KeyboardViewportManager.js', import.meta.url), 'utf8');

class FakeInput {}
class FakeTextarea {}

function createKeyboardContext() {
    const documentElement = {
        clientHeight: 844,
        style: {
            values: {},
            setProperty(name, value) {
                this.values[name] = value;
            }
        }
    };
    const document = {
        activeElement: null,
        hidden: false,
        documentElement,
        addEventListener() {},
        removeEventListener() {}
    };
    const visualViewport = {
        width: 390,
        height: 844,
        addEventListener() {},
        removeEventListener() {}
    };
    const window = {
        matchMedia: () => ({ matches: true }),
        screen: { width: 390, height: 844, orientation: { type: "portrait-primary" } },
        innerWidth: 390,
        innerHeight: 844,
        visualViewport,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {}
    };
    const navigator = {
        virtualKeyboard: {
            boundingRect: { height: 0 },
            addEventListener() {},
            removeEventListener() {}
        }
    };
    const context = {
        window,
        document,
        navigator,
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
        HTMLInputElement: FakeInput,
        HTMLTextAreaElement: FakeTextarea,
        requestAnimationFrame(callback) {
            callback();
            return 1;
        },
        cancelAnimationFrame() {},
        setTimeout(callback) {
            callback();
            return 1;
        },
        clearTimeout() {}
    };
    vm.createContext(context);
    vm.runInContext(keyboardManagerSource, context);
    return context;
}

function keyboardState(options) {
    const context = createKeyboardContext();
    const { window, document, navigator } = context;
    window.innerHeight = options.baselineHeight;
    window.visualViewport.height = options.baselineHeight;
    document.documentElement.clientHeight = options.baselineHeight;
    window.KeyboardViewportManager.init();

    document.activeElement = options.hasKeyboardFocus ? new FakeInput() : null;
    window.visualViewport.height = options.currentHeight;
    navigator.virtualKeyboard.boundingRect.height = options.virtualKeyboardHeight || 0;
    window.KeyboardViewportManager.refresh();
    return window.KeyboardViewportManager.getState().isKeyboardOpen;
}

assert.equal(
    keyboardState({
        hasKeyboardFocus: false,
        baselineHeight: 844,
        currentHeight: 390
    }),
    false,
    'Una rotación sin campo enfocado no debe simular teclado'
);

assert.equal(
    keyboardState({
        hasKeyboardFocus: true,
        baselineHeight: 844,
        currentHeight: 520
    }),
    true,
    'Una reducción real del viewport con campo enfocado debe detectar teclado'
);

assert.equal(
    keyboardState({
        hasKeyboardFocus: true,
        baselineHeight: 844,
        currentHeight: 790
    }),
    false,
    'Cambios pequeños de la barra del navegador no deben detectar teclado'
);

assert.equal(
    keyboardState({
        hasKeyboardFocus: true,
        baselineHeight: 390,
        currentHeight: 390,
        virtualKeyboardHeight: 220
    }),
    true,
    'VirtualKeyboard debe tener prioridad cuando está disponible'
);

const source = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

assert.doesNotMatch(
    source,
    /_baseViewportHeight/,
    'No debe volver el baseline único capturado al inicio'
);

assert.match(
    source,
    /this\.closeTransientBibleUI\(\);[\s\S]*if \(\(?oldView === 'home'/,
    'Cada cambio de ruta debe limpiar overlays transitorios'
);

assert.match(
    source,
    /if \(!versionPickerMounted\)[\s\S]*bibleVersionPickerOpen = false/,
    'Debe existir reconciliación defensiva del selector de versión'
);

// Realistic layout resize cases: visual and layout viewport shrink together.
for (const scenario of [
    { name: 'Android portrait resize', width: 390, baseline: 844, height: 350, coarse: true, expected: true },
    { name: 'Desktop focused resize', width: 1366, baseline: 900, height: 650, coarse: false, expected: false },
]) {
    const c = createKeyboardContext();
    c.window.matchMedia = () => ({ matches: scenario.coarse });
    c.window.screen.orientation.type = scenario.coarse ? 'portrait-primary' : 'landscape-primary';
    c.window.innerWidth = c.window.visualViewport.width = scenario.width;
    c.window.innerHeight = c.window.visualViewport.height = scenario.baseline;
    c.window.KeyboardViewportManager.init();
    c.document.activeElement = new FakeInput();
    c.window.innerHeight = c.window.visualViewport.height = scenario.height;
    c.window.KeyboardViewportManager.refresh();
    assert.equal(c.window.KeyboardViewportManager.getState().isKeyboardOpen, scenario.expected, scenario.name);
    c.window.innerHeight = c.window.visualViewport.height = scenario.baseline;
    c.window.KeyboardViewportManager.refresh();
    assert.equal(c.window.KeyboardViewportManager.getState().isKeyboardOpen, false, scenario.name + ' closes');
}
{
    const c = createKeyboardContext();
    c.window.KeyboardViewportManager.init();
    c.document.activeElement = new FakeInput();
    c.window.screen.orientation.type = 'landscape-primary';
    c.window.innerWidth = c.window.visualViewport.width = 844;
    c.window.innerHeight = c.window.visualViewport.height = 210;
    c.window.KeyboardViewportManager.refresh();
    assert.equal(c.window.KeyboardViewportManager.getState().isKeyboardOpen, true, 'Rotate with keyboard open');
    c.window.innerHeight = c.window.visualViewport.height = 390;
    c.window.KeyboardViewportManager.refresh();
    assert.equal(c.window.KeyboardViewportManager.getState().isKeyboardOpen, false, 'Landscape keyboard closes');
    c.window.visualViewport.height = 190;
    c.window.visualViewport.scale = 2;
    c.window.KeyboardViewportManager.refresh();
    assert.equal(c.window.KeyboardViewportManager.getState().isKeyboardOpen, false, 'Pinch zoom is not a keyboard');
}
console.log('Bottom navigation regression checks: OK');
