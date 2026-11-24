/** Compose-only image-space fallback when no verified floor contact exists.
 * Tracks the existing observed heel/toe samples; never produces a contact event,
 * writes to the physical FLOOR raster, or changes Map/Perform safety gates.
 */
import {footSamplesFromLive,footSamplesFromPose,type FootLineSample} from '../../footprints/lines/FootLineSampleAdapter.ts';
import type {MotionFrame} from '../../engine/types.ts';
import type {MultiPoseStatus} from '../../footprints/live/MultiPoseGaitRouter.ts';

/** Software only: collect both observed performers, plus anonymous diagnostic
 * points for unmatched poses. Never pass these samples to physical output or audio. */
export function composeLiveFootSamples(frame:MotionFrame,status:MultiPoseStatus,count:1|2,
 source:'camera'|'phone',sessionId:string):FootLineSample[]{
 if(frame.source!=='camera'||!Number.isFinite(frame.time)||frame.time<=0)return [];
 if(count===1)return footSamplesFromLive(frame,status,count,source,sessionId,0,'A');
 const matched=!status.ambiguous&&status.observedFrameTime===frame.time;
 const known=new Set<number>();
 const result:FootLineSample[]=[];
 if(matched)for(const id of ['A','B'] as const){
  const index=status.poseIndices[id];
  if(index===null||known.has(index)||!frame.poses?.[index])continue;
  known.add(index);
  result.push(...footSamplesFromLive(frame,status,2,source,sessionId,0,id));
 }
 for(const [index,pose] of (frame.poses??[]).slice(0,2).entries()){
  if(known.has(index))continue;
  result.push(...footSamplesFromPose(pose,{sessionId,generation:0,source,
   actorId:'unassigned-'+index,atMs:frame.time,coordinateBasis:'image-2d'}));
 }
 return result;
}

import {paintAuthenticFootprint} from '../../footprints/scenes/authenticFootGeometry.ts';

export type ComposePoseMark={actorId:string;foot:'left'|'right';x:number;y:number;
 headingRad?:number;atMs:number};
export type ComposePosePreviewSource='camera'|'phone'|'video'|'simulator';
/** Never use image-space estimates for a calibrated/physical output.
 * A real verified Pixi footprint always takes precedence in Compose. */
export function useComposeFloorPoseFallback(input:{
 softwareMonitor:boolean;previewLive:boolean;blackout:boolean;
 lineTrails:boolean;liquidEnabled:boolean;liquidMode:'track'|'demo';
 timelineMode:'live'|'replay';verifiedImprints:number;
}):boolean{
 return input.softwareMonitor&&input.previewLive&&!input.blackout&&
  !input.lineTrails&&input.liquidEnabled&&input.liquidMode==='track'&&
  input.timelineMode==='live'&&input.verifiedImprints===0;
}
const COLORS={left:'#f5b77b',right:'#9be9c9'} as const;
const anonymous=(id:string)=>id.startsWith('unassigned-');
const markColor=(m:ComposePoseMark)=>m.actorId==='A'?'#f18d82':m.actorId==='B'?'#9bcce9':COLORS[m.foot];
const valid=(s:FootLineSample)=>Number.isFinite(s.atMs)&&s.atMs>=0&&
 Number.isFinite(s.x)&&Number.isFinite(s.y)&&s.x>=0&&s.x<=1&&s.y>=0&&s.y<=1&&
 s.confidence>=.5;
const distancePx=(a:Pick<ComposePoseMark,'x'|'y'>,b:Pick<ComposePoseMark,'x'|'y'>)=>
 Math.hypot((a.x-b.x)*960,(a.y-b.y)*540);
export class ComposeFloorPosePreview{
 private marks:ComposePoseMark[]=[];
 private active=new Map<string,ComposePoseMark>();
 private lastFrame=new Map<string,number>();
 private key='';
 readonly maxMarks=150;
 readonly maxAgeMs=9000;
 get count(){return this.marks.length;}
 get activeFeet(){return this.active.size;}
 clear(){this.marks=[];this.active.clear();this.lastFrame.clear();}
 /** A new session/clip must never connect the previous recording's footprints. */
 ingest(samples:readonly FootLineSample[],nowMs:number,sourceKey:string):void{
  if(this.key!==sourceKey){this.key=sourceKey;this.clear();}
  if(!Number.isFinite(nowMs)||nowMs<0)return;
  const seen=new Set<string>();
  for(const sample of samples){
   if(!valid(sample))continue;
   const id=sample.actorId+':'+sample.foot;
   seen.add(id);
   if(sample.atMs<=(this.lastFrame.get(id)??-1))continue;
   this.lastFrame.set(id,sample.atMs);
   const point:ComposePoseMark={actorId:sample.actorId,foot:sample.foot,
    x:sample.x,y:sample.y,atMs:nowMs,
    ...(Number.isFinite(sample.headingRad)?{headingRad:sample.headingRad}:{})};
   this.active.set(id,point);
   // Raw detection indices are not identities: show current points only.
   if(anonymous(sample.actorId))continue;
   const previous=[...this.marks].reverse().find(m=>m.actorId===point.actorId&&m.foot===point.foot);
   const traveled=previous?distancePx(point,previous):Infinity;
   // One first footprint, then distance-spaced imprints; never stamp on every frame.
   if(!previous||traveled>=29){
    this.marks.push(point);
   }
  }
  for(const id of this.active.keys())if(!seen.has(id))this.active.delete(id);
  const oldest=nowMs-this.maxAgeMs;
  this.marks=this.marks.filter(m=>m.atMs>=oldest).slice(-this.maxMarks);
 }
 /** Renders only software Compose Stage Monitor. Leaves background and input intact. */
 paint(ctx:CanvasRenderingContext2D,nowMs:number,width:number,height:number):boolean{
  if(!Number.isFinite(nowMs)||width<=0||height<=0)return false;
  const marks=this.marks.filter(m=>m.atMs>=nowMs-this.maxAgeMs);
  const current=[...this.active.values()].filter(m=>m.atMs>=nowMs-500);
  if(!marks.length&&!current.length)return false;
  ctx.save();ctx.globalCompositeOperation='source-over';
  const scale=width/960;
  const length=Math.max(56,Math.min(90,86*scale));
  const widthPx=length*.4;
  for(const mark of marks){
   const age=Math.max(0,nowMs-mark.atMs);
   const alpha=.48*Math.pow(Math.max(0,1-age/this.maxAgeMs),1.25);
   if(alpha<=.012)continue;
   paintAuthenticFootprint(ctx,{side:mark.foot,
    x:mark.x*width,y:mark.y*height,
    headingRad:mark.headingRad,
    widthPx,lengthPx:length,alpha,color:markColor(mark)});
  }
  // Show the latest observed sole at full opacity even while the performer stands still.
  for(const mark of current){
   if(anonymous(mark.actorId)){
    ctx.globalAlpha=.85;ctx.strokeStyle='#c4cac6';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(mark.x*width,mark.y*height,Math.max(4,7*scale),0,Math.PI*2);ctx.stroke();
    continue;
   }
   paintAuthenticFootprint(ctx,{side:mark.foot,
    x:mark.x*width,y:mark.y*height,headingRad:mark.headingRad,
    widthPx,lengthPx:length,alpha:.96,color:markColor(mark)});
  }
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;ctx.fillStyle='#d5e9dd';
  ctx.font=`${Math.max(12,Math.round(12*scale))}px system-ui,sans-serif`;
  ctx.fillText(current.some(m=>anonymous(m.actorId))?'POSISI KAKI 2D · A/B BELUM PASTI':'JEJAK 2D · PREVIEW',16*scale,26*scale);
  ctx.restore();
  return true;
 }
}
