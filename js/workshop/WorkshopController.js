import { WORKSHOP_LESSONS as lessons, WORKSHOP_PASSAGES as passages, WORKSHOP_SOURCES as sources } from './WorkshopContent.js';
import { renderWorkshop, renderWorkshopScripture } from './WorkshopView.js';
import { workshopHref } from './WorkshopView.js';
import { createWorkshopState, loadWorkshop, saveWorkshop } from '../services/WorkshopStorage.js';

export function getWorkshopReturnHref(storage) {
    try { return workshopHref(loadWorkshop(storage).lastLesson); }
    catch { return '#workshop'; }
}

export function mountWorkshop(app, page = '', bible) {
    const host = app.$content;
    let state, blocked = app.workshopStorageBlocked === true, active = true;
    try { state = app.workshopMemoryState || loadWorkshop(localStorage); }
    catch { state = createWorkshopState(); blocked = true; app.workshopStorageBlocked = true; }
    const ui = { page, today: app.getTodayDateStr(), groupStep: 0, checked: {}, feedback: '',
        saveError: blocked || Boolean(app.workshopMemoryState), libraryId: 'josue' };
    const index = lessons.findIndex(l => l.id === page);
    const lesson = lessons[index];
    const listeners = [];
    const listen = (type, callback, capture = false) => { host.addEventListener(type, callback, capture); listeners.push([type, callback, capture]); };

    function save() {
        if (blocked) { app.workshopMemoryState = state; return false; }
        try { state = saveWorkshop(localStorage, state); app.workshopMemoryState = null; ui.saveError = false; return true; }
        catch { app.workshopMemoryState = state; ui.saveError = true; return false; }
    }

    function render(focus = '') {
        const y = window.scrollY;
        const opened = new Set([...host.querySelectorAll('details[open]')].map(d => d.querySelector('summary')?.textContent));
        host.innerHTML = renderWorkshop(state, ui, bible);
        host.querySelectorAll('details').forEach(d => { if (opened.has(d.querySelector('summary')?.textContent)) d.open = true; });
        if (focus) {
            host.querySelector(focus)?.focus({ preventScroll: true });
            app.scrollWindowInstantly(y);
        }
        loadVisiblePassages();
    }

    async function loadPassage(slot, retry = false) {
        const id = slot.dataset.workshopPassage;
        const cached = bible?.get(id);
        if (!retry && cached) return;
        try {
            const request = bible.load(id);
            slot.innerHTML = renderWorkshopScripture(id, bible);
            await request;
        } catch { /* Each passage retains its own retry state, without replacing the exercise. */ }
        if (active && host.contains(slot)) slot.innerHTML = renderWorkshopScripture(id, bible);
    }

    function loadVisiblePassages() {
        host.querySelectorAll('[data-workshop-passage]').forEach(slot => {
            if (!slot.closest('details:not([open])')) void loadPassage(slot);
        });
    }

    if (lesson && state.lastLesson !== lesson.id) { state.lastLesson = lesson.id; save(); }
    render();
    app.scrollWindowInstantly(0);
    listen('toggle', event => {
        if (event.target.matches('details[open]')) loadVisiblePassages();
    }, true);

    listen('input', event => {
        const input = event.target.closest('[data-workshop-exercise]');
        if (!lesson || !input) return;
        const id = input.dataset.passage, step = input.dataset.stage;
        if (!sources[index].includes(id) || !['0', '1', '2'].includes(step)) return;
        state.drafts[lesson.id] ||= {};
        state.drafts[lesson.id][id] ||= {};
        state.drafts[lesson.id][id][step] = input.value.slice(0, 2000);
        const saved = save(), status = host.querySelector('[data-workshop-save-status]');
        if (status) status.textContent = saved ? 'Ejercicio guardado solo en este dispositivo.' : 'No se pudo guardar. Conserva el texto antes de salir.';
    });
    listen('change', event => {
        const target = event.target;
        if (target.matches('[data-workshop-answer]') && lesson) {
            const n = Number(target.value);
            if (!Number.isInteger(n) || n < 0 || n > 2) return;
            state.answers[lesson.id] = n; delete ui.checked[lesson.id]; ui.feedback = ''; save();
            const feedback = host.querySelector('.wt-feedback'); if (feedback) feedback.textContent = '';
        } else if (target.matches('[data-workshop-select="example"]') && lesson && sources[index].includes(target.value)) {
            state.passages[lesson.id] = target.value; state.stages[lesson.id] = 0; save(); render('#wt-example-select');
        } else if (target.matches('[data-workshop-select="library"]') && Object.hasOwn(passages, target.value)) {
            ui.libraryId = target.value; render('#wt-library-select');
        }
    });
    listen('pointerdown', event => {
        if (event.target.closest('[data-workshop-action="stage"]') && document.activeElement?.matches('[data-workshop-exercise]')) {
            ui.keepExerciseFocus = true; event.preventDefault();
        }
    });
    listen('click', event => {
        const button = event.target.closest('[data-workshop-action]');
        if (!button) return;
        const action = button.dataset.workshopAction;
        if (action === 'retry-bible') {
            const slot = button.closest('[data-workshop-passage]');
            if (slot) void loadPassage(slot, true);
            return;
        }
        if (!lesson) return;
        if (action === 'stage') {
            const n = Number(button.dataset.stage);
            if (!Number.isInteger(n) || n < 0 || n > 2) return;
            state.stages[lesson.id] = n; save();
            render(ui.keepExerciseFocus ? '#wt-exercise' : `[data-workshop-action="stage"][data-stage="${n}"]`);
            ui.keepExerciseFocus = false;
        } else if (action === 'check') {
            const answer = state.answers[lesson.id];
            if (Number.isInteger(answer)) ui.checked[lesson.id] = answer;
            else ui.feedback = 'Elige una opción para revisar tu respuesta.';
            render('[data-workshop-action="check"]');
        } else if (action === 'complete') {
            if (!state.reviewed.includes(lesson.id)) state.reviewed.push(lesson.id);
            save(); render('[data-workshop-action="complete"]');
        } else if (action === 'group') {
            const n = Number(button.dataset.step);
            if (!Number.isInteger(n) || n < 0 || n > 3) return;
            ui.groupStep = n; render('.wt-group button:not(:disabled)');
        }
    });
    return { destroy() { active = false; for (const [type, callback, capture] of listeners) host.removeEventListener(type, callback, capture); } };
}
