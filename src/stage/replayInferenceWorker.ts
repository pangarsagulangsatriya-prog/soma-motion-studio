import {FilesetResolver,HandLandmarker,PoseLandmarker} from '@mediapipe/tasks-vision';
import type {Landmark} from '../engine/types.ts';

type Init={type:'init';base:string};
type Frame={type:'frame';id:number;bitmap:ImageBitmap;clock:number;hands:boolean};
type Request=Init|Frame;
let pose:PoseLandmarker|null=null,hand:HandLandmarker|null=null;
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
   let handReason='';
   try{
    hand=await HandLandmarker.createFromOptions(files,{
     baseOptions:{modelAssetPath:value.base+'models/hand_landmarker.task',delegate:'CPU'},
     runningMode:'VIDEO',numHands:4,minHandDetectionConfidence:.55,
     minHandPresenceConfidence:.55,minTrackingConfidence:.55
    });
   }catch(e){handReason=e instanceof Error?e.message:String(e);hand=null;}
   send({type:'ready',handsReady:!!hand,handReason});
  }catch(e){send({type:'error',message:e instanceof Error?e.message:String(e)});}
  return;
 }
 if(value.type!=='frame')return;
 const bitmap=value.bitmap;
 try{
  if(!pose)throw Error('Model pose worker belum siap');
  const clock=Math.max(value.clock,lastClock+1);lastClock=clock;
  let start=performance.now();
  const result=pose.detectForVideo(bitmap,clock);
  const poseMs=performance.now()-start;
  const landmarks=result.landmarks.map(points=>points.map(p=>({...p}))) as Landmark[][];
  const worldLandmarks=result.worldLandmarks.map(points=>points.map(p=>({...p}))) as Landmark[][];
  result.close();
  let hands:Landmark[][]|null=null,handsMs=0;
  if(value.hands&&hand){
   start=performance.now();
   const detail=hand.detectForVideo(bitmap,clock);
   hands=detail.landmarks.slice(0,4).map(points=>points.map(p=>({...p}))) as Landmark[][];
   if('close' in detail&&typeof detail.close==='function')detail.close();
   handsMs=performance.now()-start;
  }
  send({type:'result',id:value.id,landmarks,worldLandmarks,hands,
   poseMs,handsMs,handScanned:hands!==null,handReady:!!hand});
 }catch(e){send({type:'error',id:value.id,message:e instanceof Error?e.message:String(e)});}
 finally{bitmap.close();}
};
