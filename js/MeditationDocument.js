/**
 * MeditationDocument
 * Administra exclusivamente el cuaderno de meditacion.
 */
(function() {
    const STEPS = [
        {
            id: 'god',
            label: 'Cómo es Dios',
            intro: 'Mira primero a Dios antes de mirarte a ti.',
            questions: [
                '¿Qué revela este pasaje acerca de Dios?',
                '¿Qué acciones de Dios aparecen en el texto?',
                '¿Qué atributo, promesa o propósito de Dios destaca en este pasaje?'
            ]
        },
        {
            id: 'teaching',
            label: 'Enseñanza',
            intro: 'Escucha con calma la verdad central del pasaje.',
            questions: [
                '¿Cuál es la enseñanza principal del texto?',
                '¿Qué verdad enseña este pasaje?',
                '¿Hay algún ejemplo, mandato, advertencia o principio que debas notar?'
            ]
        },
        {
            id: 'application',
            label: 'Aplicación',
            intro: 'Deja que la Palabra ilumine tu vida de hoy.',
            questions: [
                '¿Cómo se relaciona este pasaje con tu vida actual?',
                '¿Qué necesitas creer, cambiar, obedecer o practicar?',
                '¿Qué paso concreto puedes dar hoy para obedecer esta verdad?'
            ]
        },
        {
            id: 'prayer',
            label: 'Oración',
            intro: 'Responde a Dios desde lo que has visto en su Palabra.',
            questions: [
                '¿Qué puedes agradecerle a Dios?',
                '¿Qué necesitas confesarle o entregarle?',
                '¿Qué ayuda necesitas pedirle para vivir esta verdad?'
            ]
        }
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

    function normalizeDocumentMetadata(metadata) {
        return {
            date: String(metadata?.date ?? ''),
            reference: String(metadata?.reference ?? ''),
            version: String(metadata?.version ?? '')
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

    function setCaretFromPoint(element, clientX, clientY) {
        if (!element) return;

        const range = document.caretRangeFromPoint?.(clientX, clientY);
        if (range && element.contains(range.startContainer)) {
            const selection = window.getSelection?.();
            selection?.removeAllRanges();
            selection?.addRange(range);
            return;
        }

        const position = document.caretPositionFromPoint?.(clientX, clientY);
        if (position?.offsetNode && element.contains(position.offsetNode)) {
            const selection = window.getSelection?.();
            const nextRange = document.createRange();
            nextRange.setStart(position.offsetNode, position.offset);
            nextRange.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(nextRange);
        }
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
        let root = null;
        const initialNote = normalizeNote(options.initialNote);
        const currentNote = normalizeNote(initialNote);
        const initialUIState = options.initialUIState || {};
        let documentMetadata = normalizeDocumentMetadata(options.documentMetadata);
        let activeStepId = STEPS.some(step => step.id === initialUIState.activeStepId)
            ? initialUIState.activeStepId
            : STEPS[0].id;
        let pendingCaretRestore = initialUIState.caret || null;
        let autosaveTimer = null;
        let caretScrollRafId = null;
        let scrollCueTimer = null;
        let isScrollCueVisible = false;
        let lastSavedNoteSignature = noteSignature(initialNote);
        let lastSavedUIStateSignature = '';

        function renderDefaultContent() {
            return `
                <nav class="deepening-step-list" aria-label="Pasos de meditación">
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
                        <p>${escapeHtml(step.intro)}</p>
                        ${step.questions.map(question => `<p>${escapeHtml(question)}</p>`).join('')}
                    </section>
                `).join('')}

                <div
                    class="deepening-writing-area"
                    role="textbox"
                    contenteditable="true"
                    aria-multiline="true"
                    data-deepening-editor
                    data-placeholder="Escribe aquí"
                    aria-label="Respuesta de meditación: ${escapeHtml(STEPS.find(step => step.id === activeStepId)?.label || STEPS[0].label)}"
                >${editorHtml(currentNote[getStepField(activeStepId)])}</div>
            `;
        }

        function render() {
            return `
                <section class="deepening-meditation-panel deepening-meditation-document" aria-label="Cuaderno de meditación" data-deepening-meditation-document>
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
            return root?.querySelector('[data-deepening-editor]') || null;
        }

        function getCurrentNote() {
            commitActiveEditor();
            return normalizeNote(currentNote);
        }

        function setDocumentMetadata(metadata) {
            documentMetadata = normalizeDocumentMetadata({
                ...documentMetadata,
                ...(metadata || {})
            });
        }

        function getCurrentDocument() {
            return window.DocumentFactory.create({
                metadata: documentMetadata,
                sections: getCurrentNote()
            });
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

        function updateScrollCueAvailability() {
            if (!root) return;

            const canScroll = root.scrollHeight - root.clientHeight > 2;
            root.classList.toggle('deepening-scroll-cue-available', canScroll);
            if (!canScroll) {
                hideScrollCue();
            }
        }

        function hideScrollCue() {
            window.clearTimeout(scrollCueTimer);
            scrollCueTimer = null;
            isScrollCueVisible = false;
            root?.classList.remove('deepening-scroll-cue-visible');
        }

        function revealScrollCue() {
            if (!root) return;

            updateScrollCueAvailability();
            if (!root.classList.contains('deepening-scroll-cue-available')) return;

            isScrollCueVisible = true;
            root.classList.add('deepening-scroll-cue-visible');
            window.clearTimeout(scrollCueTimer);
            scrollCueTimer = window.setTimeout(hideScrollCue, 720);
        }

        function onMeditationScroll() {
            scheduleAutoSave();
            updateScrollCueAvailability();
            if (isScrollCueVisible) {
                revealScrollCue();
            }
        }

        function onScrollIntent(event) {
            if (!root?.contains(event.target)) return;
            revealScrollCue();
        }

        function ensureEditorCaretVisible(editor = getEditor(activeStepId)) {
            if (!editor || document.activeElement !== editor) return;

            const caretRect = getCaretRect();
            if (!caretRect) return;

            const documentRect = root.getBoundingClientRect();
            const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 24;
            const bottomMargin = lineHeight * 2.4;
            const topMargin = lineHeight;
            const visibleBottom = documentRect.bottom - bottomMargin;
            const visibleTop = documentRect.top + topMargin;

            if (caretRect.bottom > visibleBottom) {
                root.scrollTop += caretRect.bottom - visibleBottom;
            } else if (caretRect.top < visibleTop) {
                root.scrollTop -= visibleTop - caretRect.top;
            }
        }

        function scheduleCaretVisibilityCheck(editor = getEditor(activeStepId)) {
            if (caretScrollRafId !== null) {
                cancelAnimationFrame(caretScrollRafId);
            }

            caretScrollRafId = requestAnimationFrame(() => {
                caretScrollRafId = null;
                ensureEditorCaretVisible(editor);
            });
        }

        function restoreUIState() {
            if (!root) return;
            if (typeof initialUIState.scrollTop === 'number') {
                root.scrollTop = initialUIState.scrollTop;
            }

            lastSavedUIStateSignature = uiStateSignature(getUIState());
        }

        function commitActiveEditor() {
            const editor = getEditor();
            if (!editor) return;
            currentNote[getStepField(activeStepId)] = editor.innerText || '';
        }

        function setActiveStep(stepId) {
            if (!STEPS.some(step => step.id === stepId)) return;
            if (stepId === activeStepId) {
                scheduleAutoSave();
                return;
            }

            const editor = getEditor();
            const wasEditorActive = document.activeElement === editor;
            commitActiveEditor();
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

            if (editor) {
                const activeStep = STEPS.find(step => step.id === activeStepId) || STEPS[0];
                editor.setAttribute('aria-label', `Respuesta de meditación: ${activeStep.label}`);
                editor.innerHTML = editorHtml(currentNote[getStepField(activeStepId)]);
                if (wasEditorActive) {
                    const selection = window.getSelection?.();
                    const range = document.createRange();
                    range.selectNodeContents(editor);
                    range.collapse(false);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                    scheduleCaretVisibilityCheck(editor);
                }
            }
            scheduleAutoSave();
        }

        function isEditorActive() {
            return Boolean(document.activeElement?.closest?.('[data-deepening-editor]'));
        }

        function onPointerDown(event) {
            const editor = event.target.closest('[data-deepening-editor]');
            if (editor && root?.contains(editor) && document.activeElement !== editor) {
                event.preventDefault();
                editor.focus({ preventScroll: true });
                setCaretFromPoint(editor, event.clientX, event.clientY);
                scheduleCaretVisibilityCheck(editor);
                scheduleAutoSave();
                return;
            }

            const step = event.target.closest('.deepening-step');
            if (!step || !root?.contains(step) || !isEditorActive()) return;

            const stepId = step.getAttribute('data-step');
            if (!stepId) return;

            event.preventDefault();
            setActiveStep(stepId);
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
                setActiveStep(stepId);
            }
        }

        function onInput(event) {
            const editor = event.target.closest('[data-deepening-editor]');
            if (!editor) return;
            currentNote[getStepField(activeStepId)] = editor.innerText || '';
            scheduleCaretVisibilityCheck(editor);
            requestAnimationFrame(updateScrollCueAvailability);
            scheduleAutoSave();
        }

        function onBeforeInput(event) {
            const editor = event.target.closest('[data-deepening-editor]');
            if (!editor) return;
            scheduleCaretVisibilityCheck(editor);
        }

        function onCompositionUpdate(event) {
            const editor = event.target.closest('[data-deepening-editor]');
            if (!editor) return;
            scheduleCaretVisibilityCheck(editor);
        }

        function onCompositionEnd(event) {
            const editor = event.target.closest('[data-deepening-editor]');
            if (!editor) return;
            scheduleCaretVisibilityCheck(editor);
            scheduleAutoSave();
        }

        function onPaste(event) {
            const editor = event.target.closest('[data-deepening-editor]');
            if (!editor) return;
            scheduleCaretVisibilityCheck(editor);
        }

        function onFocusIn(event) {
            const editor = event.target.closest('[data-deepening-editor]');
            if (!editor) return;
            scheduleCaretVisibilityCheck(editor);
            if (!pendingCaretRestore) return;
            if (pendingCaretRestore.stepId !== activeStepId) return;

            const caret = pendingCaretRestore;
            pendingCaretRestore = null;
            requestAnimationFrame(() => {
                setCaretCharacterOffset(editor, caret.offset);
                scheduleCaretVisibilityCheck(editor);
            });
        }

        function onSelectionChange() {
            if (!root?.contains(document.activeElement)) return;
            if (!isEditorActive()) return;
            scheduleCaretVisibilityCheck(document.activeElement);
            scheduleAutoSave();
        }

        function mount(target) {
            target.innerHTML = render();
            root = target.querySelector('[data-deepening-meditation-document]');
            root?.addEventListener('pointerdown', onPointerDown);
            root?.addEventListener('click', onClick);
            root?.addEventListener('beforeinput', onBeforeInput);
            root?.addEventListener('input', onInput);
            root?.addEventListener('compositionupdate', onCompositionUpdate);
            root?.addEventListener('compositionend', onCompositionEnd);
            root?.addEventListener('paste', onPaste);
            root?.addEventListener('focusin', onFocusIn);
            root?.addEventListener('scroll', onMeditationScroll, { passive: true });
            root?.addEventListener('wheel', onScrollIntent, { passive: true });
            root?.addEventListener('touchmove', onScrollIntent, { passive: true });
            document.addEventListener('selectionchange', onSelectionChange);
            requestAnimationFrame(() => {
                restoreUIState();
                updateScrollCueAvailability();
            });
            return root;
        }

        function destroy() {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
            hideScrollCue();
            if (caretScrollRafId !== null) {
                cancelAnimationFrame(caretScrollRafId);
                caretScrollRafId = null;
            }
            flushAutoSave(true);
            root?.removeEventListener('pointerdown', onPointerDown);
            root?.removeEventListener('click', onClick);
            root?.removeEventListener('beforeinput', onBeforeInput);
            root?.removeEventListener('input', onInput);
            root?.removeEventListener('compositionupdate', onCompositionUpdate);
            root?.removeEventListener('compositionend', onCompositionEnd);
            root?.removeEventListener('paste', onPaste);
            root?.removeEventListener('focusin', onFocusIn);
            root?.removeEventListener('scroll', onMeditationScroll);
            root?.removeEventListener('wheel', onScrollIntent);
            root?.removeEventListener('touchmove', onScrollIntent);
            document.removeEventListener('selectionchange', onSelectionChange);
            root = null;
        }

        return {
            mount,
            destroy,
            getScrollElement: () => root,
            getCurrentDocument,
            setDocumentMetadata
        };
    }

    window.MeditationDocument = { create };
})();
