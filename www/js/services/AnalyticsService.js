const EVENT_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const PARAM_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const RESERVED_PREFIXES = ['firebase_', 'ga_', 'google_', 'gtag.'];
const RESERVED_EVENT_NAMES = new Set([
    'click',
    'error',
    'file_download',
    'first_open',
    'first_visit',
    'form_start',
    'form_submit',
    'notification_open',
    'page_view',
    'scroll',
    'session_start',
    'user_engagement',
    'view_search_results'
]);
const RESERVED_PARAM_NAMES = new Set([
    'name',
    'email',
    'uid',
    'user_id',
    'message',
    'text',
    'body',
    'content',
    'prayer',
    'meditation',
    'response',
    'comment',
    'testimony',
    'token'
]);

const CONTROLLED_VALUES = {
    platform: ['web', 'pwa', 'android', 'ios', 'native', 'unknown'],
    source: ['home', 'reading', 'calendar', 'community', 'direct', 'unknown'],
    entry_point: ['bottom_nav', 'daily_question', 'reading_ecos', 'notification', 'direct', 'home', 'unknown'],
    audio_context: ['daily_reading', 'bible'],
    content_type: ['daily_reading', 'verse', 'verse_image', 'community_post', 'app'],
    method: ['native_share', 'clipboard', 'other'],
    notification_type: ['daily_reminder', 'community_activity', 'other'],
    destination: ['home', 'community', 'community_thread', 'reading', 'bible', 'other'],
    post_type: ['reflection', 'daily_question_response', 'prayer', 'testimony', 'unknown'],
    reaction_type: ['useful', 'thanks', 'unknown'],
    validation_source: ['local_debug']
};

function normalizeValue(value) {
    if (typeof value === 'boolean' || typeof value === 'number') return value;
    if (value == null) return undefined;
    return String(value).trim().slice(0, 100);
}

function getDebugEnabled() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        return params.get('analytics_debug') === '1' ||
            window.localStorage?.getItem('su-voz-analytics-debug') === '1';
    } catch {
        return false;
    }
}

export class AnalyticsService {
    constructor() {
        this.initialized = false;
        this.debug = false;
        this.defaultParams = {};
        this.sessionEvents = new Set();
        this.pendingEvents = [];
        this.logEventFn = null;
        this.provider = 'none';
        this.validationEventSent = false;
    }

    init(options = {}) {
        this.debug = getDebugEnabled();
        this.defaultParams = this.sanitizeParams({
            platform: options.platform || 'unknown',
            app_version: options.appVersion || '',
            pwa_version: options.pwaVersion || ''
        });

        this.attachProvider();
        this.initialized = true;

        window.addEventListener('suvoz-analytics-ready', () => this.attachProvider());
        window.addEventListener('suvoz-firebase-unavailable', () => this.attachProvider());
    }

    attachProvider() {
        const analyticsFns = window.firebaseAnalyticsFns;

        if (analyticsFns?.analytics && typeof analyticsFns.logEvent === 'function') {
            this.logEventFn = (name, params) => analyticsFns.logEvent(analyticsFns.analytics, name, params);
            this.provider = 'firebase_analytics';
            this.flushPendingEvents();
            this.trackValidationEvent();
            return;
        }

        this.logEventFn = null;
        this.provider = this.debug ? 'debug_console' : 'none';
    }

    once(key, name, params = {}) {
        if (!key || this.sessionEvents.has(key)) return;
        this.sessionEvents.add(key);
        this.trackEvent(name, params);
    }

    trackEvent(name, params = {}) {
        if (
            !EVENT_NAME_PATTERN.test(name) ||
            RESERVED_EVENT_NAMES.has(name) ||
            RESERVED_PREFIXES.some(prefix => name.startsWith(prefix))
        ) {
            if (this.debug) console.warn('[Analytics] Evento inválido omitido:', name);
            return;
        }

        const sanitizedParams = this.sanitizeParams({
            ...this.defaultParams,
            ...params,
            ...(this.debug ? { debug_mode: true } : {})
        });

        if (this.debug) {
            console.info('[Analytics]', {
                event: name,
                params: sanitizedParams,
                provider: this.provider,
                providerReady: Boolean(this.logEventFn),
                dispatchAttempted: Boolean(this.logEventFn),
                at: new Date().toISOString()
            });
        }

        if (!this.logEventFn) {
            if (this.pendingEvents.length < 50) {
                this.pendingEvents.push({ name, params: sanitizedParams });
            }
            if (this.debug) {
                console.info('[Analytics] queued', {
                    event: name,
                    provider: this.provider,
                    pendingCount: this.pendingEvents.length
                });
            }
            return;
        }

        this.sendEvent(name, sanitizedParams);
    }

    flushPendingEvents() {
        const pendingEvents = this.pendingEvents.splice(0);
        pendingEvents.forEach(event => this.sendEvent(event.name, event.params));
    }

    sendEvent(name, params) {
        try {
            this.logEventFn(name, params);
            if (this.debug) {
                console.info('[Analytics] dispatch', {
                    event: name,
                    provider: this.provider,
                    sdkAccepted: true
                });
            }
        } catch (error) {
            if (this.debug) {
                console.warn('[Analytics] dispatch', {
                    event: name,
                    provider: this.provider,
                    sdkAccepted: false,
                    errorName: error?.name || '',
                    errorCode: error?.code || '',
                    errorMessage: error?.message || ''
                });
            }
        }
    }

    trackValidationEvent() {
        if (!this.debug || this.validationEventSent || !this.logEventFn) return;

        this.validationEventSent = true;
        this.sendEvent('analytics_validation', this.sanitizeParams({
            ...this.defaultParams,
            validation_source: 'local_debug',
            debug_mode: true
        }));
    }

    sanitizeParams(params) {
        return Object.entries(params || {}).reduce((safeParams, [rawKey, rawValue]) => {
            const key = String(rawKey || '').trim();

            if (
                !PARAM_NAME_PATTERN.test(key) ||
                RESERVED_PARAM_NAMES.has(key) ||
                RESERVED_PREFIXES.some(prefix => key.startsWith(prefix))
            ) {
                return safeParams;
            }

            const value = normalizeValue(rawValue);
            if (value === undefined || value === '') return safeParams;

            if (CONTROLLED_VALUES[key] && !CONTROLLED_VALUES[key].includes(value)) {
                safeParams[key] = CONTROLLED_VALUES[key].includes('unknown') ? 'unknown' : CONTROLLED_VALUES[key][0];
                return safeParams;
            }

            safeParams[key] = value;
            return safeParams;
        }, {});
    }
}

export const analyticsService = new AnalyticsService();
