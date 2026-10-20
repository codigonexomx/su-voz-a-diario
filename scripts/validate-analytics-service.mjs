import assert from 'node:assert/strict';
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

const { AnalyticsService, isAnalyticsCollectionAllowed } = await import('../js/services/AnalyticsService.js');
const analytics = new AnalyticsService();

analytics.init({
    platform: 'web',
    appVersion: '2.1',
    pwaVersion: '229'
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

assert.equal(readingStart.params.interaction_source, 'home');
assert(!('source' in readingStart.params), 'UI context must not replace acquisition source');
const clean = analytics.sanitizeParams({source:'home',medium:'internal',campaign_source:'home',
    campaign_medium:'internal',entry_point:'journey',email:'private',prayer:'private',interaction_source:'reading'});
assert.deepEqual(clean,{interaction_source:'reading',entry_point:'journey'});

const originalLocation = window.location;
for (const hostname of ['localhost','127.0.0.1','[::1]','::1','qa.localhost']) {
    window.location = {hostname,protocol:'http:',search:'?analytics_debug=1'};
    assert.equal(isAnalyticsCollectionAllowed(),false);
    const local = new AnalyticsService();
    const before = events.length;
    local.init({platform:'web'});
    local.trackEvent('reading_start',{source:'home'});
    local.attachProvider();
    assert.equal(events.length,before,'Local QA must never dispatch even with an available provider');
    assert.equal(local.pendingEvents.length,0);
    assert.equal(local.provider,'debug_console');
}
window.location = {hostname:'localhost',protocol:'https:',search:''};
window.Capacitor = {isNativePlatform:()=>true};
assert.equal(isAnalyticsCollectionAllowed(),true,'Capacitor localhost is a real native installation');
window.location.search='?analytics_test=1';
assert.equal(isAnalyticsCollectionAllowed(),false,'Explicit QA also excludes native traffic');
delete window.Capacitor;
window.location={hostname:'suvoz.app',protocol:'https:',search:''};
const delayed = new AnalyticsService();
const provider = window.firebaseAnalyticsFns;
window.firebaseAnalyticsFns=null;
delayed.init({platform:'pwa'});
delayed.once('one','reading_start',{source:'home'});
assert.equal(delayed.pendingEvents.length,1);
window.firebaseAnalyticsFns=provider;
const beforeFlush=events.length;
delayed.attachProvider();delayed.attachProvider();
assert.equal(events.length,beforeFlush+1,'Deferred provider flushes once');
assert.equal(events.at(-1).params.interaction_source,'home');
window.location=originalLocation;
console.log('OK: acquisition context, privacy, native collection, local QA exclusion and deferred provider');

console.log(JSON.stringify({
    provider: analytics.provider,
    events
}, null, 2));
