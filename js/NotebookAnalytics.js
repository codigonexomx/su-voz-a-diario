/**
 * Responsabilidad: Calcula las estadísticas, palabras escritas y completitud de las meditaciones.
 * Dependencias: Ninguna (Módulo puro).
 * API pública: getStepStats, getGlobalStats, updateTimestamps
 * Restricciones: No debe persistir datos. No debe leer variables globales ni DOM.
 */

export const NotebookAnalytics = {
    // Regla de completitud: al menos 5 palabras (ignorando espacios/saltos)
    getStepStats: function(text, refs = []) {
        const cleanText = (text || '').trim();
        const words = cleanText ? cleanText.split(/\s+/).length : 0;
        return {
            chars: cleanText.length,
            words: words,
            refsCount: refs.length,
            isComplete: words >= 5 // Regla definida por el usuario
        };
    },

    getGlobalStats: function(noteObj, allRefsObj = {}) {
        let totalWords = 0;
        let totalRefs = 0;
        let completedSteps = 0;
        const steps = ['dios', 'aprendizaje', 'respuesta', 'oracion'];

        steps.forEach(stepId => {
            const text = noteObj[stepId] || '';
            const refs = allRefsObj[stepId] || [];
            const stats = this.getStepStats(text, refs);
            
            totalWords += stats.words;
            totalRefs += stats.refsCount;
            if (stats.isComplete) completedSteps++;
        });

        return {
            totalWords,
            totalRefs,
            completedSteps,
            totalSteps: steps.length,
            estimatedWriteTimeMins: Math.ceil(totalWords / 40)
        };
    },

    updateTimestamps: function(noteObj) {
        const now = Date.now();
        if (!noteObj._createdAt) {
            noteObj._createdAt = now;
        }
        noteObj._lastEditedAt = now;
        return noteObj;
    }
};
