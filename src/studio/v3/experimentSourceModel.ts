import type {ReplayAnalysisSnapshot} from '../../stage/VideoPoseGaitEngine.ts';
import type {FloorSession} from '../../footprints/spatial/events.ts';
import type {PuppetPerformer,OrbitCamera} from '../../footprints/simulator/scene3d.ts';

export type ExperimentInputKind='video'|'simulator';
export type ExperimentalFrame=
 |{kind:'video';snapshot:ReplayAnalysisSnapshot|null;
   video:HTMLVideoElement|null;timeMs:number;ready:boolean;name:string}
 |{kind:'simulator';session:FloorSession;performers:PuppetPerformer[];
   orbit:OrbitCamera;timeMs:number;name:string};
export function activeExperimentKind(choice:string|null):ExperimentInputKind|null{
 return choice==='video'||choice==='simulator'?choice:null;
}
export function experimentFrameLabel(kind:ExperimentInputKind){
 return kind==='video'?'VIDEO 2D · LANTAI ILUSTRATIF':'SIMULASI 3D · LANTAI METRIK VIRTUAL';
}
export function allowPhysicalOutputFromExperiment(){return false;}
