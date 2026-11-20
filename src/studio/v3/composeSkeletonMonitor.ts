/** Compose SKELETON: measured Track landmarks, never a simulated lower-body rig.
 * Software preview only. Does not change physical routing, floor events or identities. */
import type {MotionFrame,Landmark} from '../../engine/types.ts';
import type {MultiPoseStatus} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import {liveSkeletonPresentation} from './trackFeedbackModel.ts';
import {drawSkeletonBodies,replaySkeletonDiagnosticPreview} from '../../stage/fullBodySkeleton.ts';

export type ComposeSkeletonBackdrop='black'|'input';
export type ComposeSkeletonInput=HTMLVideoElement|HTMLImageElement|HTMLCanvasElement|null;
export type ComposeSkeletonObservation={
 poses:Landmark[][];colors:string[];labels?:string[]|false;opacity:number;
};
const empty=():ComposeSkeletonObservation=>({poses:[],colors:[],labels:false,opacity:0});

/** A camera skeleton must use the currently tracked, recently captured frame. */
export function liveComposeSkeleton(
 frame:MotionFrame|null|undefined,identity:MultiPoseStatus,
 performers:1|2,nowMs:number,sourceActive:boolean
):ComposeSkeletonObservation{
 if(!sourceActive||!frame||frame.source!=='camera'||!frame.tracked||
  !Number.isFinite(frame.time)||!Number.isFinite(nowMs)||
  nowMs<frame.time||nowMs-frame.time>450)return empty();
 const current=liveSkeletonPresentation(frame,identity,performers,true);
 return {poses:current.poses,colors:current.colors,labels:false,opacity:1};
}
/** Match MP4 poses to its actual playhead, clearing them during seeking. */
export function videoComposeSkeleton(frame:ExperimentalFrame|null|undefined):ComposeSkeletonObservation{
 if(frame?.kind!=='video'||!frame.ready||!frame.video||
  frame.video.readyState<2||frame.video.seeking||!frame.snapshot)return empty();
 const currentMs=frame.video.currentTime*1000;
 const diagnostic=replaySkeletonDiagnosticPreview(
  frame.snapshot,currentMs,frame.previousSnapshot,650);
 return {poses:diagnostic.poses,colors:diagnostic.colors,
  labels:diagnostic.labels,opacity:diagnostic.opacity};
}
export function composeSkeletonRect(w:number,h:number,sw:number,sh:number){
 if(![w,h,sw,sh].every(Number.isFinite)||w<=0||h<=0||sw<=0||sh<=0)
  return {x:0,y:0,width:0,height:0};
 const scale=Math.min(w/sw,h/sh);
 return {x:(w-sw*scale)/2,y:(h-sh*scale)/2,width:sw*scale,height:sh*scale};
}
function inputSize(source:ComposeSkeletonInput){
 if(!source)return null;
 const sw='videoWidth' in source?source.videoWidth:
  'naturalWidth' in source?source.naturalWidth:source.width;
 const sh='videoHeight' in source?source.videoHeight:
  'naturalHeight' in source?source.naturalHeight:source.height;
 if(!sw||!sh||!Number.isFinite(sw)||!Number.isFinite(sh))return null;
 if('videoWidth' in source&&source.readyState<2)return null;
 return {width:sw,height:sh};
}
export function paintComposeSkeletonMonitor(
 ctx:CanvasRenderingContext2D,w:number,h:number,config:{
 backdrop:ComposeSkeletonBackdrop;
 input:ComposeSkeletonInput;
 /** Imported images/video have no pose inference; treat as backdrop only. */
 inputFromTrack:boolean;
 liveFrame:MotionFrame|null|undefined;
 identity:MultiPoseStatus;
 performers:1|2;
 nowMs:number;
 cameraActive:boolean;
 experimentFrame:ExperimentalFrame|null|undefined;
 }
):{detected:number;inputReady:boolean}{
 ctx.save();
 try{
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha=1;
  ctx.fillStyle='#000000';
  ctx.fillRect(0,0,w,h);
  const dimensions=inputSize(config.input);
  if(!dimensions||!config.input)return {detected:0,inputReady:false};
  const rect=composeSkeletonRect(w,h,dimensions.width,dimensions.height);
  if(config.backdrop==='input'){
   try{ctx.drawImage(config.input,rect.x,rect.y,rect.width,rect.height);}
   catch{return {detected:0,inputReady:false};}
  }
  // Never draw tracking skeleton over unrelated, unanalysed imported media.
  if(!config.inputFromTrack)return {detected:0,inputReady:true};
  const observation=config.experimentFrame?.kind==='video'
   ?videoComposeSkeleton(config.experimentFrame):
   config.experimentFrame?.kind==='simulator'?empty():
   liveComposeSkeleton(config.liveFrame,config.identity,config.performers,
    config.nowMs,config.cameraActive);
  if(!observation.poses.length||observation.opacity<=0)
   return {detected:0,inputReady:true};
  ctx.globalAlpha=observation.opacity;
  const detected=drawSkeletonBodies(ctx,observation.poses,rect,
   {colors:observation.colors,labels:observation.labels});
  return {detected,inputReady:true};
 }finally{ctx.restore();}
}
