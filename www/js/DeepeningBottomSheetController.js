/**
 * DeepeningBottomSheetController
 * Controlador nuevo e independiente para el futuro Modo Profundizar.
 */
(function() {
    const STATES = {
        CLOSED: 'closed',
        MIDDLE: 'middle',
        EXPANDED: 'expanded'
    };

    const DRAG_CLOSE_VELOCITY = 0.62;
    const DRAG_EXPAND_VELOCITY = -0.5;
    const FOCUSED_FIELD_MARGIN = 24;
    const DRAG_CLOSE_ENABLED = false;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function isEditableElement(element) {
        return Boolean(element?.closest?.('textarea, input, select, [contenteditable="true"]'));
    }

    function create(options = {}) {
        let root = null;
        let sheet = null;
        let header = null;
        let body = null;
        let closeButton = null;
        let state = STATES.CLOSED;
        let activePointerId = null;
        let dragOwner = null;
        let startY = 0;
        let lastY = 0;
        let lastTime = 0;
        let velocityY = 0;
        let startTranslateY = 0;
        let currentTranslateY = 0;
        let visualViewport = window.visualViewport || null;
        let closeRequested = false;
        let viewportRafId = null;
        let focusRafId = null;
        let focusOutTimerId = null;
        let editingFocused = false;
        let stateBeforeEditing = null;

        const callbacks = {
            onClose: options.onClose,
            onStateChange: options.onStateChange,
            onAutoSave: options.onAutoSave
        };

        function getViewportHeight() {
            return visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
        }

        function getSheetHeight() {
            return sheet?.getBoundingClientRect().height || 0;
        }

        function getSnapPoints() {
            const height = getSheetHeight();
            const viewportHeight = getViewportHeight();
            const middleTranslateY = height * 0.46;
            const middleVisibleHeight = height - middleTranslateY;
            const readingContextHeight = Math.max(128, viewportHeight * 0.28);
            const maxFocusedVisibleHeight = Math.min(height, Math.max(300, viewportHeight - readingContextHeight));
            const focusedVisibleHeight = middleVisibleHeight + Math.max(0, maxFocusedVisibleHeight - middleVisibleHeight) * 0.5;

            return {
                [STATES.EXPANDED]: 0,
                [STATES.MIDDLE]: editingFocused ? Math.max(0, height - focusedVisibleHeight) : middleTranslateY,
                [STATES.CLOSED]: height + 32
            };
        }

        function applyViewportMetrics() {
            if (!root) return;

            const viewportHeight = getViewportHeight();
            const keyboardOffset = 0;

            const shellRoot = root.querySelector('.deepening-shell');

            root.style.setProperty('--deepening-viewport-height', `${viewportHeight}px`);
            root.style.setProperty('--deepening-keyboard-offset', `${keyboardOffset}px`);
            shellRoot?.style.setProperty('--deepening-viewport-height', `${viewportHeight}px`);
            shellRoot?.style.setProperty('--deepening-keyboard-offset', `${keyboardOffset}px`);
            if (viewportRafId !== null) {
                cancelAnimationFrame(viewportRafId);
            }
            viewportRafId = requestAnimationFrame(() => {
                viewportRafId = null;
                applyState(state, true);
                ensureFocusedElementVisible();
            });
        }

        function ensureFocusedElementVisible() {
            if (!body || (!editingFocused && state !== STATES.EXPANDED)) return;

            const active = document.activeElement;
            if (!active || !body.contains(active) || !isEditableElement(active)) return;

            if (focusRafId !== null) {
                cancelAnimationFrame(focusRafId);
            }
            focusRafId = requestAnimationFrame(() => {
                focusRafId = null;
                if (!body || !body.contains(active)) return;

                const bodyRect = body.getBoundingClientRect();
                const activeRect = active.getBoundingClientRect();
                const visibleBottom = Math.min(bodyRect.bottom, getViewportHeight()) - FOCUSED_FIELD_MARGIN;
                const overflowBottom = activeRect.bottom - visibleBottom;
                const overflowTop = bodyRect.top - activeRect.top + FOCUSED_FIELD_MARGIN;

                if (overflowBottom > 0) {
                    body.scrollTop += overflowBottom;
                } else if (overflowTop > 0) {
                    body.scrollTop -= overflowTop;
                }

                const promptDescription = active.closest?.('.deepening-prompt')?.querySelector?.('p');
                if (promptDescription) {
                    const updatedBodyRect = body.getBoundingClientRect();
                    const descriptionRect = promptDescription.getBoundingClientRect();
                    const descriptionIsPartiallyCut = descriptionRect.top < updatedBodyRect.top && descriptionRect.bottom > updatedBodyRect.top;

                    if (descriptionIsPartiallyCut) {
                        body.scrollTop -= updatedBodyRect.top - descriptionRect.top + FOCUSED_FIELD_MARGIN;
                    }
                }
            });
        }

        function setTransform(value, instant = false) {
            if (!sheet) return;
            if (instant) {
                sheet.classList.add('is-dragging');
            } else {
                sheet.classList.remove('is-dragging');
            }
            sheet.style.transform = `translate3d(0, ${Math.max(0, value)}px, 0)`;
            currentTranslateY = Math.max(0, value);
        }

        function applyState(nextState, instant = false) {
            if (!sheet) return;

            state = nextState;
            sheet.dataset.state = nextState;
            root?.querySelector('.deepening-shell')?.setAttribute('data-sheet-state', nextState);

            const snaps = getSnapPoints();
            setTransform(snaps[nextState] ?? snaps[STATES.CLOSED], instant);
            if (instant) {
                requestAnimationFrame(() => sheet?.classList.remove('is-dragging'));
            }

            if (body) {
                body.style.overflowY = nextState === STATES.EXPANDED || editingFocused ? 'auto' : 'hidden';
            }

            callbacks.onStateChange?.(nextState);
        }

        async function requestClose() {
            if (closeRequested) return;
            closeRequested = true;

            try {
                await callbacks.onAutoSave?.();
            } catch (error) {
                console.warn('[DeepeningShell] No se pudo completar el autosave antes de cerrar.', error);
            } finally {
                applyState(STATES.CLOSED);
                callbacks.onClose?.();
            }
        }

        function chooseSnap() {
            const snaps = getSnapPoints();
            const projectedY = currentTranslateY + velocityY * 120;

            if (DRAG_CLOSE_ENABLED && (velocityY > DRAG_CLOSE_VELOCITY || projectedY > (snaps[STATES.MIDDLE] + snaps[STATES.CLOSED]) / 2)) {
                return STATES.CLOSED;
            }

            if (velocityY < DRAG_EXPAND_VELOCITY || projectedY < (snaps[STATES.EXPANDED] + snaps[STATES.MIDDLE]) / 2) {
                return STATES.EXPANDED;
            }

            return STATES.MIDDLE;
        }

        function startDrag(event, owner) {
            if (!sheet || state === STATES.CLOSED) return;
            if (owner === 'body' && (state !== STATES.EXPANDED || body.scrollTop > 0 || isEditableElement(event.target))) return;

            activePointerId = event.pointerId;
            dragOwner = owner;
            startY = event.clientY;
            lastY = event.clientY;
            lastTime = performance.now();
            velocityY = 0;
            startTranslateY = currentTranslateY;
            sheet.classList.add('is-dragging');
            sheet.setPointerCapture?.(activePointerId);
        }

        function moveDrag(event) {
            if (event.pointerId !== activePointerId || !dragOwner) return;

            const now = performance.now();
            const deltaY = event.clientY - startY;
            const frameMs = Math.max(1, now - lastTime);
            velocityY = (event.clientY - lastY) / frameMs;
            lastY = event.clientY;
            lastTime = now;

            const snaps = getSnapPoints();
            const maxTranslateY = DRAG_CLOSE_ENABLED ? snaps[STATES.CLOSED] : snaps[STATES.MIDDLE];
            const nextY = clamp(startTranslateY + deltaY, snaps[STATES.EXPANDED], maxTranslateY);

            event.preventDefault();
            setTransform(nextY, true);
        }

        function endDrag(event) {
            if (event.pointerId !== activePointerId || !dragOwner) return;

            sheet?.releasePointerCapture?.(activePointerId);
            sheet?.classList.remove('is-dragging');

            const nextState = chooseSnap();
            activePointerId = null;
            dragOwner = null;

            if (nextState === STATES.CLOSED) {
                requestClose();
                return;
            }

            applyState(nextState);
        }

        function onHeaderPointerDown(event) {
            if (event.target?.closest?.('[data-deepening-close]')) return;
            startDrag(event, 'header');
        }

        function onBodyPointerDown(event) {
            startDrag(event, 'body');
        }

        function onPointerMove(event) {
            moveDrag(event);
        }

        function onPointerEnd(event) {
            endDrag(event);
        }

        function onCloseClick() {
            requestClose();
        }

        function onFocusIn(event) {
            if (focusOutTimerId !== null) {
                clearTimeout(focusOutTimerId);
                focusOutTimerId = null;
            }

            if (isEditableElement(event.target)) {
                if (!editingFocused) {
                    stateBeforeEditing = state;
                }
                editingFocused = true;
                applyState(STATES.MIDDLE);
            }

            applyViewportMetrics();
            ensureFocusedElementVisible();
        }

        function onFocusOut() {
            if (focusOutTimerId !== null) {
                clearTimeout(focusOutTimerId);
            }

            focusOutTimerId = setTimeout(() => {
                focusOutTimerId = null;
                const active = document.activeElement;
                const stillEditing = Boolean(active && body?.contains(active) && isEditableElement(active));

                if (stillEditing) return;

                editingFocused = false;
                applyViewportMetrics();
                applyState(stateBeforeEditing || STATES.MIDDLE);
                stateBeforeEditing = null;
            }, 0);
        }

        function init(elements = {}) {
            root = elements.root;
            sheet = elements.sheet;
            header = elements.header;
            body = elements.body;
            closeButton = elements.closeButton;

            if (!root || !sheet || !header || !body) return;

            header.addEventListener('pointerdown', onHeaderPointerDown);
            body.addEventListener('pointerdown', onBodyPointerDown);
            sheet.addEventListener('pointermove', onPointerMove);
            sheet.addEventListener('pointerup', onPointerEnd);
            sheet.addEventListener('pointercancel', onPointerEnd);
            closeButton?.addEventListener('click', onCloseClick);
            body.addEventListener('focusin', onFocusIn);
            body.addEventListener('focusout', onFocusOut);
            visualViewport?.addEventListener('resize', applyViewportMetrics);
            visualViewport?.addEventListener('scroll', applyViewportMetrics);
            window.addEventListener('resize', applyViewportMetrics);

            closeRequested = false;
            applyViewportMetrics();
            applyState(STATES.MIDDLE, true);
        }

        function destroy() {
            if (viewportRafId !== null) {
                cancelAnimationFrame(viewportRafId);
                viewportRafId = null;
            }
            if (focusRafId !== null) {
                cancelAnimationFrame(focusRafId);
                focusRafId = null;
            }
            if (focusOutTimerId !== null) {
                clearTimeout(focusOutTimerId);
                focusOutTimerId = null;
            }
            if (activePointerId !== null) {
                sheet?.releasePointerCapture?.(activePointerId);
            }

            header?.removeEventListener('pointerdown', onHeaderPointerDown);
            body?.removeEventListener('pointerdown', onBodyPointerDown);
            sheet?.removeEventListener('pointermove', onPointerMove);
            sheet?.removeEventListener('pointerup', onPointerEnd);
            sheet?.removeEventListener('pointercancel', onPointerEnd);
            closeButton?.removeEventListener('click', onCloseClick);
            body?.removeEventListener('focusin', onFocusIn);
            body?.removeEventListener('focusout', onFocusOut);
            visualViewport?.removeEventListener('resize', applyViewportMetrics);
            visualViewport?.removeEventListener('scroll', applyViewportMetrics);
            window.removeEventListener('resize', applyViewportMetrics);

            root = null;
            sheet = null;
            header = null;
            body = null;
            closeButton = null;
            activePointerId = null;
            dragOwner = null;
            state = STATES.CLOSED;
            editingFocused = false;
            stateBeforeEditing = null;
        }

        return {
            init,
            destroy,
            setState: applyState,
            close: requestClose,
            getState: () => state,
            STATES
        };
    }

    window.DeepeningBottomSheetController = {
        create,
        STATES
    };
})();
