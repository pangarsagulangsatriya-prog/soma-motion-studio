/** MATERIAL-03 — one Liquid Imprint study, four distinct gait responses.
 * Pure controls shared by PixiJS v8 and the isolated WebGL2 reference.
 * Motion evidence never creates a new imprint; phase only modifies pigment.
 */
import type {LiquidImprint} from './liquidImprintTimeline.ts';

export type LiquidMaterialPhase='contact'|'settle'|'slide'|'pivot'|'release';
export type LiquidMaterialResponse={
 phase:LiquidMaterialPhase;
 phaseIndex:0|1|2|3|4;
 /** Heel-to-toe filling impulse within the first 320ms of a landing. */
 contactFill:number;
 /** Streak velocity in sole coordinates, normalized -1..1. */
 slideX:number;slideY:number;slideStrength:number;
 /** Vortex twist bounded to the sole interior. */
 pivotTwist:number;pivotStrength:number;
 /** 0..1 progress of the pigment draining after a release. */
 releaseProgress:number;released:boolean;
 /** Bounded visual opacity, including lingering foot-shaped residue. */
 opacity:number;
};
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const safe=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const decay=(age:number,duration:number)=>clamp(1-age/duration,0,1);
export function liquidMaterialResponse(imprint:LiquidImprint):LiquidMaterialResponse{
 const age=Math.max(0,safe(imprint.ageMs));
 const impact=decay(age,320);
 const d=imprint.deformation;
 const strength=clamp(safe(d.amount),0,1);
 // The last release still drains the pigmented *existing* contact after
 // the 390ms anatomical toe-off shape has already settled.
 const releasedAt=imprint.releasedAtMs;
 const released=typeof releasedAt==='number'&&Number.isFinite(releasedAt)&&releasedAt>=0;
 const timeAfterRelease=released?Math.max(0,age-(releasedAt!-imprint.createdMs)):0;
 // A release visibly thins the ink on its first frame, then continues
 // draining for 1.4s while the original sole-shaped residue fades.
 const releaseProgress=released?.25+.75*clamp(timeAfterRelease/1400,0,1):0;
 const baseOpacity=clamp(safe(imprint.opacity),0,1);
 const opacity=baseOpacity*(released?(1-.68*releaseProgress):1);
 if(released)return {
  phase:'release',phaseIndex:4,contactFill:0,
  slideX:0,slideY:0,slideStrength:0,pivotTwist:0,pivotStrength:0,
  releaseProgress,released:true,opacity
 };
 if(d.mode==='slide'&&strength>0)return {
  phase:'slide',phaseIndex:2,contactFill:0,
  slideX:clamp(safe(d.travelX),-1,1),slideY:clamp(safe(d.travelY),-1,1),
  slideStrength:strength,pivotTwist:0,pivotStrength:0,
  releaseProgress:0,released:false,opacity
 };
 if(d.mode==='pivot'&&strength>0)return {
  phase:'pivot',phaseIndex:3,contactFill:0,slideX:0,slideY:0,
  slideStrength:0,pivotTwist:clamp(safe(d.pivotRad),-.9,.9),
  pivotStrength:strength,releaseProgress:0,released:false,opacity
 };
 if(impact>0)return {
  phase:'contact',phaseIndex:0,contactFill:impact,
  slideX:0,slideY:0,slideStrength:0,pivotTwist:0,pivotStrength:0,
  releaseProgress:0,released:false,opacity
 };
 return {
  phase:'settle',phaseIndex:1,contactFill:0,
  slideX:0,slideY:0,slideStrength:0,pivotTwist:0,pivotStrength:0,
  releaseProgress:0,released:false,opacity
 };
}
export const MATERIAL03_PHASES=['contact','slide','pivot','release'] as const;
