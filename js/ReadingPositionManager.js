/**
 * ReadingPositionManager
 * Captura y restaura la posicion de lectura al entrar y salir de Profundizar.
 */
(function() {
    function createPositionRecord(options = {}) {
        return {
            scrollX: window.scrollX || window.pageXOffset || 0,
            scrollY: window.scrollY || window.pageYOffset || 0,
            view: options.view || window.App?.currentView || '',
            homeViewingDate: options.homeViewingDate || window.App?.homeViewingDate || null,
            readingDate: options.reading?.date || options.readingDate || null,
            currentVersion: options.currentVersion || window.App?.currentVersion || null,
            activeElement: document.activeElement instanceof HTMLElement ? document.activeElement : null
        };
    }

    function restoreWindowScroll(positionRecord) {
        if (!positionRecord) return;

        const restore = () => window.scrollTo(positionRecord.scrollX, positionRecord.scrollY);
        restore();
        requestAnimationFrame(() => {
            restore();
            requestAnimationFrame(restore);
        });
    }

    function restoreFocus(positionRecord) {
        const previousFocus = positionRecord?.activeElement;
        if (previousFocus?.isConnected) {
            previousFocus.focus({ preventScroll: true });
        }
    }

    window.ReadingPositionManager = {
        createPositionRecord,
        restoreWindowScroll,
        restoreFocus
    };
})();
