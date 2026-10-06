const SDK_URL = 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app-check.js';
const states = new WeakMap();

export function initializeClientAppCheck(app, config, {
    capacitor = globalThis.window?.Capacitor,
    origin = globalThis.location?.origin,
    loadSdk = () => import(SDK_URL),
    now = () => Date.now(),
    timeoutMs = 5000
} = {}) {
    if (config?.enabled !== true) return Promise.resolve({ status: 'disabled' });
    if (states.has(app)) return states.get(app);
    let expired = false, timer;
    const attempt = (async () => {
        const native = capacitor?.isNativePlatform?.() === true;
        if (!native && (origin !== 'https://suvoz.app' || !/^6[\w-]{20,}$/.test(config.webSiteKey || ''))) {
            return { status: 'not-configured' };
        }
        const plugin = native ? capacitor?.Plugins?.FirebaseAppCheck : null;
        if (native && (capacitor?.getPlatform?.() !== 'android' || config.nativeEnabled !== true || !plugin?.initialize || !plugin?.getToken)) {
            return { status: 'not-configured' };
        }
        const sdk = await loadSdk();
        if (expired) return { status: 'unavailable' };
        let provider;
        if (native) {
            await plugin.initialize({ isTokenAutoRefreshEnabled: true });
            if (expired) return { status: 'unavailable' };
            provider = new sdk.CustomProvider({ getToken: async () => {
                const result = await plugin.getToken({ forceRefresh: false });
                if (typeof result.token !== 'string' || !result.token || !Number.isFinite(result.expireTimeMillis)
                    || result.expireTimeMillis <= now()) throw new Error('App Check token unavailable');
                return { token: result.token, expireTimeMillis: result.expireTimeMillis };
            } });
        } else {
            provider = new sdk.ReCaptchaEnterpriseProvider(config.webSiteKey);
        }
        sdk.initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
        return { status: 'initialized', provider: native ? 'play-integrity' : 'recaptcha-enterprise' };
    })().catch(() => ({ status: 'unavailable' }));
    const deadline = new Promise(resolve => {
        timer = setTimeout(() => {
            expired = true;
            resolve({ status: 'unavailable' });
        }, timeoutMs);
    });
    const start = Promise.race([attempt, deadline]).finally(() => clearTimeout(timer));
    // Attestation failures never erase Auth, leak tokens, or block the local reader.
    states.set(app, start);
    return start;
}
