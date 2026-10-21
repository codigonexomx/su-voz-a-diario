import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { parse } from 'acorn';
import { buildCalendarModel, calendarKeyboardDate, moveCalendarDate, validCalendarDate, validCalendarMonth } from '../js/calendar/CalendarModel.js';
import { renderCalendarView } from '../js/calendar/CalendarView.js';
import { calendarMethods } from '../js/calendar/CalendarController.js';

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, name) {
    if (node.type === 'Property' && node.key.name === name) return node;
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
        if (child?.type) { const result = find(child, name); if (result) return result; }
    }
}
function appMethod(name) {
    const node = find(tree, name);
    assert(node, name);
    return vm.runInNewContext(`(${source.slice(node.value.start, node.value.end)})`);
}

for (const date of ['2024-02-29', '2000-02-29', '2026-10-21', '0001-01-01', '9999-12-31']) assert(validCalendarDate(date), date);
for (const date of ['1900-02-29', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '0000-01-01', '2026-1-01', null, 20261021]) assert(!validCalendarDate(date), String(date));
assert(validCalendarMonth('2026-10')); assert(!validCalendarMonth('2026-1'));
assert.equal(moveCalendarDate('2026-01-31', { months: 1 }), '2026-02-28');
assert.equal(moveCalendarDate('2024-02-29', { months: 12 }), '2025-02-28');
assert.equal(moveCalendarDate('2026-12-31', { days: 1 }), '2027-01-01');
assert.equal(moveCalendarDate('0001-01-01', { days: -1 }), null);
assert.equal(moveCalendarDate('9999-12-31', { months: 1 }), null);
assert.equal(moveCalendarDate('2026-10-21', { months: 1e20 }), null);
assert.equal(moveCalendarDate('bad', { months: 1 }), null);
for (const [key, expected] of Object.entries({ ArrowLeft: '2026-10-20', ArrowRight: '2026-10-22', ArrowUp: '2026-10-14', ArrowDown: '2026-10-28', Home: '2026-10-18', End: '2026-10-24', PageUp: '2026-09-21', PageDown: '2026-11-21' })) {
    assert.equal(calendarKeyboardDate('2026-10-21', key), expected);
}
assert.equal(calendarKeyboardDate('2026-10-21', 'PageUp', true), '2025-10-21');
assert.equal(calendarKeyboardDate('2026-10-21', 'Enter'), null);
for (let year = 2024; year <= 2027; year++) for (let month = 1; month <= 12; month++) {
    const value = `${year}-${String(month).padStart(2, '0')}`;
    const model = buildCalendarModel({ today: '2026-10-21', month: value });
    assert.equal(model.cells.length, 42);
    assert.equal(model.cells.filter(Boolean).length, model.days.length);
    assert.equal(model.cells.indexOf(model.days[0]), new Date(`${value}-01T12:00:00Z`).getUTCDay());
}
const timezoneResults = ['America/Mexico_City', 'Pacific/Kiritimati', 'America/New_York'].map(TZ => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import { buildCalendarModel, moveCalendarDate } from './js/calendar/CalendarModel.js'; console.log(JSON.stringify([buildCalendarModel({today:'2026-11-01',month:'2026-11'}).days.map(d=>d.label),moveCalendarDate('2026-03-08',{days:1})]));`], {
        cwd: new URL('../', import.meta.url), env: { ...process.env, TZ }, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr); return result.stdout;
});
assert(timezoneResults.every(value => value === timezoneResults[0]), 'Local day strings must not drift across time zones or DST');
console.log('OK: strict dates, leap years, 42-cell months, bounded month jumps, keyboard navigation and time zones');

const readings = [1, 5, 21, 22].map(day => ({ date: `2026-10-${String(day).padStart(2, '0')}`, reference: `Pasaje de prueba ${day}` }));
const activity = new Map([
    ['2026-10-05', { hasMeditation: true, meditationId: 'fixture-session', highlightCount: 2 }],
    ['2026-10-10', { hasMeditation: true }],
    ['2026-10-12', { highlightCount: 1 }]
]);
const fixture = { today: '2026-10-21', month: '2026-10', selectedDate: '2026-10-21', readings, activity, readDates: ['2026-10-01', '2026-10-01', 'bad'] };
const model = buildCalendarModel(fixture);
assert.equal(model.total, 4); assert.equal(model.due, 3); assert.equal(model.completed, 1); assert.equal(model.percentage, 33);
assert.equal(model.pending, 2); assert.equal(model.upcoming, 1); assert.equal(model.meditations, 2);
assert.deepEqual(model.counts, { all: 6, pending: 2, read: 1, upcoming: 1, notes: 2, highlights: 2 });
assert.deepEqual(buildCalendarModel({ ...fixture, filter: 'pending' }).agenda.map(day => day.date), ['2026-10-05', '2026-10-21']);
assert.equal(buildCalendarModel({ ...fixture, filter: 'upcoming' }).selection.date, '2026-10-22');
assert.equal(buildCalendarModel({ ...fixture, filter: 'notes' }).selection.date, '2026-10-05');
const noMatch = buildCalendarModel({ ...fixture, month: '2026-09', filter: 'read' });
assert.equal(noMatch.selection, null); assert.equal(noMatch.agenda.length, 0);
assert.equal(buildCalendarModel({ ...fixture, month: '2026-11' }).percentage, 0);
assert.equal(buildCalendarModel({ ...fixture, selectedDate: '2026-10-31' }).selection.status, 'unavailable');
assert.equal(buildCalendarModel({ ...fixture, month: 'bad', selectedDate: 'bad', filter: 'bad', view: 'bad' }).selectedDate, fixture.today);
assert.equal(buildCalendarModel({ ...fixture, readings: [null, {}, { date: '2026-02-31', reference: 'bad' }, ...readings], readDates: {} }).total, 4);
const html = renderCalendarView(model);
assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
assert.equal((html.match(/class="calendar-date[ "]/g) || []).length, 31);
assert(html.includes('role="grid"')); assert(html.includes('abbr="miércoles"'));
assert(html.includes('aria-current="date"')); assert(html.includes('aria-pressed="true"'));
assert(html.includes('id="calendar-month-select"')); assert(html.includes('id="calendar-filter"'));
assert(html.includes('data-calendar-action="meditate"'));
const futureHtml = renderCalendarView(buildCalendarModel({ ...fixture, selectedDate: '2026-10-22' }));
assert(!futureHtml.includes('data-calendar-action="meditate"')); assert(futureHtml.includes('Ver lectura'));
const unavailableHtml = renderCalendarView(buildCalendarModel({ ...fixture, month: '2027-01', selectedDate: '2027-01-15' }));
assert(!unavailableHtml.includes('data-calendar-action="open-reading"')); assert(!unavailableHtml.includes('data-calendar-action="meditate"'));
assert(!unavailableHtml.includes('Próxima lectura'));
const injected = renderCalendarView(buildCalendarModel({ ...fixture, readings: [{ date: fixture.today, reference: '<img src=x onerror=alert(1)>' }] }));
assert(!injected.includes('<img')); assert(injected.includes('&lt;img'));
assert(!html.includes('<script')); assert(!html.includes('fixture private note'));
const historyFailure = renderCalendarView({ ...noMatch, filter: 'notes', historyUnavailable: true });
assert(historyFailure.includes('Historial no disponible')); assert(!historyFailure.includes('Meditaciones · 0'));
assert(renderCalendarView({ ...model, view: 'list' }).includes('calendar-agenda'));
assert(renderCalendarView({ ...noMatch, view: 'list' }).includes('Sin coincidencias este mes'));
assert.equal(renderCalendarView({ ...noMatch, view: 'list' }).split('Sin coincidencias este mes').length - 1, 1, 'List empty state must not appear twice');
console.log('OK: real progress, future vs pending, filters, empty states, safe date actions, privacy and escaped references');

const clean = appMethod('cleanMeditationText');
const fields = appMethod('getMeditationNoteFields');
const sessionRecords = new Map([
    ['fixture-session', { id: 'fixture-session', readingId: '2026-10-05', updatedAt: 1, notes: { dios: 'fixture private note' } }],
    ['fixture-new', { id: 'fixture-new', readingId: '2026-10-05', updatedAt: 2, status: 'archived', notes: { oracion: 'fixture prayer' } }],
    ['fixture-empty', { id: 'fixture-empty', readingId: '2026-10-06', notes: { dios: '<p><br></p>' } }],
    ['fixture-null', { id: 'fixture-null', readingId: '2026-10-07', notes: null }]
]);
const sessions = { getAllMetadata: () => [...sessionRecords.values()].map(({ notes, ...metadata }) => metadata), get: id => sessionRecords.get(id) };
const beforeSessions = JSON.stringify([...sessionRecords]);
const activityApp = { ...calendarMethods, cleanMeditationText: clean, getMeditationNoteFields: fields,
    getNote: date => date === '2026-10-10' ? { aprendizaje: 'fixture legacy note' } : null,
    getHighlights: date => date === '2026-10-12' ? [{ text: 'fixture highlight' }] : [] };
const flags = activityApp.getCalendarActivity('2026-10', sessions);
assert(flags.get('2026-10-05').hasMeditation); assert(flags.get('2026-10-05').hasPrayer);
assert.equal(flags.get('2026-10-05').meditationId, 'fixture-new');
assert(!flags.get('2026-10-06').hasMeditation); assert(!flags.get('2026-10-07').hasMeditation);
assert(flags.get('2026-10-10').hasMeditation); assert.equal(flags.get('2026-10-12').highlightCount, 1);
assert(renderCalendarView(buildCalendarModel({ ...fixture, selectedDate: '2026-10-05', activity: flags })).includes('Oración guardada'));
assert.equal(JSON.stringify([...sessionRecords]), beforeSessions, 'Reading activity may not migrate, save or change private sessions');
activityApp.getCalendarActivity('2026-10', { getAllMetadata: () => { throw Error('fixture storage failure'); } });
assert(activityApp.calendarHistoryUnavailable);
console.log('OK: legacy and session notes, latest nonempty meditation, archived records, empty drafts and storage failure without data writes');

const renders = [];
const commandsApp = { ...calendarMethods, calendarState: { month: '2026-01', selectedDate: '2026-01-31', filter: 'all', view: 'month' },
    renderCalendar: options => renders.push(options), getTodayDateStr: () => fixture.today };
commandsApp.changeCalendarMonth('2026-02'); assert.equal(commandsApp.calendarState.selectedDate, '2026-02-28');
commandsApp.calendarState.selectedDate = 'bad'; commandsApp.changeCalendarMonth('2026-03'); assert.equal(commandsApp.calendarState.selectedDate, '2026-03-01');
const rendered = renders.length; commandsApp.changeCalendarMonth('2026-13'); commandsApp.changeCalendarFilter('bad'); assert.equal(renders.length, rendered);
commandsApp.changeCalendarFilter('notes'); assert.equal(commandsApp.calendarState.filter, 'notes');
await commandsApp.handleCalendarCommand({ dataset: { calendarAction: 'today' } }); assert.equal(commandsApp.calendarState.selectedDate, fixture.today);
await commandsApp.handleCalendarCommand({ dataset: { calendarAction: 'view', view: 'list' }, id: 'calendar-view-list' }); assert.equal(commandsApp.calendarState.view, 'list');
let prevented = false;
commandsApp.currentView = 'calendar';
commandsApp.handleCalendarKeydown({ key: 'ArrowLeft', target: { closest: () => ({ dataset: { date: fixture.today } }) }, preventDefault: () => { prevented = true; } });
assert(prevented); assert.equal(commandsApp.calendarState.selectedDate, '2026-10-20'); assert.equal(renders.at(-1).focusDate, '2026-10-20');
await commandsApp.handleCalendarCommand({ dataset: { calendarAction: 'select-day', date: '2026-10-05' } });
assert.equal(renders.at(-1).focusControl, 'calendar-selected-date'); assert(renders.at(-1).revealFocus);
let navigated;
commandsApp.navigate = (...args) => { navigated = args; }; commandsApp.getReadingMetadataByDate = date => readings.find(reading => reading.date === date);
await commandsApp.handleCalendarCommand({ dataset: { calendarAction: 'open-reading', date: '2026-10-05' } }); assert.deepEqual(navigated, ['reading', '2026-10-05']);
navigated = null;
await commandsApp.handleCalendarCommand({ dataset: { calendarAction: 'open-reading', date: '2026-10-06' } }); assert.equal(navigated, null);
commandsApp._calendarModel = model;
await commandsApp.handleCalendarCommand({ dataset: { calendarAction: 'saved-meditation', date: '2026-10-05' } }); assert.deepEqual(navigated, ['meditations-history', 'fixture-session']);
commandsApp.calendarState.filter = 'notes';
commandsApp._calendarModel = buildCalendarModel({ ...fixture, filter: 'notes' });
await commandsApp.handleCalendarCommand({ dataset: { calendarAction: 'select-day', date: '2026-10-05' } });
assert.equal(commandsApp.calendarState.filter, 'notes', 'Selecting a matching day preserves the active filter');
await commandsApp.handleCalendarCommand({ dataset: { calendarAction: 'select-day', date: '2026-10-22' } });
assert.equal(commandsApp.calendarState.filter, 'all', 'Opening a dimmed day leaves the filter explicitly');
console.log('OK: month clamping, invalid commands, Today, list mode, keyboard focus and exact-day reading/history routing');

const priorGlobals = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
try {
    const focused = [], scrolls = [];
    const target = { focus: options => focused.push(options), scrollIntoView: options => scrolls.push(options) };
    globalThis.window = { scrollY: 250 };
    globalThis.document = { getElementById: () => target };
    const renderApp = { ...calendarMethods, getCalendarModel: () => model, scrollWindowInstantly: top => scrolls.push(top),
        $content: { innerHTML: '', querySelector: () => target } };
    renderApp.renderCalendar({ focusDate: fixture.today, revealFocus: true });
    assert.equal(scrolls[0], 250); assert.deepEqual(focused[0], { preventScroll: true }); assert.equal(scrolls[1].block, 'nearest');
    const restore = appMethod('restoreCalendarPosition');
    const position = { currentView: 'calendar', calendarInitialized: false, calendarScrollTop: 400, scrollWindowInstantly: top => scrolls.push(top) };
    restore.call(position); assert.equal(scrolls.at(-1), 0);
    restore.call(position); assert.equal(scrolls.at(-1), 400);
    globalThis.localStorage = { getItem: key => key === 'su-voz-meditation-fixture-open' ? JSON.stringify({ id: 'fixture-open', readingId: fixture.today }) : null };
    function openingFixture() {
        const root = { isConnected: true }, events = [], button = { isConnected: true, setAttribute() {}, removeAttribute() {} };
        const app = { ...calendarMethods, currentView: 'calendar', calendarState: { selectedDate: fixture.today },
            $content: { querySelector: () => root }, getTodayDateStr: () => fixture.today,
            getReadingMetadataByDate: () => ({ date: fixture.today }), getReadingByDate: async () => ({ date: fixture.today }),
            toggleNote: () => { events.push('toggle'); app.currentMeditationSessionId = 'fixture-open'; app.openNoteDate = fixture.today; },
            resolveMeditationMetadata: async () => events.push('metadata'), trackAnalyticsOnce: () => events.push('start'),
            trackAnalyticsEvent: () => events.push('deepen'), getReadingAnalyticsParams: () => ({}),
            openDeepeningShell: reading => events.push(`open:${reading.date}`), showToast: text => events.push(text) };
        return { app, root, events, button };
    }
    const success = openingFixture(); await success.app.openCalendarMeditation(fixture.today, success.button);
    assert.deepEqual(success.events, ['toggle', 'metadata', 'start', 'deepen', `open:${fixture.today}`]); assert.equal(success.button.disabled, false);
    const missing = openingFixture(); missing.app.getReadingByDate = async () => null;
    await missing.app.openCalendarMeditation(fixture.today, missing.button); assert.equal(missing.events.length, 1); assert(!missing.events.includes('toggle'));
    const wrongDay = openingFixture(); wrongDay.app.getReadingByDate = async () => ({ date: '2026-10-20' });
    await wrongDay.app.openCalendarMeditation(fixture.today, wrongDay.button); assert(!wrongDay.events.includes('toggle'));
    const rejected = openingFixture(); let reject;
    rejected.app.getReadingByDate = () => new Promise((resolve, fail) => { reject = fail; });
    const rejectedRequest = rejected.app.openCalendarMeditation(fixture.today, rejected.button);
    rejected.app.currentView = 'bible'; reject(Error('fixture network failure')); await rejectedRequest;
    assert.equal(rejected.events.length, 0, 'An obsolete network failure must not interrupt another view');
    for (const change of ['unmount', 'navigate', 'day']) {
        const race = openingFixture(); let resolve;
        race.app.getReadingByDate = () => new Promise(done => { resolve = done; });
        const pending = race.app.openCalendarMeditation(fixture.today, race.button);
        await race.app.openCalendarMeditation(fixture.today, race.button);
        if (change === 'unmount') race.root.isConnected = false;
        if (change === 'navigate') race.app.currentView = 'bible';
        if (change === 'day') race.app.calendarState.selectedDate = '2026-10-20';
        resolve({ date: fixture.today }); await pending;
        assert.equal(race.events.length, 0, `Stale ${change} request must not create a meditation`);
        assert.equal(race.app._calendarOpeningRequest, null); assert.equal(race.button.disabled, false);
    }
    const latest = openingFixture(), pendingReadings = [];
    latest.app.getReadingByDate = () => new Promise(done => pendingReadings.push(done));
    const stale = latest.app.openCalendarMeditation(fixture.today, latest.button);
    latest.root.isConnected = false;
    latest.app.$content.querySelector = () => ({ isConnected: true });
    const current = latest.app.openCalendarMeditation(fixture.today, { ...latest.button });
    pendingReadings[0]({ date: fixture.today }); await stale;
    assert(latest.app._calendarOpeningRequest, 'An obsolete request may not unlock a newer request');
    pendingReadings[1]({ date: fixture.today }); await current;
    assert.equal(latest.events.filter(event => event === 'toggle').length, 1);
    assert.equal(latest.events.filter(event => event.startsWith('open:')).length, 1);
    const future = openingFixture(); await future.app.openCalendarMeditation('2026-10-22', future.button); assert.equal(future.events.length, 0);
} finally {
    for (const [key, value] of Object.entries(priorGlobals)) {
        if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
}
assert(source.includes('...calendarMethods,')); assert(!source.includes('calendar-v2-select-day'));
assert(source.includes("this.$content.addEventListener('keydown', (e) => this.handleCalendarKeydown(e))"));
assert(source.includes('this.changeCalendarMonth(e.target.value)')); assert(source.includes('this.changeCalendarFilter(e.target.value)'));
assert(source.includes("if (oldView !== 'calendar') this.restoreCalendarPosition()"));
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
for (const asset of ['js/calendar/CalendarModel.js', 'js/calendar/CalendarView.js', 'js/calendar/CalendarController.js', 'css/calendar.css']) {
    assert.equal(sw.split(asset).length - 1, 2, `${asset}: precached and required offline`);
}
const css = readFileSync(new URL('../css/calendar.css', import.meta.url), 'utf8');
assert(css.includes(':focus-visible')); assert(css.includes('prefers-reduced-motion')); assert(css.includes('forced-colors'));
assert(css.includes('.calendar-planner .sr-only')); assert(!css.includes('gradient('));
console.log('OK: scroll preservation, first-entry reset, async navigation cancellation, unavailable/offline guards, production bindings and required offline assets');
