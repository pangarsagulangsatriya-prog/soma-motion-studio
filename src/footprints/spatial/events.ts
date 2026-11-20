import {insideFloor,validFloorPoint,validateFloorSpace,type FloorPoint,type FloorSpace} from './coordinates.ts';

export type FootSide='left'|'right';
export type FootEventKind='swing'|'contact'|'release'|'move'|'prediction';
export type FootSource='camera'|'simulation'|'replay'|'legacy';
/**
 * 'calibrated-estimate' describes a camera-based floor assumption, NOT a
 * measured ground contact. 'illustrative' is non-metric legacy footage.
 */
export type PositionBasis='simulated'|'calibrated-estimate'|'illustrative';
export type FootstepEvent={
 id:string;performerId:string;foot:FootSide;kind:FootEventKind;
 timestampMs:number;positionM:FloorPoint;headingRad:number;
 source:FootSource;positionBasis:PositionBasis;confidence:number;
 /** If false, a visual trail must start a new segment here. */
 joinPrevious?:boolean;
};
export type FloorSession={
 schema:'soma.footprints.floor-session';version:3;
 floor:FloorSpace;events:FootstepEvent[];
};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const asObject=(v:unknown):Record<string,unknown>|null=>
 typeof v==='object'&&v!==null&&!Array.isArray(v)?v as Record<string,unknown>:null;
const sourceBasisAllowed=(source:FootSource,basis:PositionBasis)=>
 source==='simulation'?basis==='simulated':
 source==='camera'?basis==='calibrated-estimate':
 source==='legacy'?basis==='illustrative':
 ['simulated','calibrated-estimate','illustrative'].includes(basis);
export function validateFootstepEvent(raw:unknown,floor:FloorSpace):FootstepEvent{
 const v=asObject(raw);
 if(!v||typeof v.id!=='string'||!v.id||v.id.length>128||
    typeof v.performerId!=='string'||!v.performerId.trim()||v.performerId.length>64||
    !(v.foot==='left'||v.foot==='right')||
    !['contact','release','swing','move','prediction'].includes(String(v.kind))||
    !['camera','simulation','replay','legacy'].includes(String(v.source))||
    !['simulated','calibrated-estimate','illustrative'].includes(String(v.positionBasis))||
    !sourceBasisAllowed(v.source as FootSource,v.positionBasis as PositionBasis)||
    !finite(v.timestampMs)||v.timestampMs<0||
    !finite(v.headingRad)||!finite(v.confidence)||v.confidence<0||v.confidence>1||
    (v.joinPrevious!==undefined&&typeof v.joinPrevious!=='boolean')||
    !validFloorPoint(v.positionM)||!insideFloor(floor,v.positionM))
  throw Error('Event Footprints tidak valid atau berada di luar lantai.');
 return {
  id:v.id as string,performerId:v.performerId as string,foot:v.foot as FootSide,
  kind:v.kind as FootEventKind,timestampMs:v.timestampMs as number,
  positionM:{...v.positionM},headingRad:v.headingRad as number,
  source:v.source as FootSource,positionBasis:v.positionBasis as PositionBasis,
  confidence:v.confidence as number,
  ...(v.joinPrevious===undefined?{}:{joinPrevious:v.joinPrevious as boolean})
 };
}
export function createFloorSession(floor:FloorSpace,events:FootstepEvent[]=[]):FloorSession{
 return validateFloorSession({schema:'soma.footprints.floor-session',version:3,floor,events});
}
export function validateFloorSession(raw:unknown):FloorSession{
 const v=asObject(raw);
 if(!v||v.schema!=='soma.footprints.floor-session'||v.version!==3||!Array.isArray(v.events)||
    v.events.length>100000)throw Error('Format sesi lantai Footprints tidak didukung.');
 const floor=validateFloorSpace(v.floor),ids=new Set<string>();
 let last=-1;
 const events=v.events.map(e=>{
  const event=validateFootstepEvent(e,floor);
  if(ids.has(event.id)||event.timestampMs<last)throw Error('Event harus unik dan berurutan secara waktu.');
  ids.add(event.id);last=event.timestampMs;return event;
 });
 return {schema:'soma.footprints.floor-session',version:3,floor,events};
}
/** Illustrative V2 events are never allowed onto a metric floor automatically. */
export const canProjectMetric=(event:FootstepEvent)=>
 event.positionBasis==='simulated'||event.positionBasis==='calibrated-estimate';
export function requireProjectable(event:FootstepEvent):FootstepEvent{
 if(!canProjectMetric(event))throw Error('Jejak lama belum memiliki kalibrasi lantai. Pakai mode preview ilustratif.');
 return event;
}
/** Only confirmed/estimated contact events leave sole stamps. Prediction is a ghost, not a stamp. */
export const isContactStamp=(e:FootstepEvent)=>e.kind==='contact';

export type FootObservation={
 performerId:string;foot:FootSide;timestampMs:number;
 phase:'stance'|'swing'|'unknown';positionM:FloorPoint|null;
 headingRad:number;source:Exclude<FootSource,'legacy'>;positionBasis:Exclude<PositionBasis,'illustrative'>;
 confidence:number;
};
type FootState={phase:'stance'|'swing';positionM:FloorPoint|null;headingRad:number;
 lastVisualHeadingRad:number;timestampMs:number;source:FootSource;confirmed:boolean};
const distance=(a:FloorPoint,b:FloorPoint)=>Math.hypot(a.xM-b.xM,a.yM-b.yM);

/**
 * Deterministic state transitions for puppet, replay and calibrated camera:
 * - Exactly one contact on entry to stance.
 * - Release at the LAST known grounded location, not an airborne camera point.
 * - Tracking loss / stale camera samples re-arm on swing to avoid false stamps.
 * - Different performers/feet hold independent state.
 * No force, pressure or true contact is measured here.
 */
export class FootstepEventEngine{
 private state=new Map<string,FootState>();
 private rearm=new Set<string>();
 private serial=0;
 readonly floor:FloorSpace;
 readonly moveThresholdM:number;
 constructor(floor:FloorSpace,moveThresholdM=.025){
  this.floor=validateFloorSpace(floor);
  this.moveThresholdM=moveThresholdM;
  if(!finite(moveThresholdM)||moveThresholdM<=0||moveThresholdM>1)
   throw Error('Ambang pergerakan kaki harus dalam meter dan positif.');
 }
 reset(){this.state.clear();this.rearm.clear();this.serial=0;}
 loseTracking(performerId:string,foot:FootSide){
  const key=performerId+':'+foot;
  this.state.delete(key);this.rearm.add(key);
 }
 observe(o:FootObservation):FootstepEvent[]{
  if(!['stance','swing','unknown'].includes(o.phase)||!finite(o.timestampMs)||o.timestampMs<0||
     !finite(o.headingRad)||!finite(o.confidence)||o.confidence<0||o.confidence>1||
     !['left','right'].includes(o.foot)||!o.performerId.trim()||
     !sourceBasisAllowed(o.source,o.positionBasis))
   throw Error('Observasi kaki tidak valid.');
  if(o.positionM&&!validFloorPoint(o.positionM))throw Error('Posisi kaki bukan angka yang valid.');
  if(o.positionM&&!insideFloor(this.floor,o.positionM))throw Error('Posisi kaki di luar lantai.');
  const key=o.performerId+':'+o.foot,prior=this.state.get(key);
  if(prior&&o.timestampMs<=prior.timestampMs)return [];
  if(o.phase==='unknown'){
   this.loseTracking(o.performerId,o.foot);return [];
  }
  const interrupted=prior&&(o.source!==prior.source||(o.source==='camera'&&o.timestampMs-prior.timestampMs>450));
  if(interrupted)this.loseTracking(o.performerId,o.foot);
  const p=interrupted?undefined:prior;
  const events:FootstepEvent[]=[];
  const emit=(kind:FootEventKind,positionM:FloorPoint)=>{
   events.push(validateFootstepEvent({
    id:'foot-'+(++this.serial),performerId:o.performerId,foot:o.foot,kind,
    timestampMs:o.timestampMs,positionM,headingRad:o.headingRad,
    source:o.source,positionBasis:o.positionBasis,confidence:o.confidence
   },this.floor));
  };
  if(o.phase==='swing'){
   if(p?.phase==='stance'&&p.confirmed&&p.positionM)emit('release',p.positionM);
   else if(!p&&o.positionM)emit('swing',o.positionM);
   this.rearm.delete(key);
   this.state.set(key,{phase:'swing',positionM:o.positionM??p?.positionM??null,
    headingRad:o.headingRad,lastVisualHeadingRad:o.headingRad,
    timestampMs:o.timestampMs,source:o.source,confirmed:false});
   return events;
  }
  if(!o.positionM)throw Error('Posisi kaki di lantai diperlukan untuk fase stance.');
  const shouldContact=(!p||p.phase==='swing')&&!this.rearm.has(key);
  if(shouldContact)emit('contact',o.positionM);
  else if(p?.phase==='stance'&&p.positionM){
   const headingDelta=Math.atan2(Math.sin(o.headingRad-p.lastVisualHeadingRad),
    Math.cos(o.headingRad-p.lastVisualHeadingRad));
   // Accumulate relative to the last VISUAL event, so a slow planted pivot
   // can eventually emit one move without a new contact.
   if(distance(p.positionM,o.positionM)>=this.moveThresholdM||Math.abs(headingDelta)>=.20)
    emit('move',o.positionM);
  }
  this.state.set(key,{phase:'stance',positionM:o.positionM,headingRad:o.headingRad,
   lastVisualHeadingRad:shouldContact||events.some(e=>e.kind==='move')?
    o.headingRad:(p?.lastVisualHeadingRad??o.headingRad),
   timestampMs:o.timestampMs,source:o.source,confirmed:shouldContact||(p?.confirmed??false)});
  return events;
 }
}
