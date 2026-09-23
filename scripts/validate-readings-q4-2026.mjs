import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolveExternalDeepLink } from '../js/services/DeepLinkService.js';
import { APP_VERSION } from './version.mjs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const approved = json('docs/preguntas-aprobadas-octubre-diciembre-2026.json');
const proposed = json('docs/preguntas-propuestas-hageo-2026.json');
const questions = [...approved, ...proposed].sort((a, b) => a.date.localeCompare(b.date));
const sources = json('docs/fuentes-lecturas-octubre-diciembre-2026.json');
const versions = ['rvr60', 'ntv', 'tla'];
const bookIds = { '1 Samuel': '1sa', '2 Pedro': '2pe', Oseas: 'hos', Apocalipsis: 'rev', Hageo: 'hag', 'Malaquías': 'mal' };
const hash = text => createHash('sha256').update(text).digest('hex');
const sourceByDate = new Map(sources.readings.map(reading => [reading.date, reading]));
assert.equal(new Set(questions.map(reading => reading.date)).size, questions.length, 'Preguntas duplicadas.');
assert.deepEqual(questions.map(reading => reading.date), sources.readings.map(reading => reading.date));
assert.deepEqual(proposed.map(reading => reading.date), sources.proposedQuestionDates);

for (const root of ['', 'www/']) {
    const aggregate = json(`${root}data/readings.json`);
    const index = json(`${root}data/readings/index.json`);
    const dates = aggregate.map(reading => reading.date);
    assert.equal(new Set(dates).size, dates.length, `${root}Fechas duplicadas.`);
    assert.deepEqual(dates, [...dates].sort(), `${root}Fechas desordenadas.`);
    assert.deepEqual(index.map(reading => reading.date), dates, `${root}Índice incompleto.`);
    const sw = readFileSync(`${root}sw.js`, 'utf8');
    assert.ok(sw.includes(`const APP_VERSION = '${APP_VERSION}'`));

    for (const month of ['2026-10', '2026-11', '2026-12']) {
        const path = `data/readings/${month}.json`;
        const monthly = json(`${root}${path}`);
        assert.deepEqual(monthly, aggregate.filter(reading => reading.date.startsWith(month)), `${root}${month}: respaldo distinto.`);
        assert.ok(sw.includes(`'./${path}'`), `${root}${month}: falta en precaché.`);
        if (root) assert.equal(readFileSync(`${root}${path}`, 'utf8'), readFileSync(path, 'utf8'));
    }

    for (const question of questions) {
        const { date, reference, dailyQuestion } = question;
        const reading = aggregate.find(item => item.date === date);
        const metadata = index.find(item => item.date === date);
        assert.ok(reading && metadata, `${date}: falta lectura o índice.`);
        assert.equal(reading.reference, reference);
        assert.equal(reading.dailyQuestion, dailyQuestion, `${date}: pregunta distinta de la fuente editorial.`);
        assert.deepEqual(metadata, {
            date, reference,
            bookId: bookIds[reference.match(/^(.+?) \d+:/u)[1]],
            month: date.slice(0, 7), file: `data/readings/${date.slice(0, 7)}.json`, dailyQuestion
        });
        assert.ok(metadata.bookId, `${date}: libro desconocido.`);
        assert.deepEqual(Object.keys(reading.versions).sort(), [...versions].sort());
        for (const version of versions) {
            const html = reading.versions[version];
            assert.ok(html && html.includes('<sup>'), `${date}/${version}: faltan versículos.`);
            assert.doesNotMatch(html, /<(?!\/?(?:p|sup)>)/u, `${date}/${version}: HTML inesperado.`);
            assert.equal(hash(html), sourceByDate.get(date).versionsSha256[version], `${date}/${version}: texto distinto de la fuente.`);
        }
        const link = await resolveExternalDeepLink(`https://suvoz.app/lectura/?date=${date}`, {
            readingExists: target => dates.includes(target)
        });
        assert.equal(link.hash, `#reading/${date}`, `${date}: vínculo incorrecto.`);
    }
}

const allDates = new Set(json('data/readings.json').map(reading => reading.date));
const missing = [];
for (let day = new Date('2026-10-01T12:00:00Z'); day < new Date('2027-01-01T12:00:00Z'); day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    if (!allDates.has(date)) missing.push(date);
}
assert.deepEqual(missing, sources.pendingDates, 'La lista de fechas pendientes debe reflejar el contenido real.');
console.log(`OK: ${questions.length} lecturas, ${questions.length * versions.length} textos, ${approved.length} preguntas del Word y ${proposed.length} propuestas de Hageo, índice, vínculos y copias web/Android.`);
if (missing.length) {
    console.log(`Pendientes de contenido: ${missing.join(', ')}.`);
    if (process.argv.includes('--require-complete')) {
        console.error('El trimestre todavía no está completo para distribución.');
        process.exitCode = 1;
    }
}
