import {floorToUV,validateFloorSpace,type FloorPoint,type FloorSpace} from '../spatial/coordinates.ts';
import {validateFootstepEvent,type FootstepEvent,type FootSide} from '../spatial/events.ts';
import type {ArchivePixels,ArchiveSlot,ArchiveSources} from './ArchivalCompositeEngine.ts';

/**
 * S5.7.3 — an opt-in, preview-only reader of EXISTING FloorSession V3 events.
 * Camera contacts are calibrated estimates, never ground-truth foot pressure.
 * No FloorSession mutation, duplicate contact detection or projector transport.
 */
export type BridgeMode='simulation'|'camera';
export type BridgeSettings={
 holdMs:number;minConfidence:number;maxResidues:number;
};
export const BRIDGE_DEFAULTS:BridgeSettings={
 holdMs:420,minConfidence:.60,maxResidues:80
};
export type FrozenArchiveTexture={width:number;height:number;gray:Uint8Array};
export type ArchiveResidue={
 eventId:string;performerId:string;slot:ArchiveSlot;foot:FootSide;
 positionM:FloorPoint;headingRad:number;timestampMs:number;
 confidence:number;texture:FrozenArchiveTexture;
};
export type ArchiveDrag={
 eventId:string;slot:ArchiveSlot;foot:FootSide;
 fromM:FloorPoint;toM:FloorPoint;timestampMs:number;
};
export type BridgeEventNote={
 eventId:string;slot:ArchiveSlot;kind:'contact'|'move'|'release';
 atMs:number;description:string;
};
export type BridgeSnapshot={
 residueCount:number;dragCount:number;contactCount:number;moveCount:number;
 heldUntil:{A:number;B:number};holdActive:{A:boolean;B:boolean};
 residues:ArchiveResidue[];drags:ArchiveDrag[];
 recent:BridgeEventNote[];skipped:number;status:'ready'|'blocked';
 reason:string;
};
const finite=(v:number)=>Number.isFinite(v);
export function validateBridgeSettings(s:BridgeSettings):BridgeSettings{
 if(!s||!finite(s.holdMs)||s.holdMs<0||s.holdMs>2500||
  !finite(s.minConfidence)||s.minConfidence<.5||s.minConfidence>1||
  !Number.isInteger(s.maxResidues)||s.maxResidues<1||s.maxResidues>240)
  throw Error('Pengaturan Contact-to-Archive Bridge tidak valid.');
 return {...s};
}
export const bridgeSlot=(performerId:string):ArchiveSlot|null=>
 performerId==='A'||performerId==='performer-1'?'A':performerId==='B'?'B':null;
export function freezeArchiveFrame(pixels:ArchivePixels|null,
 width=16,height=24):FrozenArchiveTexture|null{
 if(!pixels||!Number.isInteger(pixels.width)||!Number.isInteger(pixels.height)||
  pixels.width<1||pixels.height<1||pixels.width>4096||pixels.height>4096||
  pixels.data.length!==pixels.width*pixels.height*4)return null;
 const gray=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  // Freeze a single crop of ACTUAL uploaded video frames, never a generated image.
  const ix=Math.min(pixels.width-1,Math.floor((x+.5)*pixels.width/width));
  const iy=Math.min(pixels.height-1,Math.floor((y+.5)*pixels.height/height));
  const offset=(iy*pixels.width+ix)*4;
  const alpha=pixels.data[offset+3]/255;
  gray[y*width+x]=Math.round(alpha*(.2126*pixels.data[offset]+
   .7152*pixels.data[offset+1]+.0722*pixels.data[offset+2]));
 }
 return {width,height,gray};
}
const eventSignature=(e:FootstepEvent|undefined)=>e?
 JSON.stringify([e.id,e.timestampMs,e.performerId,e.kind]):'';
export class ContactArchiveBridge{
 private settings:BridgeSettings;
 private context='';
 private processed=0;
 private lastProcessedSignature='';
 private lastClockMs=-1;
 private primed=false;
 private residues:ArchiveResidue[]=[];
 private drags:ArchiveDrag[]=[];
 private recent:BridgeEventNote[]=[];
 private footPositions=new Map<string,FloorPoint>();
 private heldUntil:{A:number;B:number}={A:0,B:0};
 private contactCount=0;
 private moveCount=0;
 private skipped=0;
 private blocked=false;
 private reason='Menunggu event pijakan yang valid.';
 constructor(settings:BridgeSettings=BRIDGE_DEFAULTS){
  this.settings=validateBridgeSettings(settings);
 }
 configure(settings:BridgeSettings){
  this.settings=validateBridgeSettings(settings);
  this.residues=this.residues.slice(-this.settings.maxResidues);
  this.drags=this.drags.slice(-this.settings.maxResidues*2);
 }
 reset(){
  this.processed=0;this.lastProcessedSignature='';this.lastClockMs=-1;
  this.primed=false;this.residues=[];this.drags=[];this.recent=[];
  this.footPositions.clear();this.heldUntil={A:0,B:0};
  this.contactCount=0;this.moveCount=0;this.skipped=0;
  this.blocked=false;this.reason='Sesi arsip baru.';
  this.context='';
 }
 private note(event:FootstepEvent,slot:ArchiveSlot,description:string){
  if(event.kind!=='contact'&&event.kind!=='move'&&event.kind!=='release')return;
  this.recent.push({eventId:event.id,slot,kind:event.kind,atMs:event.timestampMs,description});
  if(this.recent.length>12)this.recent.shift();
 }
 /**
  * Append-only ingestion. Calls may repeat the same session every animation
  * frame; each event index is processed once. Prefix/session replacement resets
  * the history, including when FootstepEventEngine reuses 'foot-1'.
  *
  * primeExisting=true prevents a newly opened live preview from replaying
  * old camera contacts. Simulation intentionally starts at t=0.
  *
  * In a tracking blackout new events are consumed as SKIPPED, not queued for
  * a catch-up flash. Already frozen fragments persist in memory until reset.
  */
 sync(events:readonly FootstepEvent[],nowMs:number,contextKey:string,
  floor:FloorSpace,sources:ArchiveSources,mode:BridgeMode,
  trusted:boolean,primeExisting=false):BridgeSnapshot{
  validateFloorSpace(floor);
  if(!finite(nowMs)||nowMs<0||!contextKey)throw Error('Clock dan sesi kontak diperlukan.');
  const signature=JSON.stringify([contextKey,mode,floor.widthM,floor.depthM]);
  const prefixChanged=this.processed>0&&
   eventSignature(events[this.processed-1])!==this.lastProcessedSignature;
  if(signature!==this.context||nowMs<this.lastClockMs||this.processed>events.length||prefixChanged){
   this.reset();this.context=signature;
  }
  this.lastClockMs=nowMs;
  if(!this.primed){
   this.primed=true;
   if(primeExisting){
    this.processed=events.length;
    this.lastProcessedSignature=eventSignature(events[this.processed-1]);
    this.blocked=!trusted;
    this.reason='Menunggu pijakan baru setelah preview dibuka.';
    return this.snapshot(nowMs);
   }
  }
  this.blocked=!trusted;
  if(!trusted){
   this.heldUntil={A:0,B:0};
   this.reason='Tracking/identitas/kalibrasi belum aman. Tidak ada event yang diputar ulang.';
  }else this.reason='Bridge menerima kontak Footprints yang terkalibrasi atau simulasi.';
  while(this.processed<events.length){
   const e=events[this.processed];
   if(e.timestampMs>nowMs)break;
   this.processed++;
   this.lastProcessedSignature=eventSignature(e);
   if(!trusted||nowMs-e.timestampMs>800){this.skipped++;continue;}
   const slot=bridgeSlot(e.performerId);
   if(!slot||e.source!==mode||
    e.positionBasis!==(mode==='camera'?'calibrated-estimate':'simulated')||
    e.confidence<this.settings.minConfidence||
    e.kind==='prediction'||e.kind==='swing'){this.skipped++;continue;}
   // Original FloorSession V3 coordinates and event IDs are used verbatim.
   validateFootstepEvent(e,floor);
   const key=e.performerId+':'+e.foot;
   if(e.kind==='release'){
    this.footPositions.delete(key);
    this.note(e,slot,'Kaki terangkat; fragmen di lantai tetap tinggal.');
    continue;
   }
   if(e.kind==='move'){
    const previous=this.footPositions.get(key);
    if(previous&&Math.hypot(previous.xM-e.positionM.xM,previous.yM-e.positionM.yM)>.005){
     this.drags.push({eventId:e.id,slot,foot:e.foot,fromM:{...previous},
      toM:{...e.positionM},timestampMs:e.timestampMs});
     this.drags=this.drags.slice(-this.settings.maxResidues*2);
     this.moveCount++;
     this.note(e,slot,'Kaki digeser; jalur bertambah, tanpa jejak kontak baru.');
    }
    if(previous)this.footPositions.set(key,{...e.positionM});
    continue;
   }
   if(e.kind!=='contact')continue;
   this.footPositions.set(key,{...e.positionM});
   const frozen=freezeArchiveFrame(sources[slot]);
   if(!frozen){this.skipped++;continue;}
   this.contactCount++;
   this.heldUntil[slot]=Math.max(this.heldUntil[slot],nowMs+this.settings.holdMs);
   this.residues.push({eventId:e.id,performerId:e.performerId,slot,foot:e.foot,
    positionM:{...e.positionM},headingRad:e.headingRad,
    timestampMs:e.timestampMs,confidence:e.confidence,texture:frozen});
   this.residues=this.residues.slice(-this.settings.maxResidues);
   this.note(e,slot,'Video tubuh tertahan singkat; satu bingkai arsip menetap pada pad.');
  }
  return this.snapshot(nowMs);
 }
 snapshot(nowMs:number):BridgeSnapshot{
  return {residueCount:this.residues.length,dragCount:this.drags.length,
   contactCount:this.contactCount,moveCount:this.moveCount,
   heldUntil:{...this.heldUntil},
   holdActive:{A:!this.blocked&&nowMs<this.heldUntil.A,
    B:!this.blocked&&nowMs<this.heldUntil.B},
   residues:this.residues.slice(),drags:this.drags.slice(),
   recent:this.recent.slice(),skipped:this.skipped,
   status:this.blocked?'blocked':'ready',reason:this.reason};
 }
}
/** Every contact has a real FootstepEvent source, not a pose-derived duplicate. */
export function makeBridgeSimulationEvents(floor:FloorSpace,count:1|2):FootstepEvent[]{
 const f=validateFloorSpace(floor),out:FootstepEvent[]=[];
 const performers=count===1?['performer-1']:['A','B'];
 let serial=0;
 for(let step=0;step<7;step++)for(let i=0;i<performers.length;i++){
  const performerId=performers[i],foot:FootSide=step%2===0?'left':'right';
  const xM=f.widthM*(count===1?.45:i===0?.26:.71)+step*f.widthM*.018;
  const yM=f.depthM*(.27+(step%5)*.10);
  const t=500+step*1150+i*375;
  const base={performerId,foot,positionM:{xM,yM},headingRad:Math.PI/2,
   source:'simulation' as const,positionBasis:'simulated' as const,confidence:.98};
  out.push({id:'sim-contact-'+(++serial),kind:'contact',timestampMs:t,...base});
  if(step===2){
   out.push({id:'sim-move-'+(++serial),kind:'move',timestampMs:t+210,
    ...base,positionM:{xM:Math.min(f.widthM,xM+.15),yM}});
  }
  out.push({id:'sim-release-'+(++serial),kind:'release',timestampMs:t+525,...base});
 }
 return out.sort((a,b)=>a.timestampMs-b.timestampMs);
}
export function bridgeExport(snapshot:BridgeSnapshot,mode:BridgeMode,settings:BridgeSettings,
 fileNames:{A:string|null;B:string|null},floor:FloorSpace){
 return {schema:'soma.footprints.contact-archive-preview',version:1,at:new Date().toISOString(),
  mode,settings:validateBridgeSettings(settings),floor:validateFloorSpace(floor),
  files:{...fileNames},counts:{contacts:snapshot.contactCount,moves:snapshot.moveCount,
   frozenFragments:snapshot.residueCount,skipped:snapshot.skipped},
  residues:snapshot.residues.map(({texture,...r})=>({
   ...r,thumbnailDimensions:{width:texture.width,height:texture.height}})),
  drags:snapshot.drags.map(d=>({...d})),recent:snapshot.recent,
  projectorReady:false,
  warning:'Snapshot hanya menyimpan metadata dan koordinat preview. Video/thumbnail piksel tidak diekspor. Kontak kamera tetap estimasi, dan belum diuji sebagai proyeksi fisik.'};
}
