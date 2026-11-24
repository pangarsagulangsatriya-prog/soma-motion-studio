import test from 'node:test';
import assert from 'node:assert/strict';
import {appendEvent,emptyLog,replayUntil,validLog,type VisualEvent} from '../src/studio/v5/VisualRuntime.ts';
const mark=(at:number):VisualEvent=>({at,kind:'foot',mark:{actor:'A',side:'left',x:.3,y:.6,heading:0,t:at}});
test('V5 recording preserves event order and duration; deterministic replay never applies an event twice',()=>{const log=emptyLog();assert.ok(appendEvent(log,mark(100)));assert.ok(appendEvent(log,mark(200)));assert.equal(appendEvent(log,mark(150)),false);assert.ok(validLog(log));const seen:number[]=[];let cursor=replayUntil(log,0,100,e=>seen.push(e.at));cursor=replayUntil(log,cursor,250,e=>seen.push(e.at));assert.equal(cursor,2);assert.deepEqual(seen,[100,200]);});
test('V5 malformed records fail validation',()=>{assert.equal(validLog(null),false);const log=emptyLog();appendEvent(log,mark(50));assert.equal(validLog({...log,duration:10}),false);});
