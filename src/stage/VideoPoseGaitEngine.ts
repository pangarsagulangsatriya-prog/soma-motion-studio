import {MotionProcessor} from '../engine/motion.ts';
import {defaults,type Landmark,type MotionFrame} from '../engine/types.ts';
import {GaitAnalyzer,type GaitSample} from '../footprints/gait-analysis/index.ts';
import {VideoAutoActorTracker,type VideoActorState} from './videoAutoActorTracker.ts';
import {TemporalJointAnalyzer,type TemporalFrame,type TemporalTracePoint} from './temporalJointIntelligence.ts';
import {HandLimbDetailAnalyzer,HAND_SCAN_INTERVAL_MS,type HandLimbFrame,type RawHandDetection} from './videoHandLimbDetail.ts';
import {ReplayIdentityGate,type ReplayIdentityQA} from './videoReplayIdentityQA.ts';
import type {ReplayArchiveSegment} from './videoReplayExport.ts';
import {emptyReplayState,replayDiscontinuity,replayEventsForSample,
 type ReplayGaitEvent,type ReplayGaitState,type ReplayPerformer,type ReplayFoot} from './videoGaitAnalysis.ts';
import type {PoseLandmarker,HandLandmarker} from '@mediapipe/tasks-vision';

export type ReplayOverlayPerson={id:ReplayPerformer;landmarks:Landmark[];confidence:number};
export type ReplayAnalysisSnapshot={
 atMs:number;segment:number;sampledFrames:number;performers:1|2;
 firstAtMs?:number|null;truncatedEvents?:number;
 people:ReplayOverlayPerson[];events:ReplayGaitEvent[];
 /** Independent diagnostic output from MediaPipe; not an identity or gait approval. */
 rawPoses:Landmark[][];
 actorStates:VideoActorState[];detectedCount:number;visibleCount:number;
 performerMode:'auto'|'manual';
 temporal:TemporalFrame|null;temporalFrameCount:number;
 handLimb:HandLimbFrame|null;handLimbFrameCount:number;
 handModelStatus:'loading'|'ready'|'unavailable';handModelReason:string;
 status:string;ambiguous:boolean;
 gait:Record<string,ReplayGaitState>;qa?:ReplayIdentityQA;archivedSegments?:number;
};
type Listener=(snapshot:ReplayAnalysisSnapshot)=>void;
const configs={...defaults(),input:'body' as const,mirror:false};
const sideName=(side:0|1):ReplayFoot=>side===0?'left':'right';

/** Completely isolated offline video inference; never writes to live camera,
 * StageSession, calibrated FloorSession, or dual projector renderer. */
export class VideoPoseGaitEngine{
 private model:PoseLandmarker|null=null;
 private handModel:HandLandmarker|null=null;
 private lastHandScanAt=-Infinity;
 private handFailures=0;
 private handModelStatus:'loading'|'ready'|'unavailable'='loading';
 private handModelReason='Menyiapkan Hand Landmarker';
 private processor=new MotionProcessor();
 private actorTracker=new VideoAutoActorTracker();
 private temporalAnalyzer=new TemporalJointAnalyzer();
 private handLimbAnalyzer=new HandLimbDetailAnalyzer();
 private qa=new ReplayIdentityGate();
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
 private manualCount:1|2|null=null;
 private status='Belum dimulai';
 private ambiguous=false;
 private count:1|2=1;
 constructor(private readonly report:Listener){}
 get ready(){return !!this.model&&!this.disposed;}
 /** Current replay segment's bounded temporal data; never a physical gait output. */
 getTemporalTrace(actor:'A'|'B',joint:number):TemporalTracePoint[]{
  return this.temporalAnalyzer.getTrace(actor,joint);
 }
 getTemporalWindow():TemporalFrame[]{return this.temporalAnalyzer.window;}
 getHandLimbWindow():HandLimbFrame[]{return this.handLimbAnalyzer.window;}
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
 get snapshot():ReplayAnalysisSnapshot{
  return {atMs:Math.max(0,this.lastTime),segment:this.segment,
   firstAtMs:this.firstAtMs,truncatedEvents:this.truncatedEvents,
   sampledFrames:this.frames,performers:this.count,people:this.people.map(person=>({
    ...person,landmarks:person.landmarks.map(point=>({...point}))
   })),rawPoses:this.rawPoses.map(pose=>pose.map(p=>({...p}))),
   actorStates:this.actorStates.map(actor=>({...actor})),
   detectedCount:this.detectedCount,visibleCount:this.visibleCount,
   performerMode:this.manualCount===null?'auto':'manual',
   temporal:this.temporalAnalyzer.latest,temporalFrameCount:this.temporalAnalyzer.frameCount,
   handLimb:this.handLimbAnalyzer.latest,handLimbFrameCount:this.handLimbAnalyzer.frameCount,
   handModelStatus:this.handModelStatus,handModelReason:this.handModelReason,
   events:this.history.slice(),status:this.status,ambiguous:this.ambiguous,
   gait:Object.fromEntries([...this.feet].map(([id,value])=>[id,{...value}])),
   qa:this.qa.snapshot,archivedSegments:this.archived.length};
 }
 async init():Promise<void>{
  if(this.disposed)throw Error('Analisis sudah dihentikan.');
  if(this.model)return;
  const vision=await import('@mediapipe/tasks-vision');
  const files=await vision.FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
  if(this.disposed)return;
  const model=await vision.PoseLandmarker.createFromOptions(files,{
   baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`,delegate:'CPU'},
   runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.6,
   minPosePresenceConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false
  });
  if(this.disposed){model.close();return;}
  this.model=model;this.status='Model Pose siap. Putar video untuk membaca gerak.';
  // Optional detector: if hand loading fails, pose and limbs still work.
  try{
   const hand=await vision.HandLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/hand_landmarker.task`,delegate:'CPU'},
    runningMode:'VIDEO',numHands:4,minHandDetectionConfidence:.55,
    minHandPresenceConfidence:.55,minTrackingConfidence:.55
   });
   if(this.disposed){hand.close();return;}
   this.handModel=hand;this.handModelStatus='ready';
   this.handModelReason='Detail 21 landmark tangan aktif.';
  }catch(error){
   this.handModelStatus='unavailable';
   this.handModelReason='Model tangan gagal dimuat: '+
    (error instanceof Error?error.message:'model tidak tersedia');
  }
  this.emit();
 }
 /** Auto is the default for every MP4. Manual override stays in the advanced lab. */
 setPerformers(choice:'auto'|1|2){
  const next=choice==='auto'?null:choice;
  if(next===this.manualCount)return;
  this.manualCount=next;
  this.reset('Mode jumlah aktor berubah. Analisis dimulai ulang.');
 }
 reset(reason='Seek atau loop: event lama dikosongkan agar tidak tercampur.'){
  this.closeSegment(reason);
  this.qa.reset(reason,this.lastTime>=0?this.lastTime:null);
  this.segment++;this.history=[];this.frames=0;this.firstAtMs=null;this.truncatedEvents=0;this.feet.clear();
  this.actorTracker.reset();this.temporalAnalyzer.reset();this.handLimbAnalyzer.reset();
  this.lastHandScanAt=-Infinity;this.handFailures=0;
  this.analyzers.clear();this.processor.reset();
  this.count=this.manualCount??1;
  this.people=[];this.rawPoses=[];this.ambiguous=false;this.lastTime=-1;
  this.detectedCount=0;this.visibleCount=0;
  this.actorStates=[
   {id:'A',presence:'not-detected',confidence:0,rawIndex:null,lastSeenAtMs:null},
   {id:'B',presence:'not-detected',confidence:0,rawIndex:null,lastSeenAtMs:null}
  ];
  this.status=reason;this.emit();
 }
 private emit(){if(!this.disposed)this.report(this.snapshot);}
 process(video:HTMLVideoElement,atSeconds:number,capFPS=12,force=false){
  if(!this.model||this.disposed||this.inProgress||video.readyState<2||video.seeking)return;
  if(!Number.isFinite(atSeconds)||atSeconds<0)return;
  const atMs=atSeconds*1000;
  if(replayDiscontinuity(this.lastTime,atMs))this.reset('Lompatan waktu video: mulai segmen baru.');
  if(this.lastTime>=0){
   const diff=atMs-this.lastTime;
   if(!force&&diff<1000/Math.max(1,Math.min(30,capFPS))*.85)return;
   if(Math.abs(diff)<1)return;
  }
  this.inProgress=true;
  try{
   // MediaPipe VIDEO timestamps must be strictly increasing, even after seek.
   // Gait timelines instead use media timestamps and reset on discontinuity.
   const clock=Math.max(this.lastInference+1,performance.now());
   this.lastInference=clock;
   const result=this.model.detectForVideo(video,clock);
   try{
    // Expose all detected skeletons before the conservative identity/gait gate.
    // If two people cross, the diagnostic overlay still shows the raw observations.
    this.rawPoses=result.landmarks.filter(p=>p.length>=33).slice(0,2)
     .map(pose=>pose.map(point=>({...point})));
    const frame:MotionFrame=this.processor.process(null,{
     landmarks:result.landmarks,worldLandmarks:result.worldLandmarks
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
    let hands:RawHandDetection[]|null=null;
    if(this.handModel&&atMs-this.lastHandScanAt>=HAND_SCAN_INTERVAL_MS){
     this.lastHandScanAt=atMs;
     try{
      const handResult=this.handModel.detectForVideo(video,clock);
      hands=handResult.landmarks.slice(0,4).map((landmarks,rawIndex)=>({
       rawIndex,landmarks:landmarks.map(point=>({...point}))
      }));
      this.handFailures=0;
      if('close' in handResult&&typeof handResult.close==='function')handResult.close();
     }catch(error){
      hands=[];this.handFailures++;
      if(this.handFailures>=3){
       this.handModel.close();this.handModel=null;
       this.handModelStatus='unavailable';
       this.handModelReason='Deteksi tangan dihentikan setelah tiga frame gagal: '+
        (error instanceof Error?error.message:'kesalahan inferensi');
      }
     }
    }
    this.handLimbAnalyzer.observe(observed.assignments,observed.actors,temporal,atMs,{
     hands,handModelAvailable:this.handModel!==null
    });
    const count=this.manualCount??observed.knownCount;
    if(count!==this.count){
     this.count=count;
     // Changing 1 → 2 invalidates gait continuity, not the raw skeletons.
     this.qa.reset('Jumlah aktor terdeteksi berubah; cek ulang gait.',atMs);
     this.analyzers.clear();this.feet.clear();
    }
    this.ambiguous=observed.ambiguous;
    let assigned:ReplayOverlayPerson[]=observed.assignments
     .filter(person=>this.count===2||person.id==='A')
     .map(person=>({id:person.id,landmarks:person.pose,confidence:person.confidence}));
    const identityStable=this.qa.observe(assigned,this.count,this.ambiguous);
    this.status=observed.reason+(identityStable?' Event gait aktif.':
     ' Event gait ditahan sampai identitas lolos QA.');
    if(!identityStable)assigned=[];
    if(!assigned.length){
     // Never connect a stale planted foot to a new identity.
     this.analyzers.clear();this.feet.clear();
    }else{
     for(const person of assigned){
      let analyzer=this.analyzers.get(person.id);
      if(!analyzer){analyzer=new GaitAnalyzer();this.analyzers.set(person.id,analyzer);}
      const single={...frame,pose:person.landmarks,tracked:true};
      for(const side of [0,1] as const){
       const foot=sideName(side),key=person.id+':'+foot;
       const sample:GaitSample|null=analyzer.observe(single,side,atMs,video.videoWidth/video.videoHeight);
       if(!sample){this.feet.delete(key);continue;}
       const previous=this.feet.get(key)??emptyReplayState();
       const changes=replayEventsForSample(sample,previous,person.id,foot,this.segment);
       if(changes.length)this.history.push(...changes);
       this.feet.set(key,{phase:sample.phase,motion:sample.motionKind??'unknown',confidence:sample.confidence});
      }
     }
    }
    this.people=assigned;
    // Bound memory during long takes. Position is image-relative, never metric.
    if(this.history.length>5000){this.truncatedEvents+=this.history.length-5000;this.history=this.history.slice(-5000);}
    this.emit();
   }finally{result.close();}
  }catch(e){
   this.status='Analisis frame gagal: '+(e instanceof Error?e.message:String(e));
   this.people=[];this.rawPoses=[];this.detectedCount=0;this.visibleCount=0;
   this.actorStates=this.actorStates.map(person=>({...person,presence:'lost',rawIndex:null,confidence:0}));
   this.analyzers.clear();this.feet.clear();this.temporalAnalyzer.reset();
   this.handLimbAnalyzer.reset();this.lastHandScanAt=-Infinity;
   this.qa.observe([],this.count,false);this.emit();
  }finally{this.inProgress=false;}
 }
 dispose(){
  if(this.disposed)return;
  this.disposed=true;this.model?.close();this.model=null;
  this.handModel?.close();this.handModel=null;
  this.actorTracker.reset();this.temporalAnalyzer.reset();this.handLimbAnalyzer.reset();
  this.analyzers.clear();this.feet.clear();
  this.history=[];this.archived=[];this.people=[];this.rawPoses=[];
  this.actorStates=[];this.lastTime=-1;
 }
}
