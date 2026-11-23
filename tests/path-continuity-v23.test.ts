import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ActorContinuityCoordinator} from '../src/footprints/lines/v3/ActorContinuityCoordinator.ts';
import {validateContinuityBridge,type BridgeContext}
 from '../src/footprints/lines/v3/ContinuityBridgeValidator.ts';
import {ActorGroundTrajectoryEstimator}
 from '../src/footprints/lines/v3/ActorGroundTrajectoryEstimator.ts';
import {ActorPathTracker}
 from '../src/footprints/lines/v3/ActorPathTracker.ts';
import type {ActorPathObservation} from '../src/footprints/lines/v3/PathObservationRouter.ts';
import type {ActorMotionFrame} from '../src/footprints/lines/v3/ActorMotionFrameBuilder.ts';

const source='video:v23-test:0:2',clip='video:v23-test';
const foot=(actor:'A'|'B',x:number,t:number):ActorPathObservation=>({
 actorId:actor,sourceKey:source,clipStableId:clip,epoch:1,timeMs:t,
 point:{x,y:520},confidence:.96,evidence:'estimated-ground-projection',
 provenance:'video-estimate',footEvent:'none',motionBasis:'one-foot-hip-assisted'
});
const body=(actor:'A'|'B',x:number,t:number,feet:0|1|2):ActorMotionFrame=>({
 actorId:actor,sourceKey:source,sourceEpoch:0,timeMs:t,
 identityConfidence:.95,hipPx:{x,y:300},hipConfidence:.95,
 torsoScalePx:90,feetCount:feet,
 ...(feet?{footImageAnchorPx:{x,y:520}}:{})
});
const ctx=(actor:'A'|'B'):BridgeContext=>({
 actorId:actor,sourceKey:source,clipStableId:clip,epoch:1,
 transformKey:'image-2d',identityConfidence:.95,torsoScalePx:90
});

test('PC23: a validated two-frame gap commits once, retaining original actor stroke',()=>{
 const c=new ActorContinuityCoordinator();
 c.begin(foot('A',180,1000),ctx('A'),{x:1,y:0});
 assert.equal(c.append('A',{...foot('A',194,1050),motionBasis:'hip-short-gap'}),true);
 assert.equal(c.append('A',{...foot('A',207,1100),motionBasis:'hip-short-gap'}),true);
 assert.equal(c.diagnostics.A.pending,2);
 assert.equal(c.diagnostics.B.pending,0);
 const v=c.recover('A',foot('A',220,1150),ctx('A'));
 assert.equal(v.cutReason,undefined);
 assert.deepEqual(v.observations.map(o=>o.timeMs),[1050,1100,1150]);
 assert.equal(c.diagnostics.A.acceptedBridges,1);
 assert.equal(c.diagnostics.A.pending,0);
 const repeated=c.recover('A',foot('A',220,1150),ctx('A'));
 assert.equal(repeated.observations.length,1);
 assert.equal(c.diagnostics.A.acceptedBridges,1);
 const path=new ActorPathTracker();
 let e=path.ingest([foot('A',180,1000)],1000);
 assert.deepEqual(e.map(x=>x.kind),['START']);
 e=path.ingest(v.observations,1150);
 assert.ok(e.some(x=>x.kind==='ADD'||x.kind==='TURN'));
 assert.equal(e.filter(x=>x.kind==='CUT'||x.kind==='START').length,0);
});

test('PC23: source, epoch, clip, actor or transform change vetoes bridge',()=>{
 const candidates=[
  {...ctx('A'),actorId:'B' as const},
  {...ctx('A'),sourceKey:'video:other'},
  {...ctx('A'),clipStableId:'video:other'},
  {...ctx('A'),epoch:3},
  {...ctx('A'),transformKey:'floor:changed'},
  {...ctx('A'),crossingAmbiguous:true}
 ];
 for(const changed of candidates){
  const c=new ActorContinuityCoordinator();
  c.begin(foot('A',180,1000),ctx('A'));
  c.append('A',foot('A',191,1050));
  const verdict=c.recover('A',foot('A',200,1100),changed);
  assert.ok(verdict.cutReason,'unsafe bridge unexpectedly accepted');
  assert.equal(c.diagnostics.A.acceptedBridges,0);
  assert.equal(c.diagnostics.A.rejectedBridges,1);
 }
});

test('PC23: expired, reverse and distant recovery never bridge',()=>{
 const c=new ActorContinuityCoordinator();
 c.begin(foot('A',180,1000),ctx('A'));
 c.append('A',foot('A',195,1050));
 assert.equal(c.recover('A',foot('A',210,1300),ctx('A')).cutReason,'bridge-gap-expired');
 for(const invalid of [{x:650,t:1100},{x:210,t:1000}]){
  const k=new ActorContinuityCoordinator();
  k.begin(foot('A',180,1000),ctx('A'));
  k.append('A',foot('A',195,1050));
  const verdict=k.recover('A',foot('A',invalid.x,invalid.t),ctx('A'));
  assert.ok(verdict.cutReason);
 }
});

test('PC23: reversing a known trajectory without pivot evidence is rejected',()=>{
 const c=new ActorContinuityCoordinator();
 c.begin(foot('A',300,1000),ctx('A'),{x:1,y:0});
 c.append('A',foot('A',290,1050));
 assert.equal(c.recover('A',foot('A',260,1100),ctx('A')).cutReason,
  'bridge-direction-mismatch');
});

test('PC23: actor-scoped cut never discards another actor trajectory',()=>{
 const c=new ActorContinuityCoordinator();
 c.begin(foot('A',180,1000),ctx('A'));
 c.begin(foot('B',1000,1000),ctx('B'));
 c.append('A',foot('A',194,1050));
 c.append('B',foot('B',989,1050));
 c.reject('A','identity-ambiguous');
 assert.equal(c.diagnostics.A.pending,0);
 assert.equal(c.diagnostics.B.pending,1);
 assert.equal(c.recover('B',foot('B',980,1100),ctx('B')).cutReason,undefined);
});

test('PC23: estimator holds hip-only points until recovery, then emits ordered observations',()=>{
 const engine=new ActorGroundTrajectoryEstimator();
 engine.ingest([foot('A',180,1000)],[body('A',180,1000,2)],undefined,true);
 const gap1=engine.ingest([],[body('A',195,1050,0)],undefined,true);
 const gap2=engine.ingest([],[body('A',205,1100,0)],undefined,true);
 assert.equal(gap1.observations.length,0);
 assert.equal(gap2.observations.length,0);
 assert.equal(engine.continuity.diagnostics.A.pending,2);
 const recovered=engine.ingest([foot('A',213,1150)],[body('A',218,1150,1)],undefined,true);
 assert.equal(recovered.cuts.length,0);
 assert.deepEqual(recovered.observations.map(o=>o.timeMs),[1050,1100,1150]);
 assert.equal(engine.continuity.diagnostics.A.acceptedBridges,1);
});

test('PC23: estimator rejects recovery teleport without affecting B',()=>{
 const engine=new ActorGroundTrajectoryEstimator();
 engine.ingest([foot('A',180,1000),foot('B',1000,1000)],[
  body('A',180,1000,2),body('B',1000,1000,2)],undefined,true);
 engine.ingest([],[body('A',195,1050,0),body('B',985,1050,0)],undefined,true);
 const result=engine.ingest([foot('A',730,1100),foot('B',975,1100)],[
  body('A',205,1100,1),body('B',975,1100,2)],undefined,true);
 assert.ok(result.cuts.some(x=>x.actorId==='A'));
 assert.ok(!result.cuts.some(x=>x.actorId==='B'));
 assert.equal(engine.continuity.diagnostics.A.acceptedBridges,0);
});

test('PC23: V2.2 fallback keeps old buffered recovery behavior',()=>{
 const engine=new ActorGroundTrajectoryEstimator();
 engine.ingest([foot('A',180,1000)],[body('A',180,1000,2)]);
 engine.ingest([],[body('A',195,1050,0)]);
 const recovered=engine.ingest([foot('A',207,1100)],[body('A',210,1100,2)]);
 assert.equal(recovered.cuts.length,0);
 assert.equal(recovered.observations.length,2);
 assert.equal(engine.continuity.diagnostics.A.acceptedBridges,0);
});

test('PC23: STOP does not force a new logical stroke when walking resumes',()=>{
 const path=new ActorPathTracker();
 path.ingest([foot('A',180,1000)],1000);
 path.ingest([foot('A',196,1100)],1100);
 const events=[] as string[];
 for(let k=0;k<12;k++){
  const t=1200+k*100;
  events.push(...path.ingest([foot('A',196,t)],t).map(x=>x.kind));
 }
 assert.equal(events.filter(x=>x==='STOP').length,1);
 const resumed=path.ingest([foot('A',214,2450)],2450);
 assert.ok(resumed.some(e=>e.kind==='ADD'||e.kind==='TURN'));
 assert.ok(resumed.every(e=>e.kind!=='START'&&e.kind!=='CUT'));
});
