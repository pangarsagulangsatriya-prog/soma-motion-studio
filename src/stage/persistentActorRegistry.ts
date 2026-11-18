/**
 * S0.6.1 Persistent Actor Registry — part of the PRIMARY MP4 movement engine.
 *
 * Track A and B survive independently when poseCount drops to 1 or 0.
 * Only trusted D2 assignments can update measured pose or position.
 * Cached poses are OBSERVATIONS, not current detections, identities or gait
 * contacts. Future optical-flow tracking (S0.6.2) can update a separate
 * visual hypothesis without bypassing identity / projection safety gates.
 */
import type {Landmark} from '../engine/types.ts';
import type {
 VideoActorId,VideoActorPresence,VideoActorState,VideoActorAssignment
} from './videoAutoActorTracker.ts';

export type PersistentActorState={
 id:VideoActorId;
 registered:boolean;
 /** Current detector association, never inferred from a cached pose. */
 observed:boolean;
 presence:VideoActorPresence;
 rawIndex:number|null;
 lastObservedAtMs:number|null;
 ageMs:number|null;
 /** Last measured pose: historical while observed=false. */
 lastPose:Landmark[]|null;
 /** Image-normalized body center and previous measured velocity in units/sec. */
 center:{x:number;y:number}|null;
 velocity:{x:number;y:number}|null;
 box:{x:number;y:number;width:number;height:number}|null;
 confidence:number;
 observedFrames:number;
};
type Stored={
 id:VideoActorId;
 atMs:number;
 pose:Landmark[];
 center:{x:number;y:number};
 velocity:{x:number;y:number};
 box:{x:number;y:number;width:number;height:number}|null;
 confidence:number;
 observedFrames:number;
};
const IDS=['A','B'] as const;
const finite=(n:number)=>Number.isFinite(n);
const copy=(p:Landmark[]):Landmark[]=>p.map(v=>({...v}));
function geometry(pose:readonly Landmark[]){
 const torso=[11,12,23,24].filter(i=>{
  const p=pose[i];
  return p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
   (p.visibility??1)>=.35;
 });
 if(torso.length<2)return null;
 const center={x:torso.reduce((s,i)=>s+pose[i].x,0)/torso.length,
  y:torso.reduce((s,i)=>s+pose[i].y,0)/torso.length};
 const usable=pose.filter(p=>finite(p.x)&&finite(p.y)&&
  p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??1)>=.35);
 const box=usable.length<6?null:{
  x:Math.min(...usable.map(p=>p.x)),
  y:Math.min(...usable.map(p=>p.y)),
  width:Math.max(...usable.map(p=>p.x))-Math.min(...usable.map(p=>p.x)),
  height:Math.max(...usable.map(p=>p.y))-Math.min(...usable.map(p=>p.y))
 };
 return {center,box};
}
export class PersistentActorRegistry{
 private entries=new Map<VideoActorId,Stored>();
 private lastAtMs=-1;
 private current:PersistentActorState[]=[];
 reset(){this.entries.clear();this.lastAtMs=-1;this.current=this.blank();}
 private blank():PersistentActorState[]{
  return IDS.map(id=>({
   id,registered:false,observed:false,presence:'not-detected',
   rawIndex:null,lastObservedAtMs:null,ageMs:null,lastPose:null,
   center:null,velocity:null,box:null,confidence:0,observedFrames:0
  }));
 }
 constructor(){this.current=this.blank();}
 get registeredCount(){return this.entries.size;}
 get snapshot():PersistentActorState[]{
  return this.current.map(entry=>({
   ...entry,lastPose:entry.lastPose?copy(entry.lastPose):null,
   center:entry.center?{...entry.center}:null,
   velocity:entry.velocity?{...entry.velocity}:null,
   box:entry.box?{...entry.box}:null
  }));
 }
 /**
  * Exactly one update per accepted video timestamp. Unobserved A never
  * removes or alters B, and vice versa. No global "ambiguous" reset.
  */
 observe(atMs:number,actors:readonly VideoActorState[],
  assignments:readonly VideoActorAssignment[]):PersistentActorState[]{
  if(!finite(atMs)||atMs<0)throw Error('Persistent actor time invalid.');
  if(this.lastAtMs>=0&&atMs<this.lastAtMs-1)this.reset();
  if(this.lastAtMs>=0&&atMs<=this.lastAtMs)return this.snapshot;
  this.lastAtMs=atMs;
  const used=new Set<number>();
  const next:PersistentActorState[]=[];
  for(const id of IDS){
   const state=actors.find(a=>a.id===id);
   const candidate=assignments.find(a=>a.id===id&&a.pose.length===33&&
    Number.isInteger(a.rawIndex)&&a.rawIndex>=0&&!used.has(a.rawIndex));
   let stored=this.entries.get(id);
   let observed=false;
   if(state?.presence==='visible'&&candidate){
    const shape=geometry(candidate.pose);
    if(shape){
     used.add(candidate.rawIndex);
     observed=true;
     const elapsed=stored?(atMs-stored.atMs)/1000:0;
     const velocity=stored&&elapsed>.005&&elapsed<=.55?{
      x:(shape.center.x-stored.center.x)/elapsed,
      y:(shape.center.y-stored.center.y)/elapsed
     }:stored?.velocity??{x:0,y:0};
     stored={id,atMs,pose:copy(candidate.pose),
      center:shape.center,box:shape.box,
      velocity,confidence:candidate.confidence,
      observedFrames:(stored?.observedFrames??0)+1};
     this.entries.set(id,stored);
    }
   }
   // Registry retains the last measurement for the whole playback segment.
   // Freshness, label/pose QA and blackout remain separate downstream gates.
   const age=stored?Math.max(0,atMs-stored.atMs):null;
   next.push({
    id,registered:!!stored,observed,
    presence:observed?'visible':state?.presence??(stored?'occluded':'not-detected'),
    rawIndex:observed?candidate!.rawIndex:null,
    lastObservedAtMs:stored?.atMs??null,ageMs:age,
    lastPose:stored?copy(stored.pose):null,
    center:stored?{...stored.center}:null,
    velocity:stored?{...stored.velocity}:null,
    box:stored?.box?{...stored.box}:null,
    confidence:stored?.confidence??0,
    observedFrames:stored?.observedFrames??0
   });
  }
  this.current=next;
  return this.snapshot;
 }
}
