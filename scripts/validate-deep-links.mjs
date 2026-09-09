import assert from 'node:assert/strict';
import { resolveExternalDeepLink } from '../js/services/DeepLinkService.js';

const existingReadings = new Set(['2026-09-09']);
const readingExists = date => existingReadings.has(date);

async function resolves(input) {
    return resolveExternalDeepLink(input, { readingExists });
}

assert.deepEqual(
    await resolves('https://suvoz.app/compartir?src=reading_share'),
    {
        handled: true,
        destination: 'home',
        contentType: 'app_link',
        hash: '#home',
        source: 'reading_share',
        normalizedUrl: 'https://suvoz.app/compartir?src=reading_share',
        reason: 'matched'
    }
);

assert.equal((await resolves('https://suvoz.app/hoy')).hash, '#home');
assert.equal((await resolves('https://suvoz.app/lectura/2026-09-09')).hash, '#reading/2026-09-09');
assert.equal((await resolves('https://suvoz.app/lectura/2026-09-09')).destination, 'reading');
assert.equal((await resolves('https://suvoz.app/lectura/2026-09-10')).hash, '#home');
assert.equal((await resolves('https://suvoz.app/lectura/2026-09-10')).reason, 'reading_not_found');

assert.equal((await resolves('http://suvoz.app/compartir')).handled, false);
assert.equal((await resolves('https://evil.com/compartir')).handled, false);
assert.equal((await resolves('https://suvoz.app/privacy.html')).handled, false);
assert.equal((await resolves('https://suvoz.app/lectura/foo')).hash, '#home');
assert.equal((await resolves('https://suvoz.app/lectura/2026-99-99')).reason, 'invalid_reading_date');
assert.equal((await resolves('https://suvoz.app/lectura/../../foo')).handled, false);
assert.equal((await resolves('javascript:alert(1)')).handled, false);
assert.equal((await resolves('https://suvoz.app/compartir?src=<script>')).source, 'unknown');

console.log('deep link router tests passed');
