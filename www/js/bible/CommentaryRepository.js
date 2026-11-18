import { lookupRange, validatePackage } from './commentaryLookup.js';

export const REVELATION_VERSE_COUNTS = Object.freeze([20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21]);

/** Lazily loads the native reading edition, shared by Bible and meditations. */
export class CommentaryRepository {
    constructor({ dataPath = './data/commentaries/hendriksen-apocalipsis.json', fetchImpl = (...args) => fetch(...args) } = {}) {
        this.dataPath = dataPath;
        this.fetchImpl = fetchImpl;
        this.package = null;
        this.pending = null;
    }

    async load() {
        if (this.package) return this.package;
        if (this.pending) return this.pending;
        this.pending = (async () => {
            const response = await this.fetchImpl(this.dataPath);
            if (!response?.ok) throw new Error('No se pudo cargar el comentario. Revisa tu conexión e intenta nuevamente.');
            const pkg = validatePackage(await response.json());
            if (pkg.work.id !== 'hendriksen-mas-que-vencedores-es-2005' || pkg.book.id !== 'rev'
                || JSON.stringify(pkg.book.chapterVerseCounts) !== JSON.stringify(REVELATION_VERSE_COUNTS)) {
                throw new Error('El comentario recibido no corresponde a Apocalipsis.');
            }
            for (const key of ['noteGroups', 'assets', 'frontMatter', 'indexes']) {
                if (!Array.isArray(pkg[key])) throw new Error('El comentario está incompleto. Intenta cargarlo de nuevo.');
            }
            const groups = new Set(pkg.noteGroups.map(group => group.id));
            const notes = new Set(pkg.notes.map(note => note.id));
            if (pkg.entries.some(entry => !groups.has(entry.notesGroupId))
                || pkg.noteGroups.some(group => !Array.isArray(group.noteIds) || group.noteIds.some(id => !notes.has(id)))) {
                throw new Error('No se pudieron comprobar las notas del comentario.');
            }
            this.package = pkg;
            return pkg;
        })().finally(() => { this.pending = null; });
        return this.pending;
    }

    bundle(pkg, entries) {
        return {
            work: pkg.work, book: pkg.book, entries,
            contents: pkg.entries, notes: pkg.notes, noteGroups: pkg.noteGroups,
            assets: pkg.assets, frontMatter: pkg.frontMatter, indexes: pkg.indexes,
            quality: pkg.quality
        };
    }

    async getForRange(range) {
        // Reject unrelated books before downloading the work.
        if (range?.start?.bookId !== 'rev' || range?.end?.bookId !== 'rev') {
            throw new RangeError('Este comentario acompaña el libro de Apocalipsis.');
        }
        const pkg = await this.load();
        return this.bundle(pkg, lookupRange(pkg, range));
    }

    getForVerse(point) {
        return this.getForRange({ start: point, end: point });
    }

    async getContents() {
        const pkg = await this.load();
        return this.bundle(pkg, pkg.entries);
    }

    async getEntry(id) {
        const pkg = await this.load();
        const entry = pkg.entries.find(item => item.id === id);
        if (!entry) throw new RangeError('No se encontró esta sección del comentario.');
        return this.bundle(pkg, [entry]);
    }
}

export const commentaryRepository = new CommentaryRepository();
