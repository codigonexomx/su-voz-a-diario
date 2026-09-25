import assert from 'node:assert/strict';
import { adjacentChapter, ContinuousReader } from '../js/bible/ContinuousReader.js';
const books = [{id:'mat',name:'Mateo',chapters:28},{id:'mrk',name:'Marcos',chapters:16}];
assert.equal(adjacentChapter(books,'mat',1,-1),null);
assert.equal(adjacentChapter(books,'mrk',16,1),null);
assert.deepEqual(adjacentChapter(books,'mat',28,1),{book:books[1],chapter:1});
assert.deepEqual(adjacentChapter(books,'mrk',1,-1),{book:books[0],chapter:28});
assert.equal(adjacentChapter(books,'mat',3,-1).chapter,2);
assert.equal(adjacentChapter(books,'mat',3,1).chapter,4);
// A pending request may not append content after leaving the reader.
let resolve, requests=0, renders=0;
const reader=Object.create(ContinuousReader.prototype);
Object.assign(reader,{root:{isConnected:true},books,entries:[{book:books[0],chapter:3}],pending:new Set(),failed:new Set(),top:{},bottom:{},load:()=>{requests++;return new Promise(r=>resolve=r)},render:()=>{renders++},disposed:false});
const first=reader.extend(1);
await reader.extend(1);
assert.equal(requests,1,'Rapid repeated load must be coalesced');
reader.disposed=true;resolve({content:'obsolete'});await first;
assert.equal(renders,0,'Stale response must not modify a later view');
assert.equal(reader.pending.size,0);
// Failure is exposed once with explicit retry, without an automatic request loop.
reader.disposed=false;reader.load=async()=>{throw new Error('offline')};
await reader.extend(-1);
assert(reader.failed.has(-1));assert.match(reader.top.textContent,/reintentar/);assert.equal(reader.top.disabled,false);
// Voice lookup stays attached to its own chapter, not whichever chapter is visible.
reader.entries=[{book:books[0],chapter:3,data:{verses:[{number:1,text:'A'}]}},{book:books[0],chapter:4,data:{verses:[{number:1,text:'B'}]}}];
reader.active=reader.entries[1];
assert.equal(reader.findVoice('Mateo-3').data.verses[0].text,'A');
assert.equal(reader.findVoice('Mateo-4').data.verses[0].text,'B');
console.log('OK: chapter/book boundaries, rapid repeated requests, obsolete response, offline retry, independent voice chapter');
