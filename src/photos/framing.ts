import {distance,handFeatures,clamp} from '../engine/motion.ts';
import type {MotionFrame} from '../engine/types.ts';

export type FramePhase='waiting'|'resize'|'prepare'|'ready'|'captured';
export type FrameState={open:boolean;size:number;phase:FramePhase;fired:boolean};
type Palm={x:number;y:number;scale:number;open:boolean;fist:boolean};
function palms(frame:MotionFrame):Palm[]{
 if(frame.source!=='camera'||!frame.tracked)return [];
 return frame.hands.filter(h=>h.length>=21&&h.slice(0,21).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))
 .map(h=>{const f=handFeatures(h);return {x:h[0].x,y:h[0].y,scale:distance(h[0],h[9]),open:f.open>=.75&&f.pinch<.4,fist:f.open===0};});
}
/** One open frame permits one strike. Fist motion is measured independently of audio events. */
export class CameraFraming {
 state:FrameState={open:false,size:.6,phase:'waiting',fired:false};
 private last:number|null=null;
 private grip:{gap:number;size:number}|null=null;
 private fist:{anchor:Palm;previous:Palm;since:number;armed:boolean;points:{p:Palm;t:number}[]}|null=null;
 open(){if(!this.state.open){this.state={open:true,size:.6,phase:'waiting',fired:false};this.resetMotion();}return this.state;}
 close(){this.state={...this.state,open:false,phase:'waiting',fired:false};this.resetMotion();}
 resetMotion(){this.last=null;this.grip=null;this.fist=null;}
 step(frame:MotionFrame,now:number,enabled:boolean){
  this.state.fired=false;if(!this.state.open)return {...this.state};
  const valid=enabled&&Number.isFinite(frame.time)&&now>=frame.time&&now-frame.time<300;
  if(!valid){this.resetMotion();this.state.phase='waiting';return {...this.state};}
  if(this.last===frame.time)return {...this.state};
  if(this.last!==null&&(frame.time<=this.last||frame.time-this.last>250))this.resetMotion();
  const dt=this.last===null?.033:(frame.time-this.last)/1000;this.last=frame.time;
  const hands=palms(frame),open=hands.filter(h=>h.open);
  if(open.length===2){
   const gap=Math.hypot(open[0].x-open[1].x,open[0].y-open[1].y);
   if(gap>.08){this.grip??={gap,size:this.state.size};const target=clamp(this.grip.size+(gap-this.grip.gap)*1.35,.25,.9);this.state.size+=(target-this.state.size)*(1-Math.exp(-dt/.075));}
   this.fist=null;this.state.phase='resize';return {...this.state};
  }
  this.grip=null;
  const fists=hands.filter(h=>h.fist&&h.scale>.025);
  const previous=this.fist?.previous;
  const fist=previous?fists.sort((a,b)=>Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y))[0]:fists[0];
  if(!fist){this.fist=null;this.state.phase='waiting';return {...this.state};}
  const state=this.fist;
  if(!state||Math.hypot(fist.x-state.previous.x,fist.y-state.previous.y)>.22){this.fist={anchor:fist,previous:fist,since:frame.time,armed:false,points:[{p:fist,t:frame.time}]};this.state.phase='prepare';return {...this.state};}
  if(!state.armed){
   if(Math.hypot(fist.x-state.anchor.x,fist.y-state.anchor.y)>.035){state.anchor=fist;state.since=frame.time;}
   if(frame.time-state.since>=180){state.armed=true;state.points=[{p:fist,t:frame.time}];}
  }else{
   state.points=state.points.filter(p=>frame.time-p.t<=180);state.points.push({p:fist,t:frame.time});
   const start=state.points[0],elapsed=(frame.time-start.t)/1000;
   // A short downward strike: displacement plus velocity, with a held closed fist first.
   const down=fist.y-start.p.y,side=Math.abs(fist.x-start.p.x);
   if(elapsed>=.045&&down>=.075&&down/elapsed>=.8&&down>side*.8){
    this.state={...this.state,open:false,phase:'captured',fired:true};this.resetMotion();return {...this.state};
   }
  }
  state.previous=fist;this.state.phase=state.armed?'ready':'prepare';return {...this.state};
 }
}
/** Center square in source pixels. Preview and JPEG use this exact same crop. */
export function cameraCrop(width:number,height:number,size:number){
 const safe=Number.isFinite(size)?clamp(size,.25,.9):.6;
 const side=Math.max(1,Math.round(Math.min(width,height)*safe));
 return {x:Math.floor((width-side)/2),y:Math.floor((height-side)/2),width:side,height:side};
}
export type CameraCrop=ReturnType<typeof cameraCrop>;
