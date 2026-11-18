/** VIS-R1/R2: bounded artistic controls; never authorize hardware output. */
import {ARTISTIC_FOOTPRINT_DEFAULTS,type ArtisticFootprintStyle,type ArtisticFootprintView,type ArtisticFootprintTreatment} from './ArtisticFootprintRuntime.ts';
export type HydraFootprintStyle='grain'|'echo'|'interference'|'flow';
export type HydraFootprintStatus='off'|'loading'|'ready'|'fallback';
export type HydraFootprintSettings={
 enabled:boolean;style:HydraFootprintStyle;mix:number;distortion:number;
 feedback:number;motion:number;quality:'low'|'medium'|'high';
 artwork:'off'|ArtisticFootprintStyle;
 artworkView:ArtisticFootprintView;artworkTreatment:ArtisticFootprintTreatment;
};
export const HYDRA_FOOTPRINT_DEFAULTS:HydraFootprintSettings={
 enabled:false,style:'grain',mix:.6,distortion:.2,feedback:.28,motion:.65,quality:'medium',
 artwork:'off',artworkView:'both',artworkTreatment:'artistic'
};
export const HYDRA_FOOTPRINT_STYLES:readonly {id:HydraFootprintStyle;label:string;description:string}[]=[
 {id:'grain',label:'Grain',description:'Noise grain and displaced foot traces'},
 {id:'echo',label:'Echo',description:'Bounded previous-frame feedback'},
 {id:'interference',label:'Interference',description:'Oscillator modulation across paths'},
 {id:'flow',label:'Flow',description:'Noise-driven directional distortion'}
];
const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);
export const clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export function normalizeHydraFootprintSettings(raw:unknown):HydraFootprintSettings{
 const v=raw&&typeof raw==='object'?raw as Partial<HydraFootprintSettings>:{};
 return {
  enabled:typeof v.enabled==='boolean'?v.enabled:false,
  style:HYDRA_FOOTPRINT_STYLES.some(s=>s.id===v.style)?v.style!:HYDRA_FOOTPRINT_DEFAULTS.style,
  mix:number(v.mix)?clamp01(v.mix!):HYDRA_FOOTPRINT_DEFAULTS.mix,
  distortion:number(v.distortion)?Math.min(.4,clamp01(v.distortion!)):HYDRA_FOOTPRINT_DEFAULTS.distortion,
  feedback:number(v.feedback)?Math.min(.65,clamp01(v.feedback!)):HYDRA_FOOTPRINT_DEFAULTS.feedback,
  motion:number(v.motion)?clamp01(v.motion!):HYDRA_FOOTPRINT_DEFAULTS.motion,
  quality:v.quality==='low'||v.quality==='medium'||v.quality==='high'?v.quality:'medium',
  artwork:v.artwork==='off'||v.artwork==='trace'||v.artwork==='compression'||v.artwork==='negative-memory'||v.artwork==='wave-record'?v.artwork:'off',
  artworkView:v.artworkView==='footprints'||v.artworkView==='paths'||v.artworkView==='both'?v.artworkView:ARTISTIC_FOOTPRINT_DEFAULTS.view,
  artworkTreatment:v.artworkTreatment==='literal'||v.artworkTreatment==='artistic'?v.artworkTreatment:ARTISTIC_FOOTPRINT_DEFAULTS.treatment
 };
}
export type HydraMotionUniforms={x:number;y:number;energy:number;contacts:number;speed:number};
export const HYDRA_MOTION_IDLE:HydraMotionUniforms={x:.5,y:.5,energy:0,contacts:0,speed:0};
export function accumulateHydraMotion(
 previous:HydraMotionUniforms,
 events:readonly {kind:string;x:number;y:number;speed:number;verified:boolean}[],
 nowMs:number,lastContactMs:number,decayMs=650
):HydraMotionUniforms{
 let x=previous.x,y=previous.y,energy=previous.energy,speed=previous.speed,contacts=0;
 for(const event of events){
  if(!number(event.x)||!number(event.y)||!number(event.speed))continue;
  if(event.kind==='contact'&&event.verified){contacts++;x=clamp01(event.x);y=clamp01(event.y);energy=Math.min(1,energy+.28);}
  else if(event.kind==='movement'||event.kind==='presence'){x=clamp01(event.x);y=clamp01(event.y);speed=clamp01(event.speed);}
 }
 const elapsed=Math.max(0,nowMs-lastContactMs);
 return {x,y,energy:clamp01(energy*Math.exp(-Math.min(5000,elapsed)/Math.max(1,decayMs))),contacts,speed};
}
/** Master visual effect is preview-only until a separate hardware QA grants routing. */
export function hydraVisualAuthorizesPhysicalOutput(){return false;}
