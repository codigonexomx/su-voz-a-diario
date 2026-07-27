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
    const STEP_FIELDS = {
        god: 'dios',
        teaching: 'aprendizaje',
        application: 'respuesta',
        prayer: 'oracion'
    };
    const AUTOSAVE_DELAY = 700;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function normalizeNote(note) {
        return {
            ...(note || {}),
            dios: note?.dios || '',
            aprendizaje: note?.aprendizaje || '',
            respuesta: note?.respuesta || '',
            oracion: note?.oracion || ''
        };
    }

    function getStepField(stepId) {
        return STEP_FIELDS[stepId] || STEP_FIELDS.god;
    }

    function noteSignature(note) {
        return JSON.stringify(STEPS.map(step => note[getStepField(step.id)] || ''));
    }

    function editorHtml(value) {
        return escapeHtml(value).replace(/\n/g, '<br>');
    }

    function getCaretCharacterOffset(element) {
        const selection = window.getSelection?.();
        if (!element || !selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        if (!element.contains(range.startContainer)) return null;

        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        return preCaretRange.toString().length;
    }

    function setCaretCharacterOffset(element, offset) {
        if (!element || typeof offset !== 'number' || offset < 0) return;

        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let remaining = offset;
        let node = walker.nextNode();

        while (node) {
            const length = node.textContent.length;
            if (remaining <= length) {
                const range = document.createRange();
                const selection = window.getSelection?.();
                range.setStart(node, remaining);
                range.collapse(true);
                selection?.removeAllRanges();
                selection?.addRange(range);
                element.focus({ preventScroll: true });
                return;
            }
            remaining -= length;
            node = walker.nextNode();
        }

        element.focus({ preventScroll: true });
    }

    function create(options = {}) {
        let root = null;
        const initialNote = normalizeNote(options.initialNote);
        const initialUIState = options.initialUIState || {};
        let activeStepId = STEPS.some(step => step.id === initialUIState.activeStepId)
            ? initialUIState.activeStepId
            : STEPS[0].id;
        let pendingCaretRestore = initialUIState.caret || null;
        let autosaveTimer = null;
        let lastSavedNoteSignature = noteSignature(initialNote);
        let lastSavedUIStateSignature = '';

        function renderDefaultContent() {
            return `
                <nav class="deepening-step-list" aria-label="Pasos de meditacion">
                    ${STEPS.map((step, index) => `
                        <button
                            class="deepening-step${step.id === activeStepId ? ' is-active' : ''}"
                            type="button"
                            data-step="${step.id}"
                            ${step.id === activeStepId ? 'aria-current="step"' : ''}
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
                        ${step.id === activeStepId ? '' : 'hidden'}
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
                        >${editorHtml(initialNote[getStepField(step.id)])}</div>
                    </section>
                `).join('')}
            `;
        }

        function render() {
            return `
                <section class="deepening-meditation-panel deepening-meditation-document" aria-label="Cuaderno de meditacion" data-deepening-meditation-document>
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

        function getEditor(stepId = activeStepId) {
            return root?.querySelector(`[data-step-panel="${stepId}"] [data-deepening-editor]`) || null;
        }

        function getCurrentNote() {
            const note = normalizeNote(initialNote);
            STEPS.forEach(step => {
                const editor = getEditor(step.id);
                note[getStepField(step.id)] = editor?.innerText || '';
            });
            return note;
        }

        function getUIState() {
            const editor = getEditor(activeStepId);
            return {
                activeStepId,
                scrollTop: root?.scrollTop || 0,
                caret: {
                    stepId: activeStepId,
                    offset: getCaretCharacterOffset(editor)
                }
            };
        }

        function uiStateSignature(uiState) {
            return JSON.stringify({
                activeStepId: uiState.activeStepId,
                scrollTop: Math.round(uiState.scrollTop || 0),
                caret: uiState.caret || null
            });
        }

        function flushAutoSave(force = false) {
            if (!root || typeof options.onAutoSave !== 'function') return;

            const note = getCurrentNote();
            const uiState = getUIState();
            const nextNoteSignature = noteSignature(note);
            const nextUIStateSignature = uiStateSignature(uiState);
            const noteChanged = nextNoteSignature !== lastSavedNoteSignature;
            const uiChanged = nextUIStateSignature !== lastSavedUIStateSignature;

            if (!force && !noteChanged && !uiChanged) return;

            options.onAutoSave(note, uiState, { noteChanged, uiChanged });
            lastSavedNoteSignature = nextNoteSignature;
            lastSavedUIStateSignature = nextUIStateSignature;
        }

        function scheduleAutoSave() {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = window.setTimeout(() => {
                autosaveTimer = null;
                flushAutoSave();
            }, AUTOSAVE_DELAY);
        }

        function restoreUIState() {
            if (!root) return;
            if (typeof initialUIState.scrollTop === 'number') {
                root.scrollTop = initialUIState.scrollTop;
            }

            lastSavedUIStateSignature = uiStateSignature(getUIState());
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
                    getEditor(activeStepId)?.focus({ preventScroll: true });
                });
            }
            scheduleAutoSave();
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
                flushAutoSave(true);
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

        function onInput(event) {
            if (!event.target.closest('[data-deepening-editor]')) return;
            scheduleAutoSave();
        }

        function onFocusIn(event) {
            const editor = event.target.closest('[data-deepening-editor]');
            if (!editor || !pendingCaretRestore) return;
            if (pendingCaretRestore.stepId !== activeStepId) return;

            const caret = pendingCaretRestore;
            pendingCaretRestore = null;
            requestAnimationFrame(() => setCaretCharacterOffset(editor, caret.offset));
        }

        function onSelectionChange() {
            if (!root?.contains(document.activeElement)) return;
            if (!isEditorActive()) return;
            scheduleAutoSave();
        }

        function mount(target) {
            target.innerHTML = render();
            root = target.querySelector('[data-deepening-meditation-document]');
            root?.addEventListener('pointerdown', onPointerDown);
            root?.addEventListener('click', onClick);
            root?.addEventListener('input', onInput);
            root?.addEventListener('focusin', onFocusIn);
            root?.addEventListener('scroll', scheduleAutoSave, { passive: true });
            document.addEventListener('selectionchange', onSelectionChange);
            requestAnimationFrame(restoreUIState);
            return root;
        }

        function destroy() {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
            flushAutoSave(true);
            root?.removeEventListener('pointerdown', onPointerDown);
            root?.removeEventListener('click', onClick);
            root?.removeEventListener('input', onInput);
            root?.removeEventListener('focusin', onFocusIn);
            root?.removeEventListener('scroll', scheduleAutoSave);
            document.removeEventListener('selectionchange', onSelectionChange);
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
