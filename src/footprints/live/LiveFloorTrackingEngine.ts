import type {GaitSample,GaitMotion} from '../gait-analysis/index.ts';
import type {FloorUpdate,FloorUpdateKind} from './FloorRealtimeDiagnostics.ts';
import {calibratedGaitContact} from '../spatial/adapters.ts';
import {validateCameraFloorCalibration,type CameraFloorCalibration,type FloorPoint} from '../spatial/coordinates.ts';
import {createFloorSession,FootstepEventEngine,type FloorSession,type FootstepEvent,type FootSide} from '../spatial/events.ts';

export type CameraBinding={trackId:string;deviceId:string;width:number;height:number};
export function cameraBinding(video:HTMLVideoElement|null):CameraBinding|null{
 const stream=video?.srcObject;
 const track=stream instanceof MediaStream?stream.getVideoTracks().find(t=>t.readyState==='live'):undefined;
 if(!video||!track||video.videoWidth<1||video.videoHeight<1)return null;
 return {trackId:track.id,deviceId:track.getSettings().deviceId||'',
  width:video.videoWidth,height:video.videoHeight};
}
export const cameraBindingKey=(binding:CameraBinding|null):string|null=>{
 if(!binding||!binding.trackId||!Number.isInteger(binding.width)||!Number.isInteger(binding.height)||
  binding.width<1||binding.height<1||binding.width>8192||binding.height>8192)return null;
 return JSON.stringify([binding.trackId,binding.deviceId,binding.width,binding.height]);
};
export type LiveFloorStatus={
 calibrated:boolean;confirmed:boolean;cameraMatched:boolean;tracking:boolean;
 contacts:number;events:number;lastSeenMs:number|null;activePerformerIds:string[];reason:string;
 footMotions:{performerId:string;foot:FootSide;motion:GaitMotion;confidence:number}[];
};
/**
 * The single existing SOMA GaitAnalyzer supplies phase/stamp samples here.
 * No additional body tracker or webcam stream is instantiated.
 * Camera contact remains an inferred estimate, never measured pressure/force.
 */
export class LiveFloorTrackingEngine{
 private calibration:CameraFloorCalibration|null=null;
 private bindingKey:string|null=null;
 private confirmed=false;
 private eventEngine:FootstepEventEngine|null=null;
 private events:FootstepEvent[]=[];
 private grounded=new Set<string>();
 private performers=new Set<string>(['performer-1']);
 private lastPoint=new Map<string,FloorPoint>();
 private motion=new Map<string,{performerId:string;foot:FootSide;motion:GaitMotion;confidence:number}>();
 private seen=new Map<string,number>();
 private received=new Map<string,number>();
 private rejection='';
 private logicalTime=-1;
 private revision=0;
 private contactCount=0;
 private cachedSession:FloorSession|null=null;
 private cachedRevision=-1;
 private listeners=new Set<(value:FloorUpdate)=>void>();
 subscribe(listener:(value:FloorUpdate)=>void):()=>void{
  this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};
 }
 private emitUpdate(kind:FloorUpdateKind,eventCount=0,contactCount=0,cameraAt:number|null=null){
  if(this.listeners.size===0)return;
  const update:FloorUpdate={kind,revision:this.revision,emittedAtMs:performance.now(),
   cameraFrameSubmittedAtMs:cameraAt,eventCount,contactCount};
  for(const listener of this.listeners)listener(update);
 }
 get eventRevision(){return this.revision;}
 readonly performerId='performer-1';
 get floor(){return this.calibration?.floor??null;}
 get isConfirmed(){return this.confirmed;}
 get isCalibrated(){return !!this.calibration;}
 get boundCamera(){return this.bindingKey;}
 get calibrationData(){return this.calibration;}
 get session():FloorSession|null{
  if(!this.calibration)return null;
  if(this.cachedRevision!==this.revision||!this.cachedSession){
   this.cachedSession=createFloorSession(this.calibration.floor,this.events);
   this.cachedRevision=this.revision;
  }
  return this.cachedSession;
 }
 get status():LiveFloorStatus{
  return {calibrated:!!this.calibration,confirmed:this.confirmed,cameraMatched:!!this.bindingKey,
   tracking:this.confirmed&&this.received.size>0,contacts:this.contactCount,events:this.events.length,
   activePerformerIds:[...new Set([...this.received.keys()].map(k=>k.split(':')[0]))],
   footMotions:[...this.motion.values()],
   lastSeenMs:this.received.size?Math.max(...this.received.values()):null,
   reason:this.rejection||(!this.calibration?'Tandai empat sudut lantai di kamera.':
    !this.confirmed?'Periksa susunan empat sudut, lalu aktifkan pelacakan.':
    this.received.size?'Gerak kaki diterima. Pendaratan masih berupa estimasi.':'Menunggu kaki dalam bingkai kamera.')};
 }
 configure(raw:CameraFloorCalibration,binding:CameraBinding){
  const calibration=validateCameraFloorCalibration(raw),key=cameraBindingKey(binding);
  if(!key)throw Error('Kamera harus aktif dan resolusi video tersedia sebelum kalibrasi.');
  this.calibration=calibration;this.bindingKey=key;this.confirmed=false;
  this.eventEngine=new FootstepEventEngine(calibration.floor,.12);
  this.resetSession();this.rejection='';this.emitUpdate('calibration');
 }
 confirm(value:boolean){
  if(value&&(!this.calibration||!this.bindingKey))throw Error('Lengkapi kalibrasi kamera terlebih dahulu.');
  this.confirmed=value;
  if(!value)this.dropTracking();
  this.rejection='';this.emitUpdate('approval');
 }
 resetSession(){
  this.events=[];this.eventEngine?.reset();this.grounded.clear();
  this.lastPoint.clear();this.seen.clear();this.received.clear();this.motion.clear();this.logicalTime=-1;
  this.performers=new Set(['performer-1']);this.contactCount=0;
  this.cachedSession=null;this.cachedRevision=-1;this.revision++;this.emitUpdate('session');
 }
 revoke(reason='Kalibrasi kamera perlu diperiksa ulang.'){
  this.confirmed=false;this.dropTracking();this.rejection=reason;this.emitUpdate('revoke');
 }
 private dropTracking(){
  this.received.clear();this.grounded.clear();this.lastPoint.clear();this.seen.clear();this.motion.clear();
  for(const performerId of this.performers)for(const side of ['left','right'] as const)
   this.eventEngine?.loseTracking(performerId,side);
 }
 checkBinding(binding:CameraBinding|null):boolean{
  const matched=this.bindingKey!==null&&cameraBindingKey(binding)===this.bindingKey;
  if(this.confirmed&&!matched)this.revoke('Kamera atau resolusi berubah. Kalibrasikan ulang.');
  return matched;
 }
 lose(side:FootSide,performerId=this.performerId){
  const key=performerId+':'+side;
  this.received.delete(key);this.grounded.delete(key);this.lastPoint.delete(key);this.motion.delete(key);
  this.eventEngine?.loseTracking(performerId,side);
 }
 losePerformer(performerId:string){
  this.lose('left',performerId);this.lose('right',performerId);
 }
 ingest(sample:GaitSample|null,sideIndex:0|1,videoAspect:number,binding:CameraBinding|null,
  performerId=this.performerId,cameraFrameSubmittedAtMs:number|null=null):FootstepEvent[]{
  const side:FootSide=sideIndex===0?'left':'right';
  if(!['performer-1','A','B'].includes(performerId))throw Error('Performer tidak dikenal.');
  this.performers.add(performerId);
  const key=performerId+':'+side;
  if(!this.checkBinding(binding)||!this.confirmed||!this.calibration||!this.eventEngine)return [];
  if(!sample||!Number.isFinite(sample.t)||sample.t<0||sample.confidence<.55||
   sample.phase==='unknown'||!Number.isFinite(videoAspect)||videoAspect<=0){
   // Initial gait frames are UNKNOWN while stance debounce settles.
   // Only REARM a foot that has actually been observed before.
   // Otherwise the very first landing is silently suppressed.
   if(this.seen.has(key))this.lose(side,performerId);
   return [];
  }
  if((this.seen.get(key)??-1)>=sample.t)return [];
  const previous=this.seen.get(key);
  if(previous!==undefined&&sample.t-previous>450)this.lose(side,performerId);
  this.seen.set(key,sample.t);this.received.set(key,sample.t);
  this.motion.set(key,{performerId,foot:side,motion:sample.motionKind??'unknown',confidence:sample.confidence});
  const now=Math.max(this.logicalTime+1,Math.round(sample.t));
  this.logicalTime=now;
  const observe=(phase:'swing'|'stance',p:FloorPoint|null,heading:number)=>
   this.eventEngine!.observe({performerId,foot:side,
    timestampMs:now,phase,positionM:p,headingRad:heading,
    source:'camera',positionBasis:'calibrated-estimate',confidence:sample.confidence});
  let emitted:FootstepEvent[]=[];
  if(sample.phase==='swing'){
   emitted=observe('swing',null,0);this.grounded.delete(key);this.lastPoint.delete(key);
  }else if(sample.phase==='stance'&&(sample.stamp||this.grounded.has(key))){
   // Floor mapping is allowed only while the existing gait heuristic reports STANCE.
   // The first camera contact is emitted ONLY when the gait analyser stamps it.
   const grounded=calibratedGaitContact({...sample,stamp:true},videoAspect,this.calibration,performerId);
   if(!grounded){
    this.lose(side,performerId);
    this.rejection='Kaki di luar bidang lantai atau keyakinan deteksi terlalu rendah.';
    return [];
   }
   this.rejection='';
   const last=this.lastPoint.get(key);
   const distance=last?Math.hypot(last.xM-grounded.positionM.xM,last.yM-grounded.positionM.yM):0;
   // Keep the previously PRINTED ground location fixed until a new
   // meaningful floor movement is confirmed. Updating the anchor on every
   // tiny camera change would prevent accumulated slides from ever reaching
   // FootstepEventEngine's 0.12m move threshold.
   const position=this.grounded.has(key)&&last&&distance<.12?
    last:grounded.positionM;
   emitted=observe('stance',position,grounded.headingRad);
   if(emitted.some(e=>e.kind==='contact'))this.grounded.add(key);
   if(emitted.some(e=>e.kind==='contact'||e.kind==='move'))this.lastPoint.set(key,position);
  }
  if(this.events.length+emitted.length>100000){
   this.revoke('Sesi mencapai batas 100.000 event. Simpan dan mulai sesi baru.');
   return [];
  }
  if(emitted.length){this.events.push(...emitted);
   this.contactCount+=emitted.filter(e=>e.kind==='contact').length;
   this.revision++;
   this.emitUpdate('events',emitted.length,
    emitted.filter(e=>e.kind==='contact').length,cameraFrameSubmittedAtMs);}
  return emitted;
 }
}
