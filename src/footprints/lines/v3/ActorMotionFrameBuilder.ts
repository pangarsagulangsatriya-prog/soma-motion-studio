import type {DualPoseFrame} from '../../dual-trace/DualTracePoseFrameBus.ts';
import type {FootBrushPose} from './FootBrushPoseAdapter.ts';
import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {PathPoint} from './PathObservationRouter.ts';

export type ActorMotionFrame={
 actorId:ActorChannel;sourceKey:string;timeMs:number;sourceEpoch:number;
 geometryVersion?:string;
 identityConfidence:number;hipPx:PathPoint;hipConfidence:number;
 torsoScalePx:number;feetCount:0|1|2;footImageAnchorPx?:PathPoint;
 /** Raw stage-image side points for V2.4. These are foot estimates, NOT confirmed contacts. */
 feetStagePx?:Partial<Record<'left'|'right',{point:PathPoint;confidence:number}>>;
 shoulderVector?:PathPoint;headImagePx?:PathPoint;
};
const finite=(x:number)=>Number.isFinite(x);
const valid=(p:{x:number;y:number;visibility?:number}|undefined,threshold=.55)=>
 !!p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
 (p.visibility??1)>=threshold;
const stage=(p:{x:number;y:number}):PathPoint=>({x:p.x*1600,y:p.y*900});
/** Reuse one already-approved 33-landmark snapshot. No second detector.
 * Feet are counted from the same adapter used for footprints, never from hip
 * extrapolation. The stage-image reference is identical to FootPositionResolver.
 */
export function buildActorMotionFrames(
 frames:readonly DualPoseFrame[],poses:readonly FootBrushPose[]
):ActorMotionFrame[]{
 const result:ActorMotionFrame[]=[];
 for(const frame of frames){
  const [lh,rh,ls,rs]=[23,24,11,12].map(i=>frame.landmarks[i]);
  if(!valid(lh)||!valid(rh)||frame.identityConfidence<.65)continue;
  const hipConfidence=Math.min(lh.visibility??1,rh.visibility??1,frame.identityConfidence);
  if(hipConfidence<.55)continue;
  const hipPx=stage({x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2});
  const torso=valid(ls)&&valid(rs)?
   Math.hypot(((lh.x+rh.x-ls.x-rs.x)/2)*1600,
    ((lh.y+rh.y-ls.y-rs.y)/2)*900):80;
  const headA=frame.landmarks[7],headB=frame.landmarks[8],nose=frame.landmarks[0];
  const headImagePx=valid(headA)&&valid(headB)?
   stage({x:(headA.x+headB.x)/2,y:(headA.y+headB.y)/2}):
   valid(nose)?stage(nose):undefined;
  const shoulderVector=valid(ls)&&valid(rs)?
   {x:(rs.x-ls.x)*1600,y:(rs.y-ls.y)*900}:undefined;
  const same=poses.filter(p=>
   (p.actorId===frame.actorId||
    frame.actorId==='A'&&p.actorId==='performer-1'||
    frame.actorId==='B'&&p.actorId==='performer-2')&&
   p.sourceKey===frame.sourceKey&&p.atMs===frame.timeMs&&p.confidence>=.55);
  const sides=new Set(same.map(p=>p.foot));
  const count=Math.min(2,sides.size) as 0|1|2;
  const feetStagePx:NonNullable<ActorMotionFrame['feetStagePx']>={};
  for(const p of same)feetStagePx[p.foot]={point:stage(p.center),confidence:p.confidence};
  const anchor=same.length?{
   x:same.reduce((n,p)=>n+p.center.x*1600,0)/same.length,
   y:same.reduce((n,p)=>n+p.center.y*900,0)/same.length
  }:undefined;
  result.push({actorId:frame.actorId,sourceKey:frame.sourceKey,
   timeMs:frame.timeMs,sourceEpoch:frame.epoch,
   identityConfidence:frame.identityConfidence,hipPx,hipConfidence,
   torsoScalePx:Math.max(30,Math.min(300,torso)),
   feetCount:count,...(anchor?{footImageAnchorPx:anchor}:{}),
   ...(same.length?{feetStagePx}:{}),
   ...(shoulderVector?{shoulderVector}:{}),
   ...(headImagePx?{headImagePx}:{})});
 }
 return result;
}
