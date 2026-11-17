import {MotionProcessor} from '../engine/motion.ts';
import {defaults,type Landmark,type MotionFrame} from '../engine/types.ts';
import {GaitAnalyzer,type GaitSample} from '../footprints/gait-analysis/index.ts';
import {TwoPersonIdentityTracker} from '../footprints/live/TwoPersonIdentityTracker.ts';
import {ReplayIdentityGate,type ReplayIdentityQA} from './videoReplayIdentityQA.ts';
import type {ReplayArchiveSegment} from './videoReplayExport.ts';
import {emptyReplayState,replayDiscontinuity,replayEventsForSample,
 type ReplayGaitEvent,type ReplayGaitState,type ReplayPerformer,type ReplayFoot} from './videoGaitAnalysis.ts';
import type {PoseLandmarker} from '@mediapipe/tasks-vision';

export type ReplayOverlayPerson={id:ReplayPerformer;landmarks:Landmark[];confidence:number};
export type ReplayAnalysisSnapshot={
 atMs:number;segment:number;sampledFrames:number;performers:1|2;
 people:ReplayOverlayPerson[];events:ReplayGaitEvent[];
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
 private processor=new MotionProcessor();
 private identity=new TwoPersonIdentityTracker();
 private qa=new ReplayIdentityGate();
 private archived:ReplayArchiveSegment[]=[];
 private firstAtMs:number|null=null;
 private discardedSegments=0;
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
 private status='Belum dimulai';
 private ambiguous=false;
 private count:1|2=1;
 constructor(private readonly report:Listener){}
 get ready(){return !!this.model&&!this.disposed;}
 get archivedSegments():ReplayArchiveSegment[]{
  return this.archived.map(s=>({...s,events:s.events.map(e=>({...e})),
   identityQA:{...s.identityQA,visible:[...s.identityQA.visible]}}));
 }
 get archiveOverflow(){return this.discardedSegments;}
 private closeSegment(reason:string){
  if(this.frames===0&&this.history.length===0)return;
  this.archived.push({
   segment:this.segment,firstAtMs:this.firstAtMs,lastAtMs:this.lastTime>=0?this.lastTime:null,
   sampledFrames:this.frames,endReason:reason,events:this.history.map(e=>({...e})),
   identityQA:this.qa.snapshot
  });
  // Oldest segments are safely dropped to prevent unbounded browser memory.
  while(this.archived.length>64){
   this.archived.shift();this.discardedSegments++;
  }
 }
 get snapshot():ReplayAnalysisSnapshot{
  return {atMs:Math.max(0,this.lastTime),segment:this.segment,
   sampledFrames:this.frames,performers:this.count,people:this.people.map(person=>({
    ...person,landmarks:person.landmarks.map(point=>({...point}))
   })),events:this.history.slice(),status:this.status,ambiguous:this.ambiguous,
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
  this.emit();
 }
 setPerformers(count:1|2){
  if(count===this.count)return;
  this.count=count;this.reset('Jumlah performer berubah. Analisis dimulai ulang.');
 }
 reset(reason='Seek atau loop: event lama dikosongkan agar tidak tercampur.'){
  this.closeSegment(reason);
  this.qa.reset(reason,this.lastTime>=0?this.lastTime:null);
  this.segment++;this.history=[];this.frames=0;this.firstAtMs=null;this.feet.clear();
  this.identity.reset();this.analyzers.clear();this.processor.reset();
  this.people=[];this.ambiguous=false;this.lastTime=-1;
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
    const frame:MotionFrame=this.processor.process(null,{
     landmarks:result.landmarks,worldLandmarks:result.worldLandmarks
    },atMs,configs,capFPS);
    this.lastTime=atMs;this.frames++;
    this.firstAtMs??=atMs;
    let assigned:ReplayOverlayPerson[]=[];
    if(this.count===2){
     const resolution=this.identity.observe(result.landmarks,atMs);
     this.ambiguous=resolution.ambiguous;
     if(!resolution.ambiguous&&resolution.assignments.length===2){
      assigned=resolution.assignments.map(item=>({
       id:item.id,landmarks:item.pose,confidence:item.confidence
      }));
     }
     this.status=resolution.ambiguous?'Identitas A/B ambigu. Reset atau seek untuk mengulang.':
      assigned.length===2?'BODY A/B terbaca pada video.':'Menunggu dua tubuh yang terlihat lengkap.';
    }else{
     this.ambiguous=false;
     if(result.landmarks[0]?.length===33&&frame.tracked){
      assigned=[{id:'A',landmarks:result.landmarks[0],confidence:frame.quality}];
     }
     this.status=assigned.length?'Pose A terbaca, membaca fase kaki.':'Kaki/pinggul belum cukup terlihat.';
    }
    const identityStable=this.qa.observe(assigned,this.count,this.ambiguous);
    if(!identityStable){
     this.status=this.qa.snapshot.reason;
     assigned=[];
    }
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
    if(this.history.length>5000)this.history=this.history.slice(-5000);
    this.emit();
   }finally{result.close();}
  }catch(e){
   this.status='Analisis frame gagal: '+(e instanceof Error?e.message:String(e));
   this.people=[];this.analyzers.clear();this.feet.clear();
   this.qa.observe([],this.count,false);this.emit();
  }finally{this.inProgress=false;}
 }
 dispose(){
  if(this.disposed)return;
  this.disposed=true;this.model?.close();this.model=null;
  this.identity.reset();this.analyzers.clear();this.feet.clear();
  this.history=[];this.archived=[];this.people=[];this.lastTime=-1;
 }
}
