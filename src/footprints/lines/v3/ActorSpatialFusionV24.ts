import type {ActorMotionFrame} from './ActorMotionFrameBuilder.ts';
import type {PathPoint} from './PathObservationRouter.ts';

export type FusionMotionClass='dual-support'|'single-support'|'stance-switch'|
 'swing'|'pivot'|'hip-only'|'ambiguous';
export type FusionV24Result={
 delta:PathPoint;basis:FusionMotionClass;confidence:number;
 measuredFeet:number;rawFootTravel:number;hipTravel:number;
};
const sub=(a:PathPoint,b:PathPoint):PathPoint=>({x:a.x-b.x,y:a.y-b.y});
const mul=(a:PathPoint,k:number):PathPoint=>({x:a.x*k,y:a.y*k});
const add=(a:PathPoint,b:PathPoint):PathPoint=>({x:a.x+b.x,y:a.y+b.y});
const size=(a:PathPoint)=>Math.hypot(a.x,a.y);
const dot=(a:PathPoint,b:PathPoint)=>a.x*b.x+a.y*b.y;
const limit=(a:PathPoint,m:number)=>size(a)>m?mul(a,m/size(a)):a;
const clamp=(a:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,a));
type ProjectDelta=(from:PathPoint,to:PathPoint,anchor:PathPoint)=>PathPoint|null;
/**
 * V2.4 removes the second movement attenuation that made a distant actor
 * drift toward the centre. It compares RAW foot changes with already-local
 * hip displacement. Foot changes are tentative image evidence, not proof of
 * plantar pressure. The caller owns the camera-floor transform and the
 * ContinuityCoordinator owns ALL provisional hip-only observations.
 */
export function fuseSpatialMovementV24(
 previous:ActorMotionFrame,current:ActorMotionFrame,hipDelta:PathPoint,
 project:ProjectDelta
):FusionV24Result{
 const dt=current.timeMs-previous.timeMs;
 const maxStep=clamp(18+Math.max(0,dt)*.34+current.torsoScalePx*.40,22,150);
 const hip=limit(hipDelta,maxStep);
 const footDeltas:Array<{foot:'left'|'right';delta:PathPoint;confidence:number}>=[];
 for(const foot of ['left','right'] as const){
  const last=previous.feetStagePx?.[foot],next=current.feetStagePx?.[foot];
  if(!last||!next||Math.min(last.confidence,next.confidence)<.55)continue;
  const projected=project(last.point,next.point,last.point);
  if(!projected||!Number.isFinite(projected.x)||!Number.isFinite(projected.y))continue;
  // A single swinging sole may travel much farther than the actor.
  footDeltas.push({foot,delta:limit(projected,maxStep*1.35),
   confidence:Math.min(last.confidence,next.confidence)});
 }
 const n=footDeltas.length,hipTravel=size(hip);
 const footTravel=footDeltas.reduce((sum,x)=>sum+size(x.delta),0)/Math.max(1,n);
 if(n===0)return {delta:hip,basis:'hip-only',confidence:current.hipConfidence*.70,
  measuredFeet:0,rawFootTravel:0,hipTravel};
 if(n===1){
  const sole=footDeltas[0].delta,soleTravel=size(sole);
  const aligned=hipTravel>1&&soleTravel>1&&dot(sole,hip)/(hipTravel*soleTravel)>.35;
  // With one visible foot, keep translation driven by pelvis: prevent the
  // old 0.12 foot router damping from shrinking the journey frame by frame.
  const weight=aligned&&soleTravel<=Math.max(12,hipTravel*1.8)?.18:0;
  return {delta:limit(add(mul(hip,1-weight),mul(sole,weight)),maxStep),
   basis:weight>0?'single-support':'swing',
   confidence:Math.min(current.hipConfidence,footDeltas[0].confidence),
   measuredFeet:1,rawFootTravel:footTravel,hipTravel};
 }
 const a=footDeltas[0],b=footDeltas[1],na=size(a.delta),nb=size(b.delta);
 const cosine=na>1&&nb>1?dot(a.delta,b.delta)/(na*nb):0;
 const coherent=cosine>.65&&Math.max(na,nb)/Math.max(1,Math.min(na,nb))<2.8;
 const pair=mul(add(mul(a.delta,a.confidence),mul(b.delta,b.confidence)),
  1/Math.max(.01,a.confidence+b.confidence));
 if(coherent){
  const footWeight=clamp(.42+.20*Math.min(a.confidence,b.confidence),.42,.62);
  return {delta:limit(add(mul(pair,footWeight),mul(hip,1-footWeight)),maxStep),
   basis:'dual-support',confidence:Math.min(current.hipConfidence,a.confidence,b.confidence),
   measuredFeet:2,rawFootTravel:footTravel,hipTravel};
 }
 // One foot is probably planted while the other swings. When pelvis does not
 // travel, keep the centre still: turns should change heading, not XY.
 const stance=na<=nb?a:b;
 if(hipTravel<1.7&&Math.min(na,nb)<2.8)
  return {delta:{x:0,y:0},basis:'pivot',
   confidence:current.hipConfidence,measuredFeet:2,rawFootTravel:footTravel,hipTravel};
 const stanceWeight=hipTravel>2&&size(stance.delta)<hipTravel*1.5?.14:.06;
 const movement=add(mul(hip,1-stanceWeight),mul(stance.delta,stanceWeight));
 return {delta:limit(movement,maxStep),basis:'stance-switch',
  confidence:Math.min(current.hipConfidence,stance.confidence),
  measuredFeet:2,rawFootTravel:footTravel,hipTravel};
}
