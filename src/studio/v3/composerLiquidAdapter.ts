/** MAT-03 — adapt existing Track/Composer V2 events into the isolated
 * Pixi material compositor. No new contact inference or projector rights.
 */
import type {TimelineCapture} from './composerEventTimelineModel.ts';
import type {LiquidInputEvent} from '../../footprints/materials/liquidImprintTimeline.ts';

export type ComposerLiquidMode='track'|'demo';
export type ComposerLiquidPhase='contact'|'slide'|'pivot'|'release';
const materialKinds=['contact','slide','pivot','release'] as const;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v:number)=>Math.min(1,Math.max(0,v));

/** Uses Track's existing verified stamps. Visual pivot direction falls back
 * to a *graphic* vortex when current V2 events lack heading information;
 * the graphic is never reported as an anatomical direction measurement.
 */
export function composerLiquidTrackEvents(capture:TimelineCapture,
 cursorMs:number,mode:'live'|'replay'='live'):LiquidInputEvent[]{
 if(!finite(cursorMs)||cursorMs<0)return [];
 const start=mode==='live'&&capture.originAtMs>=0?capture.originAtMs:0;
 return capture.events.flatMap(item=>{
  if(!materialKinds.includes(item.kind as ComposerLiquidPhase)||
   !finite(item.x)||!finite(item.y)||item.x<0||item.x>1||item.y<0||item.y>1||
   item.foot==='unknown'||!finite(item.atMs))return [];
  const e=item.event;
  const atMs=start+item.atMs;
  if(atMs>cursorMs||atMs<cursorMs-9000)return [];
  if(item.kind==='contact'&&!item.verified)return [];
  const event:LiquidInputEvent={
   id:item.id,originEventId:e.originEventId,
   source:e.source,kind:item.kind as LiquidInputEvent['kind'],
   actorId:item.actorId,foot:item.foot,
   x:clamp(item.x),y:clamp(item.y),
   radius:.03,speed:e.speed,confidence:e.confidence,
   atMs,basis:e.coordinateBasis,
   verified:item.kind==='contact'&&item.verified,
   // V2 may not carry a reliable heading. Pivot uses artistic spin only,
   // not a fabricated heel/ankle direction.
   headingRad:item.kind==='pivot'?.62:undefined
  };
  return [event];
 });
}

/** Deterministic preview so Composer is usable before camera/video input.
 * Synthetic data never feeds the physical output or creates Track events.
 */
export function composerLiquidDemoEvents(phase:ComposerLiquidPhase,
 nowMs:number,startedAtMs:number):LiquidInputEvent[]{
 const elapsed=Math.max(0,nowMs-startedAtMs)%2700;
 const anchor=nowMs-elapsed;
 const base:LiquidInputEvent={
  id:'compose-mat03-contact',originEventId:'compose-demo-sole',
  kind:'contact',source:'simulator',actorId:'A',foot:'left',
  x:.5,y:.5,headingRad:0,
  radius:.03,speed:0,confidence:1,atMs:anchor,
  basis:'simulated',verified:true
 };
 if(phase==='contact'||elapsed<85)return [base];
 const travel=phase==='slide';
 return [base,{
  ...base,id:'compose-mat03-'+phase,originEventId:undefined,
  kind:phase,atMs:anchor+85,verified:false,
  x:travel?.555:base.x,y:travel?.515:base.y,
  headingRad:phase==='pivot'?.72:0
 }];
}
export const COMPOSER_LIQUID_PHASES=materialKinds;
