import type {Landmark} from '../../engine/types.ts';
import type {V3Input,V3InputOptions} from '../lines/v3/SourceFrameNormalizer.ts';

export type DualActor='A'|'B';
export type UpperSource='video'|'camera'|'phone'|'simulator';
export type DualPoseFrame={
 actorId:DualActor;source:UpperSource;sourceKey:string;epoch:number;
 timeMs:number;identityConfidence:number;landmarks:readonly Landmark[];
 coordinateBasis:'image-2d'|'simulated';
};
const valid=(points:readonly Landmark[]|undefined):points is readonly Landmark[]=>
 !!points&&points.length>=33;
 // Individual critical landmarks are validated by UpperGestureAnchorAdapter,
 // so an offscreen wrist or ankle cannot suppress a valid head/shoulder.
const count=(poses:readonly DualPoseFrame[],actor:DualActor)=>
 poses.some(p=>p.actorId===actor);
/** Fan out existing *approved* pose landmarks, never run a detector.
 * Both sinks consume exactly the video/track frame accepted by the foot engine.
 * A demo or foot-only 3D simulation does not invent upper-body landmarks.
 */
export function dualTracePoseFrames(input:V3Input,o:Pick<V3InputOptions,
 'experiment'|'live'|'performers'|'status'>):DualPoseFrame[]{
 if(!input.ready||input.seeking||input.paused||input.frameMs<0||
  input.source==='demo'||input.source==='simulator')return [];
 if(input.source==='video'){
  const snapshot=o.experiment?.kind==='video'?o.experiment.snapshot:null;
  if(!snapshot||snapshot.ambiguous||snapshot.atMs!==input.frameMs)return [];
  const frames:DualPoseFrame[]=[];
  for(const person of snapshot.people){
   if((person.id!=='A'&&person.id!=='B')||
      (o.performers===1&&person.id!=='A')||
      !valid(person.landmarks)||person.confidence<.55||
      count(frames,person.id))continue;
   frames.push({actorId:person.id,source:'video',sourceKey:input.sourceKey,
    epoch:snapshot.segment,timeMs:snapshot.atMs,
    landmarks:person.landmarks,identityConfidence:person.confidence,
    coordinateBasis:'image-2d'});
  }
  return frames;
 }
 const f=o.live;if(!f||!f.tracked||f.source!=='camera'||f.time!==input.frameMs)
  return [];
 const pick=(actor:DualActor,index:number,confidence:number)=>{
  const points=o.performers===1?f.pose:f.poses?.[index];
  if(!valid(points)||confidence<.55)return null;
  return {actorId:actor,source:input.source,sourceKey:input.sourceKey,
   epoch:0,timeMs:input.frameMs,landmarks:points,
   identityConfidence:confidence,coordinateBasis:'image-2d'} as DualPoseFrame;
 };
 if(o.performers===1){
  const a=pick('A',0,Math.max(0,Math.min(1,f.quality)));
  return a?[a]:[];
 }
 if(o.status.ambiguous||o.status.observedFrameTime!==input.frameMs)return [];
 const result:DualPoseFrame[]=[];
 for(const actor of ['A','B'] as const){
  const index=o.status.poseIndices[actor];
  if(index===null)continue;
  const p=pick(actor,index,Math.max(0,Math.min(1,f.quality)));
  if(p)result.push(p);
 }
 return result;
}
