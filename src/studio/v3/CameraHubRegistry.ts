import {CameraTracker} from '../../engine/tracking.ts';
import {defaults,type MotionFrame,type Settings} from '../../engine/types.ts';
import {cameraErrorMessage} from '../../engine/universalCamera.ts';

/**
 * One independent CameraTracker per registered webcam/USB/OS-exposed phone camera.
 * This is the SAME body-pose engine used by Stage 1 Track, not a duplicate
 * MediaPipe pipeline. App owns this registry across sidebar navigation.
 *
 * A session belongs to this registry until Remove/Disconnect or App teardown.
 * The Stage 1 source is observed separately, never opened here a second time.
 */
export type HubCameraPhase='idle'|'connecting'|'live'|'stale'|'error';
export type HubCameraRecord={
 id:string;deviceId:string;name:string;
 phase:HubCameraPhase;message:string;showSkeleton:boolean;
 frames:number;frameAt:number;fps:number;detectedBodies:number;
};
type Entry={
 record:HubCameraRecord;tracker:CameraTracker;video:HTMLVideoElement;
 frame:MotionFrame|null;epoch:number;lastNotify:number;
};
const settings:Settings={...defaults(),input:'body',poseInLab:true,
 layers:{...defaults().layers,tracking:'detected'}};
const maxNameLength=64;
export function hubDisplayName(label:string):string{
 return label.trim().slice(0,maxNameLength)||'Kamera baru';
}
export function hubSourceAvailable(deviceId:string,records:readonly Pick<HubCameraRecord,'deviceId'>[]):boolean{
 return Boolean(deviceId)&&!records.some(x=>x.deviceId===deviceId);
}
export function hubFrameIsFresh(frameAt:number,now:number,limitMs=650):boolean{
 return Number.isFinite(frameAt)&&frameAt>0&&now>=frameAt&&now-frameAt<limitMs;
}
export function hubBodyCount(frame:MotionFrame|null):number{
 if(!frame||!frame.tracked)return 0;
 const poses=frame.poses?.filter(p=>p.length>=33)??[];
 return Math.min(2,poses.length||(frame.pose?.length>=33?1:0));
}
export class CameraHubRegistry {
 private entries=new Map<string,Entry>();
 private listeners=new Set<()=>void>();
 subscribe=(listener:()=>void)=>{
  this.listeners.add(listener);
  return()=>{this.listeners.delete(listener);};
 };
 private emit(){for(const listener of this.listeners)listener();}
 snapshot():HubCameraRecord[]{return [...this.entries.values()].map(x=>({...x.record}));}
 get(id:string){return this.entries.get(id)?.record??null;}
 feed(id:string):{video:HTMLVideoElement;frame:MotionFrame|null;frameAt:number}|null{
  const entry=this.entries.get(id);
  return entry?{video:entry.video,frame:entry.frame,frameAt:entry.record.frameAt}:null;
 }
 findDevice(deviceId:string):HubCameraRecord|null{
  return this.snapshot().find(x=>x.deviceId===deviceId)??null;
 }
 create(deviceId:string,label:string):string{
  if(!hubSourceAvailable(deviceId,this.snapshot()))
   throw Error('Kamera ini sudah terdaftar. Pilih node yang ada.');
  const id=crypto.randomUUID();
  const video=document.createElement('video');
  video.autoplay=true;video.muted=true;video.playsInline=true;
  // Preview video is DOM-detached, preserving source processing when changing
  // internal SOMA workspaces without re-requesting browser permissions.
  const entry:Entry={tracker:new CameraTracker(),video,frame:null,epoch:0,lastNotify:0,
   record:{id,deviceId,name:hubDisplayName(label),phase:'idle',message:'Siap dihubungkan',
    showSkeleton:true,frames:0,frameAt:0,fps:0,detectedBodies:0}};
  this.entries.set(id,entry);this.emit();return id;
 }
 async connect(id:string):Promise<void>{
  const entry=this.entries.get(id);if(!entry)return;
  entry.epoch++;const epoch=entry.epoch;
  entry.tracker.stop(entry.video);
  entry.frame=null;entry.record.frameAt=0;entry.record.frames=0;entry.record.detectedBodies=0;
  entry.record.phase='connecting';entry.record.message='Meminta izin kamera…';this.emit();
  const current=()=>this.entries.get(id)===entry&&entry.epoch===epoch;
  try{
   await entry.tracker.start(entry.video,()=>settings,frame=>{
    if(!current())return;
    entry.frame=frame;entry.record.frames++;
    entry.record.frameAt=performance.now();
    entry.record.fps=frame.fps;
    entry.record.detectedBodies=hubBodyCount(frame);
    if(entry.video.readyState>=2&&!entry.video.paused){
     entry.record.phase='live';
     entry.record.message=entry.record.detectedBodies?
      `${entry.record.detectedBodies} tubuh terdeteksi`:'Video LIVE · mencari tubuh';
    }
    if(performance.now()-entry.lastNotify>280){
     entry.lastNotify=performance.now();this.emit();
    }
   },status=>{
    if(!current())return;
    if(entry.record.phase==='connecting'){entry.record.message=status;this.emit();}
   },error=>{
    if(!current())return;
    entry.frame=null;entry.record.frameAt=0;entry.record.phase='error';
    entry.record.message=error;this.emit();
   },entry.record.deviceId);
   if(current()&&entry.record.phase==='connecting'&&entry.video.readyState>=2){
    entry.record.phase='live';entry.record.message='Video LIVE · mencari tubuh';this.emit();
   }
  }catch(error){
   if(!current())return;
   entry.record.phase='error';entry.record.message=cameraErrorMessage(error);this.emit();
  }
 }
 rename(id:string,name:string){
  const entry=this.entries.get(id);if(!entry)return;
  entry.record.name=hubDisplayName(name);this.emit();
 }
 setSkeleton(id:string,enabled:boolean){
  const entry=this.entries.get(id);if(!entry)return;
  entry.record.showSkeleton=enabled;this.emit();
 }
 async replace(id:string,deviceId:string,label:string){
  const entry=this.entries.get(id);if(!entry)return;
  if(deviceId!==entry.record.deviceId&&!hubSourceAvailable(deviceId,this.snapshot()))
   throw Error('Kamera sudah digunakan oleh node lain.');
  this.disconnect(id);
  entry.record.deviceId=deviceId;entry.record.name=hubDisplayName(label);
  this.emit();await this.connect(id);
 }
 disconnect(id:string){
  const entry=this.entries.get(id);if(!entry)return;
  entry.epoch++;entry.tracker.stop(entry.video);
  entry.video.pause();entry.video.srcObject=null;
  entry.frame=null;entry.record.phase='idle';entry.record.message='Terputus oleh operator';
  entry.record.frameAt=0;entry.record.fps=0;entry.record.detectedBodies=0;this.emit();
 }
 remove(id:string){
  const entry=this.entries.get(id);if(!entry)return;
  this.disconnect(id);entry.tracker.dispose(entry.video);this.entries.delete(id);this.emit();
 }
 dispose(){
  for(const id of [...this.entries.keys()])this.remove(id);
  this.listeners.clear();
 }
}
