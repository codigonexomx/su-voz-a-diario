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
            if (options.voiceControlHtml) {
                return `<div class="deepening-reading-voice-slot">${options.voiceControlHtml}</div>`;
            }

            if (!options.onListen) return '';

            return `
                <button class="deepening-reading-listen" type="button" data-deepening-listen>
                    Escuchar
                </button>
            `;
        }

        function render() {
            const reference = escapeHtml(reading.reference || '');

            return `
                <section class="deepening-reading-document" aria-label="Lectura biblica en modo Profundizar" data-deepening-reading-document>
                    <div class="deepening-reading-toolbar">
                        ${renderVersionSelector()}
                        ${renderListenControl()}
                    </div>
                    <main class="deepening-reading" aria-label="Texto biblico">
                        ${reference ? `<div class="deepening-reading-reference">${reference}</div>` : ''}
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
            restoreReadingPosition(targetScrollTop, targetScrollRange);
            syncVersionButtons();
            restoreWritingFocus();
            options.onVersionChange?.(activeVersion);
            preservedReadingScrollTop = null;
            preservedReadingScrollRange = null;
        }

        function onPointerDown(event) {
            const versionButton = event.target.closest('[data-deepening-version]');
            if (!versionButton || !root?.contains(versionButton)) return;

            preserveWritingFocus();
            preserveReadingPosition();
            if (preservedEditable) {
                event.preventDefault();
            }
        }

        function onClick(event) {
            const versionButton = event.target.closest('[data-deepening-version]');
            if (versionButton && root?.contains(versionButton)) {
                setVersion(versionButton.getAttribute('data-deepening-version'));
                return;
            }

            if (event.target.closest('[data-deepening-listen]')) {
                options.onListen?.();
            }
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
            return root;
        }

        function destroy() {
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
