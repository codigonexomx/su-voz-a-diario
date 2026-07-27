/**
 * MeditationDocument
 * Administra exclusivamente el cuaderno de meditacion.
 */
(function() {
    const STEPS = [
        { id: 'god', label: '¿Como es Dios?', title: 'Contempla el caracter de Dios revelado en este pasaje.' },
        { id: 'teaching', label: 'Enseñanza', title: 'Observa que verdad desea formar en ti.' },
        { id: 'application', label: 'Aplicacion', title: 'Nombra una respuesta sencilla para hoy.' },
        { id: 'prayer', label: 'Oracion', title: 'Responde a Dios con tus propias palabras.' }
    ];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function create(options = {}) {
        let root = null;
        let activeStepId = STEPS[0].id;

        function renderDefaultContent() {
            return `
                <nav class="deepening-step-list" aria-label="Pasos de meditacion">
                    ${STEPS.map((step, index) => `
                        <button
                            class="deepening-step${index === 0 ? ' is-active' : ''}"
                            type="button"
                            data-step="${step.id}"
                            ${index === 0 ? 'aria-current="step"' : ''}
                        >
                            <span class="deepening-step-kicker">0${index + 1}</span>
                            <span class="deepening-step-label">${escapeHtml(step.label)}</span>
                        </button>
                    `).join('')}
                </nav>

                ${STEPS.map((step, index) => `
                    <section
                        class="deepening-prompt"
                        aria-label="${escapeHtml(step.label)}"
                        data-step-panel="${step.id}"
                        ${index === 0 ? '' : 'hidden'}
                    >
                        <h2>${escapeHtml(step.label)}</h2>
                        <p>${escapeHtml(step.title)}</p>
                        <div
                            class="deepening-writing-area"
                            role="textbox"
                            contenteditable="true"
                            aria-multiline="true"
                            data-deepening-editor
                            data-placeholder="Escribe despacio. Una frase honesta es suficiente."
                            aria-label="Respuesta de meditacion: ${escapeHtml(step.label)}"
                        ></div>
                    </section>
                `).join('')}
            `;
        }

        function render() {
            return `
                <section class="deepening-meditation-document" aria-label="Cuaderno de meditacion" data-deepening-meditation-document>
                    <header class="deepening-meditation-header">
                        <div class="deepening-meditation-grabber" aria-hidden="true"></div>
                        <div class="deepening-meditation-title">Medita la Palabra</div>
                        <button class="deepening-meditation-close" type="button" aria-label="Salir de Profundizar" data-deepening-close>&times;</button>
                    </header>
                    <div class="deepening-meditation-frame">
                        ${options.meditationHtml || renderDefaultContent()}
                    </div>
                </section>
            `;
        }

        function setActiveStep(stepId, keepWriting = false) {
            activeStepId = stepId;
            root?.querySelectorAll('.deepening-step').forEach(step => {
                const isActive = step.getAttribute('data-step') === activeStepId;
                step.classList.toggle('is-active', isActive);
                if (isActive) {
                    step.setAttribute('aria-current', 'step');
                } else {
                    step.removeAttribute('aria-current');
                }
            });

            root?.querySelectorAll('[data-step-panel]').forEach(panel => {
                panel.hidden = panel.getAttribute('data-step-panel') !== activeStepId;
            });

            if (keepWriting) {
                requestAnimationFrame(() => {
                    root?.querySelector(`[data-step-panel="${activeStepId}"] [data-deepening-editor]`)?.focus({ preventScroll: true });
                });
            }
        }

        function isEditorActive() {
            return Boolean(document.activeElement?.closest?.('[data-deepening-editor]'));
        }

        function onPointerDown(event) {
            const step = event.target.closest('.deepening-step');
            if (!step || !root?.contains(step) || !isEditorActive()) return;

            const stepId = step.getAttribute('data-step');
            if (!stepId) return;

            event.preventDefault();
            setActiveStep(stepId, true);
        }

        function onClick(event) {
            const closeButton = event.target.closest('[data-deepening-close]');
            if (closeButton && root?.contains(closeButton)) {
                options.onClose?.();
                return;
            }

            const step = event.target.closest('.deepening-step');
            if (!step || !root?.contains(step)) return;

            const stepId = step.getAttribute('data-step');
            if (stepId) {
                setActiveStep(stepId, isEditorActive());
            }
        }

        function mount(target) {
            target.innerHTML = render();
            root = target.querySelector('[data-deepening-meditation-document]');
            root?.addEventListener('pointerdown', onPointerDown);
            root?.addEventListener('click', onClick);
            return root;
        }

        function destroy() {
            root?.removeEventListener('pointerdown', onPointerDown);
            root?.removeEventListener('click', onClick);
            root = null;
        }

        return {
            mount,
            destroy,
            getScrollElement: () => root
        };
    }

    window.MeditationDocument = { create };
})();
