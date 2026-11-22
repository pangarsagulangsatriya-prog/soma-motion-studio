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
/** Eased display crop. Both Stage View and saved photo use this same visible ROI. */
export function f3SmoothCrop(previous:F3Rect|null,target:F3Rect,dtMs:number,
 sourceWidth:number,sourceHeight:number):F3Rect{
 if(!previous||target.width<=0||target.height<=0||sourceWidth<=0||sourceHeight<=0)return target;
 const k=1-Math.exp(-Math.min(120,Math.max(0,dtMs))/125);
 const lerp=(a:number,b:number)=>a+(b-a)*k;
 const width=clamp(Math.round(lerp(previous.width,target.width)),1,sourceWidth);
 const height=clamp(Math.round(lerp(previous.height,target.height)),1,sourceHeight);
 const x=clamp(Math.round(lerp(previous.x,target.x)),0,sourceWidth-width);
 const y=clamp(Math.round(lerp(previous.y,target.y)),0,sourceHeight-height);
 return {x,y,width,height};
}
export class F3FramingController{
 fraction=.6;
 resizing=false;
 private baseline:{spread:number;fraction:number}|null=null;
 private lastPinchAt=0;
 private lastFrameId=-1;
 private bodyBaseline:{left:number;right:number;spread:number;fraction:number}|null=null;
 private bodyPrevious:{left:number;right:number}|null=null;
 private bodyMovedAt=0;
 /** Stable 2-arm relative motion, measured in shoulder widths (distance-invariant). */
 step(frame:F3MotionFrame,now:number){
  if(!frame.fresh||frame.frameId<=this.lastFrameId)return this.fraction;
  this.lastFrameId=frame.frameId;
  const shoulderL=frame.pose[11],shoulderR=frame.pose[12];
  const wristL=frame.pose[15],wristR=frame.pose[16];
  const visible=(p:F3Landmark|undefined)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
   p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??1)>=.55;
  const hasBody=[shoulderL,shoulderR,wristL,wristR].every(visible);
  if(hasBody){
   const shoulderWidth=distance(shoulderL!,shoulderR!);
   const middle=(shoulderL!.x+shoulderR!.x)/2;
   const l=(middle-Math.min(wristL!.x,wristR!.x))/Math.max(.07,shoulderWidth);
   const r=(Math.max(wristL!.x,wristR!.x)-middle)/Math.max(.07,shoulderWidth);
   if(shoulderWidth>=.055&&l>.05&&r>.05&&l<5&&r<5){
    const spread=l+r;
    if(!this.bodyBaseline){
     this.bodyBaseline={left:l,right:r,spread,fraction:this.fraction};
     this.bodyPrevious={left:l,right:r};
    }else{
     const base=this.bodyBaseline;
     const dL=l-base.left,dR=r-base.right;
     const balanced=dL*dR>0&&Math.min(Math.abs(dL),Math.abs(dR))>.13&&
      Math.max(Math.abs(dL),Math.abs(dR))/Math.min(Math.abs(dL),Math.abs(dR))<2.7;
     const previous=this.bodyPrevious;
     const moved=previous?Math.abs(l-previous.left)+Math.abs(r-previous.right)>.026:false;
     if(balanced){
      this.resizing=true;this.lastPinchAt=now;
      if(moved||!this.bodyMovedAt)this.bodyMovedAt=now;
      const target=clamp(base.fraction*(base.spread/Math.max(.18,spread)),.2,1);
      if(Math.abs(target-this.fraction)>.007)
       this.fraction=clamp(this.fraction+(target-this.fraction)*.25,.2,1);
     }
     this.bodyPrevious={left:l,right:r};
     if(this.resizing&&!balanced&&now-this.lastPinchAt>380){
      this.resizing=false;this.bodyBaseline={left:l,right:r,spread,fraction:this.fraction};
     }
     if(this.resizing&&now-this.bodyMovedAt>650){
      this.resizing=false;this.bodyBaseline={left:l,right:r,spread,fraction:this.fraction};
     }
    }
    if(this.resizing)return this.fraction;
   }
  }else{
   this.bodyBaseline=null;this.bodyPrevious=null;this.resizing=false;
  }
  // Optional close-range pinch fallback. Stage use never requires fingers for zoom.
  if(frame.hands.length>=2&&frame.hands.some(f3Pinched)){
   const left=frame.hands[0][0],right=frame.hands[1][0];
   if(left&&right){
    const shoulderWidth=shoulderL&&shoulderR?Math.max(.1,distance(shoulderL,shoulderR)):.32;
    const spread=distance(left,right)/shoulderWidth;
    this.lastPinchAt=now;
    if(!this.baseline){this.resizing=true;this.baseline={spread,fraction:this.fraction};}
    const target=clamp(this.baseline.fraction*(this.baseline.spread/Math.max(.1,spread)),.2,1);
    if(Math.abs(target-this.fraction)>.008)
     this.fraction=clamp(this.fraction+(target-this.fraction)*.28,.2,1);
    return this.fraction;
   }
  }
  if(this.baseline&&now-this.lastPinchAt>320)this.baseline=null;
  if(this.resizing&&now-this.lastPinchAt>380)this.resizing=false;
  return this.fraction;
 }
 setFraction(value:number){this.fraction=clamp(value,.2,1);this.resizing=false;this.baseline=null;this.bodyBaseline=null;this.bodyPrevious=null;}
 crop(width:number,height:number,aspect=1.36){return f3Crop(width,height,this.fraction,aspect);}
 reset(){this.fraction=.6;this.resizing=false;this.baseline=null;this.bodyBaseline=null;this.bodyPrevious=null;this.lastFrameId=-1;this.bodyMovedAt=0;}
}
