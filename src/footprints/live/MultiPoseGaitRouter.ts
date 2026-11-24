import type {MotionFrame} from '../../engine/types.ts';
import {GaitAnalyzer,type GaitSample} from '../gait-analysis/index.ts';
import {LiveFloorTrackingEngine,type CameraBinding} from './LiveFloorTrackingEngine.ts';
import {TwoPersonIdentityTracker,type IdentityFrame,type LivePerformerId,type ActorIdentityState} from './TwoPersonIdentityTracker.ts';
import {GhostFootstepPredictor} from './GhostFootstepPredictor.ts';
import {createFloorSession,type FloorSession,type FootstepEvent} from '../spatial/events.ts';

export type MultiPoseStatus={
 mode:1|2;visible:LivePerformerId[];ambiguous:boolean;reason:string;
 ghostCount:number;
 /** Stable identity router IDs → pose index in precisely the latest observed MotionFrame. */
 poseIndices:{A:number|null;B:number|null};
 observedFrameTime:number|null;
 /** Software identity generation; changes only on explicit source/identity reset. */
 identityEpoch?:number;
 actorStates?:Record<LivePerformerId,ActorIdentityState>;
};
/**
 * In two-person mode, reuses the 2 poses ALREADY in MotionFrame.poses.
 * Per-identity gait analyzers have independent smoothing and phase history.
 * Unknown or overlapping people produce NO contact or ghost.
 */
export class MultiPoseGaitRouter{
 private identity=new TwoPersonIdentityTracker();
 private previewFrame:MotionFrame|null=null;
 private previewResult:IdentityFrame|null=null;
 private previewIndices:{A:number|null;B:number|null}={A:null,B:null};
 private previewEpoch=0;
 private analyzers=new Map<LivePerformerId,GaitAnalyzer>();
 private predictor:GhostFootstepPredictor|null=null;
 private mode:1|2=1;
 private visible:LivePerformerId[]=[];
 private ambiguous=false;
 private reason='Menunggu dua performer.';
 private poseIndices:{A:number|null;B:number|null}={A:null,B:null};
 private observedFrameTime:number|null=null;
 private lastTimestamp=0;
 private lastWallMs=0;
 private listeners=new Set<()=>void>();
 subscribe(listener:()=>void):()=>void{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
 private invalidate(){for(const listener of this.listeners)listener();}
 get displayClockMs(){return this.lastTimestamp+(this.lastWallMs?Math.max(0,performance.now()-this.lastWallMs):0);}
 readonly floor:LiveFloorTrackingEngine;
 constructor(floor:LiveFloorTrackingEngine){this.floor=floor;}
 setMode(mode:1|2){
  if(this.mode===mode)return;
  this.mode=mode;this.reset();
 }
 get activeMode(){return this.mode;}
 reset(){
  this.identity.reset();this.previewFrame=null;this.previewResult=null;this.previewIndices={A:null,B:null};this.previewEpoch++;this.resetCalibrated();
 }
 /** Geometry changes invalidate physical gait samples, not observed camera identities. */
 resetCalibrated(){this.analyzers.clear();this.predictor=null;
  this.visible=[];this.ambiguous=false;this.poseIndices={A:null,B:null};
  this.observedFrameTime=null;this.lastTimestamp=0;this.lastWallMs=0;
  this.reason='Identitas direset; tempatkan kedua tubuh dalam bingkai.';this.invalidate();
 }
 private ensurePredictor(){
  if(!this.predictor&&this.floor.floor)this.predictor=new GhostFootstepPredictor(this.floor.floor);
  return this.predictor;
 }
 get status():MultiPoseStatus{
  return {mode:this.mode,visible:this.visible.slice(),ambiguous:this.ambiguous,
   reason:this.reason,ghostCount:this.getGhosts(this.displayClockMs).length,
   poseIndices:{...this.poseIndices},observedFrameTime:this.observedFrameTime};
 }
 /** The detector's identity assignment is independent of a physical floor.
  * A same-frame snapshot is shared by the optional calibrated gait route.
  * A missing second actor never creates a replacement A or B. */
 get previewStatus():MultiPoseStatus{
  const r=this.previewResult,indices=this.previewIndices;
  return {mode:this.mode,visible:r?.assignments.map(a=>a.id)??[],
   ambiguous:r?.ambiguous??false,reason:r?.reason??'Menunggu pose kamera.',
   ghostCount:0,poseIndices:{...indices},observedFrameTime:r&&!r.ambiguous&&(indices.A!==null||indices.B!==null)?this.previewFrame?.time??null:null,
   identityEpoch:this.previewEpoch,actorStates:r?.states};
 }
 observePreview(frame:MotionFrame|null):void{
  if(this.mode!==2)return;
  if(!frame||frame.source!=='camera'||!Number.isFinite(frame.time)||frame.time<0||!frame.poses?.length){
   if(this.previewFrame){this.previewFrame=null;this.previewResult=null;this.previewIndices={A:null,B:null};this.invalidate();}
   return;
  }
  if(this.previewFrame?.time===frame.time)return;
  if(this.previewFrame&&frame.time<this.previewFrame.time)return;
  const prior=this.previewStatus;
  const result=this.identity.observe(frame.poses,frame.time);
  const indices:{A:number|null;B:number|null}={A:null,B:null};
  if(!result.ambiguous)for(const {id,pose} of result.assignments){const i=frame.poses.indexOf(pose);if(i>=0&&i<2)indices[id]=i;}
  this.previewFrame=frame;this.previewResult=result;this.previewIndices=indices;
  if(prior.ambiguous!==result.ambiguous||prior.poseIndices.A!==indices.A||prior.poseIndices.B!==indices.B||prior.reason!==result.reason)this.invalidate();
 }
 getGhosts(timeMs:number):FootstepEvent[]{
  if(!this.floor.isConfirmed)return [];
  return this.predictor?.get(timeMs)??[];
 }
 get previewSession():FloorSession|null{
  const session=this.floor.session;if(!session)return null;
  const events=[...session.events,...this.getGhosts(this.displayClockMs)];
  events.sort((a,b)=>a.timestampMs-b.timestampMs);
  return createFloorSession(session.floor,events);
 }
 acceptSingle(sample:GaitSample|null,side:0|1,events:FootstepEvent[]){
  if(this.mode!==1)return;
  if(!sample){this.predictor?.lose('performer-1');this.invalidate();return;}
  this.lastTimestamp=sample.t;this.lastWallMs=performance.now();
  const predictor=this.ensurePredictor();
  predictor?.accept(events);
  if(sample.phase==='swing'&&sample.confidence>=.6){
   predictor?.swing('performer-1',side===0?'left':'right',sample.t,sample.confidence);
   this.invalidate();}
 }
 observe(frame:MotionFrame|null,clock:number,videoAspect:number,binding:CameraBinding|null):void{
  if(this.mode!==2)return;
  // Always invalidate stale pose-index associations before examining a new frame.
  this.poseIndices={A:null,B:null};this.observedFrameTime=null;
  if(!frame||frame.source!=='camera'||!frame.poses?.length||!Number.isFinite(clock)){
   for(const id of this.visible){
    this.floor.losePerformer(id);this.predictor?.lose(id);
    this.analyzers.get(id)?.reset();
   }
   this.visible=[];this.predictor?.reset();this.reason='Tracking terputus; menunggu dua tubuh.';this.invalidate();
   return;
  }
  this.lastTimestamp=clock;this.lastWallMs=performance.now();
  // Crucial: do not feed a stale MotionFrame into a 2-person GaitAnalyzer.
  if(!this.floor.isConfirmed||!this.floor.checkBinding(binding)){
   this.visible=[];this.predictor?.reset();this.reason='Konfirmasi kalibrasi kamera dahulu.';this.invalidate();
   return;
  }
  this.observePreview(frame);
  // Physical output retains its independent calibration/binding gate above.
  // Reject a delayed callback instead of applying identity from another frame.
  const result=this.previewFrame?.time===frame.time?this.previewResult:null;
  if(!result){for(const id of this.visible){this.floor.losePerformer(id);this.predictor?.lose(id);this.analyzers.get(id)?.reset();}this.visible=[];this.invalidate();return;}
  const lost=new Set([...result.lost,...this.visible.filter(id=>!result.assignments.some(a=>a.id===id))]);
  for(const id of lost){
   this.floor.losePerformer(id);this.predictor?.lose(id);
   this.analyzers.get(id)?.reset();
  }
  this.visible=result.assignments.map(a=>a.id);
  this.ambiguous=result.ambiguous;this.reason=result.reason;
  if(result.ambiguous){this.invalidate();return;}
  // Source arrays may reorder A/B every frame. Only explicit accepted tracker
  // assignments may attach a different archive clip to a person.
  for(const {id,pose} of result.assignments){
   const index=frame.poses.indexOf(pose);
   if(index<0||index>=2)continue;
   this.poseIndices[id]=index;
  }
  if(this.poseIndices.A!==null&&this.poseIndices.B!==null)
   this.observedFrameTime=frame.time;
  for(const {id,pose} of result.assignments){
   let analyzer=this.analyzers.get(id);
   if(!analyzer){analyzer=new GaitAnalyzer();this.analyzers.set(id,analyzer);}
   const single={...frame,pose,tracked:true};
   for(const side of [0,1] as const){
    const sample=analyzer.observe(single,side,clock,videoAspect);
    const events=this.floor.ingest(sample,side,videoAspect,binding,id,frame.telemetry?.capturedAt??null);
    const predictor=this.ensurePredictor();
    predictor?.accept(events);
    if(sample?.phase==='swing'&&sample.confidence>=.6){
     predictor?.swing(id,side===0?'left':'right',sample.t,sample.confidence);
     this.invalidate();}
   }
  }
 }
}
