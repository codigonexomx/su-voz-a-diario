import { CALENDAR_FILTERS, buildCalendarModel, calendarKeyboardDate, moveCalendarDate, validCalendarDate, validCalendarMonth } from './CalendarModel.js';
import { renderCalendarView } from './CalendarView.js';
import { MeditationSessionStorage } from '../MeditationSessionStorage.js';

export const calendarMethods = {
    getCalendarActivity: function(month, sessions = MeditationSessionStorage) {
        const activity = new Map();
        this.calendarHistoryUnavailable = false;
        try {
            for (let number = 1; number <= 31; number++) {
                const date = `${month}-${String(number).padStart(2, '0')}`;
                if (!validCalendarDate(date)) continue;
                const note = this.getNote(date) || {};
                activity.set(date, {
                    hasMeditation: this.getMeditationNoteFields(note).length > 0,
                    hasPrayer: Boolean(this.cleanMeditationText(note?.oracion)),
                    highlightCount: this.getHighlights(date).length
                });
            }
            for (const meta of sessions.getAllMetadata()) {
                if (!validCalendarDate(meta?.readingId) || !meta.readingId.startsWith(`${month}-`) || typeof meta.id !== 'string') continue;
                const session = sessions.get(meta.id);
                if (!session || session.readingId !== meta.readingId || !this.getMeditationNoteFields(session.notes || {}).length) continue;
                const item = activity.get(meta.readingId);
                item.hasMeditation = true;
                item.hasPrayer ||= Boolean(this.cleanMeditationText(session.notes?.oracion));
                const updatedAt = Number(session.updatedAt) || 0;
                if (!item.meditationId || updatedAt > item.updatedAt) {
                    item.meditationId = meta.id;
                    item.updatedAt = updatedAt;
                }
            }
        } catch {
            this.calendarHistoryUnavailable = true;
        }
        return activity;
    },

    getCalendarModel: function() {
        const today = this.getTodayDateStr();
        this.calendarState ||= { month: today.slice(0, 7), selectedDate: today, filter: 'all', view: 'month' };
        const month = validCalendarMonth(this.calendarState.month) ? this.calendarState.month : today.slice(0, 7);
        const model = buildCalendarModel({ ...this.calendarState, month, today,
            readings: this.getCalendarReadings(), readDates: this.getReadDates(), activity: this.getCalendarActivity(month) });
        model.historyUnavailable = this.calendarHistoryUnavailable;
        this.calendarState = { month: model.month, selectedDate: model.selectedDate, filter: model.filter, view: model.view };
        return model;
    },

    renderCalendar: function({ focusDate = '', focusControl = '', revealFocus = false } = {}) {
        const top = window.scrollY || 0;
        const wasCalendar = Boolean(this.$content.querySelector('.calendar-planner'));
        const model = this.getCalendarModel();
        this._calendarModel = model;
        this.$content.innerHTML = renderCalendarView(model);
        if (wasCalendar) this.scrollWindowInstantly(top);
        const target = validCalendarDate(focusDate) ? this.$content.querySelector(`.calendar-date[data-date="${focusDate}"]`)
            : focusControl ? document.getElementById(focusControl) : null;
        target?.focus({ preventScroll: true });
        const revealTarget = focusControl === 'calendar-selected-date' ? this.$content.querySelector('.calendar-day-detail') : target;
        if (revealFocus) revealTarget?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    },

    changeCalendarMonth: function(month, focusControl = 'calendar-month-select') {
        if (!validCalendarMonth(month)) return;
        const day = validCalendarDate(this.calendarState?.selectedDate) ? this.calendarState.selectedDate.slice(-2) : '01';
        let selectedDate = `${month}-${day}`;
        while (!validCalendarDate(selectedDate)) selectedDate = `${month}-${String(Number(selectedDate.slice(-2)) - 1).padStart(2, '0')}`;
        this.calendarState = { ...this.calendarState, month, selectedDate };
        this.renderCalendar({ focusControl });
    },

    changeCalendarFilter: function(filter) {
        if (!CALENDAR_FILTERS.some(item => item.id === filter)) return;
        this.calendarState.filter = filter;
        this.renderCalendar({ focusControl: 'calendar-filter' });
    },

    handleCalendarKeydown: function(event) {
        if (this.currentView !== 'calendar' || event.altKey || event.ctrlKey || event.metaKey) return;
        const button = event.target.closest('.calendar-date[data-date]');
        if (!button) return;
        const next = calendarKeyboardDate(button.dataset.date, event.key, event.shiftKey);
        if (!next) return;
        event.preventDefault();
        const filter = this._calendarModel?.days.find(day => day.date === next)?.matches ? this.calendarState.filter : 'all';
        this.calendarState = { ...this.calendarState, month: next.slice(0, 7), selectedDate: next, filter };
        this.renderCalendar({ focusDate: next, revealFocus: true });
    },

    openCalendarMeditation: async function(date, button) {
        if (!validCalendarDate(date) || !this.getReadingMetadataByDate(date) || date > this.getTodayDateStr()) return;
        const source = this.$content.querySelector('.calendar-planner');
        if (!source || this._calendarOpeningRequest?.source === source) return;
        const request = { source, date };
        this._calendarOpeningRequest = request;
        const stillSelected = () => this._calendarOpeningRequest === request && source.isConnected
            && this.currentView === 'calendar' && this.calendarState.selectedDate === date;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        try {
            const reading = await this.getReadingByDate(date);
            if (!stillSelected()) return;
            if (!reading || reading.date !== date) { this.showToast('No se pudo cargar esta lectura. Intenta nuevamente con conexión.'); return; }
            if (this.openNoteDate !== date || !this.currentMeditationSessionId) this.toggleNote(date, reading);
            const session = this.currentMeditationSessionId && MeditationSessionStorage.get(this.currentMeditationSessionId);
            if (session) await this.resolveMeditationMetadata(session, { persist: true, reading });
            if (!stillSelected()) return;
            this.trackAnalyticsOnce(`reading_start:${date}`, 'reading_start', this.getReadingAnalyticsParams(reading, 'direct'));
            this.trackAnalyticsEvent('deepen_open', { reading_date: date, entry_point: 'direct' });
            this.openDeepeningShell(reading);
        } catch {
            if (stillSelected()) this.showToast('No se pudo abrir la meditación. Tus datos no se han borrado.');
        } finally {
            if (this._calendarOpeningRequest === request) this._calendarOpeningRequest = null;
            if (button.isConnected) { button.disabled = false; button.removeAttribute('aria-busy'); }
        }
    },

    handleCalendarCommand: async function(button) {
        const action = button.dataset.calendarAction;
        const date = button.dataset.date;
        if (action === 'previous-month' || action === 'next-month') {
            const next = moveCalendarDate(this.calendarState.selectedDate, { months: action === 'previous-month' ? -1 : 1 });
            if (next) this.changeCalendarMonth(next.slice(0, 7), button.id);
        } else if (action === 'today') {
            const today = this.getTodayDateStr();
            this.calendarState = { ...this.calendarState, month: today.slice(0, 7), selectedDate: today, filter: 'all' };
            this.renderCalendar({ focusControl: 'calendar-today' });
        } else if (action === 'view' && ['month', 'list'].includes(button.dataset.view)) {
            this.calendarState.view = button.dataset.view;
            this.renderCalendar({ focusControl: button.id });
        } else if (action === 'clear-filter') {
            this.calendarState.filter = 'all';
            this.renderCalendar({ focusControl: 'calendar-filter' });
        } else if (validCalendarDate(date) && date.startsWith(`${this.calendarState.month}-`)) {
            if (action === 'select-day') {
                const filter = this._calendarModel?.days.find(day => day.date === date)?.matches ? this.calendarState.filter : 'all';
                this.calendarState = { ...this.calendarState, selectedDate: date, filter };
                this.renderCalendar({ focusControl: 'calendar-selected-date', revealFocus: true });
            } else if (action === 'open-reading' && this.getReadingMetadataByDate(date)) {
                this.calendarState.selectedDate = date;
                await this.navigate('reading', date);
            } else if (action === 'meditate' && this.calendarState.selectedDate === date) {
                await this.openCalendarMeditation(date, button);
            } else if (action === 'saved-meditation' && this.calendarState.selectedDate === date) {
                const day = this._calendarModel?.days.find(item => item.date === date);
                if (day?.hasMeditation) await this.navigate('meditations-history', day.meditationId || null);
            }
        }
    }
};
