import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { canAccessRemoteBibleVersions, getInternalBibleTestVersion, parseBibleReadingKey } from '../js/bible/bibleInternalTest.js';
const source = fs.readFileSync('js/app.js','utf8');
const app = { bibleSearchBook:'', bibleSearchFilter:'all', bibleSearchPageSize:20, bibleSearchPage:1 };
function attach(name, extras={}) {
 const start=source.indexOf(name+': function'); assert(start>=0,name);
 const end=source.indexOf('\n},',start);
 app[name]=vm.runInNewContext('({'+source.slice(start,end+2)+'})', {console,parseBibleReadingKey, canAccessRemoteBibleVersions,...extras})[name];
}
for(const name of ['normalizeBibleWord','tokenizeBibleText','buildLocalBibleSearchIndex','matchesBibleFilter','searchLocalBible','applyBibleSearchPagination','getBibleReaderVersions']) attach(name);
app.bibleSearchData = [
 {id:'a',bookId:'gen',testament:'old',bookOrder:1,chapter:1,verse:1,text:'No temas, confía en Dios.'},
 {id:'b',bookId:'jhn',testament:'new',bookOrder:43,chapter:1,verse:1,text:'No estás solo; no temas.'},
 {id:'c',bookId:'jhn',testament:'new',bookOrder:43,chapter:1,verse:2,text:'Temas no relacionados.'}
];
app.buildLocalBibleSearchIndex();
assert.equal(app.searchLocalBible('no temas').length,3);
assert.equal(app.searchLocalBible('"no temas"').length,2);
assert.equal(app.searchLocalBible('“no temas”').length,2);
assert.equal(app.searchLocalBible('CONFIA').length,1);
app.bibleSearchBook='jhn';assert.equal(app.searchLocalBible('"no temas"').length,1);
app.bibleSearchBook='';assert.equal(app.searchLocalBible('"no temas"','old').length,1);
assert.equal(app.searchLocalBible('palabrainexistente').length,0);
app.applyBibleSearchPagination(app.searchLocalBible('no temas'));assert.equal(app.bibleSearchTotal,3);
assert.equal(canAccessRemoteBibleVersions({}),false);
assert.equal(getInternalBibleTestVersion({__bibleTestVersion:'nbla'}),null);
assert.equal(getInternalBibleTestVersion({__bibleInternalPreview:true,__bibleTestVersion:'nbla'}),'nbla');
assert.deepEqual(Array.from(app.getBibleReaderVersions(),v=>v.id),['rv1909']);
const records={
 'su-voz-selection-notes-bible-jhn-3':[{text:'Dios amó al mundo',note:'Reflexión local'}],
 'su-voz-selection-notes-bible-nvi-jhn-3':[{text:'Dios amó al mundo',note:'Otra edición'}]
};
const keys=Object.keys(records);
app.bibleBooks=[{id:'jhn',name:'Juan',chapters:21}];
app.getSelectionNotes=date=>records['su-voz-selection-notes-'+date]||[];
app.getHighlights=()=>[];
attach('parseBibleMemoryDate');attach('getBibleMemoryItems',{localStorage:{length:keys.length,key:i=>keys[i]}});
const memory=app.getBibleMemoryItems();assert.equal(memory.length,2);
assert.deepEqual(new Set(memory.map(item=>item.versionId)),new Set(['rv1909','nvi']));
app.bibleApiIdMap={JHN:'jhn'};app.currentView='bible-search';app.saveBibleLastLocation=()=>{};app.navigate=view=>app.currentView=view;
attach('navigateToVerse',{window:{scrollY:320}});
app.navigateToVerse('JHN',3,16);
assert.equal(app.bibleStudyReturn.view,'bible-search');assert.equal(app.bibleStudyReturn.scrollY,320);assert.equal(app.targetVerse,16);
assert.equal(app.currentView,'bible-reading');
assert(!fs.readFileSync('index.html','utf8').includes('open-strong-dictionary'));
console.log('OK: phrase order, smart quotes, accents, book/testament filters, empty results, pagination, public catalog, isolated preview, version-specific notes and search return.');
const sessions = new Map([['draft',{id:'draft',readingId:'2026-09-24',status:'draft',notes:{aprendizaje:'Mi enseñanza anterior',oracion:'Oración privada'},references:{}}],['complete',{id:'complete',readingId:'2026-09-24',status:'completed',notes:{aprendizaje:'Meditación terminada'}}]]);
const fakeStorage = {getAllMetadata:()=>Array.from(sessions.values()),get:id=>structuredClone(sessions.get(id)),save:session=>sessions.set(session.id,structuredClone(session))};
const start = source.indexOf('meditateOnSelectedPassage: async function'); const end = source.indexOf('\n},',start);
app.meditateOnSelectedPassage = vm.runInNewContext('({'+source.slice(start,end+2)+'})',{console,parseBibleReadingKey,MeditationSessionStorage:fakeStorage}) .meditateOnSelectedPassage;
Object.assign(app,{currentSelectedText:'No temas.',currentSelectionDate:'bible-isa-41',currentVersion:'ntv',getTodayDateStr:()=> '2026-09-24',getBibleSelectionReferenceLabel:()=> 'Isaías 41:10',getBibleVersionLabel:v=>v,getReadingByDate:async()=>({date:'2026-09-24'}),attachMeditationMetadataSync(){},invalidateMeditationLibraryCache(){},hideSelectionPanel(){},stopBibleChapterVoice(){},openMeditationLibraryEditor:async(id,field)=>{app.openedEditor={id,field};},showToast(){}});
await Promise.all([app.meditateOnSelectedPassage(),app.meditateOnSelectedPassage()]);
await app.meditateOnSelectedPassage();
assert.equal(sessions.size,2);
assert.equal(sessions.get('draft').notes.aprendizaje.split('Isaías 41:10').length,2);
assert(sessions.get('draft').notes.aprendizaje.startsWith('Mi enseñanza anterior'));
assert.equal(sessions.get('draft').notes.oracion,'Oración privada');
assert.equal(sessions.get('complete').notes.aprendizaje,'Meditación terminada');
assert.equal(app.openedEditor.field,'aprendizaje');
app.getReadingByDate=async()=>null;
const before=JSON.stringify(Array.from(sessions.values()));await app.meditateOnSelectedPassage();assert.equal(JSON.stringify(Array.from(sessions.values())),before);
assert.equal(app._addingBibleMeditation,false);
const bible=JSON.parse(fs.readFileSync('data/rv1909.json','utf8').replace(/^\uFEFF/,''));
assert.equal(bible.length,66);
assert(!JSON.stringify(bible).includes('fakporque'));
console.log('OK: passage → daily draft, double tap deduplication, preservation of notes/prayer/completed sessions, missing reading without writes, verified Isaiah correction.');
import { escapeBibleHtml } from '../js/utils/text.js';
app.escapeHtml=escapeBibleHtml; app.currentBibleVersion='rv1909';app.bibleSearchQuery='"no temas"';app.renderBibleSearchResults=()=>'';
attach('renderBibleSearch',{escapeBibleHtml});
assert(app.renderBibleSearch().includes('value="&quot;no temas&quot;"'));
app.getHighlightColorLabel=()=>'';attach('renderBibleMemoryCard',{escapeBibleHtml});
const card=app.renderBibleMemoryCard({id:'bible-jhn-3::"quoted"',colors:[],reference:'Juan 3',versionId:'rv1909',bookId:'jhn',chapter:3,text:'quoted'});
assert(card.includes('data-memory-id="bible-jhn-3::&quot;quoted&quot;"'));
console.log('OK: straight quotes survive search return and quoted note identities remain intact.');
