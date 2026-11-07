import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import type {MotionFrame,Settings} from '../engine/types';
import {PhotoGesture,photoSignal,nextPhotoSlot} from './gesture';
import {cameraAvailable,capturePhoto,readPhotos,savePhoto,removePhoto,type PhotoRecord} from './store';
import {download} from '../engine/recording';
import type {CameraCrop} from './framing';
export type PhotoItem=PhotoRecord&{url:string;saved:boolean};
type Options={visible:boolean;empty:boolean;size:number;gap:number;dwell:number;sound:boolean};
const initial:Options={visible:true,empty:true,size:1,gap:8,dwell:.8,sound:false};
const key='soma-photo-wall-options-v1';
export function usePhotoArchive({frameRef,settingsRef,videoRef,active,muted=false,notify}:{frameRef:RefObject<MotionFrame>;settingsRef:RefObject<Settings>;videoRef:RefObject<HTMLVideoElement|null>;active:boolean;muted?:boolean;notify:(message:string)=>void}){
 const [photos,setPhotos]=useState<(PhotoItem|null)[]>([null,null,null,null]);const photosRef=useRef(photos);
 const [options,setOptions]=useState<Options>(()=>{try{const o=JSON.parse(localStorage.getItem(key)||'{}');return {...initial,visible:typeof o.visible==='boolean'?o.visible:true,empty:typeof o.empty==='boolean'?o.empty:true,size:Math.max(.55,Math.min(1,Number(o.size)||1)),gap:typeof o.gap==='number'&&Number.isFinite(o.gap)?Math.max(0,Math.min(20,o.gap)):initial.gap,dwell:Math.max(.4,Math.min(2,Number(o.dwell)||.8))};}catch{return initial;}});
 const [enabled,setEnabled]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[replacement,setReplacement]=useState<number|null>(null),[message,setMessage]=useState('Memuat arsip foto…'),[progress,setProgress]=useState(0),[flash,setFlash]=useState<number|null>(null),[undo,setUndo]=useState<{slot:number;photo:PhotoItem|null}|null>(null);
 const gesture=useRef(new PhotoGesture()),lock=useRef(false),mounted=useRef(true),urls=useRef(new Set<string>()),shutter=useRef<AudioContext|null>(null);
 const state=useRef({enabled,options,replacement,active,loaded,muted});state.current={enabled,options,replacement,active,loaded,muted};
 const makeItem=(record:PhotoRecord,saved:boolean)=>{const url=URL.createObjectURL(record.blob);urls.current.add(url);return {...record,url,saved};};
 const commit=useCallback((next:(PhotoItem|null)[])=>{photosRef.current=next;setPhotos(next);},[]);
 useEffect(()=>{mounted.current=true;let cancelled=false;readPhotos().then(records=>{if(cancelled)return;const next:(PhotoItem|null)[]=[null,null,null,null];for(const r of records)next[r.slot]=makeItem(r,true);commit(next);setMessage('Arsip foto siap.');}).catch(()=>{if(!cancelled)setMessage('Penyimpanan belum tersedia. Foto sesi masih bisa diunduh.');}).finally(()=>{if(!cancelled)setLoaded(true);});return()=>{cancelled=true;mounted.current=false;for(const url of urls.current)URL.revokeObjectURL(url);urls.current.clear();void shutter.current?.close();shutter.current=null;};},[commit]);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify({...options,sound:false}));}catch{}},[options]);
 // Revoke replaced thumbnails after React has committed the next wall and undo slot.
 useEffect(()=>{const retained=new Set([...photos.filter(Boolean).map(p=>p!.url),...(undo?.photo?[undo.photo.url]:[])]);for(const url of urls.current)if(!retained.has(url)){URL.revokeObjectURL(url);urls.current.delete(url);}},[photos,undo]);
 useEffect(()=>{if(flash===null)return;const id=setTimeout(()=>setFlash(null),500);return()=>clearTimeout(id);},[flash]);
 const sound=()=>{const ac=shutter.current;if(state.current.muted||!state.current.options.sound||!ac||ac.state!=='running')return;const osc=ac.createOscillator(),gain=ac.createGain();osc.type='triangle';osc.frequency.setValueAtTime(900,ac.currentTime);osc.frequency.exponentialRampToValueAtTime(250,ac.currentTime+.065);gain.gain.setValueAtTime(.035,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.07);osc.connect(gain).connect(ac.destination);osc.start();osc.stop(ac.currentTime+.08);osc.onended=()=>{osc.disconnect();gain.disconnect();};};
 const capture=useCallback(async(crop?:CameraCrop)=>{
  if(lock.current||!state.current.loaded||!state.current.active)return false;
  const slot=nextPhotoSlot(photosRef.current,state.current.replacement);if(slot===null){notify('Arsip penuh · 4/4. Pilih Ganti pada salah satu foto.');return false;}
  if(!cameraAvailable(videoRef.current)){notify('Kamera belum siap. Nyalakan kamera sebelum memotret.');return false;}
  lock.current=true;setBusy(true);gesture.current.reset();
  try{const record=await capturePhoto(videoRef.current!,slot,settingsRef.current.mirror,crop);sound();let saved=true;try{await savePhoto(record);}catch{saved=false;}
   if(!mounted.current)return false;const item=makeItem(record,saved),previous=photosRef.current[slot];setUndo({slot,photo:previous});const next=[...photosRef.current];next[slot]=item;commit(next);setReplacement(null);state.current.replacement=null;setFlash(slot);setOptions(o=>({...o,visible:true}));const msg=saved?`Foto ${slot+1} tersimpan · ${next.filter(Boolean).length}/4`:`Foto ${slot+1} belum tersimpan. Unduh atau klik Simpan ulang sebelum menutup halaman.`;notify(msg);setMessage(msg);return true;
  }catch(e){notify((e as Error).message);return false;}finally{lock.current=false;if(mounted.current)setBusy(false);}
 },[commit,notify,settingsRef,videoRef]);
 useEffect(()=>{let raf=0,lastSample=-1,lastUI=0;const tick=(now:number)=>{raf=requestAnimationFrame(tick);const s=state.current,f=frameRef.current,available=cameraAvailable(videoRef.current),slot=nextPhotoSlot(photosRef.current,s.replacement);
  const permitted=s.active&&s.loaded&&s.enabled&&!lock.current&&settingsRef.current.input==='hands'&&available&&slot!==null&&!document.hidden;
  const fresh=now-f.time<300&&f.time>=0;
  if(f.time!==lastSample||!permitted||!fresh){lastSample=f.time;const g=gesture.current.step(fresh?photoSignal(f):{valid:false,open:false,click:false},f.time,permitted&&fresh,s.options.dwell*1000);
   if(g.fired){void capture();return;}
   if(now-lastUI>100){lastUI=now;setProgress(g.progress);setMessage(!s.loaded?'Memuat arsip foto…':lock.current?'Menyimpan foto…':!s.active?'Potret dijeda di ruang Archive.':!available?'Kamera belum siap.':slot===null?'Arsip penuh · 4/4':!s.enabled?'Gestur potret mati · tombol Jepret tetap tersedia.':settingsRef.current.input!=='hands'?'Pilih Hands untuk gestur potret.':g.phase==='ready'?`Siap memotret · kotak ${slot+1}. Jepit satu tangan.`:g.phase==='holding'?'Tahan dua telapak terbuka…':g.phase==='release'?'Lepas jepitan, lalu buka kedua telapak.':'Rentangkan dua telapak di depan kamera.');}
  }
 };raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[capture,frameRef,settingsRef,videoRef]);
 const selectReplacement=(slot:number|null)=>{gesture.current.reset();state.current.replacement=slot;setReplacement(slot);notify(slot===null?'Penggantian dibatalkan.':`Jepretan berikutnya mengganti foto ${slot+1}. Foto lama tetap tampil sampai jepretan berhasil.`);};
 const changeEnabled=(value:boolean)=>{gesture.current.reset();state.current.enabled=value;setEnabled(value);};
 const edit=async(slot:number,value:PhotoItem|null,remember=true)=>{if(lock.current)return;lock.current=true;setBusy(true);gesture.current.reset();try{if(value)await savePhoto(value);else await removePhoto(slot);if(!mounted.current)return;const before=photosRef.current[slot];if(remember)setUndo({slot,photo:before});else setUndo(null);const next=[...photosRef.current];next[slot]=value?{...value,saved:true}:null;commit(next);state.current.replacement=null;setReplacement(null);notify(value?`Foto ${slot+1} tersimpan.`:`Kotak ${slot+1} dikosongkan. Gunakan Urungkan untuk memulihkan foto.`);}catch(e){notify((e as Error).message);}finally{lock.current=false;if(mounted.current)setBusy(false);}};
 const retry=async(slot:number)=>{const p=photosRef.current[slot];if(p)await edit(slot,p,false);};
 const changeSound=async(value:boolean)=>{try{if(value){shutter.current??=new AudioContext();await shutter.current.resume();}setOptions(o=>({...o,sound:value}));}catch{notify('Bunyi rana belum tersedia. Foto tetap bisa diambil.');}};
 return {photos,options,setOptions,enabled,changeEnabled,loaded,busy,replacement,selectReplacement,message,progress,flash,undo,capture,remove:(slot:number)=>edit(slot,null),restore:()=>undo?edit(undo.slot,undo.photo,false):Promise.resolve(),retry,changeSound,download:(slot:number)=>{const p=photosRef.current[slot];if(p)download(p.blob,`SOMA-foto-${slot+1}-${p.createdAt.replace(/[:.]/g,'-')}.jpg`);}};
}
export type PhotoArchive=ReturnType<typeof usePhotoArchive>;
