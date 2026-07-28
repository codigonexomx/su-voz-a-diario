/**
 * MeditationDocumentViewer
 * Renderiza un MeditationDocument oficial en modo solo lectura.
 */
(function() {
    const SECTION_LABELS = {
        dios: 'Cómo es Dios',
        aprendizaje: 'Enseñanza',
        respuesta: 'Aplicación',
        oracion: 'Oración'
    };

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(dateString) {
        if (!dateString) return '';

        const date = new Date(`${dateString}T00:00:00`);
        if (Number.isNaN(date.getTime())) return String(dateString);

        return date.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function normalizeDocument(meditationDocument = {}) {
        const metadata = meditationDocument.metadata || {};
        const sections = meditationDocument.sections || {};

        return {
            metadata: {
                date: String(metadata.date ?? ''),
                reference: String(metadata.reference ?? ''),
                version: String(metadata.version ?? '')
            },
            sections: {
                dios: String(sections.dios ?? ''),
                aprendizaje: String(sections.aprendizaje ?? ''),
                respuesta: String(sections.respuesta ?? ''),
                oracion: String(sections.oracion ?? '')
            }
        };
    }

    function renderSection(key, value) {
        const content = String(value ?? '');

        return `
            <section class="meditation-document-viewer-section">
                <h3>${escapeHtml(SECTION_LABELS[key])}</h3>
                <div class="meditation-document-viewer-section-content">${escapeHtml(content)}</div>
            </section>
        `;
    }

    function renderHtml(meditationDocument) {
        const documentModel = normalizeDocument(meditationDocument);
        const { metadata, sections } = documentModel;
        const formattedDate = formatDate(metadata.date);

        return `
            <article class="meditation-document-viewer" aria-label="Documento de meditación">
                <header class="meditation-document-viewer-header">
                    <img
                        class="meditation-document-viewer-logo"
                        src="./icons/icon.svg"
                        alt="Su Voz a Diario"
                    >
                    <div>
                        <p class="meditation-document-viewer-kicker">Su Voz Hoy</p>
                    </div>
                </header>

                <div class="meditation-document-viewer-meta" aria-label="Datos de la lectura">
                    ${metadata.reference ? `<div>${escapeHtml(metadata.reference)}</div>` : ''}
                    ${metadata.version ? `<div>${escapeHtml(metadata.version.toUpperCase())}</div>` : ''}
                    ${formattedDate ? `<div>${escapeHtml(formattedDate)}</div>` : ''}
                </div>

                <div class="meditation-document-viewer-body">
                    ${renderSection('dios', sections.dios)}
                    ${renderSection('aprendizaje', sections.aprendizaje)}
                    ${renderSection('respuesta', sections.respuesta)}
                    ${renderSection('oracion', sections.oracion)}
                </div>

                <footer class="meditation-document-viewer-footer">
                    Generado por Su Voz a Diario
                </footer>
            </article>
        `;
    }

    function create(target = null) {
        let root = target || null;

        return {
            render(meditationDocument) {
                const html = renderHtml(meditationDocument);
                if (root) {
                    root.innerHTML = html;
                    return root.firstElementChild;
                }
                const template = document.createElement('template');
                template.innerHTML = html.trim();
                return template.content.firstElementChild;
            },
            setTarget(nextTarget) {
                root = nextTarget || null;
            }
        };
    }

    window.MeditationDocumentViewer = {
        create,
        render: renderHtml
    };
})();
