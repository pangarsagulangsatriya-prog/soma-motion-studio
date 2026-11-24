import type {Landmark} from '../../engine/types.ts';

export type LivePerformerId='A'|'B';
export type ActorIdentityState='confirmed'|'partial'|'occluded'|'recovering'|'lost'|'unassigned';
export type PoseAssignment={id:LivePerformerId;pose:Landmark[];center:{x:number;y:number};confidence:number};
export type IdentityFrame={assignments:PoseAssignment[];lost:LivePerformerId[];ambiguous:boolean;reason:string;states?:Record<LivePerformerId,ActorIdentityState>};
type Center={x:number;y:number};
type Anchor='hip'|'knee'|'ankle';
type Observation={pose:Landmark[];anchors:Partial<Record<Anchor,Center>>;confidence:number;center:Center;partial:boolean};
type Track={observation:Observation;velocity:Center;time:number;updates:number};
type Candidate={id:LivePerformerId;index:number;cost:number};
const ids:LivePerformerId[]=['A','B'];
const anchors:Anchor[]=['hip','knee','ankle'];
const close=(a:Center,b:Center)=>Math.hypot(a.x-b.x,a.y-b.y);
const valid=(p:Landmark|undefined):p is Landmark=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&Number.isFinite(p.visibility)&&(p.visibility??0)>=.55;
const pair=(pose:Landmark[],a:number,b:number):Center|undefined=>{
 const l=pose[a],r=pose[b];return valid(l)&&valid(r)?{x:(l.x+r.x)/2,y:(l.y+r.y)/2}:undefined;
};
const locate=(pose:Landmark[]):Observation|null=>{
 if(pose.length<33)return null;
 const points={hip:pair(pose,23,24),knee:pair(pose,25,26),ankle:pair(pose,27,28)};
 // Never compare ankle coordinates directly against a prior hip center.
 const center=points.hip??points.knee??points.ankle;
 if(!center)return null;
 const primary=points.hip?[23,24]:points.knee?[25,26]:[27,28];
 return {pose,anchors:points,center,confidence:Math.min(...primary.map(i=>pose[i].visibility??0)),
  partial:![11,12,23,24].every(i=>valid(pose[i]))};
};
const shared=(a:Observation,b:Observation)=>anchors.find(k=>a.anchors[k]&&b.anchors[k]);
const speed=(v:Center)=>Math.hypot(v.x,v.y);
const predict=(track:Track,k:Anchor,time:number):Center=>{
 const p=track.observation.anchors[k]!;
 const dt=Math.min(.25,Math.max(0,(time-track.time)/1000));
 return {x:p.x+track.velocity.x*dt,y:p.y+track.velocity.y*dt};
};

/** One temporal registry for live A/B. Prediction is used for association
 * only; no synthetic pose or contact is emitted. Completely unobservable
 * crossings remain fail-closed, even after the bodies separate. */
export class TwoPersonIdentityTracker{
 private known=new Map<LivePerformerId,Track>();
 private detected=new Set<LivePerformerId>();
 private identityLocked=false;
 private crossingSince:number|null=null;
 private lastTime=-1;
 readonly gate=.23;
 readonly separation=.115;
 readonly ambiguityMargin=.055;
 readonly staleMs=420;
 readonly recoveryMs=850;
 reset(){this.known.clear();this.detected.clear();this.identityLocked=false;this.crossingSince=null;this.lastTime=-1;}
 private states(time:number,assignments:PoseAssignment[]):Record<LivePerformerId,ActorIdentityState>{
  return Object.fromEntries(ids.map(id=>{
   const t=this.known.get(id);
   const assigned=assignments.some(a=>a.id===id);
   return [id,assigned?(t?.observation.partial?'partial':'confirmed'):
    !t?'unassigned':time-t.time>this.recoveryMs?'lost':
    this.crossingSince!==null?'recovering':'occluded'];
  })) as Record<LivePerformerId,ActorIdentityState>;
 }
 private cost(t:Track,o:Observation,time:number):number{
  const age=time-t.time,k=shared(t.observation,o);
  if(!k||age<0||age>this.recoveryMs)return Infinity;
  const prev=t.observation.anchors[k]!,next=o.anchors[k]!;
  const distance=close(predict(t,k,time),next);
  const allowed=age>this.staleMs?this.gate*.65:this.gate;
  if(distance>allowed||close(prev,next)>this.gate+Math.min(.20,speed(t.velocity)*age/1000))return Infinity;
  // Compare observed hip-to-knee length only when both anchors exist.
  const a=t.observation.anchors,b=o.anchors;
  const shape=a.hip&&a.knee&&b.hip&&b.knee?
   Math.min(.06,Math.abs(close(a.hip,a.knee)-close(b.hip,b.knee))*.25):0;
  return distance+shape+(k==='hip'?0:.015);
 }
 private canPredictCrossing(found:Observation[],time:number):boolean{
  const a=this.known.get('A'),b=this.known.get('B');
  if(!a||!b||a.updates<2||b.updates<2||time-a.time>250||time-b.time>250)return false;
  const k=shared(a.observation,b.observation);
  if(!k||!found.every(o=>o.anchors[k]))return false;
  const ap=a.observation.anchors[k]!,bp=b.observation.anchors[k]!;
  const dx=bp.x-ap.x,dy=bp.y-ap.y;
  const closing=dx*(a.velocity.x-b.velocity.x)+dy*(a.velocity.y-b.velocity.y);
  return closing>0&&speed(a.velocity)>.08&&speed(b.velocity)>.08&&
   close(predict(a,k,time),predict(b,k,time))<this.separation+.055;
 }
 observe(poses:Landmark[][],time:number):IdentityFrame{
  if(!Number.isFinite(time)||time<0)throw Error('Waktu frame tidak valid.');
  const finish=(assignments:PoseAssignment[],ambiguous:boolean,reason:string):IdentityFrame=>{
   const current=new Set(assignments.map(a=>a.id)),lost=ids.filter(id=>this.detected.has(id)&&!current.has(id));
   this.detected=current;
   return {assignments,lost,ambiguous,reason,states:this.states(time,assignments)};
  };
  if(time<=this.lastTime)return {assignments:[],lost:[],ambiguous:true,reason:'Frame identitas tidak berurutan.',states:this.states(this.lastTime,[])};
  this.lastTime=time;
  if(this.identityLocked)return finish([],true,'Persilangan tubuh belum dapat dipisahkan dengan aman. Reset identitas A/B untuk lanjut.');
  if(this.crossingSince!==null&&ids.some(id=>time-(this.known.get(id)?.time??-Infinity)>250)){
   this.identityLocked=true;return finish([],true,'Pemulihan identitas melewati batas waktu. Reset identitas A/B untuk lanjut.');
  }
  const found=poses.map(locate).filter((x):x is Observation=>!!x)
   .sort((a,b)=>a.center.x-b.center.x).slice(0,2);
  const chosen:PoseAssignment[]=[];
  const add=(id:LivePerformerId,index:number)=>{
   const o=found[index],old=this.known.get(id),k=old&&shared(old.observation,o);
   const dt=old?(time-old.time)/1000:0;
   let velocity:Center={x:0,y:0};
   if(old&&k&&dt>0&&dt<=.25){
    const p=old.observation.anchors[k]!,q=o.anchors[k]!;
    const v={x:(q.x-p.x)/dt,y:(q.y-p.y)/dt},scale=Math.min(1,3/Math.max(.001,speed(v)));
    velocity={x:old.velocity.x*.35+v.x*scale*.65,y:old.velocity.y*.35+v.y*scale*.65};
   }
   this.known.set(id,{observation:o,velocity,time,updates:(old?.updates??0)+1});
   chosen.push({id,pose:o.pose,center:o.center,confidence:o.confidence});
  };
  const overlap=found.length===2&&(()=>{const k=shared(found[0],found[1]);return !!k&&close(found[0].anchors[k]!,found[1].anchors[k]!)<this.separation;})();
  if(overlap){
   if(this.known.size&&this.crossingSince===null){
    if(this.canPredictCrossing(found,time))this.crossingSince=time;
    else this.identityLocked=true;
   }
   return finish([],true,this.identityLocked?'Tubuh berdekatan atau saling menutup. Reset identitas A/B untuk lanjut.':'Tubuh berdekatan; menunggu pemulihan A/B.');
  }
  if(!this.known.size){
   // New actor labels require a common anchor and two distinguishable poses
   // when two detections are present. Single initial actor keeps legacy A.
   if(found.length===2&&!shared(found[0],found[1]))return finish([],true,'Menunggu landmark sejenis untuk A/B.');
   found.forEach((_,i)=>add(ids[i],i));
  }else{
   const candidates:Candidate[]=[];
   for(const [id,t] of this.known)for(let i=0;i<found.length;i++){
    const cost=this.cost(t,found[i],time);if(Number.isFinite(cost))candidates.push({id,index:i,cost});
   }
   const get=(id:LivePerformerId,index:number)=>candidates.find(c=>c.id===id&&c.index===index)?.cost??Infinity;
   const straight=get('A',0)+get('B',1),swapped=get('A',1)+get('B',0);
   const both=found.length===2&&this.known.size===2;
   const crossingEvidence=this.crossingSince===null||(()=>{
    const a=this.known.get('A')!,b=this.known.get('B')!,k=shared(a.observation,b.observation);
    return !!k&&found.length===2&&found.every(o=>o.anchors[k])&&
     close(predict(a,k,time),predict(b,k,time))>=this.ambiguityMargin;
   })();
   if(both&&crossingEvidence&&Number.isFinite(Math.min(straight,swapped))&&Math.abs(straight-swapped)>=this.ambiguityMargin){
    if(straight<swapped){add('A',0);add('B',1);}else{add('B',0);add('A',1);}
    this.crossingSince=null;
   }else if(this.crossingSince!==null){
    // During a crossing no partial match may establish a new identity.
    return finish([],true,'Memulihkan identitas A/B dari riwayat gerak.');
   }else if(both&&Number.isFinite(straight)&&Number.isFinite(swapped)){
    if(this.canPredictCrossing(found,time))this.crossingSince=time;else this.identityLocked=true;
    return finish([],true,'Identitas A/B belum dapat dipisahkan.');
   }else{
    // Accept only unambiguous mutual nearest matches; an unmatched actor
    // must not suppress a clearly observed independent performer.
    for(const candidate of candidates.sort((a,b)=>a.cost-b.cost)){
     if(chosen.some(a=>a.id===candidate.id||a.pose===found[candidate.index].pose))continue;
     const competing=candidates.some(c=>c!==candidate&&
      (c.id===candidate.id||c.index===candidate.index)&&c.cost-candidate.cost<this.ambiguityMargin);
     if(!competing)add(candidate.id,candidate.index);
    }
    if(found.length===2&&chosen.length===1&&this.known.size===1){
     const spare=ids.find(id=>!this.known.has(id))!;
     const index=found.findIndex(o=>o.pose!==chosen[0].pose);
     if(index>=0&&shared(found[0],found[1]))add(spare,index);
    }
   }
  }
  chosen.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
  return finish(chosen,chosen.length===0&&found.length>0,chosen.length?
   'Tubuh '+chosen.map(a=>a.id).join(' & ')+' terbaca.':
   found.length?'Identitas belum pasti; tunggu posisi yang dapat dikenali atau reset A/B.':'Menunggu performer memasuki gambar.');
 }
}
