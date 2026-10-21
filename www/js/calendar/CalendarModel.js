export const CALENDAR_FILTERS = Object.freeze([
    { id: 'all', label: 'Todas' },
    { id: 'pending', label: 'Por leer' },
    { id: 'read', label: 'Leídas' },
    { id: 'upcoming', label: 'Próximas' },
    { id: 'notes', label: 'Meditaciones' },
    { id: 'highlights', label: 'Resaltados' }
]);

const formatter = options => new Intl.DateTimeFormat('es-MX', { ...options, timeZone: 'UTC' });
const longDate = formatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthDate = formatter({ month: 'long', year: 'numeric' });
const monthName = formatter({ month: 'long' });
const shortDay = formatter({ weekday: 'short' });
const pad = number => String(number).padStart(2, '0');

function dateObject(year, month, day = 1) {
    const value = new Date(0);
    value.setUTCHours(12, 0, 0, 0);
    value.setUTCFullYear(year, month - 1, day);
    return value;
}

export function validCalendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    return year > 0 && month > 0 && month <= 12 && day > 0 && day <= 31
        && dateObject(year, month, day).toISOString().slice(0, 10) === value;
}

export function validCalendarMonth(value) {
    return typeof value === 'string' && validCalendarDate(`${value}-01`);
}

export function moveCalendarDate(value, { days = 0, months = 0 } = {}) {
    if (!validCalendarDate(value) || !Number.isInteger(days) || !Number.isInteger(months)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const target = dateObject(year, month);
    target.setUTCMonth(target.getUTCMonth() + months);
    const end = new Date(target);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    target.setUTCDate(Math.min(day, end.getUTCDate()) + days);
    if (!Number.isFinite(target.getTime()) || target.getUTCFullYear() < 1 || target.getUTCFullYear() > 9999) return null;
    return target.toISOString().slice(0, 10);
}

export function calendarKeyboardDate(date, key, shift = false) {
    if (!validCalendarDate(date)) return null;
    const weekday = dateObject(...date.split('-').map(Number)).getUTCDay();
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
    if (Object.hasOwn(offsets, key)) return moveCalendarDate(date, { days: offsets[key] });
    if (key === 'PageUp' || key === 'PageDown') return moveCalendarDate(date, { months: (key === 'PageUp' ? -1 : 1) * (shift ? 12 : 1) });
    return null;
}

export function matchesCalendarFilter(day, filter) {
    if (filter === 'pending') return day.isPending;
    if (filter === 'read') return day.isRead;
    if (filter === 'upcoming') return day.hasReading && day.isFuture && !day.isRead;
    if (filter === 'notes') return day.hasMeditation;
    if (filter === 'highlights') return day.highlightCount > 0;
    return true;
}

export function buildCalendarModel({ today, month, selectedDate, readings = [], readDates = [], activity = new Map(), filter = 'all', view = 'month' }) {
    if (!validCalendarDate(today)) throw new TypeError('A valid local day is required');
    const activeMonth = validCalendarMonth(month) ? month : today.slice(0, 7);
    const activeFilter = CALENDAR_FILTERS.some(item => item.id === filter) ? filter : 'all';
    const byDate = new Map();
    for (const reading of Array.isArray(readings) ? readings : []) {
        if (validCalendarDate(reading?.date) && typeof reading.reference === 'string' && reading.reference.trim()) {
            byDate.set(reading.date, { date: reading.date, reference: reading.reference.trim() });
        }
    }
    const readSet = new Set((Array.isArray(readDates) ? readDates : []).filter(validCalendarDate));
    const monthReadings = [...byDate.values()].filter(item => item.date.startsWith(`${activeMonth}-`)).sort((a, b) => a.date.localeCompare(b.date));
    const selected = validCalendarDate(selectedDate) && selectedDate.startsWith(`${activeMonth}-`) ? selectedDate
        : today.startsWith(`${activeMonth}-`) ? today : monthReadings[0]?.date || `${activeMonth}-01`;
    const [year, monthNumber] = activeMonth.split('-').map(Number);
    const first = dateObject(year, monthNumber);
    const last = dateObject(year, monthNumber + 1, 0).getUTCDate();
    const days = [];
    for (let number = 1; number <= last; number++) {
        const date = `${activeMonth}-${pad(number)}`;
        const note = activity.get(date) || {};
        const reading = byDate.get(date);
        const hasReading = Boolean(reading);
        const isRead = readSet.has(date);
        const day = {
            date, number, reference: reading?.reference || '', hasReading, isRead,
            isToday: date === today, isFuture: date > today,
            isPending: hasReading && !isRead && date <= today,
            hasMeditation: note.hasMeditation === true,
            hasPrayer: note.hasPrayer === true,
            meditationId: typeof note.meditationId === 'string' ? note.meditationId : '',
            highlightCount: Number.isInteger(note.highlightCount) && note.highlightCount > 0 ? note.highlightCount : 0,
            label: longDate.format(dateObject(year, monthNumber, number)),
            weekday: shortDay.format(dateObject(year, monthNumber, number))
        };
        day.status = !hasReading ? 'unavailable' : isRead ? 'read' : day.isFuture ? 'upcoming' : 'pending';
        day.statusLabel = { unavailable: 'Sin lectura programada', read: 'Leída', upcoming: 'Próxima', pending: 'Por leer' }[day.status];
        day.matches = matchesCalendarFilter(day, activeFilter);
        days.push(day);
    }
    const meaningful = day => day.hasReading || day.isRead || day.hasMeditation || day.highlightCount > 0;
    const agenda = days.filter(day => meaningful(day) && day.matches);
    const availableSelection = days.find(day => day.date === selected);
    const shownSelection = activeFilter === 'all' || availableSelection.matches ? availableSelection
        : days.find(day => meaningful(day) && day.matches) || null;
    const cells = Array.from({ length: 42 }, (_, index) => days[index - first.getUTCDay()] || null);
    const due = days.filter(day => day.hasReading && !day.isFuture);
    const completed = due.filter(day => day.isRead).length;
    const years = new Set([year - 1, year, year + 1, Number(today.slice(0, 4)) - 1, Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1]);
    for (const date of [...byDate.keys(), ...activity.keys()]) if (validCalendarDate(date)) years.add(Number(date.slice(0, 4)));
    const months = [...years].filter(value => value >= 1 && value <= 9999).sort((a, b) => a - b).map(value => ({
        year: value,
        options: Array.from({ length: 12 }, (_, index) => {
            const date = dateObject(value, index + 1);
            return { value: `${String(value).padStart(4, '0')}-${pad(index + 1)}`, label: `${monthName.format(date)} ${value}` };
        })
    }));
    return {
        today, month: activeMonth, selectedDate: shownSelection?.date || selected,
        filter: activeFilter, view: view === 'list' ? 'list' : 'month',
        monthLabel: monthDate.format(first), cells, days, agenda, months, selection: shownSelection,
        counts: Object.fromEntries(CALENDAR_FILTERS.map(option => [option.id, days.filter(day => meaningful(day) && matchesCalendarFilter(day, option.id)).length])),
        total: monthReadings.length, completed, due: due.length,
        pending: days.filter(day => day.isPending).length,
        upcoming: days.filter(day => day.hasReading && day.isFuture && !day.isRead).length,
        meditations: days.filter(day => day.hasMeditation).length,
        percentage: due.length ? Math.round(completed / due.length * 100) : 0
    };
}
