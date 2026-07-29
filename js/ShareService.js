/**
 * ShareService
 * Guarda y comparte PDFs usando Capacitor cuando esta disponible.
 */
(function() {
    function getPlugin(name) {
        return window.Capacitor?.Plugins?.[name] || null;
    }

    function isNativePlatform() {
        return Boolean(window.Capacitor?.isNativePlatform?.());
    }

    function isUserCancellation(error) {
        const name = String(error?.name || '').toLowerCase();
        const message = String(error?.message || error || '').toLowerCase();

        const notAllowedUserCancellation = name === 'notallowederror' &&
            (message.includes('cancel') ||
                message.includes('user') ||
                message.includes('dismiss') ||
                message.includes('abort'));

        return name === 'aborterror' ||
            notAllowedUserCancellation ||
            message.includes('abort') ||
            message.includes('cancelled') ||
            message.includes('canceled') ||
            message.includes('cancelado') ||
            message.includes('user cancelled') ||
            message.includes('user canceled') ||
            message.includes('share canceled') ||
            message.includes('share cancelled');
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                resolve(result.includes(',') ? result.split(',')[1] : result);
            };
            reader.onerror = () => reject(reader.error || new Error('No se pudo leer el PDF'));
            reader.readAsDataURL(blob);
        });
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function writeNativeFile(blob, fileName, directory = 'CACHE') {
        const Filesystem = getPlugin('Filesystem');
        if (!Filesystem?.writeFile || !Filesystem?.getUri) {
            throw new Error('Filesystem nativo no disponible');
        }

        const path = `meditations/${Date.now()}-${fileName}`;
        const data = await blobToBase64(blob);

        await Filesystem.writeFile({
            path,
            data,
            directory,
            recursive: true
        });

        const { uri } = await Filesystem.getUri({
            path,
            directory
        });

        if (!uri) {
            throw new Error('No se obtuvo la ruta del PDF');
        }

        return {
            uri,
            path,
            directory
        };
    }

    async function savePdf(blob, fileName) {
        if (isNativePlatform()) {
            return writeNativeFile(blob, fileName, 'DOCUMENTS');
        }

        downloadBlob(blob, fileName);
        return {
            fileName,
            webDownload: true
        };
    }

    async function sharePdf(blob, fileName, options = {}) {
        const Share = getPlugin('Share');
        const Filesystem = getPlugin('Filesystem');

        if (isNativePlatform() && Share?.share && Filesystem?.writeFile && Filesystem?.getUri) {
            try {
                const file = await writeNativeFile(blob, fileName, 'CACHE');
                await Share.share({
                    title: options.title || 'Su Voz Hoy',
                    text: options.text || 'Mi meditacion de Su Voz a Diario',
                    files: [file.uri],
                    dialogTitle: options.dialogTitle || 'Compartir meditacion'
                });
            } catch (error) {
                if (isUserCancellation(error)) {
                    return {
                        shared: false,
                        canceled: true,
                        native: true
                    };
                }
                throw error;
            }

            return {
                shared: true,
                native: true
            };
        }

        const webFile = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.share && navigator.canShare?.({ files: [webFile] })) {
            try {
                await navigator.share({
                    title: options.title || 'Su Voz Hoy',
                    text: options.text || 'Mi meditacion de Su Voz a Diario',
                    files: [webFile]
                });
            } catch (error) {
                if (isUserCancellation(error)) {
                    return {
                        shared: false,
                        canceled: true,
                        native: false
                    };
                }
                throw error;
            }
            return {
                shared: true,
                native: false
            };
        }

        downloadBlob(blob, fileName);
        return {
            shared: false,
            downloaded: true
        };
    }

    window.ShareService = {
        savePdf,
        sharePdf,
        isUserCancellation
    };
})();
