import {validateCameraFloorCalibration,type CameraFloorCalibration} from '../../footprints/spatial/coordinates.ts';
import type {CameraBinding} from '../../footprints/live/LiveFloorTrackingEngine.ts';

/** V3.1: local-only reusable geometry. A profile is NEVER an output approval. */
export type QuickStageProfile={
 schema:'soma.quick-stage-profile';version:1;id:string;name:string;
 camera:{deviceId:string;label:string;width:number;height:number};
 calibration:CameraFloorCalibration;
 performers:1|2;updatedAt:string;
};
export const QUICK_STAGE_PROFILES_KEY='soma-quick-stage-profiles-v1';
export const QUICK_STAGE_CAMERA_KEY='soma-quick-camera-v1';
type Store=Pick<Storage,'getItem'|'setItem'>;
const hasText=(x:unknown,max:number)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
export function validateQuickStageProfile(input:unknown):QuickStageProfile{
 const p=input as Partial<QuickStageProfile>|null;
 const cam=p?.camera;
 if(!p||p.schema!=='soma.quick-stage-profile'||p.version!==1||
  !hasText(p.id,80)||!hasText(p.name,100)||!cam||
  typeof cam.deviceId!=='string'||cam.deviceId.length>300||
  typeof cam.label!=='string'||cam.label.length>150||
  !Number.isInteger(cam.width)||cam.width<1||cam.width>8192||
  !Number.isInteger(cam.height)||cam.height<1||cam.height>8192||
  (p.performers!==1&&p.performers!==2)||
  typeof p.updatedAt!=='string'||!Number.isFinite(Date.parse(p.updatedAt)))
  throw Error('Profil panggung tidak valid.');
 return {schema:'soma.quick-stage-profile',version:1,id:p.id!,name:p.name!,
  camera:{...cam},calibration:validateCameraFloorCalibration(p.calibration),
  performers:p.performers,updatedAt:p.updatedAt};
}
export function loadQuickStageProfiles(storage:Pick<Store,'getItem'>):QuickStageProfile[]{
 try{
  const raw=storage.getItem(QUICK_STAGE_PROFILES_KEY);
  const parsed=raw?JSON.parse(raw):[];
  if(!Array.isArray(parsed))return [];
  return parsed.slice(0,24).flatMap(value=>{
   try{return [validateQuickStageProfile(value)];}catch{return [];}
  }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,8);
 }catch{return [];}
}
export function storeQuickStageProfile(storage:Store,profile:QuickStageProfile):QuickStageProfile[]{
 const checked=validateQuickStageProfile(profile);
 const existing=loadQuickStageProfiles(storage).filter(p=>p.id!==checked.id);
 const next=[checked,...existing].slice(0,8);
 storage.setItem(QUICK_STAGE_PROFILES_KEY,JSON.stringify(next));
 return next;
}
/** Browser trackId changes on every reconnect. Match physical device and raster,
 * not ephemeral MediaStreamTrack.id. Unknown deviceId needs manual recalibration. */
export function quickStageMatchesCamera(p:QuickStageProfile,binding:CameraBinding|null):boolean{
 return !!binding&&p.camera.deviceId.length>0&&binding.deviceId.length>0&&
  p.camera.deviceId===binding.deviceId&&p.camera.width===binding.width&&
  p.camera.height===binding.height;
}
export type QuickStageDiagnostic={
 id:'camera'|'tracking'|'floor'|'output';label:string;
 state:'ready'|'pending'|'warning';detail:string;
};
export function quickStageDiagnostics(input:{
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;bodySelected:boolean;
 videoReady:boolean;frameFresh:boolean;
 performerCount:1|2;visibleCount:number;identityAmbiguous:boolean;identityMatchedFrame:boolean;
 floorCalibrated:boolean;floorConfirmed:boolean;cameraMatched:boolean;
 outputConnected:boolean;
}):QuickStageDiagnostic[]{
 const camera=input.cameraError?{state:'warning' as const,detail:input.cameraError}:
  input.cameraBusy?{state:'pending' as const,detail:'Menunggu izin atau perangkat kamera.'}:
  input.cameraOn&&input.bodySelected&&input.videoReady?
   {state:'ready' as const,detail:'Gambar kamera tersedia.'}:
   {state:'pending' as const,detail:'Pilih dan hubungkan kamera Body.'};
 const tracking=input.cameraOn&&input.frameFresh&&
  !input.identityAmbiguous&&input.identityMatchedFrame&&
  input.visibleCount>=input.performerCount?{
  state:'ready' as const,detail:`Terukur ${input.visibleCount}/${input.performerCount} performer pada frame yang cocok.`
 }:{state:'pending' as const,detail:!input.frameFresh?
   'Menunggu frame tracking yang valid.':
   input.identityAmbiguous||!input.identityMatchedFrame?
    'Identitas belum aman pada frame terbaru.':
    `Terukur ${input.visibleCount}/${input.performerCount} performer.`};
 const floor=input.floorCalibrated&&input.floorConfirmed&&input.cameraMatched?{
  state:'ready' as const,detail:'Empat titik terkonfirmasi untuk kamera aktif.'
 }:{state:'pending' as const,detail:'Periksa empat sudut dan konfirmasi lantai.'};
 const output=input.outputConnected?{
  state:'ready' as const,detail:'Jendela output software tersambung; fisik belum diverifikasi.'
 }:{state:'pending' as const,detail:'Buka Projector untuk pemeriksaan output.'};
 return [
  {id:'camera',label:'Kamera',...camera},
  {id:'tracking',label:'Tracking',...tracking},
  {id:'floor',label:'Lantai',...floor},
  {id:'output',label:'Projector',...output}
 ];
}
