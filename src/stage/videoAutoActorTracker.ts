import type {Landmark} from '../engine/types.ts';

/**
 * Per-video A/B paths. These are cautious track labels, not biometric identities.
 * A missing or crossed actor never receives an invented position.
 */
export type VideoActorId='A'|'B';
export type VideoActorPresence='not-detected'|'visible'|'occluded'|'uncertain'|'reacquiring'|'lost';
export type VideoActorState={
 id:VideoActorId;presence:VideoActorPresence;confidence:number;
 rawIndex:number|null;lastSeenAtMs:number|null;
 recoveryFrames?:number;reason?:string;
};
export type VideoActorAssignment={
 id:VideoActorId;rawIndex:number;pose:Landmark[];confidence:number
};
export type VideoActorFrame={
 detectedCount:number;knownCount:1|2;visibleCount:number;
 actors:VideoActorState[];assignments:VideoActorAssignment[];
 ambiguous:boolean;reason:string;
};
type Center={x:number;y:number};
type Candidate={rawIndex:number;pose:Landmark[];center:Center;confidence:number};
type Track={center:Center;velocity:Center;atMs:number;confidence:number;velocitySamples:number};
type Pending={center:Center;atMs:number;streak:number};
const IDS:VideoActorId[]=['A','B'];
const SEPARATION=.105;
const MOTION_CROSSING_MARGIN=.085;
const GATE=.265;
const AMBIGUITY=.055;
const OCCLUSION_MS=900;
const RECOVERY_AFTER_MS=420;
const MAX_REENTRY_MS=4500;
const RECOVERY_FRAMES=3;
const d=(a:Center,b:Center)=>Math.hypot(a.x-b.x,a.y-b.y);
const valid=(point:Landmark|undefined)=>!!point&&Number.isFinite(point.x)&&
 Number.isFinite(point.y)&&point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1&&
 (point.visibility===undefined||Number.isFinite(point.visibility)&&point.visibility>=.27);

function locate(pose:Landmark[],rawIndex:number):Candidate|null{
 if(pose.length<33)return null;
 const shoulders=[11,12].filter(i=>valid(pose[i])),hips=[23,24].filter(i=>valid(pose[i]));
 if(!shoulders.length||!hips.length)return null;
 const used=[...shoulders,...hips];
 const confidence=used.reduce((sum,i)=>sum+(pose[i].visibility??.7),0)/used.length;
 if(confidence<.43)return null;
 const avg=(indices:number[],axis:'x'|'y')=>
  indices.reduce((sum,i)=>sum+pose[i][axis],0)/indices.length;
 return {rawIndex,pose,confidence,center:{
  x:(avg(shoulders,'x')+avg(hips,'x'))/2,
  y:(avg(shoulders,'y')+avg(hips,'y'))/2
 }};
}
export const videoActorPresenceLabel=(presence:VideoActorPresence)=>{
 switch(presence){
  case 'visible':return 'Terlihat';
  case 'occluded':return 'Tertutup';
  case 'uncertain':return 'Belum pasti';
  case 'reacquiring':return 'Memulihkan ID';
  case 'lost':return 'Keluar frame';
  case 'not-detected':return 'Belum ditemukan';
 }
};
export class VideoAutoActorTracker{
 private tracks=new Map<VideoActorId,Track>();
 private pending=new Map<VideoActorId,Pending>();
 private quarantined=new Set<VideoActorId>();
 private unresolvedCrossing=new Set<VideoActorId>();
 private lastAtMs=-1;
 reset(){
  this.tracks.clear();this.pending.clear();this.quarantined.clear();
  this.unresolvedCrossing.clear();this.lastAtMs=-1;
 }
 private predicted(id:VideoActorId,atMs:number):Center{
  const track=this.tracks.get(id)!;
  const pending=this.pending.get(id);
  // Once a candidate path is provisionally traced, use its observed center;
  // it is NOT displayed as a confirmed body until recovery completes.
  if(pending)return pending.center;
  const dt=Math.max(0,Math.min(.6,(atMs-track.atMs)/1000));
  return {x:track.center.x+track.velocity.x*dt,y:track.center.y+track.velocity.y*dt};
 }
 private eligible(id:VideoActorId,part:Candidate,atMs:number):boolean{
  const t=this.tracks.get(id);
  if(!t||atMs-t.atMs>MAX_REENTRY_MS)return false;
  const age=atMs-t.atMs,limit=age>OCCLUSION_MS?GATE*.7:GATE;
  return d(this.predicted(id,atMs),part.center)<=limit;
 }
 private accept(id:VideoActorId,part:Candidate,atMs:number,
  chosen:VideoActorAssignment[]){
  const old=this.tracks.get(id),dt=old?(atMs-old.atMs)/1000:0;
  let velocity=old?.velocity??{x:0,y:0},velocitySamples=old?.velocitySamples??0;
  if(old&&dt>.005&&dt<=.45){
   const instant={x:(part.center.x-old.center.x)/dt,
    y:(part.center.y-old.center.y)/dt};
   velocity=velocitySamples?{
    x:velocity.x*.45+instant.x*.55,y:velocity.y*.45+instant.y*.55
   }:instant;
   velocitySamples++;
  }
  this.tracks.set(id,{center:part.center,atMs,confidence:part.confidence,
   velocity,velocitySamples});
  this.pending.delete(id);this.quarantined.delete(id);
  this.unresolvedCrossing.delete(id);
  chosen.push({id,rawIndex:part.rawIndex,pose:part.pose,confidence:part.confidence});
 }
 private commit(id:VideoActorId,part:Candidate,atMs:number,
  chosen:VideoActorAssignment[]){
  const t=this.tracks.get(id);
  if(!t){this.accept(id,part,atMs,chosen);return;}
  if(atMs-t.atMs>RECOVERY_AFTER_MS)this.quarantined.add(id);
  if(this.unresolvedCrossing.has(id))return;
  if(!this.quarantined.has(id)){this.accept(id,part,atMs,chosen);return;}
  const old=this.pending.get(id);
  const compatible=old&&atMs-old.atMs<=450&&d(old.center,part.center)<=.19;
  const streak=compatible?old.streak+1:1;
  this.pending.set(id,{center:part.center,atMs,streak});
  if(streak>=RECOVERY_FRAMES)this.accept(id,part,atMs,chosen);
 }
 /** Match unambiguous A/B trajectories; ambiguous bodies are visually neutral.
  * Continue processing independently when only one actor is reliable.
  */
 observe(poses:Landmark[][],atMs:number):VideoActorFrame{
  if(!Number.isFinite(atMs)||atMs<0||this.lastAtMs>=atMs)
   throw Error('Timestamp video tidak valid atau mundur.');
  this.lastAtMs=atMs;
  const rawCount=poses.filter(p=>p.length>=33).length;
  const found=poses.map((pose,index)=>locate(pose,index))
   .filter((p):p is Candidate=>p!==null).slice(0,2);
  const chosen:VideoActorAssignment[]=[];
  let ambiguous=false;
  const proposal=new Map<VideoActorId,number>();
  const hold=(ids:VideoActorId[],crossing=false)=>{
   ambiguous=true;
   for(const id of ids){
    if(!this.tracks.has(id))continue;
    this.quarantined.add(id);this.pending.delete(id);
    // Without movement history before crossing, the people cannot be
    // reliably reidentified simply by whichever side they emerge on.
    if(crossing&&this.tracks.get(id)!.velocitySamples<1)
     this.unresolvedCrossing.add(id);
   }
  };
  const near=found.length===2&&
   d(found[0].center,found[1].center)<SEPARATION;
  const canSeparateCrossing=near&&this.tracks.size===2&&
   IDS.every(id=>(this.tracks.get(id)?.velocitySamples??0)>0)&&
   (()=>{const score=(id:VideoActorId,i:number)=>
    d(this.predicted(id,atMs),found[i].center);
    return Math.abs(score('A',0)+score('B',1)-
     score('A',1)-score('B',0))>=MOTION_CROSSING_MARGIN;})();
  // Keep both measured trajectories when the pre-crossing motion supports
  // independent A/B assignments. With weak evidence, hold the labels.
  if(near&&this.tracks.size>0&&!canSeparateCrossing){
   hold(IDS,true);
  }else if(this.tracks.size===0){
   const sorted=found.map((p,i)=>({p,i})).sort((a,b)=>a.p.center.x-b.p.center.x);
   for(const [n,item] of sorted.entries())this.accept(IDS[n],item.p,atMs,chosen);
  }else if(this.tracks.size===1){
   const id=this.tracks.has('A')?'A':'B';
   if(found.length===1){
    if(this.eligible(id,found[0],atMs))proposal.set(id,0);
   }else if(found.length===2){
    const da=d(this.predicted(id,atMs),found[0].center);
    const db=d(this.predicted(id,atMs),found[1].center);
    const index=da<=db?0:1;
    if(Math.abs(da-db)<AMBIGUITY)hold([id]);
    else if(this.eligible(id,found[index],atMs)){
     proposal.set(id,index);
     // Introducing B is safe only when the existing track matches clearly.
     const newId=IDS.find(value=>!this.tracks.has(value));
     if(newId)proposal.set(newId,index===0?1:0);
    }
   }
  }else if(found.length===2){
   const score=(id:VideoActorId,index:number)=>
    this.eligible(id,found[index],atMs)?
     d(this.predicted(id,atMs),found[index].center):Infinity;
   const dA0=score('A',0),dA1=score('A',1),
    dB0=score('B',0),dB1=score('B',1);
   const straight=dA0+dB1,crossed=dA1+dB0;
   if(Number.isFinite(straight)&&Number.isFinite(crossed)&&
    Math.abs(straight-crossed)<AMBIGUITY)hold(IDS,true);
   else if(straight<crossed){proposal.set('A',0);proposal.set('B',1);}
   else if(crossed<straight){proposal.set('A',1);proposal.set('B',0);}
   else {
    // Partial matching is allowed only if a raw observation is uniquely
    // compatible with one actor and that actor has no second close option.
    for(const id of IDS){
     const a=score(id,0),b=score(id,1);
     const pick=a<=b?0:1,first=Math.min(a,b),second=Math.max(a,b);
     const other=id==='A'?'B':'A';
     if(!Number.isFinite(first)||second-first<AMBIGUITY||
      score(other,pick)-first<AMBIGUITY)continue;
     proposal.set(id,pick);
    }
    if(proposal.get('A')!==undefined&&proposal.get('A')===proposal.get('B')){
     proposal.clear();hold(IDS);
    }
   }
  }else if(found.length===1){
   const a=this.eligible('A',found[0],atMs)?
    d(this.predicted('A',atMs),found[0].center):Infinity;
   const b=this.eligible('B',found[0],atMs)?
    d(this.predicted('B',atMs),found[0].center):Infinity;
   if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<AMBIGUITY)
    hold(IDS);
   else if(Number.isFinite(Math.min(a,b)))proposal.set(a<b?'A':'B',0);
  }
  for(const id of IDS){
   const index=proposal.get(id);
   if(index!==undefined)this.commit(id,found[index],atMs,chosen);
  }
  const actors=IDS.map((id):VideoActorState=>{
   const item=chosen.find(a=>a.id===id);
   const known=this.tracks.get(id);
   const pending=this.pending.get(id);
   const age=known?atMs-known.atMs:Infinity;
   const presence:VideoActorPresence=item?'visible':!known?'not-detected':
    pending?'reacquiring':this.unresolvedCrossing.has(id)||ambiguous&&
     this.quarantined.has(id)?'uncertain':age>OCCLUSION_MS?'lost':'occluded';
   return {id,presence,confidence:item?.confidence??0,
    rawIndex:item?.rawIndex??null,lastSeenAtMs:known?.atMs??null,
    recoveryFrames:pending?.streak??0,
    reason:presence==='reacquiring'?'Memeriksa kontinuitas '+pending!.streak+'/'+RECOVERY_FRAMES:
     this.unresolvedCrossing.has(id)?'Persilangan tanpa riwayat arah yang cukup. Reset ID diperlukan.':
     presence==='uncertain'?'Identitas belum terpisah dengan yakin.':''};
  });
  const visibleCount=chosen.length;
  return {
   detectedCount:Math.min(2,rawCount),
   knownCount:this.tracks.has('B')?2:1,visibleCount,actors,
   assignments:chosen,ambiguous:ambiguous||
    actors.some(a=>a.presence==='uncertain'||a.presence==='reacquiring'),
   reason:chosen.length===2?'Dua aktor terlihat dengan identitas konsisten.':
    chosen.length===1?'Aktor yang terlihat tetap ditelusuri; pasangan lainnya diperiksa.':
    actors.some(a=>a.presence==='reacquiring')?'Sedang mencocokkan kembali identitas aktor.':
    actors.some(a=>a.presence==='uncertain')?'Identitas aktor belum pasti; pose mentah tetap tampil.':
    found.length?'Pose tersedia, jalur identitas belum cocok.':'Menunggu tubuh masuk frame.'
  };
 }
}
