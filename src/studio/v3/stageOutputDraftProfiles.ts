import {validateStageSurfacePlan,type StageSurfacePlan} from '../../footprints/stage-optics/DualSurfaceCalibration.ts';
import {validateCameraFloorCalibration} from '../../footprints/spatial/coordinates.ts';

export const STAGE_OUTPUT_DRAFTS_KEY='soma-stage-output-drafts-v1';
export type StageOutputDraft={
 schema:'soma.stage-output-draft';version:1;id:string;name:string;
 equipmentKey:string;updatedAt:string;
 plans:{body:StageSurfacePlan;floor:StageSurfacePlan};
};
type Store=Pick<Storage,'getItem'|'setItem'>;
/** Strip transient MediaStreamTrack id. Device/resolution, floor polygon
 * and performer count remain part of the hardware draft fingerprint. */
export function stableStageEquipmentKey(cameraKey:string|null,floorKey:string|null):string|null{
 try{
  if(!cameraKey||!floorKey)return null;
  const camera=JSON.parse(cameraKey) as unknown;
  const floor=JSON.parse(floorKey) as unknown;
  if(!Array.isArray(camera)||camera.length!==4||
   !Array.isArray(floor)||floor.length!==3||
   typeof camera[1]!=='string'||!camera[1]||
   !Number.isInteger(camera[2])||!Number.isInteger(camera[3])||
   camera[2]<1||camera[3]<1||camera[2]>8192||camera[3]>8192||
   floor[1]!==cameraKey||!(floor[2]===1||floor[2]===2))return null;
  const calibration=validateCameraFloorCalibration(floor[0]);
  return JSON.stringify([camera[1],camera[2],camera[3],calibration,floor[2]]);
 }catch{return null;}
}
export function validateStageOutputDraft(raw:unknown):StageOutputDraft{
 const d=raw as Partial<StageOutputDraft>|null;
 if(!d||d.schema!=='soma.stage-output-draft'||d.version!==1||
  typeof d.id!=='string'||!d.id||d.id.length>100||
  typeof d.name!=='string'||!d.name.trim()||d.name.length>100||
  typeof d.equipmentKey!=='string'||d.equipmentKey.length<3||
  d.equipmentKey.length>5000||
  typeof d.updatedAt!=='string'||!Number.isFinite(Date.parse(d.updatedAt))||
  !d.plans)throw Error('Draf output panggung tidak valid.');
 const body=validateStageSurfacePlan(d.plans.body);
 const floor=validateStageSurfacePlan(d.plans.floor);
 if(body.surface!=='body'||floor.surface!=='floor')throw Error('Bidang output tidak cocok.');
 return {...d,schema:'soma.stage-output-draft',version:1,
  plans:{body,floor}} as StageOutputDraft;
}
export function loadStageOutputDrafts(store:Pick<Store,'getItem'>):StageOutputDraft[]{
 try{
  const raw=store.getItem(STAGE_OUTPUT_DRAFTS_KEY),values=raw?JSON.parse(raw):[];
  if(!Array.isArray(values))return [];
  return values.slice(0,24).flatMap(v=>{
   try{return [validateStageOutputDraft(v)];}catch{return [];}
  }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,8);
 }catch{return [];}
}
export function saveStageOutputDraft(store:Store,draft:StageOutputDraft){
 const clean=validateStageOutputDraft(draft);
 const next=[clean,...loadStageOutputDrafts(store).filter(d=>d.id!==clean.id)].slice(0,8);
 store.setItem(STAGE_OUTPUT_DRAFTS_KEY,JSON.stringify(next));
 return next;
}
/** Draft load intentionally excludes output authorization, proofs and session. */
export function matchingStageOutputDraft(draft:StageOutputDraft,equipmentKey:string|null){
 return !!equipmentKey&&draft.equipmentKey===equipmentKey;
}
