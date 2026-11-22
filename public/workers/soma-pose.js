/* Classic worker: MediaPipe's pinned WASM loader requires importScripts. */
var exports = {};
importScripts('../wasm/vision_bundle.cjs');
let pose = null;
let rescue = null, rescueLoading = null, lastRescueAt = -Infinity;
const RESCUE_SPACING_MS = 390;
function centerOf(points){
 const ids=[11,12,23,24].filter(i=>{
  const p=points?.[i];
  return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
   p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??0)>=.42;
 });
 if(ids.length<3||ids.filter(i=>i===23||i===24).length<1)return null;
 const hips=ids.filter(i=>i===23||i===24);
 const anchors=hips.length===2?hips:ids;
 return {x:anchors.reduce((n,i)=>n+points[i].x,0)/anchors.length,
  y:anchors.reduce((n,i)=>n+points[i].y,0)/anchors.length};
}
function rescueQuality(points){
 if(!centerOf(points))return 0;
 const legs=[25,26,27,28].filter(i=>(points[i]?.visibility??0)>.44);
 if(legs.length<2)return 0;
 const ids=[11,12,23,24,...legs].filter(i=>(points[i]?.visibility??0)>.42);
 return ids.reduce((sum,i)=>sum+(points[i].visibility??0),0)/ids.length;
}
function similarBody(a,b){
 const x=centerOf(a),y=centerOf(b);
 if(!x||!y)return false;
 if(Math.hypot(x.x-y.x,x.y-y.y)<.135)return true;
 let matches=0;
 for(const i of [11,12,23,24,25,26,27,28]){
  const p=a[i],q=b[i];
  if((p?.visibility??0)>.44&&(q?.visibility??0)>.44&&
   Math.hypot(p.x-q.x,p.y-q.y)<.085)matches++;
 }
 return matches>=5;
}
function rescueRegions(observed){
 const center=observed[0]?centerOf(observed[0]):null;
 const width=.57,y=.02,height=.96;
 return center?
  [{x:center.x>=.5?0:1-width,y,width,height},
   {x:(1-width)/2,y,width,height}]:
  [{x:0,y,width,height},{x:1-width,y,width,height}];
}
async function ensureRescue(){
 if(rescue||rescueLoading)return rescueLoading;
 rescueLoading=exports.PoseLandmarker.createFromOptions(
  await exports.FilesetResolver.forVisionTasks(new URL('../wasm',self.location.href).href),
  {canvas:new OffscreenCanvas(256,256),
   baseOptions:{modelAssetPath:new URL('../models/pose_landmarker_lite.task',self.location.href).href,delegate:'CPU'},
   runningMode:'IMAGE',numPoses:1,minTrackingConfidence:.5,
   minPoseDetectionConfidence:.42,minPosePresenceConfidence:.44,
   outputSegmentationMasks:false}
 ).then(model=>{rescue=model;}).catch(()=>{rescue=null;})
  .finally(()=>{rescueLoading=null;});
 return rescueLoading;
}
/** At most two crop inferences per 390 ms when requested and fewer
 * than two poses are seen. Missing people are never synthesized. */
function recoverSecond(bitmap,poses,world,time){
 if(!rescue||poses.length>=2||time-lastRescueAt<RESCUE_SPACING_MS)return 0;
 if(typeof OffscreenCanvas==='undefined')return 0;
 lastRescueAt=time;
 const before=poses.length;
 for(const region of rescueRegions(poses)){
  if(poses.length>=2)break;
  const rawW=bitmap.width*region.width,rawH=bitmap.height*region.height;
  const scale=Math.min(3,512/Math.max(rawW,rawH));
  const width=Math.max(48,Math.round(rawW*scale));
  const height=Math.max(48,Math.round(rawH*scale));
  const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d');
  if(!ctx)continue;
  ctx.drawImage(bitmap,region.x*bitmap.width,region.y*bitmap.height,
   region.width*bitmap.width,region.height*bitmap.height,0,0,width,height);
  const image=canvas.transferToImageBitmap();
  let output;
  try{
   output=rescue.detect(image);
   const local=output.landmarks?.[0];
   if(!local||local.length!==33)continue;
   const mapped=local.map(p=>({...p,x:region.x+p.x*region.width,
    y:region.y+p.y*region.height,z:(p.z??0)*region.width}));
   if(rescueQuality(mapped)<.60)continue;
   if(poses.some(other=>similarBody(other,mapped)))continue;
   poses.push(mapped);
   world.push((output.worldLandmarks?.[0]??[]).map(p=>({...p})));
  }catch{/* A failed crop must not interrupt primary detection. */}
  finally{output?.close();image.close();}
 }
 return poses.length-before;
}

function copyMasks(masks,size){
 if(!masks?.length)return undefined;const data=new Uint8Array(size*size);
 for(const mask of masks){const pixels=mask.getAsFloat32Array();for(let y=0;y<size;y++)for(let x=0;x<size;x++){const value=pixels[Math.min(mask.height-1,Math.floor(y*mask.height/size))*mask.width+Math.min(mask.width-1,Math.floor(x*mask.width/size))];data[y*size+x]=Math.max(data[y*size+x],Math.round(Math.max(0,Math.min(1,value))*255));}}
 return {width:size,height:size,data};
}
self.onmessage=async ({data:m})=>{
 if(m.type==='init'){try{const files=await exports.FilesetResolver.forVisionTasks(new URL('../wasm', self.location.href).href);pose=await exports.PoseLandmarker.createFromOptions(files,{canvas:new OffscreenCanvas(256,256),baseOptions:{modelAssetPath:new URL('../models/pose_landmarker_lite.task', self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numPoses:2,minTrackingConfidence:.55,minPoseDetectionConfidence:.52,minPosePresenceConfidence:.5,outputSegmentationMasks:true});self.postMessage({type:'ready'});}catch(e){self.postMessage({type:'error',message:String(e.message||e)});}return;}
 if(m.type==='frame'){let result;try{
  const begin=performance.now();
  result=pose.detectForVideo(m.bitmap,m.time);
  const poses=result.landmarks.map(points=>points.map(p=>({...p})));
  const world=result.worldLandmarks.map(points=>points.map(p=>({...p})));
  const segmentation=copyMasks(result.segmentationMasks,96);
  const projectionMask=m.projection?copyMasks(result.segmentationMasks?.slice(0,1),256):undefined;
  if(m.targetCount===2&&!rescue&&!rescueLoading)void ensureRescue();
  const rescuedCount=m.targetCount===2?recoverSecond(m.bitmap,poses,world,m.time):0;
  const inferenceMs=performance.now()-begin;
  const response={type:'result',id:m.id,landmarks:poses,worldLandmarks:world,
   rescuedCount,segmentation,projectionMask,inferenceMs};
  self.postMessage(response,[segmentation?.data.buffer,projectionMask?.data.buffer].filter(Boolean));
 }catch(e){self.postMessage({type:'error',id:m.id,message:String(e.message||e)});}finally{result?.close();m.bitmap.close();}}
};
