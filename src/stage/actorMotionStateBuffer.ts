/**
 * S0.2 + S0.3 — low-latency, display-only temporal motion layer.
 *
 * MediaPipe/D2/D3/gait remain authoritative. This buffer consumes snapshots
 * already approved by the A/B identity gate and NEVER emits foot contacts,
 * changes actor identity, or writes projector output.
 *
 * One Euro scalar filters are independent for each actor, landmark and axis.
 * Rendering samples are interpolation or <=55ms capped prediction to keep
 * BODY motion continuous between low-rate AI results (e.g. 12 FPS).
 */
import type {Landmark} from '../engine/types.ts';
import {POSE_LANDMARK_COUNT,SKELETON_COLORS} from './fullBodySkeleton.ts';
import {ContactAwareFootLock,type FootLockSample} from './contactAwareFootLock.ts';
import type {PersistentActorState} from './persistentActorRegistry.ts';

export type MotionActorId='A'|'B';
export type MotionSnapshot=FootLockSample&{persistentActors?:PersistentActorState[]};
export type MotionVisualActor={
 id:MotionActorId;pose:Landmark[];opacity:number;mode:'measured'|'interpolated'|'predicted'|'held';
 ageMs:number;color:string;label:string;lockedFeet?:Array<'left'|'right'>;
 // 'held' is a visually retained measurement, never a confirmed identity.
 tentative?:boolean;
};
export type MotionVisualFrame={actors:MotionVisualActor[];atMs:number;renderDelayMs:number};
export type MotionFilterConfig={
 minCutoff:number;beta:number;derivativeCutoff:number;
 renderDelayMs:number;predictionLimitMs:number;staleLimitMs:number;fadeStartMs:number;
};
export const DEFAULT_MOTION_FILTER:MotionFilterConfig={
 minCutoff:2.4,beta:.65,derivativeCutoff:1,
 renderDelayMs:50,predictionLimitMs:55,staleLimitMs:650,fadeStartMs:275
};
const clamp=(x:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,x));
const valid=(p:Landmark|undefined):boolean=>Boolean(p&&
 Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&
 (p.visibility===undefined||p.visibility>=.2));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const lerpPose=(a:readonly Landmark[],b:readonly Landmark[],t:number):Landmark[]=>
 b.map((p,i)=>{
  const old=a[i];
  if(!valid(p)||!valid(old))return {...p};
  return {...p,x:lerp(old.x,p.x,t),y:lerp(old.y,p.y,t),
   z:lerp(old.z,p.z,t),visibility:Math.min(old.visibility??1,p.visibility??1)};
 });

/** Derivative-based cutoff from Casiez et al. One Euro Filter. */
export class OneEuroScalar{
 private raw=0;private smooth=0;private derivative=0;private lastAtMs=-1;
 private readonly config:Pick<MotionFilterConfig,'minCutoff'|'beta'|'derivativeCutoff'>;
 constructor(config:Pick<MotionFilterConfig,'minCutoff'|'beta'|'derivativeCutoff'>=
  DEFAULT_MOTION_FILTER){this.config=config;}
 reset(){this.lastAtMs=-1;this.raw=0;this.smooth=0;this.derivative=0;}
 private alpha(cutoff:number,dt:number){
  const tau=1/(2*Math.PI*cutoff);
  return 1/(1+tau/dt);
 }
 update(value:number,atMs:number){
  if(!Number.isFinite(value)||!Number.isFinite(atMs))return value;
  if(this.lastAtMs<0||atMs<=this.lastAtMs||atMs-this.lastAtMs>550){
   this.raw=value;this.smooth=value;this.derivative=0;this.lastAtMs=atMs;
   return value;
  }
  const dt=clamp((atMs-this.lastAtMs)/1000,.001,.4);
  const velocity=(value-this.raw)/dt;
  const da=this.alpha(this.config.derivativeCutoff,dt);
  this.derivative=lerp(this.derivative,velocity,da);
  const cutoff=this.config.minCutoff+this.config.beta*Math.abs(this.derivative);
  this.smooth=lerp(this.smooth,value,this.alpha(cutoff,dt));
  this.raw=value;this.lastAtMs=atMs;
  return this.smooth;
 }
}
type MotionSample={atMs:number;pose:Landmark[]};
type JointFilter={x:OneEuroScalar;y:OneEuroScalar;z:OneEuroScalar};
type ActorBank={filters:JointFilter[];previous:MotionSample|null;latest:MotionSample;
 verified:boolean};
const ids=['A','B'] as const;
export class ActorMotionStateBuffer{
 private actors=new Map<MotionActorId,ActorBank>();
 private readonly footLock=new ContactAwareFootLock();
 private lastAtMs=-1;
 private segment:number|null=null;
 private readonly config:MotionFilterConfig;
 constructor(config:Partial<MotionFilterConfig>={}){
  this.config={...DEFAULT_MOTION_FILTER,...config};
 }
 reset(){this.actors.clear();this.footLock.reset();this.lastAtMs=-1;this.segment=null;}
 get latestAtMs(){return this.lastAtMs;}
 private createFilters():JointFilter[]{
  return Array.from({length:POSE_LANDMARK_COUNT},()=>({
   x:new OneEuroScalar(this.config),y:new OneEuroScalar(this.config),
   z:new OneEuroScalar(this.config)
  }));
 }
 ingest(frame:MotionSnapshot):boolean{
  if(!Number.isFinite(frame.atMs)||frame.atMs<0)return false;
  if(this.segment!==null&&frame.segment!==undefined&&frame.segment!==this.segment)this.reset();
  if(this.lastAtMs>=0&&frame.atMs<this.lastAtMs-1)this.reset();
  if(frame.segment!==undefined)this.segment=frame.segment;
  if(this.lastAtMs>=0&&frame.atMs<=this.lastAtMs)return false;
  // Keep bounded display continuity across slow worker samples. Each stale
  // filter is restarted independently; seek/segment still clears immediately.
  this.lastAtMs=frame.atMs;
  this.footLock.observe(frame);
  // S0.6.1: an ambiguous *frame* can still contain a valid observation for
  // actor A while B is reacquiring. Evaluate them independently.
  // Uncertain actors retain only their last measured, unlabeled pose.
  for(const id of ids){
   const assignment=frame.actorStates?.find(s=>s.id===id&&s.presence==='visible'&&
    s.rawIndex!==null);
   const observed=assignment?.rawIndex===null||assignment===undefined?undefined:
    frame.rawPoses?.[assignment.rawIndex];
   if(!observed||observed.length!==POSE_LANDMARK_COUNT){
    const old=this.actors.get(id);
    if(old){old.verified=false;old.previous=null;}
    else{
     // Rehydrate a recently observed track after a React preview remount.
     // Its original measurement timestamp remains unchanged: no fake freshness.
     const saved=frame.persistentActors?.find(a=>a.id===id&&a.registered&&
      a.lastPose?.length===POSE_LANDMARK_COUNT&&
      a.lastObservedAtMs!==null&&
      frame.atMs-a.lastObservedAtMs>=0&&
      frame.atMs-a.lastObservedAtMs<=this.config.staleLimitMs);
     if(saved?.lastPose&&saved.lastObservedAtMs!==null)
      this.actors.set(id,{filters:this.createFilters(),previous:null,
       verified:false,latest:{atMs:saved.lastObservedAtMs,
        pose:saved.lastPose.map(p=>({...p}))}});
    }
    continue;
   }
   let bank=this.actors.get(id);
   if(!bank){
    bank={filters:this.createFilters(),previous:null,verified:true,
     latest:{atMs:frame.atMs,pose:observed.map(p=>({...p}))}};
    this.actors.set(id,bank);
   }
   // Restart rather than interpolate across a long gap or an unobserved person.
   if(frame.atMs-bank.latest.atMs>300||!bank.verified){
    bank.filters=this.createFilters();bank.previous=null;
   }else if(bank.latest.atMs<frame.atMs){
    bank.previous=bank.latest;
   }
   const pose=observed.map((p,j)=>{
    const f=bank.filters[j];
    if(!valid(p)){f.x.reset();f.y.reset();f.z.reset();return {...p};}
    return {...p,
     x:f.x.update(p.x,frame.atMs),
     y:f.y.update(p.y,frame.atMs),
     z:f.z.update(p.z,frame.atMs)};
   });
   bank.latest={atMs:frame.atMs,pose};
   bank.verified=true;
  }
  return true;
 }
 private presentActor(id:MotionActorId,bank:ActorBank,videoAtMs:number):MotionVisualActor|null{
  const latest=bank.latest,age=videoAtMs-latest.atMs;
  if(!Number.isFinite(age)||age< -60||age>this.config.staleLimitMs)return null;
  const target=videoAtMs-this.config.renderDelayMs,prev=bank.previous;
  // A measured skeleton may outlive its A/B certainty for a short visual
  // interval. Label/color it neutral; never imply a confirmed actor.
  const tentative=!bank.verified||age>this.config.fadeStartMs;
  let pose=latest.pose,mode:MotionVisualActor['mode']=tentative?'held':'measured';
  if(!tentative&&prev&&target>=prev.atMs&&target<latest.atMs){
   const t=clamp((target-prev.atMs)/(latest.atMs-prev.atMs),0,1);
   pose=lerpPose(prev.pose,latest.pose,t);mode='interpolated';
  }else if(!tentative&&prev&&target>latest.atMs&&
   latest.atMs-prev.atMs>10&&latest.atMs-prev.atMs<=250){
   // Short visual-only extrapolation; never updates the authoritative pose.
   const dt=clamp(target-latest.atMs,0,this.config.predictionLimitMs);
   const span=latest.atMs-prev.atMs;
   pose=latest.pose.map((p,j)=>{
    const old=prev.pose[j];
    if(!valid(p)||!valid(old))return {...p};
    return {...p,
     x:p.x+clamp((p.x-old.x)*dt/span,-.035,.035),
     y:p.y+clamp((p.y-old.y)*dt/span,-.035,.035),
     z:p.z+clamp((p.z-old.z)*dt/span,-.06,.06)};
   });
   if(dt>0)mode='predicted';
  }else if(!tentative&&prev&&target<prev.atMs){
   pose=prev.pose;
  }
  // One monotone fade. Worker gaps and transient lost/ambiguous frames must
  // never toggle the visual between a full skeleton and a black canvas.
  const fadeStart=Math.max(110,Math.min(this.config.fadeStartMs,
   this.config.staleLimitMs-1));
  const opacity=age<=fadeStart?1:
   clamp((this.config.staleLimitMs-age)/(this.config.staleLimitMs-fadeStart),0,1);
  if(opacity<=0)return null;
  const locked=tentative?{pose,lockedFeet:[] as Array<'left'|'right'>}:
   this.footLock.apply(id,pose,videoAtMs);
  return {id,pose:locked.pose,lockedFeet:locked.lockedFeet,opacity,mode,
   ageMs:Math.max(0,age),tentative,
   color:tentative?'#a0aaa6':SKELETON_COLORS[id==='A'?0:1],
   label:tentative?'':'ACTOR '+id};
 }
 present(videoAtMs:number):MotionVisualFrame{
  const actors:MotionVisualActor[]=[];
  if(Number.isFinite(videoAtMs))
   for(const id of ids){
    const bank=this.actors.get(id);
    if(!bank)continue;
    const actor=this.presentActor(id,bank,videoAtMs);
    if(actor)actors.push(actor);
   }
  return {actors,atMs:videoAtMs,renderDelayMs:this.config.renderDelayMs};
 }
}
