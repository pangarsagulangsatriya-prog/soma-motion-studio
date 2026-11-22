import type {DualFootTrajectoryEngine,V3Stroke} from './DualFootTrajectoryEngine.ts';

export type V3Settings={
 colors:{left:string;right:string};
 visible:{left:boolean;right:boolean};
 actors:{A:boolean;B:boolean};
 width:number;
 decay:'keep'|'fade';
 lifeMs:number;
 background:'#F5F5F2'|'#111512';
 debug:boolean;
};
export const DEFAULT_V3_SETTINGS:V3Settings={
 colors:{left:'#E44F32',right:'#289B92'},
 visible:{left:true,right:true},actors:{A:true,B:true},width:3,
 decay:'keep',lifeMs:8000,background:'#F5F5F2',debug:false
};
const validColor=(s:string)=>/^#[0-9a-f]{6}$/i.test(s);
const bounded=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
/** A straight polyline through accepted coordinates only. No smoothing curve,
 * glow, blur, interpolation or projection beyond the observed frame. */
export function paintTrajectory(
 ctx:CanvasRenderingContext2D,engine:DualFootTrajectoryEngine,
 settings:V3Settings,presentationMs:number,blackout=false,fullscreen=false
):void{
 const w=ctx.canvas.width,h=ctx.canvas.height;
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle=blackout?'#000000':settings.background;
 ctx.fillRect(0,0,w,h);
 if(blackout){ctx.restore();return;}
 ctx.lineCap='round';ctx.lineJoin='round';
 const width=bounded(settings.width,1,16)*w/1600;
 for(const stroke of engine.visible(presentationMs,settings.decay,settings.lifeMs)){
  if(!settings.visible[stroke.foot])continue;
  if((stroke.actorId==='A'||stroke.actorId==='B')&&!settings.actors[stroke.actorId])continue;
  paintOne(ctx,stroke,settings,width,w,h,presentationMs);
 }
 if(settings.debug&&!fullscreen){
  for(const d of engine.diagnostics.slice(-12)){
   if(!d.accepted||!d.raw)continue;
   ctx.beginPath();ctx.arc(d.raw.x*w,d.raw.y*h,4*w/1600,0,Math.PI*2);
   ctx.strokeStyle='#202020';ctx.lineWidth=1;ctx.stroke();
   if(d.display){
    ctx.beginPath();ctx.arc(d.display.x*w,d.display.y*h,2*w/1600,0,Math.PI*2);
    ctx.fillStyle='#ffbb55';ctx.fill();
   }
  }
 }
 ctx.restore();
}
function paintOne(ctx:CanvasRenderingContext2D,stroke:V3Stroke,settings:V3Settings,
 width:number,w:number,h:number,now:number):void{
 const points=stroke.points;if(points.length<2)return;
 const color=settings.colors[stroke.foot];
 ctx.strokeStyle=validColor(color)?color:'#E44F32';
 ctx.lineWidth=width;
 // Actor B uses a subtle dashed channel as a backup to the color differences.
 ctx.setLineDash(stroke.actorId==='B'?[10*w/1600,5*w/1600]:[]);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(settings.decay==='fade'){
   const age=now-b.atMs;
   ctx.globalAlpha=bounded(1-age/settings.lifeMs,0,1);
  }else ctx.globalAlpha=1;
  if(ctx.globalAlpha<=0)continue;
  ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);ctx.stroke();
 }
 ctx.globalAlpha=1;ctx.setLineDash([]);
}
