import {correspondence,homography,identityQuad,inverse3,transform,validQuad,type Point,type Quad} from '../../projection/geometry.ts';

/**
 * Physical flat-floor coordinate convention (metres):
 * origin at DOWNSTAGE LEFT, +X to performer's right, +Y towards UPSTAGE.
 * A top-down 2D canvas uses U=x/width, V=1-y/depth (upstage is screen top).
 * Camera and projector normalized points instead use origin TOP LEFT and +Y down.
 */
export type FloorPoint={xM:number;yM:number};
export type FloorSpace={
 schema:'soma.footprints.floor-space';version:1;unit:'m';
 origin:'downstage-left';xAxis:'stage-right';yAxis:'upstage';
 widthM:number;depthM:number;
};
export type CameraFloorCalibration={
 schema:'soma.footprints.camera-floor';version:1;
 floor:FloorSpace;
 /** Camera-image normalized 4 marked floor corners: UL, UR, DR, DL (UNMIRRORED image). */
 cameraQuad:Quad;
};
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const unitPoint=(p:unknown):p is Point=>{
 const v=p as Point|null;
 return !!v&&finite(v.x)&&finite(v.y)&&v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1;
};
// Homography inversion can return -1e-15 for a physical corner: absorb only rounding error.
const nearUnit=(p:Point,eps=1e-8)=>finite(p.x)&&finite(p.y)&&p.x>=-eps&&p.x<=1+eps&&p.y>=-eps&&p.y<=1+eps;
const clampUV=(p:Point):Point=>({x:Math.min(1,Math.max(0,p.x)),y:Math.min(1,Math.max(0,p.y))});
export const defaultFloorSpace=(widthM=8,depthM=6):FloorSpace=>validateFloorSpace({
 schema:'soma.footprints.floor-space',version:1,unit:'m',
 origin:'downstage-left',xAxis:'stage-right',yAxis:'upstage',widthM,depthM
});
export function validateFloorSpace(input:unknown):FloorSpace{
 const f=input as FloorSpace|null;
 if(!f||f.schema!=='soma.footprints.floor-space'||f.version!==1||f.unit!=='m'||
    f.origin!=='downstage-left'||f.xAxis!=='stage-right'||f.yAxis!=='upstage'||
    !finite(f.widthM)||!finite(f.depthM)||f.widthM<.5||f.depthM<.5||
    f.widthM>100||f.depthM>100)throw Error('Bidang lantai memerlukan ukuran meter dan orientasi sumbu yang valid.');
 return {...f};
}
export const validFloorPoint=(p:unknown):p is FloorPoint=>{
 const v=p as FloorPoint|null;return !!v&&finite(v.xM)&&finite(v.yM);
};
export function insideFloor(floor:FloorSpace,point:FloorPoint,epsilon=1e-8):boolean{
 return validFloorPoint(point)&&point.xM>=-epsilon&&point.xM<=floor.widthM+epsilon&&
 point.yM>=-epsilon&&point.yM<=floor.depthM+epsilon;
}
export function floorToUV(floor:FloorSpace,point:FloorPoint):Point{
 validateFloorSpace(floor);
 if(!insideFloor(floor,point))throw Error('Jejak berada di luar batas lantai terkalibrasi.');
 return {x:point.xM/floor.widthM,y:1-point.yM/floor.depthM};
}
export function uvToFloor(floor:FloorSpace,uv:Point):FloorPoint{
 validateFloorSpace(floor);
 if(!unitPoint(uv))throw Error('Koordinat lantai harus dalam rentang 0–1.');
 return {xM:uv.x*floor.widthM,yM:(1-uv.y)*floor.depthM};
}
/** The output quad is four raster-normalized physical FLOOR corners, UL→UR→DR→DL. */
export function floorToProjectorUV(floor:FloorSpace,point:FloorPoint,projectorQuad:Quad):Point{
 if(!validQuad(projectorQuad))throw Error('Kalibrasi proyektor harus memakai empat sudut berurutan.');
 return transform(homography(projectorQuad),floorToUV(floor,point));
}
export function projectorUVToFloor(floor:FloorSpace,point:Point,projectorQuad:Quad):FloorPoint{
 if(!unitPoint(point)||!validQuad(projectorQuad))throw Error('Titik proyektor atau kalibrasi tidak valid.');
 const uv=transform(inverse3(homography(projectorQuad)),point);
 if(!nearUnit(uv))throw Error('Titik proyektor berada di luar bidang lantai.');
 return uvToFloor(floor,clampUV(uv));
}
export function validateCameraFloorCalibration(value:unknown):CameraFloorCalibration{
 const c=value as CameraFloorCalibration|null;
 if(!c||c.schema!=='soma.footprints.camera-floor'||c.version!==1||!validQuad(c.cameraQuad))
  throw Error('Kalibrasi kamera perlu empat tanda lantai dalam gambar mentah, tanpa mirror.');
 return {schema:c.schema,version:1,floor:validateFloorSpace(c.floor),
  cameraQuad:c.cameraQuad.map(p=>({...p})) as Quad};
}
/**
 * Map ONLY a camera point assumed on the floor plane. Do not call for airborne
 * swing feet. A single monocular webcam cannot measure actual foot contact.
 */
export function cameraGroundToFloor(calibration:CameraFloorCalibration,
 observation:{cameraUV:Point;phase:'contact'|'stance';confidence:number},
 minConfidence=.55):FloorPoint|null{
 const c=validateCameraFloorCalibration(calibration);
 if(!unitPoint(observation.cameraUV)||!['contact','stance'].includes(observation.phase)||
    !finite(observation.confidence)||observation.confidence<minConfidence||observation.confidence>1)
  return null;
 const uv=transform(correspondence(c.cameraQuad,identityQuad()),observation.cameraUV);
 if(!nearUnit(uv))return null;
 return uvToFloor(c.floor,clampUV(uv));
}
/**
 * MediaPipe stage coordinates are aspect-fitted into SOMA's 16:9 canvas.
 * Undo that fit before applying an UNMIRRORED camera calibration quad.
 */
export function stageUVToRawCamera(stage:Point,videoAspect:number):Point|null{
 if(!unitPoint(stage)||!finite(videoAspect)||videoAspect<=0)return null;
 const fx=Math.min(1,videoAspect/(16/9)),fy=Math.min(1,(16/9)/videoAspect);
 const raw={x:(stage.x-(1-fx)/2)/fx,y:(stage.y-(1-fy)/2)/fy};
 return unitPoint(raw)?raw:null;
}
