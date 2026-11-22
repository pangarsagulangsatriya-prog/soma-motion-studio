/** Line Trails Beta — observed per-foot locations, never torso presence or force. */
import type {Landmark,MotionFrame} from '../../engine/types.ts';
import type {MultiPoseStatus} from '../live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from '../../studio/v3/experimentSourceModel.ts';
import {floorToUV} from '../spatial/coordinates.ts';

export type FootLineSample={
 sessionId:string;generation:number;source:'camera'|'phone'|'video'|'simulator';
 actorId:string;foot:'left'|'right';x:number;y:number;atMs:number;
 confidence:number;headingRad?:number;coordinateBasis:'image-2d'|'calibrated-estimate'|'simulated';
};
type Metadata=Pick<FootLineSample,'sessionId'|'generation'|'source'|'actorId'|'atMs'|'coordinateBasis'>;
type FootPoint={x:number;y:number;confidence:number;headingRad?:number};
const valid=(p:Landmark|undefined,confidence=.52):p is Landmark=>!!p&&
 Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
 (p.visibility??1)>=confidence;
const makePoint=(pose:readonly Landmark[],side:'left'|'right'):FootPoint|null=>{
 const i=side==='left'?0:1,heel=pose[29+i],toe=pose[31+i],ankle=pose[27+i];
 if(valid(heel)&&valid(toe))return {
  x:(heel.x+toe.x)/2,y:(heel.y+toe.y)/2,
  confidence:Math.min(heel.visibility??1,toe.visibility??1),
  ...(Math.hypot(toe.x-heel.x,toe.y-heel.y)>.005?{
   headingRad:Math.atan2((toe.x-heel.x)*16,(heel.y-toe.y)*9)}:{})
 };
 if(valid(ankle,.64))return {x:ankle.x,y:ankle.y,confidence:(ankle.visibility??1)*.86};
 return null;
};
export function footSamplesFromPose(pose:readonly Landmark[],meta:Metadata):FootLineSample[]{
 if(!Number.isFinite(meta.atMs)||meta.atMs<0)return [];
 return (['left','right'] as const).flatMap(foot=>{
  const p=makePoint(pose,foot);return p?[{...meta,foot,...p}]:[];
 });
}
/** For 2P, only route a pose when identity router has assigned that precise frame. */
export function footSamplesFromLive(frame:MotionFrame,status:MultiPoseStatus,count:1|2,
 source:'camera'|'phone',sessionId:string,generation:number,selected:'A'|'B'='A'):FootLineSample[]{
 if(frame.source!=='camera'||frame.time<=0||(count===1&&!frame.tracked))return [];
 const meta={sessionId,generation,source,atMs:frame.time,coordinateBasis:'image-2d' as const};
 if(count===1)return footSamplesFromPose(frame.pose,{...meta,actorId:'performer-1'});
 if(status.ambiguous||status.observedFrameTime!==frame.time)return [];
 const index=status.poseIndices[selected];
 if(index===null||!frame.poses?.[index])return [];
 return footSamplesFromPose(frame.poses[index],{...meta,actorId:selected});
}
export function footSamplesFromExperiment(frame:ExperimentalFrame|null,
 sessionId:string,generation:number,selected:'A'|'B'='A'):FootLineSample[]{
 if(!frame)return [];
 if(frame.kind==='video'){
  const snapshot=frame.snapshot;
  if(!frame.ready||frame.video?.seeking||!snapshot||Math.abs(frame.timeMs-snapshot.atMs)>450)return [];
  // No silent A→B substitution after occlusion or MP4 identity recovery.
  const person=snapshot.people.find(p=>p.id===selected);
  if(!person)return [];
  return footSamplesFromPose(person.landmarks,{
   sessionId,generation,source:'video',actorId:person.id,
   atMs:snapshot.atMs,coordinateBasis:'image-2d'
  });
 }
 const p=frame.performers.find(item=>item.id===selected);
 if(!p)return [];
 return (['left','right'] as const).map(foot=>{
  const uv=floorToUV(frame.session.floor,p[foot].positionM);
  return {sessionId,generation,source:'simulator' as const,actorId:p.id,foot,
   x:uv.x,y:uv.y,atMs:frame.timeMs,confidence:1,coordinateBasis:'simulated' as const};
 });
}
/** Deterministic demo only, visually explicit in the editor; never a Track frame. */
export function demoFootSamples(nowMs:number,startMs:number):FootLineSample[]{
 const t=Math.max(0,(nowMs-startMs)/1000);
 const point=(foot:'left'|'right',shift:number):FootLineSample=>{
  const a=t*.68+shift;
  return {sessionId:'line-trails-demo',generation:0,source:'simulator',actorId:'DEMO',foot,
   x:.5+(.23+.045*Math.sin(t*.23))*Math.cos(a+.55*Math.sin(t*.37)),
   y:.5+(.30+.018*Math.sin(t*.51))*Math.sin(a*1.55+shift*.7),
   atMs:nowMs,confidence:1,coordinateBasis:'simulated'};
 };
 return [point('left',0),point('right',Math.PI*.93)];
}
