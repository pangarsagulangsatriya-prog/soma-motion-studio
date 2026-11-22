import type {SumiStrokeGeometry,InkPoint} from './SumiStrokeGeometryBuilder.ts';
export type SumiMaterial='sumi'|'dry-brush'|'dense-pigment';
export type SumiInkStyle={color:string;material:SumiMaterial;weightPx:number;
 expression:'natural'|'bold';seed:number};
const random=(seed:number,index:number)=>{
 let n=Math.imul(seed^(index*0x9e3779b9),2246822519)>>>0;
 n=Math.imul(n^(n>>>13),3266489917)>>>0;
 return ((n^(n>>>16))>>>0)/4294967296;
};
function trace(ctx:CanvasRenderingContext2D,g:SumiStrokeGeometry){
 ctx.beginPath();
 g.left.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
 for(let i=g.right.length-1;i>=0;i--)ctx.lineTo(g.right[i].x,g.right[i].y);
 ctx.closePath();
}
function polyline(ctx:CanvasRenderingContext2D,points:readonly InkPoint[]){
 ctx.beginPath();points.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
}
/** Draw onto an isolated temporary canvas. The destination painting never gets erased by grain. */
export function renderSumiMaterial(ctx:CanvasRenderingContext2D,
 g:SumiStrokeGeometry,style:SumiInkStyle){
 const dry=style.material==='dry-brush';
 const dense=style.material==='dense-pigment';
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 // Local wet edge. Canvas's local area is limited to stroke bounds by the caller.
 ctx.globalAlpha=dry?.10:dense?.17:.18;
 ctx.strokeStyle=style.color;ctx.lineWidth=Math.max(1,style.weightPx*.09);
 polyline(ctx,g.left);ctx.stroke();polyline(ctx,g.right);ctx.stroke();
 trace(ctx,g);ctx.globalAlpha=dry?.76:dense?.96:.91;ctx.fillStyle=style.color;ctx.fill();
 // Locally darken the core in denser pigment; overlap only happens on a new event.
 if(dense){
  trace(ctx,g);ctx.globalAlpha=.30;ctx.fill();
 }
 // Seeded fibers are clipped to the local stroke envelope and do not alter older strokes.
 const bounds=g.bounds;
 if(dry||!dense){
  ctx.save();trace(ctx,g);ctx.clip();
  ctx.globalCompositeOperation='destination-out';
  ctx.globalAlpha=dry?.70:.24;
  const count=Math.min(140,Math.max(6,Math.floor(bounds.width*bounds.height/(dry?55:145))));
  ctx.strokeStyle='#000';ctx.lineWidth=dry?1.45:.7;
  for(let i=0;i<count;i++){
   const x=bounds.x+random(style.seed,i*3)*bounds.width;
   const y=bounds.y+random(style.seed,i*3+1)*bounds.height;
   const d=2+random(style.seed,i*3+2)*(dry?17:9);
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+d*.72,y+d*.5);ctx.stroke();
  }
  ctx.restore();
 }
 // A pooled edge near the end is bounded within the existing envelope.
 if(g.centerline.length>2){
  const last=g.centerline[g.centerline.length-1];
  ctx.globalAlpha=dry?.10:dense?.22:.19;
  ctx.fillStyle=style.color;ctx.beginPath();
  ctx.ellipse(last.x,last.y,Math.max(1,g.widths.at(-1)!*.36),
   Math.max(1,g.widths.at(-1)!*.28),0,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
