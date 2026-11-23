import type {PathEvent} from '../lines/v3/ActorPathTracker.ts';
import type {ActorChannel} from '../lines/v3/ActorPaletteResolver.ts';

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
type Last={x:number;y:number;ms:number;direction?:number;smoothed:number};
/** Artistic nib dynamics, not measured ground pressure.
 * Width is sampled only on accepted path events, never on every render frame.
 */
export class MotionBrushDynamics{
 private state=new Map<ActorChannel,Last>();
 reset(){this.state.clear();}
 forget(actor:ActorChannel){this.state.delete(actor);}
 weight(event:PathEvent,expressive=false):number{
  const actor=event.actorId;
  if(event.kind==='CUT'){
   this.forget(actor);return 1;
  }
  const prev=this.state.get(actor);
  const point=event.point;
  if(event.kind==='START'||!prev){
   this.state.set(actor,{x:point.x,y:point.y,ms:event.timeMs,smoothed:1});
   return 1;
  }
  if(event.kind==='STOP')return prev.smoothed;
  if(event.kind!=='ADD'&&event.kind!=='TURN')return prev.smoothed;
  const dt=clamp((event.timeMs-prev.ms)/1000,.016,.25);
  const dx=point.x-prev.x,dy=point.y-prev.y;
  const distance=Math.hypot(dx,dy);
  const speed=distance/dt;
  const normalizedSpeed=clamp((speed-20)/220,0,1);
  const slow=1-normalizedSpeed;
  const direction=distance>1?Math.atan2(dy,dx):prev.direction;
  const turn=event.turnRad!==undefined?Math.abs(event.turnRad):
   direction!==undefined&&prev.direction!==undefined?
   Math.abs(Math.atan2(Math.sin(direction-prev.direction),Math.cos(direction-prev.direction))):0;
  const curvature=clamp(turn/.85,0,1);
  const raw=clamp(.76+.28*slow+.18*curvature,.68,1.23);
  const target=expressive?raw:1+(raw-1)*.45;
  const smoothed=clamp(prev.smoothed*.55+target*.45,.72,1.23);
  this.state.set(actor,{x:point.x,y:point.y,ms:event.timeMs,direction,smoothed});
  return smoothed;
 }
}
