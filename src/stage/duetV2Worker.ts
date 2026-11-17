import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-wasm';
import {setWasmPaths} from '@tensorflow/tfjs-backend-wasm';
import * as poseDetection from '@tensorflow-models/pose-detection';
import {FilesetResolver,PoseLandmarker} from '@mediapipe/tasks-vision';
import type {Landmark} from '../engine/types.ts';
import {DuetIdentityManager,expandedDuetRoi,sampleTorsoColor,type DuetActor,
 type DuetBox,type DuetIdentityFrame,type DuetPerson} from './duetV2Identity.ts';

export type DuetV2Point={x:number;y:number;score:number};
export type DuetV2Pose={
 actor:'A'|'B';region:DuetBox;landmarks:Landmark[];
 worldLandmarks:Landmark[];quality:number;source:'crop33';
};
export type DuetV2Frame={
 timeMs:number;resolution:384|512;people:DuetPerson[];
 keypoints:DuetV2Point[][];identity:DuetIdentityFrame;
 details:DuetV2Pose[];timings:{detectorMs:number;crop33Ms:number;totalMs:number};
};
type Init={type:'init';id:number;base:string;resolution:384|512;detailed:boolean};
type Analyze={type:'frame';id:number;bitmap:ImageBitmap;timeMs:number;
 detector:boolean;detailed:boolean};
type Reset={type:'reset';id:number};
type Request=Init|Analyze|Reset;
let detector:poseDetection.PoseDetector|null=null;
let detail:PoseLandmarker|null=null;
let identity=new DuetIdentityManager();
let resolution:384|512=384;
let runtimeBase='';
let lastTime=-1;
let lastDetectorAt=-Infinity;
let cachedPeople:DuetPerson[]=[];
let cachedPoints:DuetV2Point[][]=[];
let lastIdentity:DuetIdentityFrame|null=null;
const publish=(message:unknown)=>self.postMessage(message);
const errorMessage=(error:unknown)=>error instanceof Error?error.message:String(error);
function reset(){
 identity.reset();lastTime=-1;lastDetectorAt=-Infinity;
 cachedPeople=[];cachedPoints=[];lastIdentity=null;
}
async function initialize(request:Init){
 if(detector){detector.dispose();detector=null;}
 if(detail){detail.close();detail=null;}
 reset();resolution=request.resolution;runtimeBase=request.base;
 setWasmPaths(runtimeBase+'tfjs-wasm/');
 await tf.setBackend('wasm');await tf.ready();
 detector=await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet,{
  modelType:poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
  multiPoseMaxDimension:resolution,enableTracking:true,
  trackerType:poseDetection.TrackerType.BoundingBox,
  minPoseScore:.12,enableSmoothing:false
 });
 if(request.detailed)await ensureDetail();
}
async function ensureDetail(){
 if(detail)return;
 const files=await FilesetResolver.forVisionTasks(runtimeBase+'wasm');
 detail=await PoseLandmarker.createFromOptions(files,{
  baseOptions:{modelAssetPath:runtimeBase+'models/pose_landmarker_lite.task',delegate:'CPU'},
  runningMode:'IMAGE',numPoses:1,minPoseDetectionConfidence:.46,
  minPosePresenceConfidence:.46,minTrackingConfidence:.5,outputSegmentationMasks:false
 });
}
const remap=(points:readonly Landmark[],roi:DuetBox):Landmark[]=>
 points.map(p=>({...p,
  x:roi.x+p.x*roi.width,y:roi.y+p.y*roi.height,z:p.z*roi.width}));
const quality=(points:readonly Landmark[])=>{
 if(points.length!==33)return 0;
 const indices=[11,12,23,24,25,26,27,28];
 const visible=indices.map(i=>points[i]).filter(p=>
  !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  (p.visibility??0)>=.34);
 if(visible.length<5)return 0;
 return visible.reduce((sum,p)=>sum+(p.visibility??0),0)/indices.length;
};
function fullFrame(bitmap:ImageBitmap){
 const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('2D canvas tidak tersedia di Worker');
 ctx.drawImage(bitmap,0,0);
 return {canvas,ctx,pixels:ctx.getImageData(0,0,bitmap.width,bitmap.height)};
}
async function detectPeople(pixels:ImageData,timeMs:number){
 if(!detector)throw Error('MoveNet belum dimuat');
 const raw=await detector.estimatePoses(pixels,undefined,timeMs);
 const people:DuetPerson[]=[];
 const keypoints:DuetV2Point[][]=[];
 for(const person of raw){
  const box=person.box;
  if(!box||!Number.isFinite(box.xMin)||!Number.isFinite(box.yMin))continue;
  const normalized:DuetBox={
   x:Math.max(0,box.xMin/pixels.width),y:Math.max(0,box.yMin/pixels.height),
   width:Math.min(1,box.width/pixels.width),
   height:Math.min(1,box.height/pixels.height)
  };
  const score=person.score??0;
  if(score<.12||normalized.width<.03||normalized.height<.08)continue;
  const detected:DuetPerson={box:normalized,score,trackerId:person.id??null};
  detected.color=sampleTorsoColor(pixels,detected);
  people.push(detected);
  keypoints.push(person.keypoints.map(k=>({
   x:k.x/pixels.width,y:k.y/pixels.height,score:k.score??0
  })));
 }
 return {people,keypoints};
}
function detailForActor(bitmap:ImageBitmap,actor:DuetActor):DuetV2Pose|null{
 if(!detail||!actor.box||actor.lastSeenAtMs===null)return null;
 const roi=expandedDuetRoi(actor.box,.26,.22);
 const w=480,h=640;
 const canvas=new OffscreenCanvas(w,h);
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.drawImage(bitmap,roi.x*bitmap.width,roi.y*bitmap.height,
  roi.width*bitmap.width,roi.height*bitmap.height,0,0,w,h);
 const cropped=canvas.transferToImageBitmap();
 try{
  const result=detail.detect(cropped);
  const first=result.landmarks[0];
  if(!first||first.length!==33){result.close();return null;}
  const mapped=remap(first.map(p=>({...p})) as Landmark[],roi);
  const confidence=quality(mapped);
  const world=(result.worldLandmarks[0]??[]).map(p=>({...p})) as Landmark[];
  result.close();
  if(confidence<.45)return null;
  return {actor:actor.id,region:roi,landmarks:mapped,
   worldLandmarks:world,quality:confidence,source:'crop33'};
 }finally{cropped.close();}
}
async function analyze(request:Analyze):Promise<DuetV2Frame>{
 if(!detector)throw Error('Detektor MoveNet belum siap');
 if(request.timeMs<=lastTime)reset();
 lastTime=request.timeMs;
 const start=performance.now();
 const bitmap=request.bitmap;
 const {pixels}=fullFrame(bitmap);
 let detectorMs=0;
 let observations:DuetPerson[]=[];
 let keypoints:DuetV2Point[][]=[];
 // Full D1 benchmark always forces the detector. During D4 live mode the
 // client decimates detector runs, keeping valid ROI tracking separate.
 if(request.detector||!lastIdentity||request.timeMs-lastDetectorAt>=230){
  const t=performance.now();
  const found=await detectPeople(pixels,request.timeMs);
  detectorMs=performance.now()-t;
  observations=found.people;keypoints=found.keypoints;
  lastDetectorAt=request.timeMs;
  cachedPeople=observations;cachedPoints=keypoints;
 }
 const observed=identity.observe(observations,request.timeMs);
 lastIdentity=observed;
 const details:DuetV2Pose[]=[];
 let crop33Ms=0;
 if(request.detailed){
  await ensureDetail();
  const t=performance.now();
  for(const actor of observed.actors){
   // A previously confirmed ROI stays eligible for a short interval.
   // The crop model must independently return 33 valid points.
   const age=request.timeMs-(actor.lastSeenAtMs??-Infinity);
   if(age>320||actor.status==='uncertain'||actor.status==='lost')continue;
   try{
    const detected=detailForActor(bitmap,actor);
    if(detected)details.push(detected);
   }catch{/* failure of A must not suppress B */}
  }
  crop33Ms=performance.now()-t;
 }
 return {timeMs:request.timeMs,resolution,
  people:cachedPeople,keypoints:cachedPoints,
  identity:observed,details,
  timings:{detectorMs,crop33Ms,totalMs:performance.now()-start}};
}
self.onmessage=(event:MessageEvent<Request>)=>{
 const data=event.data;
 void (async()=>{
  try{
   if(data.type==='init'){await initialize(data);
    publish({type:'ready',id:data.id,resolution});return;}
   if(data.type==='reset'){reset();publish({type:'reset',id:data.id});return;}
   if(data.type==='frame'){
    try{
     const frame=await analyze(data);
     publish({type:'result',id:data.id,frame});
    }finally{data.bitmap.close();}
   }
  }catch(error){
   if(data.type==='frame'){try{data.bitmap.close();}catch{/* already closed */}}
   publish({type:'error',id:data.id,message:errorMessage(error)});
  }
 })();
};
