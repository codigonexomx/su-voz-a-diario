import { WORKSHOP_PASSAGES } from './WorkshopContent.js';
import { normalizeBibleVoiceText } from '../bible/BibleReaderSelection.js';

export const WORKSHOP_BIBLE_VERSION = 'nbla';

export class WorkshopScripture {
    constructor({ getChapter, resolveBookId } = {}) {
        this.getChapter = getChapter;
        this.resolveBookId = resolveBookId;
        this.entries = new Map();
        this.pending = new Map();
        this.chapters = new Map();
    }

    get(id) { return this.entries.get(id); }

    async loadChapter(sourceBookId, chapter) {
        const bookId = this.resolveBookId?.(sourceBookId);
        if (!bookId || typeof this.getChapter !== 'function') throw new Error('NBLA no está disponible.');
        const key = `${bookId}:${chapter}`;
        if (!this.chapters.has(key)) {
            const request = Promise.resolve().then(() => this.getChapter(WORKSHOP_BIBLE_VERSION, bookId, chapter))
                .then(data => {
                    if (data?.versionId !== WORKSHOP_BIBLE_VERSION || data.bookId !== bookId
                        || data.chapter !== chapter || !Array.isArray(data.verses)) {
                        throw new Error('La respuesta no corresponde al capítulo NBLA solicitado.');
                    }
                    return data;
                }).finally(() => this.chapters.delete(key));
            this.chapters.set(key, request);
        }
        return this.chapters.get(key);
    }

    async load(id) {
        if (this.entries.has(id) && !this.entries.get(id).error) return this.entries.get(id);
        if (this.pending.has(id)) return this.pending.get(id);
        const passage = WORKSHOP_PASSAGES[id];
        if (!passage) throw new Error('No se encontró este pasaje.');
        this.entries.delete(id);
        const request = Promise.all(passage.ranges.map(async ([book, chapter, from, to]) => {
            const data = await this.loadChapter(book, chapter);
            const numbers = new Set();
            for (const verse of data.verses) {
                if (!Number.isInteger(verse.number) || verse.number < 1 || numbers.has(verse.number)) {
                    throw new Error('El capítulo NBLA contiene números de versículo inválidos.');
                }
                numbers.add(verse.number);
            }
            const verses = [];
            for (let number = from; number <= to; number++) {
                const verse = data.verses.find(v => v.number === number);
                const text = typeof verse?.text === 'string' ? normalizeBibleVoiceText(verse.text) : '';
                if (!text) throw new Error('El pasaje NBLA está incompleto.');
                verses.push({ number: `${chapter}:${number}`, text });
            }
            return verses;
        })).then(ranges => {
            const result = { ...passage, versionId: WORKSHOP_BIBLE_VERSION, verses: ranges.flat() };
            this.entries.set(id, result);
            return result;
        }).catch(error => {
            this.entries.set(id, { error: true });
            throw error;
        }).finally(() => this.pending.delete(id));
        this.pending.set(id, request);
        return request;
    }
}
