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
            document.documentElement.classList.remove('deepening-shell-active');

            if (options.restore !== false) {
                await options.onRestore?.(restorePositionRecord);
                window.ReadingPositionManager?.restoreFocus(restorePositionRecord);
                window.ReadingPositionManager?.restoreWindowScroll(restorePositionRecord);
            }

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
        targetRoot.innerHTML = renderShell();
        document.documentElement.classList.add('deepening-shell-active');

        const readingHost = targetRoot.querySelector('[data-deepening-reading-host]');
        const meditationHost = targetRoot.querySelector('[data-deepening-meditation-host]');

        readingDocument = window.ReadingDocument?.create({
            reading: options.reading,
            readingHtml: options.readingHtml,
            versions: options.versions,
            currentVersion: options.currentVersion,
            versionSelectorHtml: options.versionSelectorHtml,
            voiceControlHtml: options.voiceControlHtml,
            getReadingHtml: options.getReadingHtml,
            onVersionChange: options.onVersionChange,
            onListen: options.onListen
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
