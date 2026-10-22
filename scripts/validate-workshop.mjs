import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { WORKSHOP_LESSONS as lessons, WORKSHOP_PASSAGES as passages, WORKSHOP_SOURCES as sources,
    WORKSHOP_SUPPORT as support, WORKSHOP_CASE_HELP as caseHelp, WORKSHOP_GROUP_STEPS as groupSteps } from '../js/workshop/WorkshopContent.js';
import { WORKSHOP_KEY, createWorkshopState, loadWorkshop, saveWorkshop, validateWorkshopState, mergeWorkshopStates, getWorkshopPassage } from '../js/services/WorkshopStorage.js';
import { renderWorkshop, advisorUrls, ADVISOR_EMAIL } from '../js/workshop/WorkshopView.js';
import { getWorkshopReturnHref, mountWorkshop } from '../js/workshop/WorkshopController.js';
import { WorkshopScripture, WORKSHOP_BIBLE_VERSION } from '../js/workshop/WorkshopScripture.js';
import { LocalRv1909Provider } from '../js/bible/LocalRv1909Provider.js';
import { exportJourney, restoreJourney, validateJourneyBackup } from '../js/services/JourneyService.js';
import { readingIcon } from '../js/utils/readingIcons.js';

class Storage {
    values = new Map(); fail = '';
    get length() { return this.values.size; } key(i) { return [...this.values.keys()][i]; }
    getItem(k) { return this.values.get(k) ?? null; } removeItem(k) { this.values.delete(k); }
    setItem(k,v) { if (this.fail === k) { this.fail = ''; throw Error('quota'); } this.values.set(k, String(v)); }
}
globalThis.document = { createElement: () => ({ textContent: '', get innerHTML() {
    return String(this.textContent).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
} }) };
const rangeFixture = JSON.parse(readFileSync('data/rv1909.json', 'utf8').replace(/^\uFEFF/, ''));
const bookIds = new LocalRv1909Provider();
const chapterRequests = [];
const syntheticChapter = async (versionId, bookId, chapter) => {
    chapterRequests.push({ versionId, bookId, chapter });
    const book = rangeFixture.find(b => bookIds.getCanonicalBookId(b.abbrev) === bookId);
    return { versionId, bookId, chapter, verses: book.chapters[chapter - 1].map((_, i) => ({
        number: i + 1, text: `[NBLA prueba] ${bookId} ${chapter}:${i + 1} [[REF:f:nota%20de%20prueba]]`
    })) };
};
const bible = new WorkshopScripture({ getChapter: syntheticChapter, resolveBookId: id => bookIds.getCanonicalBookId(id) });
let checks = 0;
const check = (value, name) => { assert(value, name); checks++; };
const metaTeaching = /\b(?:taller|manual|adaptaci[oó]n|propuesta|interfaz|m[eé]todo)\b|metodolog|hoja de pr[aá]ctica|complemento b[ií]blico de Su Voz/i;
const retiredLanguage = /\b(?:taller(?:es)?|manual(?:es)?|m[eé]todos?)\b|metodolog/i;
const teachingCopy = [
    ...lessons.flatMap(l => [l.title, l.subtitle, l.block, ...l.text, l.key, l.question, l.facilitator,
        l.quiz.question, ...l.quiz.options, ...l.quiz.feedback]),
    ...Object.values(caseHelp).flat(), ...support.flat().map(([, meaning]) => meaning),
    ...groupSteps.flatMap(s => [s.title, s.text])
];
for (const copy of teachingCopy) check(!metaTeaching.test(copy), `direct teaching, not source commentary: ${copy}`);
const learningSurface = view => view.replace(/<details class="wt-provenance">[\s\S]*?<\/details>/g, '')
    .replace(/<footer class="wt-footer">[\s\S]*?<\/footer>/g, '');
const checkLearningSurface = view => {
    check(!metaTeaching.test(learningSurface(view)), 'source commentary confined to sources and credits');
    check(!retiredLanguage.test(view), 'no retired language anywhere, including hidden sources, credits and quiz feedback');
    check(view.includes('Meditación Bíblica México') && view.includes('Lee Jeong Book'), 'attribution preserved');
    check(view.includes('<p class="wt-tagline">Aprender a meditar</p>')
        && view.includes('<p class="wt-eyebrow">Vivir la Palabra</p>'), 'approved section title and supporting phrase on every page');
    check(!view.includes('Mi camino') && !view.includes('href="#stats"'), 'no retired personal-journey shortcut in learning views');
};
check(lessons.length === 8, 'eight lessons');
check(Object.keys(passages).length === 80, 'all references');
check(Object.values(passages).filter(p => p.origin === 'manual').length === 76, 'manual and clarified reference');
check(Object.values(passages).filter(p => p.origin === 'complemento').length === 4, 'complements identified');
let verses = 0, combinations = 0;
for (const [id, p] of Object.entries(passages)) {
    const value = await bible.load(id); verses += value.verses.length;
    check(value.verses.length > 0 && value.verses.every(v => v.text), id);
    check(value.versionId === 'nbla' && value.verses.every(v => v.text.startsWith('[NBLA prueba]') && !v.text.includes('[[REF:')), 'NBLA response only, without study markers');
    check(value.verses.map(v => v.number).join() === getWorkshopPassage(id, rangeFixture).verses.map(v => v.number).join(), 'reference coordinates unchanged');
    check(!/(^|;\s*)Pedro\b/.test(p.reference), 'qualified Pedro reference');
    check(p.origin === (p.pages ? 'manual' : 'complemento'), 'source provenance');
}
check(verses === 475, 'complete literal verse ranges');
check(passages.santidad.reference === '1 Pedro 1:15-16' && passages.santidad.clarification.includes('no una corrección confirmada'), 'editorial clarification');
assert.throws(() => getWorkshopPassage('invented', rangeFixture));
await assert.rejects(() => bible.load('invented'));
check(WORKSHOP_BIBLE_VERSION === 'nbla' && chapterRequests.every(r => r.versionId === 'nbla'), 'all requests explicitly use NBLA');
const countBeforeCache = chapterRequests.length;
await bible.load('josue');
check(chapterRequests.length === countBeforeCache, 'session passage cache avoids repeat request');
const state = createWorkshopState(), storage = new Storage();
const ui = { page: '', today: '2026-10-22', checked: {}, groupStep: 0, libraryId: 'josue' };
for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    for (const id of sources[i]) {
        state.passages[lesson.id] = id;
        for (let step = 0; step < 3; step++) {
            state.stages[lesson.id] = step;
            const view = renderWorkshop(state, { ...ui, page: lesson.id }, bible);
            check(view.includes('Sustento bíblico') && view.includes(`data-passage="${id}"`) && !view.includes('undefined'), 'lesson/exercise render');
            check(!/Ricardo|autor indicado en la portada|Muestra aislada|Sin conexión a tu cuenta real|Contenido en revisión/.test(view), 'no personal name or demo UI');
            check(view.includes('#reading/2026-10-22?from=workshop'), 'existing daily meditation link');
            check(view.includes('Nueva Biblia de las Américas · NBLA') && !view.includes('Reina-Valera 1909')
                && view.includes('Copyright © 2005 por The Lockman Foundation') && view.includes('https://www.NuevaBiblia.com'), 'correct displayed translation and attribution');
            checkLearningSurface(view);
            check(view.includes('<summary>Fuentes de esta lección</summary>') && view.includes(lesson.source)
                && view.includes(lesson.added) && view.includes(passages[id].reference), 'source and adaptation remain available');
            check(view.includes(passages[id].origin === 'manual' ? 'Material base · Página' : 'Referencia complementaria incorporada por Su Voz'), 'original and additional references identified in sources');
            combinations++;
        }
    }
    const urls = advisorUrls(lesson), gmail = new URL(urls.gmail), mail = new URL(urls.mail);
    check(ADVISOR_EMAIL === 'appsuvoz@gmail.com' && gmail.searchParams.get('to') === ADVISOR_EMAIL && mail.pathname === ADVISOR_EMAIL, 'institutional advisor destination');
    check(gmail.searchParams.get('body').includes(lesson.title) && !gmail.searchParams.get('body').includes('Ricardo'), 'context without personal attribution');
    check(gmail.searchParams.get('body').includes('aprender a meditar la Palabra') && !metaTeaching.test(gmail.searchParams.get('body')), 'advisor contact uses direct language');
    for (let answer = 0; answer < 3; answer++) {
        const view = renderWorkshop(state, { ...ui, page: lesson.id, checked: { [lesson.id]: answer } }, bible);
        check(view.includes(lesson.quiz.feedback[answer]), 'every quiz feedback');
        checkLearningSurface(view);
    }
}
for (const page of ['', 'retomar', 'biblioteca']) checkLearningSurface(renderWorkshop(state, { ...ui, page }, bible));
for (const lesson of lessons) {
    check(!retiredLanguage.test([lesson.source, lesson.basis, lesson.added].join(' ')), 'source metadata uses consistent language');
    checkLearningSurface(renderWorkshop(state, { ...ui, page: lesson.id, saveError: true }, { get: () => ({ error: true }) }));
}
for (let groupStep = 0; groupStep < groupSteps.length; groupStep++) {
    checkLearningSurface(renderWorkshop(state, { ...ui, page: 'comunidad', groupStep }, bible));
}
for (const [id, passage] of Object.entries(passages)) {
    const view = renderWorkshop(state, { ...ui, page: 'biblioteca', libraryId: id }, bible);
    checkLearningSurface(view);
    check(view.includes('<summary>Fuente de esta referencia</summary>') && view.includes(passage.reference)
        && (!passage.clarification || view.includes(passage.clarification)), 'library source and editorial clarification preserved');
}
check(renderWorkshop(createWorkshopState(), ui, bible).includes('Comenzar las lecciones'), 'first learning action');
check(renderWorkshop({ ...state, lastLesson: 'encuentro' }, ui, bible).includes('Continuar aprendiendo'), 'resume learning action');
state.lastLesson = lessons[4].id;
state.reviewed = [lessons[0].id];
state.drafts.aplicacion = { samaritano: { 0: '<script>personal-ficticio</script>' } };
state.passages.aplicacion = 'samaritano'; state.stages.aplicacion = 0;
const rendered = renderWorkshop(state, { ...ui, page: 'aplicacion' }, bible);
check(!rendered.includes('<script>personal-ficticio</script>') && rendered.includes('&lt;script&gt;personal-ficticio'), 'private exercise escaped');
saveWorkshop(storage, state, 100);
check(loadWorkshop(storage).drafts.aplicacion.samaritano[0].includes('personal-ficticio'), 'local persistence');
check(getWorkshopReturnHref(storage) === '#workshop/aplicacion', 'return to exact lesson');
check(!JSON.stringify(advisorUrls(lessons[4])).includes('personal-ficticio'), 'private drafts excluded from advisor link');
const before = storage.getItem(WORKSHOP_KEY); storage.fail = WORKSHOP_KEY;
assert.throws(() => saveWorkshop(storage, { ...state, reviewed: [] }, 101));
check(storage.getItem(WORKSHOP_KEY) === before, 'quota leaves prior state intact');
for (const invalid of [{ ...state, lastLesson: 'bad' }, { ...state, reviewed: ['bad'] }, { ...state, stages: { aplicacion: 3 } },
    { ...state, drafts: { aplicacion: { samaritano: { 0: 'x'.repeat(2001) } } } }, { ...state, drafts: { unknown: {} } },
    { ...state, credentials: 'not-allowed' }, { ...state, passages: { oracion: 'confesion' } }]) assert.throws(() => validateWorkshopState(invalid));
const corrupt = new Storage(); corrupt.setItem(WORKSHOP_KEY, 'not-json');
assert.throws(() => loadWorkshop(corrupt)); check(corrupt.getItem(WORKSHOP_KEY) === 'not-json', 'corruption never replaced');
const backup = exportJourney(storage), restored = new Storage();
check(Boolean(backup.entries[WORKSHOP_KEY]), 'included in full backup');
restoreJourney(restored, backup); restoreJourney(restored, backup);
check(loadWorkshop(restored).drafts.aplicacion.samaritano[0].includes('personal-ficticio'), 'restore and idempotence');
const newer = saveWorkshop(restored, { ...state, drafts: { aplicacion: { samaritano: { 0: 'newer', 1: 'new stage' } } } }, 200);
restoreJourney(restored, backup);
check(loadWorkshop(restored).drafts.aplicacion.samaritano[0] === 'newer', 'older backup cannot overwrite newer exercise');
const merged = mergeWorkshopStates(newer, { ...state, updatedAt: 50, drafts: { aplicacion: { samaritano: { 2: 'other stage' } } } });
check(merged.drafts.aplicacion.samaritano[1] === 'new stage' && merged.drafts.aplicacion.samaritano[2] === 'other stage', 'merge preserves independent drafts');
const rollback = new Storage(); rollback.setItem(WORKSHOP_KEY, before); rollback.fail = 'su-voz-meditation-index';
assert.throws(() => restoreJourney(rollback, exportJourney(restored)));
check(rollback.getItem(WORKSHOP_KEY) === before, 'late backup failure rolls back workshop');
assert.throws(() => validateJourneyBackup({ version: 1, entries: { [WORKSHOP_KEY]: '{"version":1}' } }));
check(renderWorkshop(state, { ...ui, page: 'retomar' }, bible).includes('#workshop/aplicacion'), 'resume actual saved lesson');
const failedBible = { get: () => ({ error: true }) };
check(renderWorkshop(state, { ...ui, page: 'aplicacion' }, failedBible).includes('Reintentar pasaje'), 'per-passage failure retry');
check(renderWorkshop(state, { ...ui, page: 'aplicacion' }, null).includes('Consultando el pasaje NBLA'), 'pending passage does not pretend to be loaded');
for (const change of [data => ({ ...data, versionId: 'rv1909' }), data => ({ ...data, bookId: 'gen' }),
    data => ({ ...data, chapter: 2 }), data => ({ ...data, verses: data.verses.filter(v => v.number !== 8) }),
    data => ({ ...data, verses: [...data.verses, data.verses[0]] }),
    data => ({ ...data, verses: data.verses.map(v => v.number === 8 ? { ...v, text: '' } : v) })]) {
    const invalidBible = new WorkshopScripture({ getChapter: async (...args) => change(await syntheticChapter(...args)), resolveBookId: id => bookIds.getCanonicalBookId(id) });
    await assert.rejects(() => invalidBible.load('josue'));
    check(invalidBible.get('josue').error && !renderWorkshop(state, { ...ui, page: 'biblioteca' }, invalidBible).includes('[NBLA prueba]'), 'wrong or incomplete response never displayed as NBLA');
}
let attempts = 0;
const retryBible = new WorkshopScripture({ resolveBookId: id => bookIds.getCanonicalBookId(id), getChapter: async (...args) => {
    if (++attempts === 1) throw Error('offline');
    return syntheticChapter(...args);
} });
await assert.rejects(() => retryBible.load('josue'));
check(retryBible.get('josue').error, 'offline state retained for retry');
await retryBible.load('josue');
check(!retryBible.get('josue').error && attempts === 2, 'retry recovers without another translation');
let resolveChapter;
const dedupBible = new WorkshopScripture({ resolveBookId: id => bookIds.getCanonicalBookId(id), getChapter: (...args) => new Promise(resolve => {
    resolveChapter = async () => resolve(await syntheticChapter(...args));
}) });
const concurrentA = dedupBible.load('creacion'), concurrentB = dedupBible.load('creacion');
await new Promise(resolve => setImmediate(resolve));
await resolveChapter(); await Promise.all([concurrentA, concurrentB]);
check(dedupBible.get('creacion').verses.length === 3 && dedupBible.pending.size === 0 && dedupBible.chapters.size === 0, 'concurrent passage requests coalesce and release pending work');
const controller = readFileSync('js/workshop/WorkshopController.js', 'utf8');
check(!/m[eé]tod|metodolog/i.test(controller), 'no method language in interactive feedback');
check(readFileSync('js/app.js', 'utf8').includes("querySelector('.home-hero-stage .view-hero') || this.$content"), 'return link inside hero, not under its negative margin');
check(!/analytics|firebase|sendMessage|sendEmail/.test(controller), 'no notes sent to external services');
check(controller.includes('active = false') && controller.includes('removeEventListener'), 'cleanup and stale request guard');
check(controller.includes("details:not([open])") && controller.includes("listen('toggle'") && controller.includes('host.contains(slot)'), 'closed support passages load on demand and stale slots are ignored');
const originalDocument = globalThis.document;
globalThis.document = { activeElement: null, createElement: () => {
    let text = '', html = '';
    return { dataset: {}, setAttribute() {}, remove() {}, set textContent(v) { text = String(v); html = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); },
        get textContent() { return text; }, get innerHTML() { return html; }, set innerHTML(v) { html = v; } };
} };
globalThis.window = { scrollY: 0 };
globalThis.fetch = async () => ({ ok: false });
const live = new Storage(); globalThis.localStorage = live;
const listeners = new Map();
const host = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null,
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
const app = { $content: host, getTodayDateStr: () => '2026-10-22', scrollWindowInstantly() {} };
live.setItem(WORKSHOP_KEY, 'corrupt');
let mounted = mountWorkshop(app, 'encuentro');
check(host.innerHTML.includes('Tus datos anteriores no se han reemplazado'), 'corruption visible in controller');
mounted.destroy(); mounted = mountWorkshop(app, 'proposito');
check(live.getItem(WORKSHOP_KEY) === 'corrupt', 'navigation never overwrites a corrupt record');
mounted.destroy(); check(listeners.size === 0, 'all handlers removed on exit');
await new Promise(resolve => setImmediate(resolve));
const quotaApp = { ...app, workshopStorageBlocked: false, workshopMemoryState: null };
live.removeItem(WORKSHOP_KEY); live.fail = WORKSHOP_KEY;
mounted = mountWorkshop(quotaApp, 'aplicacion');
check(Boolean(quotaApp.workshopMemoryState), 'quota failure retains unsaved state in memory');
mounted.destroy(); mounted = mountWorkshop(quotaApp, 'oracion');
check(loadWorkshop(live).lastLesson === 'oracion', 'retry succeeds after transient storage failure');
mounted.destroy();
await new Promise(resolve => setImmediate(resolve));
const deferredChapters = new Map(), slotListeners = new Map();
const delayedBible = new WorkshopScripture({ resolveBookId: id => bookIds.getCanonicalBookId(id),
    getChapter: (...args) => new Promise(resolve => deferredChapters.set(args[1], async () => resolve(await syntheticChapter(...args)))) });
let slot, hostMarkup = '';
const slotHost = {
    set innerHTML(value) {
        hostMarkup = value;
        const id = value.match(/data-workshop-passage="([^"]+)"/)?.[1];
        slot = { dataset: { workshopPassage: id }, innerHTML: 'pending', closest: () => null };
    },
    get innerHTML() { return hostMarkup; },
    querySelectorAll: selector => selector === '[data-workshop-passage]' ? [slot] : [],
    querySelector: () => ({ focus() {} }), contains: node => node === slot,
    addEventListener: (type, fn) => slotListeners.set(type, fn), removeEventListener: type => slotListeners.delete(type)
};
mounted = mountWorkshop({ ...app, $content: slotHost }, 'biblioteca', delayedBible);
await new Promise(resolve => setImmediate(resolve));
const staleSlot = slot;
slotListeners.get('change')({ target: { matches: selector => selector === '[data-workshop-select="library"]', value: 'creacion' } });
await new Promise(resolve => setImmediate(resolve));
await deferredChapters.get('gen')(); await new Promise(resolve => setImmediate(resolve));
check(slot.innerHTML.includes('gen 1:26') && !slot.innerHTML.includes('jos 1:8'), 'latest library passage renders before older request finishes');
const currentMarkup = slot.innerHTML;
await deferredChapters.get('jos')(); await new Promise(resolve => setImmediate(resolve));
check(slot.innerHTML === currentMarkup && !staleSlot.innerHTML.includes('[NBLA prueba]'), 'late response cannot overwrite a replacement slot');
mounted.destroy(); check(slotListeners.size === 0, 'including capture toggle listener, all handlers removed');
const absentBible = new WorkshopScripture({ resolveBookId: id => bookIds.getCanonicalBookId(id), getChapter: async () => { throw Error('offline'); } });
mounted = mountWorkshop({ ...app, $content: slotHost }, 'biblioteca', absentBible);
await new Promise(resolve => setImmediate(resolve));
check(slot.innerHTML.includes('Reintentar pasaje') && !slot.innerHTML.includes('Reina-Valera 1909'), 'controller preserves honest offline error');
absentBible.getChapter = syntheticChapter;
slotListeners.get('click')({ target: { closest: () => ({ dataset: { workshopAction: 'retry-bible' }, closest: () => slot }) } });
await new Promise(resolve => setImmediate(resolve));
check(slot.innerHTML.includes('jos 1:8') && !slot.innerHTML.includes('Reintentar pasaje'), 'actual retry control restores the same NBLA passage');
mounted.destroy();
const appSource = readFileSync('js/app.js', 'utf8');
const ast = parse(appSource, { ecmaVersion: 'latest', sourceType: 'module' });
const appNode = ast.body.find(node => node.type === 'VariableDeclaration' && node.declarations.some(d => d.id.name === 'App')).declarations.find(d => d.id.name === 'App').init;
const indexSource = readFileSync('index.html', 'utf8');
const learningButton = indexSource.match(/<button\b[^>]*id="nav-stats"[^>]*>[\s\S]*?<\/button>/)?.[0] || '';
check(learningButton.includes('<span>Aprender</span>') && !learningButton.includes('<span>Vivir</span>'), 'fifth navigation button uses approved short label');
check(!indexSource.includes('id="streak-indicator"') && !indexSource.includes('open-stats-from-streak')
    && !appSource.includes('open-stats-from-streak'), 'retired general-menu entry and handler removed');
const libraryNode = appNode.properties.find(p => p.key?.name === 'renderMeditationsHistory').value;
const libraryContext = vm.createContext({ readingIcon, setTimeout: () => 0 });
const libraryMethod = vm.runInContext('(' + appSource.slice(libraryNode.start, libraryNode.end) + ')', libraryContext);
const libraryMarkup = libraryMethod.call({ escapeHtml: value => value });
check(libraryMarkup.includes('href="#workshop"') && libraryMarkup.includes('Volver a Aprender')
    && libraryMarkup.includes('Mis meditaciones') && !libraryMarkup.includes('Mi camino'), 'personal library remains available and returns to Aprender');
const streakNode = appNode.properties.find(p => p.key?.name === 'updateStreakUI').value;
vm.runInContext('(' + appSource.slice(streakNode.start, streakNode.end) + ')', vm.createContext({}))
    .call({ $streakIndicator: null, $streakCount: null });
check(appSource.includes("else if (view === 'stats') {\n    this.renderStats();")
    && readFileSync('js/JourneyView.js', 'utf8').includes("renderViewHeader('Historial personal'"), 'legacy personal reviews remain accessible without the retired title');
const exportNode = appNode.properties.find(p => p.key?.name === 'exportAllData').value;
let exportedBlob;
const exportContext = vm.createContext({ console, Blob, Date, WORKSHOP_KEY, validateWorkshopState, exportJourney,
    localStorage: live, window: { ShareService: { exportBackup: async blob => { exportedBlob = blob; return { canceled: true }; } } },
    MeditationSessionStorage: { pendingSessions: new Map(), getIndexKey: () => 'su-voz-meditation-index', getAllMetadata: () => [] } });
const exportMethod = vm.runInContext('(' + appSource.slice(exportNode.start, exportNode.end) + ')', exportContext);
const pending = createWorkshopState(); pending.drafts.aplicacion = { samaritano: { 0: 'Pending synthetic exercise' } };
await exportMethod.call({ workshopMemoryState: pending, getUserCommunityPreferences: () => ({}), getReadDates: () => [],
    getTodayDateStr: () => '2026-10-22', settings: {}, showToast: message => { throw Error(message); } });
const exported = JSON.parse(await exportedBlob.text());
check(JSON.parse(exported.journeyBackup.entries[WORKSHOP_KEY]).drafts.aplicacion.samaritano[0] === 'Pending synthetic exercise', 'actual full backup includes pending workshop changes after quota failure');
globalThis.document = originalDocument;
delete globalThis.window; delete globalThis.fetch; delete globalThis.localStorage;
delete globalThis.document;
console.log(`Workshop: ${checks} assertions, ${combinations} lesson/passage/stage views, 80 references, ${verses} verses: OK`);
console.log('Persistence, corruption, quota, backup/restore/merge/rollback, private advisor contact and exact return: OK');
