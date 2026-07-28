/**
 * PdfDocumentBuilder
 * Construye el PDF de MeditationDocumentData usando jsPDF programatico.
 */
(function() {
    const SECTION_ORDER = [
        ['dios', 'Como es Dios'],
        ['aprendizaje', 'Ensenanza'],
        ['respuesta', 'Aplicacion'],
        ['oracion', 'Oracion']
    ];

    const COLORS = {
        paper: [245, 241, 232],
        text: [47, 38, 31],
        accent: [184, 154, 99],
        divider: [213, 196, 164],
        muted: [118, 101, 82]
    };

    function normalizeDocument(documentData = {}) {
        const metadata = documentData.metadata || {};
        const sections = documentData.sections || {};

        return {
            metadata: {
                date: String(metadata.date || ''),
                reference: String(metadata.reference || ''),
                version: String(metadata.version || '')
            },
            sections: {
                dios: String(sections.dios || ''),
                aprendizaje: String(sections.aprendizaje || ''),
                respuesta: String(sections.respuesta || ''),
                oracion: String(sections.oracion || '')
            }
        };
    }

    function formatDate(dateString) {
        if (!dateString) return '';

        const date = new Date(`${dateString}T00:00:00`);
        if (Number.isNaN(date.getTime())) return dateString;

        return date.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function safeText(value) {
        return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    function create(jsPdfDocument, options = {}) {
        const doc = jsPdfDocument;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 42;
        const headerHeight = 82;
        const footerHeight = 38;
        const contentTop = headerHeight + 18;
        const contentBottom = pageHeight - footerHeight;
        const usableWidth = pageWidth - margin * 2;
        const logoDataUrl = options.logoDataUrl || '';
        let y = contentTop;

        function fillPageBackground() {
            doc.setFillColor(...COLORS.paper);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
        }

        function drawHeader(documentModel) {
            const { metadata } = documentModel;
            const metaLine = [
                metadata.reference,
                metadata.version ? metadata.version.toUpperCase() : '',
                formatDate(metadata.date)
            ].filter(Boolean).join('  |  ');

            fillPageBackground();

            if (logoDataUrl) {
                try {
                    doc.addImage(logoDataUrl, 'PNG', margin, 30, 30, 30);
                } catch (error) {
                    // El PDF debe seguir generandose aunque el logo no pueda incrustarse.
                }
            }

            doc.setFont('times', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...COLORS.text);
            doc.text('Su Voz Hoy', logoDataUrl ? margin + 42 : margin, 42);

            doc.setFont('times', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...COLORS.muted);
            doc.text(metaLine || 'Documento de meditacion', logoDataUrl ? margin + 42 : margin, 58);

            doc.setDrawColor(...COLORS.divider);
            doc.setLineWidth(0.7);
            doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
        }

        function addPage(documentModel) {
            doc.addPage('letter', 'portrait');
            drawHeader(documentModel);
            y = contentTop;
        }

        function ensureSpace(documentModel, neededHeight) {
            if (y + neededHeight <= contentBottom) return;
            addPage(documentModel);
        }

        function addSectionTitle(documentModel, title) {
            ensureSpace(documentModel, 42);
            doc.setFont('times', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(...COLORS.text);
            doc.text(title, margin, y);
            y += 9;
            doc.setDrawColor(...COLORS.divider);
            doc.setLineWidth(0.5);
            doc.line(margin, y, pageWidth - margin, y);
            y += 15;
        }

        function addTextLine(documentModel, line) {
            ensureSpace(documentModel, 15);
            doc.text(line, margin, y);
            y += 14;
        }

        function addParagraphText(documentModel, text) {
            const content = safeText(text).trim() || 'Sin contenido.';
            const paragraphs = content.split('\n');

            doc.setFont('times', 'normal');
            doc.setFontSize(11.5);
            doc.setTextColor(...COLORS.text);

            paragraphs.forEach((paragraph, paragraphIndex) => {
                const lines = paragraph
                    ? doc.splitTextToSize(paragraph, usableWidth)
                    : [''];

                lines.forEach(line => addTextLine(documentModel, line));

                if (paragraphIndex < paragraphs.length - 1) {
                    y += 7;
                }
            });
        }

        function addFooter() {
            const totalPages = doc.getNumberOfPages();

            for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
                doc.setPage(pageNumber);
                doc.setDrawColor(...COLORS.divider);
                doc.setLineWidth(0.45);
                doc.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);
                doc.setFont('times', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(...COLORS.muted);
                doc.text('Generado por Su Voz a Diario', margin, pageHeight - 18);
                doc.text(`Pagina ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 18, {
                    align: 'right'
                });
            }
        }

        function build(documentData) {
            const documentModel = normalizeDocument(documentData);

            drawHeader(documentModel);
            SECTION_ORDER.forEach(([key, title], index) => {
                if (index > 0) {
                    y += 16;
                }
                addSectionTitle(documentModel, title);
                addParagraphText(documentModel, documentModel.sections[key]);
            });
            addFooter();
            return doc;
        }

        return {
            build
        };
    }

    window.PdfDocumentBuilder = {
        create
    };
})();
