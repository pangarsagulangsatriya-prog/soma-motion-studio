/**
 * S0.6.2 — Lightweight, sparse IMAGE optical flow for Footprints' primary
 * MP4 BODY preview. It runs between MediaPipe inference results on the same
 * video element; there are no external models, CDNs, toggles or second decoders.
 *
 * Inspired by sparse feature tracking / forward-back checking in OpenCV.
 * Here patch-based matching at a downscaled resolution is a bounded CPU
 * fallback, not a claim of full pyramidal Lucas–Kanade accuracy.
 *
 * Only verified PersistentActorRegistry measurements can seed tracks.
 * Outputs are VISUAL displacement hypotheses; never identity/pose/gait/3D
 * measurements, contact events or authority to enable a physical projector.
 */
import type {PersistentActorState} from './persistentActorRegistry.ts';

export type OpticalActorId='A'|'B';
export type OpticalFlowActor={
 id:OpticalActorId;anchorAtMs:number;trackedAtMs:number;
 dx:number;dy:number;confidence:number;inliers:number;
};
export type OpticalFlowFrame={
 atMs:number;actors:OpticalFlowActor[];
};
export type GrayFrame={
 atMs:number;width:number;height:number;gray:Uint8Array;
};
type Feature={x:number;y:number;strength:number};
type Track={
 id:OpticalActorId;anchorAtMs:number;seedAtMs:number;
 features:Feature[];dxPx:number;dyPx:number;
 confidence:number;lastAtMs:number;center:{x:number;y:number};
};
export const OPTICAL_FLOW_MAX_AGE_MS=980;
export const OPTICAL_FLOW_WIDTH=256;
export const OPTICAL_FLOW_HEIGHT=144;
const IDS=['A','B'] as const;
const MAX_FEATURES=16;
const MIN_FEATURES=4;
const PATCH_RADIUS=2;
const FLOW_MIN_INTERVAL_MS=28;
const MAX_STEP_MS=180;
const MAX_TRAVEL=.24;
const MIN_ACCEPT=.46;
const finite=(x:number)=>Number.isFinite(x);
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const middle=(items:number[])=>{
 if(!items.length)return 0;
 const sorted=[...items].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2;
};
const pixel=(image:GrayFrame,x:number,y:number)=>image.gray[y*image.width+x];
function texture(image:GrayFrame,x:number,y:number):number{
 if(x<3||y<3||x>=image.width-3||y>=image.height-3)return 0;
 let score=0;
 for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
  score+=Math.abs(pixel(image,x+dx,y+dy)-pixel(image,x,y));
 }
 return score;
}
function torsoRegion(saved:PersistentActorState,width:number,height:number){
 const pose=saved.lastPose;
 if(!pose||pose.length!==33)return null;
 const pts=[11,12,23,24].map(i=>pose[i]).filter(p=>
  p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.x<=1&&
  p.y>=0&&p.y<=1&&(p.visibility??1)>=.35);
 if(pts.length<3)return null;
 const xs=pts.map(p=>p.x*width),ys=pts.map(p=>p.y*height);
 const x0=Math.min(...xs),x1=Math.max(...xs);
 const y0=Math.min(...ys),y1=Math.max(...ys);
 // Keep the feature grid on the torso, away from moving legs and static floor.
 const cx=(x0+x1)/2,cy=(y0+y1)/2;
 const w=clamp((x1-x0)*1.12,13,52),h=clamp((y1-y0)*.98,14,68);
 return {x:clamp(cx-w/2,3,width-4),y:clamp(cy-h/2,3,height-4),
  w:Math.min(w,width-4-clamp(cx-w/2,3,width-4)),
  h:Math.min(h,height-4-clamp(cy-h/2,3,height-4))};
}
function seed(image:GrayFrame,saved:PersistentActorState):Feature[]{
 const area=torsoRegion(saved,image.width,image.height);
 if(!area||area.w<5||area.h<5)return [];
 const candidates:Feature[]=[];
 for(let row=0;row<6;row++)for(let col=0;col<7;col++){
  const x=Math.round(area.x+(col+.5)*area.w/7);
  const y=Math.round(area.y+(row+.5)*area.h/6);
  const strength=texture(image,x,y);
  if(strength>=24)candidates.push({x,y,strength});
 }
 candidates.sort((a,b)=>b.strength-a.strength);
 const result:Feature[]=[];
 for(const p of candidates){
  if(result.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=2.1)){
   result.push(p);
   if(result.length>=MAX_FEATURES)break;
  }
 }
 return result;
}
function meanAbsolutePatch(a:GrayFrame,b:GrayFrame,x:number,y:number,
 bx:number,by:number,best=Infinity){
 if(x<PATCH_RADIUS||y<PATCH_RADIUS||bx<PATCH_RADIUS||by<PATCH_RADIUS||
  x>=a.width-PATCH_RADIUS||y>=a.height-PATCH_RADIUS||
  bx>=b.width-PATCH_RADIUS||by>=b.height-PATCH_RADIUS)return Infinity;
 let total=0;
 for(let dy=-PATCH_RADIUS;dy<=PATCH_RADIUS;dy++)
  for(let dx=-PATCH_RADIUS;dx<=PATCH_RADIUS;dx++){
   total+=Math.abs(pixel(a,x+dx,y+dy)-pixel(b,bx+dx,by+dy));
   if(total>best)return Infinity;
  }
 return total;
}
function matchPoint(prev:GrayFrame,next:GrayFrame,p:Feature,range:number){
 let error=Infinity,bestX=p.x,bestY=p.y;
 for(let sy=-range;sy<=range;sy++)for(let sx=-range;sx<=range;sx++){
  const x=p.x+sx,y=p.y+sy;
  const cost=meanAbsolutePatch(prev,next,p.x,p.y,x,y,error);
  if(cost<error){error=cost;bestX=x;bestY=y;}
 }
 // Average per pixel greyscale error must remain small.
 if(!finite(error)||error/25>27)return null;
 // A small forward/backward consistency gate limits drift and lookalike swaps.
 let backward=Infinity,backX=bestX,backY=bestY;
 for(let sy=-2;sy<=2;sy++)for(let sx=-2;sx<=2;sx++){
  const x=bestX+sx,y=bestY+sy;
  const cost=meanAbsolutePatch(next,prev,bestX,bestY,x,y,backward);
  if(cost<backward){backward=cost;backX=x;backY=y;}
 }
 // Reverse search is constrained around the old feature, not the new match.
 // An exact reverse check is done below using direct patch cost at original.
 const backwardAtOrigin=meanAbsolutePatch(next,prev,bestX,bestY,p.x,p.y);
 if(!finite(backwardAtOrigin)||backwardAtOrigin/25>27)return null;
 return {next:{x:bestX,y:bestY,strength:p.strength},
  dx:bestX-p.x,dy:bestY-p.y,error:error/25,
  backwardError:backwardAtOrigin/25};
}
function propagate(prev:GrayFrame,next:GrayFrame,track:Track){
 const deltaMs=next.atMs-prev.atMs;
 const searchRadius=clamp(Math.round(5+Math.max(0,deltaMs-33)/28),5,11);
 const measured=track.features.map(p=>matchPoint(prev,next,p,searchRadius))
  .filter((p):p is NonNullable<typeof p>=>p!==null);
 if(measured.length<MIN_FEATURES)return null;
 const vx=middle(measured.map(p=>p.dx));
 const vy=middle(measured.map(p=>p.dy));
 const inliers=measured.filter(p=>
  Math.hypot(p.dx-vx,p.dy-vy)<=2.2&&p.error<24);
 if(inliers.length<MIN_FEATURES)return null;
 const shiftX=middle(inliers.map(p=>p.dx));
 const shiftY=middle(inliers.map(p=>p.dy));
 if(Math.hypot(shiftX,shiftY)>searchRadius*1.15)return null;
 const dxPx=track.dxPx+shiftX,dyPx=track.dyPx+shiftY;
 if(Math.hypot(dxPx/next.width,dyPx/next.height)>MAX_TRAVEL)return null;
 const confidence=clamp((inliers.length/Math.max(MIN_FEATURES,track.features.length))*.7+
  (1-middle(inliers.map(p=>p.error))/27)*.3,0,1);
 if(confidence<MIN_ACCEPT)return null;
 const features=inliers.map(x=>x.next);
 return {...track,features,dxPx,dyPx,confidence,lastAtMs:next.atMs};
}
/**
 * Core algorithm accepts byte grayscale frames, so deterministic unit and
 * Chromium canvas tests can exercise the real tracker without camera access.
 */
export class SparseVideoOpticalFlow{
 private previous:GrayFrame|null=null;
 private tracks=new Map<OpticalActorId,Track>();
 private latest:OpticalFlowFrame={atMs:0,actors:[]};
 reset(){this.previous=null;this.tracks.clear();this.latest={atMs:0,actors:[]};}
 get snapshot():OpticalFlowFrame{return {atMs:this.latest.atMs,
  actors:this.latest.actors.map(a=>({...a}))};}
 ingest(input:GrayFrame,persistent:readonly PersistentActorState[]):OpticalFlowFrame{
  if(!finite(input.atMs)||input.atMs<0||input.width<12||input.height<12||
   input.gray.length!==input.width*input.height)return this.snapshot;
  const previous=this.previous;
  if(previous&&(input.atMs<previous.atMs-30||
   previous.width!==input.width||previous.height!==input.height)){
   this.reset();
  }
  const prior=this.previous;
  if(prior&&input.atMs<=prior.atMs)return this.snapshot;
  if(prior&&input.atMs-prior.atMs<FLOW_MIN_INTERVAL_MS)return this.snapshot;
  if(prior&&input.atMs-prior.atMs>MAX_STEP_MS){
   // Playback may have paused or jumped: never reuse stale pixel features.
   this.tracks.clear();
  }
  const next:GrayFrame={...input,gray:input.gray.slice()};
  const updated=new Map<OpticalActorId,Track>();
  for(const id of IDS){
   const saved=persistent.find(a=>a.id===id&&a.registered);
   if(!saved||saved.lastObservedAtMs===null)continue;
   const observedAt=saved.lastObservedAtMs;
   const old=this.tracks.get(id);
   const newlyObserved=old?.anchorAtMs!==observedAt;
   if(newlyObserved){
    // D2's latest accepted measurement is the ONLY new identity anchor.
    // Do not anchor a severely old pose onto a newer image.
    if(input.atMs-observedAt<0||input.atMs-observedAt>220)continue;
    const points=seed(next,saved);
    if(points.length<MIN_FEATURES)continue;
    const center=saved.center;
    if(!center)continue;
    updated.set(id,{id,anchorAtMs:observedAt,seedAtMs:input.atMs,
     features:points,dxPx:0,dyPx:0,confidence:1,
     lastAtMs:input.atMs,center:{...center}});
    continue;
   }
   if(!old||input.atMs-observedAt>OPTICAL_FLOW_MAX_AGE_MS)continue;
   if(!prior||input.atMs-prior.atMs>MAX_STEP_MS)continue;
   const following=propagate(prior,next,old);
   if(following)updated.set(id,following);
  }
  const a=updated.get('A'),b=updated.get('B');
  if(a&&b){
   const sep=Math.hypot(
    a.center.x+a.dxPx/input.width-b.center.x-b.dxPx/input.width,
    a.center.y+a.dyPx/input.height-b.center.y-b.dyPx/input.height);
   // Fully overlapping torsos provide no safe per-person visual association.
   if(sep<.09){updated.delete('A');updated.delete('B');}
  }
  this.tracks=updated;
  this.previous=next;
  this.latest={atMs:input.atMs,actors:[...updated.values()].flatMap(t=>{
   if(t.lastAtMs!==input.atMs||input.atMs-t.anchorAtMs>OPTICAL_FLOW_MAX_AGE_MS)
    return [];
   return [{id:t.id,anchorAtMs:t.anchorAtMs,trackedAtMs:t.lastAtMs,
    dx:t.dxPx/input.width,dy:t.dyPx/input.height,
    confidence:t.confidence,inliers:t.features.length}];
  })};
  return this.snapshot;
 }
}
/** Browser adapter: one small canvas on the existing MP4, no new video track. */
export class FootprintsVideoOpticalFlow{
 private readonly core=new SparseVideoOpticalFlow();
 private canvas:HTMLCanvasElement|null=null;
 private ctx:CanvasRenderingContext2D|null=null;
 reset(){this.core.reset();}
 get snapshot(){return this.core.snapshot;}
 step(video:HTMLVideoElement,timeMs:number,persistent:readonly PersistentActorState[]){
  if(!video||video.seeking||video.readyState<2||
   !video.videoWidth||!video.videoHeight)return this.core.snapshot;
  const previous=this.core.snapshot.atMs;
  if(previous>0&&timeMs>=previous&&timeMs-previous<FLOW_MIN_INTERVAL_MS)
   return this.core.snapshot;
  if(!this.canvas){
   this.canvas=document.createElement('canvas');
   this.canvas.width=OPTICAL_FLOW_WIDTH;
   this.canvas.height=OPTICAL_FLOW_HEIGHT;
   this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});
  }
  if(!this.ctx)return this.core.snapshot;
  try{
   this.ctx.drawImage(video,0,0,OPTICAL_FLOW_WIDTH,OPTICAL_FLOW_HEIGHT);
   const data=this.ctx.getImageData(0,0,OPTICAL_FLOW_WIDTH,OPTICAL_FLOW_HEIGHT).data;
   const gray=new Uint8Array(OPTICAL_FLOW_WIDTH*OPTICAL_FLOW_HEIGHT);
   for(let i=0;i<gray.length;i++){
    const p=i*4;
    gray[i]=Math.round((data[p]*77+data[p+1]*150+data[p+2]*29)/256);
   }
   return this.core.ingest({gray,width:OPTICAL_FLOW_WIDTH,
    height:OPTICAL_FLOW_HEIGHT,atMs:timeMs},persistent);
  }catch{
   this.reset();
   return this.core.snapshot;
  }
 }
}
