import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {ActorPathObservation,PathPoint} from './PathObservationRouter.ts';

export type BridgeContext={
 actorId:ActorChannel;sourceKey:string;clipStableId:string;epoch:number;
 transformKey:string;identityConfidence:number;torsoScalePx:number;
 crossingAmbiguous?:boolean;
};
export type BridgeCandidate={
 id:string;context:BridgeContext;start:ActorPathObservation;
 predicted:ActorPathObservation[];tangent?:PathPoint;
};
export type BridgeVerdict={accepted:true;observations:ActorPathObservation[]}|
 {accepted:false;reason:string};
const distance=(a:PathPoint,b:PathPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const direction=(a:PathPoint,b:PathPoint):PathPoint|null=>{
 const d=distance(a,b);return d>=2?{x:(b.x-a.x)/d,y:(b.y-a.y)/d}:null;
};
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
/** Only approves short, same-actor, monotone provisional tracks.
 * A curve may be interpolated only between already bounded hip observations,
 * never from one performer to another. No painting occurs in this module.
 */
export function validateContinuityBridge(
 candidate:BridgeCandidate,recovered:ActorPathObservation,
 context:BridgeContext):BridgeVerdict{
 const c=candidate.context,points=candidate.predicted;
 if(crossing(c,context))return {accepted:false,reason:'identity-ambiguous'};
 if(c.actorId!==context.actorId||c.sourceKey!==context.sourceKey||
    c.clipStableId!==context.clipStableId||c.epoch!==context.epoch||
    c.transformKey!==context.transformKey||
    recovered.actorId!==c.actorId||recovered.sourceKey!==c.sourceKey||
    recovered.clipStableId!==c.clipStableId||recovered.epoch!==c.epoch)
  return {accepted:false,reason:'bridge-source-change'};
 if(points.length===0||points.length>6)return {accepted:false,reason:'bridge-budget'};
 const elapsed=recovered.timeMs-candidate.start.timeMs;
 if(elapsed<=0||elapsed>250)return {accepted:false,reason:'bridge-gap-expired'};
 if(context.identityConfidence<.65||recovered.confidence<.55)
  return {accepted:false,reason:'bridge-low-confidence'};
 let prior=candidate.start.timeMs,travel=0,last=candidate.start.point;
 for(const point of points){
  if(point.timeMs<=prior||point.timeMs>=recovered.timeMs||
     point.actorId!==c.actorId||
     !Number.isFinite(point.point.x)||!Number.isFinite(point.point.y))
   return {accepted:false,reason:'bridge-order'};
  const step=distance(last,point.point);
  const frameMs=point.timeMs-prior;
  const limit=clamp(16+frameMs*.34+c.torsoScalePx*.35,28,130);
  if(step>limit)return {accepted:false,reason:'bridge-speed'};
  travel+=step;last=point.point;prior=point.timeMs;
 }
 const residual=distance(last,recovered.point);
 const maxResidual=clamp(context.torsoScalePx*.6,18,70);
 if(residual>maxResidual)return {accepted:false,reason:'bridge-recovery-too-far'};
 travel+=residual;
 const reachable=clamp(context.torsoScalePx*1.5+elapsed*.55,65,240);
 if(travel>reachable)return {accepted:false,reason:'bridge-excess-distance'};
 const from=candidate.tangent,now=direction(candidate.start.point,recovered.point);
 if(from&&now){
  const dot=Math.max(-1,Math.min(1,from.x*now.x+from.y*now.y));
  // A large reversal needs observed pivot evidence. Unverified rotation is CUT.
  if(dot<-.35 && recovered.footEvent!=='pivot')
   return {accepted:false,reason:'bridge-direction-mismatch'};
 }
 return {accepted:true,observations:[...points,recovered]};
}
function crossing(a:BridgeContext,b:BridgeContext){
 return !!a.crossingAmbiguous||!!b.crossingAmbiguous;
}
