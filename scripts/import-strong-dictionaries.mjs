// Offline import: node scripts/import-strong-dictionaries.mjs /path/to/Strong/Fuentes
// All source bytes are pinned. Source JavaScript is parsed as JSON, never executed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parse } from 'node-html-parser';

const sourceDirectory = process.argv[2];
assert(sourceDirectory, 'Indica la carpeta de fuentes Strong descargadas.');
const root = new URL('../', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const modulePath = path.join(sourceDirectory, 'StrongEsp.dct.mybible');
const moduleBytes = fs.readFileSync(modulePath);
assert.equal(digest(moduleBytes), 'd39d4fed729656f9b20fce727d6a8746921050c03d22a3dd2366f84d79a21d2f', 'El módulo español debe coincidir con la fuente auditada.');
const python = process.env.PYTHON_BINARY || (process.platform === 'darwin' && fs.existsSync('/Library/Developer/CommandLineTools/usr/bin/python3')
    ? '/Library/Developer/CommandLineTools/usr/bin/python3' : 'python3');
const query = spawnSync(python, ['-c', `import sqlite3, json, sys
from pathlib import Path
connection = sqlite3.connect(Path(sys.argv[1]).resolve().as_uri() + '?mode=ro&immutable=1', uri=True)
connection.row_factory = sqlite3.Row
print(json.dumps({'details': dict(connection.execute('SELECT * FROM details').fetchone()), 'entries': [dict(row) for row in connection.execute('SELECT word,data FROM dictionary')]}, ensure_ascii=False))`, modulePath], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
if (query.status !== 0) throw new Error(`No se pudo leer el módulo SQLite: ${query.stderr || query.error}`);
const moduleData = JSON.parse(query.stdout);
assert.equal(moduleData.entries.length, 14198);
const definitions = new Map(moduleData.entries.map(row => [row.word, row.data]));
assert.equal(definitions.size, moduleData.entries.length, 'No se descartan IDs duplicados.');
const plainText = html => parse(String(html).replace(/<\/?p\b[^>]*>/gi, '\n').replace(/<br\s*\/?\s*>/gi, '\n')).textContent
    .replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const lemmaSources = [
    { language: 'hebrew', variable: 'strongsHebrewDictionary', count: 8674,
      sha256: '5ce6aeed551c709f49bcfa341cadf2f34bc7599b85d9de9e6ac2ecbf60fc3739', blob: 'b5b7cd2799981b0bcf96a93541236187b2c85fcf' },
    { language: 'greek', variable: 'strongsGreekDictionary', count: 5523,
      sha256: '7624ee738ae47e80f1a352223e28a26d011c9cd4898822cee52f47a010c04efd', blob: '0bebdeeec31f93b42ec591909da3f18626a684a8' }
];
const allLemmas = new Map();
for (const source of lemmaSources) {
    source.file = `openscriptures/strongs-${source.language}-dictionary.js`;
    const bytes = fs.readFileSync(path.join(sourceDirectory, source.file));
    assert.equal(digest(bytes), source.sha256, `Fuente de lemas alterada: ${source.file}`);
    const raw = bytes.toString('utf8');
    const declaration = `var ${source.variable} = `;
    const start = raw.indexOf(declaration);
    assert(start > 0);
    const jsonStart = raw.indexOf('{', start);
    const jsonEnd = raw.lastIndexOf('}');
    const data = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    assert.equal(Object.keys(data).length, source.count);
    source.notice = raw.slice(0, start).trim();
    for (const [id, entry] of Object.entries(data)) {
        assert(/^[HG][1-9]\d{0,3}$/.test(id));
        assert(entry.lemma && !allLemmas.has(id));
        allLemmas.set(id, { ...entry, language: source.language });
    }
}
const dictionaries = { hebrew: {}, greek: {} };
const missingRelated = new Set();
const counts = { hebrew: 0, aramaic: 0, greek: 0 };
for (const id of [...allLemmas.keys()].sort((a, b) => a[0].localeCompare(b[0]) || Number(a.slice(1)) - Number(b.slice(1)))) {
    const original = allLemmas.get(id);
    const html = definitions.get(id);
    assert(html, `Falta la definición española de ${id}`);
    const header = html.match(/^<font color="(?:darkgreen|darkblue)"><b>([\s\S]*?)<\/b><\/font>([\s\S]*?)<P><font color="indigo">([\s\S]*?)<\/font><P>/i);
    assert(header, `Encabezado no reconocido: ${id}`);
    const definitionHtml = html.slice(header[0].length);
    const definition = [plainText(header[2]), plainText(definitionHtml)].filter(Boolean).join("\n");
    const transliteration = plainText(header[3]);
    assert(definition && transliteration, `Entrada vacía: ${id}`);
    assert(!/[\uFFFD<>]/.test(definition + transliteration + original.lemma), `Texto o HTML inválido: ${id}`);
    const related = [];
    for (const link of parse(definitionHtml).querySelectorAll('a')) {
        if (/^#b\d+\.\d+\.\d+(?:-\d+)?$/.test(link.getAttribute('href') || '')) continue; // Bible citations remain plain source text.
        const referencedId = link.getAttribute('href')?.match(/^#[ds]([HG][1-9]\d{0,5})$/)?.[1];
        assert(referencedId, `Referencia no reconocida: ${id}: ${link.getAttribute('href')}`);
        if (!allLemmas.has(referencedId)) { missingRelated.add(referencedId); continue; }
        if (referencedId !== id && !related.includes(referencedId)) related.push(referencedId);
    }
    const language = original.language === 'hebrew' && /^\(caldeo\)/i.test(definition) ? 'aramaic' : original.language;
    counts[language]++;
    dictionaries[original.language][id] = {
        id, lemma: original.lemma.normalize('NFC'), transliteration,
        pronunciation: '', language, definition, ...(related.length ? { related } : {})
    };
}
assert.equal(Object.keys(dictionaries.hebrew).length, 8674);
assert.equal(Object.keys(dictionaries.greek).length, 5523);
const editorialNotes = moduleData.entries.filter(row => !allLemmas.has(row.word));
assert.deepEqual(editorialNotes.map(row => row.word), ['G2717']);
const outputDirectory = new URL('data/strong/', root);
fs.mkdirSync(outputDirectory, { recursive: true });
const outputFiles = {};
for (const [language, entries] of Object.entries(dictionaries)) {
    const bytes = Buffer.from(JSON.stringify(entries) + '\n');
    fs.writeFileSync(new URL(`${language}.json`, outputDirectory), bytes);
    outputFiles[language] = { file: `${language}.json`, entries: Object.keys(entries).length, bytes: bytes.length, sha256: digest(bytes) };
}
const manifest = {
    schemaVersion: 1,
    scope: 'Preparación local por instrucción del propietario. Los avisos se conservan; la disponibilidad de una descarga no se presenta como licencia abierta de las definiciones españolas.',
    definitionSource: {
        name: moduleData.details.title, file: 'StrongEsp.dct.mybible',
        url: 'https://www.mediafire.com/download/xgqux32ye221wx9/StrongEsp.dct.mybible',
        catalogueUrl: 'https://sites.google.com/view/iglesiadecristodaule/inicio/módulos-para-my-sword',
        sha256: digest(moduleBytes), bytes: moduleBytes.length,
        rights: '© 2002 Editorial Caribe Inc. Una división de Thomas Nelson. El módulo indica: «Solo para uso personal. Prohibida su venta.» No declara una licencia abierta.',
        metadata: { ...moduleData.details, comments: plainText(moduleData.details.comments.replace(/\\n/g, '\n').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')) }
    },
    lemmaSource: {
        name: 'Open Scriptures Strong’s Hebrew and Greek Dictionaries', repository: 'openscriptures/strongs',
        commit: '0acd2f251c2d35ff8db2dece4e0593979d3ac223', url: 'https://github.com/openscriptures/strongs',
        noticeUrls: [
            'https://github.com/openscriptures/strongs/blob/0acd2f251c2d35ff8db2dece4e0593979d3ac223/hebrew/strongs-hebrew-dictionary.js',
            'https://github.com/openscriptures/strongs/blob/0acd2f251c2d35ff8db2dece4e0593979d3ac223/greek/strongs-greek-dictionary.js'
        ],
        license: 'CC-BY-SA, según los avisos de los archivos originales; la versión no se indica en esos avisos.',
        attribution: 'JSON Hebrew © 2010 Open Scriptures; JSON Greek © 2009 Open Scriptures. Hebreo: David Instone-Brewer y David Troidl. Griego: Ulrik Petersen.',
        files: lemmaSources
    },
    uiCredits: {
        short: 'Definiciones: Diccionario Strong en Español, Editorial Caribe (2002). Lemas: Open Scriptures.',
        definitions: 'Diccionario Strong de palabras originales del Antiguo y Nuevo Testamento, de James Strong. © 2002 Editorial Caribe Inc., una división de Thomas Nelson. Módulo StrongEsp compilado por Equipo Internacional e-Sword / Biblioteca Hispana; revisión declarada del 17 de julio de 2012.',
        lemmas: 'Lemas hebreos y griegos: Open Scriptures, JSON © 2010 y © 2009, respectivamente. Licencia indicada por sus archivos: CC BY-SA; no especifican versión. Datos hebreos preparados por David Instone-Brewer y David Troidl; datos griegos preparados por Ulrik Petersen.',
        changes: 'Adaptación de formato para consulta por número Strong: se retiró HTML, se decodificaron entidades y se conservaron las definiciones españolas. Los lemas vocalizados se consultan por el mismo identificador en Open Scriptures.'
    },
    normalization: [
        'Cada definición y transliteración española procede de su entrada StrongEsp por ID, sin traducciones generadas.',
        'Los lemas vocalizados se toman de Open Scriptures por el mismo ID; no se usan los lemas sin vocales del módulo español.',
        'HTML y estilos retirados; entidades decodificadas. Texto de etimología, variantes y traducciones españolas conservado íntegro.',
        'Arameo sólo cuando la definición hebrea comienza con la indicación explícita (caldeo).',
        'No se inventa una pronunciación fonética: la fuente española suministra transliteración; pronunciation se deja vacío.',
        'G2717 se conserva como nota editorial, no como palabra. G3203–G3302 no tienen entradas en la numeración histórica.'
    ],
    counts, files: outputFiles,
    unresolvedRelatedIds: [...missingRelated].sort(),
    editorialNotes: editorialNotes.map(row => ({ id: row.word, text: plainText(row.data) }))
};
fs.writeFileSync(new URL('lexicon-source.json', outputDirectory), JSON.stringify(manifest, null, 2) + '\n');
const notices = [
    'DICCIONARIOS STRONG — FUENTES Y AVISOS',
    manifest.uiCredits.definitions, manifest.definitionSource.rights,
    manifest.definitionSource.url,
    manifest.uiCredits.lemmas, ...manifest.lemmaSource.noticeUrls,
    manifest.uiCredits.changes,
    'La licencia de los lemas no se atribuye a las definiciones españolas ni al texto de la Biblia.',
    ...manifest.lemmaSource.files.map(source => source.notice)
].join('\n\n').replace(/[ \t]+$/gm, '') + '\n';
fs.writeFileSync(new URL('NOTICE.txt', outputDirectory), notices);
console.log(JSON.stringify({ counts, files: outputFiles, unresolvedRelatedIds: manifest.unresolvedRelatedIds }));
