/**
 * DeepeningShell
 * Shell aislado para la nueva experiencia de Profundizar.
 * No se conecta al botón actual hasta la fase de reemplazo.
 */
(function() {
    let controller = null;
    let root = null;
    let restoreSnapshot = null;

    function getRoot() {
        root = root || document.getElementById('deepening-root');
        return root;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function createSnapshot(options = {}) {
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

    function restoreReadingPosition() {
        if (!restoreSnapshot) return;

        const { scrollX, scrollY } = restoreSnapshot;
        const restore = () => window.scrollTo(scrollX, scrollY);
        restore();
        requestAnimationFrame(() => {
            restore();
            requestAnimationFrame(restore);
        });
    }

    function restoreFocus() {
        const previousFocus = restoreSnapshot?.activeElement;
        if (previousFocus?.isConnected) {
            previousFocus.focus({ preventScroll: true });
        }
    }

    function defaultReadingHtml(reading = {}) {
        const text = reading.html || reading.text || reading.readingText || '';
        if (text) return text;
        return `<p>${escapeHtml(reading.reference || '')}</p>`;
    }

    function defaultMeditationHtml() {
        const steps = [
            { id: 'god', label: '¿Cómo es Dios?', title: 'Contempla el carácter de Dios revelado en este pasaje.' },
            { id: 'teaching', label: 'Enseñanza', title: 'Observa qué verdad desea formar en ti.' },
            { id: 'application', label: 'Aplicación', title: 'Nombra una respuesta sencilla para hoy.' },
            { id: 'prayer', label: 'Oración', title: 'Responde a Dios con tus propias palabras.' }
        ];

        return `
            <div class="deepening-meditation-frame">
                <nav class="deepening-step-list" aria-label="Pasos de meditación">
                    ${steps.map((step, index) => `
                        <button
                            class="deepening-step ${index === 0 ? 'is-active' : ''}"
                            type="button"
                            data-step="${step.id}"
                            ${index === 0 ? 'aria-current="step"' : ''}
                        >
                            <span class="deepening-step-kicker">0${index + 1}</span>
                            <span class="deepening-step-label">${step.label}</span>
                        </button>
                    `).join('')}
                </nav>

                <section class="deepening-prompt" aria-label="Espacio de reflexión">
                    <p class="deepening-prompt-eyebrow">Primer movimiento</p>
                    <h2>¿Cómo es Dios?</h2>
                    <p>${steps[0].title}</p>
                    <textarea
                        class="deepening-journal-field"
                        rows="7"
                        placeholder="Escribe despacio. Una frase honesta es suficiente."
                        aria-label="Respuesta de meditación"
                    ></textarea>
                </section>
            </div>
        `;
    }

    function renderShell(options = {}) {
        const reading = options.reading || {};
        const reference = escapeHtml(reading.reference || '');
        const readingHtml = options.readingHtml || defaultReadingHtml(reading);
        const versionSelectorHtml = options.versionSelectorHtml || '';
        const voiceControlHtml = options.voiceControlHtml || '';
        const meditationHtml = options.meditationHtml || defaultMeditationHtml();
        const toolsHtml = versionSelectorHtml || voiceControlHtml
            ? `
                <div class="deepening-reading-tools">
                    <div class="deepening-version-slot">${versionSelectorHtml}</div>
                    <div class="deepening-voice-slot">${voiceControlHtml}</div>
                </div>
            `
            : '';

        return `
            <div class="deepening-shell" data-sheet-state="middle" role="dialog" aria-modal="true" aria-label="Modo Profundizar" tabindex="-1">
                <div class="deepening-reading-scroll" data-deepening-reading-scroll>
                    <main class="deepening-reading" aria-label="Lectura bíblica en modo Profundizar">
                        ${toolsHtml}
                        ${reference ? `<div class="deepening-reading-reference">${reference}</div>` : ''}
                        <div class="deepening-reading-text selection-surface verse-container" data-selection-surface="true">
                            ${readingHtml}
                        </div>
                    </main>
                </div>

                <section class="deepening-sheet" data-state="middle" aria-label="Mi meditación">
                    <header class="deepening-sheet-header" data-deepening-sheet-header>
                        <div class="deepening-sheet-grabber" aria-hidden="true"></div>
                        <div class="deepening-sheet-title">Reflexiona</div>
                        <button class="deepening-sheet-close" type="button" aria-label="Salir de Profundizar" data-deepening-close>&times;</button>
                    </header>
                    <div class="deepening-sheet-body" data-deepening-sheet-body>
                        ${meditationHtml}
                    </div>
                </section>
            </div>
        `;
    }

    async function unmount(options = {}) {
        const targetRoot = getRoot();
        if (!targetRoot) return;

        try {
            await options.onAutoSave?.();
        } finally {
            controller?.destroy();
            controller = null;
            targetRoot.innerHTML = '';
            targetRoot.hidden = true;
            document.documentElement.classList.remove('deepening-shell-active');

            if (options.restore !== false) {
                await options.onRestore?.(restoreSnapshot);
                restoreFocus();
                restoreReadingPosition();
            }

            restoreSnapshot = null;
        }
    }

    function mount(options = {}) {
        const targetRoot = getRoot();
        if (!targetRoot) return null;

        controller?.destroy();
        restoreSnapshot = createSnapshot(options);
        targetRoot.hidden = false;
        targetRoot.innerHTML = renderShell(options);
        document.documentElement.classList.add('deepening-shell-active');

        const sheet = targetRoot.querySelector('.deepening-sheet');
        const header = targetRoot.querySelector('[data-deepening-sheet-header]');
        const body = targetRoot.querySelector('[data-deepening-sheet-body]');
        const closeButton = targetRoot.querySelector('[data-deepening-close]');

        controller = window.DeepeningBottomSheetController?.create({
            onAutoSave: options.onAutoSave,
            onClose: () => {
                unmount({
                    restore: true,
                    onRestore: options.onRestore
                });
            },
            onStateChange: state => {
                targetRoot.querySelector('.deepening-shell')?.setAttribute('data-sheet-state', state);
                options.onStateChange?.(state);
            }
        });

        controller?.init({
            root: targetRoot,
            sheet,
            header,
            body,
            closeButton
        });

        targetRoot.querySelector('.deepening-shell')?.focus({ preventScroll: true });

        return {
            root: targetRoot,
            controller,
            unmount: () => unmount({
                restore: true,
                onAutoSave: options.onAutoSave,
                onRestore: options.onRestore
            })
        };
    }

    window.DeepeningShell = {
        mount,
        unmount: () => unmount({ restore: true }),
        isMounted: () => Boolean(controller),
        getController: () => controller
    };

    // Funcion temporal para revision visual aislada. Eliminar al conectar el flujo real.
    window.suVozOpenNewDeepeningMode = function() {
        return mount({
            reading: {
                date: '2026-07-26',
                reference: 'Salmo 23:1-4',
                html: '<p>El Señor es mi pastor; nada me faltara.</p><p>En lugares de delicados pastos me hara descansar.</p><p>Confortara mi alma; me guiara por sendas de justicia por amor de su nombre.</p><p>Aunque ande en valle de sombra de muerte, no temere mal alguno, porque tu estaras conmigo.</p>'
            },
            versionSelectorHtml: '<span class="deepening-dev-chip">RV1909</span>',
            voiceControlHtml: '<span class="deepening-dev-chip deepening-dev-chip-muted">Lectura pausada</span>'
        });
    };
})();
