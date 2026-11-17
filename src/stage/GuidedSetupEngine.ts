import type {Point,Quad} from '../projection/geometry.ts';
import {validQuad} from '../projection/geometry.ts';

/** Four high-saturation paper/tape fiducials in camera-image corner order. */
export const FLOOR_MARKERS=[
 {id:'UL',label:'1 · Kiri belakang',hex:'#EF1C9A',hue:327},
 {id:'UR',label:'2 · Kanan belakang',hex:'#02D9F1',hue:186},
 {id:'DR',label:'3 · Kanan depan',hex:'#F6D511',hue:51},
 {id:'DL',label:'4 · Kiri depan',hex:'#59E62D',hue:104}
] as const;
export type MarkerScan={quad:Quad;counts:[number,number,number,number];confidence:number};
const distanceHue=(a:number,b:number)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
const rgbHue=(r:number,g:number,b:number)=>{
 const hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo;
 if(delta===0)return null;
 let h=hi===r?(g-b)/delta:hi===g?(b-r)/delta+2:(r-g)/delta+4;
 h=(h*60+360)%360;
 return {h,sat:delta/hi,brightness:hi};
};
/** Fast, deterministic centroid finder on a downsampled *unmirrored* camera frame.
 * This is assisted floor-marker detection, not camera→projector optical QA.
 */
export function scanFloorMarkers(
 rgba:Uint8ClampedArray,width:number,height:number
):MarkerScan{
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<80||height<60||
  rgba.length!==width*height*4)throw Error('Gambar kamera marker tidak valid.');
 const n=FLOOR_MARKERS.length,count=[0,0,0,0],sumX=[0,0,0,0],sumY=[0,0,0,0];
 // Exclude frame edges where clipping makes centroids unreliable.
 for(let y=3;y<height-3;y++)for(let x=3;x<width-3;x++){
  const i=(y*width+x)*4;
  if(rgba[i+3]<190)continue;
  const rgb=rgbHue(rgba[i],rgba[i+1],rgba[i+2]);
  if(!rgb||rgb.sat<.65||rgb.brightness<115)continue;
  let selected=-1,closest=14;
  for(let k=0;k<n;k++){
   const error=distanceHue(rgb.h,FLOOR_MARKERS[k].hue);
   if(error<closest){closest=error;selected=k;}
  }
  if(selected<0)continue;
  count[selected]++;sumX[selected]+=x+.5;sumY[selected]+=y+.5;
 }
 // Reject tiny color speckles: each marker should occupy at least 0.07% of the frame.
 const minimum=Math.max(18,Math.ceil(width*height*.0007));
 if(count.some(n=>n<minimum))
  throw Error('Empat marker belum terbaca. Besarkan marker, tambah cahaya, dan hindari warna serupa pada latar.');
 const points=count.map((v,i)=>({x:sumX[i]/v/width,y:sumY[i]/v/height})) as Quad;
 const sep=Math.min(...points.flatMap((p,i)=>points.slice(i+1).map(q=>Math.hypot(p.x-q.x,p.y-q.y))));
 if(sep<.09||!validQuad(points))
  throw Error('Susunan marker tidak membentuk empat sudut lantai yang valid.');
 const confidence=Math.min(1,Math.min(...count)/(width*height*.0025));
 return {quad:points,counts:count as [number,number,number,number],confidence};
}
export function combineStableMarkerScans(scans:MarkerScan[]):Quad{
 if(scans.length<4)throw Error('Minimal empat pembacaan marker diperlukan.');
 const mean=scans[0].quad.map((_,k)=>({
  x:scans.reduce((a,s)=>a+s.quad[k].x,0)/scans.length,
  y:scans.reduce((a,s)=>a+s.quad[k].y,0)/scans.length
 })) as Quad;
 if(!validQuad(mean))throw Error('Geometri marker berubah. Atur ulang posisi kamera.');
 if(scans.some(s=>s.quad.some((p,k)=>Math.hypot(p.x-mean[k].x,p.y-mean[k].y)>.025)))
  throw Error('Posisi marker bergeser selama scan. Kunci tripod dan ulangi.');
 return mean;
}
export type GuidedSetupReadiness={
 source:{ready:boolean;reason:string};
 calibration:{ready:boolean;reason:string};
 tracking:{ready:boolean;reason:string};
 archive:{ready:boolean;reason:string};
 rehearsal:{ready:boolean;reason:string};
};
export type ReadinessInput={
 cameraOn:boolean;bodySelected:boolean;frameFresh:boolean;
 source:'laptop'|'phone'|'simulation';phoneActive:boolean;videoReady:boolean;
 floorConfirmed:boolean;cameraMatched:boolean;poseTracked:boolean;
 contacts:number;performers:1|2;visibleCount:number;identityAmbiguous:boolean;
 sameFrame:boolean;hasArchive:boolean;skipArchive:boolean;
 bodyPreview:boolean;floorPreview:boolean;
};
export function guidedSetupReadiness(input:ReadinessInput):GuidedSetupReadiness{
 const sourceReady=input.cameraOn&&input.bodySelected&&input.frameFresh&&input.videoReady&&
  (input.source==='phone'?input.phoneActive:input.source==='laptop'&&!input.phoneActive);
 const calReady=sourceReady&&input.floorConfirmed&&input.cameraMatched;
 const idReady=input.performers===1||(
  input.visibleCount===2&&!input.identityAmbiguous&&input.sameFrame);
 const trackingReady=calReady&&input.poseTracked&&idReady&&input.contacts>0;
 const archiveReady=trackingReady&&(input.hasArchive||input.skipArchive);
 const previewReady=archiveReady&&input.bodyPreview&&input.floorPreview;
 return {
  source:{ready:sourceReady,reason:input.source==='simulation'?
   'Simulasi tersedia terpisah. Wizard panggung memerlukan kamera nyata.':
   !input.cameraOn?'Aktifkan kamera laptop atau sambungkan HP.':
   !input.bodySelected?'Aktifkan mode Body.':
   !input.videoReady?'Menunggu video kamera.':
   input.source==='phone'&&!input.phoneActive?'Sambungkan HP melalui QR.':
   input.source==='laptop'&&input.phoneActive?'Pilih webcam laptop.':
   !input.frameFresh?'Menunggu frame tracking terbaru.':'Sumber siap.'},
  calibration:{ready:calReady,reason:!sourceReady?'Selesaikan koneksi kamera terlebih dahulu.':
   !input.floorConfirmed?'Tandai empat sudut lalu konfirmasi.':
   !input.cameraMatched?'Kamera/resolusi berubah. Kalibrasi ulang.':'Kalibrasi terikat ke kamera aktif.'},
  tracking:{ready:trackingReady,reason:!calReady?'Konfirmasi kalibrasi kamera–lantai.':
   !input.poseTracked?'Posisikan kaki dalam gambar untuk tracking.':
   !idReady?'Identitas dua performer belum stabil.':
   input.contacts===0?'Berjalan sampai satu kontak kaki tercatat.':'Tracking dan kontak terbaca.'},
  archive:{ready:archiveReady,reason:!trackingReady?'Selesaikan tracking terlebih dahulu.':
   !(input.hasArchive||input.skipArchive)?'Unggah arsip A/B atau pilih Lewati Arsip.':'Arsip siap.'},
  rehearsal:{ready:previewReady,reason:!archiveReady?'Selesaikan bagian arsip terlebih dahulu.':
   !input.bodyPreview?'Menunggu mask BODY valid.':
   !input.floorPreview?'Menunggu preview FLOOR terkalibrasi.':'Preview dan sesi siap.'}
 };
}
export const GUIDED_STEPS=['source','calibration','tracking','archive','rehearsal'] as const;
export function canVisitGuidedStep(next:number,readiness:GuidedSetupReadiness):boolean{
 if(!Number.isInteger(next)||next<0||next>=GUIDED_STEPS.length)return false;
 return GUIDED_STEPS.slice(0,next).every(key=>readiness[key].ready);
}
