const events = [];

global.window = {
    location: { search: '?analytics_debug=1' },
    localStorage: {
        getItem: () => null
    },
    addEventListener: () => {},
    firebaseAnalyticsFns: {
        analytics: { app: 'su-voz-test' },
        logEvent: (_analytics, name, params) => {
            events.push({ name, params });
        }
    }
};

const { AnalyticsService } = await import('../js/services/AnalyticsService.js');
const analytics = new AnalyticsService();

analytics.init({
    platform: 'web',
    appVersion: '2.1',
    pwaVersion: '228'
});

analytics.trackEvent('reading_start', {
    reading_date: '2026-09-08',
    reading_reference: 'Juan 3:16',
    bible_version: 'rvr60',
    source: 'home',
    text: 'should not leave the service',
    uid: 'should-not-leave'
});

analytics.trackEvent('notification_open', {
    destination: 'home'
});

analytics.once('reading_view:2026-09-08:home', 'reading_view', {
    reading_date: '2026-09-08',
    reading_reference: 'Juan 3:16',
    bible_version: 'rvr60',
    source: 'home'
});
analytics.once('reading_view:2026-09-08:home', 'reading_view', {
    reading_date: '2026-09-08',
    reading_reference: 'Juan 3:16',
    bible_version: 'rvr60',
    source: 'home'
});

const eventNames = events.map(event => event.name);
if (!eventNames.includes('reading_start')) {
    throw new Error('reading_start no fue entregado al provider');
}

if (eventNames.includes('notification_open')) {
    throw new Error('notification_open reservado no debe enviarse');
}

if (eventNames.filter(name => name === 'reading_view').length !== 1) {
    throw new Error('once no deduplicó reading_view');
}

const readingStart = events.find(event => event.name === 'reading_start');
if ('text' in readingStart.params || 'uid' in readingStart.params) {
    throw new Error('Parámetros sensibles no fueron filtrados');
}

console.log(JSON.stringify({
    provider: analytics.provider,
    events
}, null, 2));
