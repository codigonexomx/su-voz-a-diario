// Progressive chapter loading. Each chapter keeps its own selection/annotation key.
export function adjacentChapter(books, bookId, chapter, direction) {
    const index = books.findIndex(book => book.id === bookId);
    if (index < 0 || ![-1, 1].includes(direction)) return null;
    const next = chapter + direction;
    if (next >= 1 && next <= books[index].chapters) return { book: books[index], chapter: next };
    const book = books[index + direction];
    return book ? { book, chapter: direction > 0 ? 1 : book.chapters } : null;
}

export class ContinuousReader {
    constructor({ root, books, initial, load, render, activate, restore, alignInitial = false, position = null }) {
        Object.assign(this, { root, books, load, render, activate, restore });
        this.entries = [initial];
        this.pending = new Set();
        this.failed = new Set();
        this.disposed = false;
        initial.element = root.querySelector('.reading-text-shell');
        this.decorate(initial);
        this.top = this.boundary(-1);
        this.bottom = this.boundary(1);
        root.prepend(this.top);
        root.append(this.bottom);
        if (alignInitial) {
            const heading = initial.element.querySelector('.continuous-chapter-title');
            const guard = (document.querySelector('.bible-reader-fixed-header')?.getBoundingClientRect().bottom || 72) + 16;
            window.scrollBy({ top: heading.getBoundingClientRect().top - guard, behavior: 'instant' });
        }
        if (position?.verseNumber) {
            const verse = initial.element.querySelector(`.verse-item[data-verse-number="${Number(position.verseNumber)}"]`);
            if (verse) window.scrollBy({ top: verse.getBoundingClientRect().top - position.verseOffset, behavior: 'instant' });
        }
        this.onScroll = () => {
            if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = null; this.update(); });
        };
        window.addEventListener('scroll', this.onScroll, { passive: true });
        this.update();
    }
    alive() { return !this.disposed && this.root.isConnected; }
    dispose() {
        this.disposed = true;
        window.removeEventListener('scroll', this.onScroll);
        cancelAnimationFrame(this.frame);
    }
    decorate(entry) {
        this.studySources(entry);
        entry.element.dataset.continuousBook = entry.book.id;
        entry.element.dataset.continuousChapter = entry.chapter;
        if (!entry.element.querySelector('.continuous-chapter-title')) {
            const heading = document.createElement('h2');
            heading.className = 'continuous-chapter-title';
            heading.textContent = `${entry.book.name} ${entry.chapter}`;
            entry.element.prepend(heading);
        }
    }
    studySources(entry) {
        if (entry.data.versionId !== 'rv1909' || entry.element.querySelector('.continuous-study-sources')) return;
        const details = document.createElement('details');
        details.className = 'continuous-study-sources';
        details.innerHTML = '<summary>Acerca de las ayudas de estudio</summary><p>Los títulos y las notas son ayudas adicionales adaptadas al español a partir de Berean Standard Bible; no forman parte del texto original de RV1909.</p><p>Referencias cruzadas: <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noopener noreferrer">OpenBible.info</a> (CC BY). Su Voz a Diario las ordena y muestra las de valoración positiva. Fuente de títulos y notas: <a href="https://berean.bible/" target="_blank" rel="noopener noreferrer">Berean Standard Bible</a>.</p>';
        entry.element.append(details);
    }
    boundary(direction) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'continuous-boundary';
        button.textContent = direction < 0 ? 'Cargar capítulo anterior' : 'Cargar capítulo siguiente';
        button.addEventListener('click', () => { this.failed.delete(direction); void this.extend(direction); });
        return button;
    }
    activeEntry() {
        const guard = (document.querySelector('.bible-reader-fixed-header')?.getBoundingClientRect().bottom || 72) + 20;
        return this.entries.find(entry => entry.element.getBoundingClientRect().bottom > guard) || this.entries.at(-1);
    }
    anchor() {
        const entry = this.activeEntry();
        const guard = (document.querySelector('.bible-reader-fixed-header')?.getBoundingClientRect().bottom || 72) + 20;
        const verse = [...entry.element.querySelectorAll('.verse-item')].find(v => v.getBoundingClientRect().bottom > guard);
        return { entry, verse, top: verse?.getBoundingClientRect().top };
    }
    update() {
        if (!this.alive()) { this.dispose(); return; }
        const entry = this.activeEntry();
        if (entry !== this.active) { this.active = entry; this.activate(entry); }
        for (const direction of [-1, 1]) {
            const edge = direction < 0 ? this.top : this.bottom;
            const rect = edge.getBoundingClientRect();
            if (rect.bottom > -300 && rect.top < window.innerHeight + 400 && !this.failed.has(direction)) void this.extend(direction);
        }
    }
    async extend(direction) {
        if (!this.alive() || this.pending.has(direction)) return;
        const edge = direction < 0 ? this.top : this.bottom;
        const end = direction < 0 ? this.entries[0] : this.entries.at(-1);
        const next = adjacentChapter(this.books, end.book.id, end.chapter, direction);
        if (!next) { edge.hidden = true; return; }
        this.pending.add(direction);
        edge.disabled = true;
        edge.textContent = `Cargando ${next.book.name} ${next.chapter}…`;
        try {
            const data = await this.load(next.book.id, next.chapter);
            if (!this.alive()) return;
            const entry = { ...next, data };
            const fragment = document.createRange().createContextualFragment(this.render(entry));
            entry.element = fragment.firstElementChild;
            this.decorate(entry);
            const anchor = this.anchor();
            if (direction < 0) { this.top.after(entry.element); this.entries.unshift(entry); }
            else { this.bottom.before(entry.element); this.entries.push(entry); }
            this.restore(entry);
            if (direction < 0 && anchor.verse) window.scrollBy({ top: anchor.verse.getBoundingClientRect().top - anchor.top, behavior: 'instant' });
            edge.textContent = direction < 0 ? 'Cargar capítulo anterior' : 'Cargar capítulo siguiente';
        } catch {
            if (!this.alive()) return;
            this.failed.add(direction);
            edge.textContent = `No se pudo cargar ${next.book.name} ${next.chapter}. Toca para reintentar.`;
        } finally {
            this.pending.delete(direction);
            edge.disabled = false;
        }
    }
    findVoice(key) { return this.entries.find(e => `${e.book.name}-${e.chapter}` === key); }
    returnToVoice(state) {
        const entry = this.findVoice(state.key);
        if (!entry) return;
        const number = state.verses[state.currentVerseIndex]?.number;
        const verse = entry.element.querySelector(`.verse-item[data-verse-number="${Number(number)}"]`);
        (verse || entry.element).scrollIntoView({ block: 'center', behavior: 'auto' });
    }
}
