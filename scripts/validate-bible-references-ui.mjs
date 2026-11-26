import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
// Optional browser check: PLAYWRIGHT_MODULE points to an installed Playwright module.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../', import.meta.url));
const out=path.join(tmpdir(),'suvoz-crossref-qa'); fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));
 if(req.method!=='GET'||!file.startsWith(path.resolve(root)+'/')) return res.writeHead(403).end();
 try {res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
let page; const results=[];
try {
 for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:800,height:1280},{width:1440,height:900}]){
  const ctx=await browser.newContext({viewport,serviceWorkers:'block',hasTouch:viewport.width<1100});
  await ctx.route('**/*',r=>r.request().method()==='GET'&&r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  page=await ctx.newPage();page.setDefaultTimeout(15000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/?analytics_test=1#bible',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.App?._pushRouteReady===true&&!document.getElementById('splash-screen'));
  await page.evaluate(()=>App.navigateToVerse('rev',4,7,null,'rvr60'));
  await page.waitForFunction(()=>App.currentBibleChapterData?.bookId==='rev'&&App.currentBibleChapterData?.chapter===4&&App.targetVerse==null);
  const marker=page.locator('[data-reading-date="bible-rvr60-rev-4"] [data-action="open-cross-reference"][data-verse="7"]').first();
  await marker.click();
  await page.locator('[data-action="select-cross-reference"][data-reference-index="0"]').click();
  await page.waitForFunction(()=>App.bibleCrossReferencePopover?.passage?.verses.length===6);
  assert.deepEqual(await page.locator('.bible-crossref-passage-verse sup').allTextContents(),['5','6','7','8','9','10']);
  const originState=await page.evaluate(()=>({book:App.selectedBibleBook,chapter:App.selectedBibleChapter,version:App.currentBibleVersion,scroll:scrollY}));
  const body=page.locator('.bible-crossref-passage');
  const geometry=await body.evaluate(el=>({height:el.clientHeight,scrollHeight:el.scrollHeight,panel:el.closest('.bible-crossref-popover').getBoundingClientRect().toJSON()}));
  assert(geometry.height>=65,'Usable reading height: '+JSON.stringify(geometry));
  assert(geometry.panel.x>=0&&geometry.panel.y>=0&&geometry.panel.right<=viewport.width+1&&geometry.panel.bottom<=viewport.height+1);
  if(viewport.width<1100 && geometry.scrollHeight>geometry.height) {
   const session=await ctx.newCDPSession(page), box=await body.boundingBox();
   const x=box.x+box.width/2, y=box.y+box.height-10;
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let step=1;step<=5;step++) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*Math.min(20,(box.height-20)/6)}]});
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(()=>document.querySelector('.bible-crossref-passage').scrollTop>0);
   // Allow touch inertia to end before switching input devices to a mouse wheel.
   await body.evaluate(el=>new Promise(resolve=>{
    let last=el.scrollTop, stable=0;
    const tick=()=>{stable=el.scrollTop===last?stable+1:0;last=el.scrollTop;if(stable>=15) resolve();else requestAnimationFrame(tick);};tick();
   }));
   await session.detach();
  }
  await body.hover(); await page.mouse.wheel(0,3000);
  await page.waitForFunction(()=>{const el=document.querySelector('.bible-crossref-passage');return el.scrollTop+el.clientHeight>=el.scrollHeight-2;});
  const last=await body.locator('p').last().boundingBox(), scrollBox=await body.boundingBox();
  assert(last.y+last.height<=scrollBox.y+scrollBox.height+1,'Last verse readable by scrolling');
  const head=await page.locator('.bible-crossref-panel-head').boundingBox();
  assert(head.y>=geometry.panel.y&&head.y+head.height<=geometry.panel.bottom);
  assert.deepEqual(await page.evaluate(()=>({book:App.selectedBibleBook,chapter:App.selectedBibleChapter,version:App.currentBibleVersion,scroll:scrollY})),originState);
  await body.focus();await page.keyboard.press('Control+Home');await page.keyboard.press('End');
  await page.screenshot({path:out+'/'+viewport.width+'x'+viewport.height+'.png'});
  await page.locator('[data-action="back-to-cross-reference-list"]').click();
  await page.waitForFunction(()=>App.bibleCrossReferencePopover?.view==='list');
  await page.locator('[data-action="select-cross-reference"][data-reference-index="0"]').click();
  await page.waitForFunction(()=>App.bibleCrossReferencePopover?.passage?.verses.length===6);
  await page.goBack();
  await page.waitForFunction(()=>App.bibleCrossReferencePopover?.view==='list');
  await page.locator('[data-action="select-cross-reference"][data-reference-index="1"]').click();
  await page.waitForFunction(()=>App.bibleCrossReferencePopover?.passage?.verses.length===1);
  assert.deepEqual(await page.locator('.bible-crossref-passage-verse sup').allTextContents(),['14']);
  await page.locator('[data-action="close-cross-reference"]').click();
  await page.waitForFunction(()=>!App.bibleCrossReferencePopover&&!App.bibleCrossReferenceHistoryCleanup);
  assert.equal(await page.locator('.bible-crossref-popover').count(),0);
  assert.equal(await page.evaluate(()=>App.selectedBibleBook),'rev');
  // Same range across the four shipped editions; real repository, isolated account.
  for(const version of ['rvr60','ntv','tla','rvr60-strong']) {
   const counts=await page.evaluate(async version=>{
    const ref={id:'qa-ezk1-1-9',start:{bookId:'ezk',chapter:1,verse:1},end:{bookId:'ezk',chapter:1,verse:9}};
    const passage=await App.getBibleCrossReferencePassage(ref,version);
    const container=document.createElement('div');container.innerHTML=App.renderBibleCrossReferencePassage({selectedReference:ref,passage,versionId:version});
    return {loaded:passage.verses.length,rendered:container.querySelectorAll('.bible-crossref-passage-verse').length,last:passage.verses.at(-1).number};
   },version);
   assert.deepEqual(counts,version==='tla'?{loaded:4,rendered:4,last:6}:{loaded:9,rendered:9,last:9},version);
  }
  assert.deepEqual(errors,[]);results.push({viewport,geometry,fullRange:true,scrollKeepsOrigin:true,backAndClose:true,editions:4,errors});
  console.log('PASS '+viewport.width+'x'+viewport.height);
  await ctx.close();
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
} catch(e){if(page&&!page.isClosed()) {await page.screenshot({path:out+'/failure.png'});console.log(await page.locator('body').innerText().then(x=>x.slice(-1400)));} throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));}
