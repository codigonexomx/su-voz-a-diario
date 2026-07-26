/**
 * Responsabilidad: Manejar el estado visual (referencias ancladas, etc.) de las meditaciones de la nueva arquitectura.
 * Dependencias: Ninguna.
 * API pública: getKey, load, save
 * Restricciones: Conservar exactamente claves y formato original.
 */
export const MeditationSessionUIStateStorage = {
    getKey: function(id) {
        return `su-voz-meditation-uistate-${id}`;
    },
    load: function(id) {
        const stored = localStorage.getItem(this.getKey(id));
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { console.error('Error parsing meditation UI state', e); }
        }
        return { pinnedReferences: {} };
    },
    save: function(id, data) {
        localStorage.setItem(this.getKey(id), JSON.stringify(data));
    }
};
