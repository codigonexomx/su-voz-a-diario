/**
 * Contratos base para futuras exportaciones de MeditationDocument.
 * Esta fase solo define firmas publicas; no genera HTML ni PDF.
 */
(function() {
    class DocumentExporter {
        export() {
            throw new Error('Not implemented');
        }
    }

    class HtmlExporter extends DocumentExporter {
        export() {
            throw new Error('Not implemented');
        }
    }

    class PdfExporter extends DocumentExporter {
        export() {
            throw new Error('Not implemented');
        }
    }

    window.DocumentExporter = DocumentExporter;
    window.HtmlExporter = HtmlExporter;
    window.PdfExporter = PdfExporter;
})();
