import type {ReplayAnalysisSnapshot} from '../../stage/VideoPoseGaitEngine.ts';
import type {FloorSession} from '../../footprints/spatial/events.ts';
import type {PuppetPerformer,OrbitCamera} from '../../footprints/simulator/scene3d.ts';

export type ExperimentInputKind='video'|'simulator';
export type ExperimentalFrame=
 |{kind:'video';snapshot:ReplayAnalysisSnapshot|null;previousSnapshot?:ReplayAnalysisSnapshot|null;
   video:HTMLVideoElement|null;timeMs:number;ready:boolean;name:string;clip?:File|null}
 |{kind:'simulator';session:FloorSession;performers:PuppetPerformer[];
   orbit:OrbitCamera;timeMs:number;name:string};
export function activeExperimentKind(choice:string|null):ExperimentInputKind|null{
 return choice==='video'||choice==='simulator'?choice:null;
}
export function experimentFrameLabel(kind:ExperimentInputKind){
 return kind==='video'?'VIDEO 2D · LANTAI ILUSTRATIF':'SIMULASI 3D · LANTAI METRIK VIRTUAL';
}
/** Prevent stale MP4 snapshots or puppet sessions from being shown after switching. */
export function currentExperimentFrame(
 kind:ExperimentInputKind|null,frame:ExperimentalFrame|null
):ExperimentalFrame|null{
 return kind&&frame?.kind===kind?frame:null;
}
export function allowPhysicalOutputFromExperiment(){return false;}

/** File identity prevents late MP4 callbacks from reusing the previous clip's frame. */
export function currentExperimentFrameForClip(
 kind:ExperimentInputKind|null,frame:ExperimentalFrame|null,clip:File|null
):ExperimentalFrame|null{
 const selected=currentExperimentFrame(kind,frame);
 if(selected?.kind==='video'&&(!clip||selected.clip!==clip))return null;
 return selected;
}
/** Metadata alone is insufficient: a decoded image must be available before painting. */
export function canPaintVideoFrame(frame:ExperimentalFrame|null):boolean{
 return frame?.kind==='video'&&frame.ready&&!!frame.video&&
  frame.video.readyState>=2&&!frame.video.seeking&&frame.video.videoWidth>0;
}
