import type {UpperGestureAnchor} from './UpperGestureAnchorAdapter.ts';
import type {DualPoseFrame} from './DualTracePoseFrameBus.ts';
import type {ActorPathObservation} from '../lines/v3/PathObservationRouter.ts';

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const visible=(p:{x:number;y:number;visibility?:number}|undefined)=>
 !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=.55;
/** Camera-relative head/shoulder movement is deliberately expressive 2D;
 * monocular head depth and physical foot pressure are not inferred.
 * Missing torso/actor anchor suppresses the upper stroke for that frame.
 */
export function mapUpperAnchorsToStage(
 anchors:readonly UpperGestureAnchor[],
 frames:readonly DualPoseFrame[],
 observations:readonly ActorPathObservation[],
 calibrated:boolean,
 expressiveScale=.38
):UpperGestureAnchor[]{
 if(!calibrated)return [...anchors];
 const output:UpperGestureAnchor[]=[];
 for(const anchor of anchors){
  const frame=frames.find(f=>f.actorId===anchor.actorId&&f.timeMs===anchor.timeMs);
  const floor=observations.find(o=>o.actorId===anchor.actorId&&o.timeMs===anchor.timeMs);
  if(!frame||!floor||floor.confidence<.55)continue;
  const lh=frame.landmarks[23],rh=frame.landmarks[24];
  if(!visible(lh)||!visible(rh))continue;
  const torso={x:(lh.x+rh.x)*800,y:(lh.y+rh.y)*450};
  const dx=clamp((anchor.pointPx.x-torso.x)*expressiveScale,-170,170);
  const dy=clamp((anchor.pointPx.y-torso.y)*expressiveScale,-170,170);
  const x=floor.point.x+dx,y=floor.point.y+dy;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1600||y<0||y>900)continue;
  output.push({...anchor,pointPx:{x,y},
   basis:anchor.basis==='estimated-head'?'estimated-head':'observed-2d'});
 }
 return output;
}
