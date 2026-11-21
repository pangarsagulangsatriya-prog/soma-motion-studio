import type {F3MotionFrame,F3Rect,F3Landmark} from './F3Types.ts';
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const distance=(a:F3Landmark,b:F3Landmark)=>Math.hypot(a.x-b.x,a.y-b.y);
export function f3Pinched(hand:F3Landmark[]){
 return hand.length>=21&&distance(hand[4],hand[8])<Math.max(.035,distance(hand[0],hand[5])*.36);
}
export function f3Crop(width:number,height:number,fraction:number,aspect=1.36,center={x:.5,y:.5}):F3Rect{
 const ratio=clamp(aspect,.3,3),safe=clamp(fraction,.2,1);
 const maxW=Math.min(width,height*ratio),w=Math.max(1,Math.floor(maxW*safe));
 const h=Math.max(1,Math.floor(w/ratio));
 return {x:Math.round(clamp(center.x*width-w/2,0,width-w)),y:Math.round(clamp(center.y*height-h/2,0,height-h)),width:w,height:h};
}
export class F3FramingController{
 fraction=.6;
 resizing=false;
 private baseline:{spread:number;fraction:number}|null=null;
 private lastPinchAt=0;
 private lastFrameId=-1;
 step(frame:F3MotionFrame,now:number){
  if(!frame.fresh||frame.hands.length<2){this.resizing=false;this.baseline=null;return this.fraction;}
  if(frame.frameId<=this.lastFrameId)return this.fraction;
  this.lastFrameId=frame.frameId;
  const left=frame.hands[0],right=frame.hands[1];
  const leftPoint=left[0],rightPoint=right[0];
  if(!leftPoint||!rightPoint)return this.fraction;
  const shoulderA=frame.pose[11],shoulderB=frame.pose[12];
  const shoulderWidth=shoulderA&&shoulderB?Math.max(.1,distance(shoulderA,shoulderB)):.32;
  const spread=distance(leftPoint,rightPoint)/shoulderWidth;
  const pinched=f3Pinched(left)||f3Pinched(right);
  if(pinched){
   this.lastPinchAt=now;
   if(!this.resizing||!this.baseline){this.resizing=true;this.baseline={spread,fraction:this.fraction};}
   const target=clamp(this.baseline.fraction*(this.baseline.spread/Math.max(.1,spread)),.2,1);
   if(Math.abs(target-this.fraction)>.008)this.fraction=clamp(this.fraction+(target-this.fraction)*.28,.2,1);
  }else if(this.resizing&&now-this.lastPinchAt>300){this.resizing=false;this.baseline=null;}
  return this.fraction;
 }
 setFraction(value:number){this.fraction=clamp(value,.2,1);this.resizing=false;this.baseline=null;}
 crop(width:number,height:number,aspect=1.36){return f3Crop(width,height,this.fraction,aspect);}
 reset(){this.fraction=.6;this.resizing=false;this.baseline=null;this.lastFrameId=-1;}
}
