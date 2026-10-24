import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { readingIcon } from '../js/utils/readingIcons.js';
import { DailyReadingNarrator } from '../js/reading/DailyReadingNarrator.js';

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, predicate) {
    if (predicate(node)) return node;
    for (const value of Object.values(node)) {
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child?.type) { const result = find(child, predicate); if (result) return result; }
        }
    }
}
const context = vm.createContext({ window: {}, document: {}, console, readingIcon, DailyReadingNarrator });
function method(name) {
    const node = find(tree, item => item.type === 'Property' && item.key.name === name);
    assert(node, name);
    return vm.runInContext(`(${source.slice(node.value.start, node.value.end)})`, context);
}
const events = [];
const sent = new Set();
const app = {
    trackAnalyticsOnce(key,name,params) { if (!sent.has(key)) { sent.add(key); events.push({name,params}); } },
    getReadingAnalyticsParams: method('getReadingAnalyticsParams'),
    trackMeditationCompleted: method('trackMeditationCompleted'),
    currentVersion: 'rvr60',
    currentView: 'home'
};
const completed = {id:'private-id-not-for-analytics',readingId:'2026-10-20',status:'completed',completedAt:123,
    notes:{oracion:'private prayer',dios:'private note'}};
app.trackMeditationCompleted({...completed,status:'draft'});
app.trackMeditationCompleted({...completed,completedAt:null});
assert.equal(events.length,0);
app.trackMeditationCompleted(completed,'journey');
app.trackMeditationCompleted(completed,'direct');
assert.equal(events.length,1);
assert.equal(events[0].params.reading_date,'2026-10-20');
assert.equal(events[0].params.entry_point,'journey');
assert(!JSON.stringify(events).includes('private'));
console.log('OK: real completion helper uses readingId, deduplicates and excludes private content/IDs');

const branch = find(tree, item => item.type === 'IfStatement' && item.test.name === 'completeSessionBtn');
assert(branch);
let legacySession={...completed,id:'legacy-fixture',status:'draft',completedAt:null};
let writes=0,practice=0,failSave=false;
context.MeditationSessionStorage={get:()=>({...legacySession}),save:value=>{
    if(failSave) throw Error('quota'); writes++; legacySession={...value};
}};
context.localStorage={};context.recordPractice=()=>practice++;
context.completeSessionBtn={getAttribute:()=> '2026-10-20',closest:()=>null};
const completeLegacy=vm.runInContext(`(async function(){${source.slice(branch.start,branch.end)}})`,context);
Object.assign(app,{currentMeditationSessionId:'legacy-fixture',attachMeditationMetadataSync:()=>{},
    invalidateMeditationLibraryCache:()=>{},updateStreakUI:()=>{},showToast:()=>{},rerenderCurrentReadingView:()=>{}});
await completeLegacy.call(app);
const completionTime=legacySession.completedAt;
await completeLegacy.call(app);
assert.equal(writes,1);assert.equal(practice,1);assert.equal(legacySession.completedAt,completionTime);
assert.equal(events.filter(event=>event.name==='deepen_complete').length,2);
legacySession={...legacySession,id:'failed-fixture',status:'draft',completedAt:null};
failSave=true;
await assert.rejects(completeLegacy.call(app),/quota/);
assert.equal(events.filter(event=>event.name==='deepen_complete').length,2,'No completion on failed persistence');
assert.equal(legacySession.status,'draft');
console.log('OK: actual legacy completion persists once, keeps its timestamp and never reports a failed save');

let focused=0,scrolled=0;
const target = {getAttribute:()=> '2026-10-20',focus:()=>focused++,scrollIntoView:()=>scrolled++};
app.$content={querySelectorAll:()=>[target]};
app.getReadingMetadataByDate=date=>({date,reference:'Pasaje de prueba',dailyQuestion:'Pregunta de prueba'});
app.stopIntroVideo=()=>{};
app.startReadingPassage=method('startReadingPassage');
app.startReadingPassage('2026-10-19');
assert.equal(focused,0);
app.startReadingPassage('2026-10-20');app.startReadingPassage('2026-10-20');
assert.equal(focused,2);assert.equal(scrolled,2);
assert.equal(events.filter(event=>event.name==='reading_start').length,1);
assert.equal(events.at(-1).params.interaction_source,'home');
assert.equal(completed.status,'completed','Opening the passage never changes stored progress');
console.log('OK: reading shortcut focuses the matching passage without marking it read');

const voiceEvents=[];
const voiceApp={
    stopBibleChapterVoice:()=>{},stopNativeTextToSpeech:()=>{},updateDailyReadingVoiceUI:()=>{},
    getReadingByDate:async date=>({date}),trackAnalyticsOnce:()=>{},
    getReadingAnalyticsParams:method('getReadingAnalyticsParams'),
    trackAnalyticsEvent:(name,params)=>voiceEvents.push({name,params}),currentVersion:'rvr60',
    isNativeTextToSpeechAvailable:()=>false,selectSpanishVoice:()=>null,showToast:()=>{},
    getDailyReadingVoiceQueue:(_,version,text)=>[{text,verseIndex:0}],bindDailyReadingFollow:()=>{}
};
context.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
let spoken;
context.window.speechSynthesis={getVoices:()=>[],speak:value=>{spoken=value;},pause:()=>{},resume:()=>{},cancel:()=>{}};
for(const name of ['stopDailyReadingVoice','getDailyReadingNarrator']) voiceApp[name]=method(name);
voiceApp.startDailyReadingVoice=method('startDailyReadingVoice');
await voiceApp.startDailyReadingVoice('2026-10-20','Texto de prueba');
assert.equal(voiceApp.dailyReadingVoice.status,'speaking');assert.equal(spoken.text,'Texto de prueba');
method('pauseOrResumeDailyReadingVoice').call(voiceApp,'2026-10-20','Texto de prueba');
assert.equal(voiceApp.dailyReadingVoice.status,'paused');
method('pauseOrResumeDailyReadingVoice').call(voiceApp,'2026-10-20','Texto de prueba');
assert.equal(voiceApp.dailyReadingVoice.status,'speaking');
spoken.onend();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(voiceApp.dailyReadingVoice.status,'idle');
assert.deepEqual(voiceEvents.map(event=>event.name),['audio_start','audio_complete']);
voiceApp.isNativeTextToSpeechAvailable=()=>true;
voiceApp.dailyReadingNarrator=null;
context.window.Capacitor={Plugins:{TextToSpeech:{stop:async()=>{},speak:async()=>{}}}};
await voiceApp.startDailyReadingVoice('2026-10-20','Texto nativo de prueba');
await new Promise(resolve=>setImmediate(resolve));
assert.equal(voiceEvents.at(-1).name,'audio_complete');
console.log('OK: existing web/native audio lifecycle, pause, resume and completion with isolated engines');

let observed, disconnected=0, callback;
const listeners=new Map();
const card={isConnected:true};
context.document={visibilityState:'visible',addEventListener:(type,fn)=>listeners.set(type,fn),
    removeEventListener:type=>listeners.delete(type)};
context.window.IntersectionObserver=class {
    constructor(fn,options){callback=fn;assert.equal(options.threshold,0.5);}
    observe(value){observed=value;} unobserve(){} disconnect(){disconnected++;}
};
app.$content.querySelector=()=>card;
app.stopDailyQuestionObservation=method('stopDailyQuestionObservation');
app.trackDailyQuestionVisible=method('trackDailyQuestionVisible');
app.trackDailyQuestionVisible({date:'2026-10-20'});
assert.equal(observed,card);
const entries=ratio=>[{target:card,isIntersecting:ratio>0,intersectionRatio:ratio}];
callback(entries(0));callback(entries(0.25));
assert(!events.some(event=>event.name==='daily_question_view'));
context.document.visibilityState='hidden';callback(entries(1));
assert(!events.some(event=>event.name==='daily_question_view'));
context.document.visibilityState='visible';listeners.get('visibilitychange')();
callback(entries(0.75));
assert.equal(events.filter(event=>event.name==='daily_question_view').length,1);
assert.equal(listeners.size,0);assert(disconnected>0);
app.trackDailyQuestionVisible({date:'2026-10-21'});
const stale=callback;
app.stopDailyQuestionObservation();stale(entries(1));
assert.equal(events.filter(event=>event.name==='daily_question_view').length,1);
delete context.window.IntersectionObserver;
app.trackDailyQuestionVisible({date:'2026-10-21'});
assert.equal(listeners.size,0);
console.log('OK: actual visibility observer ignores below-fold, hidden and stale views and cleans up');

const entry = method('renderDailyReadingEntry').call({escapeHtml:value=>value,
    renderDailyReadingBibleContext:()=>'<button data-action="open-daily-bible">Ver en Biblia</button>',
    renderDailyReadingVoiceControl:()=>'<div class="daily-reading-voice">audio</div>'},
    {date:'2026-10-20',reference:'Pasaje de prueba'});
assert(!entry.includes('data-action="read-passage"'));
assert(entry.includes('data-action="toggle-note"'), 'Meditation replaces the redundant reading shortcut');
assert(!method('renderDailyReadingActions').call({isRead:()=>false,escapeHtml:value=>value},
    {date:'2026-10-20',reference:'Pasaje de prueba'}).includes('Meditación'));
assert(!entry.includes('Profundizar'));
assert.equal((entry.match(/daily-reading-voice/g)||[]).length,1);
assert.equal((source.match(/this\.renderDailyReadingEntry\(reading\)/g)||[]).length,2,
    'Both today and historical readings expose the entry actions');
const homeStart = source.indexOf('renderHome: async function');
const homeEnd = source.indexOf('renderReading: async function',homeStart);
const home = source.slice(homeStart,homeEnd);
assert(!home.includes('${pergaminoHtml}'), 'The passive chapter block no longer occupies the bottom of the reading');
assert(!home.includes('this.renderDailyReadingVoiceControl(reading)'),'Only one live audio control per view');
console.log('OK: shared entry actions precede progress and preserve historical navigation');

context.shouldShowIntroVideo=()=>false;
context.getIntroVideoConfig=()=>null;
context.renderIntroVideoHtml=()=>'';
let viewingDate='2026-10-20';
const renderApp={
    $content:{innerHTML:''},data:[{},{}],
    getTodayDateStr:()=> '2026-10-20',getHomeViewingDate:()=>viewingDate,
    getReadingByDate:async date=>({date,reference:'Pasaje de prueba'}),
    stopDailyReadingVoice:()=>{},getProgresoLibroVisual:()=>'<div>Progreso conservado</div>',
    formatDateEs:date=>date,getDailyReadingText:()=> 'Texto de prueba',
    getReadingIndexByDate:()=>0,renderViewHeader:()=>'<header>Lectura del dia</header>',
    renderDailyVersionSelector:()=>'<div>Versiones</div>',
    renderReadingFontPicker:context=>`<fieldset data-font-picker="${context}">Fuentes</fieldset>`,
    renderDailyReadingVoiceControl:()=>'<button data-action="daily-reading-voice-toggle">Escuchar</button>',
    renderDailyReadingEntry:method('renderDailyReadingEntry'),
    renderDailyReadingBibleContext:()=>'<button data-action="open-daily-bible">Ver en Biblia</button>',
    renderDailyReadingActions:method('renderDailyReadingActions'),
    renderViewContent:method('renderViewContent'),
    escapeHtml:value=>value,renderVerseText:value=>value,renderDailyReadingCopyright:()=>'',
    isRead:()=>false,renderDailyQuestionCardHtml:()=>'',
    restoreHighlightsInDOMForVerses:()=>{},restoreSelectionNotesInDOM:()=>{},
    trackReadingVisible:()=>{},trackDailyQuestionVisible:()=>{}
};
for(const date of ['2026-10-20','2026-10-19']) {
    viewingDate=date;
    await method('renderHome').call(renderApp);
    assert.equal((renderApp.$content.innerHTML.match(/data-action="toggle-note"/g)||[]).length,1,
        `${date}: exactly one Meditation button in the full rendered view`);
    const html=renderApp.$content.innerHTML;
    assert.equal((html.match(/data-font-picker="daily"/g)||[]).length,1);
    assert(html.indexOf('Versiones') < html.indexOf('data-font-picker="daily"'));
    assert(html.indexOf('data-font-picker="daily"') < html.indexOf('class="reading-text-shell"'));
    for(const action of ['toggle-note','daily-reading-voice-toggle','mark-read','share-reading','open-reading-community-ecos']) {
        assert(renderApp.$content.innerHTML.includes(`data-action="${action}"`),`${date}: ${action} preserved`);
    }
    assert(!renderApp.$content.innerHTML.includes('Progreso conservado'));
    assert(renderApp.$content.innerHTML.includes('data-action="open-daily-bible"'));
}
console.log('OK: today/historical renderers have one Meditation button, visible fonts below versions and preserved reading actions');
