import {FilesetResolver,PoseLandmarker} from '@mediapipe/tasks-vision';
import type {Landmark} from '../engine/types.ts';
import {duetSearchRegions,remapPoseFromCrop,rescuePoseQuality,
 mergeRescueDetections,type RescuedPose} from './duetPoseRescue.ts';

type Init={type:'init';base:string};
type Frame={type:'frame';id:number;bitmap:ImageBitmap;clock:number;targetCount?:1|2};
type Request=Init|Frame;
let pose:PoseLandmarker|null=null;
let rescue:PoseLandmarker|null=null;
let rescueLoading:Promise<void>|null=null;
let basePath='';
let files:Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>|null=null;
let lastClock=-1,lastRescueClock=-Infinity;
const RESCUE_INTERVAL_MS=480;
const send=(data:unknown)=>self.postMessage(data);
function prepareRescue(){
 if(rescueLoading||rescue||!files)return;
 const selected=files;
 rescueLoading=PoseLandmarker.createFromOptions(selected,{
  baseOptions:{modelAssetPath:basePath+'models/pose_landmarker_lite.task',delegate:'CPU'},
  runningMode:'IMAGE',numPoses:1,minPoseDetectionConfidence:.42,
  minPosePresenceConfidence:.43,minTrackingConfidence:.5,outputSegmentationMasks:false
 }).then(model=>{rescue=model;}).catch(()=>{rescue=null;});
}
/** Rescue runs only when primary multi-person inference returns <2 humans.
 * It is deliberately bounded to two crops at most once per 480 ms.
 * An unreliable crop is discarded, never treated as an actual second actor.
 */
function recover(bitmap:ImageBitmap,landmarks:Landmark[][],
 worldLandmarks:Landmark[][],atMs:number){
 if(!rescue||typeof OffscreenCanvas==='undefined'||landmarks.length>=2||
  atMs-lastRescueClock<RESCUE_INTERVAL_MS)return 0;
 lastRescueClock=atMs;
 const crops=duetSearchRegions(landmarks);
 const candidates:RescuedPose[]=[];
 for(const region of crops){
  const surface=new OffscreenCanvas(480,640);
  const ctx=surface.getContext('2d');if(!ctx)continue;
  ctx.drawImage(bitmap,region.x*bitmap.width,region.y*bitmap.height,
   region.width*bitmap.width,region.height*bitmap.height,0,0,480,640);
  const sample=surface.transferToImageBitmap();
  try{
   const result=rescue.detect(sample);
   const raw=result.landmarks[0];
   if(raw&&raw.length===33){
    const converted=remapPoseFromCrop(raw.map(p=>({...p})) as Landmark[],region);
    const quality=rescuePoseQuality(converted);
    if(quality>=.68)candidates.push({landmarks:converted,
     worldLandmarks:(result.worldLandmarks[0]??[]).map(p=>({...p})) as Landmark[],
     quality});
   }
   result.close();
  }catch{/* A bad cropped frame must not interrupt the primary detector. */}
  finally{sample.close();}
 }
 const merged=mergeRescueDetections(landmarks,candidates);
 if(merged.rescued.length){
  for(const r of merged.rescued){
   landmarks.push(r.landmarks);
   worldLandmarks.push(r.worldLandmarks);
  }
 }
 return merged.rescued.length;
}
self.onmessage=async(event:MessageEvent<Request>)=>{
 const value=event.data;
 if(value.type==='init'){
  try{
   basePath=value.base;
   files=await FilesetResolver.forVisionTasks(value.base+'wasm');
   pose=await PoseLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:value.base+'models/pose_landmarker_lite.task',delegate:'CPU'},
    runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.48,
    minPosePresenceConfidence:.46,minTrackingConfidence:.52,outputSegmentationMasks:false
   });
   send({type:'ready'});
  }catch(e){send({type:'error',message:e instanceof Error?e.message:String(e)});}
  return;
 }
 const bitmap=value.bitmap;
 try{
  if(!pose)throw Error('Model pose worker belum siap');
  const clock=Math.max(value.clock,lastClock+1);lastClock=clock;
  const start=performance.now();
  const result=pose.detectForVideo(bitmap,clock);
  const landmarks=result.landmarks.map(points=>points.map(p=>({...p}))) as Landmark[][];
  const worldLandmarks=result.worldLandmarks.map(points=>points.map(p=>({...p}))) as Landmark[][];
  result.close();
  let rescuedCount=0;
  if(value.targetCount===2&&landmarks.length<2){
   prepareRescue();
   rescuedCount=recover(bitmap,landmarks,worldLandmarks,clock);
  }
  const poseMs=performance.now()-start;
  send({type:'result',id:value.id,landmarks,worldLandmarks,poseMs,rescuedCount});
 }catch(e){send({type:'error',id:value.id,message:e instanceof Error?e.message:String(e)});}
 finally{bitmap.close();}
};
