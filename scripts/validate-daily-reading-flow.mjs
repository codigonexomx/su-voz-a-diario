import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { readingIcon } from '../js/utils/readingIcons.js';
import { getIntroVideoConfig, shouldShowIntroVideo } from '../js/core/constants.js';

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, predicate) {
    if (predicate(node)) return node;
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
        if (child?.type) { const match = find(child, predicate); if (match) return match; }
    }
}
const context = vm.createContext({ window: { speechSynthesis: {} }, document: {},
    SpeechSynthesisUtterance: class {}, readingIcon, getIntroVideoConfig, shouldShowIntroVideo });
function method(name) {
    const node = find(tree, item => item.type === 'Property' && item.key.name === name);
    assert(node, name);
    return vm.runInContext(`(${source.slice(node.value.start, node.value.end)})`, context);
}
context.renderIntroVideoHtml = config => `<section class="intro-video-card">${config.title} Video visible</section>`;
const app = {
    $content: { innerHTML: '' }, data: [{}, {}], currentView: 'home',
    getTodayDateStr: () => '2026-10-24', getHomeViewingDate: () => app.date,
    getReadingByDate: async date => ({ date, reference: '2 Pedro 1:1-11' }),
    getReadingIndexByDate: () => 0, formatDateEs: date => date,
    stopDailyReadingVoice: () => {}, getDailyReadingText: () => 'Pasaje de prueba',
    getProgresoLibroVisual: () => '<aside>Avance del libro</aside>',
    renderDailyReadingBibleContext: () => '<button data-action="open-daily-bible">Ver en Biblia</button>',
    renderViewHeader: () => '<header>Portada</header>',
    renderDailyVersionSelector: () => '<div>Versiones</div>',
    renderReadingFontPicker: () => '<fieldset>Fuentes</fieldset>',
    renderDailyQuestionCardHtml: () => '<section>Pregunta del dia</section>',
    renderVerseText: value => value, renderDailyReadingCopyright: () => 'Derechos conservados',
    escapeHtml: value => value, isRead: () => false,
    isNativeTextToSpeechAvailable: () => false, dailyReadingVoice: { status: 'idle', date: null },
    restoreHighlightsInDOMForVerses: () => {}, restoreSelectionNotesInDOM: () => {},
    trackReadingVisible: () => {}, trackDailyQuestionVisible: () => {},
};
for (const name of ['renderHome', 'renderViewContent', 'renderDailyReadingEntry',
    'renderDailyReadingActions', 'renderDailyReadingVoiceControl']) app[name] = method(name);
for (const date of ['2026-10-24', '2026-10-25', '2026-10-28']) {
    app.date = date;
    await app.renderHome();
    const html = app.$content.innerHTML;
    const text = html.indexOf('class="reading-text-shell"');
    assert(html.indexOf('daily-reading-entry-actions') < text);
    assert(html.indexOf('Versiones') < text);
    assert(html.indexOf('Fuentes') < text);
    assert(html.indexOf('data-action="toggle-note"') < text);
    assert(!html.includes('data-action="read-passage"'));
    assert(!html.includes('Avance del libro'));
    assert(html.indexOf('data-action="open-daily-bible"') < html.indexOf('daily-reading-entry-actions'));
    assert.equal((html.match(/data-action="toggle-note"/g) || []).length, 1);
    assert.equal((html.match(/data-action="daily-reading-voice-toggle"/g) || []).length, 1);
    assert.equal((html.match(/<h2/g) || []).length, 1, 'One passage heading, no duplicate reference heading');
    assert.equal(html.includes('intro-video-card'), date !== '2026-10-28');
    if (date !== '2026-10-28') assert(html.indexOf('intro-video-card') < html.indexOf('daily-reading-flow'));
    assert(!html.includes('<details'), 'The video stays visible, without a disclosure');
    assert(html.includes('Derechos conservados'));
}

let focused = 0, scrolled = 0, resets = 0;
const passage = { getAttribute: () => '2026-10-24', focus: () => focused++, scrollIntoView: () => scrolled++ };
const reader = { $content: { querySelectorAll: () => [passage] },
    stopIntroVideo: () => { resets++; },
    getReadingMetadataByDate: date => ({ date }), trackAnalyticsOnce: () => {}, getReadingAnalyticsParams: () => ({}) };
method('startReadingPassage').call(reader, '2026-10-23');
assert.equal(resets, 0);
method('startReadingPassage').call(reader, '2026-10-24');
assert.equal(focused, 1); assert.equal(scrolled, 1); assert.equal(resets, 1);

const tapNode = find(tree, item => item.type === 'IfStatement' && item.test.name === 'dailyReadingVoiceToggleBtn');
const tap = vm.runInContext(`(async function(){${source.slice(tapNode.start, tapNode.end)}})`, context);
let follows = 0, toggles = 0;
const voice = { getReadingByDate: async () => ({}), getCleanDailyReadingText: () => 'Texto',
    getDailyReadingText: () => 'Texto',
    startReadingPassage: () => follows++, pauseOrResumeDailyReadingVoice: () => toggles++ };
context.dailyReadingVoiceToggleBtn = { getAttribute: () => '2026-10-24', closest: () => true };
for (const status of ['idle', 'speaking', 'paused']) {
    voice.dailyReadingVoice = { date: '2026-10-24', status };
    await tap.call(voice);
}
assert.equal(follows, 1, 'Only a fresh start moves to the passage; pause/resume preserve the reading position');
assert.equal(toggles, 3);
context.dailyReadingVoiceToggleBtn.closest = () => false;
voice.dailyReadingVoice = { date: null, status: 'idle' };
await tap.call(voice);
assert.equal(follows, 1, 'Other audio surfaces do not scroll the daily view');

let rendered = 0;
context.renderIntroVideoHtml = () => { rendered++; return '<div>Poster restaurado</div>'; };
const card = { dataset: { introDate: '2026-10-24' }, querySelector: () => ({}), outerHTML: '' };
const videoHost = { $content: { querySelector: () => card } };
const reset = method('stopIntroVideo');
reset.call(videoHost); assert.equal(rendered, 1);
assert.equal(card.outerHTML, '<div>Poster restaurado</div>');
card.querySelector = () => null; reset.call(videoHost); assert.equal(rendered, 1);
videoHost.$content.querySelector = () => null; reset.call(videoHost); assert.equal(rendered, 1);

const labels = { textContent: '' };
const icon = {};
const stop = { disabled: true };
const button = { querySelector: selector => selector.includes('icon') ? icon : labels, setAttribute: () => {} };
const control = { getAttribute: name => name === 'data-voice-compact' ? 'true' : '2026-10-24',
    querySelector: selector => selector.includes('toggle') ? button : stop };
context.document = { dispatchEvent: () => {}, querySelector: () => control };
context.CustomEvent = class {};
const update = method('updateDailyReadingVoiceUI');
for (const [status, label] of [['speaking', 'Pausar'], ['paused', 'Continuar'], ['idle', 'Escuchar']]) {
    update.call({ dailyReadingVoice: { date: '2026-10-24', status }, updateDailyReadingVoicePosition: () => {} });
    assert.equal(labels.textContent, label);
    assert.equal(stop.disabled, status === 'idle');
}
console.log('OK: today/history order, one Meditation beside audio before the text, visible introduction, fixed controls, first-play focus without resume jumps, video teardown and preserved reading state');

const bibleContext = { bibleBooks: [{ id: '2pe', name: '2 Pedro', chapters: 3 }, { id: 'psa', name: 'Salmos', chapters: 150 }],
    getLibroActual: () => null, escapeHtml: value => value };
for (const name of ['getBibleBookAliases', 'normalizeBibleWord', 'parseBibleReferenceQuery',
    'getDailyReadingBibleContext', 'renderDailyReadingBibleContext']) bibleContext[name] = method(name);
const scripture = { date: '2026-10-24', reference: '2 Pedro 1:1-11' };
assert.equal(bibleContext.getDailyReadingBibleContext(scripture).chapter, 1);
assert.equal(bibleContext.getDailyReadingBibleContext({ ...scripture, reference: 'Salmo 119:1-8' }).book.chapters, 150);
assert.equal(bibleContext.getDailyReadingBibleContext({ ...scripture, reference: '2 Pedro 1:12–2:3', bookId: '2pe' }).chapter, 1);
for (const reference of ['2 Pedro', '2 Pedro 4:1-3', 'Sin referencia']) {
    assert.equal(bibleContext.getDailyReadingBibleContext({ ...scripture, reference }), null);
}
const shortcut = bibleContext.renderDailyReadingBibleContext(scripture);
assert(shortcut.includes('Capítulo 1 de 3')); assert(shortcut.includes('Ver en Biblia'));
assert(shortcut.includes('Leer 2 Pedro 1 completo en Biblia')); assert(!shortcut.includes('%'));
assert.equal((bibleContext.renderDailyReadingBibleContext({ ...scripture, reference: 'Salmo 119:1-8' }).match(/<button/g) || []).length, 1,
    'Long books use the same compact link, not a row of 150 chapter controls');

let openedChapter, restoredScroll = null, returnFocus = 0, introStops = 0;
context.window = { scrollY: 420, location: { hash: '#home' } };
context.history = { pushState: (_, __, hash) => { context.window.location.hash = hash; } };
context.requestAnimationFrame = fn => fn();
Object.assign(bibleContext, { currentView: 'home', homeViewingDate: scripture.date,
    getHomeViewingDate() { return this.homeViewingDate; }, getReadingMetadataByDate: () => scripture,
    stopIntroVideo: () => introStops++, navigateToVerse: (...args) => { openedChapter = args; },
    $content: { querySelectorAll: () => [{ getAttribute: () => scripture.date, focus: () => returnFocus++ }] },
    scrollWindowInstantly: value => { restoredScroll = value; }, handleRoute: async () => {}, showToast: () => {} });
assert.equal(method('openDailyBibleChapter').call(bibleContext, '2026-10-23'), false);
assert.equal(method('openDailyBibleChapter').call(bibleContext, scripture.date), true);
assert.deepEqual(openedChapter, ['2pe', 1, null]); assert.equal(introStops, 1);
const chapterNavigation = { bibleBooks: bibleContext.bibleBooks, bibleApiIdMap: {}, currentView: 'home',
    targetVerse: 9, targetVerseStart: 9, targetVerseEnd: 10,
    saveBibleLastLocation: () => {}, navigate: view => { assert.equal(view, 'bible-reading'); } };
method('navigateToVerse').apply(chapterNavigation, openedChapter);
assert.equal(chapterNavigation.selectedBibleBook, '2pe');
assert.equal(chapterNavigation.selectedBibleChapter, 1);
assert.equal(chapterNavigation.targetVerse, null, 'A whole chapter opens at its heading, not a centered verse that can activate the previous chapter');
assert.equal(chapterNavigation.targetVerseStart, null);
assert.equal(chapterNavigation.targetVerseEnd, null);
const destination = bibleContext.bibleStudyReturn;
assert.equal(destination.date, scripture.date); assert.equal(destination.scrollY, 420);
assert.equal(await method('returnToDailyReadingContext').call(bibleContext, destination), true);
assert.equal(restoredScroll, 420); assert.equal(returnFocus, 1); assert.equal(bibleContext.bibleStudyReturn, null);
const historical = { ...destination, originView: 'reading', scrollY: 250 };
await method('returnToDailyReadingContext').call(bibleContext, historical);
assert.equal(context.window.location.hash, '#reading/2026-10-24'); assert.equal(restoredScroll, 250);
bibleContext.handleRoute = async () => { context.window.location.hash = '#calendar'; };
restoredScroll = null;
assert.equal(await method('returnToDailyReadingContext').call(bibleContext, destination), false);
assert.equal(restoredScroll, null, 'A late return must not scroll a different page');
let forwarded;
method('returnToBibleStudy').call({ bibleStudyReturn: destination, returnToDailyReadingContext: value => { forwarded = value; } });
assert.equal(forwarded, destination);
console.log('OK: compact chapter context for short/long books, exact full chapter, unchanged Bible version, and same-date/scroll/focus return with stale-route guard');
