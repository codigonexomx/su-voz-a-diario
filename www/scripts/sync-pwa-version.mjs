import { readFileSync, writeFileSync } from 'node:fs';
import { APP_VERSION } from './version.mjs';

const versionPattern = /^\d+$/;

if (!versionPattern.test(APP_VERSION)) {
    throw new Error('APP_VERSION debe ser un número sin prefijo.');
}

const files = {
    index: ['index.html', 'www/index.html'],
    serviceWorker: ['sw.js', 'www/sw.js']
};

const localVersionedAssetPattern =
    /((?:href|src)=["'](?:\.\/)?(?:manifest\.json|css\/[^"'?]+|js\/[^"'?]+))(?:\?v=\d+)?(["'])/g;

const serviceWorkerAssetPattern =
    /((?:'|")(?:\.\/)?(?:manifest\.json|css\/[^'"]+|js\/[^'"]+))\?v=\d+((?:'|"))/g;

const writeIfChanged = (filePath, content) => {
    const previous = readFileSync(filePath, 'utf8');

    if (previous !== content) {
        writeFileSync(filePath, content);
    }
};

const syncIndex = filePath => {
    const source = readFileSync(filePath, 'utf8');
    let updated = source
        .replace(localVersionedAssetPattern, `$1?v=${APP_VERSION}$2`)
        .replace(
            /const appVersion = ['"][^'"]+['"];/,
            `const appVersion = '${APP_VERSION}';`
        )
        .replace(
            /navigator\.serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/,
            `navigator.serviceWorker.register('./sw.js?v=${APP_VERSION}'`
        );

    writeIfChanged(filePath, updated);
};

const syncServiceWorker = filePath => {
    const source = readFileSync(filePath, 'utf8');
    let updated = source
        .replace(
            /const APP_VERSION = ['"][^'"]+['"];/,
            `const APP_VERSION = '${APP_VERSION}';`
        )
        .replace(serviceWorkerAssetPattern, `$1?v=${APP_VERSION}$2`);

    writeIfChanged(filePath, updated);
};

files.index.forEach(syncIndex);
files.serviceWorker.forEach(syncServiceWorker);

console.log(`PWA version sincronizada: ${APP_VERSION}`);
