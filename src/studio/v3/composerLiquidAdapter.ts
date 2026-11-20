/** Adapt existing Track/Composer V2 events into the isolated PixiJS footprint
 * shader compositor. Preserves real heel-to-toe heading when provided; never
 * invents anatomical direction or grants physical projector rights.
 */
import type {TimelineCapture} from './composerEventTimelineModel.ts';
import type {LiquidInputEvent} from '../../footprints/materials/liquidImprintTimeline.ts';

export type ComposerLiquidMode='track'|'demo';
export type ComposerLiquidPhase='contact'|'slide'|'pivot'|'release';
const materialKinds=['contact','slide','pivot','release'] as const;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v:number)=>Math.min(1,Math.max(0,v));

/** Uses Track's existing verified stamps. Carries real heel-to-toe headingRad
 * whenever present in the canonical event; omits heading when uncertain rather
 * than fabricating an anatomical angle.
 */
export function composerLiquidTrackEvents(capture:TimelineCapture,
 cursorMs:number,mode:'live'|'replay'='live',lifeMs=9000):LiquidInputEvent[]{
 if(!finite(cursorMs)||cursorMs<0)return [];
 const windowMs=Math.min(60000,Math.max(400,finite(lifeMs)?lifeMs:9000));
 const start=mode==='live'&&capture.originAtMs>=0?capture.originAtMs:0;
 return capture.events.flatMap(item=>{
  if(!materialKinds.includes(item.kind as ComposerLiquidPhase)||
   !finite(item.x)||!finite(item.y)||item.x<0||item.x>1||item.y<0||item.y>1||
   item.foot==='unknown'||!finite(item.atMs))return [];
  const e=item.event;
  const atMs=start+item.atMs;
  if(atMs>cursorMs||atMs<cursorMs-windowMs)return [];
  if(item.kind==='contact'&&!item.verified)return [];
  const heading=finite(item.headingRad)?item.headingRad:
   finite(e.headingRad)?e.headingRad:undefined;
  const event:LiquidInputEvent={
   id:item.id,originEventId:e.originEventId,
   source:e.source,kind:item.kind as LiquidInputEvent['kind'],
   actorId:item.actorId,foot:item.foot,
   x:clamp(item.x),y:clamp(item.y),
   radius:.03,speed:e.speed,confidence:e.confidence,
   atMs,basis:e.coordinateBasis,
   verified:item.kind==='contact'&&item.verified,
   ...(heading!==undefined?{headingRad:heading}:{})
  };
  return [event];
 });
}

/** Deterministic synthetic preview so Composer styles can be steered before
 * camera/video input. Clearly labeled DEMO SINTETIK; never feeds physical
 * output or creates Track events.
 */
export function composerLiquidDemoEvents(phase:ComposerLiquidPhase,
 nowMs:number,startedAtMs:number):LiquidInputEvent[]{
 const elapsed=Math.max(0,nowMs-startedAtMs)%2700;
 const anchor=nowMs-elapsed;
 const upright=Math.PI/2;
 const base:LiquidInputEvent={
  id:'compose-demo-contact',originEventId:'compose-demo-sole',
  kind:'contact',source:'simulator',actorId:'A',foot:'left',
  x:.5,y:.5,headingRad:upright,
  radius:.03,speed:0,confidence:1,atMs:anchor,
  basis:'simulated',verified:true
 };
 if(phase==='contact'||elapsed<85)return [base];
 const travel=phase==='slide';
 return [base,{
  ...base,id:'compose-demo-'+phase,originEventId:undefined,
  kind:phase,atMs:anchor+85,verified:false,
  x:travel?.555:base.x,y:travel?.475:base.y,
  headingRad:phase==='pivot'?upright+.72:upright
 }];
}
export const COMPOSER_LIQUID_PHASES=materialKinds;
