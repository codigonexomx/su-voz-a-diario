import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {escapeBibleHtml} from '../js/utils/text.js';
const source=fs.readFileSync('js/app.js','utf8');
const start=source.indexOf('function renderBibleTextWithFootnotes(');
const end=source.indexOf('\n}',start)+2;
const render=vm.runInNewContext('('+source.slice(start,end)+')',{escapeBibleHtml,renderBibleFootnoteMarker:note=>`<sup>${note.number}</sup>`});
assert.equal(render('Texto & palabra',[]),'Texto &amp; palabra');
assert.equal(render('Texto & palabra',[{id:'a',number:1,rv1909_anchor:{char_offset:5}},{id:'b',number:2,rv1909_anchor:{placement:'verse_end'}}]),'Texto<sup>1</sup> &amp; palabra<sup>2</sup>');
assert.equal(render('<script>alert(1)</script>',[]),'&lt;script&gt;alert(1)&lt;/script&gt;');
const roots=['.','www','android/app/src/main/assets/public','ios/App/App/public'];
for(const root of roots){
 for(const name of ['strong-hebrew-clean.json','strong-greek-dictionary.json','rv1909_strong_map.json'])assert(!fs.existsSync(`${root}/data/${name}`),`${root}/${name}`);
 for(const name of ['js/app.js','index.html','css/styles.css','sw.js']){
 const text=fs.readFileSync(`${root}/${name}`,'utf8');
 assert(!/strong[-_A-Z]|Strong|STRONG|verse-study-btn|open-verse-study/.test(text),`${root}/${name}: Strong residue`);
 }
}
assert(!fs.existsSync('resources/strong'));
console.log('OK: Strong absent in source/web/Android/iOS; text, inline/end footnotes and HTML escaping intact.');
