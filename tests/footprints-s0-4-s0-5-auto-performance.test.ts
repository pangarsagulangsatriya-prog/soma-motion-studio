import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AdaptiveD3Scheduler,d3FootQuality} from '../src/stage/adaptiveD3Scheduler.ts';
import {ContactAwareFootLock} from '../src/stage/contactAwareFootLock.ts';
import {ActorMotionStateBuffer} from '../src/stage/actorMotionStateBuffer.ts';
import type {Landmark} from '../src/engine/types.ts';

function pose(x=.25):Landmark[]{
 const p:Landmark[]=Array.from({length:33},()=>({x,y:.5,z:0,visibility:.95}));
 p[27]={x:x-.03,y:.64,z:0,visibility:.94};
 p[29]={x:x-.02,y:.7,z:0,visibility:.94};
 p[31]={x:x+.02,y:.7,z:0,visibility:.94};
 p[28]={x:x+.04,y:.64,z:0,visibility:.94};
 p[30]={x:x+.03,y:.7,z:0,visibility:.94};
 p[32]={x:x+.07,y:.7,z:0,visibility:.94};
 return p;
}
const match=(id:'A'|'B',index:number)=>({
 id,rawIndex:index,region:{x:0,y:0,width:1,height:1},
 anchor:{x:index?.75:.25,y:.5}
});
const contact={id:'A:contact:1000',kind:'contact',performer:'A' as const,
 foot:'left' as const,atMs:1000,confidence:.96};
function sample(atMs:number,x=.25,motion='hold'){
 return {
  atMs,segment:0,ambiguous:false,
  rawPoses:[pose(x)],
  actorStates:[{id:'A' as const,presence:'visible',rawIndex:0}],
  people:[{id:'A' as const}],
  gait:{'A:left':{phase:motion==='hold'?'stance':'swing',motion,confidence:.96}},
  events:[contact]
 };
}

test('S0.4 foot visibility triggers one targeted crop, never both at once',()=>{
 const s=new AdaptiveD3Scheduler();
 const weak=pose(.2);weak[31].visibility=.18;
 const strong=pose(.75);
 assert.ok(d3FootQuality(weak)<d3FootQuality(strong));
 const decision=s.choose(1000,30,[match('A',0),match('B',1)],[weak,strong]);
 assert.equal(decision.mode,'quality');
 assert.deepEqual(decision.matches.map(x=>x.id),['A']);
 s.observe(1000,'A',45);
 assert.equal(s.choose(1100,30,[match('A',0),match('B',1)],[weak,strong]).matches.length,0);
});

test('S0.4 delays high-confidence crops and audits them in a bounded cadence',()=>{
 const s=new AdaptiveD3Scheduler(),a=pose(.2),b=pose(.8),m=[match('A',0),match('B',1)];
 assert.equal(s.choose(1000,30,m,[a,b]).matches.length,0);
 assert.equal(s.choose(1300,30,m,[a,b]).matches.length,0);
 const audit=s.choose(2500,30,m,[a,b]);
 assert.equal(audit.mode,'audit');
 assert.equal(audit.matches.length,1);
 s.observe(2500,audit.matches[0].id,35);
 assert.equal(s.choose(2600,30,m,[a,b]).matches.length,0);
 const later=s.choose(2800,30,m,[a,b]);
 assert.ok(later.matches.length<=1);
});

test('S0.4 load guard and unstable IDs prevent D3, with reset on time discontinuity',()=>{
 const s=new AdaptiveD3Scheduler(),weak=pose(.2);
 weak[29].visibility=.15;
 assert.equal(s.choose(1000,130,[match('A',0)],[weak]).matches.length,0);
 assert.equal(s.choose(1100,35,[],[weak]).matches.length,0);
 assert.equal(s.choose(1200,35,[match('A',0)],[weak]).matches.length,1);
 s.observe(1200,'A',40);
 const reset=s.choose(50,35,[match('A',0)],[weak]);
 assert.equal(reset.matches.length,1);
});

test('S0.5 locks a QA-approved stance heel/toe against small detected jitter',()=>{
 const lock=new ContactAwareFootLock();
 lock.observe(sample(1000));
 assert.deepEqual(lock.apply('A',pose(.25),1000).lockedFeet,['left']);
 const shifted=sample(1080,.265);
 lock.observe(shifted);
 const result=lock.apply('A',shifted.rawPoses[0],1080);
 assert.deepEqual(result.lockedFeet,['left']);
 assert.ok(Math.abs(result.pose[29].x-pose(.25)[29].x)<1e-6);
 assert.equal(result.pose[30].x,shifted.rawPoses[0][30].x);
 assert.equal(shifted.rawPoses[0][29].x,.245,'raw landmarks remain unmodified');
});

test('S0.5 never anchors a pose without a verified contact event and approved identity',()=>{
 const lock=new ContactAwareFootLock();
 const noEvent={...sample(1000),events:[]};
 lock.observe(noEvent);
 assert.deepEqual(lock.apply('A',pose(.25),1000).lockedFeet,[]);
 lock.observe({...sample(1100),people:[]});
 assert.deepEqual(lock.apply('A',pose(.25),1100).lockedFeet,[]);
});

test('S0.5 releases foot lock on swing, slide, pivot, identity hold, time gap and seek',()=>{
 const lock=new ContactAwareFootLock();
 lock.observe(sample(1000));
 lock.observe({...sample(1100),gait:{'A:left':{phase:'stance',motion:'slide',confidence:.96}}});
 assert.deepEqual(lock.apply('A',pose(.25),1100).lockedFeet,[]);
 lock.observe({...sample(1200),gait:{'A:left':{phase:'stance',motion:'pivot',confidence:.96}}});
 assert.deepEqual(lock.apply('A',pose(.25),1200).lockedFeet,[]);
 lock.observe({...sample(1300),gait:{'A:left':{phase:'swing',motion:'step',confidence:.96}}});
 assert.deepEqual(lock.apply('A',pose(.25),1300).lockedFeet,[]);
 const secondContact={...contact,id:'A:contact:1450',atMs:1450};
 lock.observe({...sample(1450),events:[secondContact]});
 assert.deepEqual(lock.apply('A',pose(.25),1450).lockedFeet,['left']);
 lock.observe({...sample(1500),ambiguous:true});
 assert.deepEqual(lock.apply('A',pose(.25),1500).lockedFeet,[]);
 lock.observe({...sample(2100),events:[secondContact]});
 assert.deepEqual(lock.apply('A',pose(.25),2100).lockedFeet,[]);
 lock.observe({...sample(50),segment:1,events:[]});
 assert.deepEqual(lock.apply('A',pose(.25),50).lockedFeet,[]);
});

test('S0.5 separate A/B and per-foot tracking does not create contact events',()=>{
 const buf=new ActorMotionStateBuffer();
 buf.ingest(sample(1000));
 const present=buf.present(1000);
 assert.equal(present.actors.length,1);
 assert.deepEqual(present.actors[0].lockedFeet,['left']);
 assert.ok(!('events' in present));
 buf.ingest(sample(1080,.265));
 assert.deepEqual(buf.present(1100).actors[0].lockedFeet,['left']);
 buf.ingest({...sample(1160),gait:{'A:left':{phase:'swing',motion:'step',confidence:.96}}});
 assert.deepEqual(buf.present(1170).actors[0].lockedFeet,[]);
 buf.reset();
 assert.equal(buf.present(1170).actors.length,0);
});

test('S0.4 worker automatically schedules D3; S0.5 only decorates visual BODY frames',()=>{
 const worker=readFileSync(new URL('../src/stage/replayInferenceWorker.ts',import.meta.url),'utf8');
 const motion=readFileSync(new URL('../src/stage/actorMotionStateBuffer.ts',import.meta.url),'utf8');
 const painter=readFileSync(new URL('../src/studio/v3/experimentStagePainter.ts',import.meta.url),'utf8');
 assert.match(worker,/adaptiveD3\.choose\(/);
 assert.match(worker,/adaptiveD3\.observe\(/);
 assert.match(worker,/d3MatchGuides\(guides,poses\)/);
 assert.match(motion,/this\.footLock\.observe\(frame\)/);
 assert.match(motion,/this\.footLock\.apply\(id,pose,videoAtMs\)/);
 assert.match(painter,/paintExperimentFloor/);
 assert.doesNotMatch(worker,/lastGuidedClock/);
});
