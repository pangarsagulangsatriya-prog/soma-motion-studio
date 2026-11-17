import {FilesetResolver,PoseLandmarker} from '@mediapipe/tasks-vision';
import type {Landmark} from '../engine/types.ts';
import {descriptorsFor33} from './mediaPipeD2Bridge.ts';
import {d3MatchGuides,d3AcceptRefinement,type D3Guide,type D3Report} from './duetPose33.ts';
import {duetSearchRegions,remapPoseFromCrop,rescuePoseQuality,
 mergeRescueDetections,type RescuedPose} from './duetPoseRescue.ts';

type Init={type:'init';base:string};
type Frame={type:'frame';id:number;bitmap:ImageBitmap;clock:number;targetCount?:1|2;guides?:D3Guide[]};
type Request=Init|Frame;
let pose:PoseLandmarker|null=null;
let rescue:PoseLandmarker|null=null;
let rescueLoading:Promise<void>|null=null;
let basePath='';
let files:Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>|null=null;
let lastClock=-1,lastRescueClock=-Infinity,lastGuidedClock=-Infinity;
let rescueFailure='';
const RESCUE_INTERVAL_MS=480;
const send=(data:unknown)=>self.postMessage(data);
function prepareRescue(){
 if(rescueLoading||rescue||!files)return;
 const selected=files;
 rescueLoading=PoseLandmarker.createFromOptions(selected,{
  baseOptions:{modelAssetPath:basePath+'models/pose_landmarker_lite.task',delegate:'CPU'},
  runningMode:'IMAGE',numPoses:1,minPoseDetectionConfidence:.42,
  minPosePresenceConfidence:.43,minTrackingConfidence:.5,outputSegmentationMasks:false
 }).then(model=>{rescue=model;rescueFailure='';}).catch(e=>{
  rescue=null;rescueFailure=e instanceof Error?e.message:String(e);
 });
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
/** D3: independent 33-pose inference for A/B crops from current bitmap.
 * Only prior stable identities provide guides. The current raw multipose
 * observations must unambiguously match those guides before refinement.
 * Every crop is independently detected using the existing IMAGE task.
 */
function guidedDual33(bitmap:ImageBitmap,poses:Landmark[][],guides:D3Guide[],
 clock:number,startMs:number):D3Report{
 const report:D3Report={status:rescue?'active':rescueFailure?'fallback':'warming',
  attempted:0,accepted:0,refined:[],elapsedMs:0};
 if(!rescue){
  report.reason=rescueFailure||'Menyiapkan MediaPipe IMAGE untuk crop A/B.';
  return report;
 }
 if(guides.length===0){
  report.reason='Menunggu dua identitas A/B yang stabil.';
  return report;
 }
 const matches=d3MatchGuides(guides,poses);
 if(matches.length===0){
  report.reason='Crop tidak aman: aktor bersilangan atau berpindah terlalu jauh.';
  return report;
 }
 if(clock-lastGuidedClock<230){
  report.reason='Frame skipping D3 agar video tetap berjalan.';
  return report;
 }
 if(performance.now()-startMs>135){
  report.reason='Inferensi utama sedang berat; D3 melewati frame.';
  return report;
 }
 lastGuidedClock=clock;
 const begin=performance.now();
 for(const match of matches){
  if(performance.now()-startMs>210)break;
  const {region,rawIndex,id}=match;
  const canvas=new OffscreenCanvas(384,512),ctx=canvas.getContext('2d');
  if(!ctx)continue;
  ctx.drawImage(bitmap,region.x*bitmap.width,region.y*bitmap.height,
   region.width*bitmap.width,region.height*bitmap.height,0,0,384,512);
  const sample=canvas.transferToImageBitmap();
  try{
   report.attempted++;
   const result=rescue.detect(sample);
   try{
    const points=result.landmarks[0];
    if(!points||points.length!==33)continue;
    const refined=remapPoseFromCrop(points.map(p=>({...p})) as Landmark[],region);
    const current=poses[rawIndex],others=poses.filter((_,i)=>i!==rawIndex);
    if(!current||!d3AcceptRefinement(refined,current,others,region))continue;
    poses[rawIndex]=refined;
    report.accepted++;
    report.refined.push(id);
   }finally{result.close();}
  }catch{/* Keep original multipose pose on a single crop failure. */}
  finally{sample.close();}
 }
 report.elapsedMs=performance.now()-begin;
 if(!report.accepted)report.reason='Menggunakan pose utama; crop belum memenuhi QA.';
 return report;
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
  if(value.targetCount===2){
   prepareRescue();
   if(landmarks.length<2)rescuedCount=recover(bitmap,landmarks,worldLandmarks,clock);
  }
  const d3=guidedDual33(bitmap,landmarks,value.guides??[],clock,start);
  const poseMs=performance.now()-start;
  let appearance:(number[]|null)[]=landmarks.map(()=>null);
  // Read color from the exact ImageBitmap used for this inference frame.
  try{
   if(typeof OffscreenCanvas!=='undefined'&&landmarks.length){
    const w=Math.min(480,bitmap.width),h=Math.max(1,Math.round(bitmap.height*w/bitmap.width));
    const canvas=new OffscreenCanvas(w,h);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(ctx){
     ctx.drawImage(bitmap,0,0,w,h);
     appearance=descriptorsFor33(landmarks,ctx.getImageData(0,0,w,h));
    }
   }
  }catch{/* Position-only gate remains conservative when pixel sampling fails. */}
  send({type:'result',id:value.id,landmarks,worldLandmarks,poseMs,rescuedCount,appearance,d3});
 }catch(e){send({type:'error',id:value.id,message:e instanceof Error?e.message:String(e)});}
 finally{bitmap.close();}
};
