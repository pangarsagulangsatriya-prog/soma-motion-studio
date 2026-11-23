import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fuseSpatialMovementV24} from '../src/footprints/lines/v3/ActorSpatialFusionV24.ts';
import {AdaptiveMotionSmootherV24} from '../src/footprints/lines/v3/AdaptiveMotionSmootherV24.ts';
import {CoverageTraceRecorderV24} from '../src/footprints/lines/v3/CoverageTraceRecorderV24.ts';
import {buildPathRibbon} from '../src/footprints/lines/v3/SumiRibbonMeshBuilder.ts';
import {ActorGroundTrajectoryEstimator} from '../src/footprints/lines/v3/ActorGroundTrajectoryEstimator.ts';
import type {ActorMotionFrame} from '../src/footprints/lines/v3/ActorMotionFrameBuilder.ts';
import type {ActorPathObservation} from '../src/footprints/lines/v3/PathObservationRouter.ts';

const source='video:v24-coverage:0:2';
const obs=(actor:'A'|'B',x:number,t:number):ActorPathObservation=>({
 actorId:actor,sourceKey:source,clipStableId:'video:v24-coverage',
 epoch:1,timeMs:t,point:{x,y:620},confidence:.94,
 evidence:'estimated-ground-projection',provenance:'video-estimate',
 footEvent:'none',motionBasis:'dual-foot-coherent'
});
function motion(actor:'A'|'B',x:number,t:number,feet:0|1|2=2):ActorMotionFrame{
 return {actorId:actor,sourceKey:source,timeMs:t,sourceEpoch:0,
  identityConfidence:.97,hipConfidence:.95,hipPx:{x,y:370},
  torsoScalePx:110,feetCount:feet,
  ...(feet?{footImageAnchorPx:{x,y:620},
   feetStagePx:feet===2?{
    left:{point:{x:x-11,y:620},confidence:.94},
    right:{point:{x:x+11,y:620},confidence:.94}
   }:{left:{point:{x,y:620},confidence:.94}}}:{})
 };
}
const project=(a:{x:number;y:number},b:{x:number;y:number})=>
 ({x:b.x-a.x,y:b.y-a.y});

test('SP24-04 coherent raw feet retain actor translation instead of double damping',()=>{
 const from=motion('A',150,1000),to=motion('A',170,1050);
 const result=fuseSpatialMovementV24(from,to,{x:20,y:0},project);
 assert.equal(result.basis,'dual-support');
 assert.ok(result.delta.x>17,'full travel should not be multiplied by router .12 and estimator .15');
 assert.ok(result.delta.x<=20.5);
 assert.equal(result.measuredFeet,2);
});

test('SP24-04 swing foot cannot drag actor across stage when hip is nearly still',()=>{
 const from=motion('A',250,1000,1),to=motion('A',250,1050,1);
 to.feetStagePx!.left!.point.x+=90;
 const result=fuseSpatialMovementV24(from,to,{x:1,y:0},project);
 assert.ok(result.delta.x<=2);
 assert.equal(result.basis,'swing');
});

test('SP24-05 opposing feet with static pelvis register near-zero pivot translation',()=>{
 const a=motion('A',430,1000),b=motion('A',430,1050);
 b.feetStagePx!.left!.point.x-=32;b.feetStagePx!.right!.point.x+=30;
 const result=fuseSpatialMovementV24(a,b,{x:.6,y:.5},project);
 assert.equal(result.basis,'pivot');
 assert.deepEqual(result.delta,{x:0,y:0});
});

test('SP24-04 estimator keeps the complete left-to-right journey despite compressed router observations',()=>{
 const estimator=new ActorGroundTrajectoryEstimator();
 const outputs:number[]=[];
 for(let k=0;k<20;k++){
  const t=1000+k*50;
  const real=150+k*14;
  const routed=150+k*2;
  const out=estimator.ingest([obs('A',routed,t)],
   [motion('A',real,t)],undefined,true,true);
  outputs.push(...out.observations.map(x=>x.point.x));
  assert.equal(out.cuts.length,0);
 }
 assert.ok(outputs.at(-1)!-outputs[0]>225,
  'stage travel should reach the far side of the sampled journey');
 assert.equal(outputs.length,20);
});

test('MS24-08 smoothes STOP jitter without pulling a moving actor toward center',()=>{
 const filter=new AdaptiveMotionSmootherV24();
 const xs:number[]=[];
 for(let i=0;i<18;i++)xs.push(filter.smooth(
  obs('A',200+i*13,1000+i*50),'balanced',90).point.x);
 assert.ok(xs.at(-1)!>405);
 assert.ok(xs.every((x,i)=>i===0||x>=xs[i-1]));
 let end=xs.at(-1)!;
 for(let i=0;i<20;i++){
  const current=filter.smooth(obs('A',421+(i%2?.45:-.45),1900+i*50),'stable',90);
  end=current.point.x;
 }
 assert.ok(Math.abs(end-421)<4,'stop position must not drift');
});

test('MS24-08 source/epoch changes do not bridge disjoint actor paths',()=>{
 const filter=new AdaptiveMotionSmootherV24();
 filter.smooth(obs('A',250,1000));
 const next=filter.smooth({...obs('A',1150,1050),epoch:2});
 assert.equal(next.point.x,1150);
});

test('IN24-10 rough material changes nib edge while keeping every centerline point',()=>{
 const samples=[0,9,18,27,36,45,54,63].map(s=>({
  x:260+s,y:450,s,tx:1,ty:0,confidence:1,widthFactor:1
 }));
 const smooth=buildPathRibbon(samples,{material:'path-sumi',weightPx:34,seed:1234},80);
 const rough=buildPathRibbon(samples,{
  material:'rough-sumi',weightPx:34,seed:1234,roughness:.9},80);
 const repeat=buildPathRibbon(samples,{
  material:'rough-sumi',weightPx:34,seed:1234,roughness:.9},80);
 assert.ok(smooth&&rough&&repeat);
 assert.deepEqual(rough.centerline,smooth.centerline);
 assert.deepEqual(rough.left,repeat.left);
 assert.notDeepEqual(rough.left,smooth.left);
 for(let i=0;i<samples.length;i++){
  assert.ok(Math.hypot(rough.left[i].x-smooth.left[i].x,
   rough.left[i].y-smooth.left[i].y)<=34*.18+.2);
 }
});

test('IN24-10 roughness=0 renders the original smooth ribbon geometry',()=>{
 const samples=[0,15,30,45].map(s=>({
  x:s+500,y:400,s,tx:1,ty:0,confidence:.98
 }));
 const normal=buildPathRibbon(samples,{material:'path-sumi',weightPx:36},55);
 const zero=buildPathRibbon(samples,{material:'rough-sumi',weightPx:36,roughness:0},55);
 assert.deepEqual(zero?.left,normal?.left);
 assert.deepEqual(zero?.right,normal?.right);
});

test('SP24-01 coverage diagnostics preserve coordinate provenance and bounded history',()=>{
 const recorder=new CoverageTraceRecorderV24();
 const first=motion('A',150,1000),one=obs('A',150,1000);
 recorder.capture([first],[one],[one],false);
 assert.equal(recorder.summary[0].coordinateBasis,'image-2d');
 assert.equal(recorder.summary[0].frames,1);
 assert.equal(recorder.summary[0].rawImage?.minX,150);
 recorder.capture([first],[one],[one],false);
 assert.equal(recorder.samples.length,1,'duplicate presentation frame ignored');
 recorder.reset();assert.equal(recorder.samples.length,0);
});
