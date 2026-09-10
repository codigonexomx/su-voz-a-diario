export const APP_LINKS = Object.freeze({
    web: 'https://suvoz.app/',
    acquisition: 'https://suvoz.app/compartir',
    googlePlay: 'https://play.google.com/store/apps/details?id=app.suvoz'
});

export const ACQUISITION_SOURCES = Object.freeze([
    'reading_share',
    'community_share',
    'verse_share',
    'verse_image',
    'church_qr',
    'whatsapp',
    'organic',
    'play_campaign'
]);

const SOURCE_SET = new Set(ACQUISITION_SOURCES);

export function normalizeAcquisitionSource(value) {
    const source = String(value || '').trim().toLowerCase();
    return SOURCE_SET.has(source) ? source : 'unknown';
}

export function buildAcquisitionUrl(source = 'organic') {
    const url = new URL(APP_LINKS.acquisition);
    url.searchParams.set('src', normalizeAcquisitionSource(source));
    return url.href;
}

export function getAcquisitionPlatform(userAgent = '', userAgentData = null) {
    const ua = String(userAgent || '').toLowerCase();
    const uaDataPlatform = String(userAgentData?.platform || '').toLowerCase();

    if (/android/.test(uaDataPlatform)) return 'android';

    if (/android/.test(ua)) return 'android';
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (ua) return 'web';

    return 'unknown';
}
