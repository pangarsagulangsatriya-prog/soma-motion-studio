import {CameraLiveness} from '../engine/cameraLiveness.ts';
import type {F3Role,F3CameraStatus} from './F3Types.ts';

/** Owns exactly two independently selected sources; never borrows Track's video element. */
export class F3CameraRegistry{
 private entries=new Map<F3Role,{video:HTMLVideoElement;stream:MediaStream|null;url:string|null;status:F3CameraStatus;liveness:CameraLiveness;lastArrival:number}>();
 private sequence=0;
 private listeners=new Set<()=>void>();
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>this.listeners.delete(listener);};
 private emit(){this.listeners.forEach(fn=>fn());}
 private makeStatus(role:F3Role,kind:'camera'|'fixture'='camera'):F3CameraStatus{
  return {role,id:'',kind,state:'idle',lastFrameAt:0,frameId:0,videoTime:-1,message:'Pilih sumber'};
 }
 attach(role:F3Role,video:HTMLVideoElement){
  const item=this.entries.get(role);
  if(item&&item.video!==video){video.srcObject=item.stream;if(item.url)video.src=item.url;void video.play().catch(()=>{});item.video=video;}
  else if(!item)this.entries.set(role,{video,stream:null,url:null,status:this.makeStatus(role),liveness:new CameraLiveness(),lastArrival:0});
 }
 status(role:F3Role):F3CameraStatus{return {...(this.entries.get(role)?.status??this.makeStatus(role))};}
 video(role:F3Role){return this.entries.get(role)?.video??null;}
 bothReady(now:number){return this.fresh('A',now)&&this.fresh('B',now);}
 fresh(role:F3Role,now:number,timeout=850){
  const e=this.entries.get(role);return !!e&&e.status.state==='live'&&e.status.lastFrameAt>0&&now-e.status.lastFrameAt<timeout;
 }
 private require(role:F3Role){const e=this.entries.get(role);if(!e)throw Error('Video '+role+' belum tersedia.');return e;}
 async connectDevice(role:F3Role,deviceId:string){
  const e=this.require(role),other=this.entries.get(role==='A'?'B':'A');
  if(other?.status.kind==='camera'&&other.status.id===deviceId&&other.status.state!=='idle')
   throw Error('Kamera A dan B harus memakai perangkat berbeda.');
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Browser belum memberi akses kamera lewat HTTPS.');
  this.disconnect(role);
  e.status={...this.makeStatus(role),kind:'camera',state:'connecting',message:'Menghubungkan kamera…'};this.emit();
  const connection=++this.sequence;e.status.id=deviceId||'default';
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:{deviceId:deviceId?{exact:deviceId}:undefined},audio:false});
   if(e.status.state!=='connecting'||e.status.id!==(deviceId||'default')){stream.getTracks().forEach(t=>t.stop());return;}
   e.stream=stream;
   e.video.removeAttribute('src');e.video.srcObject=stream;e.video.muted=true;e.video.playsInline=true;
   const track=stream.getVideoTracks()[0];
   track.addEventListener('ended',()=>{if(e.stream===stream){e.status.state='stale';e.status.message='Kamera terputus';this.emit();}});
   await e.video.play();
   e.status.state='connecting';e.status.message='Menunggu frame…';this.emit();
   void connection;
  }catch(err){this.disconnect(role);e.status={...this.makeStatus(role),state:'error',message:err instanceof Error?err.message:'Gagal membuka kamera'};this.emit();throw err;}
 }
 async connectFixture(role:F3Role,file:File){
  const e=this.require(role);this.disconnect(role);
  const url=URL.createObjectURL(file);e.url=url;
  e.status={...this.makeStatus(role,'fixture'),id:role+'-'+file.name,kind:'fixture',state:'connecting',message:'Menyiapkan MP4 simulasi…'};
  e.video.src=url;e.video.srcObject=null;e.video.loop=true;e.video.muted=true;e.video.playsInline=true;this.emit();
  try{await e.video.play();}catch(err){this.disconnect(role);throw err;}
 }
 /** Called from one shared RAF. Liveness measures decoded frames, not pose detection. */
 poll(now:number){
  for(const e of this.entries.values()){
   if(e.status.state==='idle'||e.status.state==='error')continue;
   const v=e.video,track=e.stream?.getVideoTracks()[0];
   if(track&&track.readyState!=='live'){e.status.state='stale';e.status.message='Video terputus';this.emit();continue;}
   const valid=v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0&&!v.paused;
   if(!valid){if(e.status.lastFrameAt&&now-e.status.lastFrameAt>850&&e.status.state!=='stale'){e.status.state='stale';e.status.message='Frame berhenti';this.emit();}continue;}
   const videoTime=v.currentTime;
   if(videoTime!==e.status.videoTime){
    e.status.frameId++;e.status.videoTime=videoTime;e.status.lastFrameAt=now;e.lastArrival=now;
    if(e.status.state!=='live'){e.status.state='live';e.status.message=e.status.kind==='fixture'?'SIMULASI':'LIVE';this.emit();}
   }else if(e.lastArrival&&now-e.lastArrival>850&&e.status.state==='live'){
    e.status.state='stale';e.status.message='Frame beku';this.emit();
   }
   // Preserve SOMA CameraLiveness semantics alongside the fast shutter stale gate.
   e.liveness.sample(videoTime,now,true);
  }
 }
 disconnect(role:F3Role){
  const e=this.entries.get(role);if(!e)return;
  e.stream?.getTracks().forEach(t=>t.stop());e.stream=null;
  e.video.pause();e.video.srcObject=null;e.video.removeAttribute('src');
  if(e.url){URL.revokeObjectURL(e.url);e.url=null;}
  e.status=this.makeStatus(role);e.lastArrival=0;e.liveness=new CameraLiveness();this.emit();
 }
 dispose(){this.disconnect('A');this.disconnect('B');this.listeners.clear();}
}
