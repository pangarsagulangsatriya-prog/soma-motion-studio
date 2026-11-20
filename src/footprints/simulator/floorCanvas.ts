import {FOOT_LENGTH_M,FOOT_WIDTH_M,paintAuthenticFootprint} from '../scenes/authenticFootGeometry.ts';
import {deformationAt,shortestAngle,type FootVisualMotion} from '../scenes/dynamicFootDeformation.ts';
import type {CalibrationQATarget} from '../validation/CalibrationQA.ts';
import {floorToUV,type FloorSpace} from '../spatial/coordinates.ts';
import {validateFloorSession,type FloorSession,type FootstepEvent} from '../spatial/events.ts';

/** Unwarped 16:9 floor artwork. Projector quad is applied later, exactly once. */
export const FLOOR_RASTER={width:1280,height:720} as const;
export function floorRasterPoint(floor:FloorSpace,point:FootstepEvent['positionM'],
 width=FLOOR_RASTER.width,height=FLOOR_RASTER.height){
 const uv=floorToUV(floor,point);
 return {x:uv.x*width,y:uv.y*height};
}
const color=(e:FootstepEvent)=>e.performerId==='B'?
 (e.foot==='left'?'#A5D4D1':'#7FB0CB'):
 (e.foot==='left'?'#E6EBD9':'#D2DD8E');
export type FloorCanvasOptions={maxTimeMs?:number;showGrid?:boolean;markersOnly?:boolean;qaTarget?:CalibrationQATarget|null};
export function paintFloorCanvas(canvas:HTMLCanvasElement,session:FloorSession,options:FloorCanvasOptions={}){
 const s=validateFloorSession(session),w=FLOOR_RASTER.width,h=FLOOR_RASTER.height;
 if(canvas.width!==w)canvas.width=w;
 if(canvas.height!==h)canvas.height=h;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Canvas untuk output lantai tidak tersedia.');
 ctx.setTransform(1,0,0,1,0,0);
 ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
 if(options.markersOnly){
  if(options.qaTarget){
   const target=options.qaTarget;
   const x=target.uv.x*w,y=target.uv.y*h;
   ctx.strokeStyle='#ffffff';ctx.fillStyle='#ffffff';ctx.lineWidth=3;
   ctx.beginPath();ctx.moveTo(x-32,y);ctx.lineTo(x+32,y);
   ctx.moveTo(x,y-32);ctx.lineTo(x,y+32);ctx.stroke();
   ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.stroke();
   ctx.font='bold 24px monospace';ctx.textAlign='left';
   ctx.fillText('QA '+target.id+' / '+target.label,x+28,y-27);
   return;
  }
  const positions=[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
  // Marker centres sit at the ACTUAL raster corners, never inset by
  // 18 px: an inset would introduce a systematic floor-alignment error.
  ctx.fillStyle='#e5eadb';ctx.strokeStyle='#e5eadb';ctx.lineWidth=2;
  positions.forEach((p,i)=>{
   // Half-pixel clipping keeps the corner on the real raster boundary
   // without hiding the mark on the right or bottom pixel row.
   const x=p.x===0?.5:p.x===w?w-.5:p.x;
   const y=p.y===0?.5:p.y===h?h-.5:p.y;
   ctx.beginPath();ctx.moveTo(Math.max(0,x-20),y);ctx.lineTo(Math.min(w-1,x+20),y);
   ctx.moveTo(x,Math.max(0,y-20));ctx.lineTo(x,Math.min(h-1,y+20));ctx.stroke();
   ctx.font='bold 17px monospace';ctx.textAlign='left';
   ctx.fillText(String(i+1),p.x===w?x-32:x+12,p.y===h?y-13:y+28);
  });
  ctx.strokeRect(0,0,w-1,h-1);
  return;
 }
 if(options.showGrid){
  ctx.strokeStyle='#34473c';ctx.lineWidth=1;
  for(let i=0;i<=Math.floor(s.floor.widthM);i++){
   const x=i/s.floor.widthM*w;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
  }
  for(let i=0;i<=Math.floor(s.floor.depthM);i++){
   const y=i/s.floor.depthM*h;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
  }
 }
 const last=new Map<string,{x:number;y:number}>();
 const currentContact=new Map<string,FootstepEvent>();
 const motionByContact=new Map<string,FootVisualMotion>();
 const endMs=s.events.at(-1)?.timestampMs??0;
 // A session export must show settled imprints. A timed preview can show
 // a heel landing or movement for the few frames when it actually happens.
 const renderMs=Number.isFinite(options.maxTimeMs)?
  Math.max(0,options.maxTimeMs!):endMs+2000;
 for(const event of s.events){
  if(event.timestampMs>(options.maxTimeMs??Infinity))break;
  const key=event.performerId+':'+event.foot;
  if(event.kind==='contact')currentContact.set(key,event);
  else if(event.kind==='move'||event.kind==='release'){
   const contact=currentContact.get(key);
   if(!contact)continue;
   const uv=floorToUV(s.floor,event.positionM);
   const angle=shortestAngle(event.headingRad-contact.headingRad);
   motionByContact.set(contact.id,{
    kind:event.kind==='release'?'release':Math.abs(angle)>.14?'pivot':'slide',
    atMs:event.timestampMs,x:uv.x,y:uv.y,headingRad:event.headingRad
   });
   if(event.kind==='release')currentContact.delete(key);
  }
 }
 const widthPx=FOOT_WIDTH_M*w/s.floor.widthM;
 const lengthPx=FOOT_LENGTH_M*h/s.floor.depthM;
 for(const e of s.events){
  if(e.timestampMs>(options.maxTimeMs??Infinity))break;
  if(e.kind!=='contact'&&e.kind!=='move'&&e.kind!=='prediction')continue;
  const pt=floorRasterPoint(s.floor,e.positionM),k=e.performerId+':'+e.foot,c=color(e);
  const previous=last.get(k);
  if(e.kind==='move'&&previous&&e.joinPrevious!==false){
   ctx.strokeStyle=c;ctx.globalAlpha=.65;ctx.lineWidth=2.5;
   ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(pt.x,pt.y);ctx.stroke();ctx.globalAlpha=1;
  }
  if(e.kind==='move'||e.kind==='contact')last.set(k,pt);
  if(e.kind!=='contact'&&e.kind!=='prediction')continue;
  paintAuthenticFootprint(ctx,{
   x:pt.x,y:pt.y,side:e.foot,headingRad:Math.PI/2-e.headingRad,
   widthPx,lengthPx,color:c,
   alpha:e.kind==='prediction'?.25:.94,
   deformation:e.kind==='contact'?deformationAt({
    atMs:e.timestampMs,
    ...floorToUV(s.floor,e.positionM),headingRad:e.headingRad
   },renderMs,motionByContact.get(e.id)):undefined,
   phase:e.kind==='prediction'?'prediction':'contact'
  });
 }
}
