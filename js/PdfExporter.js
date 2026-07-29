/**
 * PdfExporter
 * Genera PDFs vectoriales a partir de MeditationDocumentData.
 */
(function() {
    const DEFAULT_LOGO_PATH = './icons/icon-pdf.png';

    function sanitizeFilePart(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function buildFileName(documentData = {}) {
        const reference = sanitizeFilePart(documentData.metadata?.reference);
        return reference
            ? `Su-Voz-Hoy-${reference}.pdf`
            : 'Su-Voz-Hoy-meditacion.pdf';
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
            reader.readAsDataURL(blob);
        });
    }

    async function loadLogoDataUrl(path = DEFAULT_LOGO_PATH) {
        try {
            const response = await fetch(path);
            if (!response.ok) return '';
            return await blobToDataUrl(await response.blob());
        } catch (error) {
            return '';
        }
    }

    function assertJsPdf() {
        const jsPDF = window.jspdf?.jsPDF;
        if (!jsPDF) {
            throw new Error('jsPDF no esta disponible');
        }
        return jsPDF;
    }

    function setPdfMetadata(pdf) {
        pdf.setProperties?.({
            title: 'Su Voz Hoy',
            author: 'Su Voz a Diario',
            subject: 'Documento de meditación bíblica',
            creator: 'Su Voz a Diario',
            keywords: 'Biblia, meditación, devocional, Su Voz Hoy'
        });
    }

    async function exportDocument(documentData, options = {}) {
        const jsPDF = assertJsPdf();
        const fileName = options.fileName || buildFileName(documentData);
        const logoDataUrl = await loadLogoDataUrl(options.logoPath || DEFAULT_LOGO_PATH);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter'
        });

        setPdfMetadata(pdf);

        window.PdfDocumentBuilder
            .create(pdf, { logoDataUrl })
            .build(documentData);

        const blob = pdf.output('blob');

        return {
            blob,
            fileName,
            mimeType: 'application/pdf'
        };
    }

    window.PdfExporter = {
        export: exportDocument,
        buildFileName
    };
})();
