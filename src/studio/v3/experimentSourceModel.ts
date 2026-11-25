import type {ReplayAnalysisSnapshot} from '../../stage/VideoPoseGaitEngine.ts';
import type {FloorSession} from '../../footprints/spatial/events.ts';
import type {PuppetPerformer,OrbitCamera} from '../../footprints/simulator/scene3d.ts';

export type ExperimentInputKind='video'|'simulator';
export type ExperimentalFrame=
 |{kind:'video';generation?:number;snapshot:ReplayAnalysisSnapshot|null;previousSnapshot?:ReplayAnalysisSnapshot|null;
   decoded?:{atMs:number;mediaTime:number};video:HTMLVideoElement|null;timeMs:number;ready:boolean;name:string;clip?:File|null}
 |{kind:'simulator';generation?:number;session:FloorSession;performers:PuppetPerformer[];
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
/** Only the Direct playback permit needs a recent advancing decoder clock.
 * A paused, decoded frame is valid still artwork until the next seek or clip. */
export function canOutputVideoFrame(frame:ExperimentalFrame|null,now:number):boolean{
 if(frame?.kind!=='video'||!canPaintVideoFrame(frame)||frame.video?.error)return false;
 if(frame.video?.paused)return true;
 const stamp=frame.decoded?.atMs;
 return stamp!==undefined&&Number.isFinite(stamp)&&now>=stamp&&now-stamp<1200;
}
/** Metadata alone is insufficient: a decoded image must be available before painting. */
export function canPaintVideoFrame(frame:ExperimentalFrame|null):boolean{
 return frame?.kind==='video'&&frame.ready&&!!frame.video&&
  frame.video.readyState>=2&&!frame.video.seeking&&frame.video.videoWidth>0;
}
