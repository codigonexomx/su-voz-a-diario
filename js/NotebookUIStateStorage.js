/**
 * Responsabilidad: Manejar el estado visual antiguo del cuadernillo.
 * Dependencias: Ninguna.
 * API pública: getKey, load, save
 * Restricciones: Conservar exactamente claves y formato original.
 */
export const NotebookUIStateStorage = {
    getKey: function(dateStr) {
        return `su-voz-devotional-uistate-${dateStr}`;
    },
    load: function(dateStr) {
        const stored = localStorage.getItem(this.getKey(dateStr));
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { console.error('Error parsing UI state', e); }
        }
        return null;
    },
    save: function(dateStr, data) {
        localStorage.setItem(this.getKey(dateStr), JSON.stringify(data));
    }
};
