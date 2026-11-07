import type {BodyMask} from '../studio/bodyField.ts';
export type Bounds={cx:number;cy:number;width:number;height:number};
export type Smoothing={strength:number;responsiveness:number;confidence:number;fadeMs:number};
export function maskBounds(mask:BodyMask,threshold:number):Bounds|null{
 let left=mask.width,top=mask.height,right=-1,bottom=-1,count=0;
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(mask.data[y*mask.width+x]>=threshold*255){count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(count<Math.max(2,mask.width*mask.height*.0005))return null;
 return {cx:(left+right+1)/(2*mask.width),cy:(top+bottom+1)/(2*mask.height),width:(right-left+1)/mask.width,height:(bottom-top+1)/mask.height};
}
/** Adaptive exponential filter of placement only. Every mask keeps its current pose. */
export class BodySmoother{
 private value:Bounds|null=null;private time=0;
 reset(){this.value=null;this.time=0;}
 step(next:Bounds,time:number,s:Smoothing):Bounds{
  if(!this.value||time<=this.time||time-this.time>450||s.strength===0){this.value={...next};this.time=time;return {...next};}
  const dt=(time-this.time)/1000,speed=Math.hypot(next.cx-this.value.cx,next.cy-this.value.cy)/dt;
  const tau=(.008+.112*s.strength)/(1+speed*s.responsiveness*12),alpha=1-Math.exp(-dt/tau);
  for(const k of ['cx','cy','width','height'] as const)this.value[k]+=(next[k]-this.value[k])*alpha;
  this.time=time;return {...this.value};
 }
}
