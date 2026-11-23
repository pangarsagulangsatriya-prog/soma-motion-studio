import {PathObservationRouter,type ActorPathObservation,type PathStanceHint} from './PathObservationRouter.ts';
import {ActorPathTracker,type PathEvent} from './ActorPathTracker.ts';
import type {FootBrushPose} from './FootBrushPoseAdapter.ts';
import type {CameraFloorCalibration} from '../../spatial/coordinates.ts';
import {TrajectoryTelemetry} from './TrajectoryTelemetry.ts';

type Spatial={calibration:CameraFloorCalibration;videoAspect:number;calibrationId:string};
/** Shared Path Sumi and Dual Trace motion contract.
 * Keeps camera-to-floor in the router, threshold/hysteresis in the tracker,
 * and observability here. No second pose detector or output warp.
 */
export class GroundTrajectoryEngineV2{
 readonly router=new PathObservationRouter();
 readonly tracker=new ActorPathTracker();
 readonly telemetry=new TrajectoryTelemetry();
 cutAll(reason:string):PathEvent[]{
  const events=this.tracker.cutAll(reason);
  this.router.reset();this.telemetry.events(events);
  return events;
 }
 ingest(sourceKey:string,frameMs:number,poses:readonly FootBrushPose[],
  hints:readonly PathStanceHint[]=[],spatial?:Spatial,
  isCovered?:(o:ActorPathObservation)=>boolean){
  this.telemetry.frame(sourceKey,frameMs,poses.length>0);
  const all=this.router.ingest(poses,hints,spatial);
  const observations=all.filter(o=>!isCovered?.(o));
  this.telemetry.observations(all,observations);
  // Covered MP4 samples must not generate fresh ink or connect to a newly
  // accessed timeline segment; the source seek gate remains upstream.
  const events=this.tracker.ingest(observations,frameMs);
  this.telemetry.events(events);
  return {observations,events};
 }
}
