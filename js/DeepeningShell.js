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
    let backgroundState = null;

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

    function unlockBackground({ restoreFocus = true } = {}) {
        if (!backgroundState) return;

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
        window.scrollTo(backgroundState.scrollX, backgroundState.scrollY);

        if (restoreFocus && backgroundState.activeElement?.isConnected) {
            backgroundState.activeElement.focus({ preventScroll: true });
        }

        backgroundState = null;
    }

    async function unmount(options = {}) {
        const targetRoot = getRoot();
        if (!targetRoot) return;

        try {
            await options.onAutoSave?.();
        } finally {
            keyboardManager?.destroy();
            keyboardManager = null;
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
            onVersionChange: options.onVersionChange,
            onVoiceToggle: options.onVoiceToggle,
            onVoiceStop: options.onVoiceStop,
            getVoiceState: options.getVoiceState
        });

        meditationDocument = window.MeditationDocument?.create({
            meditationHtml: options.meditationHtml,
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

        targetRoot.querySelector('.deepening-shell')?.focus({ preventScroll: true });

        return {
            root: targetRoot,
            readingDocument,
            meditationDocument,
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
})();
