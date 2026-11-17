import {DEFAULT_ARCHIVE_PLAYBACK,validateArchivePlayback,type ArchiveSettings} from '../footprints/stage-optics/ArchivalCompositeEngine.ts';

export type StageSource='laptop'|'phone'|'simulation';
export type StageMediaSlot='A'|'B';
export type StageProjectMeta={
 schema:'soma.stage-session';version:1;id:'local-stage';
 name:string;source:StageSource;performers:1|2;updatedAt:string;
 archiveSettings:ArchiveSettings;bridgeHoldMs:number;
};
export const STAGE_DB='soma-stage-session-v1';
export const STAGE_MEDIA_LIMIT=300*1024*1024;
export function defaultStageMeta():StageProjectMeta{
 return {schema:'soma.stage-session',version:1,id:'local-stage',
  name:'Unpacking / Stage',source:'laptop',performers:1,
  updatedAt:new Date(0).toISOString(),
  archiveSettings:{
   A:{...DEFAULT_ARCHIVE_PLAYBACK},
   B:{...DEFAULT_ARCHIVE_PLAYBACK,zoom:1.35,contrast:1.3}
  },bridgeHoldMs:1400};
}
export function validateStageMeta(raw:unknown):StageProjectMeta{
 const r=raw as Partial<StageProjectMeta>|null;
 if(!r||r.schema!=='soma.stage-session'||r.version!==1||r.id!=='local-stage')
  throw new Error('Format proyek SOMA Stage belum didukung.');
 if(!['laptop','phone','simulation'].includes(r.source??'')||
  (r.performers!==1&&r.performers!==2)||
  typeof r.name!=='string'||r.name.length>100||
  !r.archiveSettings?.A||!r.archiveSettings?.B||
  !Number.isFinite(r.bridgeHoldMs)||r.bridgeHoldMs!<100||r.bridgeHoldMs!>30000)
  throw new Error('Data proyek Stage tidak valid.');
 validateArchivePlayback(r.archiveSettings.A);
 validateArchivePlayback(r.archiveSettings.B);
 return r as StageProjectMeta;
}
function openDB():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB tidak tersedia. Matikan Private Browsing atau coba browser lain.'));return;}
  const req=indexedDB.open(STAGE_DB,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('project'))db.createObjectStore('project');
   if(!db.objectStoreNames.contains('media'))db.createObjectStore('media');
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error??new Error('Database Stage gagal dibuka.'));
 });
}
async function useStore<T>(store:'project'|'media',mode:IDBTransactionMode,
 perform:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await openDB();
 try{
  return await new Promise<T>((resolve,reject)=>{
   const tx=db.transaction(store,mode);
   const request=perform(tx.objectStore(store));
   let result:T;
   request.onsuccess=()=>{result=request.result;};
   tx.oncomplete=()=>resolve(result);
   tx.onerror=()=>reject(tx.error??new Error('Penyimpanan Stage gagal.'));
   tx.onabort=()=>reject(tx.error??new Error('Penyimpanan dibatalkan.'));
  });
 }finally{db.close();}
}
export async function loadStageMeta():Promise<StageProjectMeta>{
 const found=await useStore<StageProjectMeta|undefined>('project','readonly',s=>s.get('local-stage'));
 return found?validateStageMeta(found):defaultStageMeta();
}
export function saveStageMeta(meta:StageProjectMeta):Promise<IDBValidKey>{
 return useStore('project','readwrite',s=>s.put(validateStageMeta(meta),'local-stage'));
}
export async function loadStageMedia(slot:StageMediaSlot):Promise<File|null>{
 const file=await useStore<File|undefined>('media','readonly',s=>s.get(slot));
 return file instanceof File?file:null;
}
export async function saveStageMedia(slot:StageMediaSlot,file:File|null):Promise<void>{
 if(file&&(file.size<=0||file.size>STAGE_MEDIA_LIMIT||!['video/mp4','video/webm','video/ogg','video/quicktime'].includes(file.type)))
  throw new Error('Gunakan MP4/WebM/Ogg/MOV maksimal 300 MB.');
 if(file)await useStore<IDBValidKey>('media','readwrite',s=>s.put(file,slot));
 else await useStore<undefined>('media','readwrite',s=>s.delete(slot));
}
export async function clearStageSession(){
 const db=await openDB();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['project','media'],'readwrite');
  tx.objectStore('project').clear();tx.objectStore('media').clear();
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error??new Error('Reset gagal.'));
  tx.onabort=()=>reject(tx.error??new Error('Reset dibatalkan.'));
 });}finally{db.close();}
}
