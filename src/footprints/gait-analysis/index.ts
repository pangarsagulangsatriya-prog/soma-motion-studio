import type {MotionFrame,Landmark} from '../../engine/types.ts';
import type {Sample} from '../pattern.ts';

/**
 * Gait-inspired artwork state machine for a single frontal/body webcam.
 * Estimated stance/swing and contacts; NOT clinical gait analysis or measured ground force.
 */
export type GaitPhase='unknown'|'stance'|'swing';
export type GaitSample=Sample&{phase:GaitPhase;confidence:number;relativeSpeed:number};
type Point={x:number;y:number};
type Internal={lastTime:number;relative:Point|null;filtered:Point|null;heading:number;baselineY:number|null;phase:GaitPhase;stationarySince:number|null;lastStamp:number};
const blank=():Internal=>({lastTime:-1,relative:null,filtered:null,heading:0,baselineY:null,phase:'unknown',stationarySince:null,lastStamp:-1e9});
const valid=(p:Landmark|undefined)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??0)>=.55;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const hypot=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);

/** Uses MediaPipe ankle 27/28, heel 29/30, foot-index 31/32, hips 23/24. */
export class GaitAnalyzer{
 private feet:[Internal,Internal]=[blank(),blank()];
 reset(){this.feet=[blank(),blank()];}
 resetSide(side:0|1){this.feet[side]=blank();}
 observe(frame:MotionFrame,side:0|1,clock:number,videoAspect:number):GaitSample|null{
  const p=frame.pose;
  if(!frame.tracked||frame.source!=='camera'||p.length<33||!Number.isFinite(clock)){
   this.resetSide(side);return null;
  }
  const ankle=p[27+side],heel=p[29+side],toe=p[31+side],hip=p[23+side],otherHip=p[24-side];
  if(![ankle,heel,toe,hip,otherHip].every(valid)){this.resetSide(side);return null;}
  const state=this.feet[side],factorX=Math.min(1,videoAspect/(16/9)),factorY=Math.min(1,(16/9)/videoAspect);
  const raw={x:(heel.x+toe.x)/2,y:(heel.y+toe.y)/2};
  const at={x:(1-factorX)/2+raw.x*factorX,y:(1-factorY)/2+raw.y*factorY};
  const hipCenter={x:(hip.x+otherHip.x)/2,y:(hip.y+otherHip.y)/2};
  const relative={x:raw.x-hipCenter.x,y:raw.y-hipCenter.y};
  const t=clock,dt=state.lastTime>=0?(t-state.lastTime)/1000:0;
  if(dt<=0&&state.lastTime>=0)return null;
  if(dt>.32){this.resetSide(side);}
  const s=this.feet[side],previous=s.filtered,previousRelative=s.relative;
  const speed=previousRelative&&dt>0&&dt<=.32?Math.min(8,hypot(relative,previousRelative)/dt):0;
  // Adaptive smoothing: suppress jitter when nearly still, follow the foot promptly during swings.
  const tau=speed>.7?.035:speed>.32?.065:.12;
  const alpha=previous&&dt>0&&dt<=.32?1-Math.exp(-dt/tau):1;
  const filtered=previous?{x:previous.x+(at.x-previous.x)*alpha,y:previous.y+(at.y-previous.y)*alpha}:at;
  const angle=Math.atan2((toe.y-heel.y)*factorY*720,(toe.x-heel.x)*factorX*1280);
  const delta=Math.atan2(Math.sin(angle-s.heading),Math.cos(angle-s.heading));
  const heading=previous?s.heading+alpha*delta:angle;
  const join=!!previous&&dt>0&&dt<=.32&&hypot(previous,filtered)<.20;
  const baseline=s.baselineY??relative.y;
  // Raise relative to the hip indicates a potential swing, not a measured foot-off.
  const raised=baseline-relative.y>.055;
  const swinging=raised||speed>.58;
  let phase=s.phase;
  let stamp=false;
  const closeToRest=!raised&&speed<.27;
  if(swinging){phase='swing';s.stationarySince=null;}
  else if(closeToRest){
   s.stationarySince??=t;
   if(t-s.stationarySince>=110){
    // A single onset for each contact. Never continuously stamp while standing.
    if(phase!=='stance'&&t-s.lastStamp>=320){stamp=true;s.lastStamp=t;}
    phase='stance';
    s.baselineY=baseline*.9+relative.y*.1;
   }
  }else{s.stationarySince=null;}
  s.lastTime=t;s.relative=relative;s.filtered=filtered;s.heading=heading;s.phase=phase;
  return {x:clamp(filtered.x),y:clamp(filtered.y),heading,side,t,join,stamp,phase,
    confidence:Math.min(1,Math.max(0,Math.min(ankle.visibility??0,heel.visibility??0,toe.visibility??0,hip.visibility??0))),
    relativeSpeed:speed};
 }
}
