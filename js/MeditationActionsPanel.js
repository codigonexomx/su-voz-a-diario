/**
 * MeditationActionsPanel
 * Capa de acciones para Profundizar. No conoce el visor ni los documentos.
 */
(function() {
    const STATE_COLLAPSED = 'collapsed';
    const STATE_EXPANDED = 'expanded';
    const DRAG_THRESHOLD = 18;

    function renderPanel() {
        return `
            <section class="meditation-actions-panel" data-meditation-actions-panel data-state="collapsed" aria-label="Acciones de meditación">
                <button class="meditation-actions-panel-tab" type="button" data-meditation-actions-tab aria-expanded="false" aria-label="Mostrar acciones de meditación">
                    <span class="meditation-actions-panel-tab-line" aria-hidden="true"></span>
                    <span class="meditation-actions-panel-tab-text">Mi meditación</span>
                </button>
                <div class="meditation-actions-panel-content" data-meditation-actions-content>
                    <button class="meditation-actions-panel-action" type="button" data-meditation-action="view">
                        <span aria-hidden="true">👁</span>
                        <span>Ver mi meditación</span>
                    </button>
                    <button class="meditation-actions-panel-action" type="button" data-meditation-action="save">
                        <span aria-hidden="true">💾</span>
                        <span>Guardar mi meditación</span>
                    </button>
                    <button class="meditation-actions-panel-action" type="button" data-meditation-action="share">
                        <span aria-hidden="true">↗</span>
                        <span>Compartir mi meditación</span>
                    </button>
                </div>
            </section>
        `;
    }

    function create(root, callbacks = {}) {
        if (!root) return null;

        let state = STATE_COLLAPSED;
        let panelElement = null;
        let tabElement = null;
        let contentElement = null;
        let contentAriaHidden = null;
        let actionButtons = [];
        let pointerId = null;
        let startY = 0;
        let currentY = 0;
        let didDrag = false;

        function setState(nextState) {
            state = nextState === STATE_EXPANDED ? STATE_EXPANDED : STATE_COLLAPSED;
            if (!panelElement || !tabElement) return;

            const isExpanded = state === STATE_EXPANDED;
            panelElement.dataset.state = state;
            tabElement.setAttribute('aria-expanded', String(isExpanded));
            tabElement.setAttribute(
                'aria-label',
                isExpanded ? 'Ocultar acciones de meditación' : 'Mostrar acciones de meditación'
            );
            if (contentElement) {
                contentElement.inert = !isExpanded;
                if (isExpanded) {
                    if (contentAriaHidden === null) {
                        contentElement.removeAttribute('aria-hidden');
                    } else {
                        contentElement.setAttribute('aria-hidden', contentAriaHidden);
                    }
                } else {
                    contentElement.setAttribute('aria-hidden', 'true');
                }
            }
            actionButtons.forEach(button => {
                if (isExpanded) {
                    button.removeAttribute('tabindex');
                } else {
                    button.setAttribute('tabindex', '-1');
                }
            });
        }

        function expand() {
            setState(STATE_EXPANDED);
        }

        function collapse() {
            setState(STATE_COLLAPSED);
        }

        function toggle() {
            setState(state === STATE_EXPANDED ? STATE_COLLAPSED : STATE_EXPANDED);
        }

        function handleTabClick() {
            if (didDrag) {
                didDrag = false;
                return;
            }
            toggle();
        }

        function handlePointerDown(event) {
            if (!event.isPrimary) return;
            pointerId = event.pointerId;
            startY = event.clientY;
            currentY = startY;
            didDrag = false;
            tabElement?.setPointerCapture?.(pointerId);
        }

        function handlePointerMove(event) {
            if (pointerId !== event.pointerId) return;
            currentY = event.clientY;
            if (Math.abs(currentY - startY) > 6) {
                didDrag = true;
            }
        }

        function finishPointer(event) {
            if (pointerId !== event.pointerId) return;

            const deltaY = currentY - startY;
            tabElement?.releasePointerCapture?.(pointerId);
            pointerId = null;

            if (Math.abs(deltaY) < DRAG_THRESHOLD) return;
            if (deltaY < 0) {
                expand();
            } else {
                collapse();
            }
        }

        function handleActionClick(event) {
            const actionButton = event.target?.closest?.('[data-meditation-action]');
            if (!actionButton) return;

            const action = actionButton.dataset.meditationAction;
            if (action === 'view') {
                callbacks.onView?.();
            } else if (action === 'save') {
                callbacks.onSave?.();
            } else if (action === 'share') {
                callbacks.onShare?.();
            }
        }

        function destroy() {
            if (tabElement) {
                tabElement.removeEventListener('click', handleTabClick);
                tabElement.removeEventListener('pointerdown', handlePointerDown);
                tabElement.removeEventListener('pointermove', handlePointerMove);
                tabElement.removeEventListener('pointerup', finishPointer);
                tabElement.removeEventListener('pointercancel', finishPointer);
            }
            panelElement?.removeEventListener('click', handleActionClick);
            panelElement?.remove();
            panelElement = null;
            tabElement = null;
            contentElement = null;
            contentAriaHidden = null;
            actionButtons = [];
            pointerId = null;
        }

        root.insertAdjacentHTML('beforeend', renderPanel());
        panelElement = root.querySelector('[data-meditation-actions-panel]');
        tabElement = panelElement?.querySelector('[data-meditation-actions-tab]');
        contentElement = panelElement?.querySelector('[data-meditation-actions-content]');
        contentAriaHidden = contentElement?.getAttribute('aria-hidden') ?? null;
        actionButtons = Array.from(panelElement?.querySelectorAll('[data-meditation-action]') || []);

        tabElement?.addEventListener('click', handleTabClick);
        tabElement?.addEventListener('pointerdown', handlePointerDown);
        tabElement?.addEventListener('pointermove', handlePointerMove);
        tabElement?.addEventListener('pointerup', finishPointer);
        tabElement?.addEventListener('pointercancel', finishPointer);
        panelElement?.addEventListener('click', handleActionClick);
        setState(STATE_COLLAPSED);

        return {
            expand,
            collapse,
            toggle,
            destroy
        };
    }

    window.MeditationActionsPanel = {
        create
    };
})();
