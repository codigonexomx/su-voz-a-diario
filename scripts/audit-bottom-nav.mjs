// Diagnostic harness: runs the production animation methods with a deterministic
// frame clock. This reports discontinuities; it is not a browser/device test.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const source = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const methods = source.slice(source.indexOf('    getBottomNavItems: function()'), source.indexOf('    showAprilMessageIfNeeded: function()'));

export function harness() {
    let now = 0, id = 0;
    const frames = new Map();
    const context = vm.createContext({
        performance: { now: () => now },
        document: { body: { classList: { contains: () => false } } },
        window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
        requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
        cancelAnimationFrame: key => frames.delete(key),
    });
    const app = vm.runInContext(`({${methods}})`, context);
    const nav = { clientWidth: 378, clientHeight: 58, style: { setProperty() {} }, getBoundingClientRect: () => ({}), querySelector: () => ({}) };
    const buttons = Array.from({ length: 5 }, (_, i) => ({ offsetLeft: 10 + i * 72, offsetWidth: 72, offsetHeight: 50, addEventListener(type, fn) { this[type] = fn; } }));
    Object.assign(app, { $bottomNav: nav, $navHome: buttons[0], $navBible: buttons[1], $navCalendar: buttons[2], $navCommunity: buttons[3], $navStats: buttons[4], currentView: 'home', _glassNavAnimationFrame: null, _glassNavFrame: null });
    function tick(ms = 1000 / 60) {
        now += ms;
        const batch = [...frames];
        for (const [key, fn] of batch) {
            if (frames.delete(key)) fn(now);
        }
    }
    app.updateGlassNavIndicator({ animate: false });
    tick();
    return { app, buttons, nav, tick, pending: () => frames.size, x: () => app._glassNavVisualState.centerX };
}

const report = { isolatedAnimation: [], interruptions: [] };
for (const hz of [120, 60, 30, 20]) {
    const h = harness();
    h.app.currentView = 'stats';
    h.app.updateGlassNavIndicator({ animate: true });
    const positions = [h.x()];
    for (let i = 0; i < hz * 3; i++) { h.tick(1000 / hz); positions.push(h.x()); }
    assert.ok(Math.abs(h.x() - 334) < 0.01);
    report.isolatedAnimation.push({ hz, finalCenter: h.x(), maxFrameMovement: +Math.max(...positions.slice(1).map((x, i) => Math.abs(x - positions[i]))).toFixed(2), overshoot: +Math.max(0, ...positions.map(x => x - 334)).toFixed(2) });
}

for (const reason of ['resize/viewport update', 'repeated active-button update', 'second pointerdown during animation']) {
    const h = harness();
    h.app.bindGlassNavIndicatorGeometry(); h.tick(); h.tick();
    h.app.currentView = 'stats';
    h.app.updateGlassNavIndicator({ animate: true });
    for (let i = 0; i < 6; i++) h.tick();
    const before = h.x();
    if (reason.startsWith('second')) { h.buttons[0].pointerdown(); h.tick(); }
    else h.app.updateGlassNavIndicator({ animate: reason.startsWith('repeated') });
    report.interruptions.push({ reason, before: +before.toFixed(2), after: h.x(), jump: +(h.x() - before).toFixed(2) });
}

// Reuse the existing keyboard test fixture, adding wide-screen and deep
// keyboard reductions omitted by its four original cases.
const fixture = await readFile(new URL('./validate-bottom-nav.mjs', import.meta.url), 'utf8');
const keyboardManagerSource = await readFile(new URL('../js/KeyboardViewportManager.js', import.meta.url), 'utf8');
const keyboardContext = vm.createContext({ vm, keyboardManagerSource });
vm.runInContext(fixture.slice(fixture.indexOf('class FakeInput'), fixture.indexOf('\nassert.equal(')), keyboardContext);
report.keyboard = [];
for (const input of [
    { label: 'Portrait keyboard reduces height below width', width: 390, baseline: 844, height: 350 },
    { label: 'Desktop resize with focused field, no virtual keyboard', width: 1366, baseline: 900, height: 650 },
]) {
    keyboardContext.input = input;
    report.keyboard.push(vm.runInContext(`(() => {
        const c = createKeyboardContext();
        c.window.matchMedia = () => ({ matches: input.width < 800 });
        c.window.screen.orientation.type = input.width < 800 ? 'portrait-primary' : 'landscape-primary';
        c.window.innerWidth = c.window.visualViewport.width = input.width;
        c.window.innerHeight = c.window.visualViewport.height = input.baseline;
        c.document.documentElement.clientHeight = input.baseline;
        c.window.KeyboardViewportManager.init();
        c.document.activeElement = new FakeInput();
        c.window.innerHeight = c.window.visualViewport.height = input.height;
        c.document.documentElement.clientHeight = input.height;
        c.window.KeyboardViewportManager.refresh();
        return { label: input.label, ...c.window.KeyboardViewportManager.getState() };
    })()`, keyboardContext));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    console.log(JSON.stringify(report, null, 2));
}
