/** VIS-R4: auditable motion-trigger mappings for SOFTWARE previews.
 * No synthetic slide/pivot is represented as detector verification.
 * All physical output continues through the existing routing and QA engine.
 */
import type {FootMotionEventV2} from './FootMotionEventV2.ts';

export type MotionRecipeTrigger='contact'|'presence'|'movement'|'slide'|'pivot';
export type MotionRecipeTreatment='reveal'|'hold'|'decay'|'pulse'|'distort';
export type MotionRecipeSurface='BODY A'|'BODY B'|'FLOOR';
export type MotionRecipeRule={
 trigger:MotionRecipeTrigger;treatment:MotionRecipeTreatment;
 durationMs:number;strength:number;verifiedOnly:boolean;
};
export type MotionRecipeCue={
 eventId:string;actorId:string;surface:MotionRecipeSurface;
 kind:MotionRecipeTrigger;treatment:MotionRecipeTreatment;
 started:number;durationMs:number;strength:number;
 verified:boolean;source:FootMotionEventV2['source'];
};
export const MOTION_RECIPE_DEFAULT:MotionRecipeRule={
 trigger:'contact',treatment:'reveal',durationMs:2000,strength:1,verifiedOnly:true
};
export const MOTION_RECIPE_TRIGGERS:readonly MotionRecipeTrigger[]=['contact','presence','movement','slide','pivot'];
export const MOTION_RECIPE_TREATMENTS:readonly MotionRecipeTreatment[]=['reveal','hold','decay','pulse','distort'];
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x:number,low:number,high:number)=>Math.min(high,Math.max(low,x));
export function normalizeMotionRecipeRule(raw:unknown):MotionRecipeRule{
 const v=raw&&typeof raw==='object'?raw as Partial<MotionRecipeRule>:{};
 const trigger=MOTION_RECIPE_TRIGGERS.includes(v.trigger as MotionRecipeTrigger)?v.trigger!:MOTION_RECIPE_DEFAULT.trigger;
 return {
  trigger,
  treatment:MOTION_RECIPE_TREATMENTS.includes(v.treatment as MotionRecipeTreatment)?v.treatment!:MOTION_RECIPE_DEFAULT.treatment,
  durationMs:finite(v.durationMs)?Math.round(clamp(v.durationMs,100,12000)):2000,
  strength:finite(v.strength)?clamp(v.strength,0,1):1,
  // Claimed verification is only meaningful when the source event itself carries proof.
  verifiedOnly:typeof v.verifiedOnly==='boolean'?v.verifiedOnly:trigger==='contact'
 };
}
export function motionRecipeSurfaceMatches(surface:MotionRecipeSurface,actorId:string):boolean{
 if(surface==='FLOOR')return !actorId.startsWith('unassigned-');
 return actorId=== (surface==='BODY A'?'A':'B')||
  (surface==='BODY A'&&actorId==='performer-1')||
  (surface==='BODY B'&&actorId==='performer-2');
}
export function resolveMotionRecipeCue(
 event:FootMotionEventV2,rule:MotionRecipeRule,surface:MotionRecipeSurface,nowMs:number,
 identitySafe=true
):MotionRecipeCue|null{
 const r=normalizeMotionRecipeRule(rule);
 if(!identitySafe||!motionRecipeSurfaceMatches(surface,event.actorId))return null;
 if(event.kind!==r.trigger)return null;
 if(event.kind==='contact'&&(!event.verified||event.foot==='unknown'))return null;
 if(r.verifiedOnly&&!event.verified)return null;
 // UX-R2 does not currently verify slide or pivot. Those events remain experimental.
 if((r.trigger==='slide'||r.trigger==='pivot')&&r.verifiedOnly)return null;
 if(!finite(nowMs)||nowMs<0)return null;
 return {
  eventId:event.eventId,actorId:event.actorId,surface,
  kind:r.trigger,treatment:r.treatment,started:nowMs,
  durationMs:r.durationMs,strength:r.strength,
  verified:event.verified,source:event.source
 };
}
export function motionRecipeEnvelope(cue:MotionRecipeCue|null,nowMs:number):number{
 if(!cue||!finite(nowMs))return 0;
 const elapsed=Math.max(0,nowMs-cue.started),t=Math.min(1,elapsed/cue.durationMs);
 if(elapsed>=cue.durationMs)return 0;
 const strength=cue.strength;
 switch(cue.treatment){
  case 'reveal':return strength*Math.min(1,elapsed/180)*(1-t);
  case 'hold':return strength*(t<.75?1:(1-t)/.25);
  case 'decay':return strength*(1-t);
  case 'pulse':return strength*Math.sin(Math.PI*t);
  case 'distort':return strength*(1-t)*(0.65+0.35*Math.sin(t*23)**2);
 }
}
export function motionRecipeAllowsHardwareOutput(_cue:MotionRecipeCue|null):boolean{return false;}
