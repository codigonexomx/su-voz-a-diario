import assert from 'node:assert/strict';
import { getJourney, recordPractice, saveReview, exportJourney, restoreJourney, validateJourneyBackup, JOURNEY_KEY, validDay } from '../js/services/JourneyService.js';
class Storage {
 constructor(){this.data=new Map();this.fail='';}
 get length(){return this.data.size;} key(i){return [...this.data.keys()][i];}
 getItem(k){return this.data.get(k)??null;} removeItem(k){this.data.delete(k);}
 setItem(k,v){if(this.fail===k){this.fail='';throw Error('quota');}this.data.set(k,String(v));}
}
let cases=0;const test=(name,fn)=>{fn();cases++;console.log('OK',name);};
const day=s=>new Date(`${s}T12:00:00`), set=(s,k,v)=>s.setItem(k,JSON.stringify(v));
const session=(id,date='2026-09-23')=>({id,readingId:date,status:'draft',notes:{respuesta:'Escuchar antes de responder',oracion:'Ayúdame a escuchar'},updatedAt:5,references:{application:[{text:'Referencia'}]},favorite:true});
test('Días reales, años bisiestos y fechas inválidas',()=>{assert(validDay('2024-02-29'));assert(!validDay('2026-02-29'));assert(!validDay('2026-13-01'));});
test('Historial antiguo no fabrica práctica',()=>{const s=new Storage();set(s,'su-voz-read-dates',['2026-09-23']);set(s,'su-voz-streak',{current:20,longest:40});const j=getJourney(s,day('2026-09-24'));assert.equal(j.current,0);assert.equal(j.readDates.length,1);assert.equal(j.legacyStreak.longest,40);});
test('Atrasadas, duplicados y varias acciones: un día real',()=>{const s=new Storage();recordPractice(s,'reading','2026-04-07','',day('2026-09-23'));recordPractice(s,'reading','2026-04-07','',day('2026-09-23'));recordPractice(s,'meditation','2026-08-01','a',day('2026-09-23'));let j=getJourney(s,day('2026-09-24'));assert.equal(j.current,1);assert.equal(j.state.events.length,2);assert.equal(j.week.filter(d=>d.active).length,1);assert.equal(getJourney(s,day('2026-09-25')).current,0);assert.equal(getJourney(s,day('2026-09-25')).longest,1);});
test('Cambio de año y continuidad',()=>{const s=new Storage();for(const date of ['2025-12-31','2026-01-01'])recordPractice(s,'reading',date,'',day(date));assert.equal(getJourney(s,day('2026-01-02')).current,2);});
test('Fechas futuras no inflan la racha',()=>{const s=new Storage();recordPractice(s,'reading','2026-09-25','',day('2026-09-24'));assert.equal(getJourney(s,day('2026-09-24')).current,0);});
test('Sesiones múltiples, archivo, favoritos y espejo legacy',()=>{const s=new Storage();set(s,'su-voz-meditation-a',session('a'));set(s,'su-voz-meditation-b',{...session('b'),favorite:false,updatedAt:10});set(s,'su-voz-meditation-c',{...session('c'),status:'archived'});set(s,'su-voz-note-2026-09-23',{respuesta:'Espejo'});let j=getJourney(s,day('2026-09-24'));assert.equal(j.sessions.length,2);assert.equal(j.monthReflections,1);assert.equal(j.memories[0].id,'a');assert.equal(j.continuation.id,'b');});
test('Meses separados y contenido fuera del catálogo',()=>{const s=new Storage();set(s,'su-voz-meditation-a',session('a','2026-08-02'));assert.equal(getJourney(s,day('2026-09-24')).monthPrayers,0);assert.equal(getJourney(s,day('2026-09-24'),'2026-08').monthPrayers,1);assert.equal(getJourney(s,day('2026-09-24')).memories.length,1);});
test('Revisión privada persistente',()=>{const s=new Storage();saveReview(s,'a','Lo intenté hoy.',day('2026-09-24'));assert.equal(getJourney(s).state.reviews.a.text,'Lo intenté hoy.');assert.throws(()=>saveReview(s,'a','  '));});
test('Respaldo completo sin credenciales y restauración idempotente',()=>{const s=new Storage();set(s,'su-voz-meditation-a',session('a'));set(s,'su-voz-meditation-uistate-a',{pinnedReferences:{x:true}});set(s,'su-voz-devotional-refs-2026-09-23',{x:[]});set(s,'auth-secret','private');recordPractice(s,'meditation','2026-09-23','a',day('2026-09-23'));saveReview(s,'a','Una revisión');const backup=exportJourney(s);assert(!backup.entries['auth-secret']);const dest=new Storage();restoreJourney(dest,backup);restoreJourney(dest,backup);assert.equal(getJourney(dest).state.events.length,1);assert.deepEqual(JSON.parse(dest.getItem('su-voz-meditation-a')),session('a'));assert.equal(JSON.parse(dest.getItem('su-voz-meditation-index')).length,1);assert(dest.getItem('su-voz-meditation-uistate-a'));assert.equal(getJourney(dest).state.reviews.a.text,'Una revisión');});
test('Importar no reemplaza una sesión más reciente',()=>{const src=new Storage(),dest=new Storage();set(src,'su-voz-meditation-a',session('a'));set(dest,'su-voz-meditation-a',{...session('a'),updatedAt:20,notes:{respuesta:'Nueva'}});restoreJourney(dest,exportJourney(src));assert.equal(JSON.parse(dest.getItem('su-voz-meditation-a')).notes.respuesta,'Nueva');});
test('Respaldo malicioso o corrupto no se escribe',()=>{const s=new Storage();assert.throws(()=>restoreJourney(s,{version:1,entries:{'auth-secret':'"x"'}}));assert.equal(s.length,0);assert.throws(()=>validateJourneyBackup({version:1,entries:{'su-voz-meditation-a':'{}'}}));});
test('Fallo de escritura revierte cambios',()=>{const src=new Storage(),dest=new Storage();set(src,'su-voz-meditation-a',session('a'));set(dest,'su-voz-read-dates',['2026-09-20']);const before=exportJourney(dest);dest.fail='su-voz-meditation-index';assert.throws(()=>restoreJourney(dest,exportJourney(src)));assert.deepEqual(exportJourney(dest),before);});
test('Corrupción visible, sin reemplazo silencioso',()=>{const s=new Storage();s.setItem(JOURNEY_KEY,'broken');assert.throws(()=>getJourney(s));assert.equal(s.getItem(JOURNEY_KEY),'broken');});


test('Medianoche y cambio de horario mantienen días locales',()=>{const s=new Storage();recordPractice(s,'reading','2026-03-27','',new Date(2026,2,28,23,59));recordPractice(s,'meditation','2026-03-27','a',new Date(2026,2,29,0,1));assert.equal(getJourney(s,new Date(2026,2,29,12)).current,2);assert.deepEqual(getJourney(s,new Date(2026,2,29,12)).days,['2026-03-28','2026-03-29']);});
test('Respaldo incluye estado del cuadernillo antiguo',()=>{const s=new Storage();set(s,'su-voz-devotional-uistate-2026-09-23',{section:'application'});const d=new Storage();restoreJourney(d,exportJourney(s));assert.equal(d.getItem('su-voz-devotional-uistate-2026-09-23'),s.getItem('su-voz-devotional-uistate-2026-09-23'));});
test('Eventos incompletos se rechazan antes de importar',()=>{const s=new Storage();assert.throws(()=>restoreJourney(s,{version:1,entries:{[JOURNEY_KEY]:JSON.stringify({version:1,events:[null],reviews:{}})}}));assert.equal(s.length,0);});
const {legacyJourneyBackup}=await import('../js/services/JourneyService.js');
test('Respaldo anterior conserva sesiones y une lecturas',()=>{const s=new Storage();set(s,'su-voz-meditation-a',session('a'));set(s,'su-voz-read-dates',['2026-09-23']);restoreJourney(s,legacyJourneyBackup({readDates:['2026-09-22'],notes:{'2026-09-22':{dios:'Nota anterior'}}}));assert(s.getItem('su-voz-meditation-a'));assert.equal(getJourney(s).readDates.length,2);assert.throws(()=>legacyJourneyBackup({notes:[]}));});
const {handleJourney}=await import('../js/JourneyView.js');
const isolated=new Storage();globalThis.localStorage=isolated;
let navigation=[],updates=[],messages=[];
globalThis.document={getElementById:()=>({value:'Solo este extracto'})};
const app={journeyShareSession:session('a'),getReadingMetadataByDate:()=>({reference:'1 Samuel 14'}),loadCommunityDraftState:()=>({text:'Borrador anterior'}),hasCommunityDraftContent:d=>!!d.text,showToast:m=>messages.push(m),updateCommunityDraftState:u=>updates.push(u),navigate:(...args)=>navigation.push(args)};
await handleJourney(app,{dataset:{journey:'share'}});assert.equal(updates.length,0);assert.equal(navigation.length,0);assert.equal(messages.length,1);
app.loadCommunityDraftState=()=>({text:''});await handleJourney(app,{dataset:{journey:'share'}});assert.equal(updates[0].text,'Solo este extracto');assert(!JSON.stringify(updates).includes('Ayúdame'));assert.deepEqual(navigation,[['community']]);console.log('OK Compartir solo prepara borrador y conserva el anterior');


set(isolated,'su-voz-meditation-a',session('a'));
app.invalidateMeditationLibraryCache=()=>{};app.renderStats=()=>{};
await handleJourney(app,{dataset:{journey:'complete',id:'a'}});
await handleJourney(app,{dataset:{journey:'complete',id:'a'}});
assert.equal(getJourney(isolated).state.events.length,1);
assert.equal(JSON.parse(isolated.getItem('su-voz-meditation-a')).status,'completed');
console.log(`OK Finalización repetida sin duplicados. ${cases} casos de servicio + 2 flujos de integración. TZ=${process.env.TZ||'sistema'}`);
