import type {InkSegmentEvent} from './ObservedMotionInkEngine.ts';
import type {SumiStrokeGeometry} from './SumiStrokeGeometryBuilder.ts';
import {renderSumiMaterial,type SumiInkStyle} from './SumiMaterialRenderer.ts';
import {extendPaintingBounds,type PaintingBounds} from './PainterlyPreviewTransform.ts';
const WIDTH=1600,HEIGHT=900;
/** One painting session survives source, track, and media epoch changes. */
export class PersistentInkStore{
 private canvas:HTMLCanvasElement|null=null;
 private scratch:HTMLCanvasElement|null=null;
 private playedIds=new Set<string>();
 private idOrder:string[]=[];
 private mediaIntervals=new Map<string,Array<[number,number]>>();
 private paintingIndex=0;
 private accepted=0;
 private inkBounds:PaintingBounds|null=null;
 get paintingSessionId(){return this.paintingIndex;}
 get depositCount(){return this.accepted;}
 getBounds():PaintingBounds|null{return this.inkBounds?{...this.inkBounds}:null;}
 get diagnostics(){return {deposits:this.accepted,liveIds:this.playedIds.size,
  coveredRanges:[...this.mediaIntervals.values()].reduce((n,parts)=>n+parts.length,0),
  rasterBytes:WIDTH*HEIGHT*4};}
 private ensureCanvas(){
  if(!this.canvas){this.canvas=document.createElement('canvas');
   this.canvas.width=WIDTH;this.canvas.height=HEIGHT;}
  return this.canvas;
 }
 getCanvas():HTMLCanvasElement|null{return this.canvas;}
 /** Stop geometry continuity in the motion engine; this call preserves ink pixels. */
 cutMotionSegment(_reason:string){/* recording continuity owned by ObservedMotionInkEngine */}
 private intervalKey(e:InkSegmentEvent){return [e.sourceIdentity,e.actorId,e.foot].join('|');}
 private alreadyCovered(e:InkSegmentEvent){
  if(!e.sourceIdentity.startsWith('video:'))return false;
  const intervals=this.mediaIntervals.get(this.intervalKey(e))??[];
  return intervals.some(([a,b])=>e.fromMs>=a-.5&&e.toMs<=b+.5);
 }
 private indexInterval(e:InkSegmentEvent){
  if(!e.sourceIdentity.startsWith('video:'))return;
  const key=this.intervalKey(e),intervals=this.mediaIntervals.get(key)??[];
  intervals.push([e.fromMs,e.toMs]);intervals.sort((a,b)=>a[0]-b[0]);
  const merged:Array<[number,number]>=[];
  for(const interval of intervals){
   const last=merged.at(-1);
   if(last&&interval[0]<=last[1]+.5)last[1]=Math.max(last[1],interval[1]);
   else merged.push([...interval]);
  }
  // This retains all continuous intervals while bounding fragmented tracking metadata.
  this.mediaIntervals.set(key,merged.length>4096?merged.slice(-4096):merged);
 }
 appendOnce(event:InkSegmentEvent,geometry:SumiStrokeGeometry,
  style:SumiInkStyle):boolean{
  if(!Number.isFinite(event.fromMs)||!Number.isFinite(event.toMs)||
   event.fromMs>=event.toMs||this.playedIds.has(event.id)||this.alreadyCovered(event))
   return false;
  const canvas=this.ensureCanvas(),target=canvas.getContext('2d');
  if(!target)return false;
  const {x,y,width,height}=geometry.bounds;
  const left=Math.max(0,Math.floor(x)),top=Math.max(0,Math.floor(y));
  const right=Math.min(WIDTH,Math.ceil(x+width)),bottom=Math.min(HEIGHT,Math.ceil(y+height));
  if(right<=left||bottom<=top)return false;
  if(!this.scratch)this.scratch=document.createElement('canvas');
  const scratch=this.scratch;
  const neededW=right-left,neededH=bottom-top;
  // Pool the backing texture; allocate only when a new stroke exceeds capacity.
  if(scratch.width<neededW)scratch.width=Math.min(WIDTH,Math.max(64,Math.ceil(neededW/64)*64));
  if(scratch.height<neededH)scratch.height=Math.min(HEIGHT,Math.max(64,Math.ceil(neededH/64)*64));
  const temp=scratch.getContext('2d');
  if(!temp)return false;
  temp.save();temp.setTransform(1,0,0,1,0,0);
  temp.clearRect(0,0,scratch.width,scratch.height);
  temp.translate(-left,-top);
  renderSumiMaterial(temp,geometry,style);temp.restore();
  target.drawImage(scratch,0,0,neededW,neededH,left,top,neededW,neededH);
  this.playedIds.add(event.id);this.idOrder.push(event.id);
  while(this.idOrder.length>3000)this.playedIds.delete(this.idOrder.shift()!);
  this.indexInterval(event);this.accepted++;
  this.inkBounds=extendPaintingBounds(this.inkBounds,geometry);
  return true;
 }
 clearPainting(){
  this.paintingIndex++;this.accepted=0;
  this.canvas?.getContext('2d')?.clearRect(0,0,WIDTH,HEIGHT);
  this.playedIds.clear();this.idOrder=[];this.mediaIntervals.clear();this.inkBounds=null;
 }
 /** Portable final painting snapshot plus MP4 replay index. It carries no camera footage. */
 exportSessionJSON():string|null{
  const png=this.exportPNG(false);if(!png)return null;
  return JSON.stringify({schema:'soma.sumi.painting',version:1,
   width:WIDTH,height:HEIGHT,createdAt:new Date().toISOString(),
   accepted:this.accepted,png,
   mediaIntervals:[...this.mediaIntervals.entries()]});
 }
 /** Restores a final painting snapshot; future frames continue painting from it. */
 async importSessionJSON(raw:string):Promise<void>{
  if(raw.length>16_000_000)throw Error('Arsip lukisan terlalu besar.');
  const value=JSON.parse(raw) as Record<string,unknown>;
  if(value.schema!=='soma.sumi.painting'||value.version!==1||
   value.width!==WIDTH||value.height!==HEIGHT||
   typeof value.png!=='string'||!/^data:image\\/png;base64,[A-Za-z0-9+/=]+$/.test(value.png))
   throw Error('Format arsip Sumi tidak sesuai.');
  const lines=new Map<string,Array<[number,number]>>();
  if(Array.isArray(value.mediaIntervals)){
   for(const pair of value.mediaIntervals){
    if(!Array.isArray(pair)||typeof pair[0]!=='string'||pair[0].length>512||
     !Array.isArray(pair[1])||pair[1].length>4096)throw Error('Indeks video rusak.');
    const intervals:Array<[number,number]>=[];
    for(const interval of pair[1]){
     if(!Array.isArray(interval)||interval.length!==2||
      !Number.isFinite(interval[0])||!Number.isFinite(interval[1])||
      interval[0]<0||interval[1]<interval[0])throw Error('Interval video rusak.');
     intervals.push([interval[0],interval[1]]);
    }
    lines.set(pair[0],intervals);
   }
  }
  const image=new Image();image.src=value.png;
  await image.decode();
  if(image.naturalWidth!==WIDTH||image.naturalHeight!==HEIGHT)
   throw Error('Resolusi lukisan tidak sesuai.');
  this.clearPainting();
  const ctx=this.ensureCanvas().getContext('2d');if(!ctx)throw Error('Canvas tidak siap.');
  ctx.drawImage(image,0,0);
  this.mediaIntervals=lines;
  this.accepted=typeof value.accepted==='number'&&Number.isFinite(value.accepted)?
   Math.max(0,Math.min(1_000_000,Math.round(value.accepted))):0;
  this.inkBounds={x:0,y:0,width:WIDTH,height:HEIGHT};
 }
 exportPNG(includeBackground=true):string|null{
  if(!this.canvas)return null;
  if(!includeBackground)return this.canvas.toDataURL('image/png');
  const output=document.createElement('canvas');
  output.width=WIDTH;output.height=HEIGHT;
  const ctx=output.getContext('2d');if(!ctx)return null;
  ctx.fillStyle='#F5F5F2';ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.drawImage(this.canvas,0,0);
  return output.toDataURL('image/png');
 }
}
