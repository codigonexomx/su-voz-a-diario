/**
 * KeyboardManager
 * Administra visualViewport y visibilidad del cursor sin conocer Biblia ni pasos.
 */
(function() {
    const FIELD_MARGIN = 24;
    const KEYBOARD_THRESHOLD = 80;

    function recordLayoutLifecycle(eventName, detail = {}) {
        window.DeepeningFocusDiagnostics?.recordLayoutLifecycle?.(eventName, {
            keyboardThreshold: KEYBOARD_THRESHOLD,
            ...detail
        });
    }

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
        let shellElement = null;
        let rootElement = null;
        let visualViewport = window.visualViewport || null;
        let viewportRafId = null;
        let cursorRafId = null;
        let baseVisibleHeight = 0;

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
            if (!documentElement || !shellElement || !rootElement) return;

            const visibleHeight = getViewportHeight();
            const keyboardOpen = baseVisibleHeight - visibleHeight > KEYBOARD_THRESHOLD;
            const targetHeight = Math.round(keyboardOpen ? visibleHeight : baseVisibleHeight);
            recordLayoutLifecycle('applyViewportPosition:before', {
                baseVisibleHeight,
                targetHeight,
                keyboardOpen,
                visibleHeight
            });
            rootElement.style.setProperty(
                '--deepening-shell-height',
                `${targetHeight}px`
            );
            shellElement.style.setProperty(
                '--deepening-layout-height',
                `${targetHeight}px`
            );
            shellElement.classList.toggle('is-keyboard-open', keyboardOpen);
            recordLayoutLifecycle('applyViewportPosition:after', {
                baseVisibleHeight,
                targetHeight,
                keyboardOpen,
                visibleHeight
            });
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

            shellElement = documentElement.closest('.deepening-shell');
            rootElement = document.getElementById('deepening-root');
            baseVisibleHeight = rootElement?.getBoundingClientRect().height || getViewportHeight();
            recordLayoutLifecycle('calibrateBaseHeight', {
                baseVisibleHeight,
                targetHeight: baseVisibleHeight,
                keyboardOpen: false,
                visibleHeight: getViewportHeight()
            });
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

            rootElement?.style.setProperty('--deepening-shell-height', `${Math.round(baseVisibleHeight)}px`);
            shellElement?.style.removeProperty('--deepening-layout-height');
            shellElement?.classList.remove('is-keyboard-open');

            documentElement = null;
            shellElement = null;
            rootElement = null;
            baseVisibleHeight = 0;
        }

        return {
            init,
            destroy,
            ensureCursorVisible
        };
    }

    window.KeyboardManager = { create, KEYBOARD_THRESHOLD };
})();
