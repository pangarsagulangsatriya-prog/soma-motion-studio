import {useCallback,useEffect,useRef,useState} from 'react';
import {clearStageSession,defaultStageMeta,loadStageMedia,loadStageMeta,
 saveStageMedia,saveStageMeta,type StageMediaSlot,type StageProjectMeta} from './StageSessionStore.ts';

export type StageSessionController={
 meta:StageProjectMeta;media:Record<StageMediaSlot,File|null>;
 loaded:boolean;busy:boolean;message:string;
 patch:(patch:Partial<Omit<StageProjectMeta,'schema'|'version'|'id'>>)=>void;
 chooseMedia:(slot:StageMediaSlot,file:File|null)=>Promise<boolean>;
 reset:()=>Promise<void>;
};
export function useStageSession():StageSessionController{
 const [meta,setMeta]=useState<StageProjectMeta>(defaultStageMeta);
 const [media,setMedia]=useState<Record<StageMediaSlot,File|null>>({A:null,B:null});
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState('Membuka proyek lokal…');
 const latest=useRef(meta);latest.current=meta;
 const writes=useRef(Promise.resolve());
 const enqueue=(job:()=>Promise<unknown>):Promise<void>=>{
  const next=writes.current.then(job).then(()=>{});
  writes.current=next.catch(()=>{});
  return next;
 };
 useEffect(()=>{
  let active=true;
  void Promise.all([loadStageMeta(),loadStageMedia('A'),loadStageMedia('B')]).then(([data,A,B])=>{
   if(!active)return;
   latest.current=data;setMeta(data);setMedia({A,B});setLoaded(true);
   setMessage(A||B?'Proyek dan arsip lokal dipulihkan.':'Proyek Stage siap. Pilih video arsip.');
  }).catch(e=>{
   if(!active)return;
   setLoaded(true);setMessage('Penyimpanan lokal tidak tersedia: '+String(e));
  });
  return()=>{active=false;};
 },[]);
 const patch=useCallback((values:Partial<Omit<StageProjectMeta,'schema'|'version'|'id'>>)=>{
  const next={...latest.current,...values,updatedAt:new Date().toISOString()};
  latest.current=next;setMeta(next);
  void enqueue(async()=>{await saveStageMeta(next);}).catch(e=>
   setMessage('Pengaturan belum tersimpan: '+String(e)));
 },[]);
 const chooseMedia=useCallback(async(slot:StageMediaSlot,file:File|null)=>{
  if(!loaded){setMessage('Tunggu sampai proyek lokal siap.');return false;}
  setBusy(true);
  try{
   await enqueue(()=>saveStageMedia(slot,file));
   setMedia(current=>({...current,[slot]:file}));
   setMessage(file?'Arsip '+slot+' tersimpan lokal: '+file.name:'Arsip '+slot+' dilepas.');
   return true;
  }catch(e){
   setMessage('Arsip gagal disimpan: '+String(e));return false;
  }finally{setBusy(false);}
 },[loaded]);
 const reset=useCallback(async()=>{
  setBusy(true);
  try{
   await enqueue(clearStageSession);
   const next=defaultStageMeta();
   latest.current=next;setMeta(next);setMedia({A:null,B:null});
   setMessage('Proyek dan arsip lokal dibersihkan.');
  }catch(e){setMessage('Reset gagal: '+String(e));}
  finally{setBusy(false);}
 },[]);
 return {meta,media,loaded,busy,message,patch,chooseMedia,reset};
}
