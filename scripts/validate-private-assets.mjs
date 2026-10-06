import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { renderIntroVideoHtml } from '../js/utils/formatters.js';

const { parseStringPromise } = createRequire(import.meta.url)('xml2js');
const avatars = vm.createContext({ window: {}, btoa, unescape, encodeURIComponent });
vm.runInContext(readFileSync('js/avatarGenerator.js', 'utf8'), avatars);
const legacyName = 'QA" onmouseover="alert(1) < &';
const icon = '<script>alert(1)</script>';
const avatar = await parseStringPromise(avatars.window.AvatarGenerator.renderHtml('qa', legacyName, {
    avatarIcon: icon, avatarColor: '#ffffff" onload="alert(1)', isActive: true
}));
assert.equal(avatar.div.$.title, legacyName);
assert.deepEqual(Object.keys(avatar.div.$).sort(), ['class', 'data-action', 'style', 'title']);
const uri = avatar.div.$.style.match(/url\('([^']+)'\)/)[1];
const svg = await parseStringPromise(Buffer.from(uri.split(',')[1], 'base64').toString('utf8'));
assert.equal(svg.svg.text[0]._, avatars.window.AvatarPicker.resolveAvatar(icon).icon);
assert(!svg.svg.script);
assert.deepEqual(Object.keys(svg.svg.circle[0].$).sort(), ['cx', 'cy', 'fill', 'r']);
const normal = await parseStringPromise(Buffer.from(avatars.window.AvatarGenerator.generate('qa', 'Ricardo', {
    avatarIcon: 'cross', colorId: 'blue-01'
}).split(',')[1], 'base64').toString('utf8'));
assert.equal(normal.svg.circle[0].$.fill, avatars.window.AvatarPicker.resolveColor('blue-01').value);
assert.equal(normal.svg.text[0]._, avatars.window.AvatarPicker.resolveAvatar('cross').icon);
const rawIcon = await parseStringPromise(Buffer.from(avatars.createIconSVG(['#ffffff'], 'circles', icon, 1, '#abcdef').split(',')[1], 'base64').toString('utf8'));
assert.equal(rawIcon.svg.text[0]._, icon);
assert(!rawIcon.svg.script);
assert.equal(rawIcon.svg.circle[0].$.fill, '#abcdef');

const manifest = JSON.parse(readFileSync('assets/fonts/sources.json', 'utf8'));
assert.equal(manifest.assets.length, 17);
const index = readFileSync('index.html', 'utf8');
assert(!/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/.test(index));
assert(index.includes('./css/fonts-local.css'));
assert(index.includes('./js/vendor/jspdf-4.2.1.umd.min.js'));
const sw = readFileSync('sw.js', 'utf8');
const assets = vm.runInNewContext(sw.slice(0, sw.indexOf('// Firebase compat')) + '; ({cached: STATIC_ASSETS, required: Array.from(REQUIRED_ASSETS)})');
for (const item of manifest.assets) {
    const bytes = readFileSync(item.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
    assert.equal(bytes.length, item.bytes);
    if (item.path.endsWith('.ttf') || item.path.endsWith('.js')) {
        for (const list of Object.values(assets)) assert(list.includes('./' + item.path), `Offline: ${item.path}`);
    }
}
const fonts = readFileSync('css/fonts-local.css', 'utf8');
assert.equal((fonts.match(/@font-face/g) || []).length, 12);
assert(!/https?:/.test(fonts));
for (const [, url] of fonts.matchAll(/url\(([^)]+)\)/g)) assert(readFileSync(new URL('../css/' + url, import.meta.url)).length > 0);

globalThis.document = { createElement: () => ({ textContent: '', get innerHTML() {
    return String(this.textContent).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
} }) };
const safeVideo = renderIntroVideoHtml({ url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', title: '<img src=x onerror=alert(1)>', label: '"label"', note: '<script>x</script>' });
assert(!/<iframe|<img|<script/.test(safeVideo));
assert(safeVideo.includes('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
assert(safeVideo.includes('referrerpolicy="no-referrer"'));
assert.equal(renderIntroVideoHtml({ url: 'https://evil.example/embed/dQw4w9WgXcQ' }), '');
assert.equal(renderIntroVideoHtml({ url: 'javascript:alert(1)' }), '');
assert.equal(renderIntroVideoHtml({ url: 'https://www.youtube.com/embed/invalid' }), '');
delete globalThis.document;

const context = vm.createContext({ console, Blob, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer,
    atob, btoa, navigator: { userAgent: 'local-validation' },
    fetch: async () => ({ ok: false }) });
context.window = context; context.self = context;
for (const path of ['js/vendor/jspdf-4.2.1.umd.min.js', 'js/PdfDocumentBuilder.js', 'js/PdfExporter.js']) vm.runInContext(readFileSync(path, 'utf8'), context, { filename: path });
const result = await context.PdfExporter.export({
    metadata: { reference: 'Validacion local', date: '2026-10-04', version: 'QA' },
    sections: { dios: 'Texto ficticio de prueba. '.repeat(300), aprendizaje: 'Sin datos personales.', respuesta: 'Prueba de paginacion.', oracion: 'Contenido sintetico.' }
});
const pdf = Buffer.from(await result.blob.arrayBuffer());
assert.equal(result.mimeType, 'application/pdf');
assert(pdf.subarray(0, 8).toString().startsWith('%PDF-1.'));
assert(pdf.includes(Buffer.from('/Type /Pages')));
assert(pdf.length > 5000);
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync('artifacts/validation/pdf-local-assets-qa.pdf', pdf);
console.log('OK: 17 pinned assets/licenses, twelve offline fonts, no font/CDN preconnections, opt-in safe YouTube link and real multi-page PDF export with jsPDF 4.2.1');
