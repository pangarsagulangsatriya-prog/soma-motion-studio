import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ActorMotionStateBuffer,OneEuroScalar} from '../src/stage/actorMotionStateBuffer.ts';
import type {Landmark} from '../src/engine/types.ts';
import {readFileSync} from 'node:fs';
const pose=(x:number):Landmark[]=>Array.from({length:33},(_,i)=>({
 x:x+(i%3)*.001,y:.35+(i%5)*.015,z:0,visibility:.95
}));
const frame=(atMs:number,a:number,b:number,reverse=false,ambiguous=false)=>({
 atMs,segment:0,ambiguous,
 rawPoses:reverse?[pose(b),pose(a)]:[pose(a),pose(b)],
 actorStates:[
  {id:'A' as const,presence:ambiguous?'uncertain':'visible',
   rawIndex:ambiguous?null:reverse?1:0},
  {id:'B' as const,presence:ambiguous?'uncertain':'visible',
   rawIndex:ambiguous?null:reverse?0:1}
 ]
});
test('S0.2 One Euro reduces small stationary jitter without overwriting raw input',()=>{
 const f=new OneEuroScalar();
 const xs=[.5,.51,.492,.508,.494,.507,.493,.505,.5];
 const out=xs.map((x,i)=>f.update(x,1000+80*i));
 const rawVariation=xs.slice(1).reduce((sum,x,i)=>sum+Math.abs(x-xs[i]),0);
 const filteredVariation=out.slice(1).reduce((sum,x,i)=>sum+Math.abs(x-out[i]),0);
 assert.ok(filteredVariation<rawVariation,{rawVariation,filteredVariation});
 assert.ok(Math.abs(out.at(-1)!-.5)<.02);
});
test('S0.2 A/B independent state survives swapped MediaPipe raw indices',()=>{
 const state=new ActorMotionStateBuffer();
 state.ingest(frame(1000,.2,.8));
 state.ingest(frame(1080,.27,.73,true));
 const result=state.present(1115);
 assert.deepEqual(result.actors.map(p=>p.id),['A','B']);
 assert.ok(result.actors[0].pose[0].x<result.actors[1].pose[0].x);
 assert.equal(state.latestAtMs,1080);
});
test('S0.3 interpolated and short predicted poses are bounded, visual-only',()=>{
 const state=new ActorMotionStateBuffer();
 state.ingest(frame(1000,.2,.8));
 state.ingest(frame(1100,.36,.64));
 const middle=state.present(1110); // target time 1060 between measured frames
 assert.equal(middle.actors.length,2);
 assert.equal(middle.actors[0].mode,'interpolated');
 const short=state.present(1180); // target=1130, bounded prediction
 assert.equal(short.actors[0].mode,'predicted');
 assert.ok(short.actors[0].pose[0].x<.41);
 assert.ok(!('events' in short));
 const bridging=state.present(1371);
 assert.equal(bridging.actors.length,2);
 assert.equal(bridging.actors[0].mode,'held');
 const stale=state.present(1751);
 assert.equal(stale.actors.length,0);
});
test('S0.2 crossing keeps only neutral measured visuals and reacquires fresh filters',()=>{
 const b=new ActorMotionStateBuffer();
 b.ingest(frame(1000,.2,.8));
 b.ingest(frame(1100,.35,.65));
 b.ingest(frame(1180,.5,.5,false,true));
 const held=b.present(1180);
 assert.equal(held.actors.length,2);
 assert.ok(held.actors.every(a=>a.tentative&&a.label===''&&a.mode==='held'));
 b.ingest(frame(1270,.75,.25,true));
 const result=b.present(1280);
 assert.deepEqual(result.actors.map(x=>x.id),['A','B']);
 assert.ok(Math.abs(result.actors[0].pose[0].x-.75)<.02);
 assert.ok(Math.abs(result.actors[1].pose[0].x-.25)<.02);
});
test('S0.2 reset on seek and changed segment, no stale actor ghosts',()=>{
 const b=new ActorMotionStateBuffer();
 b.ingest(frame(1000,.2,.8));
 b.ingest(frame(1080,.28,.72));
 b.ingest({...frame(80,.7,.3),segment:1});
 const state=b.present(90);
 assert.ok(state.actors[0].pose[0].x>.69);
 b.reset();assert.equal(b.present(90).actors.length,0);
});
test('S0.3 stage runs a continuous rAF renderer while FLOOR remains event-bound',()=>{
 const code=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const painter=readFileSync(new URL('../src/studio/v3/experimentStagePainter.ts',import.meta.url),'utf8');
 const skeleton=readFileSync(new URL('../src/stage/fullBodySkeleton.ts',import.meta.url),'utf8');
 assert.doesNotMatch(code,/now-lastPaintAt>=1000\/30/);
 assert.match(code,/buffer\.ingest\(current\.snapshot\)/);
 assert.match(code,/buffer\.present\(atMs\)/);
 assert.match(code,/paintExperimentBody\(body,frame,skeletonVisible,motion\)/);
 assert.match(code,/current\.snapshot\?\.atMs!==lastFloorAt/);
 assert.match(painter,/drawBufferedBodies/);
 assert.match(skeleton,/parentAlpha\*\(bone\.level/);
});
