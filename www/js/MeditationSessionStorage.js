import { MeditationLibrary } from './MeditationLibrary.js';

/**
 * Responsabilidad: Manejar la persistencia de las meditaciones de la nueva arquitectura y su índice de metadatos.
 * Dependencias: MeditationLibrary (para mantener el índice de búsqueda sincronizado).
 * API pública: getIndexKey, getSessionKey, getAllMetadata, saveAllMetadata, get, save
 * Restricciones: Conservar exactamente claves, formato original y metadatos de migración.
 */
export const MeditationSessionStorage = {
    getIndexKey: function() {
        return 'su-voz-meditation-index';
    },
    getSessionKey: function(id) {
        return `su-voz-meditation-${id}`;
    },
    getAllMetadata: function() {
        const stored = localStorage.getItem(this.getIndexKey());
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { console.error('Error parsing meditation index', e); }
        }
        return [];
    },
    saveAllMetadata: function(indexData) {
        localStorage.setItem(this.getIndexKey(), JSON.stringify(indexData));
    },
    get: function(id) {
        const stored = localStorage.getItem(this.getSessionKey(id));
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { console.error('Error parsing meditation session', e); }
        }
        return null;
    },
    save: function(session) {
        // Guardar la sesión completa
        localStorage.setItem(this.getSessionKey(session.id), JSON.stringify(session));
        
        // Actualizar el índice (solo metadatos)
        const index = this.getAllMetadata();
        const existingIdx = index.findIndex(m => m.id === session.id);
        
        const metadata = {
            id: session.id,
            readingId: session.readingId,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            completedAt: session.completedAt,
            status: session.status,
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
        this.saveAllMetadata(index);
        
        // Mantener actualizado el índice de búsqueda en memoria
        if (typeof MeditationLibrary !== 'undefined' && typeof MeditationLibrary.updateSessionInIndex === 'function') {
            MeditationLibrary.updateSessionInIndex(session);
        }
    }
};
