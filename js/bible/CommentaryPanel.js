import { escapeBibleHtml } from '../utils/text.js';

const escape = value => escapeBibleHtml(String(value ?? ''));
export const REVELATION_VERSE_COUNTS = Object.freeze([20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21]);
const point = (chapter, verse) => ({ bookId: 'rev', chapter, verse });
const validPoint = value => value?.bookId === 'rev' && Number.isInteger(value.chapter)
    && value.chapter >= 1 && value.chapter <= 22 && Number.isInteger(value.verse)
    && value.verse >= 1 && value.verse <= REVELATION_VERSE_COUNTS[value.chapter - 1];

export function isCommentaryRange(range) {
    return Boolean(validPoint(range?.start) && validPoint(range?.end)
        && (range.start.chapter < range.end.chapter || (range.start.chapter === range.end.chapter && range.start.verse <= range.end.verse)));
}

// Explicit reference grammar only: never derive a passage from prose or a title.
export function parseCommentaryReference(reference) {
    const match = String(reference || '').trim().match(/^(?:Apocalipsis|Ap\.?|Revelaci[oó]n|Rev\.?)\s+(\d{1,2})(?::(\d{1,2}))?(?:\s*[-–—]\s*(?:(\d{1,2}):)?(\d{1,2}))?$/iu);
    if (!match) return null;
    const chapter = Number(match[1]);
    const hasVerse = Boolean(match[2]);
    if (!hasVerse && match[3]) return null;
    const endChapter = match[3] ? Number(match[3]) : !hasVerse && match[4] ? Number(match[4]) : chapter;
    const range = { start: point(chapter, hasVerse ? Number(match[2]) : 1),
        end: point(endChapter, hasVerse ? Number(match[4] || match[2]) : REVELATION_VERSE_COUNTS[endChapter - 1]) };
    return isCommentaryRange(range) ? range : null;
}

export function formatCommentaryRange(range) {
    if (!isCommentaryRange(range)) return '';
    const { start, end } = range;
    const first = `Apocalipsis ${start.chapter}:${start.verse}`;
    return start.chapter !== end.chapter ? `${first}–${end.chapter}:${end.verse}`
        : start.verse !== end.verse ? `${first}–${end.verse}` : first;
}

const paragraphs = text => String(text || '').split(/\n\s*\n/).filter(part => part.trim())
    .map(part => `<p>${escape(part).replace(/\n/g, '<br>')}</p>`).join('');
const referenceOf = entry => (entry.ranges || []).map(formatCommentaryRange).filter(Boolean).join('; ');
const sourcePages = entry => [...new Set((entry.sourceSpans || []).map(span => span.pdfPage).concat(entry.pdfPage ? [entry.pdfPage] : []))];
const formatSourcePages = pages => {
    const sorted = [...pages].sort((a, b) => a - b);
    const groups = [];
    for (const page of sorted) {
        const last = groups.at(-1);
        if (last && page === last[1] + 1) last[1] = page;
        else groups.push([page, page]);
    }
    return groups.map(([start, end]) => start === end ? String(start) : `${start}–${end}`).join(', ');
};
const readableFrontMatter = bundle => (bundle.frontMatter || []).filter(entry => String(entry.text || '').trim() || entry.visualSupplements?.some(item => String(item.text || '').trim()));
const safeImageSource = asset => {
    const value = String(asset.url || asset.dataUri || asset.file || '');
    return /^(?:data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+|\.\/data\/commentaries\/[a-zA-Z0-9_./-]+)$/.test(value) ? value : '';
};

export function renderCommentaryEntry(entry, bundle = {}) {
    if (!entry) return '<p class="commentary-empty">No hay una sección vinculada a este pasaje.</p>';
    const notes = (bundle.notes || []).filter(note => note.groupId === entry.notesGroupId);
    const assets = (bundle.assets || []).filter(asset => (entry.assetIds || []).includes(asset.id));
    const pages = sourcePages(entry);
    const normalizedText = String(entry.text || '').replace(/\s+/g, ' ').trim();
    const supplements = (entry.visualSupplements || []).filter(item => item.text
        && !normalizedText.includes(String(item.text).replace(/\s+/g, ' ').trim()));
    const children = (bundle.contents || []).filter(item => item.parentId === entry.id);
    return `<article class="commentary-article" aria-label="${escape(entry.title || 'Texto del libro')}">
        <div class="commentary-entry-meta">${escape(referenceOf(entry) || (entry.kind === 'context' ? 'Contexto del libro' : 'Texto del libro'))}</div>
        <h3>${escape(entry.title || 'Texto del libro')}</h3>
        ${pages.length ? `<p class="commentary-page-source">${pages.length === 1 ? 'Página' : 'Páginas'} ${escape(formatSourcePages(pages))} de la edición original</p>` : ''}
        <div class="commentary-prose">${paragraphs(entry.text)}${supplements.map(item => `<section aria-label="${escape(({ 'front-cover': 'Portada', 'back-cover': 'Contraportada', 'credits-missing-line': 'Datos de la edición' })[item.role] || 'Texto de la edición')}">${paragraphs(item.text)}</section>`).join('')}</div>
        ${!normalizedText && children.length ? `<section class="commentary-subsections"><h4>Secciones de este capítulo</h4>${children.map(child => `<button type="button" class="commentary-index-entry" data-commentary-action="entry" data-entry-id="${escape(child.id)}">${escape(child.title)}</button>`).join('')}</section>` : ''}
        ${assets.map(asset => safeImageSource(asset) ? `<figure class="commentary-figure"><img src="${escape(safeImageSource(asset))}" alt="${escape(asset.alt || asset.caption || 'Diagrama del comentario de Apocalipsis')}" loading="lazy"><figcaption>${escape(asset.caption || 'Diagrama de la edición original')}</figcaption></figure>` : '').join('')}
        ${notes.length ? `<details class="commentary-notes"><summary>Notas del capítulo (${notes.length})</summary><p class="commentary-notes-intro">Notas originales del capítulo del comentario al que pertenece esta sección.</p><ol>${notes.map(note => `<li value="${Number.isInteger(note.number) ? note.number : 1}">${paragraphs(note.text)}</li>`).join('')}</ol></details>` : ''}
    </article>`;
}

function renderContents(bundle, openGroups = new Set()) {
    const entries = bundle.contents || bundle.entries || [];
    const button = entry => `<button type="button" class="commentary-index-entry" data-commentary-action="entry" data-entry-id="${escape(entry.id)}" style="--entry-depth:${Math.min(2, Math.max(0, Number(entry.depth) || 0))}"><span>${escape(entry.title)}</span>${referenceOf(entry) ? `<small>${escape(referenceOf(entry))}</small>` : ''}</button>`;
    const roots = entries.filter(entry => !entry.parentId);
    const childrenOf = parent => entries.filter(entry => entry.parentId === parent.id);
    const descendants = parent => childrenOf(parent).map(child => button(child) + descendants(child)).join('');
    return `<section class="commentary-index" aria-label="Índice del libro"><h3>Contenido del libro</h3><p>Introducciones, comentario y notas de la obra completa.</p>
        ${roots.map(entry => `<details data-index-group="${escape(entry.id)}"${openGroups.has(entry.id) ? ' open' : ''}><summary>${escape(entry.title)}</summary>${button(entry)}${descendants(entry)}</details>`).join('')}
        <details data-index-group="edition"${openGroups.has('edition') ? ' open' : ''}><summary>Preliminares e índices de la edición</summary>${readableFrontMatter(bundle).map((entry, i) => button({ ...entry, title: entry.title || `Preliminares · página ${entry.pdfPage || i + 1}` })).join('')}${(bundle.indexes || []).map(button).join('')}</details>
    </section>`;
}

/** Native text reader. Mounts inside a meditation shell when it is supplied. */
export class CommentaryPanel {
    constructor({ repository }) {
        this.repository = repository;
        this.state = null;
        this.epoch = 0;
    }

    close({ restoreFocus = true } = {}) {
        this.epoch++;
        const state = this.state;
        if (!state) return;
        this.state = null;
        state.overlay.remove();
        for (const [element, inert] of state.background) element.inert = inert;
        if (restoreFocus) {
            const target = state.returnElement?.isConnected ? state.returnElement : state.anchor;
            target?.isConnected && target.focus({ preventScroll: true });
            if (state.selection?.every(range => range.startContainer.isConnected && range.endContainer.isConnected)) {
                const selection = window.getSelection?.();
                selection?.removeAllRanges();
                for (const range of state.selection) selection?.addRange(range);
            }
            state.onClose?.();
        }
    }

    async open({ anchor, range, mountRoot = document.body, returnLabel = 'Volver a la Biblia', onClose, isCurrent = () => true }) {
        if (!isCommentaryRange(range)) return false;
        this.close({ restoreFocus: false });
        const overlay = document.createElement('div');
        overlay.className = 'commentary-overlay';
        const panel = document.createElement('section');
        panel.className = 'commentary-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'Comentario de William Hendriksen');
        panel.tabIndex = -1;
        overlay.append(panel);
        const active = document.activeElement;
        const selection = window.getSelection?.();
        const savedRanges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
        const state = { overlay, panel, anchor, range, returnLabel, onClose, isCurrent,
            returnElement: active?.matches?.('input, textarea, [contenteditable="true"]') ? active : anchor,
            selection: savedRanges, background: [...mountRoot.children].map(element => [element, element.inert]),
            mode: 'passage', selectedId: null, passageId: null, bundle: null, contentsBundle: null, loading: true, error: '', scroll: new Map(), indexScroll: 0, openGroups: new Set() };
        this.state = state;
        mountRoot.append(overlay);
        for (const [element] of state.background) element.inert = true;
        overlay.addEventListener('click', event => {
            event.stopPropagation();
            if (event.target === overlay) this.close();
            else this.handleClick(event);
        });
        overlay.addEventListener('keydown', event => {
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
            if (event.key !== 'Tab') return;
            const focusable = [...panel.querySelectorAll('button:not([disabled]), select, summary, a[href]')]
                .filter(element => element.getClientRects().length);
            const first = focusable[0], last = focusable.at(-1);
            if (!first) { event.preventDefault(); panel.focus({ preventScroll: true }); }
            else if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
                event.preventDefault(); last.focus({ preventScroll: true });
            } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) {
                event.preventDefault(); first.focus({ preventScroll: true });
            }
        });
        overlay.addEventListener('change', event => {
            if (event.target.matches('[data-commentary-select]')) this.selectEntry(event.target.value);
        });
        this.render();
        panel.focus({ preventScroll: true });
        await this.loadPassage();
        return true;
    }

    async loadPassage() {
        const state = this.state;
        if (!state) return;
        const epoch = ++this.epoch;
        state.loading = true; state.error = ''; this.render();
        try {
            const bundle = await this.repository.getForRange(state.range);
            if (this.state !== state || epoch !== this.epoch) return;
            if (!state.isCurrent()) { this.close({ restoreFocus: false }); return; }
            state.bundle = bundle;
            state.selectedId = bundle.entries?.[0]?.id || null;
            state.passageId = state.selectedId;
        } catch {
            if (this.state !== state || epoch !== this.epoch) return;
            state.error = 'No se pudo cargar el comentario. Revisa tu conexión y vuelve a intentarlo.';
        }
        if (this.state !== state || epoch !== this.epoch) return;
        if (!state.isCurrent()) { this.close({ restoreFocus: false }); return; }
        state.loading = false; this.render();
    }

    async showContents() {
        const state = this.state;
        if (!state) return;
        this.rememberScroll(); state.mode = 'contents'; state.error = '';
        if (state.contentsBundle) { this.render(); return; }
        const epoch = ++this.epoch;
        state.loading = true; this.render();
        try {
            const bundle = await this.repository.getContents();
            if (this.state !== state || epoch !== this.epoch) return;
            if (!state.isCurrent()) { this.close({ restoreFocus: false }); return; }
            state.contentsBundle = { ...bundle, contents: bundle.contents || bundle.entries };
        } catch {
            if (this.state !== state || epoch !== this.epoch) return;
            state.error = 'No se pudo abrir el índice. Vuelve a intentarlo.';
        }
        if (this.state !== state || epoch !== this.epoch) return;
        state.loading = false; this.render();
    }

    rememberScroll() {
        const state = this.state;
        if (!state) return;
        const scrollTop = state.panel.querySelector('.commentary-body')?.scrollTop || 0;
        if (state.mode === 'contents') {
            state.indexScroll = scrollTop;
            state.openGroups = new Set([...state.panel.querySelectorAll('[data-index-group][open]')].map(element => element.dataset.indexGroup));
        } else if (state.selectedId) state.scroll.set(state.selectedId, scrollTop);
    }

    selectEntry(id) {
        const state = this.state;
        if (!state) return;
        const entries = this.availableEntries();
        if (!entries.some(entry => entry.id === id)) return;
        this.rememberScroll();
        state.selectedId = id;
        if (state.mode === 'contents') state.mode = 'book';
        if (state.mode === 'passage') state.passageId = id;
        this.render();
    }

    availableEntries() {
        const state = this.state;
        if (!state) return [];
        if (state.mode === 'passage') return state.bundle?.entries || [];
        const bundle = state.contentsBundle || state.bundle || {};
        return [...(bundle.contents || bundle.entries || []), ...readableFrontMatter(bundle).map((entry, i) => ({ ...entry, title: entry.title || `Preliminares · página ${entry.pdfPage || i + 1}` })), ...(bundle.indexes || [])];
    }

    handleClick(event) {
        const button = event.target.closest('[data-commentary-action]');
        const state = this.state;
        if (!button || !state) return;
        const action = button.dataset.commentaryAction;
        if (action === 'close') this.close();
        if (action === 'contents') void this.showContents();
        if (action === 'passage') {
            ++this.epoch; this.rememberScroll(); state.mode = 'passage'; state.loading = false; state.error = '';
            if (!state.bundle) void this.loadPassage();
            else { state.selectedId = state.passageId || state.bundle.entries?.[0]?.id || null; this.render(); }
        }
        if (action === 'entry') {
            if (state.mode === 'passage' && !state.bundle?.entries?.some(entry => entry.id === button.dataset.entryId)) {
                state.contentsBundle ||= state.bundle;
                state.mode = 'book';
            }
            this.selectEntry(button.dataset.entryId);
        }
        if (action === 'retry') void (state.mode === 'contents' ? this.showContents() : this.loadPassage());
        if (action === 'previous' || action === 'next') {
            const entries = this.availableEntries();
            const index = entries.findIndex(entry => entry.id === state.selectedId);
            const entry = entries[index + (action === 'next' ? 1 : -1)];
            if (entry) this.selectEntry(entry.id);
        }
    }

    render() {
        const state = this.state;
        if (!state) return;
        const hadFocus = state.panel.contains(document.activeElement);
        const focusedSelect = hadFocus && document.activeElement.matches('[data-commentary-select]');
        const focusedAction = hadFocus ? document.activeElement.dataset?.commentaryAction : null;
        const bundle = (state.mode === 'passage' ? state.bundle : state.contentsBundle) || state.bundle || {};
        const work = bundle.work || {};
        const entries = this.availableEntries();
        const selected = entries.find(entry => entry.id === state.selectedId);
        const selectedIndex = entries.indexOf(selected);
        let body = state.loading ? '<p class="commentary-status" role="status">Cargando comentario…</p>'
            : state.error ? `<div class="commentary-status" role="status"><p>${escape(state.error)}</p><button type="button" data-commentary-action="retry">Reintentar</button></div>`
            : state.mode === 'contents' ? renderContents(bundle, state.openGroups) : renderCommentaryEntry(selected, bundle);
        const navigation = !state.loading && !state.error && state.mode !== 'contents' && entries.length > 1
            ? `<div class="commentary-section-navigation"><label>Sección del comentario<select data-commentary-select>${entries.map(entry => `<option value="${escape(entry.id)}"${entry.id === selected?.id ? ' selected' : ''}>${escape(entry.title)}</option>`).join('')}</select></label><div><button type="button" data-commentary-action="previous"${selectedIndex <= 0 ? ' disabled' : ''} aria-label="Sección anterior">← Anterior</button><span>${selectedIndex + 1} de ${entries.length}</span><button type="button" data-commentary-action="next"${selectedIndex >= entries.length - 1 ? ' disabled' : ''} aria-label="Sección siguiente">Siguiente →</button></div></div>` : '';
        state.panel.innerHTML = `<header class="commentary-header"><div><span class="commentary-eyebrow">Comentario bíblico</span><h2>${escape(work.title || 'Más que vencedores')}</h2><p>${escape(work.author || 'William Hendriksen')}</p></div><button type="button" class="commentary-close" data-commentary-action="close" aria-label="Cerrar comentario">×</button></header>
            <div class="commentary-origin">${escape(formatCommentaryRange(state.range))}</div>
            <nav class="commentary-tabs" aria-label="Navegación del comentario"><button type="button" data-commentary-action="passage" aria-pressed="${state.mode === 'passage'}">Este pasaje</button><button type="button" data-commentary-action="contents" aria-pressed="${state.mode !== 'passage'}">Índice del libro</button></nav>
            ${navigation}<div class="commentary-body" tabindex="-1" aria-busy="${state.loading}">${body}
            ${!state.loading && !state.error ? `<details class="commentary-attribution"><summary>Acerca de esta obra</summary><p>${escape(work.title || 'Más que vencedores')}. ${escape(work.subtitle || '')}</p><p>${escape(work.author || 'William Hendriksen')}${work.translator ? ` · Traducción: ${escape(work.translator)}` : ''}.</p><p>${escape(work.copyrightNotice || '')}</p>${work.isbn ? `<p>ISBN: ${escape(work.isbn)}</p>` : ''}</details>` : ''}</div>
            <footer class="commentary-footer"><button type="button" data-commentary-action="close">${escape(state.returnLabel)}</button></footer>`;
        const bodyElement = state.panel.querySelector('.commentary-body');
        bodyElement.scrollTop = state.mode === 'contents' ? state.indexScroll : state.scroll.get(state.selectedId) || 0;
        if (focusedSelect) state.panel.querySelector('[data-commentary-select]')?.focus({ preventScroll: true });
        else if (focusedAction) {
            const target = [...state.panel.querySelectorAll('[data-commentary-action]')].find(button => button.dataset.commentaryAction === focusedAction && !button.disabled);
            (target || state.panel.querySelector('[data-commentary-select]') || state.panel).focus({ preventScroll: true });
        }
    }
}
