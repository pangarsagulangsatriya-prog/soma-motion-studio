import test from 'node:test';
import assert from 'node:assert/strict';
import type {Landmark} from '../src/engine/types.ts';
import type {ReplayOverlayPerson} from '../src/stage/VideoPoseGaitEngine.ts';
import {VideoAutoActorTracker} from '../src/stage/videoAutoActorTracker.ts';
import {ReplayActorRecoveryGate} from '../src/stage/replayActorRecoveryGate.ts';
import {replaySkeletonPresentation} from '../src/stage/fullBodySkeleton.ts';

function pose(x:number):Landmark[]{
 const data=Array.from({length:33},(_,i)=>({
  x:x+(i%2===0?-.018:.018),y:.13+Math.floor(i/5)*.085,z:0,visibility:.96
 }));
 return data;
}
const people=(frame:ReturnType<VideoAutoActorTracker['observe']>):ReplayOverlayPerson[]=>
 frame.assignments.map(a=>({id:a.id,landmarks:a.pose,confidence:a.confidence}));

test('S6.8.8.5 crossing: motion-informed A/B recover without swapping raw indices',()=>{
 const tracker=new VideoAutoActorTracker();
 tracker.observe([pose(.25),pose(.75)],0);
 tracker.observe([pose(.34),pose(.66)],100);
 const meeting=tracker.observe([pose(.47),pose(.53)],200);
 assert.equal(meeting.detectedCount,2);
 assert.equal(meeting.visibleCount,0);
 assert.equal(meeting.ambiguous,true);
 assert.deepEqual(meeting.actors.map(a=>a.presence),['uncertain','uncertain']);
 const preview=replaySkeletonPresentation({
  atMs:200,rawPoses:[pose(.47),pose(.53)],actorStates:meeting.actors
 },200);
 assert.deepEqual(preview.labels,['POSE 1 ?','POSE 2 ?']);
 const first=tracker.observe([pose(.40),pose(.60)],300);
 assert.deepEqual(first.assignments,[]);
 assert.deepEqual(first.actors.map(a=>a.presence),['reacquiring','reacquiring']);
 assert.deepEqual(first.actors.map(a=>a.recoveryFrames),[1,1]);
 const second=tracker.observe([pose(.30),pose(.70)],400);
 assert.deepEqual(second.actors.map(a=>a.recoveryFrames),[2,2]);
 const released=tracker.observe([pose(.22),pose(.78)],500);
 assert.equal(released.visibleCount,2);
 assert.equal(released.ambiguous,false);
 assert.deepEqual(released.assignments.map(a=>[a.id,a.rawIndex]),[['A',1],['B',0]]);
 assert.deepEqual(released.actors.map(a=>a.presence),['visible','visible']);
});

test('S6.8.8.5 no direction evidence: preserve uncertain labels until explicit reset',()=>{
 const tracker=new VideoAutoActorTracker();
 tracker.observe([pose(.23),pose(.77)],100);
 const crossed=tracker.observe([pose(.47),pose(.52)],200);
 assert.equal(crossed.ambiguous,true);
 for(const [time,x,y] of [[300,.32,.68],[400,.25,.75],[500,.24,.76]]){
  const frame=tracker.observe([pose(x),pose(y)],time);
  assert.equal(frame.visibleCount,0);
  assert.equal(frame.ambiguous,true);
  assert.ok(frame.actors.every(a=>a.presence==='uncertain'));
 }
 tracker.reset();
 const resumed=tracker.observe([pose(.25),pose(.75)],600);
 assert.equal(resumed.visibleCount,2);
 assert.deepEqual(resumed.assignments.map(a=>a.id),['A','B']);
});

test('S6.8.8.5 A continues while B disappears, then B reenters after quarantine',()=>{
 const tracker=new VideoAutoActorTracker();
 tracker.observe([pose(.25),pose(.75)],0);
 tracker.observe([pose(.26),pose(.75)],100);
 for(let time=200;time<=1100;time+=100){
  const frame=tracker.observe([pose(.26+(time-100)/10000)],time);
  assert.equal(frame.visibleCount,1);
  assert.equal(frame.assignments[0].id,'A');
  if(time>=1100)assert.equal(frame.actors[1].presence,'lost');
 }
 const first=tracker.observe([pose(.37),pose(.75)],1200);
 assert.equal(first.visibleCount,1);
 assert.equal(first.actors[0].presence,'visible');
 assert.equal(first.actors[1].presence,'reacquiring');
 const second=tracker.observe([pose(.38),pose(.76)],1300);
 assert.equal(second.actors[1].recoveryFrames,2);
 const third=tracker.observe([pose(.39),pose(.77)],1400);
 assert.equal(third.visibleCount,2);
 assert.deepEqual(third.assignments.map(a=>a.id),['A','B']);
});

test('S6.8.8.5 missing candidate and new third person cannot steal a distant track',()=>{
 const tracker=new VideoAutoActorTracker();
 tracker.observe([pose(.20),pose(.78)],0);
 tracker.observe([pose(.22),pose(.77)],100);
 const partial=tracker.observe([pose(.24)],200);
 assert.equal(partial.visibleCount,1);
 assert.equal(partial.actors[1].presence,'occluded');
 const distant=tracker.observe([pose(.26),pose(.48)],300);
 assert.ok(distant.assignments.some(a=>a.id==='A'));
 assert.ok(!distant.assignments.some(a=>a.id==='B'));
 assert.equal(distant.actors[1].rawIndex,null);
});

test('S6.8.8.5 event QA stays active for A while B becomes uncertain or lost',()=>{
 const tracker=new VideoAutoActorTracker();
 const gate=new ReplayActorRecoveryGate();
 for(const time of [0,100,200]){
  const frame=tracker.observe([pose(.23),pose(.75)],time);
  const allowed=gate.observe(people(frame),frame.actors);
  if(time===200)assert.deepEqual(allowed.map(p=>p.id),['A','B']);
  else assert.equal(allowed.length,0);
 }
 const missing=tracker.observe([pose(.23)],300);
 const allowed=gate.observe(people(missing),missing.actors);
 assert.deepEqual(allowed.map(p=>p.id),['A']);
 assert.equal(gate.snapshot.state,'partial');
 const qa=gate.snapshot.perActor!;
 assert.equal(qa[0].approved,true);
 assert.equal(qa[1].approved,false);
 assert.equal(qa[1].state,'occluded');
 assert.ok(gate.snapshot.stableFrames>0);
});

test('S6.8.8.5 B reentry requires QA restabilization; A retains active gait',()=>{
 const tracker=new VideoAutoActorTracker(),gate=new ReplayActorRecoveryGate();
 for(const time of [0,100,200]){
  const frame=tracker.observe([pose(.25),pose(.75)],time);
  gate.observe(people(frame),frame.actors);
 }
 for(const time of [300,400,500,600,700,800,900,1000]){
  const frame=tracker.observe([pose(.25)],time);
  const approved=gate.observe(people(frame),frame.actors);
  assert.deepEqual(approved.map(p=>p.id),['A']);
 }
 const t1100=tracker.observe([pose(.25),pose(.75)],1100);
 assert.equal(t1100.actors[1].presence,'reacquiring');
 assert.deepEqual(gate.observe(people(t1100),t1100.actors).map(p=>p.id),['A']);
 const t1200=tracker.observe([pose(.25),pose(.75)],1200);
 gate.observe(people(t1200),t1200.actors);
 const t1300=tracker.observe([pose(.25),pose(.75)],1300);
 assert.deepEqual(t1300.assignments.map(a=>a.id),['A','B']);
 assert.deepEqual(gate.observe(people(t1300),t1300.actors).map(p=>p.id),['A']);
 const t1400=tracker.observe([pose(.25),pose(.75)],1400);
 gate.observe(people(t1400),t1400.actors);
 const t1500=tracker.observe([pose(.25),pose(.75)],1500);
 const result=gate.observe(people(t1500),t1500.actors);
 assert.deepEqual(result.map(p=>p.id),['A','B']);
});

test('S6.8.8.5 QA refuses duplicate ID and low-confidence crossing even while A previously stable',()=>{
 const gate=new ReplayActorRecoveryGate();
 const state=[{id:'A' as const,presence:'visible' as const,confidence:.95,
  rawIndex:0,lastSeenAtMs:100},
 {id:'B' as const,presence:'visible' as const,confidence:.95,
  rawIndex:1,lastSeenAtMs:100}];
 const a:ReplayOverlayPerson={id:'A',landmarks:pose(.2),confidence:.96};
 const b:ReplayOverlayPerson={id:'B',landmarks:pose(.8),confidence:.96};
 for(let i=0;i<3;i++)gate.observe([a,b],state);
 assert.equal(gate.snapshot.state,'stable');
 assert.deepEqual(gate.observe([a,a],state),[]);
 assert.equal(gate.snapshot.perActor?.find(p=>p.id==='A')?.approved,false);
 for(let i=0;i<3;i++)gate.observe([a,b],state);
 assert.deepEqual(gate.observe([{...a,confidence:.2},b],state).map(x=>x.id),['B']);
 assert.equal(gate.snapshot.perActor?.find(p=>p.id==='A')?.approved,false);
});

test('S6.8.8.5 seek/reset discards pending and gait approval across video segments',()=>{
 const tracker=new VideoAutoActorTracker(),gate=new ReplayActorRecoveryGate();
 const initial=tracker.observe([pose(.2),pose(.8)],0);
 gate.observe(people(initial),initial.actors);
 gate.reset('video seek',1000);
 tracker.reset();
 assert.equal(gate.snapshot.perActor?.every(s=>!s.approved&&s.streak===0),true);
 const next=tracker.observe([pose(.78)],1100);
 assert.deepEqual(next.assignments.map(a=>a.id),['A']);
 assert.equal(gate.observe(people(next),next.actors).length,0);
 assert.equal(gate.snapshot.lastResetReason,'video seek');
});
