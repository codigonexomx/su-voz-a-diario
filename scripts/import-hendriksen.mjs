import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { validatePackage, lookupVerse } from '../js/bible/commentaryLookup.js';

// Import only the supplied, corrected edition. The immutable OCR and correction
// ledger remain in the external editorial project, outside the web distribution.
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Uso: node scripts/import-hendriksen.mjs /ruta/al/paquete-corregido.json');
const source = await readFile(resolve(sourcePath));
const pkg = validatePackage(JSON.parse(source));
if (pkg.work.id !== 'hendriksen-mas-que-vencedores-es-2005' || pkg.book.id !== 'rev') throw new Error('Obra inesperada.');
for (let chapter = 1; chapter <= 22; chapter++) {
    for (let verse = 1; verse <= pkg.book.chapterVerseCounts[chapter - 1]; verse++) {
        if (lookupVerse(pkg, { bookId: 'rev', chapter, verse }).length !== 1) throw new Error(`Cobertura inválida ${chapter}:${verse}`);
    }
}
const runtime = {
    schemaVersion: pkg.schemaVersion, work: pkg.work, book: pkg.book,
    preferredBibleVersion: pkg.preferredBibleVersion, compatibleBibleVersions: pkg.compatibleBibleVersions,
    source: { pdfSha256: pkg.source.pdfSha256, pdfPageCount: pkg.source.pdfPageCount,
        editorialPackageSha256: createHash('sha256').update(source).digest('hex') },
    readingOrder: pkg.readingOrder, chapterIds: pkg.chapterIds,
    entries: pkg.entries.map(({ id, kind, title, titleAsIndexed, authorPath, authorChapter, parentId, order, depth,
        mappingStatus, mappingBasis, ranges, text, textSha256, sourceSpans, sourcePages, notesGroupId, assetIds, review }) =>
        ({ id, kind, title, titleAsIndexed, authorPath, authorChapter, parentId, order, depth, mappingStatus,
            mappingBasis, ranges, text, textSha256, sourceSpans, sourcePages, notesGroupId, assetIds, review })),
    notes: pkg.notes, noteGroups: pkg.noteGroups.map(({ sourceText, ...group }) => group),
    frontMatter: pkg.frontMatter.map(page => ({ ...page,
        visualSupplements: (page.visualSupplements || []).map(({ evidence, ...supplement }) => supplement)
    })), indexes: pkg.indexes,
    assets: pkg.assets, quality: pkg.quality
};
validatePackage(runtime);
if (/\/(?:Users|Volumes)\//.test(JSON.stringify(runtime))) {
    throw new Error('El paquete público contiene una ruta local de auditoría. Retírala de los metadatos antes de exportar.');
}
const output = new URL('../data/commentaries/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('hendriksen-apocalipsis.json', output), JSON.stringify(runtime) + '\n');
await writeFile(new URL('NOTICE.txt', output), [
    pkg.work.title, pkg.work.author, `${pkg.work.publisher} ©${pkg.work.copyrightYear}`,
    `Traducción: ${pkg.work.translator}.`, pkg.work.copyrightNotice,
    'Edición digital a partir del PDF aportado por el propietario de Su Voz a Diario.',
    'La atribución conserva los créditos de la fuente; no declara la obra de dominio público.',
    'El texto bíblico y las reflexiones del lector se presentan por separado del comentario.',
    ''
].join('\n'));
console.log(JSON.stringify({ entries: runtime.entries.length, notes: runtime.notes.length, verses: 404,
    bytes: Buffer.byteLength(JSON.stringify(runtime)), editorialPackageSha256: runtime.source.editorialPackageSha256 }));
