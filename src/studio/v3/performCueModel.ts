/** OPS-R1 — operator cue cards. Data only: no projector live/QA permission stored here. */
/** V5 reset: cue scene values are normalized to diagnostic FLOOR mode. */
export type PerformSceneId='footprints';
export type PerformView='overview'|'body'|'floor'|'split';
export type PerformCueSlot={id:string;label:string;scene:PerformSceneId;view:PerformView};
export type PerformCueGrid={schema:'soma.perform-cues';version:1;slots:PerformCueSlot[]};
export const PERFORM_CUE_STORAGE_KEY='soma-perform-cues-v1';
export const PERFORM_SCENES:readonly PerformSceneId[]=['footprints'];
export const PERFORM_VIEWS:readonly PerformView[]=['overview','body','floor','split'];
export const PERFORM_GRID_SIZE=8;
export function defaultPerformCueGrid():PerformCueGrid{
 const defaults:PerformSceneId[]=Array.from({length:PERFORM_GRID_SIZE},()=> 'footprints');
 return {schema:'soma.perform-cues',version:1,slots:defaults.map((scene,index)=>({
  id:'cue-'+(index+1),label:'Cue '+String(index+1).padStart(2,'0'),
  scene,view:index===0?'overview':index===7?'split':index%2===0?'body':'floor'
 }))};
}
export function normalizePerformCueGrid(raw:unknown):PerformCueGrid{
 const fresh=defaultPerformCueGrid();
 if(!raw||typeof raw!=='object')return fresh;
 const record=raw as Partial<PerformCueGrid>;
 if(record.schema!==fresh.schema||record.version!==1||!Array.isArray(record.slots)||record.slots.length!==PERFORM_GRID_SIZE)return fresh;
 const seen=new Set<string>();
 const slots:PerformCueSlot[]=[];
 for(let index=0;index<PERFORM_GRID_SIZE;index++){
  const slot=record.slots[index];
  if(!slot||typeof slot!=='object'||typeof slot.id!=='string'||slot.id!=='cue-'+(index+1)||seen.has(slot.id))return fresh;
  seen.add(slot.id);
  // Discard retired scene IDs from historical cue-grid presets.
  const scene:PerformSceneId='footprints';
  const view=PERFORM_VIEWS.includes(slot.view)?slot.view:fresh.slots[index].view;
  const label=typeof slot.label==='string'&&slot.label.trim()?slot.label.trim().slice(0,44):fresh.slots[index].label;
  slots.push({id:slot.id,label,scene,view});
 }
 return {...fresh,slots};
}
export function updatePerformCueSlot(grid:PerformCueGrid,index:number,changes:Partial<Pick<PerformCueSlot,'label'|'scene'|'view'>>):PerformCueGrid{
 if(!Number.isInteger(index)||index<0||index>=PERFORM_GRID_SIZE)throw Error('Slot cue di luar rentang.');
 const slots=grid.slots.map((slot,i)=>i===index?{...slot,...changes}:slot);
 return normalizePerformCueGrid({...grid,slots});
}
export type PerformReadiness='preview'|'attention'|'qa-required';
export function evaluatePerformReadiness(input:{
 source:'webcam'|'phone'|'video'|'simulator'|null;
 cameraOk:boolean;identityOk:boolean;floorOk:boolean;
 bodyOutputQa:boolean;floorOutputQa:boolean;
}):{state:PerformReadiness;reason:string}{
 if(input.source==='video'||input.source==='simulator')
  return {state:'preview',reason:'MP4/3D hanya mengendalikan preview. Output fisik terkunci.'};
 if(!input.cameraOk)return {state:'attention',reason:'Kamera atau frame tracking belum siap.'};
 if(!input.identityOk)return {state:'attention',reason:'Identitas performer belum stabil.'};
 if(!input.floorOk)return {state:'attention',reason:'Lantai perlu kalibrasi dan pencocokan kamera.'};
 if(!input.bodyOutputQa||!input.floorOutputQa)
  return {state:'qa-required',reason:'Pemeriksaan fisik BODY/FLOOR lima titik belum lengkap atau tidak terhubung.'};
 return {state:'qa-required',reason:'Bukti software tersedia. Operator tetap wajib memeriksa cahaya dan blackout nyata di Map.'};
}
/** Applying a cue never changes the hardware stage state or reuses prior QA permission. */
export function performCueAuthorizesLight(){return false;}
