import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replayPoseCapFPS,replayResultTooLate} from '../src/stage/replayFrameSafety.ts';
import {ReplayPerformanceMeter} from '../src/stage/replayPerformance.ts';
import {replaySkeletonPresentation} from '../src/stage/fullBodySkeleton.ts';
import type {Landmark} from '../src/engine/types.ts';

test('D4 discards delayed AI result and refuses future timestamps',()=>{
 assert.equal(replayResultTooLate(1000,1360),true);
 assert.equal(replayResultTooLate(1000,1200),false);
 assert.equal(replayResultTooLate(1250,1000),true);
 assert.equal(replayResultTooLate(NaN,1000),true);
});
test('D4 dynamically reduces CPU pose work while video clock keeps its FPS',()=>{
 assert.equal(replayPoseCapFPS(24,'worker',100),24);
 assert.equal(replayPoseCapFPS(24,'main',100),8);
 assert.equal(replayPoseCapFPS(24,'main',55),12);
 assert.equal(replayPoseCapFPS(24,'main',5),15);
});
test('D4 maintains bounded 120-frame latency histogram, counters and fallback',()=>{
 const meter=new ReplayPerformanceMeter();
 meter.setBackend('worker');
 for(let i=0;i<130;i++)meter.observeInference(1+i*50,14,0,2,i+1,false,0);
 assert.ok(meter.snapshot.pipelineP50Ms>70&&meter.snapshot.pipelineP50Ms<72);
 assert.ok(meter.snapshot.pipelineP95Ms>120);
 meter.observeVideoLag(1500,1090);
 meter.observeBusy();meter.observeStaleResult();
 assert.equal(meter.snapshot.latestVideoLagMs,410);
 assert.equal(meter.snapshot.maxVideoLagMs,410);
 assert.equal(meter.snapshot.busyDrops,1);
 assert.equal(meter.snapshot.staleResults,1);
 meter.setBackend('main','Worker crash');
 meter.reset();
 assert.match(meter.snapshot.fallbackReason??'',/Worker crash/);
 assert.equal(meter.snapshot.staleResults,0);
 assert.equal(meter.snapshot.pipelineP95Ms,0);
});
const pose=(x:number):Landmark[]=>Array.from({length:33},()=>({x,y:.5,z:0,visibility:.96}));
test('D4 interpolates two safe frames for stable A, refuses ambiguous and stale frames',()=>{
 const prior={atMs:1000,rawPoses:[pose(.2)],actorStates:[
  {id:'A' as const,presence:'visible',rawIndex:0}],ambiguous:false};
 const current={atMs:1100,rawPoses:[pose(.4)],actorStates:[
  {id:'A' as const,presence:'visible',rawIndex:0}],ambiguous:false};
 const smooth=replaySkeletonPresentation(current,1050,prior);
 assert.equal(smooth.labels[0],'ACTOR A');
 assert.ok(Math.abs(smooth.poses[0][0].x-.3)<1e-6);
 const uncertain=replaySkeletonPresentation({...current,ambiguous:true},1050,prior);
 assert.equal(uncertain.poses[0][0].x,.4);
 assert.equal(replaySkeletonPresentation(current,1400,prior).poses.length,0);
});
