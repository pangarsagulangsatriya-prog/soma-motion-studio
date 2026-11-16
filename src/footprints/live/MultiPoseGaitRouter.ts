import type {MotionFrame} from '../../engine/types.ts';
import {GaitAnalyzer,type GaitSample} from '../gait-analysis/index.ts';
import {LiveFloorTrackingEngine,type CameraBinding} from './LiveFloorTrackingEngine.ts';
import {TwoPersonIdentityTracker,type LivePerformerId} from './TwoPersonIdentityTracker.ts';
import {GhostFootstepPredictor} from './GhostFootstepPredictor.ts';
import {createFloorSession,type FloorSession,type FootstepEvent} from '../spatial/events.ts';

export type MultiPoseStatus={
 mode:1|2;visible:LivePerformerId[];ambiguous:boolean;reason:string;
 ghostCount:number;
};
/**
 * In two-person mode, reuses the 2 poses ALREADY in MotionFrame.poses.
 * Per-identity gait analyzers have independent smoothing and phase history.
 * Unknown or overlapping people produce NO contact or ghost.
 */
export class MultiPoseGaitRouter{
 private identity=new TwoPersonIdentityTracker();
 private analyzers=new Map<LivePerformerId,GaitAnalyzer>();
 private predictor:GhostFootstepPredictor|null=null;
 private mode:1|2=1;
 private visible:LivePerformerId[]=[];
 private ambiguous=false;
 private reason='Menunggu dua performer.';
 private lastTimestamp=0;
 private lastWallMs=0;
 get displayClockMs(){return this.lastTimestamp+(this.lastWallMs?Math.max(0,performance.now()-this.lastWallMs):0);}
 readonly floor:LiveFloorTrackingEngine;
 constructor(floor:LiveFloorTrackingEngine){this.floor=floor;}
 setMode(mode:1|2){
  if(this.mode===mode)return;
  this.mode=mode;this.reset();
 }
 get activeMode(){return this.mode;}
 reset(){
  this.identity.reset();this.analyzers.clear();this.predictor=null;
  this.visible=[];this.ambiguous=false;this.lastTimestamp=0;this.lastWallMs=0;
  this.reason='Identitas direset; tempatkan kedua tubuh dalam bingkai.';
 }
 private ensurePredictor(){
  if(!this.predictor&&this.floor.floor)this.predictor=new GhostFootstepPredictor(this.floor.floor);
  return this.predictor;
 }
 get status():MultiPoseStatus{
  return {mode:this.mode,visible:this.visible.slice(),ambiguous:this.ambiguous,
   reason:this.reason,ghostCount:this.getGhosts(this.displayClockMs).length};
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
  if(!sample){this.predictor?.lose('performer-1');return;}
  this.lastTimestamp=sample.t;this.lastWallMs=performance.now();
  const predictor=this.ensurePredictor();
  predictor?.accept(events);
  if(sample.phase==='swing'&&sample.confidence>=.6)
   predictor?.swing('performer-1',side===0?'left':'right',sample.t,sample.confidence);
 }
 observe(frame:MotionFrame|null,clock:number,videoAspect:number,binding:CameraBinding|null):void{
  if(this.mode!==2)return;
  if(!frame||frame.source!=='camera'||!frame.poses?.length||!Number.isFinite(clock)){
   for(const id of this.visible){
    this.floor.losePerformer(id);this.predictor?.lose(id);
    this.analyzers.get(id)?.reset();
   }
   this.visible=[];this.predictor?.reset();this.reason='Tracking terputus; menunggu dua tubuh.';
   return;
  }
  this.lastTimestamp=clock;this.lastWallMs=performance.now();
  // Crucial: do not feed a stale MotionFrame into a 2-person GaitAnalyzer.
  if(!this.floor.isConfirmed||!this.floor.checkBinding(binding)){
   this.visible=[];this.predictor?.reset();this.reason='Konfirmasi kalibrasi kamera dahulu.';
   return;
  }
  const result=this.identity.observe(frame.poses,clock);
  for(const id of result.lost){
   this.floor.losePerformer(id);this.predictor?.lose(id);
   this.analyzers.get(id)?.reset();
  }
  this.visible=result.assignments.map(a=>a.id);
  this.ambiguous=result.ambiguous;this.reason=result.reason;
  if(result.ambiguous)return;
  for(const {id,pose} of result.assignments){
   let analyzer=this.analyzers.get(id);
   if(!analyzer){analyzer=new GaitAnalyzer();this.analyzers.set(id,analyzer);}
   const single={...frame,pose,tracked:true};
   for(const side of [0,1] as const){
    const sample=analyzer.observe(single,side,clock,videoAspect);
    const events=this.floor.ingest(sample,side,videoAspect,binding,id);
    const predictor=this.ensurePredictor();
    predictor?.accept(events);
    if(sample?.phase==='swing'&&sample.confidence>=.6)
     predictor?.swing(id,side===0?'left':'right',sample.t,sample.confidence);
   }
  }
 }
}
