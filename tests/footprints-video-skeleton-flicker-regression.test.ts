import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ActorMotionStateBuffer} from '../src/stage/actorMotionStateBuffer.ts';
import type {Landmark} from '../src/engine/types.ts';

const pose=(x:number):Landmark[]=>
 Array.from({length:33},(_,i)=>({x:x+i%2*.002,y:.35+i%7*.02,z:0,visibility:.94}));
const tracked=(atMs:number,includeA=true,includeB=true,ambiguous=false)=>({
 atMs,segment:4,ambiguous,
 rawPoses:[...(includeA?[pose(.24)]:[]),...(includeB?[pose(.73)]:[])],
 actorStates:[
  {id:'A' as const,presence:ambiguous?'uncertain':includeA?'visible':'lost',
   rawIndex:ambiguous||!includeA?null:0},
  {id:'B' as const,presence:ambiguous?'uncertain':includeB?'visible':'lost',
   rawIndex:ambiguous||!includeB?null:includeA?1:0}
 ]
});

test('Flicker fix: 12 FPS A dropout does not black out BODY while B keeps tracking',()=>{
 const buffer=new ActorMotionStateBuffer();
 buffer.ingest(tracked(1000));
 buffer.ingest(tracked(1083));
 buffer.ingest(tracked(1166,false,true));
 const visible=buffer.present(1200);
 assert.equal(visible.actors.length,2);
 const a=visible.actors.find(x=>x.id==='A')!;
 const b=visible.actors.find(x=>x.id==='B')!;
 assert.ok(a.opacity>.8,'A retained instead of flashing black');
 assert.equal(a.mode,'held');
 assert.equal(a.tentative,true);
 assert.equal(a.label,'','unsafe A label suppressed immediately');
 assert.equal(a.color,'#a0aaa6');
 assert.equal(b.tentative,false);
 assert.equal(b.label,'ACTOR B');
 assert.ok(a.pose.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 assert.ok(!('events' in visible),'display cache cannot create footsteps');
});

test('Flicker fix: transient full identity ambiguity retains unlabelled measurement',()=>{
 const buffer=new ActorMotionStateBuffer();
 buffer.ingest(tracked(1000));
 buffer.ingest(tracked(1100,true,true,true));
 const held=buffer.present(1125);
 assert.equal(held.actors.length,2);
 assert.ok(held.actors.every(x=>x.mode==='held'&&x.tentative&&x.label===''));
 assert.ok(held.actors.every(x=>x.lockedFeet?.length===0));
});

test('Flicker fix: measured continuity has a monotone fade and a hard expiry',()=>{
 const buffer=new ActorMotionStateBuffer();
 buffer.ingest(tracked(1000));
 buffer.ingest(tracked(1090,false,false));
 const at= [1220,1300,1410,1540,1649].map(t=>buffer.present(t).actors[0]?.opacity??0);
 for(let i=1;i<at.length;i++)assert.ok(at[i]<=at[i-1]+1e-6);
 assert.ok(at[0]>.9&&at.at(-1)!>0);
 assert.equal(buffer.present(1651).actors.length,0);
});

test('Flicker fix: A reacquires in a fresh filter without borrowing B identity',()=>{
 const buffer=new ActorMotionStateBuffer();
 buffer.ingest(tracked(1000));
 buffer.ingest(tracked(1080,false,true));
 const lost=buffer.present(1090).actors.find(a=>a.id==='A')!;
 assert.equal(lost.label,'');
 buffer.ingest(tracked(1160));
 const restored=buffer.present(1170).actors;
 assert.deepEqual(restored.map(a=>a.id),['A','B']);
 assert.equal(restored[0].label,'ACTOR A');
 assert.equal(restored[0].tentative,false);
 assert.ok(Math.abs(restored[0].pose[0].x-.24)<.01);
 assert.ok(restored[0].pose[0].x<restored[1].pose[0].x);
});

test('Flicker fix: hard seek, segment change, and source reset never retain ghosts',()=>{
 const buffer=new ActorMotionStateBuffer();
 buffer.ingest(tracked(1000));
 buffer.reset();
 assert.equal(buffer.present(1050).actors.length,0);
 buffer.ingest(tracked(1300));
 buffer.ingest({...tracked(100),segment:5,rawPoses:[]});
 assert.equal(buffer.present(120).actors.length,0);
 buffer.ingest(tracked(140));
 buffer.ingest(tracked(160));
 buffer.ingest({...tracked(170),ambiguous:true,
  actorStates:tracked(170).actorStates.map(a=>({...a,presence:'uncertain',rawIndex:null}))});
 assert.ok(buffer.present(180).actors.every(a=>a.label===''));
});

test('Flicker fix: active Stage and BODY painter have render-gap and neutral raw fallbacks',()=>{
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const painter=readFileSync(new URL('../src/studio/v3/experimentStagePainter.ts',import.meta.url),'utf8');
 const buffer=readFileSync(new URL('../src/stage/actorMotionStateBuffer.ts',import.meta.url),'utf8');
 assert.match(stage,/buffer\.present\(atMs,flow\)/);
 assert.match(stage,/paintExperimentBody\(body,frame,skeletonVisible,motion,masks\)/);
 assert.match(painter,/actor\.tentative\?false:\[actor\.label\]/);
 assert.match(painter,/Decoder-not-ready must not clear/);
 assert.match(painter,/if\(!snapshot\)return/);
 assert.match(buffer,/if\(old\)\{old\.verified=false;old\.previous=null;\}/);
 assert.doesNotMatch(buffer,/if\(frame\.ambiguous\)\{this\.actors\.clear\(\)/);
});
