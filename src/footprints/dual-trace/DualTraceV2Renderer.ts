import type {ActorChannel} from '../lines/v3/ActorPaletteResolver.ts';
import type {PathEvent} from '../lines/v3/ActorPathTracker.ts';
import type {UpperGestureEvent} from './UpperGestureStrokeTracker.ts';
import type {UpperGestureAnchor,UpperChannel} from './UpperGestureAnchorAdapter.ts';
import {MotionBrushDynamics} from './MotionBrushDynamics.ts';
import {PersistentPathStore} from '../lines/v3/PersistentPathStore.ts';
import {paintAuthenticFootprint} from '../scenes/authenticFootGeometry.ts';
import {lifetimeOpacity,type PainterlyImpressionEngine} from '../lines/v3/PainterlyImpressionEngine.ts';
import type {FootVisibility} from '../lines/v3/ActorPaletteResolver.ts';
import {cameraGroundToFloor,floorToUV,stageUVToRawCamera,type CameraFloorCalibration} from '../spatial/coordinates.ts';

export type DualTraceV2Mode='composite'|'split-debug';
export type DualTraceV2Order='foot-on-top'|'upper-on-top';
export type DualTraceChannel='path'|'footprint'|'upper';
export type DualTraceV2Palette=Record<ActorChannel,Record<DualTraceChannel,string>>;
export const DEFAULT_DUAL_TRACE_PALETTE:DualTraceV2Palette={
 A:{path:'#963C38',footprint:'#E57762',upper:'#C8A09A'},
 B:{path:'#303536',footprint:'#848B88',upper:'#ADB5B0'}
};
export type DualTraceV2Options={
 layerOrder?:DualTraceV2Order;
 display?:DualTraceV2Mode;
 palette?:DualTraceV2Palette;
 pathOpacity?:number;
 footprintOpacity?:number;
 upperOpacity?:number;
 material?:'path-sumi'|'rough-sumi'|'dry-ink'|'pigment-mass';
};
const ACTORS=['A','B'] as const;
const W=1600,H=900;
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
const blank=()=>{const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;return canvas;};
export function dualTraceLayerOrder(order:DualTraceV2Order='foot-on-top'):
 readonly ('upper'|'path'|'footprint')[]{
 return order==='foot-on-top'?['upper','path','footprint']:['footprint','path','upper'];
}
export type DualSpatialContext={
 calibration:CameraFloorCalibration;videoAspect:number;
};
function calibratedPoint(x:number,y:number,spatial?:DualSpatialContext){
 if(!spatial)return {x:x*W,y:y*H};
 const uv=stageUVToRawCamera({x,y},spatial.videoAspect);
 if(!uv)return null;
 const ground=cameraGroundToFloor(spatial.calibration,{
  cameraUV:uv,phase:'stance',confidence:.75});
 if(!ground)return null;
 const floor=floorToUV(spatial.calibration.floor,ground);
 if(!Number.isFinite(floor.x)||!Number.isFinite(floor.y)||
   floor.x<0||floor.x>1||floor.y<0||floor.y>1)return null;
 return {x:floor.x*W,y:floor.y*H};
}
/** Eight independent logical actor/channel masks: 2 Path, 2 Footprint,
 * 2 Head, 2 Shoulder. A canvas mask stores alpha, never the final palette.
 * Existing retained-ink stores are left intact for the V1 fallback.
 */
export class DualTraceV2Renderer{
 readonly path={A:new PersistentPathStore(),B:new PersistentPathStore()};
 readonly upper={
  A:{head:new PersistentPathStore(),shoulder:new PersistentPathStore()},
  B:{head:new PersistentPathStore(),shoulder:new PersistentPathStore()}
 };
 private tinted=new Map<string,{revision:number;color:string;canvas:HTMLCanvasElement}>();
 private brushDynamics=new MotionBrushDynamics();
 private lastSpatialSignature='';
 private footprintMask={A:blank(),B:blank()};
 private tintedFeet={A:blank(),B:blank()};
 private footprintCacheSignature='';
 get pathCount(){return this.path.A.depositCount+this.path.B.depositCount;}
 get upperCount(){return ACTORS.reduce((v,a)=>v+this.upper[a].head.depositCount+
  this.upper[a].shoulder.depositCount,0);}
 get upperActiveCount(){return ACTORS.reduce((v,a)=>v+this.upper[a].head.activeCount+
  this.upper[a].shoulder.activeCount,0);}
 setSpatialSignature(signature:string){
  if(signature===this.lastSpatialSignature)return false;
  this.lastSpatialSignature=signature;
  return true;
 }
 pathCovered(actor:ActorChannel,clip:string,timeMs:number){
  return this.path[actor].isReplayCoveredAt(clip,actor,timeMs);
 }
 upperCovered(anchor:UpperGestureAnchor){
  return this.upper[anchor.actorId][anchor.channel]
   .isReplayCoveredAt(anchor.clipStableId,anchor.actorId,anchor.timeMs);
 }
 ingestPath(event:PathEvent,weight=36,material:'path-sumi'|'rough-sumi'|'dry-ink'|'pigment-mass'='path-sumi',
  expressive=false,upperMotionFactor=1,roughness=.74){
  const widthFactor=clamp(this.brushDynamics.weight(event,expressive)*
   clamp(upperMotionFactor,1,1.22),.68,1.30);
  this.path[event.actorId].ingest({...event,widthFactor},{
   color:'#ffffff',weightPx:clamp(weight,8,42),material,
   roughness:material==='rough-sumi'?clamp(roughness,0,1):0,
   accents:expressive?'expressive':'subtle'
  });
 }
 ingestUpper(event:UpperGestureEvent,headWidth=8,shoulderWidth=16){
  this.upper[event.actorId][event.channel].ingest(event,{
   color:'#ffffff',
   weightPx:clamp(event.channel==='head'?headWidth:shoulderWidth,8,48),
   material:'dry-ink',accents:'off'
  });
 }
 cutAll(){
  this.brushDynamics.reset();
  for(const actor of ACTORS){
   this.path[actor].cutAll('mode-or-source-change');
   this.upper[actor].head.cutAll('mode-or-source-change');
   this.upper[actor].shoulder.cutAll('mode-or-source-change');
  }
 }
 clearPath(){for(const a of ACTORS)this.path[a].clearPainting();
  this.brushDynamics.reset();this.tinted.clear();}
 clearUpper(){
  for(const a of ACTORS){this.upper[a].head.clearPainting();this.upper[a].shoulder.clearPainting();}
  this.tinted.clear();
 }
 clearBoth(){this.clearPath();this.clearUpper();this.footprintCacheSignature='';}
 invalidateFootprints(){this.footprintCacheSignature='';}
 private tintedCanvas(id:string,store:PersistentPathStore,color:string){
  const source=store.getCanvas();
  if(!source)return null;
  const old=this.tinted.get(id);
  if(old&&old.revision===store.revision&&old.color===color)return old.canvas;
  const canvas=old?.canvas??blank(),ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.clearRect(0,0,W,H);ctx.drawImage(source,0,0,W,H);
  ctx.globalCompositeOperation='source-in';
  ctx.fillStyle=color;ctx.fillRect(0,0,W,H);ctx.restore();
  this.tinted.set(id,{revision:store.revision,color,canvas});
  return canvas;
 }
 private drawPath(ctx:CanvasRenderingContext2D,palette:DualTraceV2Palette,opacity:number){
  for(const actor of ACTORS){
   const c=this.tintedCanvas(actor+':path',this.path[actor],palette[actor].path);
   if(c){ctx.globalAlpha=opacity;ctx.drawImage(c,0,0,W,H);}
  }
 }
 private drawUpper(ctx:CanvasRenderingContext2D,palette:DualTraceV2Palette,opacity:number,
  headEnabled:boolean,shoulderEnabled:boolean,headOpacity:number,shoulderOpacity:number){
  for(const channel of ['shoulder','head'] as const){
   if(channel==='head'&&!headEnabled||channel==='shoulder'&&!shoulderEnabled)continue;
   ctx.globalAlpha=opacity*(channel==='head'?headOpacity:shoulderOpacity);
   for(const actor of ACTORS){
    const c=this.tintedCanvas(actor+':'+channel,this.upper[actor][channel],palette[actor].upper);
    if(c)ctx.drawImage(c,0,0,W,H);
   }
  }
 }
 private drawFeet(ctx:CanvasRenderingContext2D,palette:DualTraceV2Palette,
  impressions:PainterlyImpressionEngine,presentationMs:number,lifeMs:number,
  keep:boolean,opacity:number,visible:FootVisibility,spatial?:DualSpatialContext){
  // A/B masks are regenerated from the time-indexed stamps, which lets
  // palette changes recolor previously stamped feet immediately.
  const cacheKey=[presentationMs,lifeMs,keep,impressions.count,impressions.headsCount,
   visible.A.left,visible.A.right,visible.B.left,visible.B.right,
   spatial?.calibration.cameraQuad.map(p=>p.x+','+p.y).join(';')??'image-2d',
   spatial?.videoAspect??0].join('|');
  if(this.footprintCacheSignature!==cacheKey){
   this.footprintCacheSignature=cacheKey;
   for(const actor of ACTORS){
    const atlas=this.footprintMask[actor],g=atlas.getContext('2d');
    if(g){g.clearRect(0,0,W,H);}
   }
   const len=66,width=len*.365;
   for(const stamp of impressions.visible(presentationMs,lifeMs,keep)){
    const actor=stamp.actorId==='B'||stamp.actorId==='performer-2'?'B':'A';
    if(!visible[actor][stamp.foot])continue;
    const p=calibratedPoint(stamp.x,stamp.y,spatial);
    if(!p)continue;
    const alpha=lifetimeOpacity(stamp.atSourceMs,presentationMs,lifeMs,keep);
    if(alpha<=0)continue;
    const g=this.footprintMask[actor].getContext('2d');if(!g)continue;
    paintAuthenticFootprint(g,{x:p.x,y:p.y,side:stamp.foot,
     headingRad:stamp.headingRad,widthPx:width,lengthPx:len,
     alpha,color:'#ffffff',phase:'contact'});
   }
   for(const head of impressions.liveHeads(presentationMs)){
    const actor=head.actorId==='B'||head.actorId==='performer-2'?'B':'A';
    if(!visible[actor][head.foot])continue;
    const p=calibratedPoint(head.x,head.y,spatial);
    const g=this.footprintMask[actor].getContext('2d');
    if(p&&g)paintAuthenticFootprint(g,{x:p.x,y:p.y,
     side:head.foot,headingRad:head.headingRad,widthPx:width,lengthPx:len,
     alpha:head.alpha*.55,color:'#ffffff',phase:'prediction'});
   }
  }
  for(const actor of ACTORS){
   const mask=this.footprintMask[actor],temp=this.tintedFeet[actor],g=temp.getContext('2d');
   if(!g)continue;
   g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;
   g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);
   g.drawImage(mask,0,0);
   g.globalCompositeOperation='source-in';g.fillStyle=palette[actor].footprint;
   g.fillRect(0,0,W,H);
   ctx.globalAlpha=opacity;ctx.globalCompositeOperation='multiply';
   ctx.drawImage(temp,0,0);ctx.globalCompositeOperation='source-over';
  }
 }
 paint(ctx:CanvasRenderingContext2D,opts:{
  palette?:DualTraceV2Palette;order?:DualTraceV2Order;
  impressions:PainterlyImpressionEngine;timeMs:number;
  footprintLifeMs:number;footprintKeep:boolean;
  footVisible:FootVisibility;
  headEnabled:boolean;shoulderEnabled:boolean;headOpacity:number;shoulderOpacity:number;
  pathOpacity?:number;footprintOpacity?:number;upperOpacity?:number;
  spatial?:DualSpatialContext;
  blackout?:boolean;only?:'all'|'foot'|'upper';
 }){
  const {impressions,timeMs,footVisible,spatial}=opts;
  const palette=opts.palette??DEFAULT_DUAL_TRACE_PALETTE;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.fillStyle=opts.blackout?'#000000':'#F7F6F2';
  ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
  if(!opts.blackout){
   const order=dualTraceLayerOrder(opts.order);
   for(const channel of order){
    if(opts.only==='foot'&&channel==='upper'||opts.only==='upper'&&channel!=='upper')continue;
    if(channel==='path')
     this.drawPath(ctx,palette,clamp(opts.pathOpacity??.95,0,1));
    else if(channel==='footprint')
     this.drawFeet(ctx,palette,impressions,timeMs,opts.footprintLifeMs,
      opts.footprintKeep,clamp(opts.footprintOpacity??.85,0,1),footVisible,spatial);
    else this.drawUpper(ctx,palette,clamp(opts.upperOpacity??.35,0,1),
      opts.headEnabled,opts.shoulderEnabled,opts.headOpacity,opts.shoulderOpacity);
   }
  }
  ctx.restore();
 }
}
