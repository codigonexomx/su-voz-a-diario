/**
 * Contrato oficial del documento completo de una meditacion.
 *
 * @typedef {Object} MeditationDocument
 * @property {Object} metadata
 * @property {string} metadata.date
 * @property {string} metadata.reference
 * @property {string} metadata.version
 * @property {Object} sections
 * @property {string} sections.dios
 * @property {string} sections.aprendizaje
 * @property {string} sections.respuesta
 * @property {string} sections.oracion
 */
(function() {
    const EMPTY_DOCUMENT = Object.freeze({
        metadata: Object.freeze({
            date: '',
            reference: '',
            version: ''
        }),
        sections: Object.freeze({
            dios: '',
            aprendizaje: '',
            respuesta: '',
            oracion: ''
        })
    });

    function text(value) {
        return String(value ?? '');
    }

    function create(input = {}) {
        const metadata = input.metadata || {};
        const sections = input.sections || {};

        return {
            metadata: {
                date: text(metadata.date),
                reference: text(metadata.reference),
                version: text(metadata.version)
            },
            sections: {
                dios: text(sections.dios),
                aprendizaje: text(sections.aprendizaje),
                respuesta: text(sections.respuesta),
                oracion: text(sections.oracion)
            }
        };
    }

    window.DocumentFactory = {
        create,
        EMPTY_DOCUMENT
    };
})();
