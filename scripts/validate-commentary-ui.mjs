import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { parse as parseJavaScript } from 'acorn';
import { createBibleReadingKey, parseBibleReadingKey } from '../js/bible/bibleInternalTest.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseHTML } from 'node-html-parser';
import { parseCommentaryReference, isCommentaryRange, formatCommentaryRange, renderCommentaryEntry } from '../js/bible/CommentaryPanel.js';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'data/commentaries/hendriksen-apocalipsis.json'), 'utf8'));
const bundle = { ...pkg, contents: pkg.entries };
const sampleRange = parseCommentaryReference('Apocalipsis 11:15–12:6');
assert.deepEqual(sampleRange, { start: { bookId: 'rev', chapter: 11, verse: 15 }, end: { bookId: 'rev', chapter: 12, verse: 6 } });
assert.equal(formatCommentaryRange(sampleRange), 'Apocalipsis 11:15–12:6');
assert.equal(isCommentaryRange(parseCommentaryReference('Apocalipsis 21:9–22:5')), true);
for (const reference of ['Juan 3:16', 'Apocalipsis 22:22', 'Apocalipsis 12:6–11:15', 'Apocalipsis 15:9', 'Apocalipsis 1:1 y 2:2', 'Apocalipsis 23', 'Apocalipsis 0:1']) assert.equal(parseCommentaryReference(reference), null, reference);
for (const entry of pkg.entries) {
    const rendered = parseHTML(renderCommentaryEntry(entry, bundle));
    assert(rendered.querySelector('h3'));
    if (!entry.text.trim() && pkg.entries.some(child => child.parentId === entry.id)) {
        assert(rendered.querySelector('.commentary-subsections button'), 'Empty parent must lead to its original child sections: ' + entry.id);
    }
    const expectedNotes = pkg.notes.filter(note => note.groupId === entry.notesGroupId);
    assert.equal(rendered.querySelectorAll('.commentary-notes li').length, expectedNotes.length);
}
for (const entry of pkg.frontMatter.filter(entry => entry.visualSupplements?.length)) {
    const rendered = parseHTML(renderCommentaryEntry(entry, bundle).replace(/<br>/g, ' ')).text.replace(/\s+/g, ' ');
    for (const supplement of entry.visualSupplements) assert(rendered.replace(/\s+/g, '').includes(supplement.text.replace(/\s+/g, '')), 'Missing front matter supplement ' + entry.id);
    assert(rendered.includes('Página ' + entry.pdfPage));
}
const unsafe = renderCommentaryEntry({ id: 'unsafe', title: '<script>x</script>', text: '<img src=x onerror=alert(1)>', ranges: [], assetIds: ['bad'] }, { assets: [{ id: 'bad', url: 'javascript:alert(1)' }] });
assert.equal(parseHTML(unsafe).querySelectorAll('script, img').length, 0);
assert(unsafe.includes('&lt;img'));
console.log('OK: safe native text, all entry notes, context navigation, cover supplements and strict cross-chapter references');

// Exercise the shipped app functions, not a copy of their selection logic.
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const appAst = parseJavaScript(appSource, { ecmaVersion: 'latest', sourceType: 'module' });
const appObject = appAst.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'App').init;
function classList(initial = []) {
    const values = new Set(initial);
    return { add: value => values.add(value), remove: value => values.delete(value),
        contains: value => values.has(value), toggle(value, enabled) { enabled ? values.add(value) : values.delete(value); } };
}
const bodyClasses = classList();
const appContext = vm.createContext({ parseBibleReadingKey, isCommentaryRange, clearTimeout,
    readingIcon: () => '<svg></svg>', window: { scrollY: 80 }, document: { body: { classList: bodyClasses } } });
function appMethod(name) {
    const property = appObject.properties.find(item => item.key.name === name);
    assert(property, 'Missing application method: ' + name);
    return vm.runInContext('(' + appSource.slice(property.value.start, property.value.end) + ')', appContext);
}
const openBibleCommentary = appMethod('openBibleCommentary');
const showSelectionPanelForVerse = appMethod('showSelectionPanelForVerse');
function selectionFixture({ activeBook, selectedBook, selectedVersion = 'rvr60', currentVersion = 'rvr60', action = 'commentary-for-selection' }) {
    let opened = null, focused = false;
    const anchor = { dataset: { action }, isConnected: true,
        getAttribute: name => name === 'data-action' ? action : null,
        focus: () => { focused = true; } };
    const selectedVerse = { isConnected: true, getAttribute: () => '2', closest: () => ({ querySelectorAll: () => [selectedVerse] }) };
    const controls = new Map([['[data-action="listen-bible-selection"]', { hidden: false }]]);
    const actions = { insertAdjacentHTML(position, markup) {
        assert.equal(position, 'afterbegin');
        if (markup.includes('commentary-for-selection')) controls.set('[data-action="commentary-for-selection"]', { hidden: false });
    } };
    const panel = { classList: classList(['visible']), querySelector: selector => selector === '.selection-actions-row' ? actions : controls.get(selector) || null };
    const state = { currentView: 'bible-reading', selectedBibleBook: activeBook, selectedBibleChapter: 1,
        currentBibleVersion: currentVersion, _bibleReaderEpoch: 3,
        currentSelectionDate: createBibleReadingKey(selectedVersion, selectedBook, 1),
        currentSelectedVerse: selectedVerse, currentSelectedText: 'Texto de prueba',
        captureBibleReaderScrollAnchor: () => ({ bookId: activeBook, chapter: 1, verseNumber: activeBook === 'jud' ? 25 : 7 }),
        closeBibleFootnotePopover() {}, closeBibleCrossReferencePopover() {},
        getCommentaryPanel: () => ({ open(options) { opened = options; } }),
        $selectionPanel: panel, $selectionNote: { value: 'Borrador sin guardar' }, $selectionColorButtons: [],
        getSelectionHighlightState: () => ({ colors: [] }), getSelectionNoteByText: () => ({ note: 'Nota guardada' }),
        positionSelectionSheet() {} };
    return { state, panel, anchor, controls, get opened() { return opened; }, get focused() { return focused; } };
}
for (const currentVersion of ['rvr60', 'rvr60-strong']) {
    const selectedApocalypse = selectionFixture({ activeBook: 'jud', selectedBook: 'rev', selectedVersion: currentVersion, currentVersion });
    showSelectionPanelForVerse.call(selectedApocalypse.state);
    assert.equal(selectedApocalypse.controls.get('[data-action="commentary-for-selection"]')?.hidden, false,
        'A selected Apocalipsis verse must expose commentary even while a Judas verse remains at the top');
    selectedApocalypse.state.$selectionNote.value = 'Borrador sin guardar';
    assert.equal(openBibleCommentary.call(selectedApocalypse.state, selectedApocalypse.anchor), true);
    assert.deepEqual(JSON.parse(JSON.stringify(selectedApocalypse.opened.range)),
        { start: { bookId: 'rev', chapter: 1, verse: 2 }, end: { bookId: 'rev', chapter: 1, verse: 2 } });
    assert.equal(selectedApocalypse.opened.isCurrent(), true, 'The selected passage must remain current across the visible-book boundary');
    assert.equal(selectedApocalypse.panel.classList.contains('visible'), false);
    assert.equal(selectedApocalypse.state.$selectionNote.value, 'Borrador sin guardar');
    selectedApocalypse.opened.onClose();
    assert.equal(selectedApocalypse.panel.classList.contains('visible'), true);
    assert.equal(selectedApocalypse.state.$selectionNote.value, 'Borrador sin guardar');
    assert.equal(selectedApocalypse.focused, true);
    selectedApocalypse.panel.classList.remove('visible');
    selectedApocalypse.state.currentView = 'home';
    selectedApocalypse.opened.onClose();
    assert.equal(selectedApocalypse.panel.classList.contains('visible'), false, 'A stale close must not reopen the selection sheet on another screen');
}
for (const options of [
    { activeBook: 'rev', selectedBook: 'jud' },
    { activeBook: 'rev', selectedBook: 'rev', selectedVersion: 'rv1909' },
    { activeBook: 'rev', selectedBook: 'rev', selectedVersion: 'rvr60-strong', currentVersion: 'rvr60' }
]) {
    const fixture = selectionFixture(options);
    // A reused menu can already contain the button from a previous selection.
    fixture.controls.set('[data-action="commentary-for-selection"]', { hidden: false });
    showSelectionPanelForVerse.call(fixture.state);
    assert.equal(fixture.controls.get('[data-action="commentary-for-selection"]').hidden, true,
        'The selection menu must not offer another book or a stale version: ' + JSON.stringify(options));
    assert.equal(openBibleCommentary.call(fixture.state, fixture.anchor), false);
    assert.equal(fixture.opened, null, 'Invalid selection must not silently fall back to the visible Apocalipsis passage');
}
const toolbarOutside = selectionFixture({ activeBook: 'jud', selectedBook: 'rev', action: 'open-bible-commentary' });
assert.equal(openBibleCommentary.call(toolbarOutside.state, toolbarOutside.anchor), false, 'The reader toolbar still follows the active book');
const toolbarApocalypse = selectionFixture({ activeBook: 'rev', selectedBook: 'jud', action: 'open-bible-commentary' });
assert.equal(openBibleCommentary.call(toolbarApocalypse.state, toolbarApocalypse.anchor), true);
assert.deepEqual(JSON.parse(JSON.stringify(toolbarApocalypse.opened.range)),
    { start: { bookId: 'rev', chapter: 1, verse: 7 }, end: { bookId: 'rev', chapter: 1, verse: 7 } });
console.log('OK: real app selection/menu follows selected book/version at Judas–Apocalipsis boundary; toolbar follows active book; draft and stale-close restoration are preserved');

// A delayed Judas prepend must not interact with a centered smooth scroll.
const targetScrollProperty = appObject.properties.find(item => item.key.name === 'scrollToTargetVerse');
assert(targetScrollProperty);
const targetScrollSource = '(' + appSource.slice(targetScrollProperty.value.start, targetScrollProperty.value.end) + ')';
function targetScrollFixture() {
    const timers = [];
    const scrolls = [];
    let nextTimerId = 0;
    let readerUpdates = 0;
    let documentVerseTop = 900;
    const viewport = { scrollY: 300 };
    const header = { getBoundingClientRect: () => ({ bottom: 160 }) };
    const verses = new Map(Array.from({ length: 20 }, (_, i) => [i + 1, {
        isConnected: true, classList: classList(),
        getBoundingClientRect: () => ({ top: documentVerseTop + i * 70 - viewport.scrollY,
            bottom: documentVerseTop + i * 70 + 45 - viewport.scrollY }),
        scrollIntoView() { assert.fail('Target navigation must not start a smooth/centered scroll while chapters are prepended'); }
    }]));
    const shell = { isConnected: true, querySelector(selector) {
        const number = Number(selector.match(/data-verse-number="(\d+)"/)?.[1]);
        return verses.get(number) || null;
    } };
    const content = { querySelector(selector) {
        if (selector === '.bible-reader-fixed-header') return header;
        if (selector.includes('data-reading-date')) {
            assert(selector.includes(createBibleReadingKey('rvr60', 'rev', 1)), 'Target lookup keeps the requested reading identity');
            return shell;
        }
        return shell.querySelector(selector);
    } };
    const applyScroll = (method, options) => {
        assert.equal(typeof options, 'object');
        assert.notEqual(options.behavior, 'smooth', 'Prepending chapters must not race an animated target scroll');
        scrolls.push({ method, ...options });
        viewport.scrollY = method === 'scrollBy' ? viewport.scrollY + options.top : options.top;
    };
    viewport.scrollBy = options => applyScroll('scrollBy', options);
    viewport.scrollTo = options => applyScroll('scrollTo', options);
    const schedule = (callback, delay = 0) => {
        const timer = { id: ++nextTimerId, callback, delay, cancelled: false, executed: false };
        timers.push(timer); return timer.id;
    };
    const cancel = id => { const timer = timers.find(item => item.id === id); if (timer) timer.cancelled = true; };
    const vmContext = vm.createContext({ createBibleReadingKey, window: viewport,
        document: { querySelector: selector => selector === '.bible-reader-fixed-header' ? header : content.querySelector(selector) },
        setTimeout: schedule, clearTimeout: cancel, requestAnimationFrame: callback => schedule(callback), cancelAnimationFrame: cancel });
    const run = vm.runInContext(targetScrollSource, vmContext);
    const state = { currentView: 'bible-reading', currentBibleVersion: 'rvr60', _bibleReaderEpoch: 7,
        selectedBibleBook: 'rev', selectedBibleChapter: 1,
        targetVerse: 1, targetVerseStart: 1, targetVerseEnd: 2,
        $content: content, continuousReader: { update() { readerUpdates++; } }, scrollWindowInstantly(top) { applyScroll('scrollTo', { top, behavior: 'instant' }); } };
    function flushNavigation() {
        for (let pass = 0; pass < 10; pass++) {
            const pending = timers.filter(timer => !timer.cancelled && !timer.executed && timer.delay < 1000);
            if (!pending.length) return;
            for (const timer of pending) { timer.executed = true; timer.callback(); }
        }
        assert.fail('Target scroll scheduling must settle');
    }
    return { state, run, timers, verses, scrolls, viewport, flushNavigation,
        get readerUpdates() { return readerUpdates; },
        prepend(height) { documentVerseTop += height; } };
}
{
    const fixture = targetScrollFixture();
    fixture.run.call(fixture.state);
    fixture.prepend(1400);
    fixture.flushNavigation();
    assert.equal(fixture.verses.get(1).getBoundingClientRect().top, 176,
        'After a delayed previous-book prepend, the target verse must align exactly below header + 16px');
    assert.equal(fixture.scrolls.length, 1);
    assert.equal(fixture.readerUpdates, 1, 'The continuous reader must refresh its active passage after the instant jump');
    assert.equal(fixture.verses.get(1).classList.contains('highlight-temporary'), true);
    assert.equal(fixture.verses.get(2).classList.contains('highlight-temporary'), true);
    assert.equal(fixture.verses.get(3).classList.contains('highlight-temporary'), false);
    assert.deepEqual([fixture.state.targetVerse, fixture.state.targetVerseStart, fixture.state.targetVerseEnd], [null, null, null]);
    for (const timer of fixture.timers.filter(timer => !timer.cancelled && timer.delay >= 1000)) timer.callback();
    assert.equal(fixture.verses.get(1).classList.contains('highlight-temporary'), false);
    assert.equal(fixture.verses.get(2).classList.contains('highlight-temporary'), false);
}
for (const [property, replacement] of [['currentView', 'home'], ['currentBibleVersion', 'rvr60-strong'], ['_bibleReaderEpoch', 8]]) {
    const fixture = targetScrollFixture();
    fixture.run.call(fixture.state);
    fixture.state[property] = replacement;
    fixture.state.targetVerse = 8; fixture.state.targetVerseStart = 8; fixture.state.targetVerseEnd = 9;
    fixture.flushNavigation();
    assert.equal(fixture.scrolls.length, 0, 'Stale callback must not scroll after ' + property + ' changes');
    assert.deepEqual([fixture.state.targetVerse, fixture.state.targetVerseStart, fixture.state.targetVerseEnd], [8, 8, 9],
        'Stale callback must not clear the next navigation target after ' + property + ' changes');
    assert.equal(fixture.verses.get(1).classList.contains('highlight-temporary'), false);
}
{
    const fixture = targetScrollFixture();
    fixture.run.call(fixture.state);
    const oldTimer = fixture.timers.find(timer => timer.delay < 1000);
    assert(oldTimer, 'Target navigation should schedule its DOM-dependent positioning');
    fixture.state.targetVerse = 8; fixture.state.targetVerseStart = 8; fixture.state.targetVerseEnd = 9;
    // Notebook references can schedule a second target in the same reader epoch.
    fixture.run.call(fixture.state);
    assert.equal(oldTimer.cancelled, true, 'Scheduling a new target must cancel the pending earlier navigation timer');
    oldTimer.callback(); // Simulate a callback already queued by the browser.
    assert.equal(fixture.scrolls.length, 0);
    assert.deepEqual([fixture.state.targetVerse, fixture.state.targetVerseStart, fixture.state.targetVerseEnd], [8, 8, 9]);
    fixture.flushNavigation();
    assert.equal(fixture.verses.get(8).getBoundingClientRect().top, 176);
    assert.equal(fixture.scrolls.length, 1);
}
console.log('OK: real target scroll anchors below header after delayed prepend, rejects stale view/version/epoch and superseded targets, cancels prior timers and keeps temporary highlighting');

if (process.argv.includes('--browser')) {
    const modulePath = process.env.PLAYWRIGHT_MODULE;
    assert(modulePath, 'Set PLAYWRIGHT_MODULE to a local Playwright installation for browser checks.');
    const { chromium } = await import(pathToFileURL(modulePath));
    const fixture = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/css/deepening-shell.css"><link rel="stylesheet" href="/css/meditation-actions-panel.css"><link rel="stylesheet" href="/css/commentary-panel.css"><style>body{margin:0;font-family:Arial,sans-serif}#app-content{padding:32px;min-height:1800px}#bible-trigger{position:fixed;top:12px;left:12px;min-height:44px;z-index:1}.fixture-text{padding-top:80px;max-width:700px;line-height:2}#deepening-root{--safe-area-top:0px}button{font:inherit}</style><div id="app-content"><button id="bible-trigger">Comentario</button><p class="fixture-text" id="bible-text">Texto de prueba para conservar la selección bíblica al consultar el comentario.</p></div><div id="already-inert" inert></div><div id="deepening-root" hidden></div>
    <script src="/js/ReadingDocument.js"></script><script src="/js/DocumentFactory.js"></script><script src="/js/MeditationDocument.js"></script><script src="/js/MeditationActionsPanel.js"></script><script src="/js/KeyboardViewportManager.js"></script><script src="/js/KeyboardManager.js"></script><script src="/js/DeepeningShell.js"></script>
    <script type="module">
    import {CommentaryPanel,parseCommentaryReference} from '/js/bible/CommentaryPanel.js';
    import {commentaryRepository} from '/js/bible/CommentaryRepository.js';
    const panel=new CommentaryPanel({repository:commentaryRepository});
    const range=parseCommentaryReference('Apocalipsis 11:15–12:6');
    const trigger=document.querySelector('#bible-trigger');
    trigger.addEventListener('pointerdown',event=>event.preventDefault());
    trigger.addEventListener('click',()=>panel.open({anchor:trigger,range}));
    window.fixture={panel,repository:commentaryRepository,range,CommentaryPanel, saved:[],
      mount(){return window.DeepeningShell.mount({
        reading:{date:'2026-12-05',reference:'Apocalipsis 11:15–12:6'},
        readingHtml:Array.from({length:24},(_,i)=>'<p class="verse-item" data-verse-number="'+(i+1)+'">'+(i+1)+'. Lectura de prueba para comprobar la posición de lectura y el comentario.</p>').join(''),
        versions:[{id:'rvr60',label:'RVR60'},{id:'ntv',label:'NTV'},{id:'tla',label:'TLA'}],currentVersion:'rvr60',
        initialNote:{dios:'Mi reflexión de prueba permanece aquí.',aprendizaje:'',respuesta:'',oracion:''},
        onAutoSave:(note)=>{if(note)window.fixture.saved.push(note)},
        onCommentaryOpen:({anchor,onClose})=>panel.open({anchor,range,mountRoot:document.getElementById('deepening-root'),returnLabel:'Seguir meditando',onClose,isCurrent:()=>window.DeepeningShell.isMounted()}),
        onCommentaryClose:()=>panel.close({restoreFocus:false}),
        onVoiceToggle:()=>{},getVoiceState:()=>({status:'idle'})
      })}
    };
    </script></html>`;
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
    const server = http.createServer((req, res) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return; }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.url === '/__commentary_ui_fixture__') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture); return; }
        const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (!/^(?:\/js\/|\/css\/|\/assets\/fonts\/)/.test(name) && name !== '/data/commentaries/hendriksen-apocalipsis.json') {
            res.writeHead(404).end(); return;
        }
        const file = path.resolve(root, '.' + name);
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        try { res.setHeader('Content-Type', mime[path.extname(file)] || 'text/plain'); res.end(fs.readFileSync(file)); }
        catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = 'http://127.0.0.1:' + server.address().port;
    assert.equal((await fetch(baseUrl + '/README.md')).status, 404);
    assert.equal((await fetch(baseUrl + '/android/keystore.properties')).status, 404);
    assert.equal((await fetch(baseUrl + '/__commentary_ui_fixture__', { method: 'POST' })).status, 405);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
    const errors = [];
    const artifacts = path.join(root, 'artifacts/validation/commentary-ui');
    fs.mkdirSync(artifacts, { recursive: true });
    try {
        for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
            const page = await browser.newPage({ viewport });
            page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
            await page.goto('http://127.0.0.1:' + server.address().port + '/__commentary_ui_fixture__');
            await page.waitForFunction(() => Boolean(window.fixture));
            await page.evaluate(() => window.fixture.mount());
            const editor = page.locator('[data-deepening-editor]');
            await editor.fill('Mi reflexión escrita debe conservarse al consultar Hendriksen.');
            const before = await page.evaluate(() => {
                const editor=document.querySelector('[data-deepening-editor]');
                editor.focus();const selection=window.getSelection();const range=document.createRange();
                range.setStart(editor.firstChild,15);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
                const reading=document.querySelector('[data-deepening-reading-document]');reading.scrollTop=120;
                return {html:editor.innerHTML,offset:selection.anchorOffset,readingScroll:reading.scrollTop};
            });
            await page.locator('[data-deepening-commentary]').click();
            await page.waitForSelector('.commentary-article');
            assert.equal(await page.locator('#deepening-root > .commentary-overlay').count(), 1);
            assert.equal(await page.locator('.commentary-overlay').evaluate(element => Boolean(element.closest('[inert]'))), false);
            assert.deepEqual(await page.locator('[data-commentary-select] option').evaluateAll(options => options.map(option => option.value)), ['hendriksen-x-g','hendriksen-xi-a']);
            const select=page.locator('[data-commentary-select]');await select.focus();await select.selectOption('hendriksen-xi-a');
            assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-commentary-select')), true);
            assert.equal(await page.locator('.commentary-article').getAttribute('aria-label'), pkg.entries.find(entry=>entry.id==='hendriksen-xi-a').title);
            await page.screenshot({path:path.join(artifacts,viewport.width+'-passage.png')});
            const bounds=await page.locator('.commentary-panel').boundingBox();
            assert(bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=viewport.width+1 && bounds.y+bounds.height<=viewport.height+1, 'Panel must fit the viewport');
            assert.equal(await page.evaluate(()=>document.querySelector('.commentary-panel').scrollWidth<=document.querySelector('.commentary-panel').clientWidth),true);
            await page.keyboard.press('Escape');
            const restored=await page.evaluate(()=>({mounted:window.DeepeningShell.isMounted(),html:document.querySelector('[data-deepening-editor]').innerHTML,focused:document.activeElement.hasAttribute('data-deepening-editor'),offset:window.getSelection().anchorOffset,readingScroll:document.querySelector('[data-deepening-reading-document]').scrollTop}));
            assert.equal(restored.mounted,true,'Escape must close only the commentary');assert.equal(restored.html,before.html);assert.equal(restored.focused,true);assert.equal(restored.offset,before.offset);assert.equal(restored.readingScroll,before.readingScroll);
            await page.locator('[data-deepening-commentary]').click();await page.waitForSelector('.commentary-article');
            await page.locator('[data-commentary-action="contents"]').click();await page.waitForSelector('.commentary-index');
            await page.locator('[data-index-group="hendriksen-ii"] > summary').click();
            await page.locator('[data-entry-id="hendriksen-ii"]').click();
            assert.equal(await page.locator('.commentary-subsections button').count()>0,true);
            await page.locator('[data-commentary-action="contents"]').click();
            assert.equal(await page.locator('[data-index-group="hendriksen-ii"]').getAttribute('open'),'');
            await page.locator('[data-index-group="edition"] > summary').click();
            assert.equal(await page.locator('[data-entry-id="front-p006"]').count(),0,'Blank page must not be an empty navigation destination');
            await page.locator('[data-entry-id="front-p001"]').click();
            assert.match(await page.locator('.commentary-prose').innerText(),/WILLIAM HENDRIKSEN/);
            await page.locator('[data-commentary-select]').selectOption(pkg.entries.find(entry=>entry.assetIds?.length).id);
            const image=page.locator('.commentary-figure img');await image.scrollIntoViewIfNeeded();
            await page.waitForFunction(()=>document.querySelector('.commentary-figure img')?.naturalWidth>0);
            await page.screenshot({path:path.join(artifacts,viewport.width+'-diagram.png')});
            await page.locator('[data-commentary-action="passage"]').click();
            assert.equal(await page.locator('[data-commentary-select]').inputValue(),'hendriksen-x-g');
            await page.locator('.commentary-footer button').click();
            assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-deepening-editor')),true);
            await page.evaluate(()=>window.DeepeningShell.unmount());
            await page.waitForFunction(()=>!window.DeepeningShell.isMounted());
            await page.evaluate(()=>{const text=document.querySelector('#bible-text').firstChild;const range=document.createRange();range.setStart(text,0);range.setEnd(text,15);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);window.scrollTo(0,250)});
            const nativeBefore=await page.evaluate(()=>({text:window.getSelection().toString(),scroll:window.scrollY}));
            await page.locator('#bible-trigger').click();await page.waitForSelector('.commentary-article');
            await page.keyboard.press('Escape');
            assert.deepEqual(await page.evaluate(()=>({text:window.getSelection().toString(),scroll:window.scrollY})),nativeBefore);
            assert.equal(await page.locator('#already-inert').evaluate(element=>element.inert),true);
            const asyncResult=await page.evaluate(async()=>{
                const {CommentaryPanel,range,repository}=window.fixture;const anchor=document.querySelector('#bible-trigger');
                let resolve;const promise=new Promise(done=>resolve=done);let current=true;
                const delayed=new CommentaryPanel({repository:{getForRange:()=>promise}});
                const opening=delayed.open({anchor,range,isCurrent:()=>current});current=false;resolve(await repository.getForRange(range));await opening;
                const staleClosed=!delayed.state && !document.querySelector('.commentary-overlay');
                let resolve2;const late=new CommentaryPanel({repository:{getForRange:()=>new Promise(done=>resolve2=done)}});
                const lateOpen=late.open({anchor,range});late.close();resolve2(await repository.getForRange(range));await lateOpen;
                let attempts=0;const retry=new CommentaryPanel({repository:{getForRange:()=>++attempts===1?Promise.reject(new Error('offline')):repository.getForRange(range)}});
                await retry.open({anchor,range});const errorShown=Boolean(retry.state.panel.querySelector('[data-commentary-action="retry"]'));
                await retry.loadPassage();const recovered=Boolean(retry.state.panel.querySelector('.commentary-article'));retry.close();
                return {staleClosed,lateClosed:!late.state,errorShown,recovered};
            });
            assert.deepEqual(asyncResult,{staleClosed:true,lateClosed:true,errorShown:true,recovered:true});
            await page.close();
            console.log('OK: browser '+viewport.width+'×'+viewport.height+' — passage, book, figure, focus/caret, native selection, draft, scroll, stale requests and retry');
        }
        assert.deepEqual(errors,[],'Browser errors');
    } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
}
