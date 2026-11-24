import type {MotionFrame,Landmark} from '../../engine/types.ts';
import type {Sample} from '../pattern.ts';

/**
 * Camera-only, gait-inspired artistic estimator.
 * It infers stance, foot lift and sliding/pivot hypotheses from normalized
 * 2D landmarks. No ground-reaction force, pressure or true contact sensor.
 */
export type GaitPhase='unknown'|'stance'|'swing';
export type GaitMotion='unknown'|'hold'|'step'|'pivot'|'slide';
export type GaitSample=Sample&{
 phase:GaitPhase;confidence:number;relativeSpeed:number;
 motionKind?:GaitMotion;
 /** Positive vertical elevation relative to recent stance, in image-space
  * units; NOT a measured height above the floor. */
 liftEstimate?:number;
 stanceDurationMs?:number;
};
type Point={x:number;y:number};
type Internal={
 lastTime:number;relative:Point|null;filtered:Point|null;
 lastImage:Point|null;stanceImageAnchor:Point|null;
 heading:number;baselineY:number|null;phase:GaitPhase;
 stationarySince:number|null;lastStamp:number;
 stanceAnchor:Point|null;anchorHeading:number;
 stanceSince:number|null;
 pendingLanding:boolean;
};
const blank=():Internal=>({
 lastTime:-1,relative:null,filtered:null,lastImage:null,stanceImageAnchor:null,
 heading:0,baselineY:null,
 phase:'unknown',stationarySince:null,lastStamp:-1e9,
 stanceAnchor:null,anchorHeading:0,stanceSince:null,pendingLanding:false
});
const valid=(p:Landmark|undefined)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??0)>=.55;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDifference=(a:number,b:number)=>
 Math.atan2(Math.sin(a-b),Math.cos(a-b));

/**
 * One independently debounced gait state for each foot; reuses the existing
 * MediaPipe ankle (27/28), heel (29/30), toe (31/32) and hips (23/24).
 *
 * The detector prioritizes preventing false CONTACTs during planted pivot and
 * low-level sliding. Faster foot travel with no visible lift remains uncertain
 * to a monocular camera and may be interpreted as swing.
 */
export class GaitAnalyzer{
 private feet:[Internal,Internal]=[blank(),blank()];
 reset(){this.feet=[blank(),blank()];}
 resetSide(side:0|1){this.feet[side]=blank();}
 observe(frame:MotionFrame,side:0|1,clock:number,videoAspect:number):GaitSample|null{
  const pose=frame.pose;
  if(!frame.tracked||frame.source!=='camera'||pose.length<33||
   !Number.isFinite(clock)||!Number.isFinite(videoAspect)||videoAspect<=0){
   this.resetSide(side);return null;
  }
  const ankle=pose[27+side],heel=pose[29+side],toe=pose[31+side];
  const hip=pose[23+side],otherHip=pose[24-side];
  if(![ankle,heel,toe,hip,otherHip].every(valid)){
   this.resetSide(side);return null;
  }
  const previousState=this.feet[side];
  const dt=previousState.lastTime>=0?(clock-previousState.lastTime)/1000:0;
  if(previousState.lastTime>=0&&dt<=0)return null;
  if(dt>.32)this.resetSide(side);
  const state=this.feet[side];
  const factorX=Math.min(1,videoAspect/(16/9)),factorY=Math.min(1,(16/9)/videoAspect);
  const center={x:(heel.x+toe.x)/2,y:(heel.y+toe.y)/2};
  const stage={x:(1-factorX)/2+center.x*factorX,y:(1-factorY)/2+center.y*factorY};
  const pelvis={x:(hip.x+otherHip.x)/2,y:(hip.y+otherHip.y)/2};
  const relative={x:center.x-pelvis.x,y:center.y-pelvis.y};
  const span=Math.max(.08,Math.min(.45,distance(hip,otherHip)));
  const imageSpeed=state.lastImage&&dt>0&&dt<=.32?
   Math.min(8,distance(center,state.lastImage)/dt):0;
  const speed=state.relative&&dt>0&&dt<=.32?
   Math.min(8,distance(relative,state.relative)/dt):0;
  const tau=speed>.7?.035:speed>.32?.065:.12;
  const alpha=state.filtered&&dt>0&&dt<=.32?
   1-Math.exp(-dt/tau):1;
  const filtered=state.filtered?
   {x:state.filtered.x+(stage.x-state.filtered.x)*alpha,
    y:state.filtered.y+(stage.y-state.filtered.y)*alpha}:stage;
  const angle=Math.atan2((toe.y-heel.y)*factorY*720,
   (toe.x-heel.x)*factorX*1280);
  const heading=state.filtered?
   state.heading+alpha*angleDifference(angle,state.heading):angle;
  const join=!!state.filtered&&dt>0&&dt<=.32&&
   distance(state.filtered,filtered)<.20;
  const baseline=state.baselineY??relative.y;
  const rise=Math.max(0,baseline-relative.y);
  const referenceImage=state.stanceImageAnchor??state.lastImage??center;
  const visualRise=Math.max(0,referenceImage.y-center.y);
  const imageTravel=distance(referenceImage,center);
  const lowerLift=Math.max(.020,span*.12);
  const clearLift=Math.max(.050,span*.29);
  const anchor=state.stanceAnchor??relative;
  const travel=distance(anchor,relative);
  const turn=Math.abs(angleDifference(heading,state.anchorHeading));
  // Pivot is a heading change around approximately the same supporting foot.
  // Keeping the foot in stance prevents an unwanted second sole stamp.
  const pivot=state.phase==='stance'&&rise<lowerLift&&
   turn>.30&&travel<Math.max(.028,span*.16);
  // Sliding is a sustained change of foot position while its low elevation
  // remains indistinguishable from planted contact in the camera image.
  const slide=state.phase==='stance'&&rise<lowerLift&&
   travel>Math.max(.026,span*.16)&&imageTravel>.020&&speed<.48&&!pivot;
  // Camera/image displacement helps reject a false step when the pelvis
  // moves or crouches over a visually stationary planted foot.
  const lifted=(rise>clearLift&&visualRise>.010)||
   (rise>lowerLift&&visualRise>.009&&travel>Math.max(.012,span*.07));
  const swungFast=speed>.58&&imageSpeed>.18&&
   travel>Math.max(.028,span*.16)&&imageTravel>.024&&!pivot;
  let phase=state.phase;
  let stamp=false;
  let motionKind:GaitMotion=state.phase==='stance'?'hold':'unknown';
  if(lifted||swungFast){
   phase='swing';motionKind='step';
   state.stationarySince=null;
   state.stanceSince=null;state.pendingLanding=false;
  }else if(pivot||slide){
   // A planted pivot/drag cannot generate another contact until a separate
   // swing and subsequent stable landing have been observed.
   phase='stance';motionKind=pivot?'pivot':'slide';
   state.stationarySince=null;
   state.pendingLanding=false;
  }else {
   const nearFloor=rise<Math.max(.018,span*.10);
   if(nearFloor&&speed<.27){
    state.stationarySince??=clock;
    if(clock-state.stationarySince>=110){
     if(phase!=='stance')state.pendingLanding=true;
     // A landing confirmed during cooldown used to be discarded permanently.
     // Keep it pending only while the same foot remains stably planted.
     if(state.pendingLanding&&clock-state.lastStamp>=320){
      stamp=true;state.lastStamp=clock;state.pendingLanding=false;
     }
     if(phase!=='stance'){
      state.stanceAnchor={...relative};
      state.stanceImageAnchor={...center};
      state.anchorHeading=heading;
      state.stanceSince=clock;
     }
     phase='stance';
     motionKind='hold';
     // Update baseline slowly only while a foot is stably planted.
     state.baselineY=baseline*.96+relative.y*.04;
    }
   }else {state.stationarySince=null;state.pendingLanding=false;}
  }
  if(phase==='stance'&&!state.stanceAnchor){
   state.stanceAnchor={...relative};
   state.stanceImageAnchor={...center};
   state.anchorHeading=heading;
   state.stanceSince??=clock;
  }
  if(phase==='swing'){state.stanceAnchor=null;state.stanceImageAnchor=null;}
  state.lastTime=clock;state.relative=relative;state.lastImage=center;state.filtered=filtered;
  state.heading=heading;state.phase=phase;
  const confidence=Math.min(1,Math.max(0,
   Math.min(ankle.visibility??0,heel.visibility??0,toe.visibility??0,
    hip.visibility??0,otherHip.visibility??0)));
  // A sole stamp is anchored to the observed landing, not the lagged trail.
  const position=stamp?stage:filtered;
  return {x:clamp(position.x),y:clamp(position.y),heading,side,t:clock,
   join,stamp,phase,confidence,relativeSpeed:speed,motionKind,
   liftEstimate:rise,
   stanceDurationMs:phase==='stance'&&state.stanceSince!==null?
    Math.max(0,clock-state.stanceSince):0};
 }
}
