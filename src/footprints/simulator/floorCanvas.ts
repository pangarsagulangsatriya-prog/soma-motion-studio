import {sole} from '../pattern.ts';
import {floorToUV,type FloorSpace} from '../spatial/coordinates.ts';
import {validateFloorSession,type FloorSession,type FootstepEvent} from '../spatial/events.ts';

/** Unwarped 16:9 floor artwork. Projector quad is applied later, exactly once. */
export const FLOOR_RASTER={width:1280,height:720} as const;
export function floorRasterPoint(floor:FloorSpace,point:FootstepEvent['positionM'],
 width=FLOOR_RASTER.width,height=FLOOR_RASTER.height){
 const uv=floorToUV(floor,point);
 return {x:uv.x*width,y:uv.y*height};
}
const solePath=()=>{
 if(typeof Path2D!=='undefined')return new Path2D(sole);
 return null;
};
const color=(e:FootstepEvent)=>e.performerId==='B'?
 (e.foot==='left'?'#A5D4D1':'#7FB0CB'):
 (e.foot==='left'?'#E6EBD9':'#D2DD8E');
export type FloorCanvasOptions={maxTimeMs?:number;showGrid?:boolean;markersOnly?:boolean};
export function paintFloorCanvas(canvas:HTMLCanvasElement,session:FloorSession,options:FloorCanvasOptions={}){
 const s=validateFloorSession(session),w=FLOOR_RASTER.width,h=FLOOR_RASTER.height;
 if(canvas.width!==w)canvas.width=w;
 if(canvas.height!==h)canvas.height=h;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Canvas untuk output lantai tidak tersedia.');
 ctx.setTransform(1,0,0,1,0,0);
 ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
 if(options.markersOnly){
  const positions=[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
  // Marker centres sit at the ACTUAL raster corners, never inset by
  // 18 px: an inset would introduce a systematic floor-alignment error.
  ctx.fillStyle='#e5eadb';ctx.strokeStyle='#e5eadb';ctx.lineWidth=2;
  positions.forEach((p,i)=>{
   const {x,y}=p;
   ctx.beginPath();ctx.moveTo(Math.max(0,x-20),y);ctx.lineTo(Math.min(w,x+20),y);
   ctx.moveTo(x,Math.max(0,y-20));ctx.lineTo(x,Math.min(h,y+20));ctx.stroke();
   ctx.font='bold 17px monospace';ctx.textAlign='left';
   ctx.fillText(String(i+1),x===w?x-32:x+12,y===h?y-13:y+28);
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
 const path=solePath(),last=new Map<string,{x:number;y:number}>();
 const size=Math.min(w/s.floor.widthM,h/s.floor.depthM)*.3;
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
  ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(Math.PI/2-e.headingRad);
  ctx.scale(size,size);ctx.globalAlpha=e.kind==='prediction'?.25:.94;
  ctx.fillStyle=c;
  if(path)ctx.fill(path);
  for(let i=0;i<5;i++){
   ctx.beginPath();ctx.ellipse(-.23+i*.14,-.75+(i/4)**2*.26,
    .08-i*.007,.11-i*.012,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
 }
}
