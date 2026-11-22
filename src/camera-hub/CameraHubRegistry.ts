/** Camera Hub V1: per-tab source catalog and consumer leases.
 * The registry observes Stage-owned streams; it never opens a second camera,
 * copies a video frame, enables projector output, or owns credentials.
 */
export type CameraSlot='stage1.track'|'stage2.visual'|'f3.cameraA'|'f3.cameraB';
export type CameraKind='usb'|'phone-webrtc'|'virtual'|'local-video';
export type CameraState='discovered'|'connecting'|'ready'|'routed'|'standby'|'recovering'|'stale'|'error'|'disconnected';
export type CameraRecord={
 cameraId:string;name:string;kind:CameraKind;state:CameraState;
 generation:number;lastFrameAt:number|null;connectedAt:number|null;
 assignments:CameraSlot[];error?:string;deviceId?:string;
};
export type CameraHubSnapshot={records:readonly CameraRecord[];connected:number;
 routed:number;capacity:number;overCapacity:boolean};
type Entry={record:CameraRecord;observers:Map<CameraSlot,{stream:MediaStream|null;fresh:boolean}>;
 streamBySlot:Map<CameraSlot,MediaStream|null>};
export const CAMERA_HUB_MAX_REGISTERED=10;
const ACTIVE_LIMIT=2;
const STALE_MS=1100;
export function cameraSourceId(deviceId:string){
 if(!deviceId)throw Error('Device ID tidak valid.');
 return 'device:'+deviceId;
}
export const cameraSlotLabel:Record<CameraSlot,string>={
 'stage1.track':'Stage 1 · Track','stage2.visual':'Stage 2 · Visual',
 'f3.cameraA':'F3 · Kamera A','f3.cameraB':'F3 · Kamera B'
};
const freshTrack=(stream:MediaStream|null)=>!!stream?.getVideoTracks().some(track=>
 track.readyState==='live'&&track.enabled&&!track.muted);
const normalize=(entry:Entry):CameraRecord=>({...entry.record,
 assignments:[...entry.observers.keys()]});
export class CameraHubRegistry{
 private entries=new Map<string,Entry>();
 private listeners=new Set<()=>void>();
 private snapshot:CameraHubSnapshot={records:[],connected:0,routed:0,capacity:CAMERA_HUB_MAX_REGISTERED,overCapacity:false};
 private currentSlots=new Map<CameraSlot,string>();
 private ordinal=0;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>this.listeners.delete(listener);};
 getSnapshot=()=>this.snapshot;
 private update(){
  const records=[...this.entries.values()].map(normalize);
  this.snapshot={records,connected:records.filter(r=>r.state==='ready'||r.state==='routed').length,
   routed:records.filter(r=>r.assignments.length>0).length,
   capacity:CAMERA_HUB_MAX_REGISTERED,overCapacity:records.length>CAMERA_HUB_MAX_REGISTERED};
  this.listeners.forEach(listener=>listener());
 }
 /** Catalog is metadata only. enumerateDevices never grants capture permission. */
 discover(devices:readonly {deviceId:string;label:string;kind:string}[]){
  const found=devices.filter(d=>d.kind==='videoinput'&&d.deviceId);
  const unique=new Set<string>();let changed=false;
  for(const d of found){
   const id=cameraSourceId(d.deviceId);
   if(unique.has(id))continue;unique.add(id);
   const existing=this.entries.get(id);
   if(existing){
    if(d.label&&existing.record.name!==d.label&&existing.record.state==='discovered'){
     existing.record.name=d.label;changed=true;
    }
    continue;
   }
   if(this.entries.size>=CAMERA_HUB_MAX_REGISTERED)break;
   this.entries.set(id,{record:{cameraId:id,name:d.label||'Kamera '+(++this.ordinal),
    kind:'usb',state:'discovered',generation:0,lastFrameAt:null,
    connectedAt:null,assignments:[],deviceId:d.deviceId},
    observers:new Map(),streamBySlot:new Map()});changed=true;
  }
  for(const [id,entry] of this.entries){
   if(entry.record.kind!=='usb'||unique.has(id)||entry.observers.size>0)continue;
   // A missing device becomes disconnected; retain its name for troubleshooting.
   if(entry.record.state!=='disconnected'){
    entry.record.state='disconnected';entry.record.lastFrameAt=null;
    entry.record.generation++;changed=true;
   }
  }
  if(changed)this.update();
 }
 /** Stage is the capture owner. Its stream is only referenced, never stopped here. */
 observe(input:{cameraId:string;slot:CameraSlot;name:string;kind:CameraKind;
  stream:MediaStream|null;fresh:boolean;now?:number;deviceId?:string}):boolean{
  const {cameraId,slot,kind}=input;
  if(!cameraId||!input.name)return false;
  // Reject a duplicate F3 device BEFORE releasing the slot's old feed.
  const forbidden=slot==='f3.cameraA'?'f3.cameraB':slot==='f3.cameraB'?'f3.cameraA':null;
  if(forbidden&&this.entries.get(cameraId)?.observers.has(forbidden))return false;
  const previous=this.currentSlots.get(slot);
  if(previous&&previous!==cameraId)this.release(slot);
  let entry=this.entries.get(cameraId);
  if(!entry){
   if(this.entries.size>=CAMERA_HUB_MAX_REGISTERED)return false;
   entry={record:{cameraId,name:input.name,kind,state:'connecting',
    generation:0,lastFrameAt:null,connectedAt:null,
    assignments:[],deviceId:input.deviceId},observers:new Map(),streamBySlot:new Map()};
   this.entries.set(cameraId,entry);
  }
  const was=entry.observers.get(slot),live=input.fresh&&freshTrack(input.stream);
  const now=input.now??(typeof performance==='undefined'?Date.now():performance.now());
  const changed=!was||was.stream!==input.stream||was.fresh!==live;
  if(changed)entry.record.generation++;
  entry.record.name=input.name;entry.record.kind=kind;
  if(input.deviceId)entry.record.deviceId=input.deviceId;
  entry.observers.set(slot,{stream:input.stream,fresh:live});
  entry.streamBySlot.set(slot,input.stream);
  this.currentSlots.set(slot,cameraId);
  if(live){
   entry.record.lastFrameAt=now;
   entry.record.connectedAt??=now;
   entry.record.state='routed';
  }else{
   entry.record.state='stale';
   entry.record.lastFrameAt=null;
  }
  if(changed)this.update();
  return true;
 }
 /** Update decoded-frame liveness without bumping identity/generation. */
 heartbeat(slot:CameraSlot,cameraId:string,now:number,fresh:boolean){
  const entry=this.entries.get(cameraId),observed=entry?.observers.get(slot);
  if(!entry||!observed||this.currentSlots.get(slot)!==cameraId)return false;
  const live=fresh&&freshTrack(observed.stream);
  if(live){
   entry.record.lastFrameAt=now;
   if(!observed.fresh){observed.fresh=true;entry.record.state='routed';this.update();}
  }else if(observed.fresh){
   observed.fresh=false;
   entry.record.state=[...entry.observers.values()].some(o=>o.fresh)?'routed':'stale';
   if(entry.record.state==='stale')entry.record.lastFrameAt=null;
   entry.record.generation++;this.update();
  }
  return live;
 }
 release(slot:CameraSlot){
  const id=this.currentSlots.get(slot);
  if(!id)return;
  const entry=this.entries.get(id);this.currentSlots.delete(slot);
  if(!entry)return;
  entry.observers.delete(slot);entry.streamBySlot.delete(slot);
  entry.record.generation++;
  if(!entry.observers.size){
   entry.record.state=entry.record.deviceId?'discovered':'disconnected';
   entry.record.lastFrameAt=null;entry.record.connectedAt=null;
  }else entry.record.state=[...entry.observers.values()].some(o=>o.fresh)?'routed':'stale';
  this.update();
 }
 markInterrupted(slot:CameraSlot,reason:string){
  const id=this.currentSlots.get(slot),entry=id?this.entries.get(id):null;
  if(!entry)return;
  entry.record.state='recovering';entry.record.error=reason;
  entry.record.lastFrameAt=null;entry.record.generation++;
  const observer=entry.observers.get(slot);if(observer)observer.fresh=false;
  this.update();
 }
 /** Inspect only a Stage-owned stream; no additional getUserMedia call. */
 preview(cameraId:string):MediaStream|null{
  const entry=this.entries.get(cameraId);
  if(!entry)return null;
  for(const observation of entry.observers.values())
   if(observation.fresh&&freshTrack(observation.stream))return observation.stream;
  return null;
 }
 getAssignment(slot:CameraSlot){return this.currentSlots.get(slot)??null;}
 /** Explicit lease validation; never silently steal another F3 camera. */
 canAssign(cameraId:string,slot:CameraSlot,expectedGeneration:number):{
  accepted:boolean;reason?:'STALE'|'CONFLICT'|'OVER_CAPACITY';}{
  const entry=this.entries.get(cameraId);
  if(!entry||entry.record.generation!==expectedGeneration||
   entry.record.state==='disconnected'||entry.record.state==='error'||
   entry.record.state==='stale'||entry.record.state==='recovering')
   return {accepted:false,reason:'STALE'};
  const peer=slot==='f3.cameraA'?'f3.cameraB':slot==='f3.cameraB'?'f3.cameraA':null;
  if(peer&&this.currentSlots.get(peer)===cameraId)
   return {accepted:false,reason:'CONFLICT'};
  const routed=new Set([...this.currentSlots.values()]);
  if(!routed.has(cameraId)&&routed.size>=ACTIVE_LIMIT)return {accepted:false,reason:'OVER_CAPACITY'};
  return {accepted:true};
 }
 dispose(){
  // Streams are owned by their Stage/adapter. This object never stops them.
  this.entries.clear();this.currentSlots.clear();this.listeners.clear();
  this.snapshot={records:[],connected:0,routed:0,capacity:CAMERA_HUB_MAX_REGISTERED,overCapacity:false};
 }
}
