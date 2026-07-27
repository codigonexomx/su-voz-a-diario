/**
 * KeyboardManager
 * Administra visualViewport y visibilidad del cursor sin conocer Biblia ni pasos.
 */
(function() {
    const FIELD_MARGIN = 24;
    const KEYBOARD_GAP = 10;
    const MIN_KEYBOARD_DOCUMENT_HEIGHT = 120;
    const KEYBOARD_DOCUMENT_RATIO = 0.46;

    function getCaretRect() {
        const selection = window.getSelection?.();
        if (!selection || selection.rangeCount === 0) return null;

        const range = selection.getRangeAt(0).cloneRange();
        range.collapse(false);
        const rect = range.getBoundingClientRect();
        if (rect && (rect.width || rect.height)) return rect;

        const marker = document.createElement('span');
        marker.textContent = '\u200b';
        range.insertNode(marker);
        const markerRect = marker.getBoundingClientRect();
        marker.remove();
        return markerRect;
    }

    function create(options = {}) {
        let documentElement = null;
        let visualViewport = window.visualViewport || null;
        let viewportRafId = null;
        let cursorRafId = null;
        let baseTransform = '';
        let baseDocumentBottom = 0;
        let baseDocumentTop = 0;
        let baseDocumentHeight = 0;
        let baseInlineHeight = '';

        function getViewportHeight() {
            return visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
        }

        function getViewportOffsetTop() {
            return visualViewport?.offsetTop || 0;
        }

        function isInsideDocument(element) {
            return Boolean(element && documentElement?.contains(element));
        }

        function isEditable(element) {
            return Boolean(element?.closest?.('[contenteditable="true"], textarea, input'));
        }

        function ensureCursorVisible() {
            const active = document.activeElement;
            if (!isInsideDocument(active) || !isEditable(active)) return;

            if (cursorRafId !== null) {
                cancelAnimationFrame(cursorRafId);
            }

            cursorRafId = requestAnimationFrame(() => {
                cursorRafId = null;
                if (!documentElement || !isInsideDocument(active)) return;

                const caretRect = getCaretRect() || active.getBoundingClientRect();
                const documentRect = documentElement.getBoundingClientRect();
                const viewportBottom = getViewportOffsetTop() + getViewportHeight();
                const visibleBottom = Math.min(documentRect.bottom, viewportBottom) - FIELD_MARGIN;
                const visibleTop = documentRect.top + FIELD_MARGIN;

                if (caretRect.bottom > visibleBottom) {
                    documentElement.scrollTop += caretRect.bottom - visibleBottom;
                } else if (caretRect.top < visibleTop) {
                    documentElement.scrollTop -= visibleTop - caretRect.top;
                }
            });
        }

        function applyViewportPosition() {
            if (!documentElement) return;

            const viewportBottom = getViewportOffsetTop() + getViewportHeight();
            const keyboardOpen = viewportBottom < baseDocumentBottom - KEYBOARD_GAP;

            if (!keyboardOpen) {
                documentElement.style.height = baseInlineHeight;
                documentElement.style.transform = baseTransform;
                ensureCursorVisible();
                return;
            }

            const shellTop = document.querySelector('.deepening-shell')?.getBoundingClientRect().top || 0;
            const availableHeight = Math.max(0, viewportBottom - shellTop - KEYBOARD_GAP);
            const targetHeight = Math.min(
                baseDocumentHeight,
                Math.max(
                    Math.min(MIN_KEYBOARD_DOCUMENT_HEIGHT, availableHeight),
                    Math.floor(availableHeight * KEYBOARD_DOCUMENT_RATIO)
                )
            );
            const targetBottom = viewportBottom - KEYBOARD_GAP;
            const targetTop = targetBottom - targetHeight;
            const offsetY = Math.min(0, Math.floor(targetTop - baseDocumentTop));

            documentElement.style.height = `${Math.round(targetHeight)}px`;
            documentElement.style.transform = offsetY
                ? `translate3d(0, ${offsetY}px, 0)`
                : baseTransform;
            ensureCursorVisible();
        }

        function scheduleViewportPosition() {
            if (viewportRafId !== null) {
                cancelAnimationFrame(viewportRafId);
            }

            viewportRafId = requestAnimationFrame(() => {
                viewportRafId = null;
                applyViewportPosition();
            });
        }

        function onFocusIn() {
            scheduleViewportPosition();
            ensureCursorVisible();
        }

        function onInput() {
            ensureCursorVisible();
        }

        function init(element) {
            documentElement = element;
            if (!documentElement) return;

            baseTransform = documentElement.style.transform || '';
            baseInlineHeight = documentElement.style.height || '';
            const baseRect = documentElement.getBoundingClientRect();
            baseDocumentTop = baseRect.top;
            baseDocumentBottom = baseRect.bottom;
            baseDocumentHeight = baseRect.height;
            documentElement.addEventListener('focusin', onFocusIn);
            documentElement.addEventListener('input', onInput);
            visualViewport?.addEventListener('resize', scheduleViewportPosition);
            visualViewport?.addEventListener('scroll', scheduleViewportPosition);
            window.addEventListener('resize', scheduleViewportPosition);
            scheduleViewportPosition();
        }

        function destroy() {
            if (viewportRafId !== null) {
                cancelAnimationFrame(viewportRafId);
                viewportRafId = null;
            }
            if (cursorRafId !== null) {
                cancelAnimationFrame(cursorRafId);
                cursorRafId = null;
            }

            documentElement?.removeEventListener('focusin', onFocusIn);
            documentElement?.removeEventListener('input', onInput);
            visualViewport?.removeEventListener('resize', scheduleViewportPosition);
            visualViewport?.removeEventListener('scroll', scheduleViewportPosition);
            window.removeEventListener('resize', scheduleViewportPosition);

            if (documentElement) {
                documentElement.style.height = baseInlineHeight;
                documentElement.style.transform = baseTransform;
            }

            documentElement = null;
            baseTransform = '';
            baseInlineHeight = '';
            baseDocumentTop = 0;
            baseDocumentBottom = 0;
            baseDocumentHeight = 0;
        }

        return {
            init,
            destroy,
            ensureCursorVisible
        };
    }

    window.KeyboardManager = { create };
})();
