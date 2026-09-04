export function getTodayDateStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getDateStrInTimeZone(date = new Date(), timeZone = 'America/Mexico_City') {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
}

export function getYesterdayDateStr() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDateForCompare(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDateEs(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const options = { day: 'numeric', month: 'long' };
    return date.toLocaleDateString('es-ES', options);
}

export function getCommunityDiscoveryRange(filter, referenceDate = new Date()) {
    const ref = new Date(referenceDate);
    if (isNaN(ref.getTime())) {
        return { start: null, endExclusive: null };
    }

    if (filter === 'today') {
        const startToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
        const startTomorrow = new Date(startToday.getTime() + 86400000);
        return { start: startToday, endExclusive: startTomorrow };
    }

    if (filter === 'yesterday') {
        const startToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
        const startYesterday = new Date(startToday.getTime() - 86400000);
        return { start: startYesterday, endExclusive: startToday };
    }

    if (filter === 'week') {
        const startToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
        const dayOfWeek = startToday.getDay();
        const distanceToMonday = (dayOfWeek + 6) % 7;
        const startMonday = new Date(startToday.getTime() - (distanceToMonday * 86400000));
        const startNextMonday = new Date(startMonday.getTime() + (7 * 86400000));
        return { start: startMonday, endExclusive: startNextMonday };
    }

    return { start: null, endExclusive: null };
}
