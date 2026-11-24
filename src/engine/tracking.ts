import {LiveFrameGate,nextInferenceInterval} from './liveFrameGate.ts';
import {CameraLiveness} from './cameraLiveness.ts';
import {waitForDecodedVideo} from './decodedVideo.ts';
import {PoseWorkerClient} from './poseWorker';
import {unionMasks} from '../studio/bodyField.ts';
import type {HandLandmarker,PoseLandmarker,FaceLandmarker} from '@mediapipe/tasks-vision';
import {MotionProcessor} from './motion.ts';
import type {MotionFrame,Settings,InputKind} from './types.ts';
import {buildHorizontalCameraConstraints,DEFAULT_CAMERA_CAPTURE_SIZE} from './cameraConstraints.ts';
export class CameraTracker {
 private hand:HandLandmarker|null=null;private pose:PoseLandmarker|null=null;private face:FaceLandmarker|null=null;
 private stream:MediaStream|null=null;private device='';private processor=new MotionProcessor();private raf=0;private token=0;
 private poseWorker:PoseWorkerClient|null=null;private inFlight=false;private skippedFrames=0;private observedVideoTime=-1;
 private projectionEnabled=false;private captureSize:'480p'|'720p'=DEFAULT_CAMERA_CAPTURE_SIZE;
 setProjection(value:boolean){this.projectionEnabled=value;}
 async setCaptureSize(value:'480p'|'720p'){this.captureSize=value;const track=this.stream?.getVideoTracks()[0];if(track)await track.applyConstraints(buildHorizontalCameraConstraints({captureSize:value}));}
 private previousVideoTime=-1;private previousTime=0;private average=24;private interval=33;private lastTick=0;private staleSent=false;running=false;
 async start(video:HTMLVideoElement,settings:()=>Settings,onFrame:(f:MotionFrame)=>void,onStatus:(s:string)=>void,onError:(s:string)=>void,deviceId?:string,externalStream?:MediaStream){
  const deviceKey=externalStream?'phone-webrtc':(deviceId??'');
  const reuse=!externalStream&&!!this.stream?.active&&this.device===deviceKey;
  this.stop(undefined,reuse);const token=++this.token;this.running=true;
  try{
   if(!window.isSecureContext)throw new Error('Kamera memerlukan HTTPS atau localhost.');
   if(!externalStream&&!navigator.mediaDevices?.getUserMedia)throw new Error('Browser ini belum mendukung akses kamera.');
   const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');if(!gl)throw new Error('Gambar belum bisa diproses. Aktifkan akselerasi grafis browser, lalu coba lagi.');gl.getExtension('WEBGL_lose_context')?.loseContext();
   if(!reuse){
    onStatus(externalStream?'Menghubungkan video HP…':'Meminta akses kamera wide horizontal…');
    const stream=externalStream??await navigator.mediaDevices.getUserMedia({video:buildHorizontalCameraConstraints({captureSize:this.captureSize,deviceId}),audio:false});
    if(token!==this.token){if(!externalStream)stream.getTracks().forEach(t=>t.stop());return;}
    if(!stream.getVideoTracks().length)throw new Error('Sumber HP tidak mengirim track video.');
    this.stream=stream;this.device=deviceKey;
   }
   const stream=this.stream!;video.srcObject=stream;await waitForDecodedVideo(video,()=>token===this.token&&stream.active);if(token!==this.token)return;
   stream.getVideoTracks()[0].onended=()=>{if(this.running&&token===this.token){this.stop(video);onError('Kamera terputus. Sambungkan lalu mulai kembali.');}};
   const kind:InputKind=settings().input;onStatus('Memuat pelacak gerak…');const vision=await import('@mediapipe/tasks-vision');const files=await vision.FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);if(token!==this.token)return;
   if(kind==='body'&&typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'&&typeof createImageBitmap==='function'){
    this.pose?.close();this.pose=null;let worker:PoseWorkerClient|null=null;try{worker=new PoseWorkerClient();await worker.init();if(token!==this.token){worker.dispose();return;}this.poseWorker=worker;}catch{worker?.dispose();if(token!==this.token)return;onStatus('Worker belum tersedia · memakai pelacak utama…');}
   }
   const base={runningMode:'VIDEO' as const,minTrackingConfidence:.6};
   const loadMainPose=()=>vision.PoseLandmarker.createFromOptions(files,{...base,baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`,delegate:'CPU'},numPoses:2,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,outputSegmentationMasks:true});
   if(kind==='body'&&!this.poseWorker&&!this.pose){const model=await loadMainPose();if(token!==this.token){model.close();return;}this.pose=model;}
   else if(kind==='face'&&!this.face){const model=await vision.FaceLandmarker.createFromOptions(files,{...base,baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/face_landmarker.task`,delegate:'CPU'},numFaces:1,minFaceDetectionConfidence:.6,minFacePresenceConfidence:.6,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:false});if(token!==this.token){model.close();return;}this.face=model;}
   else if(kind==='hands'&&!this.hand){const model=await vision.HandLandmarker.createFromOptions(files,{...base,baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/hand_landmarker.task`,delegate:'CPU'},numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6});if(token!==this.token){model.close();return;}this.hand=model;}
   if(token!==this.token)return;this.processor.reset();this.previousVideoTime=-1;this.previousTime=0;this.lastTick=0;this.interval=33;this.staleSent=false;this.average=24;this.inFlight=false;this.skippedFrames=0;this.observedVideoTime=-1;onStatus(`Pelacak ${kind==='body'?'tubuh':kind==='face'?'wajah':'tangan'} siap`);
   const liveness=new CameraLiveness(),publication=new LiveFrameGate();
   let lastPublishedAt=performance.now();
   const clearStale=(now:number)=>{if(!this.staleSent&&now-lastPublishedAt>450){this.staleSent=true;publication.invalidate(now);this.processor.reset();onFrame(this.processor.process(null,null,now,settings(),0));}};
   const tick=async(time:number)=>{
    if(!this.running||token!==this.token)return;this.raf=requestAnimationFrame(tick);
    if(liveness.sample(video.currentTime,time,!document.hidden)){this.stop(video);onError('Gambar kamera berhenti. Periksa sambungan, lalu coba lagi.');return;}
    clearStale(time);
    if(video.readyState<2||video.currentTime===this.previousVideoTime)return;
    if(this.inFlight){if(video.currentTime!==this.observedVideoTime){if(this.observedVideoTime!==this.previousVideoTime)this.skippedFrames++;this.observedVideoTime=video.currentTime;}return;}
    if(time-this.lastTick<this.interval)return;
    this.lastTick=time;this.previousVideoTime=video.currentTime;this.observedVideoTime=video.currentTime;const begin=performance.now();
    try{
     const h=kind==='hands'?this.hand!.detectForVideo(video,time):null;
     this.inFlight=true;let workerResult:Awaited<ReturnType<PoseWorkerClient['detect']>>|null=null;
     if(kind==='body'&&this.poseWorker){try{workerResult=await this.poseWorker.detect(video,time,this.projectionEnabled);}catch(error){if(token!==this.token)return;this.poseWorker.dispose();this.poseWorker=null;onStatus('Worker terputus · memulihkan pelacak utama…');publication.invalidate(performance.now());this.processor.reset();const model=await loadMainPose();if(token!==this.token){model.close();return;}this.pose?.close();this.pose=model;this.processor.reset();this.inFlight=false;this.previousVideoTime=-1;onStatus('Pelacak tubuh siap');return;}}
     if(token!==this.token)return;
     const p=kind==='body'&&!workerResult?this.pose!.detectForVideo(video,time):null;
     const face=kind==='face'?this.face!.detectForVideo(video,time):null;
     if(!publication.accept(time,performance.now())){p?.close();this.inFlight=false;this.interval=nextInferenceInterval(performance.now()-begin,!!this.poseWorker);this.skippedFrames++;return;}
     if(this.previousTime&&time>this.previousTime)this.average=.85*this.average+.15*(1000/(time-this.previousTime));this.previousTime=time;
     this.staleSent=false;lastPublishedAt=performance.now();
     const inferenceMs=workerResult?.inferenceMs??(performance.now()-begin);
     try{const frame=this.processor.process(h,workerResult||p,time,settings(),this.average,face);if(workerResult){frame.segmentation=workerResult.segmentation;frame.projectionMask=workerResult.projectionMask;}if(p?.segmentationMasks){frame.segmentation=unionMasks(p.segmentationMasks);if(this.projectionEnabled)frame.projectionMask=unionMasks(p.segmentationMasks.slice(0,1),256);}frame.telemetry={inferenceMs,pipelineMs:performance.now()-begin,skippedFrames:this.skippedFrames,backend:workerResult?'worker':'main',capturedAt:time,completedAt:performance.now()};onFrame(frame);}finally{p?.close();}
     this.inFlight=false;this.interval=nextInferenceInterval(performance.now()-begin,!!this.poseWorker);
    }catch(e){if(token!==this.token)return;this.inFlight=false;this.stop(video);onError(`Pelacakan berhenti: ${e instanceof Error?e.message:'coba muat ulang kamera.'}`);}
   };this.raf=requestAnimationFrame(tick);
  }catch(e){if(token!==this.token)return;this.stop(video);const err=e && typeof e==='object' ? e as {name?:string;message?:string} : {};const detail=typeof err.message==='string'&&err.message.trim()?err.message:typeof e==='string'&&e.trim()?e:'Periksa izin kamera dan koneksi, lalu coba lagi.';onError(err.name==='NotAllowedError'?'Akses kamera ditolak. Izinkan kamera melalui pengaturan browser, lalu coba lagi.':err.name==='NotFoundError'?'Kamera belum ditemukan. Sambungkan kamera, lalu coba lagi.':err.name==='NotReadableError'?'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.':`Kamera atau pelacak belum siap. ${detail}`);}
 }
 stop(video?:HTMLVideoElement,keepStream=false){this.running=false;this.token++;this.poseWorker?.dispose();this.poseWorker=null;this.inFlight=false;cancelAnimationFrame(this.raf);if(!keepStream){this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;if(video){video.pause();video.srcObject=null;}}this.processor.reset();}
 dispose(video?:HTMLVideoElement){this.stop(video);this.hand?.close();this.pose?.close();this.face?.close();this.hand=null;this.pose=null;this.face=null;}
}
