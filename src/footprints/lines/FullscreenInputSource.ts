import type {RefObject} from 'react';
import type {Landmark,MotionFrame} from '../../engine/types.ts';
import type {MultiPoseGaitRouter} from '../live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from '../../studio/v3/experimentSourceModel.ts';
import type {FullscreenInputSource} from './FullscreenInputDiagnostics.ts';

export type InputDiagnosticRefs={
 videoRef:RefObject<HTMLVideoElement|null>;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 frameRef:RefObject<MotionFrame>;
 router:MultiPoseGaitRouter;
 cameraOn:boolean;
 experimentSource:'video'|'simulator'|null;
 performerCount:1|2;selectedActor:'A'|'B';demo:boolean;
};
const unavailable=(label:string):FullscreenInputSource=>({
 image:null,width:0,height:0,label,pose:null
});
/** Reuses Track/MP4 media; no extra getUserMedia call or pose inference. */
export function resolveFullscreenInput(p:InputDiagnosticRefs,now:number):FullscreenInputSource{
 if(p.demo)return unavailable('DEMO');
 if(p.experimentSource==='simulator')return unavailable('SIMULASI');
 if(p.experimentSource==='video'){
  const current=p.experimentFrameRef?.current;
  if(current?.kind!=='video'||!current.ready)return unavailable('MP4');
  const video=current.video;
  const available=!!video&&video.readyState>=2&&!video.seeking&&video.videoWidth>0&&video.videoHeight>0;
  const fallback=p.experimentInputCanvas?.current;
  const image=available?video:fallback&&fallback.width>0&&fallback.height>0?fallback:null;
  const snapshot=current.snapshot;
  const fresh=!!snapshot&&Math.abs(current.timeMs-snapshot.atMs)<450;
  const pose=fresh?(snapshot!.people.find(person=>person.id===p.selectedActor)
   ??(p.selectedActor==='A'?snapshot!.people[0]:undefined))?.landmarks??null:null;
  return {image,width:available?video!.videoWidth:fallback?.width??0,
   height:available?video!.videoHeight:fallback?.height??0,label:'MP4',pose};
 }
 const video=p.videoRef.current,frame=p.frameRef.current;
 const available=!!p.cameraOn&&!!video&&video.readyState>=2&&
  video.videoWidth>0&&video.videoHeight>0;
 const recent=!!p.cameraOn&&frame.tracked&&frame.source==='camera'&&
  frame.time>0&&now>=frame.time&&now-frame.time<450;
 let pose:readonly Landmark[]|null=null;
 if(recent){
  if(p.performerCount===1)pose=frame.pose.length?frame.pose:null;
  else{
   const status=p.router.status,index=status.poseIndices[p.selectedActor];
   if(!status.ambiguous&&status.observedFrameTime===frame.time&&index!==null)
    pose=frame.poses?.[index]??null;
  }
 }
 return {image:available?video:null,width:available?video!.videoWidth:0,
  height:available?video!.videoHeight:0,label:'KAMERA',pose};
}
