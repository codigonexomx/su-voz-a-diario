import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { READING_FONTS, DEFAULT_SETTINGS } from '../js/core/defaults.js';
import { readingIcon } from '../js/utils/readingIcons.js';

const source=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const tree=parse(source,{ecmaVersion:'latest',sourceType:'module'});
function find(node,name) {
    if(node.type==='Property' && node.key.name===name) return node;
    for(const value of Object.values(node)) for(const child of Array.isArray(value)?value:[value]) {
        if(child?.type) {const result=find(child,name);if(result)return result;}
    }
}
const styles=new Map(),saved=new Map(),messages=[];
const inputs=Array.from({length:2},()=>READING_FONTS.map(font=>({value:font.id,checked:false}))).flat();
const host={innerHTML:''};
const document={documentElement:{style:{setProperty:(key,value)=>styles.set(key,value)}},
    querySelectorAll:()=>inputs,getElementById:()=>host};
const context=vm.createContext({READING_FONTS,DEFAULT_SETTINGS,readingIcon,document,console,
    window:{speechSynthesis:{}},SpeechSynthesisUtterance:class{}});
function method(name) {
    const node=find(tree,name);assert(node,name);
    return vm.runInContext(`(${source.slice(node.value.start,node.value.end)})`,context);
}
let fail=false;
const app={settings:{...DEFAULT_SETTINGS},storage:{set:(key,value)=>{
    if(fail)return false;saved.set(key,JSON.stringify(value));return true;
}},showToast:value=>messages.push(value)};
for(const name of ['applyReadingFont','loadReadingFont','setReadingFont','renderReadingFontPicker']) app[name]=method(name);
app.loadReadingFont();
assert.equal(app.settings.readingFont,'merriweather');
assert.equal((host.innerHTML.match(/type="radio"/g)||[]).length,3);
assert.equal((host.innerHTML.match(/ checked/g)||[]).length,1);
for(const font of READING_FONTS) {
    assert(app.setReadingFont(font.id));
    assert.equal(styles.get('--font-reading-content'),font.family);
    assert.equal(styles.get('--reading-font-scale'),String(font.scale));
    assert.equal(inputs.filter(input=>input.checked).length,2,'Header and settings stay in sync');
    assert.equal(JSON.parse(saved.get('su-voz-settings')).readingFont,font.id);
    assert.equal(app.settings.fontSize,DEFAULT_SETTINGS.fontSize,'Font choice preserves size and other preferences');
    assert(existsSync(new URL(`../assets/fonts/${font.id==='cormorant'?'cormorant-garamond':font.id}-normal-400.ttf`,import.meta.url)));
}
app.settings=JSON.parse(saved.get('su-voz-settings'));app.loadReadingFont();
assert.equal(app.settings.readingFont,'inter','Preference survives reopening');
const previous=styles.get('--font-reading-content');
assert.equal(app.setReadingFont('url(private-data)'),false);
assert.equal(styles.get('--font-reading-content'),previous);
fail=true;assert.equal(app.setReadingFont('cormorant'),false);
assert.equal(app.settings.readingFont,'inter');assert.equal(messages.length,1);
app.settings={fontSize:1.2,readingFont:'unavailable'};app.loadReadingFont();
assert.equal(app.settings.readingFont,'merriweather','Unknown/old preference falls back safely');
assert(app.renderReadingFontPicker('settings').includes('name="reading-font-settings"'));
const inlinePicker=app.renderReadingFontPicker('daily');
assert(inlinePicker.includes('reading-font-picker-inline'));
assert(inlinePicker.includes('name="reading-font-daily"'));
assert.equal((inlinePicker.match(/type="radio"/g)||[]).length,3);
assert.equal((inlinePicker.match(/ checked/g)||[]).length,1);
for(const font of READING_FONTS) assert(inlinePicker.includes(`aria-label="${font.label}"`));
assert(inlinePicker.includes('>Cormorant</span>'));
const bibleSettings=method('renderBibleReadingSettingsPanel').call({
    bibleReadingSettingsOpen:true,renderReadingFontPicker:app.renderReadingFontPicker.bind(app),renderBibleStudyGuide:()=>''
});
assert(bibleSettings.includes('name="reading-font-bible"'));
console.log('OK: three bundled fonts, persistence, safe fallback, synchronized controls, unchanged size and quota failure');

const reading={date:'2026-10-20',reference:'Pasaje de prueba'};
const rendering={escapeHtml:value=>value,isRead:()=>false,isNativeTextToSpeechAvailable:()=>false,
    renderDailyReadingBibleContext:()=>'',
    dailyReadingVoice:{status:'idle',date:null},renderDailyReadingVoiceControl:method('renderDailyReadingVoiceControl')};
const entry=method('renderDailyReadingEntry').call(rendering,reading);
assert(entry.includes('Meditación'));assert(!entry.includes('Profundizar'));
const actions=method('renderDailyReadingActions').call(rendering,reading);
assert(!actions.includes('Meditación'));
assert.equal((actions.match(/class="reading-command /g)||[]).length,3);
assert.equal((entry.match(/class="reading-command /g)||[]).length,1);
assert(entry.includes('daily-reading-voice-main reading-command'));
for(const status of ['speaking','paused','idle']) {
    rendering.dailyReadingVoice={status,date:reading.date};
    const html=rendering.renderDailyReadingVoiceControl(reading);
    assert(html.includes('reading-command-audio'));
    assert.equal(html.includes('reading-command-stop'),status!=='idle');
    assert(html.includes(readingIcon(status==='speaking'?'pause':'play')));
}
const completed=method('renderDailyReadingActions').call({...rendering,isRead:()=>true},reading);
assert(completed.includes('disabled'));assert(completed.includes('Leído hoy'));
for(const name of ['read','help','meditation','community','share','complete','play','pause','stop']) {
    const svg=readingIcon(name);assert(svg.includes('aria-hidden="true"'));assert(!svg.includes('<script'));
}
assert.equal(readingIcon('unknown'), '');
console.log('OK: one Meditation entry, shared commands, Lucide icons, audio states and disabled read state');

const css=readFileSync(new URL('../css/styles.css',import.meta.url),'utf8');
const deepening=readFileSync(new URL('../css/deepening-shell.css',import.meta.url),'utf8');
assert(css.includes('var(--font-reading-content, var(--font-reading))'));
assert(deepening.includes('var(--font-reading-content,'));
assert(css.includes('body .reading-command:focus-visible'));
assert(css.includes('body .reading-command:active:not(:disabled) { transform: none; }'));
assert(existsSync(new URL('../js/vendor/lucide-LICENSE.txt',import.meta.url)));
console.log('OK: daily/Bible/Meditation content fonts, visible focus, reduced motion and icon license');
