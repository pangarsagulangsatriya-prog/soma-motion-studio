import {distance,handFeatures} from '../engine/motion.ts';
import type {MotionFrame} from '../engine/types.ts';
export type PhotoSignal={valid:boolean;open:boolean;click:boolean};
export function photoSignal(frame:MotionFrame):PhotoSignal{
 const hands=frame.hands;
 const valid=frame.source==='camera'&&frame.tracked&&hands.length===2&&hands.every(h=>h.length>=21&&h.slice(0,21).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
 if(!valid)return {valid:false,open:false,click:false};
 const a=handFeatures(hands[0]),b=handFeatures(hands[1]);
 const apart=distance(hands[0][9],hands[1][9])>Math.max(.22,(distance(hands[0][0],hands[0][9])+distance(hands[1][0],hands[1][9]))*1.1);
 const openA=a.open>=.75&&a.pinch<.35,openB=b.open>=.75&&b.pinch<.35;
 return {valid:true,open:apart&&openA&&openB,click:(a.pinch>.78&&openB)||(b.pinch>.78&&openA)};
}
export class PhotoGesture{
 phase:'idle'|'holding'|'ready'|'release'='idle';private since=0;private clickSince:number|null=null;private last:number|null=null;
 reset(){this.phase='idle';this.since=0;this.clickSince=null;this.last=null;}
 step(signal:PhotoSignal,time:number,enabled:boolean,holdMs=800){
  let fired=false,progress=0;
  if(!enabled||!signal.valid||!Number.isFinite(time)){this.reset();return {phase:this.phase,progress,fired};}
  if(this.last!==null&&(time<this.last||time-this.last>300))this.reset();this.last=time;
  if(this.phase==='release'){if(signal.open){this.phase='holding';this.since=time;}return {phase:this.phase,progress,fired};}
  if(this.phase==='ready'){
   if(time-this.since>4000){this.phase='release';this.clickSince=null;}
   else if(signal.click){this.clickSince??=time;if(time-this.clickSince>=80){fired=true;this.phase='release';this.clickSince=null;}}
   else this.clickSince=null;
  }else if(signal.open){if(this.phase==='idle'){this.phase='holding';this.since=time;}progress=Math.min(1,(time-this.since)/holdMs);if(progress>=1){this.phase='ready';this.since=time;}}
  else {this.phase='idle';this.since=0;}
  return {phase:this.phase,progress,fired};
 }
}
export function nextPhotoSlot(slots:(unknown|null)[],replace:number|null):number|null{
 if(replace!==null&&Number.isInteger(replace)&&replace>=0&&replace<4)return replace;
 const empty=Array.from({length:4},(_,i)=>slots[i]??null).findIndex(v=>v===null);return empty<0?null:empty;
}
