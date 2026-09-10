import {
    APP_LINKS,
    getAcquisitionPlatform,
    normalizeAcquisitionSource
} from './core/appLinks.js';

import {
    analyticsService
} from './services/AnalyticsService.js';

const FIREBASE_CONFIG = Object.freeze({
    apiKey: 'AIzaSyBuU5X87K-zyHvkFT7xirBZjN90MpID7Uo',
    authDomain: 'su-voz-a-diario-v2-f3a87.firebaseapp.com',
    projectId: 'su-voz-a-diario-v2-f3a87',
    storageBucket: 'su-voz-a-diario-v2-f3a87.firebasestorage.app',
    messagingSenderId: '112607423194',
    appId: '1:112607423194:web:62a17cfe618a81b3ac53e3',
    measurementId: 'G-X95Y1G3BE0'
});

function getSource() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        if (!params.has('src')) return 'organic';
        return normalizeAcquisitionSource(params.get('src'));
    } catch {
        return 'unknown';
    }
}

function getPlatform() {
    const navigator = window.navigator || {};
    return getAcquisitionPlatform(navigator.userAgent || '', navigator.userAgentData || null);
}

async function attachFirebaseAnalytics() {
    if (!FIREBASE_CONFIG.measurementId) return;

    try {
        const [appModule, analyticsModule] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js')
        ]);

        const supported = await analyticsModule.isSupported();
        if (!supported) return;

        const app = appModule.getApps().length
            ? appModule.getApp()
            : appModule.initializeApp(FIREBASE_CONFIG);

        window.firebaseAnalyticsFns = {
            analytics: analyticsModule.getAnalytics(app),
            logEvent: analyticsModule.logEvent
        };
        window.dispatchEvent(new Event('suvoz-analytics-ready'));
    } catch (error) {
        window.dispatchEvent(new Event('suvoz-firebase-unavailable'));
    }
}

function track(name, params) {
    analyticsService.trackEvent(name, params);
}

function bindCta(button, destination, href, source, platform) {
    if (!button || !href) return;

    button.addEventListener('click', () => {
        track('acquisition_cta_click', {
            destination,
            source,
            platform
        });
    });
}

function configureCtas(source, platform) {
    const webButton = document.querySelector('[data-acquisition-open-web]');
    const playButton = document.querySelector('[data-acquisition-google-play]');
    const playSlot = document.querySelector('[data-acquisition-google-play-slot]');
    const note = document.querySelector('[data-acquisition-note]');

    if (webButton) {
        webButton.href = APP_LINKS.web;
    }

    if (platform === 'android' && APP_LINKS.googlePlay && playButton && playSlot) {
        playButton.href = APP_LINKS.googlePlay;
        playSlot.hidden = false;
        playSlot.dataset.priority = 'primary';
        webButton?.setAttribute('data-priority', 'secondary');
        if (webButton) {
            webButton.textContent = 'Abrir Su Voz en la web';
        }
        if (note) {
            note.textContent = 'Su Voz está disponible para Android en Google Play.';
        }

        bindCta(playButton, 'google_play', APP_LINKS.googlePlay, source, platform);
    }

    bindCta(webButton, 'web', APP_LINKS.web, source, platform);
}

async function init() {
    const source = getSource();
    const platform = getPlatform();

    document.documentElement.dataset.platform = platform;
    document.documentElement.dataset.source = source;

    analyticsService.init({
        platform,
        appVersion: '2.1',
        pwaVersion: '229'
    });

    track('acquisition_landing_view', {
        source,
        platform
    });

    configureCtas(source, platform);
    await attachFirebaseAnalytics();
}

init();
