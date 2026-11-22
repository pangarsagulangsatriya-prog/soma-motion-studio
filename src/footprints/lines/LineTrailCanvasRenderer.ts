import type {FootLineTrailEngine,FootLineStroke} from './FootLineTrailEngine.ts';
export type LineTrailsOptions={
 colors:{left:string;right:string};visible:{left:boolean;right:boolean};
 width:number;decay:'keep'|'fade';background:'#F5F5F2'|'#111512';
};
export const DEFAULT_LINE_TRAILS_OPTIONS:LineTrailsOptions={
 colors:{left:'#F34725',right:'#1D1D1D'},
 visible:{left:true,right:true},width:10,decay:'keep',background:'#F5F5F2'
};
const validColor=(s:string)=>/^#[0-9a-f]{6}$/i.test(s);
const bound=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const alpha=(time:number,now:number,life:number)=>bound((time-(now-life))/(life*.34),0,1);
/** Exact same painter for editor preview and native fullscreen; no guides or UI. */
export function paintLineTrails(
 ctx:CanvasRenderingContext2D,engine:FootLineTrailEngine,
 settings:LineTrailsOptions,nowMs:number,blackout=false
){
 const w=ctx.canvas.width,h=ctx.canvas.height;
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle=blackout?'#000000':settings.background;
 ctx.fillRect(0,0,w,h);
 if(blackout){ctx.restore();return;}
 ctx.lineCap='round';ctx.lineJoin='round';
 const life=8000,px=bound(settings.width,2,36)*(w/1600);
 const strokes=engine.visible(nowMs,settings.decay,life);
 for(const stroke of strokes){
  if(!settings.visible[stroke.foot])continue;
  const color=settings.colors[stroke.foot];
  ctx.strokeStyle=validColor(color)?color:'#F34725';
  drawStroke(ctx,stroke,w,h,px,nowMs,settings.decay,life);
 }
 ctx.restore();
}
function drawStroke(ctx:CanvasRenderingContext2D,stroke:FootLineStroke,w:number,h:number,
 width:number,now:number,decay:'keep'|'fade',life:number){
 const points=stroke.points;
 if(points.length<2)return;
 // Midpoints yield a smooth, hand-drawn sweep without inventing trajectory samples.
 for(let i=1;i<points.length;i++){
  const start=points[i-1],end=points[i];
  const a=decay==='keep'?1:Math.min(alpha(start.atMs,now,life),alpha(end.atMs,now,life));
  if(a<=0)continue;
  ctx.globalAlpha=a;
  ctx.lineWidth=width*(.9+.17*end.speed);
  ctx.beginPath();
  if(i===1)ctx.moveTo(start.x*w,start.y*h);
  else{
   const before=points[i-2];
   ctx.moveTo((before.x+start.x)*w/2,(before.y+start.y)*h/2);
   ctx.quadraticCurveTo(start.x*w,start.y*h,
    (start.x+end.x)*w/2,(start.y+end.y)*h/2);
  }
  if(i===1)ctx.lineTo((start.x+end.x)*w/2,(start.y+end.y)*h/2);
  if(i===points.length-1)ctx.lineTo(end.x*w,end.y*h);
  ctx.stroke();
 }
 ctx.globalAlpha=1;
}
