import {FilesetResolver,PoseLandmarker} from '@mediapipe/tasks-vision';
import type {Landmark} from '../engine/types.ts';

type Init={type:'init';base:string};
type Frame={type:'frame';id:number;bitmap:ImageBitmap;clock:number};
type Request=Init|Frame;
let pose:PoseLandmarker|null=null;
let lastClock=-1;
const send=(data:unknown)=>self.postMessage(data);
self.onmessage=async(event:MessageEvent<Request>)=>{
 const value=event.data;
 if(value.type==='init'){
  try{
   const files=await FilesetResolver.forVisionTasks(value.base+'wasm');
   pose=await PoseLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:value.base+'models/pose_landmarker_lite.task',delegate:'CPU'},
    runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.6,
    minPosePresenceConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false
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
  const poseMs=performance.now()-start;
  const landmarks=result.landmarks.map(points=>points.map(p=>({...p}))) as Landmark[][];
  const worldLandmarks=result.worldLandmarks.map(points=>points.map(p=>({...p}))) as Landmark[][];
  result.close();
  send({type:'result',id:value.id,landmarks,worldLandmarks,poseMs});
 }catch(e){send({type:'error',id:value.id,message:e instanceof Error?e.message:String(e)});}
 finally{bitmap.close();}
};
