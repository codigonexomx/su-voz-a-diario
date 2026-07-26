/**
 * Responsabilidad: Manejar la persistencia antigua del cuadernillo.
 * Dependencias: Ninguna.
 * API pública: getKey, load, save
 * Restricciones: Conservar exactamente claves y formato original.
 */
export const NotebookStorage = {
    getKey: function(dateStr) {
        return `su-voz-devotional-refs-${dateStr}`;
    },
    load: function(dateStr) {
        const stored = localStorage.getItem(this.getKey(dateStr));
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { console.error('Error parsing devotional references', e); }
        }
        return null;
    },
    save: function(dateStr, data) {
        localStorage.setItem(this.getKey(dateStr), JSON.stringify(data));
    }
};
