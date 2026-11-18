/** Unified, software-preview-only FLOOR interaction bus.
 * Existing camera gait engine owns metric contact; this engine NEVER estimates
 * foot pressure, grants projector output, or modifies FootstepEvent v3. */
export type FloorInteractionSource='camera'|'phone'|'video'|'simulator'|'touch';
export type FloorInteractionKind='presence'|'movement'|'contact'|'touch'|'release';
export type FloorInteractionBasis='calibrated-estimate'|'image-2d'|'simulated'|'presence-only';
export type FloorInteractionEvent={
 id:string;source:FloorInteractionSource;kind:FloorInteractionKind;
 actorId:string;foot?:'left'|'right';
 x:number;y:number;radius:number;speed:number;confidence:number;
 atMs:number;basis:FloorInteractionBasis;
 /** Truthful provenance. Even verified camera contacts are only estimated, not force readings. */
 verified:boolean;
};
export type FloorObservation=Pick<FloorInteractionEvent,
 'source'|'actorId'|'x'|'y'|'confidence'|'atMs'|'basis'>;
export type FloorContactInput=FloorObservation&{
 eventId:string;foot:'left'|'right';verified:boolean;kind?:'contact'|'touch';
};
export type FloorInteractionSnapshot={
 source:FloorInteractionSource|null;events:FloorInteractionEvent[];
 actors:string[];counts:Record<FloorInteractionKind,number>;
};
const kinds=['presence','movement','contact','touch','release'] as const;
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const unit=(n:unknown)=>finite(n)&&n>=0&&n<=1;
const valid=(o:FloorObservation)=>unit(o.x)&&unit(o.y)&&unit(o.confidence)&&
 finite(o.atMs)&&o.atMs>=0&&typeof o.actorId==='string'&&o.actorId.length>0&&o.actorId.length<=64;
const emptyCounts=()=>({presence:0,movement:0,contact:0,touch:0,release:0});
type Last={x:number;y:number;atMs:number};
export class FloorInteractionEngine{
 private source:FloorInteractionSource|null=null;
 private events:FloorInteractionEvent[]=[];
 private actorPositions=new Map<string,Last>();
 private seenContacts=new Set<string>();
 private seenOrder:string[]=[];
 private serial=0;
 get activeSource(){return this.source;}
 reset(source:FloorInteractionSource|null=null){
  this.source=source;this.events=[];this.actorPositions.clear();
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
  if(previous&&delta<=550&&distance<.006)return null;
  const kind:FloorInteractionKind=!previous||delta>550?'presence':'movement';
  const speed=kind==='movement'?Math.min(1,distance/Math.max(1,delta)*750):0;
  return this.push({...o,kind,speed,radius:.035,verified:false});
 }
 contact(o:FloorContactInput):FloorInteractionEvent|null{
  if(!this.accepts(o)||!o.eventId||o.eventId.length>180||
   !['left','right'].includes(o.foot)||!o.verified||
   (o.kind==='touch'&&o.source!=='touch')||
   (o.kind!=='touch'&&o.source==='touch'))return null;
  // An untrusted visual observation never becomes a contact.
  if(o.source!=='touch'&&o.basis==='presence-only')return null;
  const key=o.source+':'+o.eventId;
  if(this.seenContacts.has(key))return null;
  this.seenContacts.add(key);this.seenOrder.push(key);
  if(this.seenOrder.length>6000)this.seenContacts.delete(this.seenOrder.shift()!);
  return this.push({source:o.source,actorId:o.actorId,
   x:o.x,y:o.y,confidence:o.confidence,atMs:o.atMs,basis:o.basis,
   kind:o.kind??'contact',foot:o.foot,radius:.03,speed:0,verified:o.verified});
 }
 release(o:FloorObservation):FloorInteractionEvent|null{
  if(!this.accepts(o))return null;
  const key=o.source+':'+o.actorId;
  this.actorPositions.delete(key);
  return this.push({...o,kind:'release',radius:.025,speed:0,verified:false});
 }
 expire(nowMs:number,ageMs=800){
  for(const [key,last] of this.actorPositions){
   if(nowMs-last.atMs>ageMs)this.actorPositions.delete(key);
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
