import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cssSource = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&display=swap';
const manifest = [];
async function download(url, path) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(`${root}${path}`, bytes);
    manifest.push({ path, source: url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    return bytes;
}
await mkdir(`${root}assets/fonts`, { recursive: true });
await mkdir(`${root}js/vendor`, { recursive: true });
const cssResponse = await fetch(cssSource, { signal: AbortSignal.timeout(60000) });
if (!cssResponse.ok) throw new Error(`Font stylesheet unavailable: ${cssResponse.status}`);
const css = await cssResponse.text();
const blocks = css.match(/@font-face\s*\{[^}]+\}/g);
if (blocks?.length !== 12) throw new Error('Expected exactly the twelve existing font styles');
const localBlocks = [];
for (const block of blocks) {
    const family = /font-family:\s*'([^']+)'/.exec(block)?.[1];
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
    const style = /font-style:\s*(\w+)/.exec(block)?.[1];
    const url = /src:\s*url\((https:[^)]+)\)/.exec(block)?.[1];
    if (!['Inter', 'Cormorant Garamond', 'Merriweather'].includes(family)
        || !['300', '400', '500', '600', '700'].includes(weight)
        || !['normal', 'italic'].includes(style) || new URL(url).origin !== 'https://fonts.gstatic.com') {
        throw new Error('Unexpected font metadata or host');
    }
    const filename = `${family.toLowerCase().replaceAll(' ', '-')}-${style}-${weight}.ttf`;
    const bytes = await download(url, `assets/fonts/${filename}`);
    if (bytes.readUInt32BE(0) !== 0x00010000) throw new Error('Invalid TrueType asset');
    localBlocks.push(block.replace(url, `../assets/fonts/${filename}`));
}
await writeFile(`${root}css/fonts-local.css`, `${localBlocks.join('\n')}\n`);
for (const family of ['inter', 'cormorantgaramond', 'merriweather']) {
    await download(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`, `assets/fonts/${family}-OFL.txt`);
}
await download('https://raw.githubusercontent.com/parallax/jsPDF/v4.2.1/dist/jspdf.umd.min.js', 'js/vendor/jspdf-4.2.1.umd.min.js');
await download('https://raw.githubusercontent.com/parallax/jsPDF/v4.2.1/LICENSE', 'js/vendor/jspdf-LICENSE.txt');
await writeFile(`${root}assets/fonts/sources.json`, JSON.stringify({ downloadedAt: new Date().toISOString(), cssSource, assets: manifest }, null, 2));
console.log(`Vendored ${manifest.length} official assets with license files and SHA-256 provenance.`);
