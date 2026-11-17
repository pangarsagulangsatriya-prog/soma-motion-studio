import type {Landmark} from '../engine/types.ts';

/**
 * Replay-only, conservative 1–2 actor assignment.
 * Actor labels describe continuous tracks within the current video segment,
 * NOT verified real-world identity. Occluded poses are never synthesized.
 */
export type VideoActorId='A'|'B';
export type VideoActorPresence='not-detected'|'visible'|'occluded'|'uncertain'|'lost';
export type VideoActorState={
 id:VideoActorId;presence:VideoActorPresence;confidence:number;
 rawIndex:number|null;lastSeenAtMs:number|null;
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
type Known={center:Center;atMs:number;confidence:number};
const IDS:VideoActorId[]=['A','B'];
const SEPARATION=.105;
const GATE=.265;
const AMBIGUITY=.055;
const OCCLUSION_MS=900;
const distance=(a:Center,b:Center)=>Math.hypot(a.x-b.x,a.y-b.y);
const valid=(point:Landmark|undefined)=>!!point&&Number.isFinite(point.x)&&
 Number.isFinite(point.y)&&point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1&&
 (point.visibility===undefined||Number.isFinite(point.visibility)&&point.visibility>=.4);

/** Shoulder + hip anchors allow arms and feet to go out of frame independently. */
function locate(pose:Landmark[],rawIndex:number):Candidate|null{
 if(pose.length<33)return null;
 const shoulder=[11,12].filter(i=>valid(pose[i]));
 const hips=[23,24].filter(i=>valid(pose[i]));
 if(!shoulder.length||!hips.length)return null;
 const used=[...shoulder,...hips];
 const confidence=used.reduce((sum,i)=>sum+(pose[i].visibility??.7),0)/used.length;
 if(confidence<.5)return null;
 const mean=(indices:number[],axis:'x'|'y')=>
  indices.reduce((sum,i)=>sum+pose[i][axis],0)/indices.length;
 return {rawIndex,pose,confidence,center:{
  x:(mean(shoulder,'x')+mean(hips,'x'))/2,
  y:(mean(shoulder,'y')+mean(hips,'y'))/2
 }};
}
export const videoActorPresenceLabel=(presence:VideoActorPresence)=>{
 switch(presence){
  case 'visible':return 'Terlihat';
  case 'occluded':return 'Tertutup';
  case 'uncertain':return 'Belum pasti';
  case 'lost':return 'Keluar frame';
  case 'not-detected':return 'Belum ditemukan';
 }
};

export class VideoAutoActorTracker{
 private tracks=new Map<VideoActorId,Known>();
 reset(){this.tracks.clear();}
 observe(poses:Landmark[][],atMs:number):VideoActorFrame{
  if(!Number.isFinite(atMs)||atMs<0)throw Error('Timestamp video tidak valid.');
  const rawCount=poses.filter(p=>p.length>=33).length;
  const found=poses.map((pose,i)=>locate(pose,i))
   .filter((p):p is Candidate=>p!==null).slice(0,2);
  const chosen:VideoActorAssignment[]=[];
  let ambiguous=false;
  const get=(id:VideoActorId,index:number)=>{
   const candidate=found[index];
   this.tracks.set(id,{center:candidate.center,atMs,confidence:candidate.confidence});
   chosen.push({id,rawIndex:candidate.rawIndex,pose:candidate.pose,confidence:candidate.confidence});
  };
  const eligible=(id:VideoActorId,c:Candidate)=>{
   const t=this.tracks.get(id);
   if(!t)return false;
   const threshold=atMs-t.atMs>OCCLUSION_MS?GATE*.68:GATE;
   return distance(t.center,c.center)<=threshold;
  };
  if(found.length===2&&distance(found[0].center,found[1].center)<SEPARATION){
   // Both raw skeletons remain visible in the diagnostic layer.
   ambiguous=true;
  }else if(this.tracks.size===0){
   const sorted=found.map((f,i)=>({f,i})).sort((a,b)=>a.f.center.x-b.f.center.x);
   sorted.forEach(({i},n)=>get(IDS[n],i));
  }else if(this.tracks.size===1){
   const id=this.tracks.has('A')?'A':'B';
   if(found.length===1){
    if(eligible(id,found[0]))get(id,0);
   }else if(found.length===2){
    const d0=distance(this.tracks.get(id)!.center,found[0].center);
    const d1=distance(this.tracks.get(id)!.center,found[1].center);
    const closest=d0<=d1?0:1;
    if(Math.abs(d0-d1)<AMBIGUITY){ambiguous=true;}
    else if(eligible(id,found[closest])){
     get(id,closest);
     const spare=IDS.find(other=>!this.tracks.has(other));
     if(spare)get(spare,closest===0?1:0);
    }
   }
  }else{
   const a=this.tracks.get('A')!,b=this.tracks.get('B')!;
   if(found.length===2){
    const direct=eligible('A',found[0])&&eligible('B',found[1])?
     distance(a.center,found[0].center)+distance(b.center,found[1].center):Infinity;
    const swapped=eligible('A',found[1])&&eligible('B',found[0])?
     distance(a.center,found[1].center)+distance(b.center,found[0].center):Infinity;
    if(Number.isFinite(direct)&&Number.isFinite(swapped)&&
     Math.abs(direct-swapped)<AMBIGUITY)ambiguous=true;
    else if(direct<swapped){get('A',0);get('B',1);}
    else if(swapped<direct){get('A',1);get('B',0);}
    else {
     // A may remain visible even when B has no trustworthy assignment.
     const options=IDS.flatMap(id=>found.flatMap((f,index)=>
      eligible(id,f)?[{id,index,d:distance(this.tracks.get(id)!.center,f.center)}]:[]))
      .sort((x,y)=>x.d-y.d);
     if(options.length){
      const best=options[0];
      const competing=options.find(x=>x.index===best.index&&x.id!==best.id);
      const competingOther=options.find(x=>x.id===best.id&&x.index!==best.index);
      if((competing&&Math.abs(competing.d-best.d)<AMBIGUITY)||
       (competingOther&&Math.abs(competingOther.d-best.d)<AMBIGUITY))ambiguous=true;
      else get(best.id,best.index);
     }
    }
   }else if(found.length===1){
    const da=distance(a.center,found[0].center),db=distance(b.center,found[0].center);
    const nearest=da<=db?'A':'B';
    if(Math.abs(da-db)<AMBIGUITY&&eligible('A',found[0])&&eligible('B',found[0]))
     ambiguous=true;
    else if(eligible(nearest,found[0]))get(nearest,0);
   }
  }
  const actors=IDS.map((id):VideoActorState=>{
   const matched=chosen.find(c=>c.id===id);
   const known=this.tracks.get(id);
   const age=known===undefined?Infinity:atMs-known.atMs;
   return {id,rawIndex:matched?.rawIndex??null,
    confidence:matched?.confidence??0,
    lastSeenAtMs:known?.atMs??null,
    presence:matched?'visible':!known?'not-detected':
     ambiguous?'uncertain':age>OCCLUSION_MS?'lost':'occluded'};
  });
  const visibleCount=chosen.length;
  return {detectedCount:Math.min(2,rawCount),
   knownCount:this.tracks.has('B')?2:1,visibleCount,actors,
   assignments:chosen,ambiguous,
   reason:ambiguous?'Identitas belum pasti; pertahankan pose mentah tanpa menghubungkan event.':
    visibleCount===2?'Dua aktor terlacak.':
    visibleCount===1?'Satu aktor terlacak; aktor lain mungkin tertutup.':
    found.length?'Pose terbaca, identitas belum cocok.':'Menunggu tubuh masuk frame.'};
 }
}
