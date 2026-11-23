import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {ActorPathObservation,PathPoint} from './PathObservationRouter.ts';

type SmoothingPreset='responsive'|'balanced'|'stable';
type TrackState={sourceKey:string;epoch:number;lastTime:number;
 previousRaw:PathPoint;position:PathPoint;velocity:PathPoint;idleMs:number};
const diff=(a:PathPoint,b:PathPoint):PathPoint=>({x:a.x-b.x,y:a.y-b.y});
const add=(a:PathPoint,b:PathPoint):PathPoint=>({x:a.x+b.x,y:a.y+b.y});
const scale=(a:PathPoint,f:number):PathPoint=>({x:a.x*f,y:a.y*f});
const len=(a:PathPoint)=>Math.hypot(a.x,a.y);
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
const alpha=(cutoff:number,dt:number)=>1/(1+1/(2*Math.PI*cutoff*dt));
/** Causal, timestamp-driven temporal smoothing. No frame-rate dependency.
 * Position is bounded near the accepted input, so a smoother cannot
 * compress actor travel to the canvas centre over a long clip.
 */
export class AdaptiveMotionSmootherV24{
 private tracks=new Map<ActorChannel,TrackState>();
 reset(){this.tracks.clear();}
 resetActor(actor:ActorChannel){this.tracks.delete(actor);}
 smooth(observation:ActorPathObservation,preset:SmoothingPreset='balanced',
  torsoScalePx=100):ActorPathObservation{
  const actor=observation.actorId,raw=observation.point;
  const old=this.tracks.get(actor);
  const t=observation.timeMs;
  if(!old||old.sourceKey!==observation.sourceKey||
     old.epoch!==observation.epoch||t<=old.lastTime||
     t-old.lastTime>900){
   this.tracks.set(actor,{sourceKey:observation.sourceKey,epoch:observation.epoch,
    lastTime:t,previousRaw:{...raw},position:{...raw},
    velocity:{x:0,y:0},idleMs:0});
   return observation;
  }
  const dt=clamp((t-old.lastTime)/1000,.001,.90);
  const movement=diff(raw,old.previousRaw);
  const normalizedSpeed=len(movement)/Math.max(30,torsoScalePx)/dt;
  const derivative=scale(movement,1/dt);
  const aVelocity=alpha(1.15,dt);
  const velocity=add(scale(old.velocity,1-aVelocity),scale(derivative,aVelocity));
  const settings=preset==='stable'?{min:1.0,beta:.50,lag:.14}:
   preset==='responsive'?{min:2.5,beta:1.6,lag:.08}:
   {min:1.55,beta:1.05,lag:.11};
  const cutoff=settings.min+settings.beta*
   (len(velocity)/Math.max(30,torsoScalePx)+normalizedSpeed)*.50;
  const a=alpha(cutoff,dt);
  let next=add(scale(old.position,1-a),scale(raw,a));
  // Hold subpixel sensor noise at STOP. A true slow walk still accumulates
  // position in raw space and eventually passes the deadband.
  const noiseFloor=clamp(torsoScalePx*.011,.65,1.7);
  const nearlyStill=len(movement)<noiseFloor;
  const idleMs=nearlyStill?old.idleMs+(t-old.lastTime):0;
  if(idleMs>=320&&len(diff(next,old.position))<noiseFloor*1.2)
   next={...old.position};
  // A causal smoother must not lag several feet behind a genuine journey.
  const maxLag=clamp(torsoScalePx*settings.lag,6,22);
  const error=diff(raw,next),d=len(error);
  if(d>maxLag)next=add(raw,scale(error,-maxLag/d));
  // Avoid exploding filter state on invalid / off-canvas estimates.
  if(!Number.isFinite(next.x)||!Number.isFinite(next.y))next={...raw};
  this.tracks.set(actor,{sourceKey:observation.sourceKey,epoch:observation.epoch,
   lastTime:t,previousRaw:{...raw},position:next,velocity,idleMs});
  return {...observation,point:next};
 }
}
