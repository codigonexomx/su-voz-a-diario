import assert from 'node:assert/strict';
import fs from 'node:fs';
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const index=load('data/readings/index.json'),aggregate=load('data/readings.json');
assert.equal(new Set(index.map(r=>r.date)).size,index.length,'Fechas repetidas en índice');
const files=new Map();let texts=0,tla=0;
for(const item of index){
 assert(/^2026-\d\d-\d\d$/.test(item.date),item.date);
 assert(fs.existsSync(item.file),item.file);
 if(!files.has(item.file))files.set(item.file,load(item.file));
 const matches=files.get(item.file).filter(r=>r.date===item.date);
 assert.equal(matches.length,1,`Una lectura por fecha: ${item.date}`);
 const r=matches[0];assert.equal(r.reference,item.reference,`Referencia ${item.date}`);
 for(const version of ['rvr60','ntv']){assert(r.versions?.[version]?.trim(),`${item.date} ${version}`);texts++;}
 if(r.versions?.tla){assert(r.versions.tla.trim());tla++;texts++;}
 const copies=aggregate.filter(a=>a.date===item.date);assert.equal(copies.length,1,item.date);
 assert.deepEqual(copies[0].versions,r.versions,`Versiones agregado/mes ${item.date}`);
 assert.equal(copies[0].dailyQuestion,r.dailyQuestion,`Pregunta agregado/mes ${item.date}`);
}
for(const [file,readings] of files){assert.equal(new Set(readings.map(r=>r.date)).size,readings.length,file);assert.equal(fs.readFileSync(file,'utf8'),fs.readFileSync('www/'+file,'utf8'),file);}
assert.equal(fs.readFileSync('data/readings/index.json','utf8'),fs.readFileSync('www/data/readings/index.json','utf8'));
console.log(JSON.stringify({readings:index.length,monthlyFiles:files.size,texts,tla,scope:'Consistencia del catálogo actual; no cotejo editorial con originales externos'},null,2));
