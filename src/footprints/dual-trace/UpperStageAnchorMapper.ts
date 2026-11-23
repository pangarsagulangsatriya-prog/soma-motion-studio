import type {UpperGestureAnchor} from './UpperGestureAnchorAdapter.ts';
import type {DualPoseFrame} from './DualTracePoseFrameBus.ts';
import type {ActorPathObservation} from '../lines/v3/PathObservationRouter.ts';

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const visible=(p:{x:number;y:number;visibility?:number}|undefined):
 p is {x:number;y:number;visibility?:number}=>
 !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=.55;
/** Camera-relative head/shoulder movement is deliberately expressive 2D;
 * monocular head depth and physical foot pressure are not inferred.
 * Missing torso/actor anchor suppresses the upper stroke for that frame. 
 * Calibrated and image-2D sources both use the actor stage path as the origin.
 */
export function mapUpperAnchorsToStage(
 anchors:readonly UpperGestureAnchor[],
 frames:readonly DualPoseFrame[],
 observations:readonly ActorPathObservation[],
 _calibrated:boolean,
 expressiveScale=.38
):UpperGestureAnchor[]{
 // Both image-2D and calibrated-floor compositions use the SAME actor
 // ground anchor. Drawing head/shoulder in raw image Y while painting feet in
 // stage/floor Y made the two paintings look like unrelated sketches.
 const output:UpperGestureAnchor[]=[];
 for(const anchor of anchors){
  const frame=frames.find(f=>f.actorId===anchor.actorId&&f.timeMs===anchor.timeMs&&
   f.sourceKey===anchor.sourceKey&&f.epoch===anchor.epoch);
  // The pose stream epoch (clip segment) and foot adapter epoch (source restarts)
  // are different counters. Match their stable sourceKey and frame timestamp.
  const floor=observations.find(o=>o.actorId===anchor.actorId&&o.timeMs===anchor.timeMs&&
   o.sourceKey.startsWith(anchor.sourceKey));
  if(!frame||!floor||floor.confidence<.55)continue;
  const lh=frame.landmarks[23],rh=frame.landmarks[24];
  if(!visible(lh)||!visible(rh))continue;
  const torso={x:(lh.x+rh.x)*800,y:(lh.y+rh.y)*450};
  // The actual gesture remains observed. Its offset is deliberately compressed
  // around the actor's floor path for a unified expressive 2D composition.
  // This is NOT a measured 3D head location or foot-pressure estimate.
  const ratio=clamp(expressiveScale,.15,.65);
  const gain=anchor.channel==='head'?ratio*.50:ratio*.35;
  const dx=clamp((anchor.pointPx.x-torso.x)*gain,-115,115);
  const dy=clamp((anchor.pointPx.y-torso.y)*gain,-115,115);
  const x=floor.point.x+dx,y=floor.point.y+dy;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1600||y<0||y>900)continue;
  output.push({...anchor,pointPx:{x,y},
   basis:anchor.basis==='estimated-head'?'estimated-head':'observed-2d'});
 }
 return output;
}
