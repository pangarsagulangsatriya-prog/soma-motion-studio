/** S6.2 · Assisted optical correspondence using four distinct projected test markers.
 * Color blobs are measured in the RAW camera video; no face/pose inference is involved.
 * A projector must already illuminate the intended floor patch: correspondence alone
 * cannot independently verify physical floor boundaries or projector safety.
 */
import {correspondence,identityQuad,transform,validQuad,type Quad} from '../projection/geometry.ts';
import {FLOOR_MARKERS,scanFloorMarkers,combineStableMarkerScans,type MarkerScan} from './GuidedSetupEngine.ts';

/** Inset makes bright fiducials visible instead of clipping at display boundaries. */
export const PROJECTED_FIDUCIAL_UV:Quad=[
 {x:.10,y:.10},{x:.90,y:.10},{x:.90,y:.90},{x:.10,y:.90}
];
export type ProjectedMatch={
 cameraQuad:Quad;markerQuad:Quad;scans:number;
 confidence:number;method:'projected-four-color';
};
/** Recover the four *outer* raster corners from inside projected fiducial centroids.
 * The homography maps projector raster UV → raw camera UV.
 */
export function recoverProjectedFloorQuad(markerQuad:Quad):Quad{
 if(!validQuad(markerQuad))throw Error('Marker proyeksi harus membentuk empat titik berurutan.');
 const matrix=correspondence(PROJECTED_FIDUCIAL_UV,markerQuad);
 const raw=identityQuad().map(p=>transform(matrix,p));
 if(!raw.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))
  throw Error('Batas proyeksi keluar bingkai kamera. Posisikan kamera agar seluruh lantai terlihat.');
 const corners=raw as Quad;
 if(!validQuad(corners))throw Error('Empat batas proyeksi tidak membentuk bidang lantai yang valid.');
 return corners;
}
/** Use baseline subtraction to reject similarly coloured stationary props or tape. */
export function differentialProjectedScan(
 illuminated:Uint8ClampedArray,
 baseline:Uint8ClampedArray,
 width:number,height:number
):MarkerScan{
 if(illuminated.length!==baseline.length||
  illuminated.length!==width*height*4)
  throw Error('Baseline dan frame proyektor memiliki ukuran berbeda.');
 const isolated=new Uint8ClampedArray(illuminated.length);
 let total=0;
 for(let i=0;i<illuminated.length;i+=4){
  const d=Math.max(
   Math.abs(illuminated[i]-baseline[i]),
   Math.abs(illuminated[i+1]-baseline[i+1]),
   Math.abs(illuminated[i+2]-baseline[i+2])
  );
  // +55 RGB channel delta is conservative for automatic color matching.
  if(d<55)continue;
  isolated[i]=illuminated[i];
  isolated[i+1]=illuminated[i+1];
  isolated[i+2]=illuminated[i+2];
  isolated[i+3]=255;total++;
 }
 if(total<width*height*.003)
  throw Error('Cahaya marker belum terlihat jelas. Periksa output dan pencahayaan panggung.');
 return scanFloorMarkers(isolated,width,height);
}
export function resolveProjectedMatch(scans:MarkerScan[]):ProjectedMatch{
 const markerQuad=combineStableMarkerScans(scans);
 const confidence=Math.min(...scans.map(s=>s.confidence));
 if(confidence<.22)throw Error('Warna marker terlalu redup. Gunakan metode empat titik manual.');
 const cameraQuad=recoverProjectedFloorQuad(markerQuad);
 return {cameraQuad,markerQuad,confidence,scans:scans.length,method:'projected-four-color'};
}
export const PROJECTED_MARKER_COLORS=FLOOR_MARKERS.map(m=>m.hex);
