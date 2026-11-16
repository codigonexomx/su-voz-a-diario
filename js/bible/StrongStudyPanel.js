import { escapeBibleHtml } from '../utils/text.js';
import { positionBibleStudyPanel } from './BibleReaderPresentation.js';

const escape = value => escapeBibleHtml(String(value ?? ''));
const languageName = value => ({ hebrew: 'Hebreo', aramaic: 'Arameo', greek: 'Griego' }[value] || 'Palabra original');
const paragraphs = value => String(value || '').split(/\n\s*\n|\n/).filter(Boolean).map(line => `<p>${escape(line)}</p>`).join('');

// Numbers retain the source's literal position. No Spanish word-to-lemma equivalence is inferred.
export function renderStrongNumber(id, reference) {
    return `<button type="button" class="bible-strong-marker" data-action="open-strong-word" data-strong-ids="${escape(id)}" data-strong-reference="${escape(reference)}" aria-label="Consultar ${escape(id)} en ${escape(reference)}" aria-expanded="false">${escape(id)}</button>`;
}

export function renderStrongVerseText(text, spans, notes, context, renderNote) {
    const insertions = new Map();
    const add = (offset, html) => {
        if (!insertions.has(offset)) insertions.set(offset, []);
        insertions.get(offset).push(html);
    };
    const reference = `${context.bookName || context.bookId} ${context.chapter}:${context.verse}`;
    for (const span of spans) for (const id of span.ids) add(span.end, renderStrongNumber(id, reference));
    for (const note of notes) {
        const offset = Number.isInteger(note.offset) && note.offset >= 0 && note.offset <= text.length ? note.offset : text.length;
        add(offset, renderNote(note, context));
    }
    let cursor = 0;
    let html = '';
    for (const offset of [...insertions.keys()].sort((a, b) => a - b)) {
        html += escape(text.slice(cursor, offset)) + insertions.get(offset).join('');
        cursor = offset;
    }
    return html + escape(text.slice(cursor));
}

export class StrongStudyPanel {
    constructor({ repository, isContextCurrent = () => true, onBeforeOpen = () => {} }) {
        this.repository = repository;
        this.isContextCurrent = isContextCurrent;
        this.onBeforeOpen = onBeforeOpen;
        this.epoch = 0;
        this.state = null;
    }

    close({ restoreFocus = false } = {}) {
        this.epoch++;
        const state = this.state;
        if (!state) return;
        this.state = null;
        state.cleanup();
        state.anchor.classList.remove('is-strong-active');
        state.anchor.setAttribute('aria-expanded', 'false');
        state.panel.remove();
        if (restoreFocus && state.anchor.isConnected) state.anchor.focus({ preventScroll: true });
    }

    mount(anchor, { word = '', reference = '', ids = [], mode = 'entry' } = {}) {
        this.close();
        this.onBeforeOpen();
        const panel = document.createElement('section');
        panel.className = 'strong-study-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');
        panel.setAttribute('aria-label', 'Diccionario Strong');
        panel.tabIndex = -1;
        const state = { anchor, panel, word, reference, ids, mode, query: '', language: 'all', entry: null, history: [] };
        const position = () => {
            if (!anchor.isConnected || !this.isContextCurrent()) { this.close(); return; }
            positionBibleStudyPanel(anchor, panel);
        };
        const outside = event => {
            if (event.composedPath?.().includes(panel) || panel.contains(event.target) || anchor.contains(event.target) || event.target.closest('[data-action="open-strong-word"], [data-action="open-strong-dictionary"], [data-action="open-strong-verse"]')) return;
            this.close();
        };
        const keydown = event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            this.close({ restoreFocus: true });
        };
        window.addEventListener('resize', position);
        window.visualViewport?.addEventListener('resize', position);
        window.visualViewport?.addEventListener('scroll', position);
        document.addEventListener('click', outside);
        document.addEventListener('keydown', keydown);
        state.cleanup = () => {
            window.removeEventListener('resize', position);
            window.visualViewport?.removeEventListener('resize', position);
            window.visualViewport?.removeEventListener('scroll', position);
            document.removeEventListener('click', outside);
            document.removeEventListener('keydown', keydown);
        };
        panel.addEventListener('click', event => { event.stopPropagation(); this.handleClick(event); });
        panel.addEventListener('submit', event => {
            event.preventDefault();
            event.stopPropagation();
            const input = panel.querySelector('input[name="strong-query"]');
            this.search(input?.value || '');
        });
        panel.addEventListener('change', event => {
            if (event.target.name !== 'strong-language') return;
            state.language = event.target.value;
            this.search(panel.querySelector('input[name="strong-query"]')?.value || state.query);
        });
        this.state = state;
        this.position = position;
        document.body.append(panel);
        anchor.classList.add('is-strong-active');
        anchor.setAttribute('aria-expanded', 'true');
        this.render();
        panel.focus({ preventScroll: true });
        return state;
    }

    openWord(anchor) {
        const ids = (anchor.dataset.strongIds || '').split(/\s+/).filter(Boolean);
        if (!ids.length) return;
        this.mount(anchor, { ids, word: anchor.dataset.strongWord || '', reference: anchor.dataset.strongReference || '' });
        // The Greek article remains available, while a phrase opens its content word first.
        this.showEntry(ids.find(id => id !== 'G3588') || ids[0]);
    }

    openDictionary(anchor) {
        this.mount(anchor, { mode: 'search' });
        this.state.panel.querySelector('input')?.focus({ preventScroll: true });
    }

    openVerse(anchor) {
        const ids = (anchor.dataset.strongIds || '').split(/\s+/).filter(Boolean);
        this.mount(anchor, { ids, reference: anchor.dataset.strongReference || '', mode: 'verse' });
    }

    async showEntry(id, { remember = false } = {}) {
        const state = this.state;
        if (!state) return;
        if (remember && state.mode === 'entry' && state.entry && state.entry.id !== id) state.history.push(state.entry.id);
        const epoch = ++this.epoch;
        state.mode = 'entry'; state.selectedId = id; state.loading = true; state.error = ''; state.entry = null;
        this.render();
        try {
            const entry = await this.repository.lookup(id);
            if (epoch !== this.epoch || this.state !== state || !state.anchor.isConnected || !this.isContextCurrent()) return;
            state.entry = entry;
            if (!entry) state.error = `La fuente no incluye una entrada para ${id}.`;
        } catch {
            if (epoch !== this.epoch || this.state !== state || !this.isContextCurrent()) return;
            state.error = 'No se pudo cargar esta entrada. Vuelve a intentarlo.';
        }
        if (epoch !== this.epoch || this.state !== state) return;
        state.loading = false;
        this.render();
    }

    async search(query) {
        const state = this.state;
        if (!state) return;
        const epoch = ++this.epoch;
        state.query = String(query).trim(); state.mode = 'search'; state.error = ''; state.results = null;
        state.loading = Boolean(state.query);
        this.render();
        if (!state.query) return;
        try {
            const results = await this.repository.search({ query: state.query, language: state.language, limit: 40 });
            if (epoch !== this.epoch || this.state !== state || !state.anchor.isConnected || !this.isContextCurrent()) return;
            state.results = results;
        } catch {
            if (epoch !== this.epoch || this.state !== state || !this.isContextCurrent()) return;
            state.error = 'No se pudo abrir el diccionario. Vuelve a intentarlo.';
        }
        if (epoch !== this.epoch || this.state !== state) return;
        state.loading = false;
        this.render();
    }

    handleClick(event) {
        const button = event.target.closest('[data-strong-action]');
        if (!button || !this.state) return;
        const action = button.dataset.strongAction;
        if (action === 'close') this.close({ restoreFocus: true });
        if (action === 'search') {
            ++this.epoch;
            this.state.mode = 'search'; this.state.loading = false; this.state.error = '';
            this.state.word = ''; this.state.reference = ''; this.state.ids = []; this.state.entry = null; this.state.history = [];
            this.render(); this.state.panel.querySelector('input')?.focus({ preventScroll: true });
        }
        if (action === 'entry') this.showEntry(button.dataset.strongId, { remember: true });
        if (action === 'retry') this.state.mode === 'search' ? this.search(this.state.query) : this.showEntry(this.state.selectedId);
        if (action === 'back') {
            const previous = this.state.history.pop();
            if (previous) this.showEntry(previous);
            else { ++this.epoch; this.state.mode = 'search'; this.state.loading = false; this.state.error = ''; this.state.entry = null; this.render(); }
        }
    }

    render() {
        const state = this.state;
        if (!state) return;
        const focused = state.panel.contains(document.activeElement) ? document.activeElement : null;
        const focusQuery = focused?.name === 'strong-query';
        const querySelection = focusQuery ? [focused.selectionStart, focused.selectionEnd] : null;
        const { entry, mode } = state;
        const numberButton = id => `<button type="button" data-strong-action="entry" data-strong-id="${escape(id)}" class="strong-number-chip${state.selectedId === id ? ' is-active' : ''}" aria-label="Consultar ${escape(id)}" aria-pressed="${state.selectedId === id}">${escape(id)}</button>`;
        const language = entry?.language || (state.selectedId?.startsWith('H') ? 'hebrew' : 'greek');
        let body = '';
        if (mode === 'search') {
            body = `<form class="strong-search-form"><label for="strong-query">Buscar en el diccionario</label><div class="strong-search-row"><input id="strong-query" name="strong-query" type="search" value="${escape(state.query)}" placeholder="H430, G26 o una palabra" autocomplete="off" maxlength="120"><button type="submit" aria-label="Buscar en Strong">Buscar</button></div><select name="strong-language" aria-label="Idioma del diccionario"><option value="all"${state.language === 'all' ? ' selected' : ''}>Hebreo y griego</option><option value="hebrew"${state.language === 'hebrew' ? ' selected' : ''}>Hebreo y arameo</option><option value="greek"${state.language === 'greek' ? ' selected' : ''}>Griego</option></select></form>`;
            if (!state.query) body += '<p class="strong-help">Consulta el número que aparece junto a una palabra o busca por su significado.</p>';
            if (state.results) body += state.results.length
                ? `<div class="strong-search-results" aria-label="Resultados del diccionario">${state.results.map(result => `<button type="button" data-strong-action="entry" data-strong-id="${escape(result.id)}"><span class="strong-result-id">${escape(result.id)}</span><span><b dir="auto">${escape(result.lemma || result.id)}</b> <i>${escape(result.transliteration || '')}</i><small>${escape(String(result.definition || '').slice(0, 160))}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div><p class="strong-help">${state.results.length === 40 ? 'Primeras 40 entradas. Afina tu búsqueda para ver otras.' : `${state.results.length} entrada${state.results.length === 1 ? '' : 's'}.`}</p>`
                : '<p class="strong-help">No hay coincidencias. Prueba con un número Strong u otra palabra.</p>';
        } else if (mode === 'verse') {
            body = `<h3>Otras entradas del pasaje</h3><p class="strong-help">La fuente asocia estas entradas al pasaje, sin precisar una posición en el texto. Consúltalas junto con el pasaje completo.</p><div class="strong-related">${state.ids.map(numberButton).join('')}</div>`;
        } else if (entry) {
            body = `<div class="strong-entry-heading"><div class="strong-entry-meta"><span>${languageName(language)}</span><span class="strong-entry-number">${escape(entry.id)}</span></div><h3 class="strong-lemma" dir="${language === 'greek' ? 'ltr' : 'rtl'}" lang="${language === 'greek' ? 'el' : language === 'aramaic' ? 'arc' : 'he'}">${escape(entry.lemma || entry.id)}</h3>${entry.transliteration ? `<p class="strong-transliteration">${escape(entry.transliteration)}</p>` : ''}${entry.pronunciation && entry.pronunciation !== entry.transliteration ? `<p class="strong-pronunciation">Pronunciación: ${escape(entry.pronunciation)}</p>` : ''}</div><section class="strong-definition"><h4>Significado</h4>${paragraphs(entry.definition)}</section>${entry.derivation ? `<section class="strong-derivation"><h4>Origen de la palabra</h4>${paragraphs(entry.derivation)}</section>` : ''}${entry.related?.length ? `<section class="strong-related-section"><h4>Palabras relacionadas</h4><div class="strong-related">${entry.related.map(numberButton).join('')}</div></section>` : ''}<p class="strong-context-note">Lee este significado junto con el contexto del pasaje.</p>`;
        }
        if (state.loading) body += '<p class="strong-loading" role="status">Cargando diccionario…</p>';
        if (state.error) body += `<div class="strong-error" role="status"><p>${escape(state.error)}</p><button type="button" data-strong-action="retry">Reintentar</button></div>`;
        state.panel.innerHTML = `<div class="strong-panel-top"><span class="strong-eyebrow">Diccionario Strong</span><div>${mode !== 'search' ? '<button type="button" data-strong-action="search" aria-label="Buscar otra palabra">Buscar</button>' : ''}<button type="button" class="strong-close" data-strong-action="close" aria-label="Cerrar diccionario Strong">×</button></div></div>${state.word || state.reference ? `<div class="strong-word-context">${state.word ? `<h2>«${escape(state.word)}»</h2>` : ''}<p>${escape(state.reference)} · RVR1960</p></div>` : ''}${mode === 'entry' && (state.history.length || state.results) ? '<button type="button" class="strong-back" data-strong-action="back">← Volver</button>' : ''}${mode === 'entry' && state.ids.length > 1 ? `<div class="strong-word-entries" aria-label="Entradas de esta expresión">${state.ids.map(numberButton).join('')}</div>` : ''}<div class="strong-panel-body" aria-busy="${state.loading ? 'true' : 'false'}">${body}</div><details class="strong-panel-attribution"><summary>Fuentes del diccionario</summary><p>Definiciones en español: James Strong · Editorial Caribe, edición 2002; módulo StrongEsp, Biblioteca Hispana. Se conserva su aviso de derechos.</p><p>Lemas: <a href="https://github.com/openscriptures/strongs/tree/0acd2f251c2d35ff8db2dece4e0593979d3ac223" target="_blank" rel="noopener noreferrer">Open Scriptures · CC BY-SA</a>. Los lemas originales se incorporaron a las definiciones españolas por su identificador Strong.</p></details>`;
        this.position();
        if (focusQuery && mode === 'search') {
            const input = state.panel.querySelector('input[name="strong-query"]');
            input?.focus({ preventScroll: true });
            try { input?.setSelectionRange(...querySelection); } catch {}
        } else if (focused) state.panel.focus({ preventScroll: true });
    }
}
