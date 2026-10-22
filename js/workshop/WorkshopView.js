import { WORKSHOP_LESSONS as lessons, WORKSHOP_PASSAGES as passages, WORKSHOP_SOURCES as sources,
    WORKSHOP_SUPPORT as support, WORKSHOP_CASE_HELP as caseHelp, WORKSHOP_GROUP_STEPS as groupSteps } from './WorkshopContent.js';
import { escapeHtml as esc } from '../utils/dom.js';
import { readingIcon as icon } from '../utils/readingIcons.js';
import { WORKSHOP_BIBLE_VERSION } from './WorkshopScripture.js';

export const ADVISOR_EMAIL = 'appsuvoz@gmail.com';
export const workshopHref = id => id ? `#workshop/${encodeURIComponent(id)}` : '#workshop';
const command = (label, action, attributes = '', primary = false) => `<button type="button" class="wt-button${primary ? ' wt-primary' : ''}" data-workshop-action="${action}" ${attributes}>${label}</button>`;
const route = (label, href, primary = false) => `<a class="wt-button${primary ? ' wt-primary' : ''}" href="${href}">${label}</a>`;
const origin = p => p.origin === 'complemento' ? 'Referencia complementaria incorporada por Su Voz.'
    : `Material base · Página${p.pages.includes(',') ? 's' : ''} ${p.pages}.${p.clarification ? ' Referencia precisada por contexto.' : ''}`;

export function advisorUrls(lesson = null) {
    const subject = 'Su Voz a Diario · Acompañamiento en meditación bíblica';
    const body = `Hola, equipo de Su Voz a Diario:\r\n\r\nMe gustaría recibir orientación para aprender a meditar la Palabra${lesson ? `, en la lección «${lesson.title}»` : ''}. ¿Cómo podríamos coordinar el acompañamiento?\r\n\r\nGracias.`;
    return { mail: `mailto:${ADVISOR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ADVISOR_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}

function advisor(lesson = null) {
    const urls = advisorUrls(lesson);
    return `<section class="wt-advisor" aria-labelledby="wt-advisor-title"><p class="wt-eyebrow">ACOMPAÑAMIENTO</p>
        <h3 id="wt-advisor-title">¿Quieres aprender con un asesor?</h3><p>Acompañamiento para aprender a meditar la Palabra, a solas o con tu grupo.</p>
        ${route(icon('chat') + 'Contactar a un asesor', esc(urls.mail))}
        <p class="wt-small"><a href="${esc(urls.gmail)}" target="_blank" rel="noopener noreferrer">Consultar por Gmail</a> · <a href="mailto:${ADVISOR_EMAIL}">${ADVISOR_EMAIL}</a></p></section>`;
}

function daily(today) {
    return `<section class="wt-daily" aria-label="Meditar el pasaje de hoy"><div><p class="wt-eyebrow">DE LA ENSEÑANZA A LA VIDA</p><h3>¿Quieres meditar hoy?</h3><p>Pasaje del día · Su Voz Hoy</p></div>
        ${route(icon('meditation') + 'Meditar hoy', `#reading/${today}?from=workshop`, true)}</section>`;
}

export function renderWorkshopScripture(id, bible) {
    const p = bible?.get(id);
    if (!p) return '<p class="wt-small" role="status">Consultando el pasaje NBLA…</p>';
    if (p.error || p.versionId !== WORKSHOP_BIBLE_VERSION) return `<p class="wt-small" role="status">No pudimos consultar este pasaje NBLA. Comprueba tu conexión; tu ejercicio se conserva.</p>${command(icon('refresh') + 'Reintentar pasaje', 'retry-bible')}`;
    return `<div class="wt-scripture">${p.verses.map(v => `<span><sup>${v.number}</sup>${esc(v.text)} </span>`).join('')}</div><p class="wt-small">Nueva Biblia de las Américas · NBLA</p>`;
}

const scripture = (id, bible) => `<div data-workshop-passage="${id}">${renderWorkshopScripture(id, bible)}</div>`;

function references(index, bible) {
    return `<section class="wt-basis" aria-labelledby="wt-basis-title"><h3 id="wt-basis-title">Sustento bíblico</h3>
        ${support[index].map(([id, meaning]) => `<details><summary>${passages[id].reference}<span>${meaning}</span></summary>
            ${scripture(id, bible)}</details>`).join('')}</section>`;
}

function example(index, state, ui, bible) {
    const l = lessons[index], id = state.passages[l.id] || sources[index][0], p = passages[id], step = state.stages[l.id] || 0;
    const help = caseHelp[id] || ['Identifica quién habla, qué sucede y qué se observa de Dios. Apoya tu observación en el texto.',
        'Relaciona las afirmaciones del pasaje con su destinatario y circunstancia antes de formular una enseñanza.',
        'Relaciona lo comprendido con tu respuesta ante Dios y una situación concreta, sin copiar mecánicamente todos los detalles del relato.'];
    const labels = ['Mi observación del pasaje', 'Lo que comprendo del pasaje', index === 5 ? 'Mi oración' : 'Mi aplicación a la vida'];
    return `<section class="wt-example" aria-label="Meditar un pasaje"><p class="wt-eyebrow">MEDITAR LA PALABRA</p>
        <label for="wt-example-select">Elegir un pasaje para meditar</label><select id="wt-example-select" data-workshop-select="example">
        ${sources[index].map(key => `<option value="${key}"${id === key ? ' selected' : ''}>${passages[key].reference}</option>`).join('')}</select>
        <details class="wt-passage" open><summary>Leer ${p.reference}</summary>${scripture(id, bible)}</details>
        <div class="wt-stages" role="group" aria-label="Meditación del pasaje">${['Observar', 'Comprender', 'Aplicar'].map((label, n) => command(label, 'stage', `data-stage="${n}" aria-pressed="${n === step}"`)).join('')}</div>
        <h3 class="wt-question">${['¿Qué ves en el pasaje?', '¿Qué comunica el pasaje?', '¿Cómo se relaciona con la vida?'][step]}</h3>
        <details><summary>Ver una orientación</summary><p>${help[step]}</p></details>
        <label for="wt-exercise">${labels[step]}</label><textarea id="wt-exercise" data-workshop-exercise data-passage="${id}" data-stage="${step}" rows="3" maxlength="2000" placeholder="${['Lo que observo y dónde lo encuentro…', 'La enseñanza que comprendo en este contexto…', 'Mi respuesta ante Dios y una aplicación concreta…'][step]}">${esc(state.drafts[l.id]?.[id]?.[step] || '')}</textarea>
        <p class="wt-small" data-workshop-save-status role="status">${ui.saveError ? 'No se pudo guardar este cambio. Conserva el texto antes de salir.' : 'Ejercicio privado · Guardado solo en este dispositivo.'}</p></section>`;
}

function checkpoint(index, state, ui) {
    const l = lessons[index], chosen = state.answers[l.id], checked = ui.checked[l.id];
    return `<section class="wt-checkpoint" aria-label="Reflexionar sobre lo aprendido"><p class="wt-eyebrow">PARA REFLEXIONAR</p><fieldset><legend>${l.quiz.question}</legend>
        ${l.quiz.options.map((option, n) => `<label class="wt-radio"><input type="radio" name="wt-answer" data-workshop-answer value="${n}"${chosen === n ? ' checked' : ''}><span>${option}</span></label>`).join('')}</fieldset>
        ${command(icon('search') + 'Revisar respuesta', 'check')}
        <p class="wt-feedback" role="status">${Number.isInteger(checked) ? `<strong>${checked === l.quiz.correct ? 'Bien observado.' : 'Volvamos al pasaje.'}</strong> ${l.quiz.feedback[checked]}` : ui.feedback || ''}</p>
        <p class="wt-small">Vuelve al pasaje y relaciona lo aprendido con tu vida.</p></section>`;
}

function lessonView(index, state, ui, bible) {
    const l = lessons[index], reviewed = state.reviewed.includes(l.id);
    const sourceIds = [...new Set([...sources[index], ...support[index].map(([id]) => id)])];
    return `<a class="wt-back" href="#workshop">${icon('back')}Las lecciones</a><p class="wt-eyebrow">${l.block} · LECCIÓN ${index + 1} DE ${lessons.length}</p><h2 id="wt-title">${l.title}</h2>
        <article class="wt-article">${l.text.map(p => `<p>${p}</p>`).join('')}</article>${references(index, bible)}
        <aside class="wt-reminder"><strong>Para recordar</strong><p>${l.key}</p></aside>
        <details class="wt-provenance"><summary>Fuentes de esta lección</summary><p>${l.basis}</p><p class="wt-small">${l.source}</p><p class="wt-small">Notas de edición: ${l.added}</p>
        ${sourceIds.map(id => `<p class="wt-small"><strong>${passages[id].reference}</strong> · ${origin(passages[id])}${passages[id].clarification ? ` ${passages[id].clarification}` : ''}</p>`).join('')}</details>
        ${example(index, state, ui, bible)}${checkpoint(index, state, ui)}
        ${index === 7 ? `<section class="wt-group" aria-label="Conversación en grupo"><p class="wt-eyebrow">COMPARTIR LO APRENDIDO</p><p class="wt-small">Momento ${ui.groupStep + 1} de 4</p><h3>${groupSteps[ui.groupStep].title}</h3><p>${groupSteps[ui.groupStep].text}</p><div class="wt-actions">${command(icon('previous') + 'Anterior', 'group', `data-step="${Math.max(0, ui.groupStep - 1)}"${ui.groupStep === 0 ? ' disabled' : ''}`)}${command(ui.groupStep === 3 ? 'Volver al inicio' : 'Siguiente' + icon('next'), 'group', `data-step="${ui.groupStep === 3 ? 0 : ui.groupStep + 1}"`)}</div></section>` : ''}
        <details><summary>Para quien acompaña</summary><p>${l.facilitator}</p></details>
        <div class="wt-actions">${command(icon('complete') + (reviewed ? 'Lección revisada' : 'He revisado esta lección'), 'complete', '', !reviewed)}${route('Meditar hoy' + icon('next'), `#reading/${ui.today}?from=workshop`)}</div>
        <nav class="wt-actions" aria-label="Lecciones">${index > 0 ? route(icon('previous') + 'Lección anterior', workshopHref(lessons[index - 1].id)) : '<span></span>'}${index < lessons.length - 1 ? route('Lección siguiente' + icon('next'), workshopHref(lessons[index + 1].id)) : route('Volver a las lecciones', '#workshop')}</nav>${advisor(l)}`;
}

function indexView(state, today) {
    const next = state.lastLesson || lessons[0].id;
    return `<div class="wt-overview"><div><p class="wt-eyebrow">MEDITACIÓN BÍBLICA</p><h2 id="wt-title">Un encuentro con la Palabra</h2><p>Encuentro, conocimiento, obediencia y gloria a Dios.</p></div>
        ${route((state.lastLesson ? 'Continuar aprendiendo' : 'Comenzar las lecciones') + icon('next'), workshopHref(next), true)}</div>
        <p class="wt-small">${state.reviewed.length} de 8 lecciones revisadas</p><div class="wt-meter" role="progressbar" aria-label="Lecciones revisadas" aria-valuenow="${state.reviewed.length}" aria-valuemin="0" aria-valuemax="8"><span style="width:${state.reviewed.length / 8 * 100}%"></span></div>
        <div class="wt-lessons">${lessons.map((l, i) => `${i === 0 || l.block !== lessons[i - 1].block ? `<h3>${l.block}</h3>` : ''}<a class="wt-lesson" href="${workshopHref(l.id)}"><span class="wt-number">${state.reviewed.includes(l.id) ? icon('complete') : String(i + 1).padStart(2, '0')}</span><span><strong>${l.title}</strong><span class="wt-small">${l.subtitle}</span></span>${icon('next')}</a>`).join('')}</div>
        <div class="wt-actions">${route(icon('read') + 'Biblioteca bíblica', '#workshop/biblioteca')}${route(icon('meditation') + 'Mis meditaciones', '#meditations-history')}</div>${daily(today)}${advisor()}`;
}

function libraryView(ui, bible) {
    const p = passages[ui.libraryId], groups = [...new Set(Object.values(passages).map(passage => passage.group))];
    return `<a class="wt-back" href="#workshop">${icon('back')}Las lecciones</a><p class="wt-eyebrow">SUSTENTO BÍBLICO</p><h2 id="wt-title">Pasajes para estudiar</h2>
        <label for="wt-library-select">Pasaje bíblico</label><select id="wt-library-select" data-workshop-select="library">${groups.map(group => `<optgroup label="${group === 'Complementos de Su Voz' ? 'Otros pasajes de apoyo' : group}">${Object.entries(passages).filter(([, value]) => value.group === group).map(([id, value]) => `<option value="${id}"${ui.libraryId === id ? ' selected' : ''}>${value.reference}</option>`).join('')}</optgroup>`).join('')}</select>
        ${scripture(ui.libraryId, bible)}<details class="wt-provenance"><summary>Fuente de esta referencia</summary><p class="wt-small">${origin(p)}</p>${p.clarification ? `<p>${p.clarification}</p>` : ''}</details>`;
}

export function renderWorkshop(state, ui, bible) {
    const index = lessons.findIndex(l => l.id === ui.page);
    const last = lessons.find(l => l.id === state.lastLesson) || lessons[0];
    const content = index >= 0 ? lessonView(index, state, ui, bible) : ui.page === 'biblioteca' ? libraryView(ui, bible)
        : ui.page === 'retomar' ? `<p class="wt-eyebrow">SEGUIR APRENDIENDO</p><h2 id="wt-title">${state.lastLesson ? 'Continúa donde te quedaste' : 'Un encuentro con la Palabra'}</h2><section class="wt-resume"><h3>${last.title}</h3><p>${last.subtitle}</p>${route('Volver a mi lección' + icon('next'), workshopHref(last.id), true)}<p class="wt-small">${state.reviewed.length} de 8 lecciones revisadas</p></section>${daily(ui.today)}${advisor()}`
            : indexView(state, ui.today);
    return `<section class="workshop-page" aria-labelledby="wt-title"><header class="wt-header"><div><p class="wt-tagline">Aprender a meditar</p><p class="wt-eyebrow">Vivir la Palabra</p></div></header>
        <nav class="wt-tabs" aria-label="Aprender a meditar"><a href="#workshop"${ui.page !== 'retomar' ? ' aria-current="page"' : ''}>Aprender</a><a href="#workshop/retomar"${ui.page === 'retomar' ? ' aria-current="page"' : ''}>Retomar</a></nav>
        ${ui.saveError ? '<p class="wt-warning" role="alert">No se pudo guardar el avance. Tus datos anteriores no se han reemplazado. Conserva los cambios antes de salir.</p>' : ''}
        <div class="wt-content">${content}</div><footer class="wt-footer"><p>Basado en «La Meditación Bíblica»</p><strong>Meditación Bíblica México</strong><p>Lee Jeong Book</p>
        <details><summary>Créditos y referencias</summary><p>Material base: <em>La Meditación Bíblica</em>, Lee Jeong Book. Edición para Su Voz a Diario.</p><p>Las referencias del material base indican la página de origen. Los pasajes complementarios incorporados por Su Voz se identifican por separado. La referencia incompleta «Pedro 1:15-16» se precisa editorialmente como 1 Pedro 1:15-16 por su relación con la santidad; no se presenta como una corrección confirmada por el autor.</p></details>
        <p>Escrituras tomadas de la Nueva Biblia de las Américas (NBLA), Copyright © 2005 por The Lockman Foundation. <a href="https://www.NuevaBiblia.com" target="_blank" rel="noopener noreferrer">www.NuevaBiblia.com</a>.</p>
        <p>Tu avance y tus ejercicios se guardan en este dispositivo y se incluyen en tu respaldo.</p></footer></section>`;
}
