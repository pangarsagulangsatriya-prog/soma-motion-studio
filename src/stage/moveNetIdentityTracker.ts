/** D2 MoveNet two-performer identity gate. A/B labels one clip, not a person outside the clip. */
export type D2Id='A'|'B';
export type D2Presence='not-detected'|'visible'|'occluded'|'uncertain'|'reacquiring'|'lost';
export type D2Point={x:number;y:number;score?:number;name?:string};
export type D2Box={xMin:number;yMin:number;width:number;height:number};
export type D2Pose={score?:number;box?:D2Box;keypoints:D2Point[]};
export type D2Center={x:number;y:number};
export type D2Match={id:D2Id;rawIndex:number;box:D2Box|null;center:D2Center;confidence:number;appearanceDistance:number|null};
export type D2State={id:D2Id;presence:D2Presence;rawIndex:number|null;confidence:number;recoveryFrames:number;lastSeenAtMs:number|null};
export type D2Frame={atMs:number;detectedCount:number;held:boolean;reason:string;actors:D2State[];assignments:D2Match[];recovered:D2Id[]};
type Candidate={rawIndex:number;box:D2Box|null;center:D2Center;confidence:number;appearance:number[]|null};
type Track={center:D2Center;velocity:D2Center;box:D2Box|null;appearance:number[]|null;atMs:number};
type Pending={center:D2Center;atMs:number;streak:number};
const IDS=['A','B'] as const;
const HOLD_SEPARATION=.09,OVERLAP_LIMIT=.2,MATCH_GATE=.32,MARGIN=.12,RECOVERY_STREAK=3;
const finite=(x:number)=>Number.isFinite(x);
const d=(a:D2Center,b:D2Center)=>Math.hypot(a.x-b.x,a.y-b.y);
const valid=(p:D2Point|undefined)=>Boolean(p&&finite(p.x)&&finite(p.y)&&(p.score??.8)>=.25);
function boxFor(pose:D2Pose):D2Box|null{
 const b=pose.box;
 if(b&&[b.xMin,b.yMin,b.width,b.height].every(finite)&&b.width>2&&b.height>2)return b;
 const pts=pose.keypoints.filter(valid);
 if(pts.length<6)return null;
 const x=pts.map(p=>p.x),y=pts.map(p=>p.y);
 return {xMin:Math.min(...x),yMin:Math.min(...y),width:Math.max(...x)-Math.min(...x),height:Math.max(...y)-Math.min(...y)};
}
function iou(a:D2Box|null,b:D2Box|null):number{
 if(!a||!b)return 0;
 const w=Math.max(0,Math.min(a.xMin+a.width,b.xMin+b.width)-Math.max(a.xMin,b.xMin));
 const h=Math.max(0,Math.min(a.yMin+a.height,b.yMin+b.height)-Math.max(a.yMin,b.yMin));
 const intersection=w*h,union=a.width*a.height+b.width*b.height-intersection;
 return union>0?intersection/union:0;
}
/** 16-bin normalized torso chroma histogram, sampled inside the shoulder/hip quadrilateral. */
export function moveNetTorsoAppearance(pose:D2Pose,image:ImageData):number[]|null{
 const k=pose.keypoints;
 if(![5,6,11,12].every(i=>valid(k[i])))return null;
 const bins=Array<number>(16).fill(0);
 let n=0;
 for(let yi=0;yi<9;yi++)for(let xi=0;xi<9;xi++){
  const t=.23+.53*yi/8,u=.25+.5*xi/8;
  const x=Math.round((k[5].x*(1-t)+k[11].x*t)*(1-u)+(k[6].x*(1-t)+k[12].x*t)*u);
  const y=Math.round((k[5].y*(1-t)+k[11].y*t)*(1-u)+(k[6].y*(1-t)+k[12].y*t)*u);
  if(x<0||y<0||x>=image.width||y>=image.height)continue;
  const i=(y*image.width+x)*4;
  if(image.data[i+3]<220)continue;
  const r=image.data[i]/255,g=image.data[i+1]/255,b=image.data[i+2]/255;
  const top=Math.max(r,g,b),bottom=Math.min(r,g,b),range=top-bottom;
  let bin:number;
  if(range<.11)bin=12+Math.min(3,Math.floor(top*4));
  else{
   let hue=top===r?((g-b)/range)%6:top===g?(b-r)/range+2:(r-g)/range+4;
   if(hue<0)hue+=6;
   bin=Math.min(11,Math.floor(hue*2));
  }
  bins[bin]++;n++;
 }
 return n<18?null:bins.map(v=>v/n);
}
function colorDistance(a:number[]|null,b:number[]|null):number|null{
 if(!a||!b)return null;
 const bc=a.reduce((s,v,i)=>s+Math.sqrt(v*b[i]),0);
 return Math.sqrt(Math.max(0,1-Math.min(1,bc)));
}
function candidate(pose:D2Pose,index:number,width:number,height:number,appearance:number[]|null,threshold:number):Candidate|null{
 if(pose.keypoints.length<13||(pose.score??0)<threshold)return null;
 const box=boxFor(pose);if(!box)return null;
 const ids=[5,6,11,12].filter(i=>valid(pose.keypoints[i]));
 const center=ids.length>=2?{
  x:ids.reduce((s,i)=>s+pose.keypoints[i].x,0)/ids.length/width,
  y:ids.reduce((s,i)=>s+pose.keypoints[i].y,0)/ids.length/height
 }:{x:(box.xMin+box.width/2)/width,y:(box.yMin+box.height/2)/height};
 return {rawIndex:index,box,center,confidence:pose.score??0,
  appearance};
}
export const d2PresenceLabel=(s:D2Presence):string=>({
 'not-detected':'Belum terdeteksi',visible:'Visible',occluded:'Occluded',
 uncertain:'Uncertain',reacquiring:'Reacquiring',lost:'Lost'
})[s];
export class MoveNetIdentityTracker{
 private tracks=new Map<D2Id,Track>();
 private pending=new Map<D2Id,Pending>();
 private holdSet=new Set<D2Id>();
 private lastTime=-1;
 // Preserve a crossing quarantine until the original A/B tracks are recovered.
 private crossingActive=false;
 reset(){this.tracks.clear();this.pending.clear();this.holdSet.clear();
  this.crossingActive=false;this.lastTime=-1;}
 private predicted(id:D2Id,time:number):D2Center{
  const t=this.tracks.get(id)!;
  const dt=Math.min(.5,Math.max(0,(time-t.atMs)/1000));
  return {x:t.center.x+t.velocity.x*dt,y:t.center.y+t.velocity.y*dt};
 }
 private cost(id:D2Id,c:Candidate,time:number):number{
  const t=this.tracks.get(id);if(!t)return Infinity;
  const age=time-t.atMs;
  if(age>2200)return Infinity; // No guessing after prolonged departure.
  const shift=d(this.predicted(id,time),c.center);
  if(shift>MATCH_GATE)return Infinity;
  const color=colorDistance(t.appearance,c.appearance);
  const scale=t.box&&c.box?Math.abs(Math.log((c.box.height+1)/(t.box.height+1)))*.05:0;
  return shift+(color??.09)*.9+scale;
 }
 private commit(id:D2Id,c:Candidate,time:number,assigned:D2Match[],recovered:D2Id[]){
  const old=this.tracks.get(id);
  if(old&&time-old.atMs>480)this.holdSet.add(id);
  if(old&&this.holdSet.has(id)){
   const pending=this.pending.get(id);
   const validHistory=pending&&time-pending.atMs<=260&&d(pending.center,c.center)<.15;
   const streak=validHistory?pending.streak+1:1;
   this.pending.set(id,{center:c.center,atMs:time,streak});
   if(streak<RECOVERY_STREAK)return;
   recovered.push(id);
  }
  let velocity=old?.velocity??{x:0,y:0};
  if(old){
   const dt=(time-old.atMs)/1000;
   if(dt>.005&&dt<.3){
    velocity={x:velocity.x*.35+(c.center.x-old.center.x)/dt*.65,
     y:velocity.y*.35+(c.center.y-old.center.y)/dt*.65};
   }
  }
  let appearance=c.appearance??old?.appearance??null;
  if(old?.appearance&&c.appearance)
   appearance=old.appearance.map((v,i)=>v*.85+c.appearance![i]*.15);
  this.tracks.set(id,{center:c.center,velocity,box:c.box,appearance,atMs:time});
  this.pending.delete(id);this.holdSet.delete(id);
  assigned.push({id,rawIndex:c.rawIndex,box:c.box,center:c.center,
   confidence:c.confidence,appearanceDistance:old?colorDistance(old.appearance,c.appearance):null});
 }
 observe(poses:D2Pose[],image:ImageData,time:number,threshold=.3):D2Frame{
  const descriptors=poses.map(pose=>moveNetTorsoAppearance(pose,image));
  return this.observeDescriptors(poses,descriptors,image.width,image.height,time,threshold);
 }
 /** One matching rule across benchmark and primary stage video. */
 observeDescriptors(poses:D2Pose[],descriptors:(number[]|null)[],width:number,height:number,time:number,threshold=.3):D2Frame{
  if(!finite(width)||!finite(height)||width<=0||height<=0)throw Error('D2: dimensi video invalid.');
  if(!finite(time)||time<=this.lastTime)throw Error('D2: waktu frame harus bergerak maju.');
  this.lastTime=time;
  const seen=poses.map((p,i)=>candidate(p,i,width,height,descriptors[i]??null,threshold))
   .filter((c):c is Candidate=>c!==null)
   .sort((a,b)=>b.confidence-a.confidence).slice(0,2);
  const assigned:D2Match[]=[],recovered:D2Id[]=[];
  let held=false,reason='Posisi, kecepatan, dan ciri warna torso.';
  const hold=(ids:readonly D2Id[],message:string,crossing=false)=>{
   held=true;reason=message;
   if(crossing&&this.tracks.size===2)this.crossingActive=true;
   for(const id of ids)if(this.tracks.has(id)){
    this.holdSet.add(id);this.pending.delete(id);
   }
  };
  if(this.tracks.size===0){
   if(seen.length===2&&(d(seen[0].center,seen[1].center)<HOLD_SEPARATION||
      iou(seen[0].box,seen[1].box)>OVERLAP_LIMIT))
    hold(IDS,'Dua torso terlalu dekat untuk memulai A/B.');
   else{
    const ordered=[...seen].sort((a,b)=>a.center.x-b.center.x);
    for(const [i,c] of ordered.entries())this.commit(IDS[i],c,time,assigned,recovered);
   }
  }else if(!seen.length)reason='Pose hilang; riwayat A/B dipertahankan.';
  else if(seen.length===2&&(d(seen[0].center,seen[1].center)<HOLD_SEPARATION||
    iou(seen[0].box,seen[1].box)>OVERLAP_LIMIT))
   hold(IDS,'Torso tumpang tindih; A/B ditahan sampai kembali terpisah.',true);
  else if(this.tracks.size===1){
   const id=this.tracks.has('A')?'A':'B';
   const scored=seen.map((c,i)=>({i,cost:this.cost(id,c,time)}))
    .sort((a,b)=>a.cost-b.cost);
   if(!finite(scored[0].cost)||
      scored.length===2&&scored[1].cost-scored[0].cost<MARGIN)
    hold([id],'Kandidat untuk satu ID belum cukup berbeda.');
   else{
    this.commit(id,seen[scored[0].i],time,assigned,recovered);
    if(seen.length===2&&assigned.some(a=>a.id===id))
     this.commit(id==='A'?'B':'A',seen[1-scored[0].i],time,assigned,recovered);
   }
  }else if(seen.length===1){
   const a=this.cost('A',seen[0],time),b=this.cost('B',seen[0],time);
   const chosen=a<b?'A':'B',other=chosen==='A'?'B':'A';
   const chosenColor=colorDistance(this.tracks.get(chosen)!.appearance,seen[0].appearance);
   const otherColor=colorDistance(this.tracks.get(other)!.appearance,seen[0].appearance);
   // One remaining body during an unresolved crossing cannot establish two
   // identities. Trust it only with strong independent clothing evidence.
   const reliableSingle=!this.crossingActive||
    chosenColor!==null&&otherColor!==null&&otherColor-chosenColor>=.28;
   if(!finite(Math.min(a,b))||Math.abs(a-b)<MARGIN||!reliableSingle)
    hold(IDS,'S0.6.4: satu tubuh saat crossing; menahan ID yang belum pasti.');
   else this.commit(chosen,seen[0],time,assigned,recovered);
  }else{
   const straight=this.cost('A',seen[0],time)+this.cost('B',seen[1],time);
   const crossed=this.cost('A',seen[1],time)+this.cost('B',seen[0],time);
   const margin=Math.abs(straight-crossed);
   // During crossing, compare both original torso signatures and motion
   // histories before assigning a side. Raw detector index can freely flip.
   const a=this.tracks.get('A')!,b=this.tracks.get('B')!;
   const colorA0=colorDistance(a.appearance,seen[0].appearance);
   const colorA1=colorDistance(a.appearance,seen[1].appearance);
   const colorB0=colorDistance(b.appearance,seen[0].appearance);
   const colorB1=colorDistance(b.appearance,seen[1].appearance);
   const hasColor=[colorA0,colorA1,colorB0,colorB1].every(v=>v!==null);
   const colorMargin=hasColor?
    Math.abs((colorA0!+colorB1!)-(colorA1!+colorB0!)):0;
   const distinctClothing=hasColor&&
    (colorDistance(a.appearance,b.appearance)??0)>=.22;
   const reliableMotion=a.velocity.x*b.velocity.x<0&&
    Math.abs(a.velocity.x-b.velocity.x)>.24&&
    time-Math.max(a.atMs,b.atMs)<=850;
   const reIdEvidence=!this.crossingActive||
    (distinctClothing&&colorMargin>=.2)||
    (!hasColor&&reliableMotion&&margin>=.22);
   if(!finite(Math.min(straight,crossed))||margin<MARGIN||!reIdEvidence)
    hold(IDS,'S0.6.4: crossing belum pasti; proyeksi A/B ditahan.');
   else if(straight<crossed){
    this.commit('A',seen[0],time,assigned,recovered);
    this.commit('B',seen[1],time,assigned,recovered);
   }else{
    this.commit('A',seen[1],time,assigned,recovered);
    this.commit('B',seen[0],time,assigned,recovered);
   }
   // Both old identities must complete independent three-frame recovery.
   if(assigned.length===2)this.crossingActive=false;
  }
  const actors=IDS.map((id):D2State=>{
   const a=assigned.find(item=>item.id===id),t=this.tracks.get(id);
   const age=t?time-t.atMs:Infinity;
   const presence:D2Presence=a?'visible':!t?'not-detected':
    this.pending.has(id)?'reacquiring':
    held&&this.holdSet.has(id)?'uncertain':age>1100?'lost':'occluded';
   return {id,presence,rawIndex:a?.rawIndex??null,confidence:a?.confidence??0,
    recoveryFrames:this.pending.get(id)?.streak??0,lastSeenAtMs:t?.atMs??null};
  });
  return {atMs:time,detectedCount:seen.length,
   held:held||actors.some(a=>a.presence==='reacquiring'),
   reason,actors,assignments:assigned,recovered};
 }
}
