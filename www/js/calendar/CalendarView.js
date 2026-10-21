import { escapeBibleHtml as escape } from '../utils/text.js';
import { readingIcon as icon } from '../utils/readingIcons.js';
import { CALENDAR_FILTERS } from './CalendarModel.js';

const command = (action, text, glyph, extra = '') => `<button type="button" class="calendar-command" data-calendar-action="${action}" ${extra}>${glyph ? icon(glyph) : ''}<span>${text}</span></button>`;
const dateAction = date => `data-date="${escape(date)}"`;

function renderDay(day, model) {
    if (!day) return '<td class="calendar-empty-day" aria-hidden="true"></td>';
    const selected = model.selection?.date === day.date;
    const label = [day.label, day.isToday ? 'Hoy' : '', day.reference, day.statusLabel,
        day.hasMeditation ? 'Con meditación' : '', day.hasPrayer ? 'Con oración' : '', day.highlightCount ? 'Con resaltados' : ''].filter(Boolean).join('. ');
    return `<td role="gridcell" aria-selected="${selected}">
        <button type="button" class="calendar-date${day.isToday ? ' is-today' : ''}${selected ? ' is-selected' : ''}${!day.matches ? ' is-muted' : ''}${!day.hasReading ? ' is-unavailable' : ''}"
            data-calendar-action="select-day" ${dateAction(day.date)} tabindex="${day.date === model.selectedDate ? '0' : '-1'}"
            aria-label="${escape(label)}" ${day.isToday ? 'aria-current="date"' : ''} title="${escape(day.reference || day.statusLabel)}">
            <span class="calendar-date-number">${day.number}</span>
            <span class="calendar-date-marks" aria-hidden="true">${day.isRead ? `<span class="calendar-read-mark">${icon('complete')}</span>` : ''}${day.hasMeditation ? '<span class="calendar-meditation-mark"></span>' : ''}${day.highlightCount ? '<span class="calendar-highlight-mark"></span>' : ''}</span>
        </button>
    </td>`;
}

function renderMonth(model) {
    const weekdays = [['dom', 'domingo'], ['lun', 'lunes'], ['mar', 'martes'], ['mié', 'miércoles'], ['jue', 'jueves'], ['vie', 'viernes'], ['sáb', 'sábado']];
    return `<table class="calendar-month-grid" role="grid" aria-labelledby="calendar-month-heading">
        <thead><tr>${weekdays.map(([short, full]) => `<th scope="col" abbr="${full}">${short}</th>`).join('')}</tr></thead>
        <tbody>${Array.from({ length: 6 }, (_, index) => model.cells.slice(index * 7, index * 7 + 7)).filter(week => week.some(Boolean)).map(week => `<tr>${week.map(day => renderDay(day, model)).join('')}</tr>`).join('')}</tbody>
    </table>
    <div class="calendar-legend" aria-label="Estados del calendario">
        <span class="calendar-legend-today"><i aria-hidden="true"></i>Hoy</span>
        <span class="calendar-legend-read">${icon('complete')}Leída</span>
        <span><i class="calendar-meditation-mark" aria-hidden="true"></i>Meditación</span>
        <span><i class="calendar-highlight-mark" aria-hidden="true"></i>Resaltados</span>
    </div>`;
}

function emptyResults(model) {
    const filtered = model.filter !== 'all';
    const unavailable = model.historyUnavailable && model.filter === 'notes';
    return `<div class="calendar-empty-state">
        ${icon(filtered ? 'search' : 'calendar')}
        <h3>${unavailable ? 'Historial no disponible' : filtered ? 'Sin coincidencias este mes' : 'Sin lecturas programadas'}</h3>
        <p>${unavailable ? 'No se pudo consultar todo el historial local. Tus meditaciones no se han borrado.' : filtered ? `No hay días en «${escape(CALENDAR_FILTERS.find(item => item.id === model.filter).label)}» para ${escape(model.monthLabel)}.` : `El plan todavía no contiene lecturas para ${escape(model.monthLabel)}.`}</p>
        ${command(filtered ? 'clear-filter' : 'today', filtered ? 'Ver todas' : 'Volver a hoy', filtered ? 'close' : 'calendar')}
    </div>`;
}

function renderAgenda(model) {
    if (!model.agenda.length) return emptyResults(model);
    return `<ol class="calendar-agenda" aria-label="Lecturas de ${escape(model.monthLabel)}">${model.agenda.map(day => `<li>
        <button type="button" class="calendar-agenda-day${day.isToday ? ' is-today' : ''}" data-calendar-action="${day.hasReading ? 'open-reading' : 'select-day'}" ${dateAction(day.date)} aria-label="${escape(`${day.label}. ${day.reference || 'Sin lectura programada'}. ${day.statusLabel}`)}">
            <span class="calendar-agenda-date"><span>${escape(day.weekday.replace('.', ''))}</span><strong>${day.number}</strong></span>
            <span class="calendar-agenda-reading"><strong>${escape(day.reference || (day.hasMeditation ? 'Meditación guardada' : day.highlightCount ? 'Pasajes resaltados' : 'Lectura registrada'))}</strong><span>${day.isToday ? 'Hoy · ' : ''}${escape(day.statusLabel)}${day.hasMeditation ? ' · Con meditación' : ''}${day.highlightCount ? ' · Con resaltados' : ''}</span></span>
            <span class="calendar-agenda-end ${day.isRead ? 'is-read' : ''}" aria-hidden="true">${icon(day.isRead ? 'complete' : 'next')}</span>
        </button>
    </li>`).join('')}</ol>`;
}

function renderSelection(model) {
    const day = model.selection;
    if (!day) return emptyResults(model);
    return `<section class="calendar-day-detail" aria-labelledby="calendar-selected-date">
        <p class="calendar-detail-kicker">${!day.hasReading ? 'Día seleccionado' : day.isToday ? 'Hoy' : day.isFuture ? 'Próxima lectura' : 'Tu lectura'}</p>
        <h3 id="calendar-selected-date" tabindex="-1">${escape(day.label)}</h3>
        <div class="calendar-reading-status is-${day.status}">${icon(day.isRead ? 'complete' : day.isFuture ? 'calendar' : 'read')}<span>${escape(day.statusLabel)}</span></div>
        <p class="calendar-selected-reference">${escape(day.reference || 'Sin lectura para esta fecha')}</p>
        ${!day.hasReading ? '<p class="calendar-detail-unavailable">No hay un pasaje programado para este día.</p>' : ''}
        <div class="calendar-day-actions">
            ${day.hasReading ? command('open-reading', day.isRead ? 'Volver a leer' : day.isFuture ? 'Ver lectura' : 'Leer pasaje', 'read', dateAction(day.date)) : ''}
            ${day.hasReading && !day.isFuture ? command('meditate', 'Meditación', 'meditation', dateAction(day.date)) : ''}
            ${!day.hasReading ? command('today', 'Lectura de hoy', 'calendar') : ''}
        </div>
        ${day.hasMeditation || day.highlightCount ? `<div class="calendar-saved-activity">
            <h4>Guardado para este día</h4>
            ${day.hasMeditation ? command(day.meditationId || !day.hasReading || day.isFuture ? 'saved-meditation' : 'meditate',
                day.meditationId ? 'Ver meditación guardada' : day.hasReading && !day.isFuture ? 'Continuar meditación' : 'Mis meditaciones', 'meditation', dateAction(day.date)) : ''}
            ${day.hasPrayer ? `<span>${icon('meditation')}Oración guardada</span>` : ''}
            ${day.highlightCount ? `<span>${icon('highlight')}${day.highlightCount} ${day.highlightCount === 1 ? 'pasaje resaltado' : 'pasajes resaltados'}</span>` : ''}
        </div>` : ''}
    </section>`;
}

export function renderCalendarView(model) {
    const emptyList = model.view === 'list' && !model.agenda.length;
    const progressLabel = model.due ? `${model.completed} de ${model.due} lecturas hasta hoy`
        : model.total ? `${model.upcoming} lecturas próximas` : 'Sin lecturas en el plan de este mes';
    return `<section class="calendar-planner" aria-labelledby="calendar-title">
        <header class="calendar-heading"><div><p class="calendar-eyebrow">SU VOZ A DIARIO</p><h2 id="calendar-title">Calendario</h2></div>
            <span class="calendar-plan-total">${model.total} ${model.total === 1 ? 'lectura' : 'lecturas'} en el mes</span>
        </header>
        ${model.historyUnavailable ? '<p class="calendar-history-warning" role="status">No se pudo consultar todo el historial local. Tus datos no se han borrado.</p>' : ''}
        <div class="calendar-workspace${emptyList ? ' is-empty' : ''}">
            <div class="calendar-main">
                <div class="calendar-month-toolbar">
                    ${command('previous-month', '', 'previous', 'id="calendar-previous-month" aria-label="Mes anterior" title="Mes anterior"')}
                    <label class="calendar-month-picker"><span class="sr-only">Mes y año</span><select id="calendar-month-select" aria-label="Mes y año">${model.months.map(group => `<optgroup label="${group.year}">${group.options.map(option => `<option value="${option.value}"${option.value === model.month ? ' selected' : ''}>${escape(option.label)}</option>`).join('')}</optgroup>`).join('')}</select>${icon('down')}</label>
                    ${command('next-month', '', 'next', 'id="calendar-next-month" aria-label="Mes siguiente" title="Mes siguiente"')}
                    ${command('today', 'Hoy', '', 'id="calendar-today" aria-label="Ir a la fecha de hoy"')}
                </div>
                <h3 class="sr-only" id="calendar-month-heading" aria-live="polite" aria-atomic="true">${escape(model.monthLabel)}</h3>
                <div class="calendar-view-options">
                    <div class="calendar-view-switch" role="group" aria-label="Vista del calendario">
                        ${['month', 'list'].map(view => `<button type="button" id="calendar-view-${view}" data-calendar-action="view" data-view="${view}" aria-pressed="${model.view === view}">${icon(view === 'month' ? 'calendar' : 'list')}<span>${view === 'month' ? 'Mes' : 'Lista'}</span></button>`).join('')}
                    </div>
                    <label class="calendar-filter-picker"><span class="sr-only">Filtrar lecturas</span><select id="calendar-filter" aria-label="Filtrar lecturas">${CALENDAR_FILTERS.map(filter => `<option value="${filter.id}"${model.filter === filter.id ? ' selected' : ''}>${escape(filter.label)}${model.historyUnavailable && filter.id === 'notes' ? '' : ` · ${model.counts[filter.id]}`}</option>`).join('')}</select>${icon('down')}</label>
                </div>
                <div class="calendar-content">${model.view === 'month' ? renderMonth(model) : renderAgenda(model)}</div>
            </div>
            ${emptyList ? '' : `<aside class="calendar-detail-region">${renderSelection(model)}</aside>`}
            <section class="calendar-month-progress" aria-label="Progreso de lectura del mes">
                    <div><span>${escape(progressLabel)}</span><strong>${model.due ? `${model.percentage}%` : ''}</strong></div>
                    ${model.due ? `<progress value="${model.completed}" max="${model.due}" aria-label="Lecturas completadas hasta hoy">${model.percentage}%</progress>` : ''}
                    <p>${model.pending} por leer${model.upcoming ? ` · ${model.upcoming} próximas` : ''}${model.meditations && !model.historyUnavailable ? ` · ${model.meditations} con meditación` : ''}</p>
            </section>
        </div>
        <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">${escape(model.selection ? `${model.selection.label}. ${model.selection.reference}. ${model.selection.statusLabel}` : 'Sin coincidencias para este filtro')}</div>
    </section>`;
}
