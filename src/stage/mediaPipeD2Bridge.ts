/**
 * Footprints unified MP4 duet bridge: observed MediaPipe 33 → COCO 17 geometry
 * → D2 color/motion A/B gate → SAME observed 33 landmarks → gait & BODY/FLOOR.
 * No second decoder and no fabricated skeleton joints.
 */
import type {Landmark} from '../engine/types.ts';
import {moveNetTorsoAppearance,type D2Pose,type D2Frame} from './moveNetIdentityTracker.ts';
import type {VideoActorFrame,VideoActorState,VideoActorAssignment} from './videoAutoActorTracker.ts';
const COCO_FROM_33=[0,2,5,7,8,11,12,13,14,15,16,23,24,25,26,27,28] as const;
export function pose33AsD2(pose:readonly Landmark[],width:number,height:number):D2Pose{
 if(pose.length!==33||width<=0||height<=0)return {score:0,keypoints:[]};
 const keypoints=COCO_FROM_33.map(index=>{
  const p=pose[index],score=Number.isFinite(p?.visibility)?
   Math.max(0,Math.min(1,p.visibility!)):0;
  return {x:(p?.x??-1)*width,y:(p?.y??-1)*height,score};
 });
 const torso=[5,6,11,12].map(i=>keypoints[i].score);
 const confidence=torso.reduce((s,v)=>s+v,0)/torso.length;
 const visible=keypoints.filter(k=>k.score>=.25&&Number.isFinite(k.x)&&Number.isFinite(k.y));
 const xs=visible.map(k=>k.x),ys=visible.map(k=>k.y);
 const box=visible.length>=6?{
  xMin:Math.min(...xs),yMin:Math.min(...ys),
  width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)
 }:undefined;
 return {score:confidence,box,keypoints};
}
export function descriptorsFor33(poses:readonly (readonly Landmark[])[],pixels:ImageData):(number[]|null)[]{
 return poses.map(pose=>moveNetTorsoAppearance(pose33AsD2(pose,pixels.width,pixels.height),pixels));
}
/** One actor index maps to the same raw 33-joint pose used by gait. */
export function d2ToVideoActorFrame(frame:D2Frame,raw:Landmark[][]):VideoActorFrame{
 const actors:VideoActorState[]=frame.actors.map(a=>({
  id:a.id,presence:a.presence,rawIndex:a.rawIndex,
  confidence:a.confidence,recoveryFrames:a.recoveryFrames,
  lastSeenAtMs:a.lastSeenAtMs,reason:frame.reason
 }));
 const assignments:VideoActorAssignment[]=frame.assignments.flatMap(a=>{
  const pose=raw[a.rawIndex];
  return pose?.length===33?[{id:a.id,rawIndex:a.rawIndex,pose,confidence:a.confidence}]:[];
 });
 return {detectedCount:frame.detectedCount,
  knownCount:actors.some(a=>a.id==='B'&&a.lastSeenAtMs!==null)?2:1,
  visibleCount:assignments.length,actors,assignments,
  ambiguous:frame.held||actors.some(a=>a.presence==='uncertain'||a.presence==='reacquiring'),
  reason:frame.reason};
}
