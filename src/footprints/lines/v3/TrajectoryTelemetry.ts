import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {ActorPathObservation,PathPoint} from './PathObservationRouter.ts';
import type {PathEvent,PathEventKind} from './ActorPathTracker.ts';

const ACTORS=['A','B'] as const;
const kinds=['START','ADD','TURN','STOP','CUT'] as const;
type Counts=Record<PathEventKind,number>;
export type PathTelemetrySnapshot={
 sourceKey:string;inputFrames:number;validPoseFrames:number;
 groundObservations:number;retainedObservations:number;
 byActor:Record<ActorChannel,{observations:number;emitted:Counts;pathLengthPx:number;pendingMovementPx:number}>;
 rejected:Record<string,number>;cutReasons:Record<string,number>;
};
const blankCounts=():Counts=>({START:0,ADD:0,TURN:0,STOP:0,CUT:0});
const blankActor=()=>({observations:0,emitted:blankCounts(),pathLengthPx:0,pendingMovementPx:0});
const distance=(a:PathPoint,b:PathPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Bounded in-memory diagnostic counters; never writes to stage pixels or transport. */
export class TrajectoryTelemetry{
 private sourceKey='';
 private inputFrames=0;
 private validPoseFrames=0;
 private groundObservations=0;
 private retainedObservations=0;
 private byActor:PathTelemetrySnapshot['byActor']={A:blankActor(),B:blankActor()};
 private rejected:Record<string,number>={};
 private cutReasons:Record<string,number>={};
 private previousEmitted=new Map<ActorChannel,PathPoint>();
 private previousObserved=new Map<ActorChannel,PathPoint>();
 private lastFrameKey='';
 startSource(sourceKey:string){
  if(sourceKey===this.sourceKey)return;
  this.sourceKey=sourceKey;this.lastFrameKey='';
  this.inputFrames=0;this.validPoseFrames=0;
  this.groundObservations=0;this.retainedObservations=0;
  this.byActor={A:blankActor(),B:blankActor()};
  this.rejected={};this.cutReasons={};
  this.previousObserved.clear();this.previousEmitted.clear();
 }
 frame(sourceKey:string,frameMs:number,hasPose:boolean){
  this.startSource(sourceKey);
  if(!Number.isFinite(frameMs)||frameMs<0)return;
  const key=sourceKey+':'+frameMs;
  if(key===this.lastFrameKey)return;
  this.lastFrameKey=key;this.inputFrames++;
  if(hasPose)this.validPoseFrames++;
  else this.reject('no-valid-pose');
 }
 reject(reason:string,count=1){
  this.rejected[reason]=(this.rejected[reason]??0)+count;
 }
 observations(all:readonly ActorPathObservation[],retained:readonly ActorPathObservation[]){
  this.groundObservations+=all.length;this.retainedObservations+=retained.length;
  const covered=all.length-retained.length;
  if(covered>0)this.reject('replay-covered',covered);
  for(const o of retained){
   this.byActor[o.actorId].observations++;
   const prior=this.previousObserved.get(o.actorId);
   if(prior)this.byActor[o.actorId].pendingMovementPx+=distance(prior,o.point);
   this.previousObserved.set(o.actorId,{...o.point});
  }
 }
 events(events:readonly PathEvent[]){
  for(const e of events){
   this.byActor[e.actorId].emitted[e.kind]++;
   const prev=this.previousEmitted.get(e.actorId);
   if((e.kind==='ADD'||e.kind==='TURN')&&prev){
    this.byActor[e.actorId].pathLengthPx+=distance(prev,e.point);
    this.byActor[e.actorId].pendingMovementPx=0;
   }
   if(e.kind==='START'||e.kind==='ADD'||e.kind==='TURN')
    this.previousEmitted.set(e.actorId,{...e.point});
   if(e.kind==='CUT'){
    this.previousEmitted.delete(e.actorId);
    this.previousObserved.delete(e.actorId);
    const reason=e.reason??'unknown';
    this.cutReasons[reason]=(this.cutReasons[reason]??0)+1;
   }
  }
 }
 snapshot():PathTelemetrySnapshot{
  return {sourceKey:this.sourceKey,inputFrames:this.inputFrames,validPoseFrames:this.validPoseFrames,
   groundObservations:this.groundObservations,retainedObservations:this.retainedObservations,
   byActor:{A:{...this.byActor.A,emitted:{...this.byActor.A.emitted}},
    B:{...this.byActor.B,emitted:{...this.byActor.B.emitted}}},
   rejected:{...this.rejected},cutReasons:{...this.cutReasons}};
 }
 summary(){
  const s=this.snapshot(),parts=[`Frame ${s.inputFrames} · pose ${s.validPoseFrames} · observasi ${s.retainedObservations}`];
  for(const a of ACTORS){
   const x=s.byActor[a];
   parts.push(`${a}: ${x.observations} obs · START ${x.emitted.START} ADD ${x.emitted.ADD} TURN ${x.emitted.TURN} STOP ${x.emitted.STOP} CUT ${x.emitted.CUT} · ${Math.round(x.pathLengthPx)}px`);
  }
  parts.push('Alasan CUT: '+JSON.stringify(s.cutReasons));
  if(Object.keys(s.rejected).length)parts.push('Ditolak: '+JSON.stringify(s.rejected));
  return parts.join(' | ');
 }
}
