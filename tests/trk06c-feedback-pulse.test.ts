import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stepTrackFeedbackPulse,trackFeedbackSignature,TRACK_READY_SETTLE_MS,
 type TrackFeedbackPulse} from '../src/studio/v3/trackFeedbackPulseModel.ts';
import type {TrackFeedback} from '../src/studio/v3/trackFeedbackModel.ts';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const actor={id:'A' as const,state:'visible' as const,feet:2 as const};
const ready:TrackFeedback={state:'ready',label:'Kaki terlihat 2/2',hint:null,
 actors:[actor],visibleFeet:2,expectedFeet:2};
const partial:TrackFeedback={...ready,state:'framing',label:'Kaki terlihat 1/2',
 hint:'Pastikan kedua telapak masuk bingkai',visibleFeet:1,
 actors:[{id:'A',state:'partial',feet:1}]};
const ambiguous:TrackFeedback={...ready,state:'uncertain',label:'Identitas belum stabil',
 hint:'Pisahkan posisi kedua aktor',visibleFeet:0,
 actors:[{id:'A',state:'unstable',feet:0}]};
const waiting:TrackFeedback={...ready,state:'waiting',label:'Mencari tubuh',
 hint:null,actors:[],expectedFeet:0,visibleFeet:0};
const step=(prev:TrackFeedbackPulse|null,observed:TrackFeedback,
 now:number,frameTime:number|null,key='webcam|ready|1')=>
 stepTrackFeedbackPulse({previous:prev,observed,key,now,frameTime,
  requireNewFrames:key.startsWith('webcam')});

test('ready needs repeated new frames and a settling window',()=>{
 const a=step(null,ready,1000,300);
 assert.equal(a.output.state,'uncertain');
 assert.equal(a.output.visibleFeet,0);
 assert.equal(a.output.label,'Memeriksa kaki');
 const b=step(a,ready,1200,300);
 assert.equal(b.output.state,'uncertain','A frozen frame cannot become valid');
 const c=step(b,ready,1350,320);
 assert.equal(c.output.state,'ready');
 assert.equal(c.output.visibleFeet,2);
 assert.equal(c.distinctFrames,2);
 assert.equal(TRACK_READY_SETTLE_MS,320);
});
test('frame loss, partial feet or ambiguous IDs revoke ready immediately',()=>{
 const first=step(null,ready,0,100);
 const locked=step(first,ready,340,140);
 assert.equal(locked.output.state,'ready');
 assert.equal(step(locked,partial,345,145).output.state,'framing');
 assert.equal(step(locked,ambiguous,345,145).output.state,'uncertain');
 assert.equal(step(locked,waiting,345,null).output.state,'waiting');
});
test('source or performer epoch changes cannot leak old A/B readiness',()=>{
 const first=step(null,ready,0,100);
 const locked=step(first,ready,350,150);
 const other=step(locked,ready,380,180,'webcam|ready|2');
 assert.equal(other.output.state,'uncertain');
 assert.equal(other.output.visibleFeet,0);
 assert.equal(other.key,'webcam|ready|2');
 const switched=step(locked,waiting,380,null,'phone|pairing|1');
 assert.equal(switched.output.state,'waiting');
 assert.equal(switched.readySince,null);
});
test('video frames do not require a different camera frame timestamp',()=>{
 const key='video|experiment|2|file';
 const video=(previous:TrackFeedbackPulse|null,now:number)=>
  stepTrackFeedbackPulse({previous,observed:ready,key,
   now,frameTime:500,requireNewFrames:false});
 const start=video(null,100);
 assert.equal(start.output.state,'uncertain');
 assert.equal(video(start,440).output.state,'ready');
});
test('rapid ready/framing oscillation cannot latch stale success',()=>{
 const a=step(null,ready,100,1);
 const b=step(a,partial,240,2);
 const c=step(b,ready,270,3);
 assert.equal(c.output.state,'uncertain');
 assert.equal(step(c,ready,400,4).output.state,'uncertain');
 assert.equal(step(c,ready,600,4).output.state,'ready');
});
test('signature changes on A/B visibility, feet and safety state',()=>{
 assert.notEqual(trackFeedbackSignature(ready),trackFeedbackSignature(partial));
 assert.notEqual(trackFeedbackSignature(ready),trackFeedbackSignature(ambiguous));
 assert.equal(trackFeedbackSignature(ready),trackFeedbackSignature({...ready}));
});
test('live display samples current frame and router, color gate uses same UI state',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const pulse=read('../src/studio/v3/useTrackFeedbackPulse.ts');
 assert.match(stage,/const feedback=useTrackFeedbackPulse\(/);
 assert.match(stage,/trackingFeedbackRef\.current=feedback/);
 assert.match(stage,/liveSkeletonPresentation\(f,identities,performerCount,identityConfirmed\)/);
 assert.match(stage,/data-tracking-state=\{feedback.state\}/);
 assert.match(stage,/aria-live="polite" aria-atomic="true"/);
 assert.match(pulse,/window\.setInterval\(tick,160\)/);
 assert.match(pulse,/router\.status/);
 assert.match(pulse,/now-frame.time<450/);
 assert.match(pulse,/pulseRef\.current\?\.key!==key/);
});
