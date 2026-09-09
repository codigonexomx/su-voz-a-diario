import { normalizeAcquisitionSource } from '../core/appLinks.js';

const ALLOWED_PROTOCOL = 'https:';
const ALLOWED_HOSTNAME = 'suvoz.app';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealCalendarDate(value) {
    if (!DATE_PATTERN.test(value)) return false;

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
}

function getSafeSource(url) {
    return normalizeAcquisitionSource(url.searchParams.get('src') || 'unknown');
}

function getSingleSearchParam(url, name) {
    const values = url.searchParams.getAll(name);
    return values.length === 1 ? values[0] : '';
}

function toHomeResult(url, reason = 'matched') {
    return {
        handled: true,
        destination: 'home',
        contentType: 'app_link',
        hash: '#home',
        source: getSafeSource(url),
        normalizedUrl: `${url.origin}${url.pathname}${url.search}`,
        reason
    };
}

function invalidResult(reason) {
    return {
        handled: false,
        destination: 'other',
        contentType: 'app_link',
        hash: '#home',
        source: 'unknown',
        normalizedUrl: '',
        reason
    };
}

export async function resolveExternalDeepLink(input, options = {}) {
    let url;

    try {
        url = new URL(String(input || ''));
    } catch {
        return invalidResult('invalid_url');
    }

    if (url.protocol !== ALLOWED_PROTOCOL) return invalidResult('invalid_protocol');
    if (url.hostname !== ALLOWED_HOSTNAME) return invalidResult('invalid_host');

    if (url.pathname === '/compartir' || url.pathname === '/compartir/') {
        return toHomeResult(url);
    }

    if (url.pathname === '/hoy' || url.pathname === '/hoy/') {
        return toHomeResult(url);
    }

    if (url.pathname === '/lectura' || url.pathname === '/lectura/') {
        const readingDate = getSingleSearchParam(url, 'date');

        if (!isRealCalendarDate(readingDate)) {
            return toHomeResult(url, 'invalid_reading_date');
        }

        const readingExists = typeof options.readingExists === 'function'
            ? await Promise.resolve(options.readingExists(readingDate)).catch(() => false)
            : true;

        if (!readingExists) {
            return toHomeResult(url, 'reading_not_found');
        }

        return {
            handled: true,
            destination: 'reading',
            contentType: 'daily_reading',
            hash: `#reading/${readingDate}`,
            source: getSafeSource(url),
            normalizedUrl: `${url.origin}${url.pathname}${url.search}`,
            reason: 'matched'
        };
    }

    return invalidResult('unsupported_path');
}
