import {cameraGroundToFloor,floorToUV,stageUVToRawCamera,type CameraFloorCalibration}
 from '../../spatial/coordinates.ts';
import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {ActorMotionFrame} from './ActorMotionFrameBuilder.ts';
import type {ActorPathObservation,PathPoint} from './PathObservationRouter.ts';
import {ActorContinuityCoordinator} from './ActorContinuityCoordinator.ts';
import type {BridgeContext} from './ContinuityBridgeValidator.ts';

type Spatial={calibration:CameraFloorCalibration;videoAspect:number;calibrationId:string};
type Basis='dual-foot-and-hip'|'one-foot-hip-assisted'|'hip-short-gap'|
 'foot-only-low-confidence'|'unavailable';
type State={
 sourceKey:string;footEpoch:number;timeMs:number;footAtMs:number;
 point:PathPoint;confirmed:PathPoint;hipPx?:PathPoint;
 imageAnchorPx?:PathPoint;lastFootPx?:PathPoint;
 lastFootObservation:ActorPathObservation;
 pending:ActorPathObservation[];lastMotion?:PathPoint;
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
 readonly continuity=new ActorContinuityCoordinator();
 private statuses:TrajectoryEstimate['status']={
  A:{basis:'unavailable',feet:0,confidence:0},
  B:{basis:'unavailable',feet:0,confidence:0}
 };
 private lastSignature='';
 reset(){this.states.clear();this.continuity.reset();this.lastSignature='';this.statuses={
  A:{basis:'unavailable',feet:0,confidence:0},
  B:{basis:'unavailable',feet:0,confidence:0}
 };}
 getStatus(){return {A:{...this.statuses.A},B:{...this.statuses.B}};}
 summary(){return actors.map(actor=>{
  const s=this.statuses[actor];
  return actor+': '+s.feet+'/2 kaki · '+s.basis+' ('+s.confidence.toFixed(2)+')';
 }).join(' | ');}
 ingest(footObservations:readonly ActorPathObservation[],
  frames:readonly ActorMotionFrame[],spatial?:Spatial,enableV23=false):TrajectoryEstimate{
  if(!enableV23)this.continuity.reset();
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
   const context=(footRef?:ActorPathObservation):BridgeContext=>({
    actorId:actor,sourceKey:footRef?.sourceKey??(spatial?frame?.sourceKey+'|floor:'+spatial.calibrationId:frame?.sourceKey??''),
    clipStableId:footRef?.clipStableId??'',epoch:footRef?.epoch??0,
    transformKey:signature,identityConfidence:frame?.identityConfidence??0,
    torsoScalePx:frame?.torsoScalePx??80
   });
   let state=this.states.get(actor);
   if(frame&&state&&
    (state.sourceKey!==frame.sourceKey||
     frame.timeMs<=state.timeMs||frame.timeMs-state.timeMs>900)){
    if(enableV23&&this.continuity.has(actor))this.continuity.reject(actor,'bridge-source-change');
    cuts.push({actorId:actor,reason:'trajectory-source-or-gap'});
    this.states.delete(actor);state=undefined;
   }
   if(!frame){
    if(foot){
     if(enableV23&&this.continuity.has(actor))this.continuity.reject(actor,'bridge-missing-hip');
     // Pure foot-only V2.1 fallback (simulator, demo or missing hip).
     observations.push(foot);
     this.states.delete(actor);
     this.statuses[actor]={basis:'foot-only-low-confidence',feet,confidence:foot.confidence};
    }else{
     if(enableV23&&this.continuity.has(actor))this.continuity.reject(actor,'bridge-missing-hip');
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
    if(enableV23)this.continuity.observe(actor);
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
    if(enableV23&&this.continuity.has(actor))this.continuity.reject(actor,'teleport');
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
       (enableV23?this.continuity.pendingCount>=12:state.pending.length>=6)){
     if(enableV23&&this.continuity.has(actor))this.continuity.reject(actor,'gap-expired');
     cuts.push({actorId:actor,reason:'hip-only-gap-expired'});
     this.states.delete(actor);
     this.statuses[actor]={basis:'unavailable',feet:0,confidence:quality};
     continue;
    }
    const nextPoint=add(state.point,cap(hipDelta,maxMotion));
    if(!valid(nextPoint)){
     if(enableV23&&this.continuity.has(actor))this.continuity.reject(actor,'invalid-coordinate');
     cuts.push({actorId:actor,reason:'hip-outside-floor'});
     this.states.delete(actor);continue;
    }
    const provisional={...state.lastFootObservation,
     timeMs:frame.timeMs,point:nextPoint,confidence:clamp(quality*.72,.55,.9),
     footEvent:'none' as const,motionBasis:'hip-short-gap' as const};
    if(enableV23){
     if(!this.continuity.has(actor)){
      const start={...state.lastFootObservation,point:state.confirmed};
      this.continuity.begin(start,context(start),state.lastMotion);
     }
     if(!this.continuity.append(actor,provisional)){
      this.continuity.reject(actor,'bridge-budget');
      cuts.push({actorId:actor,reason:'bridge-budget'});
      this.states.delete(actor);
      continue;
     }
    }else state.pending.push(provisional);
    state.point=nextPoint;state.hipPx={...frame.hipPx};
    state.imageAnchorPx=estimatedImageAnchor;
    state.timeMs=frame.timeMs;
    this.statuses[actor]={basis:'hip-short-gap',feet:0,confidence:quality*.72};
    continue;
   }
   // The foot adapter epoch is independent from the approved pose epoch.
   // If the adapter restarted, do not connect its new feet to old ink.
   if(foot.epoch!==state.footEpoch){
    if(enableV23&&this.continuity.has(actor))this.continuity.reject(actor,'bridge-source-change');
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
   if((enableV23?this.continuity.has(actor):state.pending.length>0)&&drift>limit){
    if(enableV23)this.continuity.reject(actor,'bridge-recovery-too-far');
    cuts.push({actorId:actor,reason:'hip-recovery-mismatch'});
    this.states.delete(actor);
    observations.push(foot); // tracker starts a NEW segment after CUT
    this.statuses[actor]={basis:'foot-only-low-confidence',feet,confidence:foot.confidence};
    continue;
   }
   nextPoint=add(nextPoint,cap(difference,feet===2?7:3));
   if(!valid(nextPoint)){
    if(enableV23&&this.continuity.has(actor))this.continuity.reject(actor,'invalid-coordinate');
    cuts.push({actorId:actor,reason:'trajectory-outside-floor'});
    this.states.delete(actor);continue;
   }
   const accepted={...foot,point:nextPoint,
    confidence:clamp(Math.min(foot.confidence,quality),.55,1),
    motionBasis:feet===2?'dual-foot-and-hip' as const:'one-foot-hip-assisted' as const};
   if(enableV23){
    const result=this.continuity.recover(actor,accepted,context(foot));
    if(result.cutReason){
     cuts.push({actorId:actor,reason:result.cutReason});
     this.states.delete(actor);
     observations.push(foot); // start at observed foot, not at a bad bridge
     continue;
    }
    observations.push(...result.observations);
   }else{
    if(state.pending.length)observations.push(...state.pending);
    state.pending=[]; // legacy V2.2 pending owner
    observations.push(accepted);
   }
   const step=sub(nextPoint,state.confirmed);
   if(norm(step)>=2)state.lastMotion=mul(step,1/norm(step));
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
