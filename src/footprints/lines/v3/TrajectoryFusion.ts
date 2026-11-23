import type {PathPoint} from './PathObservationRouter.ts';
export type MovementEvidence='coherent'|'support'|'ambiguous'|'single-foot';
const length=(p:PathPoint)=>Math.hypot(p.x,p.y);
const scale=(p:PathPoint,n:number):PathPoint=>({x:p.x*n,y:p.y*n});
const bound=(p:PathPoint,max:number):PathPoint=>length(p)<=max?p:scale(p,max/length(p));
/** Estimate CENTER movement, not displacement of the swinging sole.
 * An ambiguous dual-foot midpoint can support limited travel; its movement
 * must not be multiplied by 0.08 forever or accumulated travel disappears.
 * Distance and max-step are stage pixels (1600x900); no physical pressure claim.
 */
export function estimateAmbiguousCenterMovement(midpointDelta:PathPoint,
 leftDelta:PathPoint,rightDelta:PathPoint,dtMs:number):PathPoint{
 const center=length(midpointDelta);
 if(center<.9)return {x:0,y:0};
 const l=length(leftDelta),r=length(rightDelta);
 const dot=l>0&&r>0?(leftDelta.x*rightDelta.x+leftDelta.y*rightDelta.y)/(l*r):0;
 // Diverging feet and near-zero center indicate a turn in place, not a walk.
 if(dot<-.45&&center<1.4)return {x:0,y:0};
 const maxStep=Math.min(44,8+Math.max(0,dtMs)*.095);
 // Low-trust center motion is bounded; evidence of consistent translation
 // still contributes at each frame, including slow forward/lateral walks.
 const factor=dot<-.45?.34:.60;
 return bound(scale(midpointDelta,factor),maxStep);
}
export function accumulateSmallMovement(movement:PathPoint,
 residual:PathPoint,deadZone=1.2):{delta:PathPoint;residual:PathPoint}{
 const sum={x:movement.x+residual.x,y:movement.y+residual.y};
 if(length(sum)<deadZone)return {delta:{x:0,y:0},residual:sum};
 return {delta:sum,residual:{x:0,y:0}};
}
