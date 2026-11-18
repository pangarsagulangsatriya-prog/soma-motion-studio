/**
 * S0.5 — contact-aware *visual* foot anchor for BODY replay.
 * Uses only authoritative, QA-approved video gait contact events, never a
 * predicted contact. Image-space 2D compensation is not calibrated floor 3D.
 */
import type {Landmark} from '../engine/types.ts';
export type LockActor='A'|'B';
export type LockFoot='left'|'right';
export type FootLockSample={
 atMs:number;segment?:number;ambiguous?:boolean;
 rawPoses?:Landmark[][];
 actorStates?:Array<{id:LockActor;presence:string;rawIndex:number|null}>;
 people?:Array<{id:LockActor}>;
 gait?:Record<string,{phase:string;motion:string;confidence:number}>;
 events?:Array<{id?:string;kind:string;performer:LockActor;foot:LockFoot;
  atMs:number;confidence?:number}>;
};
type Anchor={x:number;y:number;lastMs:number;contactId:string};
const indices=(side:LockFoot):[number,number,number]=>
 side==='left'?[27,29,31]:[28,30,32];
const valid=(p:Landmark|undefined)=>Boolean(p&&Number.isFinite(p.x)&&
 Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
 (p.visibility??0)>=.6);
function footCenter(pose:readonly Landmark[],side:LockFoot){
 const [,heel,toe]=indices(side);
 const a=pose[heel],b=pose[toe];
 if(!valid(a)||!valid(b))return null;
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
}
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>
 Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v:number,limit:number)=>
 Math.max(-limit,Math.min(limit,v));
export class ContactAwareFootLock{
 private anchors=new Map<string,Anchor>();
 private usedContactIds=new Set<string>();
 private lastAtMs=-1;
 private segment:number|null=null;
 reset(){
  this.anchors.clear();this.usedContactIds.clear();
  this.lastAtMs=-1;this.segment=null;
 }
 private dropActor(id:LockActor){
  this.anchors.delete(id+':left');this.anchors.delete(id+':right');
 }
 observe(frame:FootLockSample){
  const atMs=frame.atMs;
  if(!Number.isFinite(atMs)||atMs<0)return;
  if(this.segment!==null&&frame.segment!==undefined&&frame.segment!==this.segment)
   this.reset();
  if(this.lastAtMs>=0&&(atMs<this.lastAtMs-1||atMs-this.lastAtMs>350))
   this.reset();
  if(frame.segment!==undefined)this.segment=frame.segment;
  if(this.lastAtMs>=0&&atMs<=this.lastAtMs)return;
  this.lastAtMs=atMs;
  // Collision/ambiguous identity invalidates any labeled visual foot anchor.
  if(frame.ambiguous){this.anchors.clear();return;}
  for(const id of ['A','B'] as const){
   const actor=frame.actorStates?.find(a=>a.id===id);
   const approved=frame.people?.some(p=>p.id===id);
   if(!approved||actor?.presence!=='visible'||actor.rawIndex===null){
    this.dropActor(id);continue;
   }
   const pose=frame.rawPoses?.[actor.rawIndex];
   if(!pose||pose.length!==33){this.dropActor(id);continue;}
   for(const foot of ['left','right'] as const){
    const key=id+':'+foot,state=frame.gait?.[key],point=footCenter(pose,foot);
    if(!state||!point||state.phase!=='stance'||state.motion!=='hold'||
       state.confidence<.72){this.anchors.delete(key);continue;}
    const current=this.anchors.get(key);
    if(current){
     // A foot that truly moved or dropped out cannot remain pinned to old video.
     if(atMs-current.lastMs>300||distance(point,current)>.045)
      this.anchors.delete(key);
     else{current.lastMs=atMs;continue;}
    }
    const contact=frame.events?.slice().reverse().find(e=>e.kind==='contact'&&
     e.performer===id&&e.foot===foot&&
     atMs-e.atMs>=0&&atMs-e.atMs<=230&&
     (e.confidence??0)>=.72);
    if(!contact)continue;
    const contactId=contact.id??id+':'+foot+':'+contact.atMs;
    if(this.usedContactIds.has(contactId))continue;
    this.usedContactIds.add(contactId);
    // Avoid unbounded storage in long rehearsals.
    if(this.usedContactIds.size>3000)this.usedContactIds.clear();
    this.anchors.set(key,{...point,lastMs:atMs,contactId});
   }
  }
 }
 apply(id:LockActor,pose:readonly Landmark[],videoAtMs:number):{
  pose:Landmark[];lockedFeet:LockFoot[];
 }{
  const out=pose.map(p=>({...p})),lockedFeet:LockFoot[]=[];
  if(pose.length!==33||!Number.isFinite(videoAtMs))return {pose:out,lockedFeet};
  for(const foot of ['left','right'] as const){
   const anchor=this.anchors.get(id+':'+foot);
   const center=footCenter(pose,foot);
   if(!anchor||!center||videoAtMs<anchor.lastMs-70||
      videoAtMs-anchor.lastMs>270||distance(center,anchor)>.06)continue;
   // Small corrective translation preserves ankle/heel/toe geometry.
   // Large drift, slides and pivots never become artificial planted contacts.
   const dx=clamp(anchor.x-center.x,.028),dy=clamp(anchor.y-center.y,.028);
   for(const index of indices(foot)){
    const p=out[index];
    if(!valid(p))continue;
    p.x=Math.max(0,Math.min(1,p.x+dx));
    p.y=Math.max(0,Math.min(1,p.y+dy));
   }
   lockedFeet.push(foot);
  }
  return {pose:out,lockedFeet};
 }
}
