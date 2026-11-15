import {clamp} from '../engine/motion.ts';
import type {Landmark,MotionFrame} from '../engine/types.ts';

export type FramePhase='waiting'|'resize'|'prepare'|'ready'|'captured';
export type FrameState={open:boolean;size:number;phase:FramePhase;fired:boolean};
type Point={x:number;y:number};
type Body={left:Point|null;right:Point|null;scale:number};
type Sample={t:number;left:Point|null;right:Point|null};
const MIN_SIZE=.12,MAX_SIZE=1;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const visible=(p:Landmark|undefined)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??1)>=.58;

/** Shoulder-relative wrist coordinates make a short strike legible during torso sway.
 * Uses Pose Landmarker only: no hand landmarks, pinch classifier, or fist classifier.
 */
function bodyPoints(frame:MotionFrame):Body|null{
 if(frame.source!=='camera'||!frame.tracked||frame.pose.length<17)return null;
 const p=frame.pose,ls=p[11],rs=p[12];
 if(!visible(ls)||!visible(rs))return null;
 const center={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
 const hips=visible(p[23])&&visible(p[24])?{x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2}:null;
 const scale=Math.max(.12,distance(ls,rs),hips?distance(center,hips):0);
 const relative=(index:number):Point|null=>visible(p[index])?{x:(p[index].x-center.x)/scale,y:(p[index].y-center.y)/scale}:null;
 const left=relative(15),right=relative(16);
 return left||right?{left,right,scale}:null;
}

/** Body-pose instrument: both wrists moving apart/together resize.
 * A quick, isolated wrist displacement relative to the shoulders captures in any direction.
 * Each opening permits exactly one shot. Lost/stale detection breaks gesture history.
 */
export class CameraFraming{
 state:FrameState={open:false,size:.6,phase:'waiting',fired:false};
 private last:number|null=null;
 private previous:Sample|null=null;
 private samples:Sample[]=[];
 private readySince:number|null=null;
 private zoom:{gap:number;size:number}|null=null;
 private pairAnchor:{left:Point;right:Point;gap:number;size:number}|null=null;
 private resizeUntil=-Infinity;
 private zoomIdleStart=0;
 open(){if(!this.state.open){this.state={open:true,size:.6,phase:'waiting',fired:false};this.resetMotion();}return {...this.state};}
 close(){this.state={...this.state,open:false,phase:'waiting',fired:false};this.resetMotion();}
 setSize(size:number){this.state.size=clamp(size,MIN_SIZE,MAX_SIZE);this.zoom=null;this.pairAnchor=null;return {...this.state};}
 resetMotion(){this.last=null;this.previous=null;this.samples=[];this.readySince=null;this.zoom=null;this.pairAnchor=null;this.zoomIdleStart=0;this.resizeUntil=-Infinity;}
 step(frame:MotionFrame,now:number,enabled:boolean){
  this.state.fired=false;
  if(!this.state.open)return {...this.state};
  if(!enabled||!Number.isFinite(frame.time)||!Number.isFinite(now)||now<frame.time||now-frame.time>300){
   this.resetMotion();this.state.phase='waiting';return {...this.state};
  }
  if(this.last===frame.time)return {...this.state};
  if(this.last!==null&&(frame.time<=this.last||frame.time-this.last>250))this.resetMotion();
  const body=bodyPoints(frame),time=frame.time;
  if(!body){this.resetMotion();this.state.phase='waiting';return {...this.state};}
  const current:Sample={t:time,left:body.left,right:body.right};
  const prev=this.previous,dt=prev?Math.max(.008,(time-prev.t)/1000):.033;
  this.last=time;this.previous=current;
  this.samples.push(current);this.samples=this.samples.filter(s=>time-s.t<=220);
  if(this.readySince===null)this.readySince=time;
  if(body.left&&body.right){
   const l=body.left,r=body.right;
   this.pairAnchor??={left:l,right:r,gap:distance(l,r),size:this.state.size};
   const a=this.pairAnchor,axis={x:a.right.x-a.left.x,y:a.right.y-a.left.y};
   const axisLen=Math.max(.01,Math.hypot(axis.x,axis.y));
   const projected=(p:Point,q:Point)=>((p.x-q.x)*axis.x+(p.y-q.y)*axis.y)/axisLen;
   const ld=projected(l,a.left),rd=projected(r,a.right);
   // Compare both wrist trajectories to the same anchor, not frame-by-frame jitter.
   const paired=(ld<-.095&&rd>.095)||(ld>.095&&rd<-.095);
   if(paired||this.zoom!==null){
    this.zoom??={gap:a.gap,size:a.size};
    const target=clamp(this.zoom.size*distance(l,r)/Math.max(.18,this.zoom.gap),MIN_SIZE,MAX_SIZE);
    this.state.size+=(target-this.state.size)*(1-Math.exp(-dt/.07));
    this.resizeUntil=time+160;this.readySince=null;this.samples=[current];
    // Once paired movement stops, a fresh strike can be armed.
    if(prev&&prev.left&&prev.right&&Math.abs(distance(l,r)-distance(prev.left,prev.right))<.014){
     if(!this.zoomIdleStart)this.zoomIdleStart=time;
     if(time-this.zoomIdleStart>180){this.zoom=null;this.pairAnchor={left:l,right:r,gap:distance(l,r),size:this.state.size};this.resizeUntil=time+220;}
    }else this.zoomIdleStart=0;
    this.state.phase='resize';return {...this.state};
   }
  }else this.pairAnchor=null;
  if(time<this.resizeUntil){
   this.state.phase='resize';this.samples=[current];return {...this.state};
  }
  this.zoom=null;
  if(this.readySince===null)this.readySince=time;
  if(time-this.readySince<130){this.state.phase='prepare';return {...this.state};}
  const earliest=this.samples[0];
  const getTravel=(side:'left'|'right')=>{
   const a=earliest?.[side],b=current[side];
   if(!a||!b)return {distance:0,speed:0};
   const displacement=distance(a,b),duration=Math.max(.04,(time-earliest.t)/1000);
   return {distance:displacement,speed:displacement/duration};
  };
  const l=getTravel('left'),r=getTravel('right');
  const fast=l.distance>=r.distance?l:r,other=l.distance>=r.distance?r:l;
  // Minimum displacement and speed, plus dominance over the other arm.
  // No preferred axis: left, right, upward and downward strikes work equally.
  if(fast.distance>=.36&&fast.speed>=2.1&&fast.distance>other.distance*1.65&&other.distance<.30){
   this.state={...this.state,open:false,phase:'captured',fired:true};this.resetMotion();return {...this.state};
  }
  this.state.phase='ready';return {...this.state};
 }
}
/** Center square crop in source pixels. Preview and JPEG use the same geometry. */
export function cameraCrop(width:number,height:number,size:number){
 const safe=Number.isFinite(size)?clamp(size,MIN_SIZE,MAX_SIZE):.6;
 const side=Math.max(1,Math.round(Math.min(width,height)*safe));
 return {x:Math.floor((width-side)/2),y:Math.floor((height-side)/2),width:side,height:side};
}
export type CameraCrop=ReturnType<typeof cameraCrop>;
