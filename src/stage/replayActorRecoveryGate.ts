import type {ReplayOverlayPerson} from './VideoPoseGaitEngine.ts';
import type {ReplayIdentityQA} from './videoReplayIdentityQA.ts';
import type {VideoActorId,VideoActorState} from './videoAutoActorTracker.ts';

const IDS:VideoActorId[]=['A','B'];
const REQUIRED=3;
const MIN_CONFIDENCE=.65;
const MIN_SPACING=.115;
export type ActorRecoveryState='waiting'|'warming'|'stable'|'uncertain'|'reacquiring'|'occluded'|'lost';
export type ActorRecoveryStatus={
 id:VideoActorId;state:ActorRecoveryState;approved:boolean;
 streak:number;lastSeenAtMs:number|null;reason:string;
};
type Entry={streak:number;approved:boolean;lastSeenAtMs:number|null;
 state:ActorRecoveryState;reason:string};
const start=():Entry=>({streak:0,approved:false,lastSeenAtMs:null,
 state:'waiting',reason:'Belum ditemukan'});
const label=(id:VideoActorId,state:ActorRecoveryState)=>
 id+' '+(state==='stable'?'lolos QA':state==='warming'?'menstabilkan':
 state==='reacquiring'?'memulihkan':state==='occluded'?'tertutup':
 state==='lost'?'keluar frame':state==='uncertain'?'belum pasti':'menunggu');

/** Independent gait-event approval per A/B. The raw skeleton and temporal
 * diagnostics do not depend on this conservative event gate.
 *
 * An ambiguous B may drop its events; stable A still contributes events.
 * No permanent global lock and no inferred pose through an occlusion.
 */
export class ReplayActorRecoveryGate{
 private entries=new Map<VideoActorId,Entry>(IDS.map(id=>[id,start()]));
 private lastReason='Belum direset';
 private lastResetAtMs:number|null=null;
 private resets=0;
 private stableFrames=0;
 private droppedFrames=0;
 private ambiguousFrames=0;
 private lastVisible:VideoActorId[]=[];
 private lastConfidence=0;
 private lastSeparation:number|null=null;
 private lastState:'waiting'|'warming'|'stable'|'partial'|'ambiguous'|'locked'='waiting';
 private lastStatus='';
 reset(reason:string,atMs:number|null=null){
  this.entries=new Map(IDS.map(id=>[id,start()]));
  this.lastReason=reason;this.lastResetAtMs=atMs;this.resets++;
  this.lastVisible=[];this.lastConfidence=0;this.lastSeparation=null;
  this.lastState='waiting';this.lastStatus=reason;
 }
 observe(people:ReplayOverlayPerson[],actors:VideoActorState[]):ReplayOverlayPerson[]{
  const output:ReplayOverlayPerson[]=[];
  const duplicates=new Set<VideoActorId>();
  const seen=new Set<VideoActorId>();
  for(const person of people){
   if(seen.has(person.id))duplicates.add(person.id);
   seen.add(person.id);
  }
  const first=people.find(p=>p.id==='A'),second=people.find(p=>p.id==='B');
  const a=first?.landmarks[23],b=second?.landmarks[23];
  const close=!!a&&!!b&&[a.x,a.y,b.x,b.y].every(Number.isFinite)&&
   Math.hypot(a.x-b.x,a.y-b.y)<MIN_SPACING;
  this.lastSeparation=first&&second&&a&&b&&[a.x,a.y,b.x,b.y].every(Number.isFinite)?
   Math.hypot(a.x-b.x,a.y-b.y):null;
  this.lastVisible=actors.filter(a=>a.presence==='visible').map(a=>a.id);
  this.lastConfidence=0;
  for(const id of IDS){
   const entry=this.entries.get(id)!;
   const actor=actors.find(a=>a.id===id);
   const person=people.find(p=>p.id===id);
   const valid=!!person&&actor?.presence==='visible'&&
    !duplicates.has(id)&&!close&&Number.isFinite(person.confidence)&&
    person.confidence>=MIN_CONFIDENCE;
   if(!valid){
    entry.streak=0;entry.approved=false;
    const observed=actor?.presence;
    entry.state=observed==='lost'?'lost':observed==='occluded'?'occluded':
     observed==='reacquiring'?'reacquiring':
     observed==='uncertain'||duplicates.has(id)||close?'uncertain':'waiting';
    entry.reason=label(id,entry.state);
   }else{
    entry.streak=Math.min(REQUIRED,entry.streak+1);
    entry.lastSeenAtMs=actor!.lastSeenAtMs;
    entry.approved=entry.streak>=REQUIRED;
    entry.state=entry.approved?'stable':'warming';
    entry.reason=entry.approved?label(id,'stable'):
     id+' stabil '+entry.streak+'/'+REQUIRED;
    if(entry.approved){output.push(person!);
     this.lastConfidence=this.lastConfidence===0?
      person!.confidence:Math.min(this.lastConfidence,person!.confidence);}
   }
  }
  const states=IDS.map(id=>this.entries.get(id)!.state);
  if(states.some(s=>s==='uncertain'||s==='reacquiring'))this.ambiguousFrames++;
  if(output.length){this.stableFrames++;
   this.lastState=output.length===2?'stable':'partial';}
  else{
   this.droppedFrames++;
   this.lastState=states.some(s=>s==='uncertain'||s==='reacquiring')?'ambiguous':
    states.some(s=>s==='warming')?'warming':'waiting';
  }
  this.lastStatus=IDS.map(id=>this.entries.get(id)!.reason).join(' · ');
  return output;
 }
 get snapshot():ReplayIdentityQA{
  const perActor:ActorRecoveryStatus[]=IDS.map(id=>{
   const entry=this.entries.get(id)!;
   return {id,state:entry.state,streak:entry.streak,
    approved:entry.approved,lastSeenAtMs:entry.lastSeenAtMs,
    reason:entry.reason};
  });
  return {state:this.lastState,reason:this.lastStatus,
   streak:Math.max(...perActor.map(p=>p.streak)),requiredFrames:REQUIRED,
   visible:[...this.lastVisible],confidence:this.lastConfidence,
   separation:this.lastSeparation,droppedFrames:this.droppedFrames,
   ambiguousFrames:this.ambiguousFrames,stableFrames:this.stableFrames,
   resetCount:this.resets,lastResetReason:this.lastReason,
   lastResetAtMs:this.lastResetAtMs,perActor};
 }
}
