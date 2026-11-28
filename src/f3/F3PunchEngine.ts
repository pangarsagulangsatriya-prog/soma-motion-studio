import type {F3MotionFrame,F3PunchPreset,F3Landmark} from './F3Types.ts';
import {f3Pinched} from './F3FramingController.ts';
const length=(a:F3Landmark,b:F3Landmark)=>Math.hypot(a.x-b.x,a.y-b.y);
export type F3PunchResult={kind:'idle'|'resize'|'prepared'|'capture'|'cooldown'|'invalid';eventId?:string};
type Side='left'|'right';
type Anchor={wrist:{x:number;y:number};other:{x:number;y:number};time:number;side:Side};
export class F3PunchEngine{
 preset:F3PunchPreset;
 constructor(preset:F3PunchPreset='straight'){this.preset=preset;}
 private prepared:Anchor|null=null;
 private lastFrame=-1;
 private cooldownUntil=0;
 private needsNeutral=false;
 private previousResizeAt=0;
 private counter=0;
 private invalidCount=0;
 get negatives(){return this.invalidCount;}
 reset(){this.prepared=null;this.lastFrame=-1;this.needsNeutral=false;this.cooldownUntil=0;this.invalidCount=0;}
 setPreset(preset:F3PunchPreset){this.preset=preset;this.reset();}
 pauseResize(now:number){this.prepared=null;this.previousResizeAt=now;}
 private clenched(hand:F3Landmark[]){
  if(hand.length<21)return false;
  const palm=Math.max(.02,length(hand[0],hand[5]));
  return [8,12,16,20].filter((tip,i)=>length(hand[tip],hand[[5,9,13,17][i]])<palm*1.4).length>=3;
 }
 step(frame:F3MotionFrame,now:number,allowed:boolean):F3PunchResult{
  if(!frame.fresh||frame.pose.length<17||(this.preset==='straight'&&frame.hands.length<1)||frame.confidence<.45){
   this.prepared=null;this.invalidCount++;return {kind:'invalid'};
  }
  if(frame.frameId<=this.lastFrame)return {kind:'idle'};
  this.lastFrame=frame.frameId;
  if(frame.hands.some(h=>f3Pinched(h)&&!this.clenched(h))){this.prepared=null;this.previousResizeAt=now;return {kind:'resize'};}
  if(now-this.previousResizeAt<350){this.prepared=null;return {kind:'resize'};}
  const shoulderL=frame.pose[11],shoulderR=frame.pose[12];
  const leftW=frame.pose[15],rightW=frame.pose[16],leftE=frame.pose[13],rightE=frame.pose[14];
  if([shoulderL,shoulderR,leftW,rightW,leftE,rightE].some(p=>!p||p.visibility!==undefined&&p.visibility<.55)){
   this.prepared=null;return {kind:'invalid'};
  }
  // Associate each observed fist to its closest Pose wrist, never to screen center.
  const shoulderSpan=Math.max(.08,length(shoulderL,shoulderR));
  const candidate=frame.hands.filter(h=>h[0]&&this.clenched(h)).map(h=>{
   const dLeft=length(h[0],leftW),dRight=length(h[0],rightW);
   return {hand:h,side:(dLeft<=dRight?'left':'right') as Side,distance:Math.min(dLeft,dRight)};
  }).filter(x=>x.distance<shoulderSpan*1.9).sort((a,b)=>a.distance-b.distance)[0];
  const poseOnly=this.preset==='uppercut'&&frame.hands.length===0;
  const side:Side=candidate?.side??this.prepared?.side??((leftW.y-shoulderL.y)>(rightW.y-shoulderR.y)?'left':'right');
  const hand=candidate?.hand;
  if(!hand&&!poseOnly){this.prepared=null;this.invalidCount++;return {kind:'invalid'};}
  const w=side==='left'?leftW:rightW,other=side==='left'?rightW:leftW;
  const shoulder=side==='left'?shoulderL:shoulderR,elbow=side==='left'?leftE:rightE;
  const rel={x:w.x-shoulder.x,y:w.y-shoulder.y};
  const otherRel={x:other.x-(side==='left'?shoulderR.x:shoulderL.x),
   y:other.y-(side==='left'?shoulderR.y:shoulderL.y)};
  const isNeutral=Math.abs(rel.x)<.14&&Math.abs(rel.y)<.28;
  if(this.needsNeutral){
   if(now<this.cooldownUntil||!isNeutral)return {kind:'cooldown'};
   this.needsNeutral=false;this.prepared=null;
   return {kind:'idle'};
  }
  const prepValid=this.preset==='straight'
   ?Math.abs(rel.x)<.17&&Math.abs(rel.y)<.22&&length(w,elbow)<.2
   :rel.y>Math.max(.045,shoulderSpan*.25)&&length(w,elbow)<Math.max(.23,shoulderSpan*1.6);
  if(!this.prepared){
   if(prepValid)this.prepared={wrist:rel,other:otherRel,time:now,side};
   return {kind:prepValid?'prepared':'idle'};
  }
  const prep=this.prepared;
  if(prep.side!==side||now-prep.time>750){
   this.prepared=null;return {kind:'idle'};
  }
  const deltaX=rel.x-prep.wrist.x,deltaY=rel.y-prep.wrist.y,elapsed=Math.max(.05,(now-prep.time)/1000);
  const movingOther=Math.hypot(otherRel.x-prep.other.x,otherRel.y-prep.other.y);
  const straight=side==='left'?deltaX<-.17:deltaX>.17;
  const punch=this.preset==='straight'
   ?straight&&Math.abs(deltaY)<.11&&Math.abs(deltaX)/elapsed>.65
   :deltaY<-Math.max(.075,shoulderSpan*.48)&&Math.abs(deltaX)<Math.max(.12,shoulderSpan*.85)&&-deltaY/elapsed>.30;
  const otherLimit=this.preset==='uppercut'?Math.max(.10,shoulderSpan*.65):.09;
  if(!punch||movingOther>otherLimit){if(movingOther>otherLimit)this.prepared=null;return {kind:'idle'};}
  this.prepared=null;this.needsNeutral=true;this.cooldownUntil=now+650;
  if(!allowed)return {kind:'invalid'};
  return {kind:'capture',eventId:this.preset+'-'+frame.frameId+'-'+(++this.counter)};
 }
}
