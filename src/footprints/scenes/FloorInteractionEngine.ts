import {toFootMotionEvent,type FootMotionEventV2} from './FootMotionEventV2.ts';
/** Unified, software-preview-only FLOOR interaction bus.
 * Existing camera gait engine owns metric contact; this engine NEVER estimates
 * foot pressure, grants projector output, or modifies FootstepEvent v3. */
export type FloorInteractionSource='camera'|'phone'|'video'|'simulator'|'touch';
export type FloorInteractionKind='presence'|'movement'|'contact'|'touch'|'slide'|'pivot'|'release';
export type FloorInteractionBasis='calibrated-estimate'|'image-2d'|'simulated'|'presence-only';
export type FloorInteractionEvent={
 id:string;originEventId?:string;source:FloorInteractionSource;kind:FloorInteractionKind;
 actorId:string;foot?:'left'|'right';headingRad?:number;
 x:number;y:number;radius:number;speed:number;confidence:number;
 atMs:number;basis:FloorInteractionBasis;
 /** Truthful provenance. Even verified camera contacts are only estimated, not force readings. */
 verified:boolean;
};
export type FloorObservation=Pick<FloorInteractionEvent,
 'source'|'actorId'|'x'|'y'|'confidence'|'atMs'|'basis'>;
export type FloorContactInput=FloorObservation&{
 eventId:string;foot:'left'|'right';verified:boolean;kind?:'contact'|'touch';
 headingRad?:number;
};
export type FloorMotionInput=FloorObservation&{
 eventId:string;foot:'left'|'right';kind:'slide'|'pivot'|'release';
 headingRad?:number;
};
export type FloorInteractionSnapshot={
 source:FloorInteractionSource|null;events:FloorInteractionEvent[];
 actors:string[];counts:Record<FloorInteractionKind,number>;
};
const kinds=['presence','movement','contact','touch','slide','pivot','release'] as const;
let engineInstanceSerial=0;
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const unit=(n:unknown)=>finite(n)&&n>=0&&n<=1;
const valid=(o:FloorObservation)=>unit(o.x)&&unit(o.y)&&unit(o.confidence)&&
 finite(o.atMs)&&o.atMs>=0&&typeof o.actorId==='string'&&o.actorId.length>0&&o.actorId.length<=64;
const emptyCounts=()=>({presence:0,movement:0,contact:0,touch:0,slide:0,pivot:0,release:0});
type Last={x:number;y:number;atMs:number};
export class FloorInteractionEngine{
 private source:FloorInteractionSource|null=null;
 private events:FloorInteractionEvent[]=[];
 private actorPositions=new Map<string,Last>();
 private lastPresenceEmit=new Map<string,number>();
 private seenContacts=new Set<string>();
 private seenOrder:string[]=[];
 private serial=0;
 private epoch=0;
 private readonly instanceId=++engineInstanceSerial;
 private sessionId='floor-session-'+this.instanceId+'-0';
 get generation(){return this.epoch;}
 get activeSource(){return this.source;}
 get currentSessionId(){return this.sessionId;}
 get canonicalRecent():readonly FootMotionEventV2[]{
  return this.events.map(event=>toFootMotionEvent(event,this.sessionId,this.epoch));
 }
 reset(source:FloorInteractionSource|null=null){
  this.epoch++;
  this.sessionId='floor-session-'+this.instanceId+'-'+this.epoch;
  this.source=source;this.events=[];this.actorPositions.clear();this.lastPresenceEmit.clear();
  this.seenContacts.clear();this.seenOrder=[];this.serial=0;
 }
 private push(part:Omit<FloorInteractionEvent,'id'>){
  const event={...part,id:'interaction-'+(++this.serial)} as FloorInteractionEvent;
  this.events.push(event);
  if(this.events.length>480)this.events.splice(0,this.events.length-480);
  return event;
 }
 private accepts(o:FloorObservation):boolean{
  return this.source===o.source&&valid(o);
 }
 observe(o:FloorObservation):FloorInteractionEvent|null{
  if(!this.accepts(o))return null;
  const key=o.source+':'+o.actorId,previous=this.actorPositions.get(key);
  if(previous&&o.atMs<=previous.atMs)return null;
  const distance=previous?Math.hypot(o.x-previous.x,o.y-previous.y):0;
  const delta=previous?o.atMs-previous.atMs:0;
  this.actorPositions.set(key,{x:o.x,y:o.y,atMs:o.atMs});
  const still=!!previous&&delta<=550&&distance<.006;
  // Stationary presence must still drive fog/swarm/firefly scenes while a
  // person stays in place. Heartbeats do NOT create footprint contacts.
  if(still&&o.atMs-(this.lastPresenceEmit.get(key)??0)<420)return null;
  const kind:FloorInteractionKind=!previous||delta>550||still?'presence':'movement';
  if(kind==='presence')this.lastPresenceEmit.set(key,o.atMs);
  const speed=kind==='movement'?Math.min(1,distance/Math.max(1,delta)*750):0;
  return this.push({...o,kind,speed,radius:.035,verified:false});
 }
 contact(o:FloorContactInput):FloorInteractionEvent|null{
  if(!this.accepts(o)||!o.eventId||o.eventId.length>180||
   !['left','right'].includes(o.foot)||!o.verified||
   o.actorId.startsWith('unassigned-')||
   (o.headingRad!==undefined&&!finite(o.headingRad))||
   (o.kind==='touch'&&o.source!=='touch')||
   (o.kind!=='touch'&&o.source==='touch'))return null;
  // An untrusted visual observation never becomes a contact.
  if(o.source!=='touch'&&o.basis==='presence-only')return null;
  const key=o.source+':'+o.actorId+':'+o.foot+':'+o.eventId;
  if(this.seenContacts.has(key))return null;
  this.seenContacts.add(key);this.seenOrder.push(key);
  if(this.seenOrder.length>6000)this.seenContacts.delete(this.seenOrder.shift()!);
  return this.push({source:o.source,actorId:o.actorId,originEventId:o.eventId,
   x:o.x,y:o.y,confidence:o.confidence,atMs:o.atMs,basis:o.basis,
   kind:o.kind??'contact',foot:o.foot,headingRad:o.headingRad,
   radius:.03,speed:0,verified:o.verified});
 }
 /** Visual movement evidence can reshape the current stamped contact,
  * but NEVER adds another contact or inherits hardware authorization. */
 motion(o:FloorMotionInput):FloorInteractionEvent|null{
  if(!this.accepts(o)||!o.eventId||o.eventId.length>180||
   o.actorId.startsWith('unassigned-')||
   !['left','right'].includes(o.foot)||
   !['slide','pivot','release'].includes(o.kind)||
   (o.headingRad!==undefined&&!finite(o.headingRad))||
   (o.source!=='touch'&&o.basis==='presence-only'))return null;
  const previous=[...this.events].reverse().find(e=>e.actorId===o.actorId&&
   e.foot===o.foot&&e.atMs<=o.atMs&&
   (e.kind==='contact'||e.kind==='touch'||e.kind==='release'));
  // An articulated motion without a preceding live contact is not a sole.
  if(!previous||previous.kind==='release')return null;
  const key='motion:'+o.source+':'+o.actorId+':'+o.foot+':'+o.eventId;
  if(this.seenContacts.has(key))return null;
  this.seenContacts.add(key);this.seenOrder.push(key);
  if(this.seenOrder.length>6000)this.seenContacts.delete(this.seenOrder.shift()!);
  return this.push({source:o.source,actorId:o.actorId,originEventId:o.eventId,
   foot:o.foot,headingRad:o.headingRad,
   x:o.x,y:o.y,confidence:o.confidence,atMs:o.atMs,basis:o.basis,
   kind:o.kind,radius:.03,speed:0,verified:false});
 }
 release(o:FloorObservation):FloorInteractionEvent|null{
  if(!this.accepts(o))return null;
  const key=o.source+':'+o.actorId;
  this.actorPositions.delete(key);this.lastPresenceEmit.delete(key);
  return this.push({...o,kind:'release',radius:.025,speed:0,verified:false});
 }
 expire(nowMs:number,ageMs=800){
  for(const [key,last] of this.actorPositions){
   if(nowMs-last.atMs>ageMs){
    this.actorPositions.delete(key);this.lastPresenceEmit.delete(key);
   }
  }
 }
 /** Atomically replace currently visible identities for one source while
  * retaining historical contact events. Unknown poses never masquerade as A/B. */
 keepActors(source:FloorInteractionSource,ids:readonly string[]){
  if(this.source!==source)return;
  const allowed=new Set(ids.map(id=>source+':'+id));
  for(const key of this.actorPositions.keys()){
   if(key.startsWith(source+':')&&!allowed.has(key)){
    this.actorPositions.delete(key);this.lastPresenceEmit.delete(key);
   }
  }
 }
 get snapshot():FloorInteractionSnapshot{
  const counts=emptyCounts();
  for(const event of this.events)counts[event.kind]++;
  return {source:this.source,events:this.events.slice(),
   actors:[...new Set([...this.actorPositions.keys()].map(k=>k.split(':').slice(1).join(':')))],
   counts};
 }
 get recent():readonly FloorInteractionEvent[]{return this.events;}
}
/** Strictly a SOFTWARE preview check; never a projector hardware authorization. */
export function floorEventCanStamp(event:FloorInteractionEvent){
 return (event.kind==='contact'||event.kind==='touch')&&event.verified;
}
export function floorEventPhysicalOutputAuthorized(_event:FloorInteractionEvent){return false;}
