import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { parse } from 'acorn';
import { parse as parseHTML } from 'node-html-parser';
import { escapeBibleHtml } from '../js/utils/text.js';
import { LocalRv1909Provider } from '../js/bible/LocalRv1909Provider.js';
import { LocalRvr1960Provider } from '../js/bible/LocalRvr1960Provider.js';
import { renderBibleReadingDocument } from '../js/bible/BibleReaderPresentation.js';

const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const start=source.indexOf('function renderBibleTextWithFootnotes(');
const end=source.indexOf('\n}',start)+2;
const render=vm.runInNewContext('('+source.slice(start,end)+')',{escapeBibleHtml,renderBibleFootnoteMarker:note=>`<sup>${note.number}</sup>`});
assert.equal(render('Texto & palabra',[]),'Texto &amp; palabra');
assert.equal(render('Texto & palabra',[{id:'a',number:1,rv1909_anchor:{char_offset:5}},{id:'b',number:2,rv1909_anchor:{placement:'verse_end'}}]),'Texto<sup>1</sup> &amp; palabra<sup>2</sup>');
assert.equal(render('<script>alert(1)</script>',[]),'&lt;script&gt;alert(1)&lt;/script&gt;');
const localFetch=async path=>{
    assert(!path.includes('strong'),'Plain editions never request Strong resources.');
    return {ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/^\uFEFF/,''))};
};
const providers={rv1909:new LocalRv1909Provider({fetchImpl:localFetch}),rvr60:new LocalRvr1960Provider({fetchImpl:localFetch})};
const context=vm.createContext({escapeBibleHtml,renderBibleReadingDocument,RV1909_VERSION_ID:'rv1909',RVR1960_VERSION_ID:'rvr60',
    renderStrongVerseText:()=>assert.fail('Plain editions must not render Strong controls.'),
    bibleRepository:{getChapter:(version,book,chapter)=>providers[version].getChapter(book,chapter)},
    BIBLE_FOOTNOTE_SUPERSCRIPTS:Object.fromEntries([...'0123456789'].map((d,i)=>[d,[...'⁰¹²³⁴⁵⁶⁷⁸⁹'][i]]))});
for(const node of parse(source,{ecmaVersion:'latest',sourceType:'module'}).body.filter(item=>item.type==='FunctionDeclaration'))vm.runInContext(source.slice(node.start,node.end),context);
const renderChapter=vm.runInContext('getBibleChapter',context);
for(const version of ['rv1909','rvr60'])for(const [book,chapter] of [['gen',1],['psa',23],['jhn',3]]){
    const result=await renderChapter(book,chapter,version);
    const dom=parseHTML(result.content);
    assert.equal(dom.querySelectorAll('[data-action="open-strong-word"], [data-action="open-strong-verse"], .bible-strong-number').length,0);
    for(const verse of result.verses){
        assert.equal(verse.strongSpans.length,0);assert.equal(verse.strongUnalignedIds.length,0);
        assert.equal(dom.querySelector(`.verse-item[data-verse-number="${verse.number}"]`).getAttribute('data-verse-text'),verse.text.replace(/\[\[REF:[fc]:[^\]]+\]\]/g,'').replace(/\s+/g,' ').trim());
    }
}
console.log('OK: RV1909 and plain RVR1960 remain free of Strong controls/data loads; original text, HTML escaping and inline/end footnotes preserved.');
