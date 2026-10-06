import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeClientAppCheck } from '../js/services/AppCheckService.js';
import { APP_CHECK_CONFIG } from '../js/core/securityConfig.js';

let calls = 0, initialized = 0, nativeStarts = 0, provider;
const sdk = { initializeAppCheck(app, options) { initialized++; provider = options.provider; assert.equal(options.isTokenAutoRefreshEnabled, true); },
    CustomProvider: class { constructor(options) { this.options = options; } },
    ReCaptchaEnterpriseProvider: class { constructor(key) { this.key = key; } } };
const loadSdk = async () => { calls++; return sdk; };
assert.equal((await initializeClientAppCheck({}, APP_CHECK_CONFIG, { loadSdk })).status, 'disabled');
assert.equal(calls, 0);
for (const origin of ['http://localhost:8000', 'https://untrusted.example']) {
    assert.equal((await initializeClientAppCheck({}, { enabled: true, webSiteKey: '6QA'.repeat(12) }, { origin, loadSdk })).status, 'not-configured');
}
assert.equal(calls, 0);
assert.equal((await initializeClientAppCheck({}, { enabled: true, webSiteKey: '' }, { origin: 'https://suvoz.app', loadSdk })).status, 'not-configured');
const app = {}, config = { enabled: true, webSiteKey: '6QA'.repeat(12) };
const first = initializeClientAppCheck(app, config, { origin: 'https://suvoz.app', loadSdk });
assert.equal(initializeClientAppCheck(app, config, { origin: 'https://suvoz.app', loadSdk }), first);
assert.equal((await first).status, 'initialized');
assert.equal(initialized, 1);
let result = { token: 'synthetic-local-token', expireTimeMillis: 5000 };
const capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { FirebaseAppCheck: {
    initialize: async options => { nativeStarts++; assert.equal(options.isTokenAutoRefreshEnabled, true); assert(!options.debug && !options.debugToken); },
    getToken: async () => result
} } };
assert.equal((await initializeClientAppCheck({}, { enabled: true }, { capacitor, loadSdk })).status, 'not-configured');
assert.equal(nativeStarts, 0);
assert.equal((await initializeClientAppCheck({}, { enabled: true, nativeEnabled: true }, { capacitor, loadSdk, now: () => 1000 })).status, 'initialized');
assert.equal(nativeStarts, 1);
assert.deepEqual(await provider.options.getToken(), result);
result = { token: 'synthetic', expireTimeMillis: 500 };
await assert.rejects(provider.options.getToken());
result = { token: '', expireTimeMillis: 5000 };
await assert.rejects(provider.options.getToken());
assert.equal((await initializeClientAppCheck({}, config, { origin: 'https://suvoz.app', loadSdk: async () => { throw Error('No network'); } })).status, 'unavailable');
let releaseSdk;
const startsBeforeTimeout = initialized;
const pending = initializeClientAppCheck({}, config, {
    origin: 'https://suvoz.app', timeoutMs: 10,
    loadSdk: () => new Promise(resolve => { releaseSdk = resolve; })
});
assert.equal((await pending).status, 'unavailable');
releaseSdk(sdk);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(initialized, startsBeforeTimeout, 'A late SDK must not initialize after the deadline');
assert.equal((await initializeClientAppCheck({}, { enabled: true, nativeEnabled: true }, {
    capacitor: { ...capacitor, getPlatform: () => 'ios' }, loadSdk
})).status, 'not-configured');
const index = readFileSync('index.html', 'utf8');
assert(index.indexOf('await initializeClientAppCheck') < index.indexOf('window.firebaseDb ='));
assert(!/console\./.test(readFileSync('js/services/AppCheckService.js', 'utf8')));
console.log('OK: App Check opt-in, no disabled traffic, one initialization, native expiry/bridge, official-origin gate, no debug/token logging, errors preserve reader and initialization before Firebase services');
