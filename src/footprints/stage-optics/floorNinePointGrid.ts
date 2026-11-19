import {correspondence,homography,inverse3,transform,identityQuad,type Quad} from '../../projection/geometry.ts';
/** VC-05: analytical 3 × 3 camera-to-projector quad correspondence check.
 * Does not measure projector photon placement or physical positioning error.
 */
export type GridSample={id:string;stage:{x:number;y:number};source:{x:number;y:number};projector:{x:number;y:number};roundTripError:number};
export type GridResult={samples:GridSample[];maxError:number;valid:boolean;reason:string};
export function diagnosticNinePointGrid(sourceQuad:Quad,projectorQuad:Quad):GridResult{
 try{
  const source=homography(sourceQuad),projector=homography(projectorQuad);
  const cameraToProjector=correspondence(sourceQuad,projectorQuad);
  const inverse=inverse3(cameraToProjector);
  const samples:GridSample[]=[];
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){
   const stage={x:x/2,y:y/2},cameraUV=transform(source,stage);
   const projectionUV=transform(cameraToProjector,cameraUV);
   const targetUV=transform(projector,stage);
   const back=transform(inverse,projectionUV);
   const e=Math.max(Math.hypot(projectionUV.x-targetUV.x,projectionUV.y-targetUV.y),
    Math.hypot(cameraUV.x-back.x,cameraUV.y-back.y));
   if(!Number.isFinite(e))throw Error('Koordinat tidak valid.');
   samples.push({id:`G${y*3+x+1}`,stage,source:cameraUV,projector:projectionUV,roundTripError:e});
  }
  const maxError=Math.max(...samples.map(s=>s.roundTripError));
  return {samples,maxError,valid:maxError<1e-5,reason:'Uji model homografi saja; lakukan pemeriksaan posisi cahaya fisik secara terpisah.'};
 }catch(err){
  return {samples:[],maxError:Infinity,valid:false,reason:err instanceof Error?err.message:'Geometri tidak valid.'};
 }
}
export function defaultFloorStageGrid(widthM=5,depthM=5){
 if(!Number.isFinite(widthM)||!Number.isFinite(depthM)||widthM<.5||depthM<.5)
  throw Error('Ukuran lantai harus positif.');
 return Array.from({length:9},(_,i)=>({id:'G'+(i+1),
  xM:(i%3)*widthM/2,yM:(2-Math.floor(i/3))*depthM/2}));
}
// Retain a reliable starting quad in demo/test mode only.
export const DEFAULT_GRID_QUAD:Quad=identityQuad();
