import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {ActorPathObservation,PathPoint} from './PathObservationRouter.ts';
import type {PathEvent} from './ActorPathTracker.ts';
import {knotDistances,samplePathSegment,type PathKnot} from './PathSplineFitter.ts';
import {buildPathRibbon,type RibbonStyle} from './SumiRibbonMeshBuilder.ts';
import {paintDirectionalRibbon,type InkAccentMode,type InkRenderStyle} from './DirectionalInkPainter.ts';

const W=1600,H=900;
export type PathStyle={color:string;weightPx:number;material:RibbonStyle['material'];
 accents:InkAccentMode};
type Stroke={
 id:string;actorId:ActorChannel;clipStableId:string;sourceKey:string;
 knots:PathKnot[];baseArc:number;committedSeg:number;lastAt:number;
 style:InkRenderStyle;accentKnot:Set<number>;lastAccentAt:number;
};
type Bound={x:number;y:number;width:number;height:number};
const segment=(a:PathPoint,b:PathPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const h32=(s:string)=>{let n=2166136261;for(let i=0;i<s.length;i++)
 n=Math.imul(n^s.charCodeAt(i),16777619);return n>>>0;};
const blank=()=>{const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;return canvas;};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
/** Dedicated opaque pigment atlas; the output compositor applies opacity once.
 * Stable segments are committed once. Only the last >= 3 brush widths may be repainted. */
export class PersistentPathStore{
 private committed:HTMLCanvasElement|null=null;
 private active:HTMLCanvasElement|null=null;
 private composite:HTMLCanvasElement|null=null;
 private scratch:HTMLCanvasElement|null=null;
 private strokes=new Map<ActorChannel,Stroke>();
 private ranges=new Map<string,Array<[number,number]>>();
 private bounds:Bound|null=null;
 private index=0;
 private commits=0;
 get paintingSessionId(){return this.index;}
 get activeCount(){return this.strokes.size;}
 get depositCount(){return this.commits;}
 get diagnostics(){return {active:this.strokes.size,commits:this.commits,
  coverage:[...this.ranges.values()].reduce((v,a)=>v+a.length,0),
  atlasBytes:this.committed?W*H*4*3:0};}
 getBounds(){return this.bounds?{...this.bounds}:null;}
 getCanvas(){return this.composite;}
 private canvases(){
  this.committed??=blank();this.active??=blank();this.composite??=blank();
  this.scratch??=document.createElement('canvas');
 }
 private rangeKey(clip:string,actor:ActorChannel){return clip+'|'+actor;}
 isReplayCovered(obs:ActorPathObservation){
  if(!obs.clipStableId.startsWith('video:'))return false;
  const spans=this.ranges.get(this.rangeKey(obs.clipStableId,obs.actorId))??[];
  return spans.some(([a,b])=>obs.timeMs>=a+.5&&obs.timeMs<=b-.5);
 }
 private cover(rec:Stroke,from:number,to:number){
  if(!rec.clipStableId.startsWith('video:')||to<=from)return;
  const key=this.rangeKey(rec.clipStableId,rec.actorId);
  const old=this.ranges.get(key)??[];old.push([from,to]);old.sort((a,b)=>a[0]-b[0]);
  const merged:Array<[number,number]>=[];
  for(const span of old){
   const prev=merged[merged.length-1];
   if(prev&&span[0]<=prev[1]+1)prev[1]=Math.max(prev[1],span[1]);
   else merged.push([...span]);
  }
  this.ranges.set(key,merged.length<=2048?merged:merged.slice(-2048));
 }
 ingest(event:PathEvent,style:PathStyle){
  this.canvases();
  if(event.kind==='START'){
   const prior=this.strokes.get(event.actorId);
   if(prior)this.finalize(prior);
   const rec:Stroke={id:event.strokeId,actorId:event.actorId,
    clipStableId:event.clipStableId,sourceKey:event.sourceKey,
    knots:[{point:{...event.point},timeMs:event.timeMs,confidence:event.confidence}],
    baseArc:0,committedSeg:0,lastAt:event.timeMs,
    style:{...style,weightPx:clamp(style.weightPx,8,64),seed:h32(event.strokeId+this.index)},
    accentKnot:new Set<number>(),lastAccentAt:-Infinity};
   this.strokes.set(event.actorId,rec);this.refreshTail();return;
  }
  const rec=this.strokes.get(event.actorId);
  if(!rec||rec.id!==event.strokeId)return;
  if(event.kind==='CUT'){this.finalize(rec);this.refreshTail();return;}
  if(event.kind==='STOP')return;
  if(event.kind!=='ADD'&&event.kind!=='TURN')return;
  if(event.timeMs<=rec.lastAt)return;
  const prev=rec.knots[rec.knots.length-1],d=segment(prev.point,event.point);
  if(d<2||d>180)return;
  this.cover(rec,prev.timeMs,event.timeMs);
  rec.knots.push({point:{...event.point},timeMs:event.timeMs,confidence:event.confidence});
  rec.lastAt=event.timeMs;
  if(event.kind==='TURN'&&event.footEvent==='pivot'&&
     event.motionBasis==='estimated-support'&&event.confidence>=.8&&
     Math.abs(event.turnRad??0)>.55&&
     event.timeMs-rec.lastAccentAt>800){
    rec.lastAccentAt=event.timeMs;rec.accentKnot.add(rec.knots.length-1);
  }
  this.extend(event.point,rec.style.weightPx);
  this.commitStable(rec);
  this.refreshTail();
 }
 private extend(point:PathPoint,width:number){
  const margin=Math.max(12,width);
  const x=point.x-margin,y=point.y-margin;
  if(!this.bounds){this.bounds={x,y,width:margin*2,height:margin*2};return;}
  const b=this.bounds,xa=Math.min(x,b.x),ya=Math.min(y,b.y);
  const xb=Math.max(point.x+margin,b.x+b.width),yb=Math.max(point.y+margin,b.y+b.height);
  this.bounds={x:xa,y:ya,width:xb-xa,height:yb-ya};
 }
 private paintSegment(target:CanvasRenderingContext2D,rec:Stroke,
  segIndex:number,distances:readonly number[],finished:boolean){
  const points=samplePathSegment(rec.knots,segIndex,distances[segIndex],
   Math.max(2.2,rec.style.weightPx*.18));
  const mesh=buildPathRibbon(points,rec.style,distances[distances.length-1],finished);
  if(!mesh)return;
  const x=Math.max(0,Math.floor(mesh.bounds.x)),y=Math.max(0,Math.floor(mesh.bounds.y));
  const right=Math.min(W,Math.ceil(mesh.bounds.x+mesh.bounds.width));
  const bottom=Math.min(H,Math.ceil(mesh.bounds.y+mesh.bounds.height));
  if(right<=x||bottom<=y)return;
  const scratch=this.scratch!;
  const width=right-x,height=bottom-y;
  if(scratch.width<width)scratch.width=Math.min(W,Math.ceil(width/64)*64);
  if(scratch.height<height)scratch.height=Math.min(H,Math.ceil(height/64)*64);
  const ctx=scratch.getContext('2d');if(!ctx)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,scratch.width,scratch.height);
  ctx.translate(-x,-y);
  paintDirectionalRibbon(ctx,mesh,rec.style,rec.accentKnot.has(segIndex+1));
  ctx.restore();
  target.drawImage(scratch,0,0,width,height,x,y,width,height);
  this.commits++;
 }
 private commitStable(rec:Stroke){
  const distances=knotDistances(rec.knots,rec.baseArc);
  const total=distances[distances.length-1];
  // Retain the terminal >= 3.5 nib widths so CUT can taper without erasing ink.
  const lookback=Math.max(95,rec.style.weightPx*3.5);
  const ctx=this.committed!.getContext('2d');if(!ctx)return;
  while(rec.committedSeg<rec.knots.length-2&&
   distances[rec.committedSeg+1]<=total-lookback){
   this.paintSegment(ctx,rec,rec.committedSeg,distances,false);
   rec.committedSeg++;
  }
  // Keep memory bounded over a 30 minute unbroken stage walk.
  if(rec.committedSeg>64){
   const drop=rec.committedSeg-2;
   rec.baseArc=distances[drop];
   rec.knots.splice(0,drop);
   rec.committedSeg-=drop;
   rec.accentKnot=new Set([...rec.accentKnot].filter(n=>n>drop).map(n=>n-drop));
  }
 }
 private finalize(rec:Stroke){
  const distances=knotDistances(rec.knots,rec.baseArc);
  const ctx=this.committed?.getContext('2d');
  if(ctx)for(let i=rec.committedSeg;i<rec.knots.length-1;i++)
   this.paintSegment(ctx,rec,i,distances,true);
  this.strokes.delete(rec.actorId);
 }
 private refreshTail(){
  if(!this.active)return;
  const ctx=this.active.getContext('2d');if(!ctx)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);
  for(const rec of this.strokes.values()){
   const distances=knotDistances(rec.knots,rec.baseArc);
   for(let i=rec.committedSeg;i<rec.knots.length-1;i++)
    this.paintSegment(ctx,rec,i,distances,false);
  }
  ctx.restore();this.refreshComposite();
 }
 private refreshComposite(){
  if(!this.committed||!this.active||!this.composite)return;
  const ctx=this.composite.getContext('2d');if(!ctx)return;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);
  ctx.drawImage(this.committed,0,0);ctx.drawImage(this.active,0,0);
 }
 cutAll(_reason:string){
  for(const rec of [...this.strokes.values()])this.finalize(rec);
  this.refreshTail();
 }
 clearPainting(){
  this.index++;this.commits=0;this.strokes.clear();this.ranges.clear();this.bounds=null;
  for(const canvas of [this.committed,this.active,this.composite])
   canvas?.getContext('2d')?.clearRect(0,0,W,H);
 }
 exportPNG():string|null{
  if(!this.composite)return null;
  const output=blank(),ctx=output.getContext('2d');if(!ctx)return null;
  ctx.fillStyle='#F5F5F2';ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=.85;ctx.drawImage(this.composite,0,0);
  return output.toDataURL('image/png');
 }
 exportSessionJSON():string|null{
  if(!this.composite)return null;
  return JSON.stringify({schema:'soma.path.painting',version:1,width:W,height:H,
   png:this.composite.toDataURL('image/png'),ranges:[...this.ranges.entries()]});
 }
 async importSessionJSON(data:string):Promise<void>{
  if(data.length>16000000)throw Error('Arsip terlalu besar');
  const archive=JSON.parse(data) as Record<string,unknown>;
  if(archive.schema!=='soma.path.painting'||archive.version!==1||
   archive.width!==W||archive.height!==H||typeof archive.png!=='string'||
   !archive.png.startsWith('data:image/png;base64,'))throw Error('Format arsip tidak cocok');
  const img=new Image();img.src=archive.png;await img.decode();
  if(img.naturalWidth!==W||img.naturalHeight!==H)throw Error('Resolusi tidak cocok');
  const ranges=new Map<string,Array<[number,number]>>();
  if(Array.isArray(archive.ranges)){
   for(const entry of archive.ranges){
    if(!Array.isArray(entry)||typeof entry[0]!=='string'||entry[0].length>512||
       !Array.isArray(entry[1])||entry[1].length>2048)throw Error('Indeks video rusak');
    const spans:Array<[number,number]>=[];
    for(const span of entry[1]){
     if(!Array.isArray(span)||span.length!==2||
      !Number.isFinite(span[0])||!Number.isFinite(span[1])||
      span[0]<0||span[1]<span[0])throw Error('Interval video rusak');
     spans.push([span[0],span[1]]);
    }
    ranges.set(entry[0],spans);
   }
  }
  this.clearPainting();this.canvases();
  this.committed!.getContext('2d')?.drawImage(img,0,0);
  this.ranges=ranges;this.bounds={x:0,y:0,width:W,height:H};this.refreshComposite();
 }
}
