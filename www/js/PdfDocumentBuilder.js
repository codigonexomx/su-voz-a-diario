/**
 * PdfDocumentBuilder
 * Construye el PDF de MeditationDocumentData usando jsPDF programatico.
 */
(function() {
    const COLORS = {
        paper: [245, 241, 232],
        text: [47, 38, 31],
        accent: [111, 79, 47],
        divider: [188, 166, 128],
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
        const headerHeight = 128;
        const footerHeight = 38;
        const contentTop = headerHeight + 24;
        const contentBottom = pageHeight - footerHeight;
        const usableWidth = pageWidth - margin * 2;
        const logoDataUrl = options.logoDataUrl || '';
        const lineHeight = 14.2;
        const paragraphGap = 7;
        let y = contentTop;

        function fillPageBackground() {
            doc.setFillColor(...COLORS.paper);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
        }

        function drawHeader(documentModel) {
            const { metadata } = documentModel;
            const metaLine = [
                metadata.version ? metadata.version.toUpperCase() : '',
                formatDate(metadata.date)
            ].filter(Boolean).join('  |  ');

            fillPageBackground();

            if (logoDataUrl) {
                try {
                    doc.addImage(logoDataUrl, 'PNG', margin, 28, 26, 26);
                } catch (error) {
                    // El PDF debe seguir generandose aunque el logo no pueda incrustarse.
                }
            }

            doc.setFont('times', 'normal');
            doc.setFontSize(9.6);
            doc.setTextColor(...COLORS.muted);
            doc.text('Su Voz Hoy', logoDataUrl ? margin + 36 : margin, 36);

            doc.setFont('times', 'bold');
            doc.setFontSize(9.4);
            doc.setTextColor(...COLORS.accent);
            doc.text('PASAJE BÍBLICO', margin, 72);

            doc.setFont('times', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(...COLORS.text);
            doc.text(metadata.reference || 'Meditación bíblica', margin, 102);

            if (metaLine) {
                doc.setFont('times', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(...COLORS.muted);
                doc.text(metaLine, pageWidth - margin, 38, { align: 'right' });
            }

            doc.setDrawColor(...COLORS.divider);
            doc.setLineWidth(0.65);
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

        function setBodyStyle() {
            doc.setFont('times', 'normal');
            doc.setFontSize(10.4);
            doc.setTextColor(...COLORS.text);
        }

        function setSectionTitleStyle() {
            doc.setFont('times', 'bold');
            doc.setFontSize(12.8);
            doc.setTextColor(...COLORS.accent);
        }

        function makeLines(text, width) {
            const content = safeText(text).trim() || 'Sin contenido.';
            const blocks = [];

            content.split('\n').forEach((paragraph, paragraphIndex, paragraphs) => {
                const lines = paragraph ? doc.splitTextToSize(paragraph, width) : [''];
                lines.forEach(line => blocks.push({ text: line, gapAfter: 0 }));
                if (paragraphIndex < paragraphs.length - 1 && blocks.length) {
                    blocks[blocks.length - 1].gapAfter = paragraphGap;
                }
            });

            return blocks;
        }

        function drawHorizontalRule(yPosition) {
            doc.setDrawColor(...COLORS.divider);
            doc.setLineWidth(0.55);
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
        }

        function drawColumnTitle(title, x, yPosition) {
            setSectionTitleStyle();
            doc.text(title, x, yPosition);
        }

        function drawLine(line, x, yPosition) {
            setBodyStyle();
            doc.text(line.text, x, yPosition);
        }

        function renderTwoColumnBlock(documentModel) {
            const columnGap = 30;
            const dividerX = margin + usableWidth / 2;
            const columnWidth = (usableWidth - columnGap) / 2;
            const leftX = margin;
            const rightX = dividerX + columnGap / 2;
            let leftLines = makeLines(documentModel.sections.dios, columnWidth);
            let rightLines = makeLines(documentModel.sections.aprendizaje, columnWidth);
            let firstPage = true;

            while (leftLines.length || rightLines.length || firstPage) {
                ensureSpace(documentModel, 64);

                drawColumnTitle(firstPage ? '¿Cómo es Dios?' : '¿Cómo es Dios? (cont.)', leftX, y);
                drawColumnTitle(firstPage ? 'Enseñanza' : 'Enseñanza (cont.)', rightX, y);
                const dividerTop = y + 8;
                y += 22;

                let leftY = y;
                let rightY = y;

                while (leftLines.length && leftY + lineHeight <= contentBottom) {
                    const line = leftLines.shift();
                    drawLine(line, leftX, leftY);
                    leftY += lineHeight + line.gapAfter;
                }

                while (rightLines.length && rightY + lineHeight <= contentBottom) {
                    const line = rightLines.shift();
                    drawLine(line, rightX, rightY);
                    rightY += lineHeight + line.gapAfter;
                }

                const blockBottom = Math.max(leftY, rightY, y);
                doc.setDrawColor(...COLORS.divider);
                doc.setLineWidth(0.5);
                doc.line(dividerX, dividerTop, dividerX, Math.min(blockBottom - 3, contentBottom));

                y = blockBottom + 18;
                firstPage = false;

                if (leftLines.length || rightLines.length) {
                    addPage(documentModel);
                }
            }
        }

        function renderFullWidthSection(documentModel, title, text) {
            ensureSpace(documentModel, 66);
            drawHorizontalRule(y);
            y += 24;

            setSectionTitleStyle();
            doc.text(title, margin, y);
            y += 22;

            const lines = makeLines(text, usableWidth);
            while (lines.length) {
                ensureSpace(documentModel, lineHeight + 2);
                const line = lines.shift();
                drawLine(line, margin, y);
                y += lineHeight + line.gapAfter;
            }

            y += 18;
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
                doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, pageHeight - 18, {
                    align: 'right'
                });
            }
        }

        function build(documentData) {
            const documentModel = normalizeDocument(documentData);

            drawHeader(documentModel);
            renderTwoColumnBlock(documentModel);
            renderFullWidthSection(documentModel, 'Aplicación', documentModel.sections.respuesta);
            renderFullWidthSection(documentModel, 'Oración', documentModel.sections.oracion);
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
