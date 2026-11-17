import {MotionProcessor} from '../engine/motion.ts';
import {defaults,type Landmark,type MotionFrame} from '../engine/types.ts';
import {GaitAnalyzer,type GaitSample} from '../footprints/gait-analysis/index.ts';
import {VideoAutoActorTracker,type VideoActorState} from './videoAutoActorTracker.ts';
import {TemporalJointAnalyzer,type TemporalFrame,type TemporalTracePoint} from './temporalJointIntelligence.ts';
import {HandLimbDetailAnalyzer,type HandLimbFrame} from './videoHandLimbDetail.ts';
import type {ReplayIdentityQA} from './videoReplayIdentityQA.ts';
import {ReplayActorRecoveryGate} from './replayActorRecoveryGate.ts';
import {MotionSemanticsEngine,type MotionSemanticEvent,type MotionSemanticStatus,type MotionSemanticKind} from './motionSemantics.ts';
import {ReplayInferenceWorkerClient} from './replayInferenceWorkerClient.ts';
import {ReplayPerformanceMeter,type ReplayPerformance} from './replayPerformance.ts';
import type {ReplayArchiveSegment} from './videoReplayExport.ts';
import {emptyReplayState,replayDiscontinuity,replayEventsForSample,
 type ReplayGaitEvent,type ReplayGaitState,type ReplayPerformer,type ReplayFoot} from './videoGaitAnalysis.ts';
import type {PoseLandmarker} from '@mediapipe/tasks-vision';

export type ReplayOverlayPerson={id:ReplayPerformer;landmarks:Landmark[];confidence:number};
export type ReplayAnalysisSnapshot={
 atMs:number;segment:number;sampledFrames:number;performers:1|2;
 firstAtMs?:number|null;truncatedEvents?:number;
 people:ReplayOverlayPerson[];events:ReplayGaitEvent[];
 /** Independent diagnostic output from MediaPipe; not an identity or gait approval. */
 rawPoses:Landmark[][];
 actorStates:VideoActorState[];detectedCount:number;visibleCount:number;rescueCount?:number;
 performerMode:'auto'|'manual';
 temporal:TemporalFrame|null;temporalFrameCount:number;
 handLimb:HandLimbFrame|null;handLimbFrameCount:number;
 /** Image-space semantic events only, never physical projector actions. */
 semanticEvents?:MotionSemanticEvent[];semanticStatuses?:MotionSemanticStatus[];
 status:string;ambiguous:boolean;
 performance:ReplayPerformance;totalEventCount:number;
 semanticTotals:Record<MotionSemanticKind,number>;
 gaitCounts:{contact:number;swing:number;slide:number;pivot:number};
 gait:Record<string,ReplayGaitState>;qa?:ReplayIdentityQA;archivedSegments?:number;
};
type Listener=(snapshot:ReplayAnalysisSnapshot)=>void;
const configs={...defaults(),input:'body' as const,mirror:false};
const sideName=(side:0|1):ReplayFoot=>side===0?'left':'right';

/** Completely isolated offline video inference; never writes to live camera,
 * StageSession, calibrated FloorSession, or dual projector renderer. */
export class VideoPoseGaitEngine{
 private model:PoseLandmarker|null=null;
 private worker:ReplayInferenceWorkerClient|null=null;
 private workerDisabled=false;
 private meter=new ReplayPerformanceMeter();
 private epoch=0;
 private lastEmitAt=-Infinity;
 private queuedForced:{video:HTMLVideoElement;atSeconds:number;capFPS:number}|null=null;
 private gaitCounts={contact:0,swing:0,slide:0,pivot:0};
 private processor=new MotionProcessor();
 private actorTracker=new VideoAutoActorTracker();
 private temporalAnalyzer=new TemporalJointAnalyzer();
 private handLimbAnalyzer=new HandLimbDetailAnalyzer();
 private semanticEngine=new MotionSemanticsEngine();
 private qa=new ReplayActorRecoveryGate();
 private archived:ReplayArchiveSegment[]=[];
 private firstAtMs:number|null=null;
 private discardedSegments=0;
 private truncatedEvents=0;
 private analyzers=new Map<ReplayPerformer,GaitAnalyzer>();
 private feet=new Map<string,ReplayGaitState>();
 private history:ReplayGaitEvent[]=[];
 private lastTime=-1;
 private lastInference=-1;
 private segment=0;
 private frames=0;
 private disposed=false;
 private inProgress=false;
 private people:ReplayOverlayPerson[]=[];
 private rawPoses:Landmark[][]=[];
 private actorStates:VideoActorState[]=[
  {id:'A',presence:'not-detected',confidence:0,rawIndex:null,lastSeenAtMs:null},
  {id:'B',presence:'not-detected',confidence:0,rawIndex:null,lastSeenAtMs:null}
 ];
 private detectedCount=0;
 private visibleCount=0;
 private rescueCount=0;
 private manualCount:1|2|null=null;
 private status='Belum dimulai';
 private ambiguous=false;
 private count:1|2=1;
 constructor(private readonly report:Listener){}
 get ready(){return (!!this.model||!!this.worker)&&!this.disposed;}
 get performance(){return this.meter.snapshot;}
 recordPresentedFrame(count:number|null){if(count!==null)this.meter.observePresented(count);}
 recordRender(ms:number){this.meter.observeRender(ms);}
 /** Current replay segment's bounded temporal data; never a physical gait output. */
 getTemporalTrace(actor:'A'|'B',joint:number):TemporalTracePoint[]{
  return this.temporalAnalyzer.getTrace(actor,joint);
 }
 getTemporalWindow():TemporalFrame[]{return this.temporalAnalyzer.window;}
 getHandLimbWindow():HandLimbFrame[]{return this.handLimbAnalyzer.window;}
 getSemanticEvents():MotionSemanticEvent[]{return this.semanticEngine.history;}
 get archivedSegments():ReplayArchiveSegment[]{
  return this.archived.map(s=>({...s,events:s.events.map(e=>({...e})),
   identityQA:{...s.identityQA,visible:[...s.identityQA.visible]}}));
 }
 get archiveOverflow(){return this.discardedSegments;}
 get archiveStats(){return {segments:this.archived.length,
  events:this.archived.reduce((sum,s)=>sum+s.events.length,0)};}
 private closeSegment(reason:string){
  if(this.frames===0&&this.history.length===0)return;
  this.archived.push({
   segment:this.segment,firstAtMs:this.firstAtMs,lastAtMs:this.lastTime>=0?this.lastTime:null,
   sampledFrames:this.frames,endReason:reason,events:this.history.map(e=>({...e})),
   truncatedEvents:this.truncatedEvents,
   identityQA:this.qa.snapshot
  });
  // Oldest segments are safely dropped to prevent unbounded browser memory.
  while(this.archived.length>64){
   this.archived.shift();this.discardedSegments++;
  }
 }
 get snapshot():ReplayAnalysisSnapshot{return this.buildSnapshot(true);}
 private buildSnapshot(full:boolean):ReplayAnalysisSnapshot{
  return {atMs:Math.max(0,this.lastTime),segment:this.segment,
   firstAtMs:this.firstAtMs,truncatedEvents:this.truncatedEvents,
   sampledFrames:this.frames,performers:this.count,people:this.people.map(person=>({
    ...person,landmarks:person.landmarks.map(point=>({...point}))
   })),rawPoses:this.rawPoses.map(pose=>pose.map(p=>({...p}))),
   actorStates:this.actorStates.map(actor=>({...actor})),
   detectedCount:this.detectedCount,visibleCount:this.visibleCount,rescueCount:this.rescueCount,
   performerMode:this.manualCount===null?'auto':'manual',
   temporal:this.temporalAnalyzer.latest,temporalFrameCount:this.temporalAnalyzer.frameCount,
   handLimb:this.handLimbAnalyzer.latest,handLimbFrameCount:this.handLimbAnalyzer.frameCount,
   semanticEvents:full?this.semanticEngine.history:this.semanticEngine.getRecentEvents(64),
   semanticStatuses:this.semanticEngine.statuses,
   events:full?this.history.slice():this.history.slice(-64),
   performance:this.meter.snapshot,totalEventCount:this.history.length+this.truncatedEvents,
   semanticTotals:this.semanticEngine.counts,gaitCounts:{...this.gaitCounts},
   status:this.status,ambiguous:this.ambiguous,
   gait:Object.fromEntries([...this.feet].map(([id,value])=>[id,{...value}])),
   qa:this.qa.snapshot,archivedSegments:this.archived.length};
 }
 async init():Promise<void>{
  if(this.disposed)throw Error('Analisis sudah dihentikan.');
  if(this.ready)return;
  if(!this.workerDisabled&&typeof Worker!=='undefined'&&
   typeof createImageBitmap==='function'){
   let worker:ReplayInferenceWorkerClient|null=null;
   try{
    worker=new ReplayInferenceWorkerClient();await worker.init();
    if(this.disposed){worker.dispose();return;}
    this.worker=worker;this.meter.setBackend('worker');
    this.status='Analisis worker siap. Video dan AI berjalan terpisah.';
    this.emit(true);return;
   }catch{worker?.dispose();this.workerDisabled=true;}
  }
  await this.loadMainModels();
 }
 private async loadMainModels(){
  if(this.disposed||this.model)return;
  const vision=await import('@mediapipe/tasks-vision');
  const files=await vision.FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
  if(this.disposed)return;
  const pose=await vision.PoseLandmarker.createFromOptions(files,{
   baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`,delegate:'CPU'},
   runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.48,
   minPosePresenceConfidence:.46,minTrackingConfidence:.52,outputSegmentationMasks:false
  });
  if(this.disposed){pose.close();return;}
  this.model=pose;this.meter.setBackend('main');
  this.status='Fallback CPU utama aktif; pelacakan tubuh dan anggota badan.';
  this.emit(true);this.consumeForced();
 }
 setPerformers(choice:'auto'|1|2){
  const next=choice==='auto'?null:choice;
  if(next===this.manualCount)return;
  this.manualCount=next;this.reset('Mode aktor diubah. Analisis dimulai ulang.');
 }
 reset(reason='Seek atau loop: event lama dikosongkan agar tidak tercampur.'){
  this.epoch++;this.queuedForced=null;
  this.closeSegment(reason);this.qa.reset(reason,this.lastTime>=0?this.lastTime:null);
  this.segment++;this.history=[];this.frames=0;this.firstAtMs=null;
  this.truncatedEvents=0;this.gaitCounts={contact:0,swing:0,slide:0,pivot:0};
  this.feet.clear();this.actorTracker.reset();this.temporalAnalyzer.reset();
  this.handLimbAnalyzer.reset();this.semanticEngine.reset();
  this.meter.reset();
  this.analyzers.clear();this.processor.reset();
  this.count=this.manualCount??1;this.people=[];this.rawPoses=[];
  this.ambiguous=false;this.lastTime=-1;this.detectedCount=0;this.visibleCount=0;
  this.rescueCount=0;
  this.actorStates=[
   {id:'A',presence:'not-detected',confidence:0,rawIndex:null,lastSeenAtMs:null},
   {id:'B',presence:'not-detected',confidence:0,rawIndex:null,lastSeenAtMs:null}
  ];
  this.status=reason;this.lastEmitAt=-Infinity;this.emit(true);
 }
 private emit(force=false){
  if(this.disposed)return;
  const now=performance.now();
  if(!force&&now-this.lastEmitAt<140)return;
  this.lastEmitAt=now;this.meter.observeUi(now);this.report(this.buildSnapshot(false));
 }
 private consumeForced(){
  if(this.disposed||this.inProgress||!this.ready||!this.queuedForced)return;
  const forced=this.queuedForced;this.queuedForced=null;
  if(forced.video.readyState>=2)this.process(
   forced.video,forced.atSeconds,forced.capFPS,true);
 }
 process(video:HTMLVideoElement,atSeconds:number,capFPS=18,force=false){
  if(this.disposed||!this.ready||video.readyState<2||video.seeking)return;
  if(!Number.isFinite(atSeconds)||atSeconds<0)return;
  if(this.inProgress){
   this.meter.observeBusy();
   if(force)this.queuedForced={video,atSeconds,capFPS};
   return;
  }
  const atMs=atSeconds*1000;
  if(replayDiscontinuity(this.lastTime,atMs))
   this.reset('Lompatan waktu video: segmen baru.');
  if(this.lastTime>=0){
   const diff=atMs-this.lastTime;
   if(!force&&diff<1000/Math.max(1,Math.min(30,capFPS))*.85)return;
   if(Math.abs(diff)<1)return;
  }
  this.inProgress=true;
  const epoch=this.epoch,startedAt=performance.now();
  const clock=Math.max(this.lastInference+1,startedAt);this.lastInference=clock;
  if(this.worker){
   const worker=this.worker;
   void worker.detect(video,clock,this.manualCount??
    (this.actorStates.some(a=>a.id==='B'&&a.lastSeenAtMs!==null)?2:1)).then(result=>{
    if(this.disposed||epoch!==this.epoch)return;
    this.rescueCount=result.rescuedCount??0;
    const begin=performance.now();
    this.analyzeDetections(result.landmarks,result.worldLandmarks,atMs,capFPS,
     video.videoWidth/Math.max(1,video.videoHeight));
    this.meter.observeInference(performance.now(),result.poseMs,0,
     performance.now()-begin,performance.now()-startedAt,false,0);
    this.emit();
   }).catch(error=>{
    if(this.disposed||epoch!==this.epoch)return;
    worker.dispose();if(this.worker===worker)this.worker=null;
    this.workerDisabled=true;this.meter.setBackend('main');
    this.reset('Inferensi worker terputus; memulihkan pelacakan CPU.');
    void this.loadMainModels().catch(e=>{
     this.status='Fallback CPU gagal: '+(e instanceof Error?e.message:String(e));
     this.emit(true);
    });
   }).finally(()=>{this.inProgress=false;this.consumeForced();});
   return;
  }
  try{
   const beginPose=performance.now();
   const result=this.model!.detectForVideo(video,clock);
   const poseMs=performance.now()-beginPose;
   try{
    const beginAnalysis=performance.now();
    this.analyzeDetections(result.landmarks,result.worldLandmarks,atMs,capFPS,
     video.videoWidth/Math.max(1,video.videoHeight));
    this.meter.observeInference(performance.now(),poseMs,0,
     performance.now()-beginAnalysis,performance.now()-startedAt,false,0);
    this.emit();
   }finally{result.close();}
  }catch(error){this.handleError(error);}
  finally{this.inProgress=false;this.consumeForced();}
 }
 private analyzeDetections(landmarks:Landmark[][],worldLandmarks:Landmark[][],
  atMs:number,capFPS:number,aspect:number){
    // Expose all detected skeletons before the conservative identity/gait gate.
    // If two people cross, the diagnostic overlay still shows the raw observations.
    this.rawPoses=landmarks.filter(p=>p.length>=33).slice(0,2)
     .map(pose=>pose.map(point=>({...point})));
    const frame:MotionFrame=this.processor.process(null,{
     landmarks,worldLandmarks
    },atMs,configs,capFPS);
    this.lastTime=atMs;this.frames++;
    this.firstAtMs??=atMs;
    const observed=this.actorTracker.observe(this.rawPoses,atMs);
    this.actorStates=observed.actors;
    this.detectedCount=observed.detectedCount;
    this.visibleCount=observed.visibleCount;
    // A visible actor continues its trace while the other is hidden.
    // This never bypasses identity QA for physical gait event generation.
    const temporal=this.temporalAnalyzer.observe(observed.assignments,observed.actors,atMs);
    this.handLimbAnalyzer.observe(observed.assignments,observed.actors,temporal,atMs,{
     hands:null,handModelAvailable:false
    });
    // A continues when B enters, leaves, crosses or is reacquiring.
    // A count change does not reset the other actor's gait continuity.
    this.count=this.manualCount??observed.knownCount;
    this.ambiguous=observed.ambiguous;
    const candidates:ReplayOverlayPerson[]=observed.assignments
     .filter(person=>this.count===2||person.id==='A')
     .map(person=>({id:person.id,landmarks:person.pose,confidence:person.confidence}));
    const approved=this.qa.observe(candidates,observed.actors);
    this.status=(this.rescueCount?'Pose kedua ditemukan lewat pemeriksaan area khusus. ':'')+
     observed.reason+(approved.length?
     ' Event gait aktor yang lolos QA tetap aktif.':
     ' Event gait ditahan sampai identitas stabil.');
    // Reset only the actor that disappeared, never both event chains.
    for(const id of ['A','B'] as const){
     if(approved.some(person=>person.id===id))continue;
     this.analyzers.delete(id);
     this.feet.delete(id+':left');this.feet.delete(id+':right');
    }
    const freshGaitEvents:ReplayGaitEvent[]=[];
    for(const person of approved){
      let analyzer=this.analyzers.get(person.id);
      if(!analyzer){analyzer=new GaitAnalyzer();this.analyzers.set(person.id,analyzer);}
      const single={...frame,pose:person.landmarks,tracked:true};
      for(const side of [0,1] as const){
       const foot=sideName(side),key=person.id+':'+foot;
       const sample:GaitSample|null=analyzer.observe(single,side,atMs,aspect);
       if(!sample){this.feet.delete(key);continue;}
       const previous=this.feet.get(key)??emptyReplayState();
       const changes=replayEventsForSample(sample,previous,person.id,foot,this.segment);
       if(changes.length){
       this.history.push(...changes);freshGaitEvents.push(...changes);
       for(const event of changes)this.gaitCounts[event.kind]++;
      }
       this.feet.set(key,{phase:sample.phase,motion:sample.motionKind??'unknown',confidence:sample.confidence});
      }
     }
    this.semanticEngine.observe(temporal,approved,freshGaitEvents,this.segment);
    this.people=approved;
    // Bound memory during long takes. Position is image-relative, never metric.
    if(this.history.length>5000){this.truncatedEvents+=this.history.length-5000;this.history=this.history.slice(-5000);}

 }
 private handleError(e:unknown){
  this.status='Analisis frame gagal: '+(e instanceof Error?e.message:String(e));
  this.people=[];this.rawPoses=[];this.detectedCount=0;this.visibleCount=0;
  this.actorStates=this.actorStates.map(person=>({
   ...person,presence:'lost',rawIndex:null,confidence:0
  }));
  this.analyzers.clear();this.feet.clear();this.temporalAnalyzer.reset();
  this.handLimbAnalyzer.reset();this.semanticEngine.reset();
  this.qa.observe([],this.actorStates);this.emit(true);
 }
 dispose(){
  if(this.disposed)return;
  this.disposed=true;this.epoch++;this.queuedForced=null;
  this.worker?.dispose();this.worker=null;this.model?.close();this.model=null;
  this.actorTracker.reset();this.temporalAnalyzer.reset();this.handLimbAnalyzer.reset();
  this.semanticEngine.reset();
  this.analyzers.clear();this.feet.clear();
  this.history=[];this.archived=[];this.people=[];this.rawPoses=[];
  this.actorStates=[];this.lastTime=-1;
 }
}
