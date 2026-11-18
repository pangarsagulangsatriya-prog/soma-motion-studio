/** UX-R2: source-independent, versioned movement-event facade.
 * The current FloorInteractionEngine remains the single event producer.
 * This module never estimates pressure or authorizes physical projector output.
 */
import type {FloorInteractionEvent,FloorInteractionSource} from './FloorInteractionEngine.ts';

export const FOOT_MOTION_SCHEMA='soma.foot-motion-event' as const;
export const FOOT_MOTION_VERSION=2 as const;
export type FootMotionKind='presence'|'movement'|'contact'|'lift'|'slide'|'pivot'|'release';
export type FootMotionVerification='detected-estimate'|'video-estimate'|'simulated'|'unverified';
export type FootMotionSource=FloorInteractionSource;
export type FootMotionEventV2={
 schema:typeof FOOT_MOTION_SCHEMA;version:typeof FOOT_MOTION_VERSION;
 eventId:string;originEventId:string;sessionId:string;generation:number;
 actorId:string;foot:'left'|'right'|'unknown';kind:FootMotionKind;
 source:FootMotionSource;x:number;y:number;atMs:number;
 speed:number;confidence:number;verified:boolean;
 verification:FootMotionVerification;coordinateBasis:FloorInteractionEvent['basis'];
};
/** Legacy source uses 'touch' as a verified virtual contact, not real footwear. */
export function toFootMotionEvent(event:FloorInteractionEvent,sessionId:string,generation:number):FootMotionEventV2{
 const kind:FootMotionKind=event.kind==='touch'?'contact':event.kind;
 const verified=kind==='contact'&&event.verified;
 const verification:FootMotionVerification=!verified?'unverified':
  event.source==='touch'||event.source==='simulator'?'simulated':
  event.source==='video'?'video-estimate':'detected-estimate';
 const originEventId=event.originEventId??event.id;
 return {
  schema:FOOT_MOTION_SCHEMA,version:FOOT_MOTION_VERSION,
  eventId:`${sessionId}:${generation}:${event.source}:${originEventId}`,
  originEventId,sessionId,generation,
  actorId:event.actorId,foot:event.foot??'unknown',kind,
  source:event.source,x:event.x,y:event.y,atMs:event.atMs,
  speed:event.speed,confidence:event.confidence,
  verified,verification,coordinateBasis:event.basis
 };
}
export function footMotionCanStamp(event:FootMotionEventV2):boolean{
 return event.kind==='contact'&&event.verified&&
  (event.foot==='left'||event.foot==='right')&&
  !event.actorId.startsWith('unassigned-')&&
  (event.verification==='detected-estimate'||event.verification==='video-estimate'||event.verification==='simulated');
}
/** A synthetic or video event may drive rehearsal art but never authorize physical output. */
export function footMotionAuthorizesPhysicalOutput(_event:FootMotionEventV2){return false;}
export function validFootMotionEvent(value:unknown):value is FootMotionEventV2{
 if(!value||typeof value!=='object')return false;
 const e=value as Partial<FootMotionEventV2>;
 const bounded=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
 return e.schema===FOOT_MOTION_SCHEMA&&e.version===FOOT_MOTION_VERSION&&
  typeof e.eventId==='string'&&e.eventId.length>0&&e.eventId.length<=500&&
  typeof e.originEventId==='string'&&e.originEventId.length>0&&
  typeof e.sessionId==='string'&&e.sessionId.length>0&&
  typeof e.generation==='number'&&Number.isSafeInteger(e.generation)&&e.generation>=0&&
  typeof e.actorId==='string'&&e.actorId.length>0&&
  ['left','right','unknown'].includes(e.foot??'')&&
  ['presence','movement','contact','lift','slide','pivot','release'].includes(e.kind??'')&&
  ['camera','phone','video','simulator','touch'].includes(e.source??'')&&
  ['detected-estimate','video-estimate','simulated','unverified'].includes(e.verification??'')&&
  ['calibrated-estimate','image-2d','simulated','presence-only'].includes(e.coordinateBasis??'')&&
  bounded(e.x)&&bounded(e.y)&&bounded(e.confidence)&&bounded(e.speed)&&
  typeof e.atMs==='number'&&Number.isFinite(e.atMs)&&e.atMs>=0&&
  typeof e.verified==='boolean'&&
  (e.kind==='contact'||!e.verified);
}
