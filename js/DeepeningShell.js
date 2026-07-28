/**
 * DeepeningShell
 * Orquesta dos documentos independientes: lectura biblica y meditacion.
 */
(function() {
    let root = null;
    let restorePositionRecord = null;
    let readingDocument = null;
    let meditationDocument = null;
    let keyboardManager = null;
    let meditationActionsPanel = null;
    let documentViewerOverlay = null;
    let documentViewer = null;
    let documentViewerFocusReturnElement = null;
    let documentViewerBackgroundState = [];
    let backgroundState = null;
    let releaseInstantScrollFrame = null;
    let releaseInstantScrollSecondFrame = null;
    let instantScrollRestoreHadClass = false;

    function getRoot() {
        root = root || document.getElementById('deepening-root');
        return root;
    }

    function renderShell() {
        return `
            <div class="deepening-shell" role="dialog" aria-modal="true" aria-label="Modo Profundizar" tabindex="-1">
                <div class="deepening-reading-host" data-deepening-reading-host></div>
                <div class="deepening-meditation-host" data-deepening-meditation-host></div>
            </div>
        `;
    }

    function renderDocumentViewerOverlay() {
        return `
            <div class="deepening-document-viewer-overlay" data-deepening-document-viewer-overlay role="dialog" aria-modal="true" aria-label="Documento de meditación" tabindex="-1">
                <div class="deepening-document-viewer-topbar">
                    <button class="deepening-document-viewer-close" type="button" data-deepening-document-viewer-close aria-label="Cerrar documento">×</button>
                </div>
                <div class="deepening-document-viewer-scroll" data-deepening-document-viewer-scroll></div>
            </div>
        `;
    }

    function getStableViewportHeight() {
        return window.innerHeight || document.documentElement.clientHeight || screen.height || 0;
    }

    function getBackgroundElements() {
        return [
            document.querySelector('body > header'),
            document.getElementById('app-content'),
            document.querySelector('body > .bottom-nav')
        ].filter(Boolean);
    }

    function lockBackground(options = {}) {
        if (backgroundState) return;

        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
        const backgroundElements = getBackgroundElements();

        backgroundState = {
            scrollX,
            scrollY,
            activeElement: document.activeElement instanceof HTMLElement ? document.activeElement : null,
            htmlStyle: {
                overflow: document.documentElement.style.overflow,
                overscrollBehavior: document.documentElement.style.overscrollBehavior,
                scrollbarGutter: document.documentElement.style.scrollbarGutter
            },
            bodyStyle: {
                position: document.body.style.position,
                top: document.body.style.top,
                left: document.body.style.left,
                right: document.body.style.right,
                width: document.body.style.width,
                overflow: document.body.style.overflow,
                paddingRight: document.body.style.paddingRight,
                overscrollBehavior: document.body.style.overscrollBehavior
            },
            backgroundElements: backgroundElements.map(element => ({
                element,
                inert: element.inert,
                inertAttribute: element.hasAttribute('inert'),
                ariaHidden: element.getAttribute('aria-hidden')
            }))
        };

        document.documentElement.classList.add('deepening-shell-active');
        document.body.classList.add('deepening-shell-active');
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.overscrollBehavior = 'none';
        document.documentElement.style.scrollbarGutter = 'stable';

        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        backgroundState.backgroundElements.forEach(({ element }) => {
            element.inert = true;
            element.setAttribute('inert', '');
            element.setAttribute('aria-hidden', 'true');
        });

        if (options.root) {
            options.root.removeAttribute('aria-hidden');
            options.root.inert = false;
        }
    }

    function restoreStyle(target, styles) {
        Object.entries(styles).forEach(([property, value]) => {
            target.style[property] = value;
        });
    }

    function nextFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    function cancelInstantScrollRelease() {
        if (releaseInstantScrollFrame !== null) {
            cancelAnimationFrame(releaseInstantScrollFrame);
            releaseInstantScrollFrame = null;
        }
        if (releaseInstantScrollSecondFrame !== null) {
            cancelAnimationFrame(releaseInstantScrollSecondFrame);
            releaseInstantScrollSecondFrame = null;
        }
    }

    function enableInstantScrollRestore() {
        cancelInstantScrollRelease();
        instantScrollRestoreHadClass = document.documentElement.classList.contains('no-smooth-scroll');
        if (!instantScrollRestoreHadClass) {
            document.documentElement.classList.add('no-smooth-scroll');
        }
    }

    function releaseInstantScrollRestore() {
        cancelInstantScrollRelease();
        releaseInstantScrollFrame = requestAnimationFrame(() => {
            releaseInstantScrollFrame = null;
            releaseInstantScrollSecondFrame = requestAnimationFrame(() => {
                releaseInstantScrollSecondFrame = null;
                if (!instantScrollRestoreHadClass) {
                    document.documentElement.classList.remove('no-smooth-scroll');
                }
                instantScrollRestoreHadClass = false;
            });
        });
    }

    function blurActiveShellElement(targetRoot) {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && targetRoot?.contains(activeElement)) {
            activeElement.blur();
        }
    }

    function getDocumentViewerFocusableElements() {
        if (!documentViewerOverlay) return [];

        const focusableSelector = [
            'a[href]',
            'button:not([disabled])',
            'textarea:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        return Array.from(documentViewerOverlay.querySelectorAll(focusableSelector)).filter(element => {
            if (!(element instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
    }

    function restoreDocumentViewerBackground() {
        documentViewerBackgroundState.forEach(({ element, inert, inertAttribute, ariaHidden }) => {
            element.inert = inert;
            if (inertAttribute) {
                element.setAttribute('inert', '');
            } else {
                element.removeAttribute('inert');
            }
            if (ariaHidden === null) {
                element.removeAttribute('aria-hidden');
            } else {
                element.setAttribute('aria-hidden', ariaHidden);
            }
        });
        documentViewerBackgroundState = [];
    }

    function isolateDocumentViewerBackground(targetRoot) {
        restoreDocumentViewerBackground();
        documentViewerBackgroundState = Array.from(targetRoot.children)
            .filter(element => element !== documentViewerOverlay)
            .map(element => ({
                element,
                inert: element.inert,
                inertAttribute: element.hasAttribute('inert'),
                ariaHidden: element.getAttribute('aria-hidden')
            }));

        documentViewerBackgroundState.forEach(({ element }) => {
            element.inert = true;
            element.setAttribute('inert', '');
            element.setAttribute('aria-hidden', 'true');
        });
    }

    function handleDocumentViewerCloseClick() {
        closeDocumentViewer();
    }

    function handleDocumentViewerKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDocumentViewer();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusableElements = getDocumentViewerFocusableElements();
        if (!focusableElements.length) {
            event.preventDefault();
            documentViewerOverlay?.focus?.({ preventScroll: true });
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey && (activeElement === firstElement || activeElement === documentViewerOverlay)) {
            event.preventDefault();
            lastElement.focus({ preventScroll: true });
        } else if (!event.shiftKey && activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus({ preventScroll: true });
        } else if (!documentViewerOverlay?.contains(activeElement)) {
            event.preventDefault();
            firstElement.focus({ preventScroll: true });
        }
    }

    function closeDocumentViewer(options = {}) {
        if (!documentViewerOverlay) return;
        const shouldRestoreFocus = options.restoreFocus !== false;
        const focusReturnElement = documentViewerFocusReturnElement;
        documentViewerOverlay
            .querySelector('[data-deepening-document-viewer-close]')
            ?.removeEventListener('click', handleDocumentViewerCloseClick);
        documentViewerOverlay.removeEventListener('keydown', handleDocumentViewerKeydown);
        documentViewerOverlay.remove();
        documentViewerOverlay = null;
        documentViewer = null;
        restoreDocumentViewerBackground();
        documentViewerFocusReturnElement = null;

        if (shouldRestoreFocus && focusReturnElement?.isConnected) {
            focusReturnElement.focus({ preventScroll: true });
        }
    }

    function openDocumentViewer() {
        const targetRoot = getRoot();
        const documentModel = meditationDocument?.getCurrentDocument?.();
        if (!targetRoot || !documentModel || !window.MeditationDocumentViewer) return null;

        const focusReturnElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closeDocumentViewer({ restoreFocus: false });
        documentViewerFocusReturnElement = focusReturnElement;
        targetRoot.insertAdjacentHTML('beforeend', renderDocumentViewerOverlay());
        documentViewerOverlay = targetRoot.querySelector('[data-deepening-document-viewer-overlay]');
        const scrollRoot = documentViewerOverlay?.querySelector('[data-deepening-document-viewer-scroll]');
        documentViewer = window.MeditationDocumentViewer.create(scrollRoot);
        documentViewer.render(documentModel);
        isolateDocumentViewerBackground(targetRoot);
        documentViewerOverlay
            ?.querySelector('[data-deepening-document-viewer-close]')
            ?.addEventListener('click', handleDocumentViewerCloseClick);
        documentViewerOverlay?.addEventListener('keydown', handleDocumentViewerKeydown);
        documentViewerOverlay?.focus?.({ preventScroll: true });
        return documentViewerOverlay;
    }

    function restoreWindowPosition(positionRecord) {
        if (!positionRecord) return;
        window.scrollTo({
            left: positionRecord.scrollX,
            top: positionRecord.scrollY,
            behavior: 'auto'
        });
    }

    function unlockBackground({ restoreFocus = true } = {}) {
        if (!backgroundState) return;

        const positionRecord = {
            scrollX: backgroundState.scrollX,
            scrollY: backgroundState.scrollY
        };

        enableInstantScrollRestore();

        backgroundState.backgroundElements.forEach(({ element, inert, inertAttribute, ariaHidden }) => {
            element.inert = inert;
            if (inertAttribute) {
                element.setAttribute('inert', '');
            } else {
                element.removeAttribute('inert');
            }
            if (ariaHidden === null) {
                element.removeAttribute('aria-hidden');
            } else {
                element.setAttribute('aria-hidden', ariaHidden);
            }
        });

        restoreStyle(document.documentElement, backgroundState.htmlStyle);
        restoreStyle(document.body, backgroundState.bodyStyle);
        document.documentElement.classList.remove('deepening-shell-active');
        document.body.classList.remove('deepening-shell-active');
        restoreWindowPosition(positionRecord);

        if (restoreFocus && backgroundState.activeElement?.isConnected) {
            backgroundState.activeElement.focus({ preventScroll: true });
        }

        backgroundState = null;
        releaseInstantScrollRestore();
    }

    async function unmount(options = {}) {
        const targetRoot = getRoot();
        if (!targetRoot) return;

        try {
            await options.onAutoSave?.();
        } finally {
            blurActiveShellElement(targetRoot);
            await nextFrame();
            keyboardManager?.destroy();
            keyboardManager = null;
            meditationActionsPanel?.destroy();
            meditationActionsPanel = null;
            closeDocumentViewer();
            meditationDocument?.destroy();
            meditationDocument = null;
            readingDocument?.destroy();
            readingDocument = null;

            targetRoot.innerHTML = '';
            targetRoot.hidden = true;
            targetRoot.style.removeProperty('--deepening-shell-height');

            if (options.restore !== false) {
                await options.onRestore?.(restorePositionRecord);
            }

            unlockBackground({ restoreFocus: options.restore !== false });
            restorePositionRecord = null;
        }
    }

    function mount(options = {}) {
        const targetRoot = getRoot();
        if (!targetRoot) return null;

        keyboardManager?.destroy();
        meditationActionsPanel?.destroy();
        meditationDocument?.destroy();
        readingDocument?.destroy();

        restorePositionRecord = window.ReadingPositionManager?.createPositionRecord(options) || null;
        targetRoot.hidden = false;
        targetRoot.style.setProperty('--deepening-shell-height', `${getStableViewportHeight()}px`);
        targetRoot.innerHTML = renderShell();
        lockBackground({ root: targetRoot });

        const readingHost = targetRoot.querySelector('[data-deepening-reading-host]');
        const meditationHost = targetRoot.querySelector('[data-deepening-meditation-host]');

        readingDocument = window.ReadingDocument?.create({
            reading: options.reading,
            readingHtml: options.readingHtml,
            versions: options.versions,
            currentVersion: options.currentVersion,
            versionSelectorHtml: options.versionSelectorHtml,
            getReadingHtml: options.getReadingHtml,
            onVersionChange: versionId => {
                meditationDocument?.setDocumentMetadata?.({ version: versionId });
                options.onVersionChange?.(versionId);
            },
            onVoiceToggle: options.onVoiceToggle,
            onVoiceStop: options.onVoiceStop,
            getVoiceState: options.getVoiceState
        });

        meditationDocument = window.MeditationDocument?.create({
            meditationHtml: options.meditationHtml,
            initialNote: options.initialNote,
            initialUIState: options.initialUIState,
            documentMetadata: {
                date: options.reading?.date || '',
                reference: options.reading?.reference || '',
                version: options.currentVersion || ''
            },
            onAutoSave: options.onAutoSave,
            onClose: () => {
                unmount({
                    restore: true,
                    onAutoSave: options.onAutoSave,
                    onRestore: options.onRestore
                });
            }
        });

        const readingRoot = readingDocument?.mount(readingHost);
        const meditationRoot = meditationDocument?.mount(meditationHost);

        keyboardManager = window.KeyboardManager?.create();
        keyboardManager?.init(meditationRoot);

        meditationActionsPanel = window.MeditationActionsPanel?.create(targetRoot, {
            onView: () => {
                openDocumentViewer();
            },
            onSave: () => {},
            onShare: () => {}
        });

        targetRoot.querySelector('.deepening-shell')?.focus({ preventScroll: true });

        return {
            root: targetRoot,
            readingDocument,
            meditationDocument,
            meditationActionsPanel,
            openDocumentViewer,
            closeDocumentViewer,
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
        openDocumentViewer,
        closeDocumentViewer,
        isMounted: () => Boolean(readingDocument || meditationDocument),
        getReadingDocument: () => readingDocument,
        getMeditationDocument: () => meditationDocument
    };

    window.suVozOpenNewDeepeningMode = function() {
        return mount({
            reading: {
                date: '2026-07-26',
                reference: 'Salmo 23:1-4',
                html: '<p>El Señor es mi pastor; nada me faltara.</p><p>En lugares de delicados pastos me hara descansar.</p><p>Confortara mi alma; me guiara por sendas de justicia por amor de su nombre.</p><p>Aunque ande en valle de sombra de muerte, no temere mal alguno, porque tu estaras conmigo.</p>'
            },
            versions: [
                { id: 'rvr60', label: 'RVR60' },
                { id: 'ntv', label: 'NTV' },
                { id: 'tla', label: 'TLA' }
            ],
            currentVersion: 'rvr60',
            voiceControlHtml: '<span class="deepening-dev-chip deepening-dev-chip-muted">Lectura pausada</span>'
        });
    };

    window.suVozOpenMeditationDocumentViewer = function() {
        return openDocumentViewer();
    };
})();
