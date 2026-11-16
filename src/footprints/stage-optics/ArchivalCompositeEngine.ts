import type {BodyMask} from '../../studio/bodyField.ts';
import type {LowerBodyMaskResult} from './LowerBodyMaskEngine.ts';

export type ArchiveSlot='A'|'B';
export type ArchivePlayback={speed:number;zoom:number;panX:number;panY:number;
 contrast:number;brightness:number;grain:number;opacity:number;invert:boolean};
export const DEFAULT_ARCHIVE_PLAYBACK:ArchivePlayback={
 speed:1,zoom:1.15,panX:0,panY:0,contrast:1.16,brightness:1,
 grain:.13,opacity:1,invert:false
};
export type ArchivePixels={width:number;height:number;data:Uint8ClampedArray};
export type ArchiveSources={A:ArchivePixels|null;B:ArchivePixels|null};
export type ArchiveSettings={A:ArchivePlayback;B:ArchivePlayback};
export type ArchiveIdentity={A:number|null;B:number|null};
export type ArchiveCompositeResult={
 status:'blackout'|'partial'|'ready';reason:string;pixels:ArchivePixels;
 activeSlots:ArchiveSlot[];litPixels:number;
};
const finite=(v:number)=>Number.isFinite(v);
const clamp=(x:number,lo=0,hi=1)=>Math.min(hi,Math.max(lo,x));
const slots=['A','B'] as const;
export function validateArchivePlayback(s:ArchivePlayback):ArchivePlayback{
 if(!s||!finite(s.speed)||s.speed<.25||s.speed>2.0||
  !finite(s.zoom)||s.zoom<1||s.zoom>3||
  !finite(s.panX)||s.panX< -1||s.panX>1||
  !finite(s.panY)||s.panY< -1||s.panY>1||
  !finite(s.contrast)||s.contrast<.5||s.contrast>2||
  !finite(s.brightness)||s.brightness<.1||s.brightness>1.8||
  !finite(s.grain)||s.grain<0||s.grain>.65||
  !finite(s.opacity)||s.opacity<0||s.opacity>1||
  typeof s.invert!=='boolean')throw Error('Kontrol arsip berada di luar batas aman.');
 return {...s};
}
const validPixels=(src:ArchivePixels|null):src is ArchivePixels=>
 !!src&&Number.isInteger(src.width)&&Number.isInteger(src.height)&&
 src.width>0&&src.height>0&&src.width<=4096&&src.height<=4096&&
 src.data.length===src.width*src.height*4;
type Bounds={x0:number;x1:number;y0:number;y1:number};
function boundsOf(mask:BodyMask):Bounds|null{
 let x0=mask.width,y0=mask.height,x1=-1,y1=-1;
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
  if(mask.data[y*mask.width+x]===0)continue;
  x0=Math.min(x,x0);x1=Math.max(x,x1);
  y0=Math.min(y,y0);y1=Math.max(y,y1);
 }
 return x1>=x0?{x0,x1,y0,y1}:null;
}
export function archiveGrain(x:number,y:number,frameNumber:number,seed:number){
 let h=Math.imul(x+1,0x1f123bb5)^Math.imul(y+1,0x45d9f3b)^
  Math.imul(Math.floor(frameNumber/2)+1,0x119de1f3)^Math.imul(seed+7,0x27d4eb2d);
 h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;
 return ((h>>>0)/4294967295)*2-1;
}
function sample(src:ArchivePixels,setting:ArchivePlayback,x:number,y:number,
 box:Bounds,width:number,height:number){
 // UV tracks the BOUNDING BOX of the selected performer, not the entire stage.
 // The full archive image therefore moves with each person in a separate channel.
 const u=(x-box.x0+.5)/(box.x1-box.x0+1);
 const v=(y-box.y0+.5)/(box.y1-box.y0+1);
 const destAspect=(box.x1-box.x0+1)/(box.y1-box.y0+1);
 const sourceAspect=src.width/src.height;
 const ratio=sourceAspect/destAspect;
 const visibleW=ratio>1?1/ratio:1,visibleH=ratio<1?ratio:1;
 const sw=visibleW/setting.zoom,sh=visibleH/setting.zoom;
 const cx=.5+setting.panX*(1-sw)*.5,cy=.5+setting.panY*(1-sh)*.5;
 const sx=Math.min(src.width-1,Math.max(0,Math.floor((cx+(u-.5)*sw)*src.width)));
 const sy=Math.min(src.height-1,Math.max(0,Math.floor((cy+(v-.5)*sh)*src.height)));
 const i=(sy*src.width+sx)*4;
 const sourceAlpha=src.data[i+3]/255;
 const luminance=.2126*src.data[i]+.7152*src.data[i+1]+.0722*src.data[i+2];
 return {luminance,sourceAlpha};
}
export function compositeArchivalFrame(mask:LowerBodyMaskResult,sources:ArchiveSources,
 settings:ArchiveSettings,identity:ArchiveIdentity,frameNumber=0):ArchiveCompositeResult{
 const w=mask.mask.width,h=mask.mask.height;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||
  mask.mask.data.length!==w*h||!finite(frameNumber))throw Error('Mask/frame input tidak valid.');
 const pixels:ArchivePixels={width:w,height:h,data:new Uint8ClampedArray(w*h*4)};
 for(let i=0;i<w*h;i++)pixels.data[i*4+3]=255; // opaque black outside masks
 const blocked=(reason:string):ArchiveCompositeResult=>({
  status:'blackout',reason,pixels,activeSlots:[],litPixels:0});
 if(mask.status!=='ready')return blocked('Tracking, occlusion atau mask belum valid.');
 const count=mask.perPoseMasks.length;
 if(count<1||count>2||mask.poseCount!==count)return blocked('Kanal mask pose tidak lengkap.');
 const ids:ArchiveSlot[]=count===1?['A']:['A','B'];
 const indices=ids.map(k=>identity[k]);
 if(indices.some(i=>i===null||!Number.isInteger(i)||i<0||i>=count)||
  new Set(indices).size!==indices.length)
  return blocked('Pemetaan identitas A/B tidak cocok dengan frame kamera.');
 const ready=ids.filter(k=>validPixels(sources[k]));
 if(!ready.length)return blocked('Unggah video arsip lokal untuk A/B.');
 for(const k of ready)validateArchivePlayback(settings[k]);
 const masks:Partial<Record<ArchiveSlot,{mask:BodyMask;bounds:Bounds}>>={};
 for(const k of ready){
  const idx=identity[k]!;
  const channel=mask.perPoseMasks[idx],bounds=boundsOf(channel);
  if(!channel||channel.width!==w||channel.height!==h||
   channel.data.length!==w*h||!bounds)return blocked('Kanal mask kosong atau salah ukuran.');
  masks[k]={mask:channel,bounds};
 }
 let lit=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,k=i*4;
  let level=0;
  for(const [index,slot] of ids.entries()){
   if(!ready.includes(slot))continue;
   const item=masks[slot]!;
   const alpha=item.mask.data[i]/255;
   if(alpha<=0)continue;
   const src=sources[slot]!,conf=settings[slot];
   const samplePixel=sample(src,conf,x,y,item.bounds,w,h);
   let shade=samplePixel.luminance;
   shade=(shade-128)*conf.contrast+128;
   if(conf.invert)shade=255-shade;
   shade*=conf.brightness;
   shade+=archiveGrain(x,y,frameNumber,index)*conf.grain*65;
   level=Math.max(level,clamp(shade/255)*255*alpha*conf.opacity*samplePixel.sourceAlpha);
  }
  const value=Math.round(clamp(level,0,255));
  pixels.data[k]=value;pixels.data[k+1]=value;pixels.data[k+2]=value;
  if(value>0)lit++;
 }
 return {status:ready.length===ids.length?'ready':'partial',
  reason:ready.length===ids.length?'Arsip terpotong pada mask tiap performer.':
   'Sebagian performer belum memiliki video yang siap diputar.',
  pixels,activeSlots:ready,litPixels:lit};
}
export function archiveSessionReport(settings:ArchiveSettings,files:{A:string|null;B:string|null},
 performerCount:1|2){
 return {schema:'soma.footprints.archival-preview',version:1,
  exportedAt:new Date().toISOString(),performerCount,settings:{
   A:validateArchivePlayback(settings.A),B:validateArchivePlayback(settings.B)},
  files:{...files},projectionReady:false,
  warning:'Video lokal hanya untuk pratinjau. Tidak ada file video yang disematkan, dikirim, atau ditayangkan pada proyektor.'};
}
