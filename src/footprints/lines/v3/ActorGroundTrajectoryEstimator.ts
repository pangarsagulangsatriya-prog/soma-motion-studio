import {cameraGroundToFloor,floorToUV,stageUVToRawCamera,type CameraFloorCalibration}
 from '../../spatial/coordinates.ts';
import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {ActorMotionFrame} from './ActorMotionFrameBuilder.ts';
import type {ActorPathObservation,PathPoint} from './PathObservationRouter.ts';

type Spatial={calibration:CameraFloorCalibration;videoAspect:number;calibrationId:string};
type Basis='dual-foot-and-hip'|'one-foot-hip-assisted'|'hip-short-gap'|
 'foot-only-low-confidence'|'unavailable';
type State={
 sourceKey:string;footEpoch:number;timeMs:number;footAtMs:number;
 point:PathPoint;confirmed:PathPoint;hipPx?:PathPoint;
 imageAnchorPx?:PathPoint;lastFootPx?:PathPoint;
 lastFootObservation:ActorPathObservation;
 pending:ActorPathObservation[];
};
const actors=['A','B'] as const;
const add=(a:PathPoint,b:PathPoint):PathPoint=>({x:a.x+b.x,y:a.y+b.y});
const sub=(a:PathPoint,b:PathPoint):PathPoint=>({x:a.x-b.x,y:a.y-b.y});
const mul=(a:PathPoint,k:number):PathPoint=>({x:a.x*k,y:a.y*k});
const norm=(a:PathPoint)=>Math.hypot(a.x,a.y);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const cap=(p:PathPoint,max:number):PathPoint=>norm(p)>max?mul(p,max/norm(p)):p;
const valid=(p:PathPoint)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 p.x>=0&&p.x<=1600&&p.y>=0&&p.y<=900;

/** Hip displacement is applied LOCALLY around the last observed foot ground
 * anchor, not projected as an absolute airborne hip point. Out-of-floor
 * projections return null, never silently switch coordinate spaces.
 */
export function hipGroundDisplacement(
 from:PathPoint,to:PathPoint,anchor:PathPoint,spatial?:Spatial
):PathPoint|null{
 const movement=sub(to,from);
 if(!spatial)return movement;
 const project=(p:PathPoint):PathPoint|null=>{
  if(!valid(p))return null;
  const raw=stageUVToRawCamera({x:p.x/1600,y:p.y/900},spatial.videoAspect);
  if(!raw)return null;
  const ground=cameraGroundToFloor(spatial.calibration,{
   cameraUV:raw,phase:'stance',confidence:1});
  if(!ground)return null;
  const uv=floorToUV(spatial.calibration.floor,ground);
  return {x:uv.x*1600,y:uv.y*900};
 };
 const a=project(anchor),b=project(add(anchor,movement));
 return a&&b?sub(b,a):null;
}
export type TrajectoryEstimate={
 observations:ActorPathObservation[];
 cuts:Array<{actorId:ActorChannel;reason:string}>;
 status:Record<ActorChannel,{basis:Basis;feet:0|1|2;confidence:number}>;
};
/** Actor-centred trajectory with a bounded provisional hip-only window.
 * No hip-only observations are committed before a fresh foot anchor validates
 * them; no fake foot contacts are emitted by this estimator.
 */
export class ActorGroundTrajectoryEstimator{
 private states=new Map<ActorChannel,State>();
 private statuses:TrajectoryEstimate['status']={
  A:{basis:'unavailable',feet:0,confidence:0},
  B:{basis:'unavailable',feet:0,confidence:0}
 };
 private lastSignature='';
 reset(){this.states.clear();this.lastSignature='';this.statuses={
  A:{basis:'unavailable',feet:0,confidence:0},
  B:{basis:'unavailable',feet:0,confidence:0}
 };}
 getStatus(){return {A:{...this.statuses.A},B:{...this.statuses.B}};}
 summary(){return actors.map(actor=>{
  const s=this.statuses[actor];
  return actor+': '+s.feet+'/2 kaki · '+s.basis+' ('+s.confidence.toFixed(2)+')';
 }).join(' | ');}
 ingest(footObservations:readonly ActorPathObservation[],
  frames:readonly ActorMotionFrame[],spatial?:Spatial):TrajectoryEstimate{
  const signature=spatial?.calibrationId??'image-2d';
  if(this.lastSignature!==signature){this.reset();this.lastSignature=signature;}
  const observations:ActorPathObservation[]=[];
  const cuts:TrajectoryEstimate['cuts']=[];
  for(const actor of actors){
   const foot=footObservations.find(o=>o.actorId===actor);
   const frame=frames.find(f=>f.actorId===actor&&(!foot||
    f.sourceKey===foot.sourceKey.split('|floor:')[0])&&
    (!foot||f.timeMs===foot.timeMs));
   const feet=(frame?.feetCount??(foot?1:0)) as 0|1|2;
   const quality=frame?.hipConfidence??0;
   let state=this.states.get(actor);
   if(frame&&state&&
    (state.sourceKey!==frame.sourceKey||
     frame.timeMs<=state.timeMs||frame.timeMs-state.timeMs>900)){
    cuts.push({actorId:actor,reason:'trajectory-source-or-gap'});
    this.states.delete(actor);state=undefined;
   }
   if(!frame){
    if(foot){
     // Pure foot-only V2.1 fallback (simulator, demo or missing hip).
     observations.push(foot);
     this.states.delete(actor);
     this.statuses[actor]={basis:'foot-only-low-confidence',feet,confidence:foot.confidence};
    }else{
     this.statuses[actor]={basis:'unavailable',feet:0,confidence:0};
    }
    continue;
   }
   if(!foot&&(!state||!frame.hipPx)){
    this.statuses[actor]={basis:'unavailable',feet:0,confidence:quality};
    continue;
   }
   if(foot&&!state){
    observations.push(foot);
    this.states.set(actor,{
     sourceKey:frame.sourceKey,footEpoch:foot.epoch,timeMs:frame.timeMs,
     footAtMs:frame.timeMs,point:{...foot.point},confirmed:{...foot.point},
     hipPx:{...frame.hipPx},imageAnchorPx:frame.footImageAnchorPx,
     lastFootPx:{...foot.point},lastFootObservation:foot,pending:[]
    });
    this.statuses[actor]={basis:feet===2?'dual-foot-and-hip':'one-foot-hip-assisted',
     feet,confidence:Math.min(quality,foot.confidence)};
    continue;
   }
   if(!state)continue;
   const dt=frame.timeMs-state.timeMs;
   const hipDelta=state.hipPx?hipGroundDisplacement(state.hipPx,frame.hipPx,
    state.imageAnchorPx??frame.footImageAnchorPx??frame.hipPx,spatial):null;
   const maxMotion=Math.min(150,18+dt*.32+frame.torsoScalePx*.40);
   const implausible=hipDelta!==null&&norm(hipDelta)>maxMotion;
   if(implausible){
    cuts.push({actorId:actor,reason:'hip-teleport'});
    this.states.delete(actor);
    // Do not draw a bridge or a replacement anchor in this frame.
    this.statuses[actor]={basis:'unavailable',feet,confidence:0};
    continue;
   }
   // Images may move via perspective: local image anchor follows the hip
   // between valid feet; a fresh foot observation resets it.
   const estimatedImageAnchor=state.imageAnchorPx&&state.hipPx?
    add(state.imageAnchorPx,sub(frame.hipPx,state.hipPx)):state.imageAnchorPx;
   if(!foot){
    if(hipDelta===null||frame.timeMs-state.footAtMs>250||
       state.pending.length>=6){
     cuts.push({actorId:actor,reason:'hip-only-gap-expired'});
     this.states.delete(actor);
     this.statuses[actor]={basis:'unavailable',feet:0,confidence:quality};
     continue;
    }
    const nextPoint=add(state.point,cap(hipDelta,maxMotion));
    if(!valid(nextPoint)){
     cuts.push({actorId:actor,reason:'hip-outside-floor'});
     this.states.delete(actor);continue;
    }
    state.pending.push({...state.lastFootObservation,
     timeMs:frame.timeMs,point:nextPoint,confidence:clamp(quality*.72,.55,.9),
     footEvent:'none',motionBasis:'hip-short-gap'});
    state.point=nextPoint;state.hipPx={...frame.hipPx};
    state.imageAnchorPx=estimatedImageAnchor;
    state.timeMs=frame.timeMs;
    this.statuses[actor]={basis:'hip-short-gap',feet:0,confidence:quality*.72};
    continue;
   }
   // The foot adapter epoch is independent from the approved pose epoch.
   // If the adapter restarted, do not connect its new feet to old ink.
   if(foot.epoch!==state.footEpoch){
    cuts.push({actorId:actor,reason:'foot-epoch-change'});
    this.states.delete(actor);
    observations.push(foot);
    this.statuses[actor]={basis:'foot-only-low-confidence',feet,confidence:foot.confidence};
    continue;
   }
   const footDelta=state.lastFootPx?sub(foot.point,state.lastFootPx):{x:0,y:0};
   const hip=hipDelta??{x:0,y:0};
   const footWeight=feet===2?.55:.15;
   const blended=hipDelta?add(mul(cap(footDelta,maxMotion),footWeight),
    mul(cap(hip,maxMotion),1-footWeight)):cap(footDelta,maxMotion);
   let nextPoint=add(state.point,blended);
   // Stable stance can pull the predicted centre toward the foot corridor,
   // without making the center snap to a single swinging sole.
   const difference=sub(foot.point,nextPoint);
   const drift=norm(difference);
   const limit=clamp(frame.torsoScalePx*.9,28,95);
   if(state.pending.length&&drift>limit){
    cuts.push({actorId:actor,reason:'hip-recovery-mismatch'});
    this.states.delete(actor);
    observations.push(foot); // tracker starts a NEW segment after CUT
    this.statuses[actor]={basis:'foot-only-low-confidence',feet,confidence:foot.confidence};
    continue;
   }
   nextPoint=add(nextPoint,cap(difference,feet===2?7:3));
   if(!valid(nextPoint)){
    cuts.push({actorId:actor,reason:'trajectory-outside-floor'});
    this.states.delete(actor);continue;
   }
   if(state.pending.length){
    observations.push(...state.pending);
    state.pending=[]; // exactly once; no deposits during hip-only gap
   }
   observations.push({...foot,point:nextPoint,
    confidence:clamp(Math.min(foot.confidence,quality),.55,1),
    motionBasis:feet===2?'dual-foot-and-hip':'one-foot-hip-assisted'});
   state.point=nextPoint;state.confirmed=nextPoint;
   state.timeMs=frame.timeMs;state.footAtMs=frame.timeMs;
   state.hipPx={...frame.hipPx};
   state.imageAnchorPx=frame.footImageAnchorPx??estimatedImageAnchor;
   state.lastFootPx=foot.point;state.lastFootObservation=foot;
   this.statuses[actor]={basis:feet===2?'dual-foot-and-hip':'one-foot-hip-assisted',
    feet,confidence:Math.min(quality,foot.confidence)};
  }
  return {observations,cuts,status:this.getStatus()};
 }
}
