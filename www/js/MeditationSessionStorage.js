import { MeditationLibrary } from './MeditationLibrary.js';

/**
 * Responsabilidad: Manejar la persistencia de las meditaciones de la nueva arquitectura y su índice de metadatos.
 * Dependencias: MeditationLibrary (para mantener el índice de búsqueda sincronizado).
 * API pública: getIndexKey, getSessionKey, getAllMetadata, saveAllMetadata, get, save
 * Restricciones: Conservar exactamente claves, formato original y metadatos de migración.
 */
export const MeditationSessionStorage = {
    pendingSessions: new Map(),
    mergePendingMetadata: function(index) {
        const result = new Map(index.map(item => [item.id, item]));
        for (const raw of this.pendingSessions.values()) {
            const { notes, references, ...metadata } = JSON.parse(raw);
            result.set(metadata.id, metadata);
        }
        return [...result.values()];
    },
    getIndexKey: function() {
        return 'su-voz-meditation-index';
    },
    getSessionKey: function(id) {
        return `su-voz-meditation-${id}`;
    },
    getAllMetadata: function() {
        const stored = localStorage.getItem(this.getIndexKey());
        if (stored) {
            try {
                const index = JSON.parse(stored);
                if (Array.isArray(index) && index.every(item => item && typeof item.id === 'string')) return this.mergePendingMetadata(index);
            } catch (e) { console.error('Error parsing meditation index', e); }
        }
        // Recover from session records without deleting the damaged index or any note.
        const recovered = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith('su-voz-meditation-') || key === this.getIndexKey()) continue;
            try {
                const session = JSON.parse(localStorage.getItem(key));
                if (session && typeof session.id === 'string' && key === this.getSessionKey(session.id)) {
                    const { notes, ...metadata } = session;
                    recovered.push(metadata);
                }
            } catch { /* Keep malformed records available for a manual backup. */ }
        }
        return this.mergePendingMetadata(recovered);
    },
    saveAllMetadata: function(indexData) {
        if (!Array.isArray(indexData)) throw new TypeError('Invalid meditation index');
        localStorage.setItem(this.getIndexKey(), JSON.stringify(indexData));
    },
    get: function(id) {
        const stored = this.pendingSessions.get(id) || localStorage.getItem(this.getSessionKey(id));
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { console.error('Error parsing meditation session', e); }
        }
        return null;
    },
    save: function(session) {
        if (!session || typeof session.id !== 'string' || !session.id) throw new TypeError('Invalid meditation session');
        const index = this.getAllMetadata();
        const existingIdx = index.findIndex(m => m.id === session.id);
        
        const metadata = {
            id: session.id,
            readingId: session.readingId,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            completedAt: session.completedAt,
            status: session.status,
            favorite: session.favorite === true,
            title: session.title,
            bibleVersion: session.bibleVersion,
            bookId: session.bookId,
            chapter: session.chapter,
            verseStart: session.verseStart,
            verseEnd: session.verseEnd,
            metadata: session.metadata || null
        };
        
        if (existingIdx >= 0) {
            index[existingIdx] = metadata;
        } else {
            index.push(metadata);
        }
        const sessionKey = this.getSessionKey(session.id);
        const previousSession = localStorage.getItem(sessionKey);
        const serialized = JSON.stringify(session);
        try {
            localStorage.setItem(sessionKey, serialized);
            this.saveAllMetadata(index);
        } catch (error) {
            this.pendingSessions.set(session.id, serialized);
            try {
                if (previousSession === null) localStorage.removeItem(sessionKey);
                else localStorage.setItem(sessionKey, previousSession);
            } catch (rollbackError) {
                console.error('[Meditation] No se pudo restaurar el registro anterior:', rollbackError);
            }
            throw error;
        }
        this.pendingSessions.delete(session.id);
        
        // Mantener actualizado el índice de búsqueda en memoria
        if (typeof MeditationLibrary !== 'undefined' && typeof MeditationLibrary.updateSessionInIndex === 'function') {
            MeditationLibrary.updateSessionInIndex(session);
        }
    }
};
