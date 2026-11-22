import type {DualFootTrajectoryEngine,V3Stroke} from './DualFootTrajectoryEngine.ts';
import {
 DEFAULT_ACTOR_PALETTE,DEFAULT_FOOT_VISIBILITY,actorChannel,resolveActorColor,
 type ActorPalette,type FootColorOverrides,type FootVisibility
} from './ActorPaletteResolver.ts';
import {
 buildPresentationStroke,type StrokeCharacter,type PresentationVertex
} from './PresentationStrokeBuilder.ts';

export type V3Settings={
 actorColors:ActorPalette;
 footOverrides:FootColorOverrides;
 footVisible:FootVisibility;
 actors:{A:boolean;B:boolean};
 styleMode:StrokeCharacter;
 width:number;
 decay:'keep'|'fade';
 lifeMs:number;
 background:'#F5F5F2'|'#111512';
 debug:boolean;
};
export const DEFAULT_V3_SETTINGS:V3Settings={
 actorColors:{...DEFAULT_ACTOR_PALETTE},footOverrides:{},
 footVisible:{A:{...DEFAULT_FOOT_VISIBILITY.A},B:{...DEFAULT_FOOT_VISIBILITY.B}},
 actors:{A:true,B:true},styleMode:'fluid',width:3,
 decay:'keep',lifeMs:8000,background:'#F5F5F2',debug:false
};
const bounded=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));

/** Actor-first styling wraps the same immutable, accepted trajectories as V3.
 * Precision, fluid and paint share the same stored source points and cut gates. */
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
 ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash([]);
 const width=bounded(settings.width,1,16)*w/1600;
 for(const stroke of engine.visible(presentationMs,settings.decay,settings.lifeMs)){
  const actor=actorChannel(stroke.actorId);
  if(!settings.actors[actor]||!settings.footVisible[actor][stroke.foot])continue;
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
 ctx.globalAlpha=1;ctx.setLineDash([]);ctx.restore();
}
function paintOne(ctx:CanvasRenderingContext2D,stroke:V3Stroke,settings:V3Settings,
 width:number,w:number,h:number,now:number):void{
 const result=buildPresentationStroke(stroke,settings.styleMode,w,h);
 const nodes=result.points;
 if(nodes.length<2)return;
 ctx.strokeStyle=resolveActorColor(stroke.actorId,stroke.foot,
  settings.actorColors,settings.footOverrides,settings.background);
 ctx.setLineDash([]); // Same actor's two feet share a continuous primary color.
 // Large histories are drawn in one stroke to avoid thousands of canvas commands
 // per frame. Fade and expressive widths use a bounded number of segments.
 if(settings.decay==='keep'&&nodes.length>400){
  ctx.globalAlpha=1;ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(nodes[0].x,nodes[0].y);
  for(let i=1;i<nodes.length;i++)ctx.lineTo(nodes[i].x,nodes[i].y);
  ctx.stroke();return;
 }
 for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i];
  if(settings.decay==='fade'){
   const age=now-b.atMs;
   ctx.globalAlpha=bounded(1-age/settings.lifeMs,0,1);
  }else ctx.globalAlpha=1;
  if(ctx.globalAlpha<=0)continue;
  const progress=(i-.5)/Math.max(1,nodes.length-1);
  const tip=Math.min(1,progress*8,(1-progress)*8);
  const taper=settings.styleMode==='precision'?1:.78+.22*bounded(tip,0,1);
  let expression=1;
  if(settings.styleMode==='paint'){
   // Image-plane velocity is a display parameter, not measured foot pressure.
   const speed=bounded(b.speedPxPerSec,0,550);
   expression=bounded(1.18-speed/2400,.94,1.18);
  }
  ctx.lineWidth=width*taper*expression;
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 }
 ctx.globalAlpha=1;
}
