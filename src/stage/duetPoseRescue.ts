import type {Landmark} from '../engine/types.ts';

/**
 * A supplementary, image-only detector can inspect a tighter crop when the
 * normal multipose detector returned fewer actors than requested.
 * These functions are pure and never synthesize a missing human pose.
 */
export type PoseSearchRegion={x:number;y:number;width:number;height:number};
export type RescuedPose={landmarks:Landmark[];worldLandmarks:Landmark[];quality:number};
const clamp=(x:number,min=0,max=1)=>Math.max(min,Math.min(max,x));
const valid=(p:Landmark|undefined)=>
 !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&
 p.y>=0&&p.y<=1;
const torso=(pose:readonly Landmark[])=>{
 const used=[11,12,23,24].map(i=>pose[i]).filter(valid);
 if(used.length<2)return null;
 return {
  x:used.reduce((v,p)=>v+p.x,0)/used.length,
  y:used.reduce((v,p)=>v+p.y,0)/used.length
 };
};
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>
 Math.hypot(a.x-b.x,a.y-b.y);
export function duetSearchRegions(poses:readonly (readonly Landmark[])[]):PoseSearchRegion[]{
 const center=poses.length?torso(poses[0]):null;
 const centers=center?[
  {x:center.x-.16,y:center.y+.07},
  {x:center.x+.16,y:center.y+.07}
 ]:[{x:.32,y:.49},{x:.68,y:.49}];
 return centers.map(c=>{
  const width=.40,height=.82;
  return {x:clamp(c.x-width/2,0,1-width),
   y:clamp(c.y-height/2,0,1-height),width,height};
 });
}
export function remapPoseFromCrop(
 points:readonly Landmark[],region:PoseSearchRegion
):Landmark[]{
 return points.map(p=>({
  ...p,x:region.x+p.x*region.width,
  y:region.y+p.y*region.height,
  // MediaPipe's z is relative to crop width; this stays an image-space
  // estimate. World landmarks are passed through unchanged.
  z:p.z*region.width
 }));
}
export function rescuePoseQuality(pose:readonly Landmark[]):number{
 if(pose.length<33)return 0;
 const torsoPoints=[11,12,23,24].filter(i=>valid(pose[i]));
 const legPoints=[25,26,27,28].filter(i=>valid(pose[i]));
 if(torsoPoints.length<3||legPoints.length<2)return 0;
 const relevant=[...torsoPoints,...legPoints];
 const average=relevant.reduce((sum,i)=>sum+clamp(pose[i].visibility??.5),0)/
  relevant.length;
 return average;
}
/**
 * Strict deduplication. An uncertain crop must not create a "second actor"
 * by detecting the same body again.
 */
export function mergeRescueDetections(
 primary:readonly (readonly Landmark[])[],
 candidates:readonly RescuedPose[]
):{poses:Landmark[][];rescued:RescuedPose[]}{
 const poses=primary.map(p=>p.map(point=>({...point})));
 const rescued:RescuedPose[]=[];
 for(const candidate of [...candidates].sort((a,b)=>b.quality-a.quality)){
  if(poses.length>=2)break;
  if(candidate.quality<.68||rescuePoseQuality(candidate.landmarks)<.68)continue;
  const center=torso(candidate.landmarks);
  if(!center)continue;
  if(poses.some(p=>{
   const other=torso(p);
   if(!other)return false;
   // When the hip+shoulder centroids coincide, another person has NOT
   // been independently established by this crop.
   if(distance(center,other)<.105)return true;
   const anchors=[11,12,23,24,25,26,27,28];
   const alike=anchors.filter(i=>valid(candidate.landmarks[i])&&valid(p[i])&&
    distance(candidate.landmarks[i],p[i])<.10).length;
   return alike>=5;
  }))continue;
  poses.push(candidate.landmarks.map(point=>({...point})));
  rescued.push({landmarks:candidate.landmarks.map(p=>({...p})),
   worldLandmarks:candidate.worldLandmarks.map(p=>({...p})),quality:candidate.quality});
 }
 return {poses,rescued};
}
