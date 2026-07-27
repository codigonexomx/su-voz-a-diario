/**
 * KeyboardManager
 * Administra visualViewport y visibilidad del cursor sin conocer Biblia ni pasos.
 */
(function() {
    const FIELD_MARGIN = 24;

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

            documentElement = null;
        }

        return {
            init,
            destroy,
            ensureCursorVisible
        };
    }

    window.KeyboardManager = { create };
})();
