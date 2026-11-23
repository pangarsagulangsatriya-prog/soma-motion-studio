import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ActorGroundTrajectoryEstimator,hipGroundDisplacement}
 from '../src/footprints/lines/v3/ActorGroundTrajectoryEstimator.ts';
import {buildActorMotionFrames}
 from '../src/footprints/lines/v3/ActorMotionFrameBuilder.ts';
import {GroundTrajectoryEngineV2} from '../src/footprints/lines/v3/GroundTrajectoryEngineV2.ts';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import type {ActorMotionFrame} from '../src/footprints/lines/v3/ActorMotionFrameBuilder.ts';
import type {ActorPathObservation} from '../src/footprints/lines/v3/PathObservationRouter.ts';
import type {FootBrushPose} from '../src/footprints/lines/v3/FootBrushPoseAdapter.ts';
import type {DualPoseFrame} from '../src/footprints/dual-trace/DualTracePoseFrameBus.ts';

const source='video:hip-fusion:0:2';
const obs=(actor:'A'|'B',x:number,t:number,epoch=1):ActorPathObservation=>({
 actorId:actor,sourceKey:source,clipStableId:'video:hip-fusion',
 epoch,timeMs:t,point:{x,y:480},confidence:.9,
 evidence:'estimated-ground-projection',provenance:'video-estimate',footEvent:'none',
 motionBasis:'single-foot'
});
const frame=(actor:'A'|'B',x:number,t:number,feet:0|1|2):ActorMotionFrame=>({
 actorId:actor,sourceKey:source,sourceEpoch:0,timeMs:t,
 identityConfidence:.95,hipPx:{x,y:240},hipConfidence:.92,
 torsoScalePx:95,feetCount:feet,
 ...(feet?{footImageAnchorPx:{x,y:480}}:{})
});
test('GT22: hip displacement is a delta; never the absolute height of hips',()=>{
 const d=hipGroundDisplacement({x:210,y:180},{x:224,y:178},{x:220,y:550});
 assert.deepEqual(d,{x:14,y:-2});
 const cal={schema:'soma.footprints.camera-floor',version:1,
  floor:defaultFloorSpace(5,5),
  cameraQuad:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]};
 const projected=hipGroundDisplacement({x:200,y:200},{x:212,y:200},
  {x:500,y:450},{calibration:cal,videoAspect:16/9,calibrationId:'fixture'});
 assert.ok(projected);
 assert.ok(Math.abs(projected.x-12)<.01);
 assert.ok(Math.abs(projected.y)<.01);
});
test('GT22: full 33 keypoints supply a hip even when no sole passes threshold',()=>{
 const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.01}));
 pose[23]={x:.38,y:.68,z:0,visibility:.92};
 pose[24]={x:.42,y:.68,z:0,visibility:.90};
 pose[11]={x:.38,y:.32,z:0,visibility:.88};
 pose[12]={x:.42,y:.32,z:0,visibility:.88};
 const f:DualPoseFrame={actorId:'A',source:'video',sourceKey:source,epoch:0,
  timeMs:1000,identityConfidence:.9,landmarks:pose,coordinateBasis:'image-2d'};
 const result=buildActorMotionFrames([f],[]);
 assert.equal(result.length,1);
 assert.equal(result[0].feetCount,0);
 assert.equal(result[0].hipPx.x,640);
 assert.ok(result[0].torsoScalePx>80);
});
test('GT22: one-foot tracking moves with hips instead of a stationary swinging foot',()=>{
 const engine=new ActorGroundTrajectoryEstimator();
 const start=engine.ingest([obs('A',180,1000)],[frame('A',180,1000,2)]);
 const one=engine.ingest([obs('A',181,1050)],[frame('A',208,1050,1)]);
 assert.equal(start.observations.length,1);
 assert.equal(one.observations.length,1);
 assert.ok(one.observations[0].point.x>195,'hip drives forward movement with one visible foot');
 assert.equal(one.observations[0].motionBasis,'one-foot-hip-assisted');
 assert.equal(one.cuts.length,0);
});
test('GT22: zero-foot frames hold provisional marks until validated recovery',()=>{
 const engine=new ActorGroundTrajectoryEstimator();
 engine.ingest([obs('A',180,1000)],[frame('A',180,1000,2)]);
 const gap1=engine.ingest([],[frame('A',195,1050,0)]);
 const gap2=engine.ingest([],[frame('A',205,1100,0)]);
 assert.equal(gap1.observations.length,0);
 assert.equal(gap2.observations.length,0);
 assert.equal(gap2.status.A.basis,'hip-short-gap');
 const recovered=engine.ingest([obs('A',213,1150)],[frame('A',218,1150,1)]);
 assert.equal(recovered.cuts.length,0);
 assert.equal(recovered.observations.length,3,'two buffered provisional marks then the validated foot frame');
 assert.deepEqual(recovered.observations.map(x=>x.timeMs),[1050,1100,1150]);
});
test('GT22: no feet for longer than 250 ms discard gap, request CUT, no line bridge',()=>{
 const engine=new ActorGroundTrajectoryEstimator();
 engine.ingest([obs('A',180,1000)],[frame('A',180,1000,2)]);
 let last;
 for(let n=1;n<=6;n++)last=engine.ingest([],[frame('A',180+n*4,1000+n*50,0)]);
 assert.ok(last);
 assert.equal(last!.observations.length,0);
 assert.equal(last!.cuts[0]?.reason,'hip-only-gap-expired');
 const renewed=engine.ingest([obs('A',210,1350)],[frame('A',210,1350,1)]);
 assert.equal(renewed.observations.length,1);
});
test('GT22: unreconciled recovered foot forces actor-scoped CUT; no invented bridge',()=>{
 const engine=new ActorGroundTrajectoryEstimator();
 engine.ingest([obs('A',180,1000),obs('B',980,1000)],[
  frame('A',180,1000,2),frame('B',980,1000,2)]);
 engine.ingest([],[frame('A',195,1050,0),frame('B',990,1050,0)]);
 const recovered=engine.ingest([obs('A',730,1100),obs('B',1000,1100)],[
  frame('A',205,1100,1),frame('B',1000,1100,2)]);
 assert.equal(recovered.cuts.length,1);
 assert.equal(recovered.cuts[0].actorId,'A');
 assert.equal(recovered.observations.find(x=>x.actorId==='A')?.point.x,730);
 assert.ok(recovered.observations.find(x=>x.actorId==='B'));
});
test('GT22: toggled off returns V2.1 foot-only, hip-only input draws nothing',()=>{
 const engine=new GroundTrajectoryEngineV2();
 const one:FootBrushPose={actorId:'A',foot:'left',
  sourceKey:source,epoch:1,atMs:1000,coordinateBasis:'image-2d',
  center:{x:.25,y:.53},confidence:.9,provenance:'video-estimate'};
 const start=engine.ingest(source,1000,[one],[],undefined,undefined,[frame('A',400,1000,1)],false);
 const gap=engine.ingest(source,1050,[],[],undefined,undefined,[frame('A',425,1050,0)],false);
 assert.equal(start.observations.length,1);
 assert.equal(gap.observations.length,0);
 assert.equal(engine.hipFusion.getStatus().A.basis,'unavailable');
});
test('GT22: source switch and A/B roles cannot join across epochs',()=>{
 const engine=new ActorGroundTrajectoryEstimator();
 engine.ingest([obs('A',180,1000),obs('B',980,1000)],[
  frame('A',180,1000,2),frame('B',980,1000,2)]);
 const switched=engine.ingest([{...obs('A',200,1100),sourceKey:'video:new-clip:1:2'}],[
  {...frame('A',200,1100,2),sourceKey:'video:new-clip:1:2'}]);
 assert.ok(switched.cuts.some(c=>c.actorId==='A'));
 assert.ok(!switched.cuts.some(c=>c.actorId==='B'));
});
