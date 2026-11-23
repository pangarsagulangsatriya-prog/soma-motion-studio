import type {ActorMotionFrame} from '../lines/v3/ActorMotionFrameBuilder.ts';
import type {ActorChannel} from '../lines/v3/ActorPaletteResolver.ts';

type Previous={sourceKey:string;timeMs:number;shoulderAngle?:number;
 headRelativeX?:number;factor:number};
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const angular=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
/** Expressive brush response to real upper-body motion.
 * Calculates only a BOUNDED factor on accepted stage-space path knots;
 * never paints upper gestures by themselves or infers physical pressure.
 */
export class UpperBodyInkModulator{
 private last=new Map<ActorChannel,Previous>();
 reset(){this.last.clear();}
 update(frames:readonly ActorMotionFrame[]):Record<ActorChannel,number>{
  const factors:Record<ActorChannel,number>={A:1,B:1};
  for(const f of frames){
   const shoulderAngle=f.shoulderVector&&Math.hypot(f.shoulderVector.x,f.shoulderVector.y)>10?
    Math.atan2(f.shoulderVector.y,f.shoulderVector.x):undefined;
   const headRelativeX=f.headImagePx?
    (f.headImagePx.x-f.hipPx.x)/Math.max(30,f.torsoScalePx):undefined;
   const prev=this.last.get(f.actorId);
   const continuous=!!prev&&prev.sourceKey===f.sourceKey&&
    f.timeMs>prev.timeMs&&f.timeMs-prev.timeMs<=250;
   let factor=1;
   if(continuous&&prev){
    const shoulderMotion=shoulderAngle!==undefined&&prev.shoulderAngle!==undefined?
     clamp(angular(shoulderAngle,prev.shoulderAngle)/.40,0,1):0;
    const headMotion=headRelativeX!==undefined&&prev.headRelativeX!==undefined?
     clamp(Math.abs(headRelativeX-prev.headRelativeX)/.25,0,1):0;
    const target=clamp(1+.13*shoulderMotion+.09*headMotion,1,1.22);
    factor=clamp(prev.factor*.48+target*.52,1,1.22);
   }
   this.last.set(f.actorId,{sourceKey:f.sourceKey,timeMs:f.timeMs,
    shoulderAngle,headRelativeX,factor});
   factors[f.actorId]=factor;
  }
  return factors;
 }
}
