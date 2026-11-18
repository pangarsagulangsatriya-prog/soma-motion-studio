/**
 * S0.6.3 — Independent Body Mask A/B + Mask Propagation.
 *
 * Runs INSIDE the normal Footprints MP4 tracking/render pipeline.
 * Source masks are generated only from D2-verified, 33-point pose measurements
 * in S0.6.1's registry; optical-flow displacement propagates the last mask.
 *
 * Geometry follows the existing SOMA lower-body silhouette (pelvis, thighs,
 * shins and feet). These are pose-guided geometric ALPHA masks, not pixel-
 * accurate neural segmentation. Each actor is independent and the output
 * is ALWAYS software-preview-only, never an authorization for hardware.
 */
import type {PersistentActorState} from './persistentActorRegistry.ts';
import type {OpticalFlowFrame,OpticalFlowActor} from './footprintsVideoOpticalFlow.ts';
import {OPTICAL_FLOW_MAX_AGE_MS} from './footprintsVideoOpticalFlow.ts';
import {lowerBodyPosePolygons,LOWER_BODY_MASK_DEFAULTS,
 type MaskPolygon} from '../footprints/stage-optics/LowerBodyMaskEngine.ts';

export type BodyMaskActorId='A'|'B';
export type BodyMaskMode='measured'|'propagated'|'held';
export type BodyMaskPoint={x:number;y:number};
export type BodyMaskActor={
 id:BodyMaskActorId;mode:BodyMaskMode;
 sourceAtMs:number;atMs:number;ageMs:number;
 alpha:number;confidence:number;dx:number;dy:number;
 polygons:MaskPolygon[];bounds:{minX:number;minY:number;maxX:number;maxY:number};
 /** A tentative mask has no verified current A/B pose, only an older anchor. */
 tentative:boolean;
};
export type BodyMaskPresentation={
 atMs:number;actors:BodyMaskActor[];
 /** Never route MP4 masks into the live hardware gate. */
 source:'software-video';physicalOutputAllowed:false;
};
export type BodyMaskSourceFrame={
 atMs:number;segment?:number;
 persistentActors?:PersistentActorState[];
};

type StoredMask={
 id:BodyMaskActorId;atMs:number;polygons:MaskPolygon[];
 bounds:{minX:number;minY:number;maxX:number;maxY:number};
 confidence:number;lastMeasured:boolean;
 flowHold:{dx:number;dy:number;confidence:number;trackedAtMs:number}|null;
};

const IDS=['A','B'] as const;
const FLOW_MIN_CONFIDENCE=.46;
const FLOW_MIN_FEATURES=4;
const HOLD_MS=650;
const HELD_FLOW_GRACE_MS=95;
const MIN_FLOW_DISTANCE=0;
const overlap=(a:BodyMaskActor,b:BodyMaskActor)=>{
 const cx=(a.bounds.minX+a.bounds.maxX)/2;
 const cy=(a.bounds.minY+a.bounds.maxY)/2;
 const bx=(b.bounds.minX+b.bounds.maxX)/2;
 const by=(b.bounds.minY+b.bounds.maxY)/2;
 return Math.hypot(cx-bx,cy-by)<.115;
};
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const validPoint=(p:BodyMaskPoint)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
const translate=(polys:readonly MaskPolygon[],dx:number,dy:number):MaskPolygon[]=>
 polys.map(poly=>({...poly,points:poly.points.map(p=>({
  x:clamp(p.x+dx,0,1),y:clamp(p.y+dy,0,1)
 }))}));
const bounds=(polys:readonly MaskPolygon[])=>{
 const vertices=polys.flatMap(poly=>poly.points);
 return {minX:Math.min(...vertices.map(p=>p.x)),
  minY:Math.min(...vertices.map(p=>p.y)),
  maxX:Math.max(...vertices.map(p=>p.x)),
  maxY:Math.max(...vertices.map(p=>p.y))};
};
const measuredMask=(actor:PersistentActorState):StoredMask|null=>{
 if(!actor.observed||actor.lastObservedAtMs===null||
  !actor.lastPose||actor.lastPose.length!==33)return null;
 const geometry=lowerBodyPosePolygons(actor.lastPose,actor.id==='A'?0:1,{
  ...LOWER_BODY_MASK_DEFAULTS,performers:2,minimumVisibility:.5,
  featherPx:0,requireSegmentation:false
 });
 if(!geometry||geometry.polygons.length<8||
  !geometry.polygons.every(poly=>poly.points.length>=3&&
   poly.points.every(validPoint)))return null;
 return {id:actor.id,atMs:actor.lastObservedAtMs,
  polygons:geometry.polygons,bounds:geometry.bounds,
  confidence:clamp(actor.confidence,0,1),lastMeasured:true,flowHold:null};
};

/**
 * A and B are cached separately. A 2→1→0→2 poseCount sequence never causes
 * the surviving person to be erased; only backward-seek/source changes reset.
 */
export class PersistentBodyMaskEngine{
 private actors=new Map<BodyMaskActorId,StoredMask>();
 private lastFrameMs=-1;
 private segment:number|null=null;
 reset(){this.actors.clear();this.lastFrameMs=-1;this.segment=null;}
 get registeredCount(){return this.actors.size;}
 ingest(frame:BodyMaskSourceFrame):void{
  const atMs=frame.atMs;
  if(!Number.isFinite(atMs)||atMs<0)return;
  if(this.segment!==null&&frame.segment!==undefined&&
   frame.segment!==this.segment)this.reset();
  if(this.lastFrameMs>=0&&atMs<this.lastFrameMs-1)this.reset();
  if(frame.segment!==undefined)this.segment=frame.segment;
  if(this.lastFrameMs>=0&&atMs<=this.lastFrameMs)return;
  this.lastFrameMs=atMs;
  for(const id of IDS){
   const actor=frame.persistentActors?.find(a=>a.id===id);
   if(!actor||!actor.registered)continue;
   const old=this.actors.get(id);
   // A new verified D2 observation re-anchors shape. An occluded person
   // retains the last measured mask; a union segmentation never assigns IDs.
   if(actor.observed&&actor.lastObservedAtMs===atMs){
    const candidate=measuredMask(actor);
    if(candidate)this.actors.set(id,candidate);
    else if(old)old.lastMeasured=false;
   }else if(old){
    old.lastMeasured=false;
   }
  }
 }
 private opticalFor(t:StoredMask,atMs:number,flow?:OpticalFlowFrame){
  const f=flow?.actors.find(a=>a.id===t.id);
  const current=!!f&&f.anchorAtMs===t.atMs&&
   Number.isFinite(f.dx)&&Number.isFinite(f.dy)&&
   f.confidence>=FLOW_MIN_CONFIDENCE&&f.inliers>=FLOW_MIN_FEATURES&&
   f.trackedAtMs<=atMs+12&&
   atMs-f.trackedAtMs>=0&&atMs-f.trackedAtMs<=95&&
   Math.hypot(f.dx,f.dy)>=MIN_FLOW_DISTANCE&&
   Math.hypot(f.dx,f.dy)<=.24;
  if(current&&f){
   t.flowHold={dx:f.dx,dy:f.dy,confidence:f.confidence,
    trackedAtMs:f.trackedAtMs};
   return {dx:f.dx,dy:f.dy,confidence:f.confidence,
    trackedAtMs:f.trackedAtMs};
  }
  const prev=t.flowHold;
  if(prev&&atMs-prev.trackedAtMs<=HELD_FLOW_GRACE_MS&&
   atMs-prev.trackedAtMs>=0){
   return {...prev,confidence:prev.confidence*.8};
  }
  return null;
 }
 present(atMs:number,flow?:OpticalFlowFrame):BodyMaskPresentation{
  const result:BodyMaskActor[]=[];
  if(Number.isFinite(atMs)&&atMs>=0)for(const id of IDS){
   const anchor=this.actors.get(id);
   if(!anchor)continue;
   const age=atMs-anchor.atMs;
   if(age< -35||age>OPTICAL_FLOW_MAX_AGE_MS)continue;
   const moved=this.opticalFor(anchor,atMs,flow);
   if(!moved&&age>HOLD_MS)continue;
   const dx=moved?.dx??0,dy=moved?.dy??0;
   const mode:BodyMaskMode=moved?'propagated':
    anchor.lastMeasured&&age<=145?'measured':'held';
   const limit=moved?OPTICAL_FLOW_MAX_AGE_MS:HOLD_MS;
   const fadeStart=moved?420:260;
   const fade=age<=fadeStart?1:
    clamp((limit-age)/(limit-fadeStart),0,1);
   const alpha=fade*(moved?(.72+.28*moved.confidence):.94);
   if(alpha<=0)continue;
   const polygons=translate(anchor.polygons,dx,dy);
   result.push({id,mode,sourceAtMs:anchor.atMs,atMs,
    ageMs:age,alpha,dx,dy,
    confidence:moved?.confidence??anchor.confidence,
    polygons,bounds:bounds(polygons),tentative:!anchor.lastMeasured||age>145});
  }
  // On top of each other during crossing, optical flow cannot securely
  // assign the overlapping pixels to an actor. Quarantine the uncertain
  // propagated mask(s); keep a separately measured target alive.
  if(result.length===2&&overlap(result[0],result[1])&&
   result.some(a=>a.mode==='propagated')){
   const safe=result.filter(a=>a.mode==='measured');
   if(safe.length)result.splice(0,result.length,...safe);
   else result.splice(0,result.length);
  }
  return {atMs,actors:result,source:'software-video',
   physicalOutputAllowed:false};
 }
}

/** Render two actor-owned alpha silhouettes. Each polygon carries its actor ID.
 * This touches ONLY the caller's preview canvas; it never writes output ports.
 */
export function paintIndependentBodyMasks(ctx:CanvasRenderingContext2D,
 presentation:BodyMaskPresentation,
 rect:{x:number;y:number;width:number;height:number},
 intensity=1):number{
 let rendered=0;
 for(const actor of presentation.actors){
  if(actor.alpha<=0)continue;
  ctx.save();
  ctx.globalAlpha=clamp(actor.alpha*intensity,0,1);
  ctx.fillStyle=actor.tentative?'#a4aaa6':
   actor.id==='A'?'#dbe9ca':'#80d1da';
  for(const poly of actor.polygons){
   if(poly.points.length<3)continue;
   ctx.beginPath();
   for(let i=0;i<poly.points.length;i++){
    const p=poly.points[i];
    if(i===0)ctx.moveTo(rect.x+p.x*rect.width,rect.y+p.y*rect.height);
    else ctx.lineTo(rect.x+p.x*rect.width,rect.y+p.y*rect.height);
   }
   ctx.closePath();ctx.fill();
  }
  ctx.restore();
  rendered++;
 }
 return rendered;
}

/** Explicit A/B alpha-raster generation for validation/export workflows.
 * Rasterization is on demand, not repeated at display refresh rate.
 */
export function rasterBodyMask(actor:BodyMaskActor,width:number,height:number){
 if(!Number.isInteger(width)||!Number.isInteger(height)||
  width<8||width>1024||height<8||height>1024)
  throw Error('Invalid mask raster dimensions');
 const data=new Uint8Array(width*height);
 const inside=(x:number,y:number,poly:MaskPolygon)=>{
  let yes=false;
  for(let i=0,j=poly.points.length-1;i<poly.points.length;j=i++){
   const a=poly.points[i],b=poly.points[j];
   if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;
  }
  return yes;
 };
 for(const poly of actor.polygons){
  const verts=poly.points;
  if(verts.length<3)continue;
  const x0=clamp(Math.floor(Math.min(...verts.map(p=>p.x))*width),0,width-1);
  const x1=clamp(Math.ceil(Math.max(...verts.map(p=>p.x))*width),0,width-1);
  const y0=clamp(Math.floor(Math.min(...verts.map(p=>p.y))*height),0,height-1);
  const y1=clamp(Math.ceil(Math.max(...verts.map(p=>p.y))*height),0,height-1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)
   if(inside((x+.5)/width,(y+.5)/height,poly))
    data[y*width+x]=Math.round(255*actor.alpha);
 }
 return {id:actor.id,width,height,data,previewOnly:true as const};
}
