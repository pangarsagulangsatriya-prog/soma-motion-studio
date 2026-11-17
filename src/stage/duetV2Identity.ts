/** SOMA Duet V2 (D2): two persistent trajectory identities.
 * BBoxes use NORMALIZED video coordinates. Tracks never synthesize a pose.
 */
export type DuetId='A'|'B';
export type DuetBox={x:number;y:number;width:number;height:number};
export type DuetPerson={
 box:DuetBox;score:number;trackerId?:number|null;
 /** Normalized 0..1 torso color. This is auxiliary evidence, never an ID. */
 color?:[number,number,number]|null;
};
export type DuetStatus='visible'|'occluded'|'uncertain'|'reacquiring'|'lost'|'not-detected';
export type DuetActor={
 id:DuetId;status:DuetStatus;box:DuetBox|null;score:number;
 observed:boolean;observedIndex:number|null;confidence:number;
 lastSeenAtMs:number|null;reason:string;trackerId:number|null;
};
export type DuetIdentityFrame={
 atMs:number;detectedCount:number;observedCount:number;
 actors:[DuetActor,DuetActor];ambiguous:boolean;
};
type Vec={x:number;y:number};
type Track={
 box:DuetBox;center:Vec;velocity:Vec;lastSeen:number;lastUpdate:number;
 score:number;trackerId:number|null;color:[number,number,number]|null;
 streak:number;pending:DuetPerson|null;
};
const IDS=['A','B'] as const;
const MAX_OCCLUDED_MS=900;
const MIN_SCORE=.16;
const ID_SWITCH_MARGIN=.09;
const GATE=.38;
const midpoint=(box:DuetBox):Vec=>({x:box.x+box.width/2,y:box.y+box.height/2});
const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const finiteBox=(box:DuetBox)=>[box.x,box.y,box.width,box.height].every(Number.isFinite)&&box.width>.03&&box.height>.08;
const colorDistance=(a:[number,number,number]|null,b:[number,number,number]|null)=>
 a&&b?Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])/Math.sqrt(3):null;
export function duetBoxIoU(a:DuetBox,b:DuetBox){
 const x1=Math.max(a.x,b.x),x2=Math.min(a.x+a.width,b.x+b.width);
 const y1=Math.max(a.y,b.y),y2=Math.min(a.y+a.height,b.y+b.height);
 const area=Math.max(0,x2-x1)*Math.max(0,y2-y1);
 const union=a.width*a.height+b.width*b.height-area;
 return union>0?area/union:0;
}
export function expandedDuetRoi(box:DuetBox,padX=.21,padY=.18):DuetBox{
 const w=Math.min(1,box.width*(1+2*padX));
 const h=Math.min(1,box.height*(1+2*padY));
 const x=clamp(box.x-box.width*padX);
 const y=clamp(box.y-box.height*padY);
 return {x:Math.min(x,1-w),y:Math.min(y,1-h),width:w,height:h};
}
/** Letterbox source ROI into fixed model input without stretching a dancer.
 * p.x/y are normalized in the letterboxed model image.
 */
export type DuetLetterbox={x:number;y:number;width:number;height:number;
 imageWidth:number;imageHeight:number};
export function duetLetterbox(roi:DuetBox,sourceWidth:number,sourceHeight:number,
 targetWidth=480,targetHeight=640):DuetLetterbox{
 const sourceW=roi.width*sourceWidth,sourceH=roi.height*sourceHeight;
 const scale=Math.min(targetWidth/sourceW,targetHeight/sourceH);
 const width=sourceW*scale,height=sourceH*scale;
 return {x:(targetWidth-width)/2,y:(targetHeight-height)/2,width,height,
  imageWidth:targetWidth,imageHeight:targetHeight};
}
export function remapDuetLetterboxLandmarks(
 points:readonly {x:number;y:number;z:number;visibility?:number}[],
 roi:DuetBox,pad:DuetLetterbox
){
 return points.map(p=>({
  ...p,
  x:roi.x+((p.x*pad.imageWidth-pad.x)/pad.width)*roi.width,
  y:roi.y+((p.y*pad.imageHeight-pad.y)/pad.height)*roi.height,
  z:p.z*roi.width*pad.imageWidth/pad.width
 }));
}
export function sampleTorsoColor(pixels:ImageData,person:DuetPerson):[number,number,number]|null{
 const {box}=person;
 const w=pixels.width,h=pixels.height;
 // Sample the central chest, avoiding face and lower-leg regions.
 // One color observation is evidence only; lighting can invalidate it.
 const x0=Math.max(0,Math.floor((box.x+box.width*.30)*w));
 const x1=Math.min(w,Math.ceil((box.x+box.width*.70)*w));
 const y0=Math.max(0,Math.floor((box.y+box.height*.17)*h));
 const y1=Math.min(h,Math.ceil((box.y+box.height*.45)*h));
 if(x0>=x1||y0>=y1)return null;
 const samples:[number,number,number][]=[];
 for(let y=y0;y<y1;y+=Math.max(1,Math.floor((y1-y0)/4))){
  for(let x=x0;x<x1;x+=Math.max(1,Math.floor((x1-x0)/4))){
   const i=(y*w+x)*4;if(pixels.data[i+3]<180)continue;
   const r=pixels.data[i]/255,g=pixels.data[i+1]/255,b=pixels.data[i+2]/255;
   const light=Math.max(r,g,b);
   if(light>.94||light<.075)continue;
   samples.push([r,g,b]);
  }
 }
 if(!samples.length)return null;
 // Median is less affected by background pixels than a simple mean.
 return [0,1,2].map(channel=>{
  const values=samples.map(p=>p[channel]).sort((a,b)=>a-b);
  return values[Math.floor(values.length/2)];
 }) as [number,number,number];
}
export class DuetIdentityManager{
 private tracks=new Map<DuetId,Track>();
 private lastAt=-1;
 reset(){this.tracks.clear();this.lastAt=-1;}
 private predicted(id:DuetId,atMs:number):Vec{
  const t=this.tracks.get(id)!;
  const dt=Math.max(0,Math.min(.45,(atMs-t.lastUpdate)/1000));
  return {x:t.center.x+t.velocity.x*dt,y:t.center.y+t.velocity.y*dt};
 }
 private cost(id:DuetId,p:DuetPerson,atMs:number){
  const t=this.tracks.get(id)!;
  const age=atMs-t.lastSeen;
  if(age>2400)return Infinity;
  const predicted=this.predicted(id,atMs);
  const d=dist(predicted,midpoint(p.box));
  if(d>GATE)return Infinity;
  const scale=Math.max(.03,Math.hypot(t.box.width,t.box.height));
  const displacement=d/(scale*2);
  const sizePenalty=Math.abs(Math.log(Math.max(.08,p.box.width)/Math.max(.08,t.box.width)))*.13;
  const appearance=colorDistance(t.color,p.color??null);
  const colorPenalty=appearance===null?0:appearance*.36;
  const trackerBonus=p.trackerId!=null&&p.trackerId===t.trackerId?-.12:0;
  return displacement+sizePenalty+colorPenalty+trackerBonus;
 }
 private accept(id:DuetId,p:DuetPerson,atMs:number,pending=false){
  const old=this.tracks.get(id),center=midpoint(p.box);
  let velocity=old?.velocity??{x:0,y:0};
  if(old&&!pending){
   const dt=(atMs-old.lastUpdate)/1000;
   if(dt>.005&&dt<.5){
    const instant={x:(center.x-old.center.x)/dt,y:(center.y-old.center.y)/dt};
    velocity={x:velocity.x*.45+instant.x*.55,y:velocity.y*.45+instant.y*.55};
   }
  }
  const streak=pending?(old?.streak??0)+1:0;
  this.tracks.set(id,{box:p.box,center,velocity,lastSeen:atMs,lastUpdate:atMs,
   score:p.score,trackerId:p.trackerId??old?.trackerId??null,
   color:p.color??old?.color??null,streak,pending:pending?p:null});
 }
 /**
  * Cost-based bipartite matching. Crossing, occlusion and invalid detections
  * retain a named track but never publish a guessed body as 'visible'.
  */
 observe(observations:readonly DuetPerson[],atMs:number):DuetIdentityFrame{
  if(!Number.isFinite(atMs)||atMs<0||atMs<=this.lastAt)
   throw Error('Duet identity timestamp must advance.');
  this.lastAt=atMs;
  const detected=observations.map((p,i)=>({p,i})).filter(({p})=>
   p.score>=MIN_SCORE&&finiteBox(p.box)).slice(0,6);
  // Deduplicate almost identical boxes. One person cannot fill both slots.
  const unique=detected.filter(({p},i)=>!detected.slice(0,i).some(o=>
   duetBoxIoU(o.p.box,p.box)>.78)).slice(0,4);
  const chosen=new Map<DuetId,{p:DuetPerson;i:number}>();
  let ambiguous=false;
  if(!this.tracks.size){
   const first=[...unique].sort((a,b)=>midpoint(a.p.box).x-midpoint(b.p.box).x);
   for(let i=0;i<Math.min(2,first.length);i++){
    const id=IDS[i];chosen.set(id,first[i]);this.accept(id,first[i].p,atMs);
   }
  }else{
   // Enumerate all mutually exclusive assignments, including missing actors.
   const ids=IDS.filter(id=>this.tracks.has(id));
   const choices:{items:[DuetId,number][];score:number}[]=[];
   const walk=(at:number,used:Set<number>,items:[DuetId,number][],score:number)=>{
    if(at===ids.length){choices.push({items:[...items],score});return;}
    const id=ids[at];
    walk(at+1,used,items,score+.42);
    for(const item of unique){
     if(used.has(item.i))continue;
     const cost=this.cost(id,item.p,atMs);
     if(!Number.isFinite(cost))continue;
     used.add(item.i);items.push([id,item.i]);
     walk(at+1,used,items,score+cost);
     items.pop();used.delete(item.i);
    }
   };
   walk(0,new Set(),[],0);
   choices.sort((a,b)=>a.score-b.score);
   const best=choices[0];
   const rival=choices.find(v=>v.items.some(([id,i])=>
    best?.items.find(([j])=>j===id)?.[1]!==i))??null;
   const gap=rival?rival.score-best.score:Infinity;
   const ambiguousBoth=ids.length===2&&gap<ID_SWITCH_MARGIN&&
    unique.length>=2;
   if(ambiguousBoth)ambiguous=true;
   // Even when the full pair is ambiguous, keep a single unambiguous
   // actor if that candidate's match cost is much smaller than its rival.
   for(const [id,i] of best?.items??[]){
    const found=unique.find(x=>x.i===i)!;
    const other=IDS.find(j=>j!==id);
    const otherCost=other&&this.tracks.has(other)?this.cost(other,found.p,atMs):Infinity;
    const ownCost=this.cost(id,found.p,atMs);
    if(ambiguousBoth&&otherCost-ownCost<ID_SWITCH_MARGIN)continue;
    const track=this.tracks.get(id);
    if(track&&atMs-track.lastSeen>MAX_OCCLUDED_MS){
     const prev=track.pending,center=midpoint(found.p.box);
     const consistent=prev&&dist(midpoint(prev.box),center)<.18;
     if(!consistent){this.tracks.set(id,{...track,streak:1,pending:found.p});continue;}
     if(track.streak<2){this.tracks.set(id,{...track,streak:track.streak+1,pending:found.p});continue;}
    }
    chosen.set(id,found);this.accept(id,found.p,atMs);
   }
   // A new partner is allowed only when an existing ID match is certain.
   const free=IDS.find(id=>!this.tracks.has(id));
   const used=new Set([...chosen.values()].map(x=>x.i));
   if(free&&chosen.size===1){
    const spare=unique.filter(x=>!used.has(x.i)).sort((a,b)=>b.p.score-a.p.score);
    if(spare.length&&duetBoxIoU(spare[0].p.box,[...chosen.values()][0].p.box)<.48){
     chosen.set(free,spare[0]);this.accept(free,spare[0].p,atMs);
    }
   }
  }
  const actors=IDS.map((id):DuetActor=>{
   const selected=chosen.get(id),track=this.tracks.get(id);
   const gap=track?atMs-track.lastSeen:Infinity;
   const status:DuetStatus=selected?'visible':!track?'not-detected':
    track.pending?'reacquiring':ambiguous&&unique.length?'uncertain':
    gap<=MAX_OCCLUDED_MS?'occluded':'lost';
   return {id,status,box:selected?.p.box??track?.box??null,
    score:selected?.p.score??0,observed:!!selected,
    observedIndex:selected?.i??null,confidence:selected?.p.score??0,
    lastSeenAtMs:track?.lastSeen??null,trackerId:track?.trackerId??null,
    reason:status==='visible'?'Deteksi sesuai lintasan':
     status==='uncertain'?'Kotak orang berpapasan; ID belum pasti':
     status==='reacquiring'?'Memeriksa kesinambungan ID':
     status==='occluded'?'Orang sementara tertutup':'Menunggu deteksi valid'};
  }) as [DuetActor,DuetActor];
  return {atMs,detectedCount:unique.length,observedCount:chosen.size,
   actors,ambiguous:ambiguous||actors.some(a=>a.status==='uncertain')};
 }
}
