/** GPU-02 / MATERIAL-03: deterministic, bounded stamps for the isolated
 * Liquid Imprint research renderer. Read-only consumer of FloorInteractionEngine.
 * No new gait/identity inference, hardware light authorization or presets.
 */
import type {FloorInteractionEvent} from '../scenes/FloorInteractionEngine.ts';
/** Compatible with current FloorInteraction bus; canonical Track V2 may also
 * deliver Slide/Pivot with optional heading. No sensor precision is invented. */
export type LiquidInputEvent=Omit<FloorInteractionEvent,'kind'> & {
 kind:FloorInteractionEvent['kind']|'slide'|'pivot';
 headingRad?:number;
};
import {deformationAt,type FootDeformation,type FootVisualMotion}
 from '../scenes/dynamicFootDeformation.ts';

export const LIQUID_LIMIT=32;
export const LIQUID_LIFE_MS=9000;
export type LiquidImprint={
 id:string;actorId:string;foot:'left'|'right';source:LiquidInputEvent['source'];basis?:LiquidInputEvent['basis'];
 x:number;y:number;headingRad:number;orientationKnown:boolean;
 createdMs:number;ageMs:number;opacity:number;seed:number;
 /** Last confirmed release signal; preserves draining ink beyond toe-off. */
 releasedAtMs?:number;
 deformation:FootDeformation;
};
export type LiquidTimelineOptions={lifeMs?:number;limit?:number};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const actorFoot=(e:LiquidInputEvent)=>e.source+':'+e.actorId+':'+e.foot;
/** Stable, repeatable pigment phase: no Math.random or event-to-event flicker. */
export function liquidSeed(id:string):number{
 let hash=2166136261;
 for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619)>>>0;
 return (hash%10007)/10007;
}
export function collectLiquidImprints(
 events:readonly LiquidInputEvent[],nowMs:number,options:LiquidTimelineOptions={}
):LiquidImprint[]{
 if(!finite(nowMs)||nowMs<0)return [];
 const lifeMs=clamp(finite(options.lifeMs)?options.lifeMs:LIQUID_LIFE_MS,400,60000);
 const limit=clamp(Math.floor(finite(options.limit)?options.limit:LIQUID_LIMIT),1,LIQUID_LIMIT);
 const stamps=new Map<string,{contact:LiquidInputEvent;motion?:FootVisualMotion}>();
 const active=new Map<string,string>();
 for(const e of events){
  if(!finite(e.atMs)||e.atMs>nowMs||e.atMs<nowMs-lifeMs||!e.foot||
   !finite(e.x)||!finite(e.y)||e.x<0||e.x>1||e.y<0||e.y>1)continue;
  const k=actorFoot(e);
  if((e.kind==='contact'||e.kind==='touch')&&e.verified&&
    !e.actorId.startsWith('unassigned-')){
   const id=e.source+':'+e.actorId+':'+e.foot+':'+(e.originEventId??e.id);
   if(!stamps.has(id))stamps.set(id,{contact:e});
   active.set(k,id);
  }else if(e.kind==='slide'||e.kind==='pivot'||e.kind==='release'){
   const id=active.get(k);
   const stamp=id?stamps.get(id):undefined;
   if(stamp&&e.atMs>=stamp.contact.atMs){
    stamp.motion={kind:e.kind,atMs:e.atMs,x:e.x,y:e.y,headingRad:e.headingRad};
    if(e.kind==='release')active.delete(k);
   }
  }
 }
 return Array.from(stamps.entries()).slice(-limit).map(([id,{contact,motion}]):LiquidImprint=>{
  const ageMs=Math.max(0,nowMs-contact.atMs);
  return {
   id,actorId:contact.actorId,foot:contact.foot!,source:contact.source,basis:contact.basis,
   x:contact.x,y:contact.y,headingRad:finite(contact.headingRad)?contact.headingRad:0,
   orientationKnown:finite(contact.headingRad),
   createdMs:contact.atMs,ageMs,opacity:Math.pow(clamp(1-ageMs/lifeMs,0,1),1.15),
   seed:liquidSeed(id),
   releasedAtMs:motion?.kind==='release'?motion.atMs:undefined,
   deformation:deformationAt({
    x:contact.x,y:contact.y,atMs:contact.atMs,headingRad:contact.headingRad
   },nowMs,motion)
  };
 });
}
export function liquidOutputAuthorized():false{return false;}
