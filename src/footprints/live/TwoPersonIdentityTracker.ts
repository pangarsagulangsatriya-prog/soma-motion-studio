import type {Landmark} from '../../engine/types.ts';

export type LivePerformerId='A'|'B';
export type PoseAssignment={id:LivePerformerId;pose:Landmark[];center:{x:number;y:number};confidence:number};
export type IdentityFrame={assignments:PoseAssignment[];lost:LivePerformerId[];ambiguous:boolean;reason:string};
type Center={x:number;y:number};
type Track={position:Center;time:number};
const ids:LivePerformerId[]=['A','B'];
const close=(a:Center,b:Center)=>Math.hypot(a.x-b.x,a.y-b.y);
const valid=(p:Landmark|undefined,minimum=.52)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??0)>=minimum;
/** Truncated heads/one shoulder are common in wide HP cameras.
 * Accept 3/4 torso landmarks with both hips OR two shoulders + one hip.
 * Never assign an ID from legs only, and never extrapolate landmarks. */
const locate=(pose:Landmark[]):{center:Center;confidence:number;pose:Landmark[]}|null=>{
 if(pose.length<33)return null;
 const shoulders=[11,12].filter(i=>valid(pose[i]));
 const hips=[23,24].filter(i=>valid(pose[i]));
 if(shoulders.length+hips.length<3||hips.length<1)return null;
 const anchors=hips.length===2?hips:shoulders;
 const center={
  x:anchors.reduce((sum,i)=>sum+pose[i].x,0)/anchors.length,
  y:anchors.reduce((sum,i)=>sum+pose[i].y,0)/anchors.length
 };
 const confidence=[...shoulders,...hips].reduce(
  (sum,i)=>sum+(pose[i].visibility??0),0)/(shoulders.length+hips.length);
 return {center,confidence,pose};
};

/**
 * Two-person identity assignment over MediaPipe's existing poses[].
 * The model does not provide persistent person IDs. This gate deliberately
 * suppresses crossed/ambiguous matches instead of silently swapping A and B.
 * Explicit RESET required after losing both people far from their last places.
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
  let ambiguous=false;
  const chosen:PoseAssignment[]=[];
  const add=(id:LivePerformerId,index:number)=>{
   const f=found[index];current.add(id);
   this.known.set(id,{position:f.center,time});
   chosen.push({id,center:f.center,pose:f.pose,confidence:f.confidence});
  };
  if(found.length===2&&close(found[0].center,found[1].center)<this.separation){
   ambiguous=true;
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
     ambiguous=true;
    }else if(straight<swapped){add('A',0);add('B',1);}
    else if(swapped<straight){add('B',0);add('A',1);}
    else {
     // Only one identifiable track may survive an occlusion.
     const byDistance=candidates.sort((a,b)=>a.distance-b.distance);
     if(byDistance.length===1)add(byDistance[0].id,byDistance[0].index);
     else ambiguous=true;
    }
   }else {
    candidates.sort((a,b)=>a.distance-b.distance);
    const best=candidates[0],second=candidates.find(c=>c.id!==best?.id&&c.index===best?.index);
    if(best&&!(second&&Math.abs(second.distance-best.distance)<this.ambiguityMargin))add(best.id,best.index);
    else if(found.length)ambiguous=true;
    if(found.length===2&&chosen.length===1){
     const spare=ids.find(id=>!this.known.has(id));
     const remaining=[0,1].find(i=>i!==candidates[0]?.index);
     if(spare&&remaining!==undefined)add(spare,remaining);
    }
   }
  }
  if(ambiguous)this.identityLocked=true;
  this.detected=ambiguous?new Set<LivePerformerId>():current;
  return {assignments:ambiguous?[]:chosen,
   lost:ids.filter(id=>previous.has(id)&&(!current.has(id)||ambiguous)),
   ambiguous,
   reason:ambiguous?'Tubuh berdekatan atau saling menutup. Reset identitas A/B untuk lanjut.':
    chosen.length?'Tubuh '+chosen.map(x=>x.id).join(' & ')+' terbaca.':
    found.length?'Identitas belum pasti. Kembalikan tubuh ke posisi terakhir atau reset identitas.':
    'Menunggu performer memasuki gambar.'};
 }
}
