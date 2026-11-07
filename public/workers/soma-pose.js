/* Classic worker: MediaPipe's pinned WASM loader requires importScripts. */
var exports = {};
importScripts('/wasm/vision_bundle.cjs');
let pose = null;
function copyMasks(masks,size){
 if(!masks?.length)return undefined;const data=new Uint8Array(size*size);
 for(const mask of masks){const pixels=mask.getAsFloat32Array();for(let y=0;y<size;y++)for(let x=0;x<size;x++){const value=pixels[Math.min(mask.height-1,Math.floor(y*mask.height/size))*mask.width+Math.min(mask.width-1,Math.floor(x*mask.width/size))];data[y*size+x]=Math.max(data[y*size+x],Math.round(Math.max(0,Math.min(1,value))*255));}}
 return {width:size,height:size,data};
}
self.onmessage=async ({data:m})=>{
 if(m.type==='init'){try{const files=await exports.FilesetResolver.forVisionTasks('/wasm');pose=await exports.PoseLandmarker.createFromOptions(files,{canvas:new OffscreenCanvas(256,256),baseOptions:{modelAssetPath:'/models/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:2,minTrackingConfidence:.6,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,outputSegmentationMasks:true});self.postMessage({type:'ready'});}catch(e){self.postMessage({type:'error',message:String(e.message||e)});}return;}
 if(m.type==='frame'){let result;try{const begin=performance.now();result=pose.detectForVideo(m.bitmap,m.time);const inferenceMs=performance.now()-begin;const segmentation=copyMasks(result.segmentationMasks,96),projectionMask=m.projection?copyMasks(result.segmentationMasks?.slice(0,1),256):undefined;const response={type:'result',landmarks:result.landmarks,worldLandmarks:result.worldLandmarks,segmentation,projectionMask,inferenceMs};self.postMessage(response,[segmentation?.data.buffer,projectionMask?.data.buffer].filter(Boolean));}catch(e){self.postMessage({type:'error',message:String(e.message||e)});}finally{result?.close();m.bitmap.close();}}
};
