import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const checking = process.argv.includes('--check');
const pageHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Profundizar - prueba local aislada</title>
<link rel="stylesheet" href="/css/fonts-local.css"><link rel="stylesheet" href="/css/deepening-shell.css">
<style>:root{--safe-area-top:0px;--safe-area-bottom:0px}html,body{margin:0;overflow:hidden}</style>
</head><body><div id="deepening-root"><div class="deepening-shell" role="dialog" aria-label="Modo Profundizar">
<section class="deepening-reading-document" aria-label="Lectura de prueba"><div class="deepening-reading-toolbar">
<h1 class="deepening-reading-reference">Lectura de prueba</h1></div><div class="deepening-reading-text">
<p>Texto ficticio para comprobar el cuaderno. Esta prueba no utiliza cuentas, Firebase ni meditaciones personales.</p>
<p>Las cuatro respuestas deben permanecer independientes al cambiar de paso.</p></div></section>
<div class="deepening-meditation-host" id="notebook-host"></div></div></div>
<script src="/js/KeyboardViewportManager.js"></script><script src="/js/KeyboardManager.js"></script>
<script src="/js/MeditationDocument.js"></script><script src="/fixture.js"></script></body></html>`;

const fixtureJs = `
${checking ? `
const viewport = Object.assign(new EventTarget(), {width: innerWidth, height: innerHeight, offsetTop: 0, scale: 1});
Object.defineProperty(window, 'visualViewport', {configurable: true, value: viewport});
` : ''}
const saved = [];
window.DocumentFactory = {create: value => value};
const notebook = MeditationDocument.create({initialNote: {
 dios: 'Respuesta de prueba sobre Dios.', aprendizaje: 'Respuesta de prueba de enseñanza.',
 respuesta: 'Respuesta de prueba de aplicación.', oracion: 'Respuesta de prueba de oración.'
}, onAutoSave(note, ui) { saved.push({note: {...note}, ui}); }});
notebook.mount(document.getElementById('notebook-host'));
const manager = KeyboardManager.create(); manager.init(notebook.getScrollElement());
window.qa = {
 saved, notebook, manager,
 keyboard(height, offset = 0) {
  window.visualViewport.height = height; window.visualViewport.offsetTop = offset;
  window.visualViewport.dispatchEvent(new Event('resize')); window.visualViewport.dispatchEvent(new Event('scroll'));
 },
 state() {
  const editor = document.querySelector('[data-deepening-editor]');
  const selection = window.getSelection();
  let offset = null;
  if (selection.rangeCount && editor.contains(selection.anchorNode)) {
   const range = selection.getRangeAt(0).cloneRange();
   range.selectNodeContents(editor); range.setEnd(selection.anchorNode, selection.anchorOffset); offset = range.toString().length;
  }
  const nav = document.querySelector('.deepening-step-list').getBoundingClientRect();
  const notebookRect = notebook.getScrollElement().getBoundingClientRect();
  let caretVisible = false;
  if (selection.rangeCount && editor.contains(selection.anchorNode)) {
   const range = selection.getRangeAt(0).cloneRange(); range.collapse(false);
   const rect = range.getBoundingClientRect();
   caretVisible = rect.height > 0 && rect.top >= Math.max(notebookRect.top, nav.bottom) - 1
    && rect.bottom <= notebookRect.bottom + 1;
  }
  return {active: document.activeElement === editor, editor: editor.innerText,
   step: document.querySelector('[aria-current="step"]')?.dataset.step, caret: offset,
   note: notebook.getCurrentDocument().sections,
   animated: document.querySelector('[data-step-panel]:not([hidden])').getAnimations().length,
   editorTransform: getComputedStyle(editor).transform,
   navigationVisible: nav.top >= notebookRect.top - 1 && nav.bottom <= notebookRect.bottom + 1,
   caretVisible,
   shellHeight: document.getElementById('deepening-root').getBoundingClientRect().height,
   keyboardOpen: KeyboardViewportManager.getState().isKeyboardOpen,
   overflow: document.documentElement.scrollWidth > innerWidth,
   promptsVisible: [...document.querySelectorAll('[data-step-panel]')].filter(panel => !panel.hidden).length};
 }
};`;

const allowed = /^\/(?:css\/(?:fonts-local|deepening-shell)\.css|js\/(?:MeditationDocument|KeyboardManager|KeyboardViewportManager)\.js|assets\/fonts\/[^/]+\.ttf)$/;
const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'none'; frame-src 'none'");
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    try {
        if (path === '/') {
            response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(pageHtml); return;
        }
        if (path === '/fixture.js') {
            response.setHeader('Content-Type', 'text/javascript; charset=utf-8'); response.end(fixtureJs); return;
        }
        if (!allowed.test(path)) { response.writeHead(404).end(); return; }
        response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'font/ttf');
        response.end(await readFile(new URL(path.slice(1), root)));
    } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(checking ? 0 : Number(process.env.PORT || 8770), '127.0.0.1', resolve);
});
const url = `http://127.0.0.1:${server.address().port}/`;
console.log(`Isolated Profundizar preview: ${url}`);

if (checking) {
    let browser;
    try {
        const module = process.env.PLAYWRIGHT_MODULE || 'playwright';
        const { chromium, webkit } = await import(module);
        const engine = process.argv.includes('--webkit') ? webkit : chromium;
        browser = await engine.launch({ headless: true,
            ...(engine === chromium && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
                ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
        const results = [];
        const outputDir = new URL('../artifacts/validation/deepening-steps/', import.meta.url);
        await mkdir(outputDir, { recursive: true });
        for (const [name, viewport, touch] of [
            ['phone', { width: 390, height: 844 }, true],
            ['small-phone', { width: 320, height: 700 }, true],
            ['tablet', { width: 800, height: 1100 }, true],
            ['desktop', { width: 1440, height: 1000 }, false]
        ]) {
            const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(url);
            const editor = page.locator('[data-deepening-editor]');
            const teaching = page.locator('[data-step="teaching"]');
            const god = page.locator('[data-step="god"]');
            if (touch) await editor.tap(); else await editor.click();
            await editor.fill('Borrador ficticio sin guardar.');
            await page.evaluate(() => {
                const editor = document.querySelector('[data-deepening-editor]');
                const range = document.createRange(); range.setStart(editor.firstChild, 5); range.collapse(true);
                const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
                window.blurCount = 0; editor.addEventListener('blur', () => { window.blurCount++; });
            });
            if (touch) await teaching.tap(); else await teaching.click();
            let state = await page.evaluate(() => qa.state());
            assert(state.active, `${name}: editing focus stays on the editor`);
            assert.equal(state.step, 'teaching');
            assert.equal(state.note.dios, 'Borrador ficticio sin guardar.');
            assert.equal(await page.evaluate(() => window.blurCount), 0, `${name}: no keyboard-dismiss blur`);
            assert.equal(state.editorTransform, 'none', 'The live caret is not transformed by page motion');
            await editor.fill('Enseñanza ficticia conservada.');
            if (touch) await god.tap(); else await god.click();
            state = await page.evaluate(() => qa.state());
            assert(state.active);
            assert.equal(state.caret, 5);
            assert.equal(state.note.aprendizaje, 'Enseñanza ficticia conservada.');
            assert.equal(state.editor, 'Borrador ficticio sin guardar.');
            for (const step of ['prayer', 'application', 'teaching', 'god']) {
                if (touch) await page.locator(`[data-step="${step}"]`).tap();
                else await page.locator(`[data-step="${step}"]`).click();
                state = await page.evaluate(() => qa.state());
                assert(state.active && state.step === step, `${name}: direct step ${step}`);
                assert.equal(state.promptsVisible, 1);
                assert(!state.overflow);
                assert(state.navigationVisible, `${name}: steps stay visible while editing`);
            }
            if (touch) {
                const longAnswer = Array.from({length: 12}, (_, index) => `Linea ficticia ${index + 1} de una respuesta larga.`).join('\n');
                await editor.fill(longAnswer);
                for (const [height, offset] of [[420, 0], [350, 120]]) {
                    await page.evaluate(([height, offset]) => qa.keyboard(height, offset), [height, offset]);
                    await page.waitForFunction(height => qa.state().keyboardOpen && qa.state().shellHeight === height, height);
                    for (const step of ['teaching', 'prayer', 'god']) {
                        await page.locator(`[data-step="${step}"]`).tap();
                        await page.waitForFunction(() => qa.state().caretVisible);
                        state = await page.evaluate(() => qa.state());
                        assert(state.active && state.keyboardOpen && state.shellHeight === height);
                        assert(state.navigationVisible, `${name}: compact viewport navigation`);
                    }
                    assert.equal(state.editor, longAnswer, `${name}: multiline response is preserved`);
                }
                await page.locator('#deepening-root').screenshot({ path: fileURLToPath(new URL(`${engine.name()}-${name}-keyboard-simulated.png`, outputDir)) });
                await page.evaluate(height => qa.keyboard(height), viewport.height);
            }
            await page.evaluate(() => {
                const editor = document.querySelector('[data-deepening-editor]');
                editor.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
                editor.innerText = 'Composición provisional';
                document.querySelector('[data-step="teaching"]').click();
                editor.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true}));
                editor.innerText = 'Composición final conservada';
                editor.dispatchEvent(new InputEvent('input', {bubbles: true}));
            });
            await page.waitForFunction(() => qa.state().step === 'teaching');
            state = await page.evaluate(() => qa.state());
            assert.equal(state.note.dios, 'Composición final conservada');
            assert.equal(state.editor, 'Enseñanza ficticia conservada.');
            await page.emulateMedia({ reducedMotion: 'reduce' });
            if (touch) await god.tap(); else await god.click();
            assert.equal((await page.evaluate(() => qa.state())).animated, 0);
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            await page.evaluate(() => document.querySelector('[data-step="prayer"]').focus());
            await page.locator('[data-step="prayer"]').press('Enter');
            state = await page.evaluate(() => qa.state());
            assert.equal(state.step, 'prayer'); assert(!state.active, 'Keyboard navigation does not force editing');
            await editor.click();
            await page.screenshot({ path: fileURLToPath(new URL(`${engine.name()}-${name}.png`, outputDir)) });
            const application = page.locator('[data-step="application"]');
            if (touch) await application.tap(); else await application.click();
            await editor.fill('');
            if (touch) await god.tap(); else await god.click();
            if (touch) await application.tap(); else await application.click();
            state = await page.evaluate(() => qa.state());
            // A cleared contenteditable may retain a placeholder <br> in Chromium.
            assert(state.active && state.editor.trim() === '', `${name}: an empty response remains editable: ${JSON.stringify(state)}`);
            await page.keyboard.insertText('Respuesta nueva de prueba.');
            assert.equal((await page.evaluate(() => qa.state())).note.respuesta.trim(), 'Respuesta nueva de prueba.');
            await page.waitForFunction(() => qa.saved.at(-1)?.note.respuesta.trim() === 'Respuesta nueva de prueba.');
            assert.equal(await page.evaluate(() => qa.saved.at(-1).note.dios), 'Composición final conservada');
            assert.deepEqual(errors, []);
            results.push({ viewport: name, engine: engine.name(), focusRetained: true,
                noBlurWhileSwitching: true, draftPreserved: true, caretRestored: true,
                directStepsPassed: true, reducedMotionPassed: true, keyboardNavigationPassed: true,
                navigationVisibleWhileEditing: true, simulatedKeyboardViewportPassed: touch,
                multilineDraftPassed: touch, caretVisibleWithStickySteps: touch,
                emptyResponseEditable: true, autosavePassed: true,
                noHorizontalOverflow: true, realMobileKeyboardTested: false });
            await context.close();
        }
        await writeFile(new URL(`${engine.name()}-results.json`, outputDir), JSON.stringify(results, null, 2) + '\n');
        console.log(JSON.stringify({ engine: engine.name(), viewports: results.length, passed: true, realMobileKeyboardTested: false }));
    } finally {
        await browser?.close(); await new Promise(resolve => server.close(resolve));
    }
} else {
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
