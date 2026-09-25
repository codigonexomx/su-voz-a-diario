import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('js/app.js','utf8');
const app={bibleChapterVoice:{status:'idle'},stopDailyReadingVoice(){},stopBibleChapterSpeechEngine(){},updateBibleChapterVoiceUI(){},trackAnalyticsEvent(){},showToast(){}};
for(const name of ['createBibleChapterVoiceToken','isBibleChapterVoiceTokenActive','invalidateBibleChapterVoiceToken','playBibleChapterVoiceSequence','startBibleChapterVoice','pauseBibleChapterVoice','resumeBibleChapterVoice','toggleBibleChapterVoice','stopBibleChapterVoice','getBibleChapterVoiceStatus']) {
 const start=source.indexOf(name+': ');assert(start>=0,name);
 const end=source.indexOf('\n},',start);
 app[name]=vm.runInNewContext('({'+source.slice(start,end+2)+'})',{console,Symbol})[name];
}
let spoken=[];let finish=[];
app.speakBibleChapterVerse=(verse,token)=>{spoken.push(verse.text);return new Promise(resolve=>{finish.push(()=>resolve(true));token.cancelWait=()=>resolve(false);});};
const verses=[{number:1,text:'A1'},{number:2,text:'A2'}];
app.toggleBibleChapterVoice('A',verses,'Capítulo A');
assert.equal(spoken.join(','),'A1');
const old=app.bibleChapterVoice.executionToken;
app.selectedBibleChapter=99; // visual movement must not mutate the audio identity
assert.equal(app.bibleChapterVoice.key,'A');
app.toggleBibleChapterVoice('A',verses);assert.equal(app.bibleChapterVoice.status,'paused');
assert.equal(app.isBibleChapterVoiceTokenActive(old),false);
app.toggleBibleChapterVoice('A',verses);assert.equal(app.bibleChapterVoice.status,'playing');
app.toggleBibleChapterVoice('B',[{number:1,text:'B1'}],'Capítulo B');
assert.equal(app.bibleChapterVoice.key,'B');
finish[0]();finish[1]();await new Promise(r=>setImmediate(r));
assert(!spoken.includes('A2'),'Cancelled chapter cannot continue from an old callback');
finish[2]();await new Promise(r=>setImmediate(r));
assert.equal(app.bibleChapterVoice.status,'idle','End of chapter stops; no unsolicited next chapter');
app.startBibleChapterVoice('A',verses);app.stopBibleChapterVoice();finish.at(-1)();await new Promise(r=>setImmediate(r));
assert.equal(app.bibleChapterVoice.status,'idle');assert(!spoken.includes('A2'));
console.log('OK: rapid play/pause/resume, chapter replacement, stale callbacks, scroll independence, end-of-chapter and stop');
