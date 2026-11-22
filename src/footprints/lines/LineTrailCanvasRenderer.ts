import type {FootLineTrailEngine,FootLineStroke,FootLinePoint,LineSmoothness} from './FootLineTrailEngine.ts';
import {paintAuthenticFootprint} from '../scenes/authenticFootGeometry.ts';
import type {FootprintBrushStamp,BrushMode} from './FootprintBrushEngine.ts';
export type LineStyle='ink'|'contour'|'ribbon'|'fiber';
export type LineTrailsOptions={
 colors:{left:string;right:string};visible:{left:boolean;right:boolean};
 style:LineStyle;smoothness:LineSmoothness;showLines:boolean;
 brush:{enabled:boolean;mode:BrushMode;size:number;spacing:number};
 width:number;decay:'keep'|'fade';background:'#F5F5F2'|'#111512';
};
export const DEFAULT_LINE_TRAILS_OPTIONS:LineTrailsOptions={
 colors:{left:'#F34725',right:'#1D1D1D'},
 visible:{left:true,right:true},style:'ink',smoothness:'smooth',showLines:true,
 brush:{enabled:false,mode:'sweep',size:52,spacing:.58},
 width:10,decay:'keep',background:'#F5F5F2'
};
const validColor=(s:string)=>/^#[0-9a-f]{6}$/i.test(s);
const bound=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const fadeAlpha=(time:number,now:number,life:number)=>bound((time-(now-life))/(life*.34),0,1);
type Pixel={x:number;y:number};
/** All four styles paint identical recorded paths. Preview and fullscreen use this same function. */
export function paintLineTrails(
 ctx:CanvasRenderingContext2D,engine:FootLineTrailEngine,
 settings:LineTrailsOptions,nowMs:number,blackout=false,
 brushMarks:readonly FootprintBrushStamp[]=[]
){
 const w=ctx.canvas.width,h=ctx.canvas.height;
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle=blackout?'#000000':settings.background;
 ctx.fillRect(0,0,w,h);
 if(blackout){ctx.restore();return;}
 ctx.lineCap='round';ctx.lineJoin='round';
 const life=8000,px=bound(settings.width,2,36)*(w/1600);
 const strokes=settings.showLines?engine.renderVisible(nowMs,settings.decay,life,55):[];
 for(const stroke of strokes){
  if(!settings.visible[stroke.foot])continue;
  ctx.strokeStyle=validColor(settings.colors[stroke.foot])?settings.colors[stroke.foot]:'#F34725';
  drawStroke(ctx,stroke,w,h,px,nowMs,settings.decay,life,settings.style);
 }
 if(settings.brush.enabled){
  const size=bound(settings.brush.size,20,100)*(w/1600);
  const tips=new Map<string,{last:FootLinePoint;foot:'left'|'right';headingRad:number}>();
  if(settings.brush.mode==='sweep'){
   // A single continuous paint stroke per tracked performer, instead of
   // stamping the anatomical sole once every few pixels.
   const paths=engine.renderVisible(nowMs,settings.decay,life,55);
   for(const stroke of paths){
    if(!settings.visible[stroke.foot])continue;
    const color=settings.colors[stroke.foot];
    ctx.strokeStyle=validColor(color)?color:'#F34725';
    const last=stroke.points.at(-1)!;
    const before=stroke.points.at(-2)!;
    tips.set(stroke.actorId,{last,foot:stroke.foot,
     headingRad:Number.isFinite(last.headingRad)?last.headingRad!:
      Math.atan2((last.x-before.x)*w,-(last.y-before.y)*h)});
    const alpha=settings.decay==='keep'?1:fadeAlpha(last.atMs,nowMs,life);
    if(alpha<=0)continue;
    traceBrush(ctx,stroke.points,w,h);
    ctx.globalAlpha=alpha*.20;ctx.lineWidth=size*.72;ctx.stroke();
    ctx.globalAlpha=alpha*.75;ctx.lineWidth=size*.32;ctx.stroke();
   }
  }
  const heads=settings.brush.mode==='sweep'?new Map<string,FootprintBrushStamp>():null;
  if(heads)for(const mark of brushMarks){
   if(mark.mode!=='sweep')continue;
   const previous=heads.get(mark.actorId);
   if(!previous||previous.atMs<=mark.atMs)heads.set(mark.actorId,mark);
  }
  for(const mark of brushMarks){
   if(mark.mode!==settings.brush.mode||!settings.visible[mark.foot])continue;
   if(heads&&heads.get(mark.actorId)!==mark)continue;
   const tip=heads?tips.get(mark.actorId):null;
   if(heads&&(!tip||tip.foot!==mark.foot))continue;
   const atMs=tip?.last.atMs??mark.atMs;
   const opacity=settings.decay==='keep'?1:fadeAlpha(atMs,nowMs,life);
   if(opacity<=0)continue;
   const color=settings.colors[mark.foot];
   ctx.globalAlpha=1;
   paintAuthenticFootprint(ctx,{
    x:(tip?.last.x??mark.x)*w,y:(tip?.last.y??mark.y)*h,
    side:mark.foot,headingRad:tip?.headingRad??mark.headingRad,
    widthPx:size*.43,lengthPx:size,alpha:opacity*.80,
    color:validColor(color)?color:'#F34725'
   });
  }
 }
 ctx.globalAlpha=1;
 ctx.restore();
}
/** Stroke path uses only observed foot positions. One path, one brush head. */
function traceBrush(ctx:CanvasRenderingContext2D,points:readonly FootLinePoint[],w:number,h:number){
 if(points.length<2)return;
 ctx.beginPath();
 ctx.moveTo(points[0].x*w,points[0].y*h);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  ctx.quadraticCurveTo(a.x*w,a.y*h,(a.x+b.x)*w/2,(a.y+b.y)*h/2);
 }
 const last=points[points.length-1];
 ctx.lineTo(last.x*w,last.y*h);
}
function pixel(points:readonly FootLinePoint[],i:number,w:number,h:number,offset=0):Pixel{
 const p=points[i];
 const prior=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
 const dx=(next.x-prior.x)*w,dy=(next.y-prior.y)*h;
 const len=Math.hypot(dx,dy)||1;
 return {x:p.x*w-dy/len*offset,y:p.y*h+dx/len*offset};
}
/** A continuous succession of midpoint quadratics with rounded joins.
    No extrapolation or control points outside neighboring observed samples. */
function traceSegment(ctx:CanvasRenderingContext2D,points:readonly FootLinePoint[],
 i:number,w:number,h:number,offset=0){
 const start=pixel(points,i-1,w,h,offset);
 const end=pixel(points,i,w,h,offset);
 ctx.beginPath();
 if(i===1){
  ctx.moveTo(start.x,start.y);
  if(points.length===2)ctx.lineTo(end.x,end.y);
  else ctx.lineTo((start.x+end.x)/2,(start.y+end.y)/2);
 }else{
  const before=pixel(points,i-2,w,h,offset);
  ctx.moveTo((before.x+start.x)/2,(before.y+start.y)/2);
  ctx.quadraticCurveTo(start.x,start.y,(start.x+end.x)/2,(start.y+end.y)/2);
  if(i===points.length-1)ctx.lineTo(end.x,end.y);
 }
}
function drawStroke(ctx:CanvasRenderingContext2D,stroke:FootLineStroke,w:number,h:number,
 width:number,now:number,decay:'keep'|'fade',life:number,style:LineStyle){
 const points=stroke.points;
 if(points.length<2)return;
 for(let i=1;i<points.length;i++){
  const start=points[i-1],end=points[i];
  const opacity=decay==='keep'?1:Math.min(fadeAlpha(start.atMs,now,life),fadeAlpha(end.atMs,now,life));
  if(opacity<=0)continue;
  const variation=.83+.27*end.speed;
  switch(style){
   case 'contour':
    ctx.globalAlpha=opacity;ctx.lineWidth=width*.65;
    traceSegment(ctx,points,i,w,h);ctx.stroke();break;
   case 'ribbon':
    ctx.globalAlpha=opacity*.23;ctx.lineWidth=width*2.7;
    traceSegment(ctx,points,i,w,h);ctx.stroke();
    ctx.globalAlpha=opacity*.95;ctx.lineWidth=Math.max(1.2,width*.35);
    traceSegment(ctx,points,i,w,h);ctx.stroke();break;
   case 'fiber':
    for(const lane of [-.62,-.31,0,.31,.62]){
     ctx.globalAlpha=opacity*(lane===0?.95:.47);
     ctx.lineWidth=Math.max(1,width*.21)*(lane===0?1.1:1);
     traceSegment(ctx,points,i,w,h,width*lane);ctx.stroke();
    }
    break;
   default:
    ctx.globalAlpha=opacity;ctx.lineWidth=width*variation;
    traceSegment(ctx,points,i,w,h);ctx.stroke();
  }
 }
 ctx.globalAlpha=1;
}
