import type {PoseLandmarker,HandLandmarker} from '@mediapipe/tasks-vision';
import type {F3MotionFrame} from './F3Types.ts';
/** Same decoded video A frame and one monotonic timestamp for both MediaPipe calls. */
export class F3MotionFusion{
 private pose:PoseLandmarker|null=null;
 private hand:HandLandmarker|null=null;
 private loading:Promise<void>|null=null;
 private lastFrame=-1;
 private lastTime=0;
 status:'idle'|'loading'|'ready'|'error'='idle';
 error='';
 async init(){
  if(this.loading)return this.loading;
  this.status='loading';
  this.loading=(async()=>{
   try{
    const vision=await import('@mediapipe/tasks-vision');
    const files=await vision.FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
    const base={runningMode:'VIDEO' as const,minTrackingConfidence:.6};
    const [pose,hand]=await Promise.all([
     vision.PoseLandmarker.createFromOptions(files,{...base,baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`,delegate:'CPU'},numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55}),
     vision.HandLandmarker.createFromOptions(files,{...base,baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/hand_landmarker.task`,delegate:'CPU'},numHands:2,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55})
    ]);
    this.pose=pose;this.hand=hand;this.status='ready';
   }catch(e){this.status='error';this.error=e instanceof Error?e.message:'Gagal memuat gestur';throw e;}
  })();
  return this.loading;
 }
 sample(video:HTMLVideoElement,frameId:number,now:number):F3MotionFrame|null{
  if(this.status!=='ready'||!this.pose||!this.hand||video.readyState<2||frameId===this.lastFrame)return null;
  this.lastFrame=frameId;
  const timestamp=Math.max(this.lastTime+1,Math.floor(now));
  this.lastTime=timestamp;
  const pose=this.pose.detectForVideo(video,timestamp);
  const hands=this.hand.detectForVideo(video,timestamp);
  return {frameId,timestamp,videoTime:video.currentTime,pose:pose.landmarks[0]??[],hands:hands.landmarks??[],
   confidence:pose.landmarks[0]?.[11]&&hands.landmarks?.length?1:0,fresh:true};
 }
 dispose(){this.pose?.close();this.hand?.close();this.pose=null;this.hand=null;this.loading=null;this.status='idle';this.lastFrame=-1;}
}
