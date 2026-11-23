import {PathObservationRouter,type ActorPathObservation,type PathStanceHint} from './PathObservationRouter.ts';
import {ActorPathTracker,type PathEvent} from './ActorPathTracker.ts';
import type {FootBrushPose} from './FootBrushPoseAdapter.ts';
import type {CameraFloorCalibration} from '../../spatial/coordinates.ts';
import {TrajectoryTelemetry} from './TrajectoryTelemetry.ts';
import {ActorGroundTrajectoryEstimator} from './ActorGroundTrajectoryEstimator.ts';
import type {ActorMotionFrame} from './ActorMotionFrameBuilder.ts';
import {AdaptiveMotionSmootherV24} from './AdaptiveMotionSmootherV24.ts';
import {CoverageTraceRecorderV24} from './CoverageTraceRecorderV24.ts';

type Spatial={calibration:CameraFloorCalibration;videoAspect:number;calibrationId:string};
/** Shared Path Sumi and Dual Trace motion contract.
 * Keeps camera-to-floor in the router, threshold/hysteresis in the tracker,
 * and observability here. No second pose detector or output warp.
 */
export class GroundTrajectoryEngineV2{
 readonly router=new PathObservationRouter();
 readonly tracker=new ActorPathTracker();
 readonly telemetry=new TrajectoryTelemetry();
 readonly hipFusion=new ActorGroundTrajectoryEstimator();
 readonly smoothing=new AdaptiveMotionSmootherV24();
 readonly coverage=new CoverageTraceRecorderV24();
 get hipSummary(){return this.hipFusion.summary();}
 get continuityDiagnostics(){return this.hipFusion.continuity.diagnostics;}
 cutAll(reason:string):PathEvent[]{
  const events=this.tracker.cutAll(reason);
  this.router.reset();this.hipFusion.reset();this.smoothing.reset();
  this.coverage.reset();this.telemetry.events(events);
  return events;
 }
 ingest(sourceKey:string,frameMs:number,poses:readonly FootBrushPose[],
  hints:readonly PathStanceHint[]=[],spatial?:Spatial,
  isCovered?:(o:ActorPathObservation)=>boolean,
  actorFrames:readonly ActorMotionFrame[]=[],enableHipFusion=false,
  enableContinuityV23=false,enableV24=false,
  motionPreset:'responsive'|'balanced'|'stable'='balanced'){
  this.telemetry.frame(sourceKey,frameMs,poses.length>0||actorFrames.length>0);
  const footObservations=this.router.ingest(poses,hints,spatial);
  const fused=enableHipFusion&&actorFrames.length?
   this.hipFusion.ingest(footObservations,actorFrames,spatial,enableContinuityV23,
    enableV24):null;
  if(!enableHipFusion)this.hipFusion.reset();
  const all=fused?.observations??footObservations;
  const uncovered=all.filter(o=>!isCovered?.(o));
  this.telemetry.observations(all,uncovered);
  // A new stroke never inherits the previous actor's smoothing coordinates.
  for(const c of fused?.cuts??[])this.smoothing.resetActor(c.actorId);
  if(!enableV24){this.smoothing.reset();this.coverage.reset();}
  const observations=enableV24?uncovered.map(o=>this.smoothing.smooth(
   o,motionPreset,actorFrames.find(f=>f.actorId===o.actorId)?.torsoScalePx??100)):
   uncovered;
  if(enableV24)this.coverage.capture(actorFrames,uncovered,observations,!!spatial);
  // Covered MP4 samples must not generate fresh ink or connect to a newly
  // accessed timeline segment; the source seek gate remains upstream.
  const cuts=(fused?.cuts??[]).flatMap(c=>{
   const event=this.tracker.cutActor(c.actorId,c.reason);
   return event?[event]:[];
  });
  const events=[...cuts,...this.tracker.ingest(observations,frameMs)];
  this.telemetry.events(events);
  return {observations,events};
 }
}
