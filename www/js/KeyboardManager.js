/**
 * KeyboardManager
 * Administra visualViewport y visibilidad del cursor sin conocer Biblia ni pasos.
 */
(function() {
    const FIELD_MARGIN = 24;
    const KEYBOARD_THRESHOLD = window.KeyboardViewportManager?.MIN_KEYBOARD_REDUCTION || 120;

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
        let viewportRafId = null;
        let cursorRafId = null;
        let baseVisibleHeight = 0;
        let keyboardDismissedForBackground = false;
        let appPauseListener = null;
        let appResumeListener = null;
        let appLifecycleListenerPromises = [];
        let usingCapacitorLifecycle = false;
        let keyboardViewportUnsubscribe = null;

        function getViewportHeight() {
            return window.KeyboardViewportManager?.getState?.().visibleHeight
                || window.visualViewport?.height
                || window.innerHeight
                || document.documentElement.clientHeight
                || 0;
        }

        function getViewportOffsetTop() {
            return window.visualViewport?.offsetTop || 0;
        }

        function isInsideDocument(element) {
            return Boolean(element && documentElement?.contains(element));
        }

        function isEditable(element) {
            return Boolean(element?.closest?.('[contenteditable="true"], textarea, input'));
        }

        function isKeyboardEditor(element) {
            if (!element || element.disabled || element.readOnly) return false;
            if (element instanceof HTMLInputElement) return true;
            if (element instanceof HTMLTextAreaElement) return true;
            return Boolean(element.isContentEditable);
        }

        function getLifecycleSnapshotState() {
            const viewportState = window.KeyboardViewportManager?.getState?.() || {};
            const visibleHeight = viewportState.visibleHeight || getViewportHeight();
            const keyboardOpen = Boolean(viewportState.isKeyboardOpen);
            const targetHeight = Math.round(keyboardOpen ? visibleHeight : baseVisibleHeight);

            return {
                baseVisibleHeight,
                targetHeight,
                keyboardOpen,
                visibleHeight
            };
        }

        function resetBackgroundDismissFlag() {
            keyboardDismissedForBackground = false;
        }

        function dismissKeyboardForBackground(reason) {
            const active = document.activeElement;
            const eventName = `dismissKeyboard:${reason}`;

            if (!isKeyboardEditor(active)) {
                keyboardDismissedForBackground = false;
                recordLayoutLifecycle(eventName, getLifecycleSnapshotState());
                return false;
            }

            if (keyboardDismissedForBackground) {
                recordLayoutLifecycle(eventName, getLifecycleSnapshotState());
                return false;
            }

            keyboardDismissedForBackground = true;
            recordLayoutLifecycle(eventName, getLifecycleSnapshotState());

            if (active === document.activeElement) {
                active.blur();
                return true;
            }

            return false;
        }

        function bindCapacitorLifecycle() {
            const AppPlugin = window.Capacitor?.Plugins?.App;
            if (!AppPlugin?.addListener) return false;

            function trackAppListener(listener, assign) {
                if (listener?.remove) {
                    assign(listener);
                    return;
                }
                if (listener?.then) {
                    const listenerPromise = listener
                        .then(nextListener => {
                            assign(nextListener);
                            return nextListener;
                        })
                        .catch(() => null);
                    appLifecycleListenerPromises.push(listenerPromise);
                }
            }

            usingCapacitorLifecycle = true;
            const pauseListener = AppPlugin.addListener('pause', () => {
                dismissKeyboardForBackground('pause');
            });
            const resumeListener = AppPlugin.addListener('resume', resetBackgroundDismissFlag);

            trackAppListener(pauseListener, listener => {
                appPauseListener = listener;
            });
            trackAppListener(resumeListener, listener => {
                appResumeListener = listener;
            });

            return true;
        }

        function onVisibilityChange() {
            if (document.visibilityState === 'hidden') {
                dismissKeyboardForBackground('visibilitychange');
            } else if (document.visibilityState === 'visible') {
                resetBackgroundDismissFlag();
            }
        }

        function bindBackgroundLifecycle() {
            if (bindCapacitorLifecycle()) return;
            document.addEventListener('visibilitychange', onVisibilityChange);
        }

        function unbindBackgroundLifecycle() {
            if (usingCapacitorLifecycle) {
                appPauseListener?.remove?.();
                appResumeListener?.remove?.();
                appPauseListener = null;
                appResumeListener = null;
                appLifecycleListenerPromises.forEach(listenerPromise => {
                    listenerPromise.then(listener => listener?.remove?.()).catch(() => {});
                });
                appLifecycleListenerPromises = [];
                usingCapacitorLifecycle = false;
            } else {
                document.removeEventListener('visibilitychange', onVisibilityChange);
            }
            keyboardDismissedForBackground = false;
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

        function applyViewportPosition(viewportState = window.KeyboardViewportManager?.getState?.() || {}) {
            if (!documentElement || !shellElement || !rootElement) return;

            const visibleHeight = viewportState.visibleHeight || getViewportHeight();
            const keyboardOpen = Boolean(viewportState.isKeyboardOpen);
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
            shellElement.style.removeProperty('--deepening-layout-height');
            shellElement.classList.toggle('is-keyboard-open', keyboardOpen);
            recordLayoutLifecycle('applyViewportPosition:after', {
                baseVisibleHeight,
                targetHeight,
                keyboardOpen,
                visibleHeight
            });
            ensureCursorVisible();
        }

        function scheduleViewportPosition(viewportState) {
            if (viewportRafId !== null) {
                cancelAnimationFrame(viewportRafId);
            }

            viewportRafId = requestAnimationFrame(() => {
                viewportRafId = null;
                applyViewportPosition(viewportState);
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
            const viewportState = window.KeyboardViewportManager?.getState?.() || {};
            baseVisibleHeight = viewportState.baselineHeight
                || rootElement?.getBoundingClientRect().height
                || getViewportHeight();
            recordLayoutLifecycle('calibrateBaseHeight', {
                baseVisibleHeight,
                targetHeight: baseVisibleHeight,
                keyboardOpen: Boolean(viewportState.isKeyboardOpen),
                visibleHeight: viewportState.visibleHeight || getViewportHeight()
            });
            documentElement.addEventListener('focusin', onFocusIn);
            documentElement.addEventListener('input', onInput);
            keyboardViewportUnsubscribe = window.KeyboardViewportManager?.subscribe?.(scheduleViewportPosition) || null;
            bindBackgroundLifecycle();
            scheduleViewportPosition(viewportState);
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
            keyboardViewportUnsubscribe?.();
            keyboardViewportUnsubscribe = null;
            unbindBackgroundLifecycle();

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
            ensureCursorVisible,
            dismissKeyboardForBackground
        };
    }

    window.KeyboardManager = { create, KEYBOARD_THRESHOLD };
})();
