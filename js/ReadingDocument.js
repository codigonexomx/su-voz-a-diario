/**
 * ReadingDocument
 * Administra exclusivamente la lectura biblica dentro de DeepeningShell.
 */
(function() {
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function defaultReadingHtml(reading = {}) {
        const text = reading.html || reading.text || reading.readingText || '';
        if (text) return text;
        return `<p>${escapeHtml(reading.reference || '')}</p>`;
    }

    function create(options = {}) {
        let root = null;
        let scrollElement = null;
        let textElement = null;
        let activeVersion = options.currentVersion || '';
        let preservedEditable = null;
        let preservedSelection = null;
        let preservedReadingScrollTop = null;
        let preservedReadingScrollRange = null;
        let lastReadingScrollTop = 0;
        let lastReadingScrollRange = 0;
        let activeVerseNumber = null;
        const reading = options.reading || {};
        const versions = Array.isArray(options.versions) ? options.versions : [];

        function getReadingHtml(versionId = activeVersion) {
            return options.getReadingHtml?.(versionId) || options.readingHtml || defaultReadingHtml(reading);
        }

        function renderVersionSelector() {
            if (options.versionSelectorHtml) {
                return `<div class="deepening-reading-version-slot">${options.versionSelectorHtml}</div>`;
            }

            if (!versions.length) return '';

            return `
                <div class="deepening-reading-version-selector" role="group" aria-label="Version de lectura biblica">
                    ${versions.map(version => `
                        <button
                            class="deepening-reading-version-option${version.id === activeVersion ? ' is-active' : ''}"
                            type="button"
                            data-deepening-version="${escapeHtml(version.id)}"
                            aria-pressed="${version.id === activeVersion ? 'true' : 'false'}"
                        >${escapeHtml(version.label || version.id)}</button>
                    `).join('')}
                </div>
            `;
        }

        function renderListenControl() {
            if (!options.onVoiceToggle) return '';

            const state = options.getVoiceState?.() || {};
            const status = state.status || 'idle';
            const isReading = status === 'speaking';
            const isPaused = status === 'paused';

            return `
                <div class="deepening-reading-voice" data-deepening-voice>
                    <button
                        class="deepening-reading-listen${isReading ? ' is-speaking' : ''}"
                        type="button"
                        data-deepening-voice-toggle
                        aria-label="${isReading ? 'Pausar lectura en voz alta' : (isPaused ? 'Continuar lectura en voz alta' : 'Escuchar lectura en voz alta')}"
                    >
                        <span class="deepening-reading-listen-icon" aria-hidden="true">${isReading ? 'Ⅱ' : '▶'}</span>
                        <span class="deepening-reading-listen-label">${isReading ? 'Escuchando lectura' : (isPaused ? 'Continuar lectura' : 'Escuchar lectura')}</span>
                    </button>
                    ${isReading || isPaused ? `
                        <button
                            class="deepening-reading-voice-stop"
                            type="button"
                            data-deepening-voice-stop
                            aria-label="Detener lectura en voz alta"
                        >
                            <span aria-hidden="true"></span>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        function render() {
            const reference = escapeHtml(reading.reference || '');

            return `
                <section class="deepening-bible-panel deepening-reading-document" aria-label="Lectura bíblica en modo Profundizar" data-deepening-reading-document>
                    <div class="deepening-reading-toolbar">
                        <div class="deepening-reading-toolbar-main">
                            ${reference ? `<div class="deepening-reading-reference">${reference}</div>` : ''}
                        </div>
                        <div class="deepening-reading-toolbar-actions">
                            ${renderVersionSelector()}
                            ${renderListenControl()}
                        </div>
                    </div>
                    <main class="deepening-reading" aria-label="Texto biblico">
                        <div class="deepening-reading-text selection-surface verse-container" data-selection-surface="true" data-deepening-reading-text>
                            ${getReadingHtml(activeVersion)}
                        </div>
                    </main>
                </section>
            `;
        }

        function syncVersionButtons() {
            root?.querySelectorAll('[data-deepening-version]').forEach(button => {
                const isActive = button.getAttribute('data-deepening-version') === activeVersion;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        }

        function syncVoiceControl() {
            const voiceRoot = root?.querySelector('[data-deepening-voice]');
            if (!voiceRoot || !options.onVoiceToggle) return;

            const state = options.getVoiceState?.() || {};
            const status = state.status || 'idle';
            const isReading = status === 'speaking';
            const isPaused = status === 'paused';
            const mainButton = voiceRoot.querySelector('[data-deepening-voice-toggle]');
            const icon = voiceRoot.querySelector('.deepening-reading-listen-icon');
            const label = voiceRoot.querySelector('.deepening-reading-listen-label');
            const stopButton = voiceRoot.querySelector('[data-deepening-voice-stop]');

            mainButton?.classList.toggle('is-speaking', isReading);
            mainButton?.setAttribute(
                'aria-label',
                isReading
                    ? 'Pausar lectura en voz alta'
                    : (isPaused ? 'Continuar lectura en voz alta' : 'Escuchar lectura en voz alta')
            );

            if (icon) icon.textContent = isReading ? 'Ⅱ' : '▶';
            if (label) {
                label.textContent = isReading
                    ? 'Escuchando lectura'
                    : (isPaused ? 'Continuar lectura' : 'Escuchar lectura');
            }

            if ((isReading || isPaused) && !stopButton) {
                voiceRoot.insertAdjacentHTML('beforeend', `
                    <button
                        class="deepening-reading-voice-stop"
                        type="button"
                        data-deepening-voice-stop
                        aria-label="Detener lectura en voz alta"
                    >
                        <span aria-hidden="true"></span>
                    </button>
                `);
            } else if (!isReading && !isPaused && stopButton) {
                stopButton.remove();
            }
        }

        function getVerseItemFromEvent(event) {
            const verseItem = event.target.closest?.('.verse-item[data-verse-number]');
            if (!verseItem || !textElement?.contains(verseItem)) return null;
            if (event.target.closest?.('button, a, input, textarea, [contenteditable="true"]')) return null;
            return verseItem;
        }

        function clearActiveVerse() {
            textElement?.querySelectorAll('.deepening-active-verse').forEach(item => {
                item.classList.remove('deepening-active-verse');
                item.removeAttribute('aria-current');
            });
        }

        function setActiveVerse(verseItem) {
            if (!verseItem) return;

            const nextVerseNumber = String(verseItem.getAttribute('data-verse-number') || '').trim();
            if (!nextVerseNumber) return;

            clearActiveVerse();
            activeVerseNumber = nextVerseNumber;
            verseItem.classList.add('deepening-active-verse');
            verseItem.setAttribute('aria-current', 'true');
            options.onActiveVerseChange?.({
                verseNumber: activeVerseNumber,
                text: verseItem.getAttribute('data-verse-text') || verseItem.textContent || '',
                element: verseItem
            });
        }

        function syncActiveVerse() {
            clearActiveVerse();
            if (!activeVerseNumber || !textElement) return;

            const activeVerse = Array.from(textElement.querySelectorAll('.verse-item[data-verse-number]'))
                .find(item => item.getAttribute('data-verse-number') === activeVerseNumber);
            if (activeVerse) {
                activeVerse.classList.add('deepening-active-verse');
                activeVerse.setAttribute('aria-current', 'true');
            } else {
                activeVerseNumber = null;
            }
        }

        function clearNonEditableSelection() {
            const selection = window.getSelection?.();
            if (!selection || selection.rangeCount === 0) return;

            const anchor = selection.anchorNode;
            const anchorElement = anchor?.nodeType === Node.ELEMENT_NODE
                ? anchor
                : anchor?.parentElement;

            if (isEditableElement(anchorElement) || isEditableElement(document.activeElement)) return;
            selection.removeAllRanges();
        }

        function isEditableElement(element) {
            return Boolean(element?.closest?.('[contenteditable="true"], textarea, input'));
        }

        function preserveWritingFocus() {
            const activeElement = document.activeElement;
            preservedEditable = isEditableElement(activeElement) ? activeElement : null;
            const selection = window.getSelection?.();
            preservedSelection = selection && selection.rangeCount > 0
                ? selection.getRangeAt(0).cloneRange()
                : null;
        }

        function restoreWritingFocus() {
            if (!preservedEditable?.isConnected) return;

            preservedEditable.focus({ preventScroll: true });
            if (preservedSelection) {
                const selection = window.getSelection?.();
                selection?.removeAllRanges();
                selection?.addRange(preservedSelection);
            }
        }

        function rememberReadingPosition() {
            if (!scrollElement) return;

            const nextScrollTop = scrollElement.scrollTop || 0;
            const nextScrollRange = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
            if (nextScrollTop > 2 || lastReadingScrollTop <= 2) {
                lastReadingScrollTop = nextScrollTop;
                lastReadingScrollRange = nextScrollRange;
            }
        }

        function preserveReadingPosition() {
            if (!scrollElement) return;

            const currentScrollTop = scrollElement.scrollTop || 0;
            const currentScrollRange = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
            preservedReadingScrollTop = currentScrollTop <= 2 && lastReadingScrollTop > 2
                ? lastReadingScrollTop
                : currentScrollTop;
            preservedReadingScrollRange = currentScrollTop <= 2 && lastReadingScrollTop > 2
                ? lastReadingScrollRange
                : currentScrollRange;
        }

        function restoreReadingPosition(previousScrollTop, previousScrollRange) {
            if (!scrollElement) return;

            const nextScrollRange = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
            const scrollRatio = previousScrollRange > 0 ? previousScrollTop / previousScrollRange : 0;
            const nextScrollTop = previousScrollRange > 0
                ? Math.min(nextScrollRange, Math.max(0, Math.round(nextScrollRange * scrollRatio)))
                : previousScrollTop;

            scrollElement.scrollTop = nextScrollTop;
            requestAnimationFrame(() => {
                if (scrollElement) {
                    scrollElement.scrollTop = nextScrollTop;
                }
            });
        }

        function setVersion(versionId) {
            const nextVersion = String(versionId || '').trim();
            if (!nextVersion || nextVersion === activeVersion) return;

            const previousScrollTop = scrollElement?.scrollTop || 0;
            const previousScrollRange = scrollElement
                ? Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
                : 0;
            const targetScrollTop = preservedReadingScrollTop ?? previousScrollTop;
            const targetScrollRange = preservedReadingScrollRange ?? previousScrollRange;

            activeVersion = nextVersion;
            if (textElement) {
                textElement.innerHTML = getReadingHtml(activeVersion);
            }
            syncActiveVerse();
            restoreReadingPosition(targetScrollTop, targetScrollRange);
            syncVersionButtons();
            restoreWritingFocus();
            options.onVersionChange?.(activeVersion);
            syncVoiceControl();
            preservedReadingScrollTop = null;
            preservedReadingScrollRange = null;
        }

        function onPointerDown(event) {
            const verseItem = getVerseItemFromEvent(event);
            if (verseItem) {
                event.preventDefault();
                event.stopPropagation();
                clearNonEditableSelection();
                setActiveVerse(verseItem);
                return;
            }

            const versionButton = event.target.closest('[data-deepening-version]');
            if (!versionButton || !root?.contains(versionButton)) return;

            preserveWritingFocus();
            preserveReadingPosition();
            if (preservedEditable) {
                event.preventDefault();
            }
        }

        function onClick(event) {
            const verseItem = getVerseItemFromEvent(event);
            if (verseItem) {
                event.preventDefault();
                event.stopPropagation();
                clearNonEditableSelection();
                setActiveVerse(verseItem);
                return;
            }

            const versionButton = event.target.closest('[data-deepening-version]');
            if (versionButton && root?.contains(versionButton)) {
                setVersion(versionButton.getAttribute('data-deepening-version'));
                return;
            }

            if (event.target.closest('[data-deepening-voice-toggle]')) {
                options.onVoiceToggle?.(activeVersion);
                requestAnimationFrame(syncVoiceControl);
                return;
            }

            if (event.target.closest('[data-deepening-voice-stop]')) {
                options.onVoiceStop?.();
                requestAnimationFrame(syncVoiceControl);
            }
        }

        function onVoiceStateChange() {
            syncVoiceControl();
        }

        function mount(target) {
            target.innerHTML = render();
            root = target.querySelector('[data-deepening-reading-document]');
            scrollElement = root;
            textElement = target.querySelector('[data-deepening-reading-text]');
            rememberReadingPosition();
            root?.addEventListener('scroll', rememberReadingPosition, { passive: true });
            root?.addEventListener('pointerdown', onPointerDown);
            root?.addEventListener('click', onClick);
            document.addEventListener('suvoz:daily-reading-voice-change', onVoiceStateChange);
            return root;
        }

        function destroy() {
            document.removeEventListener('suvoz:daily-reading-voice-change', onVoiceStateChange);
            root?.removeEventListener('scroll', rememberReadingPosition);
            root?.removeEventListener('pointerdown', onPointerDown);
            root?.removeEventListener('click', onClick);
            root = null;
            scrollElement = null;
            textElement = null;
            preservedEditable = null;
            preservedSelection = null;
            preservedReadingScrollTop = null;
            preservedReadingScrollRange = null;
            lastReadingScrollTop = 0;
            lastReadingScrollRange = 0;
        }

        return {
            mount,
            destroy,
            getScrollElement: () => scrollElement,
            setVersion
        };
    }

    window.ReadingDocument = { create };
})();
