import { lookupRange, validatePackage } from './commentaryLookup.js';

export const REVELATION_VERSE_COUNTS = Object.freeze([20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21]);
export const DEFAULT_COMMENTARY_WORK_ID = 'hendriksen-mas-que-vencedores-es-2005';
export const COMMENTARY_WORKS = Object.freeze([
    Object.freeze({ id: DEFAULT_COMMENTARY_WORK_ID, label: 'William Hendriksen · Más que vencedores',
        title: 'Más que vencedores', author: 'William Hendriksen',
        dataPath: './data/commentaries/hendriksen-apocalipsis.json' }),
    Object.freeze({ id: 'matthew-henry-apocalipsis', label: 'Matthew Henry · Comentario conciso',
        title: 'Comentario conciso de Apocalipsis', author: 'Matthew Henry',
        dataPath: './data/commentaries/matthew-henry-apocalipsis.json' })
]);

/** Lazily loads each native reading edition, shared by Bible and meditations. */
export class CommentaryRepository {
    constructor({ dataPath, fetchImpl = (...args) => fetch(...args) } = {}) {
        this.works = COMMENTARY_WORKS.map(work => dataPath && work.id === DEFAULT_COMMENTARY_WORK_ID ? { ...work, dataPath } : work);
        this.fetchImpl = fetchImpl;
        this.packages = new Map();
        this.pending = new Map();
    }

    listWorks() {
        return this.works.map(({ id, label, title, author }) => ({ id, label, title, author }));
    }

    async load(workId = DEFAULT_COMMENTARY_WORK_ID) {
        const work = this.works.find(item => item.id === workId);
        if (!work) throw new RangeError('No se encontró este comentario.');
        if (this.packages.has(workId)) return this.packages.get(workId);
        if (this.pending.has(workId)) return this.pending.get(workId);
        const request = (async () => {
            const response = await this.fetchImpl(work.dataPath);
            if (!response?.ok) throw new Error('No se pudo cargar el comentario. Revisa tu conexión e intenta nuevamente.');
            const pkg = validatePackage(await response.json());
            if (pkg.work.id !== workId || pkg.book.id !== 'rev'
                || JSON.stringify(pkg.book.chapterVerseCounts) !== JSON.stringify(REVELATION_VERSE_COUNTS)) {
                throw new Error('El comentario recibido no corresponde a la obra seleccionada de Apocalipsis.');
            }
            for (const key of ['noteGroups', 'assets', 'frontMatter', 'indexes']) {
                if (!Array.isArray(pkg[key])) throw new Error('El comentario está incompleto. Intenta cargarlo de nuevo.');
            }
            const groups = new Set(pkg.noteGroups.map(group => group.id));
            const notes = new Set(pkg.notes.map(note => note.id));
            if (pkg.entries.some(entry => entry.notesGroupId != null && !groups.has(entry.notesGroupId))
                || pkg.noteGroups.some(group => !Array.isArray(group.noteIds) || group.noteIds.some(id => !notes.has(id)))
                || pkg.notes.some(note => !groups.has(note.groupId))) {
                throw new Error('No se pudieron comprobar las notas del comentario.');
            }
            this.packages.set(workId, pkg);
            return pkg;
        })().finally(() => { this.pending.delete(workId); });
        this.pending.set(workId, request);
        return request;
    }

    bundle(pkg, entries) {
        return {
            work: pkg.work, book: pkg.book, entries,
            contents: pkg.entries, notes: pkg.notes, noteGroups: pkg.noteGroups,
            assets: pkg.assets, frontMatter: pkg.frontMatter, indexes: pkg.indexes,
            quality: pkg.quality
        };
    }

    async getForRange(range, workId = DEFAULT_COMMENTARY_WORK_ID) {
        // Reject unrelated books before downloading the work.
        if (range?.start?.bookId !== 'rev' || range?.end?.bookId !== 'rev') {
            throw new RangeError('Este comentario acompaña el libro de Apocalipsis.');
        }
        const pkg = await this.load(workId);
        return this.bundle(pkg, lookupRange(pkg, range));
    }

    getForVerse(point, workId = DEFAULT_COMMENTARY_WORK_ID) {
        return this.getForRange({ start: point, end: point }, workId);
    }

    async getContents(workId = DEFAULT_COMMENTARY_WORK_ID) {
        const pkg = await this.load(workId);
        return this.bundle(pkg, pkg.entries);
    }

    async getEntry(id, workId = DEFAULT_COMMENTARY_WORK_ID) {
        const pkg = await this.load(workId);
        const entry = pkg.entries.find(item => item.id === id);
        if (!entry) throw new RangeError('No se encontró esta sección del comentario.');
        return this.bundle(pkg, [entry]);
    }
}

export const commentaryRepository = new CommentaryRepository();
