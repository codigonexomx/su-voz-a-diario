import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
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
assert.equal((await resolves('https://suvoz.app/lectura/?date=2026-09-09')).hash, '#reading/2026-09-09');
assert.equal((await resolves('https://suvoz.app/lectura?date=2026-09-09')).hash, '#reading/2026-09-09');
assert.equal((await resolves('https://suvoz.app/lectura/?date=2026-09-09')).destination, 'reading');
assert.equal((await resolves('https://suvoz.app/lectura/?date=2026-09-10')).hash, '#home');
assert.equal((await resolves('https://suvoz.app/lectura/?date=2026-09-10')).reason, 'reading_not_found');

assert.equal((await resolves('http://suvoz.app/compartir')).handled, false);
assert.equal((await resolves('https://evil.com/compartir')).handled, false);
assert.equal((await resolves('https://suvoz.app/privacy.html')).handled, false);
assert.equal((await resolves('https://suvoz.app/lectura/?date=foo')).hash, '#home');
assert.equal((await resolves('https://suvoz.app/lectura/?date=2026-99-99')).reason, 'invalid_reading_date');
assert.equal((await resolves('https://suvoz.app/lectura/?date=../../foo')).reason, 'invalid_reading_date');
assert.equal((await resolves('https://suvoz.app/lectura/?date=2026-09-09&date=2026-09-10')).reason, 'invalid_reading_date');
assert.equal((await resolves('https://suvoz.app/lectura/2026-09-09')).handled, false);
assert.equal((await resolves('javascript:alert(1)')).handled, false);
assert.equal((await resolves('https://suvoz.app/compartir?src=<script>')).source, 'unknown');

const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const appTree = parse(appSource, { ecmaVersion: 'latest', sourceType: 'module' });
function findProperty(node, name) {
    if (node?.type === 'Property' && node.key?.name === name) return node;
    for (const value of Object.values(node || {})) {
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child && typeof child === 'object') {
                const match = findProperty(child, name);
                if (match) return match;
            }
        }
    }
}
const handlerNode = findProperty(appTree, 'handleExternalAppUrl');
assert(handlerNode, 'Exercise the actual application deep-link handler');
const location = { hash: '#calendar' };
const handler = vm.runInNewContext(`(${appSource.slice(handlerNode.value.start, handlerNode.value.end)})`, {
    resolveExternalDeepLink,
    window: { location },
    history: { pushState: (_state, _title, hash) => { location.hash = hash; } }
});
let routeCalls = 0;
let analyticsCalls = 0;
const app = {
    _lastDeepLinkKey: '',
    homeViewingDate: null,
    getReadingByDate: async date => existingReadings.has(date),
    handleRoute: async () => { routeCalls += 1; },
    trackAnalyticsEvent: () => { analyticsCalls += 1; },
    getAnalyticsPlatform: () => 'android'
};

await handler.call(app, 'https://suvoz.app/hoy', 'getLaunchUrl');
assert.equal(location.hash, '#home');
assert.equal(routeCalls, 1);
await handler.call(app, 'https://suvoz.app/hoy', 'appUrlOpen');
assert.equal(routeCalls, 1, 'Duplicate launch delivery must not rerender');
assert.equal(analyticsCalls, 1, 'Duplicate launch delivery must not count twice');

location.hash = '#calendar';
await handler.call(app, 'https://suvoz.app/hoy');
assert.equal(location.hash, '#home', 'Reopening the same link after navigation must return to its destination');
assert.equal(routeCalls, 2);
assert.equal(analyticsCalls, 2);

app.homeViewingDate = '2026-09-09';
await handler.call(app, 'https://suvoz.app/hoy');
assert.equal(app.homeViewingDate, null, 'Today must replace a historical home reading');
assert.equal(routeCalls, 3);

await handler.call(app, 'https://suvoz.app/lectura?date=2026-09-09');
assert.equal(location.hash, '#reading/2026-09-09');
location.hash = '#community';
await handler.call(app, 'https://suvoz.app/lectura?date=2026-09-09');
assert.equal(location.hash, '#reading/2026-09-09', 'Repeated dated links must also navigate back');
assert.equal(routeCalls, 5);

location.hash = '#calendar';
app._lastDeepLinkKey = '';
await Promise.all([
    handler.call(app, 'https://suvoz.app/hoy', 'getLaunchUrl'),
    handler.call(app, 'https://suvoz.app/hoy', 'appUrlOpen')
]);
assert.equal(routeCalls, 6, 'Concurrent launch deliveries must remain deduplicated');
const beforeUnknown = analyticsCalls;
assert.equal(await handler.call(app, 'https://evil.com/hoy'), false);
assert.equal(analyticsCalls, beforeUnknown);

console.log('deep link router and repeated native delivery tests passed');
