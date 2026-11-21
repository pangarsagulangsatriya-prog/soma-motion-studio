import {capturePhoto} from '../photos/store.ts';
import type {F3Photo,F3Rect,F3PunchPreset,F3StageFrame} from './F3Types.ts';
export const f3FrameCrop=(video:HTMLVideoElement,crop:F3Rect)=>{
 if(!video.videoWidth||!video.videoHeight||crop.width<1||crop.height<1||
 crop.x<0||crop.y<0||crop.x+crop.width>video.videoWidth||crop.y+crop.height>video.videoHeight)
 throw Error('ROI Kamera B tidak valid.');
 return crop;
};
const captureFixture=async(video:HTMLVideoElement,crop:F3Rect)=>{
 const canvas=document.createElement('canvas');canvas.width=crop.width;canvas.height=crop.height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas foto belum tersedia.');
 ctx.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
 return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Foto gagal disimpan.')),'image/jpeg',.92));
};
/** F3 stores no IndexedDB records and never sends image data to any remote service. */
export class F3PhotoStore{
 slots:F3StageFrame['photoSlots']=[null,null,null,null];
 private previous:{index:number;item:F3Photo|null}|null=null;
 private urls=new Set<string>();
 private inFlight=false;
 private events=new Set<string>();
 get count(){return this.slots.filter(Boolean).length;}
 get busy(){return this.inFlight;}
 nextSlot(replace:number|null=null){return replace!==null?replace:this.slots.findIndex(item=>!item);}
 async capture(params:{video:HTMLVideoElement;crop:F3Rect;cameraId:string;frameId:number;sourceTimestamp:number;
  preset:F3PunchPreset|'manual';consent:boolean;replace?:number|null;eventId:string;fresh:boolean}):Promise<F3Photo>{
  if(!params.consent)throw Error('Persetujuan penonton diperlukan.');
  if(!params.fresh)throw Error('Kamera B tidak mengirim frame segar.');
  if(!params.cameraId)throw Error('Sumber B tidak diketahui.');
  if(this.inFlight||this.events.has(params.eventId))throw Error('Satu gerakan hanya boleh mengambil satu foto.');
  const slot=this.nextSlot(params.replace??null);
  if(slot<0||slot>3)throw Error('Keempat slot sudah terisi.');
  const crop=f3FrameCrop(params.video,params.crop);
  const sourceId=params.cameraId,frameId=params.frameId;
  this.inFlight=true;this.events.add(params.eventId);
  try{
   // Reuse legacy camera pixel capture; fixture MP4 needs the same drawImage ROI without MediaStream gating.
   const isStream=typeof MediaStream!=='undefined'&&params.video.srcObject instanceof MediaStream;
   const blob=isStream?(await capturePhoto(params.video,slot,false,crop)).blob:await captureFixture(params.video,crop);
   const url=URL.createObjectURL(blob);
   const item:F3Photo={id:params.eventId,slot,blob,url,createdAt:new Date().toISOString(),
    cameraId:sourceId,frameId,sourceTimestamp:params.sourceTimestamp,crop:{...crop},preset:params.preset,consent:true};
   this.urls.add(url);this.previous={index:slot,item:this.slots[slot]};
   this.slots=[...this.slots] as F3StageFrame['photoSlots'];this.slots[slot]=item;
   return item;
  }catch(e){this.events.delete(params.eventId);throw e;}
  finally{this.inFlight=false;}
 }
 remove(slot:number){
  if(slot<0||slot>3)return;
  this.previous={index:slot,item:this.slots[slot]};
  this.slots=[...this.slots] as F3StageFrame['photoSlots'];this.slots[slot]=null;
 }
 undo(){
  if(!this.previous)return false;
  const {index,item}=this.previous;this.previous={index,item:this.slots[index]};
  this.slots=[...this.slots] as F3StageFrame['photoSlots'];this.slots[index]=item;return true;
 }
 revokeAll(){
  for(const url of this.urls)URL.revokeObjectURL(url);
  this.urls.clear();this.slots=[null,null,null,null];this.previous=null;this.events.clear();
 }
 download(slot:number){
  const item=this.slots[slot];if(!item)return;
  const a=document.createElement('a');a.href=item.url;a.download=`SOMA-F3-${slot+1}-${item.createdAt.replace(/[:.]/g,'-')}.jpg`;
  a.click();
 }
}
