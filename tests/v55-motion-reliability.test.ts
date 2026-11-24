import test from 'node:test';
import assert from 'node:assert/strict';
import {TwoPersonIdentityTracker} from '../src/footprints/live/TwoPersonIdentityTracker.ts';
import {composeLiveFootSamples,ComposeFloorPosePreview} from '../src/studio/v3/ComposeFloorPosePreview.ts';
import type {Landmark,MotionFrame} from '../src/engine/types.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';

const pose=(x:number):Landmark[]=>Array.from({length:33},(_,i)=>({
 x:x+((i===31||i===32) ? .012 : 0),y:i>=27 ? .8 : i>=23 ? .5 : .35,z:0,visibility:.95
}));
const status=(indices:{A:number|null;B:number|null},ambiguous=false,time:number|null=100):MultiPoseStatus=>({
 mode:2,visible:(['A','B'] as const).filter(id=>indices[id]!==null),
 ambiguous,reason:'test',ghostCount:0,poseIndices:indices,observedFrameTime:time
});
const frame=(poses:Landmark[][],tracked=true)=>({source:'camera',time:100,poses,pose:poses[0]??[],tracked} as MotionFrame);

test('initial overlap retries when performers separate',()=>{
 const tracker=new TwoPersonIdentityTracker();
 assert.equal(tracker.observe([pose(.4),pose(.45)],10).ambiguous,true);
 const recovered=tracker.observe([pose(.2),pose(.8)],43);
 assert.equal(recovered.ambiguous,false);
 assert.deepEqual(recovered.assignments.map(a=>a.id),['A','B']);
});
test('established ambiguous crossing still fails closed',()=>{
 const tracker=new TwoPersonIdentityTracker();
 tracker.observe([pose(.2),pose(.8)],10);
 assert.equal(tracker.observe([pose(.48),pose(.51)],43).ambiguous,true);
 assert.equal(tracker.observe([pose(.2),pose(.8)],76).ambiguous,true);
});
test('Compose receives both performers even with detector order reversed',()=>{
 const samples=composeLiveFootSamples(frame([pose(.8),pose(.2)]),
 status({A:1,B:0}),2,'phone','session');
 assert.equal(samples.length,4);
 assert.ok(samples.filter(s=>s.actorId==='A').every(s=>s.x<.4));
 assert.ok(samples.filter(s=>s.actorId==='B').every(s=>s.x>.6));
});
test('unassigned and stale identities are neutral; no anonymous footprint history',()=>{
 const f=frame([pose(.2),pose(.8)],false);
 for(const s of [status({A:null,B:null},true,null),status({A:0,B:1},false,99)]){
  const samples=composeLiveFootSamples(f,s,2,'phone','session');
  assert.equal(samples.length,4);
  assert.ok(samples.every(p=>p.actorId.startsWith('unassigned-')));
  const preview=new ComposeFloorPosePreview();
  preview.ingest(samples,100,'session');
  assert.equal(preview.count,0);
  assert.equal(preview.activeFeet,4);
 }
});
test('one known performer continues with unknown second pose',()=>{
 const samples=composeLiveFootSamples(frame([pose(.2),pose(.8)]),
 status({A:null,B:1}),2,'camera','session');
 assert.equal(samples.filter(s=>s.actorId==='B').length,2);
 assert.equal(samples.filter(s=>s.actorId==='unassigned-0').length,2);
});

test('unmatched pose can recover at its original location without resetting camera',()=>{
 const tracker=new TwoPersonIdentityTracker();
 tracker.observe([pose(.15),pose(.85)],10);
 assert.equal(tracker.observe([pose(.5)],43).ambiguous,true);
 const recovered=tracker.observe([pose(.15),pose(.85)],76);
 assert.equal(recovered.ambiguous,false);
 assert.deepEqual(recovered.assignments.map(a=>a.id),['A','B']);
});
