import type {Landmark} from '../../engine/types.ts';

export type LivePerformerId='A'|'B';
export type PoseAssignment={id:LivePerformerId;pose:Landmark[];center:{x:number;y:number};confidence:number};
export type IdentityFrame={assignments:PoseAssignment[];lost:LivePerformerId[];ambiguous:boolean;reason:string};
type Center={x:number;y:number};
type Track={position:Center;time:number};
const ids:LivePerformerId[]=['A','B'];
const close=(a:Center,b:Center)=>Math.hypot(a.x-b.x,a.y-b.y);
const valid=(p:Landmark|undefined)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??0)>=.55;
const locate=(pose:Landmark[]):{center:Center;confidence:number;pose:Landmark[]}|null=>{
 if(pose.length<33||![11,12,23,24].every(i=>valid(pose[i])))return null;
 const hip=pose[23],other=pose[24];
 const center={x:(hip.x+other.x)/2,y:(hip.y+other.y)/2};
 const confidence=Math.min(...[11,12,23,24].map(i=>pose[i].visibility??0));
 return {center,confidence,pose};
};

/**
 * Two-person identity assignment over MediaPipe's existing poses[].
 * The model does not provide persistent person IDs. This gate deliberately
 * suppresses crossed/ambiguous matches instead of silently swapping A and B.
 * Initial ambiguity is recoverable before any identity is assigned.
 * Established ambiguous crossings remain fail-closed until explicit reset.
 */
export class TwoPersonIdentityTracker{
 private known=new Map<LivePerformerId,Track>();
 private detected=new Set<LivePerformerId>();
 private identityLocked=false;
 readonly gate=.23;
 readonly separation=.115;
 readonly ambiguityMargin=.055;
 readonly staleMs=420;
 reset(){this.known.clear();this.detected.clear();this.identityLocked=false;}
 observe(poses:Landmark[][],time:number):IdentityFrame{
  if(!Number.isFinite(time)||time<0)throw Error('Waktu frame tidak valid.');
  if(this.identityLocked){
   const lost=[...this.detected];this.detected.clear();
   return {assignments:[],lost,ambiguous:true,
    reason:'Persilangan tubuh belum dapat dipisahkan dengan aman. Reset identitas A/B untuk lanjut.'};
  }
  const found=poses.map(locate).filter((x):x is NonNullable<typeof x>=>!!x)
   .sort((a,b)=>a.center.x-b.center.x).slice(0,2);
  const previous=this.detected;
  const current=new Set<LivePerformerId>();
  let ambiguous=false,competingIdentity=false;
  const chosen:PoseAssignment[]=[];
  const add=(id:LivePerformerId,index:number)=>{
   const f=found[index];current.add(id);
   this.known.set(id,{position:f.center,time});
   chosen.push({id,center:f.center,pose:f.pose,confidence:f.confidence});
  };
  if(found.length===2&&close(found[0].center,found[1].center)<this.separation){
   ambiguous=true;competingIdentity=true;
  }else if(!this.known.size){
   found.forEach((_,i)=>add(ids[i],i));
  }else {
   // Prefer the lowest two-pose assignment, but reject globally ambiguous
   // pairings or sudden teleports. No hard-coded MediaPipe detection indices.
   const candidates:{id:LivePerformerId;index:number;distance:number}[]=[];
   for(const [id,track] of this.known){
    if(time<track.time)continue;
    for(let i=0;i<found.length;i++){
     const distance=close(track.position,found[i].center);
     const allowed=time-track.time>this.staleMs?this.gate*.65:this.gate;
     if(distance<=allowed)candidates.push({id,index:i,distance});
    }
   }
   if(found.length===2&&this.known.size===2){
    const a=candidates.find(c=>c.id==='A'&&c.index===0);
    const b=candidates.find(c=>c.id==='B'&&c.index===1);
    const crossA=candidates.find(c=>c.id==='A'&&c.index===1);
    const crossB=candidates.find(c=>c.id==='B'&&c.index===0);
    const straight=a&&b?a.distance+b.distance:Infinity;
    const swapped=crossA&&crossB?crossA.distance+crossB.distance:Infinity;
    if(Number.isFinite(straight)&&Number.isFinite(swapped)&&Math.abs(straight-swapped)<this.ambiguityMargin){
     ambiguous=true;competingIdentity=true;
    }else if(straight<swapped){add('A',0);add('B',1);}
    else if(swapped<straight){add('B',0);add('A',1);}
    else {
     // Only one identifiable track may survive an occlusion.
     const byDistance=candidates.sort((a,b)=>a.distance-b.distance);
     if(byDistance.length===1)add(byDistance[0].id,byDistance[0].index);
     else {ambiguous=true;competingIdentity=byDistance.length>1;}
    }
   }else {
    candidates.sort((a,b)=>a.distance-b.distance);
    const best=candidates[0],second=candidates.find(c=>c.id!==best?.id&&c.index===best?.index);
    if(best&&!(second&&Math.abs(second.distance-best.distance)<this.ambiguityMargin))add(best.id,best.index);
    else if(found.length){ambiguous=true;competingIdentity=!!best&&!!second;}
    if(found.length===2&&chosen.length===1){
     const spare=ids.find(id=>!this.known.has(id));
     const remaining=[0,1].find(i=>i!==candidates[0]?.index);
     if(spare&&remaining!==undefined)add(spare,remaining);
    }
   }
  }
  // Do not latch a permanent identity fault before A/B have ever been assigned.
  // An initial overlap has no established identity to protect; retry on the next frame.
  if(ambiguous&&competingIdentity&&this.known.size>0)this.identityLocked=true;
  this.detected=ambiguous?new Set<LivePerformerId>():current;
  return {assignments:ambiguous?[]:chosen,
   lost:ids.filter(id=>previous.has(id)&&(!current.has(id)||ambiguous)),
   ambiguous,
   reason:ambiguous?(this.identityLocked?'Tubuh berdekatan atau saling menutup. Reset identitas A/B untuk lanjut.':'Identitas belum pasti; menunggu posisi terpisah atau performer kembali ke posisi terakhir.'):
    chosen.length?'Tubuh '+chosen.map(x=>x.id).join(' & ')+' terbaca.':
    found.length?'Identitas belum pasti. Kembalikan tubuh ke posisi terakhir atau reset identitas.':
    'Menunggu performer memasuki gambar.'};
 }
}
