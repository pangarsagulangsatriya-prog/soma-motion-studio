/** Perspective-correct anatomical footprint previews for Map.
 * All coordinates are normalized to the operator's draft camera/output quads.
 * This file never writes projector pixels or creates a verified contact.
 */
import {homography,inverse3,transform,validQuad,type Point,type Quad} from '../../projection/geometry.ts';
import {footprintOutline,footprintToes,type FootSide} from '../../footprints/scenes/authenticFootGeometry.ts';
import type {Landmark} from '../../engine/types.ts';

export type MapFootPreview={actorId:string;foot:FootSide;uv:Point;headingRad:number;source:'tracked'|'example';alpha:number};
export type MapPreviewBounds={x:number;y:number;width:number;height:number};
type StageSize={widthM:number;depthM:number};
const finite=(v:number)=>Number.isFinite(v);
const visible=(point:Landmark|undefined):point is Landmark=>
 !!point&&finite(point.x)&&finite(point.y)&&point.x>=0&&point.x<=1&&
 point.y>=0&&point.y<=1&&(point.visibility??1)>=.55;
const inside=(p:Point)=>finite(p.x)&&finite(p.y)&&p.x>=.015&&p.y>=.015&&p.x<=.985&&p.y<=.985;
export const EXAMPLE_MAP_FOOTPRINTS:readonly MapFootPreview[]=[
 {actorId:'contoh',foot:'left',uv:{x:.45,y:.23},headingRad:.08,source:'example',alpha:.36},
 {actorId:'contoh',foot:'right',uv:{x:.55,y:.36},headingRad:-.03,source:'example',alpha:.47},
 {actorId:'contoh',foot:'left',uv:{x:.44,y:.51},headingRad:.12,source:'example',alpha:.55},
 {actorId:'contoh',foot:'right',uv:{x:.56,y:.64},headingRad:-.09,source:'example',alpha:.73},
 {actorId:'contoh',foot:'left',uv:{x:.46,y:.79},headingRad:.05,source:'example',alpha:.83}
];

/** Map the heel/toe vector into metric floor coordinates before rotation;
 * image-space angles cannot be reused after camera perspective correction. */
export function mapTrackedFootPreview(
 pose:readonly Landmark[],cameraQuad:Quad,stage:StageSize
):MapFootPreview[]{
 if(!validQuad(cameraQuad)||!(stage.widthM>0&&stage.depthM>0))return [];
 let inverse:number[];
 try{inverse=inverse3(homography(cameraQuad));}catch{return [];}
 const mapped:MapFootPreview[]=[];
 for(const [foot,heelIndex,toeIndex] of [['left',29,31],['right',30,32]] as const){
  const heel=pose[heelIndex],toe=pose[toeIndex];
  if(!visible(heel)||!visible(toe))continue;
  const a=transform(inverse,{x:heel.x,y:heel.y});
  const b=transform(inverse,{x:toe.x,y:toe.y});
  const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  if(!inside(center))continue;
  const forwardX=(b.x-a.x)*stage.widthM,forwardY=(b.y-a.y)*stage.depthM;
  if(!finite(forwardX)||!finite(forwardY)||Math.hypot(forwardX,forwardY)<.008)continue;
  mapped.push({actorId:'A',foot,uv:center,
   headingRad:Math.atan2(forwardX,-forwardY),source:'tracked',alpha:1});
 }
 return mapped;
}
export function perspectiveFootPoint(
 footprint:MapFootPreview,local:Point,stage:StageSize,destination:Quad
):Point|null{
 if(!validQuad(destination)||stage.widthM<=0||stage.depthM<=0)return null;
 const lateral=local.x*.17,forward=-local.y*.19;
 const sine=Math.sin(footprint.headingRad),cosine=Math.cos(footprint.headingRad);
 const floor={
  x:footprint.uv.x+(cosine*lateral+sine*forward)/stage.widthM,
  y:footprint.uv.y+(sine*lateral-cosine*forward)/stage.depthM
 };
 const warped=transform(homography(destination),floor);
 return finite(warped.x)&&finite(warped.y)?warped:null;
}
/** Homography is evaluated for EVERY anatomical vertex and each toe perimeter.
 * Nearby shoes may widen, skew and rotate relative to distant shoes.
 * Same stage UV and same shoe anatomy drive camera and projected previews. */
export function paintMapPerspectiveFootprints(
 ctx:CanvasRenderingContext2D,marks:readonly MapFootPreview[],
 destination:Quad,stage:StageSize,bounds:MapPreviewBounds
):number{
 if(!validQuad(destination)||!marks.length||stage.widthM<=0||stage.depthM<=0||
  !(bounds.width>0&&bounds.height>0))return 0;
 let projected:number[][];
 try{projected=[homography(destination)];}catch{return 0;}
 const m=projected[0];
 const project=(foot:MapFootPreview,p:Point):Point|null=>{
  const lateral=p.x*.17,along=-p.y*.19;
  const si=Math.sin(foot.headingRad),co=Math.cos(foot.headingRad);
  const floorX=foot.uv.x+(co*lateral+si*along)/stage.widthM;
  const floorY=foot.uv.y+(si*lateral-co*along)/stage.depthM;
  const q=transform(m,{x:floorX,y:floorY});
  return finite(q.x)&&finite(q.y)?{x:bounds.x+q.x*bounds.width,y:bounds.y+q.y*bounds.height}:null;
 };
 let count=0;
 ctx.save();
 ctx.globalCompositeOperation='source-over';
 for(const foot of marks){
  if(!inside(foot.uv)||!finite(foot.headingRad))continue;
  const outline=footprintOutline(foot.foot).map(([x,y])=>project(foot,{x,y}));
  if(outline.some(p=>!p))continue;
  ctx.globalAlpha=Math.max(.08,Math.min(1,foot.alpha));
  ctx.fillStyle=foot.source==='example'?'#b2f0bf':foot.foot==='left'?'#faad70':'#91e5d7';
  ctx.strokeStyle=ctx.fillStyle;
  ctx.beginPath();
  outline.forEach((p,i)=>i?ctx.lineTo(p!.x,p!.y):ctx.moveTo(p!.x,p!.y));
  ctx.closePath();ctx.fill();
  for(const toe of footprintToes(foot.foot)){
   ctx.beginPath();
   for(let i=0;i<=20;i++){
    const angle=i*Math.PI*2/20;
    const dx=toe.rx*Math.cos(angle),dy=toe.ry*Math.sin(angle);
    const x=toe.x+dx*Math.cos(toe.angle)-dy*Math.sin(toe.angle);
    const y=toe.y+dx*Math.sin(toe.angle)+dy*Math.cos(toe.angle);
    const p=project(foot,{x,y});
    if(!p)continue;
    if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
   }
   ctx.closePath();ctx.fill();
  }
  count++;
 }
 ctx.restore();
 return count;
}
