import type {GaitSample} from '../gait-analysis/index.ts';
import {validateSession,type Sample} from '../pattern.ts';
import {cameraGroundToFloor,floorToUV,stageUVToRawCamera,uvToFloor,validateCameraFloorCalibration,validateFloorSpace,type CameraFloorCalibration,type FloorSpace} from './coordinates.ts';
import {createFloorSession,validateFootstepEvent,type FloorSession,type FootstepEvent} from './events.ts';

/**
 * Translate only a debounced GaitAnalyzer CONTACT stamp after camera-floor
 * calibration. The gait coordinate is in the 16:9 Studio stage, so unfit it
 * to the unmirrored raw-camera frame before applying floor homography.
 *
 * Camera "contact" remains an estimated event; never label it measured.
 */
export function calibratedGaitContact(sample:GaitSample,videoAspect:number,
 calibration:CameraFloorCalibration,performerId='performer-1'):FootstepEvent|null{
 const c=validateCameraFloorCalibration(calibration);
 if(sample.phase!=='stance'||sample.stamp!==true||
    !Number.isFinite(sample.confidence)||sample.confidence<.55)return null;
 const cameraUV=stageUVToRawCamera({x:sample.x,y:sample.y},videoAspect);
 if(!cameraUV)return null;
 const positionM=cameraGroundToFloor(c,{cameraUV,phase:'contact',confidence:sample.confidence});
 if(!positionM)return null;
 // Estimate orientation using a short displacement through the SAME mapping.
 // The result is floor-space oriented, not a camera-space angle.
 const d=8,offset=stageUVToRawCamera({
  x:sample.x+Math.cos(sample.heading)*d/1280,
  y:sample.y+Math.sin(sample.heading)*d/720
 },videoAspect);
 const next=offset?cameraGroundToFloor(c,{cameraUV:offset,phase:'stance',confidence:sample.confidence}):null;
 const heading=next?Math.atan2(next.yM-positionM.yM,next.xM-positionM.xM):(()=>{
  const behind=stageUVToRawCamera({x:sample.x-Math.cos(sample.heading)*d/1280,
   y:sample.y-Math.sin(sample.heading)*d/720},videoAspect);
  const prev=behind&&cameraGroundToFloor(c,{cameraUV:behind,phase:'stance',confidence:sample.confidence});
  return prev?Math.atan2(positionM.yM-prev.yM,positionM.xM-prev.xM):null;
 })();
 if(heading===null)return null;
 return validateFootstepEvent({
  id:`camera-contact-${performerId}-${sample.side}-${sample.t}`,
  performerId,foot:sample.side===0?'left':'right',kind:'contact',
  timestampMs:sample.t,positionM,headingRad:heading,
  source:'camera',positionBasis:'calibrated-estimate',confidence:sample.confidence,
  joinPrevious:false
 },c.floor);
}

/**
 * V2 JSON stores image-stage pixels, NOT real-world measurements.
 * This conversion allows drawing on an illustrative floor preview only.
 * Its events cannot enter metric projector output until independently
 * re-registered against physical references.
 */
export function legacyV2ToIllustrativeSession(raw:unknown,floor:FloorSpace,
 performerId='legacy-performer'):FloorSession{
 const f=validateFloorSpace(floor),data=validateSession(raw);
 const events=data.samples.map((sample,i)=>validateFootstepEvent({
  id:`legacy-${i}`,performerId,
  foot:sample.side===0?'left':'right',
  kind:sample.stamp?'contact':'move',timestampMs:sample.t,
  positionM:uvToFloor(f,{x:sample.x,y:sample.y}),
  // Camera image +Y points downward, but world +Y points upstage.
  headingRad:-sample.heading,source:'legacy',positionBasis:'illustrative',
  confidence:0,joinPrevious:sample.join
 },f));
 return createFloorSession(f,events);
}

/** Utility bridge for a ONE-PERFORMER floor preview using the existing V2 SVG. */
export function floorSessionToPreviewSamples(session:FloorSession):Sample[]{
 const s=createFloorSession(session.floor,session.events),performers=new Set(s.events.map(e=>e.performerId));
 if(performers.size>1)throw Error('Renderer V2 hanya mampu menyambungkan jejak satu performer. Gunakan renderer S5 untuk dua performer.');
 const seen=new Set<string>();
 return s.events.filter(e=>e.kind==='contact'||e.kind==='move').map(e=>{
  const key=e.performerId+':'+e.foot,had=seen.has(key);seen.add(key);
  const uv=floorToUV(s.floor,e.positionM);
  return {x:uv.x,y:uv.y,t:e.timestampMs,side:e.foot==='left'?0:1,
   heading:-e.headingRad,stamp:e.kind==='contact',join:e.joinPrevious??had};
 });
}
