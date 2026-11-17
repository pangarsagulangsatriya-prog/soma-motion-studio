import type {ReplayOverlayPerson} from './VideoPoseGaitEngine.ts';

export type ReplayIdentityState='waiting'|'warming'|'stable'|'partial'|'ambiguous'|'locked';
export type ReplayIdentityQA={
 state:ReplayIdentityState;reason:string;streak:number;requiredFrames:number;
 visible:('A'|'B')[];confidence:number;separation:number|null;
 droppedFrames:number;ambiguousFrames:number;stableFrames:number;
 resetCount:number;lastResetReason:string;lastResetAtMs:number|null;
};
const minConfidence=.65;
const minSeparation=.115;
const requiredFrames=3;
const point=(p:ReplayOverlayPerson)=>{
 const a=p.landmarks[23],b=p.landmarks[24];
 return a&&b&&Number.isFinite(a.x)&&Number.isFinite(b.x)&&Number.isFinite(a.y)&&Number.isFinite(b.y)?
  {x:(a.x+b.x)/2,y:(a.y+b.y)/2}:null;
};
export function checkIdentityObservation(
 people:ReplayOverlayPerson[],count:1|2,ambiguous:boolean
):{valid:boolean;reason:string;confidence:number;separation:number|null}{
 if(ambiguous)return {valid:false,reason:'Pelacak identitas mendeteksi persilangan atau pasangan ambigu.',confidence:0,separation:null};
 if(people.length!==count||new Set(people.map(p=>p.id)).size!==count||
  !people.some(p=>p.id==='A')||(count===2&&!people.some(p=>p.id==='B')))
  return {valid:false,reason:'Jumlah atau identitas performer belum lengkap.',confidence:0,separation:null};
 const confidence=Math.min(...people.map(p=>Number.isFinite(p.confidence)?p.confidence:0));
 if(confidence<minConfidence)return {valid:false,reason:'Keyakinan pose terlalu rendah untuk mengunci identitas.',confidence,separation:null};
 if(count===1)return {valid:true,reason:'Pose A terbaca.',confidence,separation:null};
 const a=point(people.find(p=>p.id==='A')!);
 const b=point(people.find(p=>p.id==='B')!);
 if(!a||!b)return {valid:false,reason:'Pinggul performer A/B belum dapat dibaca.',confidence,separation:null};
 const separation=Math.hypot(a.x-b.x,a.y-b.y);
 if(separation<minSeparation)return {valid:false,reason:'Tubuh terlalu rapat; identitas A/B ditahan.',confidence,separation};
 return {valid:true,reason:'Identitas A/B dapat dibedakan.',confidence,separation};
}
/** Replay-only gate. A single invalid frame clears the warm-up streak.
 * A detected crossing locks two-person output until explicit reset/seek. */
export class ReplayIdentityGate{
 private streak=0;
 private locked=false;
 private state:ReplayIdentityState='waiting';
 private reason='Menunggu pose video.';
 private confidence=0;
 private separation:number|null=null;
 private visible:('A'|'B')[]=[];
 private droppedFrames=0;
 private ambiguousFrames=0;
 private stableFrames=0;
 private resetCount=0;
 private lastResetReason='Belum direset.';
 private lastResetAtMs:number|null=null;
 reset(reason:string,atMs:number|null=null){
  this.streak=0;this.locked=false;this.state='waiting';
  this.reason=reason;this.visible=[];this.confidence=0;this.separation=null;
  this.resetCount++;this.lastResetReason=reason;this.lastResetAtMs=atMs;
 }
 observe(people:ReplayOverlayPerson[],count:1|2,ambiguous:boolean):boolean{
  this.visible=people.map(p=>p.id);
  const result=checkIdentityObservation(people,count,ambiguous);
  this.confidence=result.confidence;this.separation=result.separation;
  if(ambiguous&&count===2){this.locked=true;this.ambiguousFrames++;}
  if(this.locked){
   this.streak=0;this.state='locked';
   this.reason='Identitas A/B terkunci karena crossing/occlusion. Gunakan Reset identitas atau seek.';
   this.droppedFrames++;return false;
  }
  if(!result.valid){
   this.streak=0;this.state=ambiguous?'ambiguous':people.length?'partial':'waiting';
   this.reason=result.reason;this.droppedFrames++;return false;
  }
  this.streak=Math.min(requiredFrames,this.streak+1);
  this.state=this.streak===requiredFrames?'stable':'warming';
  this.reason=this.state==='stable'?result.reason:
   'Menstabilkan pose '+this.streak+'/'+requiredFrames+' frame.';
  if(this.state==='stable'){this.stableFrames++;return true;}
  return false;
 }
 get snapshot():ReplayIdentityQA{
  return {state:this.state,reason:this.reason,streak:this.streak,requiredFrames,
   visible:[...this.visible],confidence:this.confidence,separation:this.separation,
   droppedFrames:this.droppedFrames,ambiguousFrames:this.ambiguousFrames,
   stableFrames:this.stableFrames,resetCount:this.resetCount,
   lastResetReason:this.lastResetReason,lastResetAtMs:this.lastResetAtMs};
 }
}
