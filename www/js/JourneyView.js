import { MeditationSessionStorage } from './MeditationSessionStorage.js';
import { getJourney, loadJourney, saveReview, recordPractice, JOURNEY_KEY } from './services/JourneyService.js';
import { escapeHtml as esc } from './utils/dom.js';
const dateLabel = d => new Date(`${d}T12:00:00`).toLocaleDateString('es-MX',{day:'numeric',month:'long'});
const action = (label, kind, id='') => `<button type="button" class="journey-button" data-journey="${kind}" data-id="${esc(id)}">${label}</button>`;
const fragment = text => esc(String(text || '').slice(0,260));
const title = (app,s) => app.getReadingMetadataByDate(s.readingId)?.reference || s.metadata?.reference || s.title || 'Meditación personal';
export function renderJourney(app) {
    try {
        const j = getJourney(localStorage, new Date(), app.journeyMonth);
        app.journeyMonth = j.month;
        app.selectedStatsDate = app.selectedStatsDate?.startsWith(j.month) ? app.selectedStatsDate : `${j.month}-01`;
        if (j.month === j.today.slice(0,7) && !app.journeySelected) app.selectedStatsDate=j.today;
        const stats = app.getStats(j);
        const selected = j.allSessions.filter(s=>s.readingId===app.selectedStatsDate && s.status!=='archived');
        const current = j.continuation;
        const applications = j.sessions.filter(s=>String(s.notes.respuesta || '').trim());
        const application = applications.find(s=>s.id===app.journeyApplicationId) || j.application;
        app.journeyApplicationId=application?.id;
        app.journeyDrafts ||= {};
        const weeklyId=`week:${j.week[0].date}`;
        const weeklyText=app.journeyDrafts[weeklyId] ?? j.state.reviews[weeklyId]?.text ?? '';
        const review = application ? j.state.reviews[application.id] : null;
        const oldStreak = j.legacyStreak?.longest || 0;
        const oldCurrent = j.legacyStreak?.current || 0;
        app.$content.innerHTML = `${app.renderViewHeader('Mi camino','Recuerda la Palabra, continúa tu meditación y lleva lo aprendido a tu vida.')}
        <div class="journey-container">
          <section class="journey-hero"><span class="journey-kicker">HOY · ${esc(dateLabel(j.today))}</span><h3>${current ? 'Continúa tu meditación' : 'Un encuentro con la Palabra'}</h3>
            <p>${current ? esc(title(app,current)) : 'Empieza con la lectura de hoy. Tu camino puede continuar aquí.'}</p>
            ${current ? action('Continuar meditación','resume',current.id) : action('Meditar hoy','today')}
            ${current ? action('Marcar meditación como completada','complete',current.id) + action('Ir a la lectura de hoy','today') : ''}
          </section>
          <section class="journey-card journey-library-entry"><div><span class="journey-kicker">TU ESPACIO PERSONAL</span><h3>Mis meditaciones</h3><p>Vuelve a lo que has escrito al meditar.</p></div>${action('Abrir mis meditaciones','library')}</section>
          <section class="journey-card"><h3>Tu ritmo con la Palabra</h3><p><strong>${j.week.filter(d=>d.active).length} de los últimos 7 días</strong> con práctica registrada.</p>
          <div class="journey-week" aria-label="Últimos siete días">${j.week.map(d=>`<div class="${d.active?'is-active':''}"><span>${esc(new Date(d.date+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short'}))}</span><strong>${d.active?'✓':'—'}</strong><small>${Number(d.date.slice(-2))}</small></div>`).join('')}</div>
          ${!j.state.hideStreak ? `<p class="journey-streak">Racha actual: <strong>${j.current} ${j.current===1?'día':'días'}</strong> · Mejor racha registrada: ${j.longest}</p>`:''}
          ${action(j.state.hideStreak?'Mostrar racha':'Ocultar racha','toggle-streak')}
          ${oldStreak || oldCurrent ? '<p>Tu racha anterior se conserva en el historial explicado a continuación.</p>' : ''}
          <details><summary>¿Qué cuenta y qué se conserva?</summary><p>Cuenta el día en que marcas una lectura como leída o completas una meditación. Varias acciones en un día cuentan una vez. Abrir la aplicación o guardar un borrador no aumenta la racha. Hoy pendiente conserva el tramo de ayer hasta terminar el día.</p><p>Este registro empieza con Mi camino. Las lecturas antiguas siguen en tu recorrido; su fecha asignada no demuestra cuándo las leíste.${oldStreak || oldCurrent ? ` Registro heredado de lectura: racha de ${oldCurrent} días y mejor racha de ${oldStreak} días, calculadas por el sistema anterior.` : ''} Una pausa no borra tus meditaciones.</p></details>
          </section>
          <section class="journey-card" id="journey-application-section"><span class="journey-kicker">APLICACIÓN PERSONAL</span><h3>Lo que quiero vivir</h3>
          ${application ? `${applications.length>1 ? `<label for="journey-application">Paso que quiero revisar</label><select id="journey-application">${applications.map(s=>`<option value="${esc(s.id)}" ${s.id===application.id?'selected':''}>${esc(title(app,s))} · ${esc(s.readingId)}</option>`).join('')}</select>${action('Elegir paso','application')}` : ''}<p class="journey-passage">${esc(title(app,application))}</p><blockquote>${fragment(application.notes.respuesta)}</blockquote><p>¿Cómo lo has llevado a tu vida? Puedes reconocer avances, dificultades o algo que aún necesitas meditar.</p><label for="journey-review">Mi revisión personal</label><textarea id="journey-review" maxlength="4000" rows="4" placeholder="Escribe aquí, solo para ti…">${esc(app.journeyDrafts[application.id] ?? review?.text ?? '')}</textarea>${action('Guardar mi revisión','review',application.id)} ${action('Volver a esta meditación','open',application.id)}<p id="journey-save-status" role="status">${review?'Revisión guardada en este dispositivo.':'Esta revisión es privada y no se publica.'}</p>` : `<p>Cuando escribas en Aplicación dentro de Profundiza, podrás volver aquí para recordar ese paso y revisar cómo te fue.</p>${action('Abrir la lectura de hoy','today')}`}
          </section>
          <details class="journey-card"><summary>Una pausa para revisar mi semana</summary><p>Del ${esc(dateLabel(j.week[0].date))} al ${esc(dateLabel(j.today))}. ¿Qué Palabra quiero recordar? ¿Qué paso quiero seguir viviendo?</p><label for="journey-weekly">Mi reflexión de estos siete días</label><textarea id="journey-weekly" rows="4" maxlength="4000">${esc(weeklyText)}</textarea>${action('Guardar revisión semanal','weekly',weeklyId)}<p id="journey-weekly-status" role="status">Solo para ti. Tus revisiones anteriores se conservan en el respaldo.</p>${Object.entries(j.state.reviews).filter(([id])=>id.startsWith('week:')&&id!==weeklyId).sort(([a],[b])=>b.localeCompare(a)).map(([id,r])=>`<details><summary>Semana desde ${esc(dateLabel(id.slice(5)))}</summary><p class="journey-preserve">${esc(r.text)}</p></details>`).join('')}</details>
          <section class="journey-card"><h3>Palabra para recordar</h3><p>Tus meditaciones favoritas y recientes, sin calificar tu crecimiento espiritual.</p>
          ${j.memories.length ? j.memories.map(s=>`<article class="journey-memory"><span>${esc(s.readingId)} · ${s.favorite?'Favorita · ':''}${s.status==='completed'?'Meditación completada':s.legacy?'Recuerdo anterior':'En proceso'}</span><h4>${esc(title(app,s))}</h4><p>${fragment(s.notes.dios || s.notes.aprendizaje || s.notes.respuesta || s.notes.oracion)}</p>${action('Abrir meditación','open',s.id)}</article>`).join('') : '<p>Aquí aparecerá lo que guardes al meditar. No necesitas escribir mucho para comenzar.</p>'}
          ${action('Ver mis meditaciones','library')}</section>
          <details class="journey-card journey-history"><summary>Tu recorrido y calendario</summary>
          <div class="journey-month"><label for="journey-month">Mes del recorrido</label><input type="month" id="journey-month" value="${esc(j.month)}" max="${j.today.slice(0,7)}">${action('Ver mes','month')}</div>
          <p>${j.monthPractice} días de práctica registrados en este mes. ${j.monthReflections} ${j.monthReflections===1?'día':'días'} con reflexión guardada para los pasajes de este mes y ${j.monthPrayers} con oración escrita. No escribir una oración no significa que no hayas orado.</p>
          ${app.renderStatsCalendar(stats)}
          ${selected.length ? `<div class="journey-day-sessions"><h4>Meditaciones de este pasaje</h4>${selected.map(s=>action(esc(title(app,s)),'open',s.id)).join('')}</div>`:''}
          <p>${j.readDates.length} lecturas marcadas en tu historial. ${stats.plan.completed} pertenecen al catálogo disponible (${stats.plan.total} lecturas). El catálogo puede crecer sin borrar tu recorrido.</p>
          </details>
          <section class="journey-card"><h3>Comparte para edificar</h3><p>Elige una enseñanza y prepara solo el texto que deseas compartir. Tus oraciones y revisiones personales no se incluyen.</p>${j.sessions.length ? `<label for="journey-share-session">Meditación de origen</label><select id="journey-share-session">${j.sessions.map(s=>`<option value="${esc(s.id)}">${esc(title(app,s))} · ${esc(s.readingId)}</option>`).join('')}</select>${action('Preparar extracto','excerpt')}<div id="journey-share-editor"></div>` : action('Abrir la lectura de hoy','today')}</section>
          <footer class="journey-footer"><p>Tu camino se guarda en este dispositivo. No se sincroniza automáticamente con otros navegadores o teléfonos.</p>${action('Guardar respaldo completo','backup')}<p>Sin puntuaciones de fe, oración u obediencia.</p></footer>
        </div>`;
        if (app.journeyFocusApplication) {
            app.journeyFocusApplication = false;
            requestAnimationFrame(() => { document.getElementById('journey-application-section')?.scrollIntoView({block:'start'}); document.getElementById('journey-review')?.focus({preventScroll:true}); });
        }
        for (const [selector,id] of [['#journey-review',application?.id],['#journey-weekly',weeklyId]]) {
            const input=app.$content.querySelector(selector);
            if(input) input.addEventListener('input',()=>{app.journeyDrafts[id]=input.value;});
        }
    } catch(error) {
        console.error('[Mi camino]',error);
        app.$content.innerHTML=`${app.renderViewHeader('Mi camino','Tus datos se conservan.')}<section class="journey-card"><h3>No pudimos leer tu historial</h3><p>No se ha borrado ni reemplazado ningún registro. Guarda un respaldo antes de intentar recuperar tus datos.</p>${action('Exportar respaldo','backup')}${action('Volver a intentar','retry')}</section>`;
    }
}
export async function handleJourney(app, element) {
    const kind=element.dataset.journey, id=element.dataset.id;
    if (kind==='backup') {app.exportData();return;}
    if (kind==='today') {app.navigate('reading',app.getTodayDateStr());return;}
    if (kind==='library') {app.navigate('meditations-history');return;}
    if (kind==='open' || kind==='resume') {
        if(id.startsWith('legacy:')) {app.currentMeditationSessionId=null;app.openNoteDate=id.slice(7);app.navigate('reading',id.slice(7));}
        else if(kind==='resume') await app.openMeditationLibraryEditor(id);
        else app.navigate('meditations-history',id);
        return;
    }
    if(kind==='complete') {
        const session=MeditationSessionStorage.get(id);
        if(!session || session.status!=='draft') return;
        session.status='completed';session.completedAt=Date.now();session.updatedAt=session.completedAt;
        MeditationSessionStorage.save(session);app.invalidateMeditationLibraryCache();
        try {recordPractice(localStorage,'meditation',session.readingId,session.id);} catch(error) {app.showToast('Meditación guardada; no se pudo registrar la constancia.');}
        app.renderStats();return;
    }
    if(kind==='excerpt') {
        const selected=document.getElementById('journey-share-session').value;
        const session=getJourney(localStorage).sessions.find(s=>s.id===selected);
        if(!session) throw new Error('No se encontró la meditación.');
        app.journeyShareSession=session;
        document.getElementById('journey-share-editor').innerHTML=`<label for="journey-excerpt">Texto que deseas llevar a Comunidad</label><textarea id="journey-excerpt" rows="5" maxlength="1200">${esc(String(session.notes.aprendizaje || session.notes.dios || '').slice(0,1200))}</textarea><p>Puedes editarlo o escribir otro extracto. El siguiente paso abre un borrador; todavía no lo publica.</p>${action('Revisar en Comunidad','share')}`;
        document.getElementById('journey-excerpt').focus();return;
    }
    if(kind==='share') {
        const text=document.getElementById('journey-excerpt').value.trim();
        if(!text) throw new Error('Escribe el extracto que quieres compartir.');
        if(app.hasCommunityDraftContent(app.loadCommunityDraftState())) {
            app.showToast('Ya tienes un borrador en Comunidad. Consérvalo o descártalo allí antes de preparar otro.');return;
        }
        const session=app.journeyShareSession;
        app.updateCommunityDraftState({text,formOpen:true,intent:'reflection',readingDate:session.readingId,reference:title(app,session)},{immediate:true});
        app.communityFormOpen=true;app.navigate('community');return;
    }
    if(kind==='weekly') {saveReview(localStorage,id,document.getElementById('journey-weekly').value);delete app.journeyDrafts[id];document.getElementById('journey-weekly-status').textContent='Revisión semanal guardada en este dispositivo.';return;}
    if(kind==='application') app.journeyApplicationId=document.getElementById('journey-application').value;
    if(kind==='review') {saveReview(localStorage,id,document.getElementById('journey-review').value);delete app.journeyDrafts[id];document.getElementById('journey-save-status').textContent='Revisión guardada en este dispositivo.';return;}
    if(kind==='toggle-streak') {const state=loadJourney(localStorage);state.hideStreak=!state.hideStreak;localStorage.setItem(JOURNEY_KEY,JSON.stringify(state));}
    if(kind==='month') {const value=document.getElementById('journey-month').value;if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value>app.getTodayDateStr().slice(0,7)) throw new Error('Elige un mes válido hasta el actual.');app.journeyMonth=value;app.journeySelected=false;}
    app.renderStats();
    if(kind==='month') app.$content.querySelector('.journey-history').open=true;
}
