import type {LegacyOutputStatus} from './unifiedStageStatus.ts';
import type {DualSurfaceState} from '../../footprints/stage-optics/DualSurfaceTelemetry.ts';

export type ReadinessLevel='idle'|'busy'|'warn'|'ok';
export type ReadinessItem={
 id:'source'|'tracking'|'floor';label:string;value:string;level:ReadinessLevel;detail:string;
};

/** Lightweight operator indicators, based on existing engines and current-frame safety.
 * A connected camera alone never proves that gait tracking or calibration is ready. */
export function compactFootprintsReadiness(input:{
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;bodySelected:boolean;
 frameFresh:boolean;visibleCount:number;performerCount:1|2;identityAmbiguous:boolean;
 identityMatchedFrame:boolean;
 floorCalibrated:boolean;floorConfirmed:boolean;cameraMatched:boolean;
}):ReadinessItem[]{
 const source:ReadinessItem=input.cameraBusy?{
  id:'source',label:'Sumber',value:'Menghubungkan',level:'busy',
  detail:'Menunggu izin atau sambungan kamera.'
 }:input.cameraError?{
  id:'source',label:'Sumber',value:'Periksa kamera',level:'warn',detail:input.cameraError
 }:!input.cameraOn?{
  id:'source',label:'Sumber',value:'Belum terhubung',level:'idle',
  detail:'Pilih webcam, kamera HP, MP4, atau simulasi pada Source.'
 }:!input.bodySelected?{
  id:'source',label:'Sumber',value:'Pilih Body',level:'warn',
  detail:'Kamera tersambung; aktifkan mode Body untuk tracking kaki.'
 }:{
  id:'source',label:'Sumber',value:'Kamera Body',level:'ok',
  detail:'Input kamera Body tersedia; kesiapan tracking diperiksa terpisah.'
 };
 if(!input.cameraOn||!input.bodySelected)return [source];
 const tracking:ReadinessItem=!input.frameFresh?{
  id:'tracking',label:'Tracking',value:'Menunggu gerak',level:'warn',
  detail:'Belum ada frame Body yang segar dan valid.'
 }:input.identityAmbiguous||!input.identityMatchedFrame?{
  id:'tracking',label:'Tracking',value:'Periksa identitas',level:'warn',
  detail:'Identitas performer belum aman atau belum cocok dengan frame Body terbaru.'
 }:input.visibleCount<input.performerCount?{
  id:'tracking',label:'Tracking',value:'Performer kurang',level:'warn',
  detail:`Terbaca ${input.visibleCount} dari ${input.performerCount} performer.`
 }:{
  id:'tracking',label:'Tracking',value:'Gerak terbaca',level:'ok',
  detail:`Frame Body valid; ${input.visibleCount} performer terdeteksi.`
 };
 const floor:ReadinessItem=!input.floorCalibrated?{
  id:'floor',label:'Lantai',value:'Perlu kalibrasi',level:'warn',
  detail:'Bidang lantai belum dipetakan.'
 }:!input.floorConfirmed?{
  id:'floor',label:'Lantai',value:'Perlu konfirmasi',level:'warn',
  detail:'Konfirmasi titik kalibrasi lantai sebelum menggunakan kontak kaki.'
 }:!input.cameraMatched?{
  id:'floor',label:'Lantai',value:'Kamera berubah',level:'warn',
  detail:'Kalibrasi berasal dari sumber lain dan harus diperiksa.'
 }:!input.frameFresh?{
  id:'floor',label:'Lantai',value:'Menunggu frame',level:'warn',
  detail:'Kalibrasi tersimpan, tetapi belum ada frame Body valid.'
 }:{
  id:'floor',label:'Lantai',value:'Terkalibrasi',level:'ok',
  detail:'Bidang lantai telah dikonfirmasi untuk kamera yang aktif.'
 };
 return [source,tracking,floor];
}
export type SoftwareOutputIndicator={
 label:string;detail:string;state:'idle'|'connected'|'commanded';
};
/** Software telemetry only. Never claim a projector emits or blocks light. */
export function softwareOutputIndicator(
 legacy:LegacyOutputStatus,
 dual:{body:DualSurfaceState;floor:DualSurfaceState}
):SoftwareOutputIndicator{
 const connected=[dual.body,dual.floor].filter(s=>s.reported&&s.connected);
 if(connected.length){
  const anyLive=connected.some(s=>s.mode==='live');
  const anyTest=connected.some(s=>s.mode==='test');
  const label=connected.map(s=>{
   const action=s.mode==='live'?'LIVE diperintahkan':s.mode==='test'?'TEST diperintahkan':
    s.mode==='blackout'?'Blackout diperintahkan':'Tersambung';
   return `${s.surface.toUpperCase()} ${action}`;
  }).join(' · ');
  return {label,
   detail:'Perintah software tiap permukaan; kondisi cahaya fisik belum diverifikasi.',
   state:anyLive||anyTest?'commanded':'connected'};
 }
 if(legacy.connected){
  return {label:`Output tunggal · ${legacy.mode==='blackout'?'Blackout diperintahkan':legacy.mode==='hold'?'Hold diperintahkan':'LIVE diperintahkan'}`,
   detail:'Status transport software; kondisi proyektor fisik belum terukur.',
   state:legacy.mode==='live'?'commanded':'connected'};
 }
 if(dual.body.opened||dual.floor.opened||legacy.opened){
  return {label:'Menunggu jendela output',detail:'Jendela telah diminta, belum tersambung.',
   state:'idle'};
 }
 return {label:'Jendela output belum tersambung',
  detail:'Buka Projector untuk mengatur dan memeriksa jendela output.',
  state:'idle'};
}
