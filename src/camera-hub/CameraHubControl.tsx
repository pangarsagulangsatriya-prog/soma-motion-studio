import {useEffect,useId,useRef,useState} from 'react';
import {Camera,CircleAlert,CircleCheck,CircleHelp,PlugZap,RefreshCcw,VideoOff,X} from 'lucide-react';
import {cameraSlotLabel,type CameraRecord} from './CameraHubRegistry.ts';
import {useCameraHub,useCameraHubSnapshot} from './CameraHubProvider.tsx';
import './camera-hub.css';

function CameraPreview({cameraId}:{cameraId:string}){
 const hub=useCameraHub(),ref=useRef<HTMLVideoElement>(null);
 const snapshot=useCameraHubSnapshot();
 const stream=hub.preview(cameraId);
 useEffect(()=>{
  const video=ref.current;
  if(!video)return;
  video.srcObject=stream;
  if(stream)void video.play().catch(()=>{});
  return()=>{video.pause();video.srcObject=null;};
 },[stream]);
 const item=snapshot.records.find(r=>r.cameraId===cameraId);
 const live=!!stream&&(item?.state==='routed'||item?.state==='ready');
 return <div className="soma-camera-hub-preview">
  <video ref={ref} muted autoPlay playsInline aria-label="Preview kamera terpilih"/>
  {!live&&<div className="soma-camera-hub-preview-empty"><VideoOff size={20}/>
   <span>Preview belum tersedia · sambungkan di Stage</span></div>}
 </div>;
}
function CameraItem({item,preview,onPreview,canUseStageOne,onUseStageOne}:{
 item:CameraRecord;preview:boolean;onPreview:()=>void;canUseStageOne:boolean;
 onUseStageOne?:(deviceId:string)=>void;
}){
 const assigned=item.assignments.map(slot=>cameraSlotLabel[slot]).join(', ');
 const live=item.state==='routed'||item.state==='ready';
 return <li className="soma-camera-hub-item" data-camera-state={item.state}>
  <div className="soma-camera-hub-item-head">
   <div className="soma-camera-hub-camera-icon"><Camera size={17}/></div>
   <div className="soma-camera-hub-item-title">
    <strong>{item.name}</strong>
    <span>{item.kind==='phone-webrtc'?'HP · nirkabel':item.kind==='local-video'?'Video':
     'Webcam / USB / capture'}</span>
   </div>
   <div className="soma-camera-hub-state" data-live={live}>
    {live?<CircleCheck size={13}/>:<CircleAlert size={13}/>}
    <span>{live?'Aktif':item.state==='discovered'?'Terdeteksi':
     item.state==='stale'?'Frame berhenti':item.state==='recovering'?'Memulihkan':
     item.state==='disconnected'?'Terlepas':'Belum aktif'}</span>
   </div>
  </div>
  <div className="soma-camera-hub-assignment">{assigned||'Belum digunakan Stage'}</div>
  <div className="soma-camera-hub-item-actions">
   <button type="button" onClick={onPreview}
    aria-pressed={preview}>{preview?'Tutup preview':'Periksa gambar'}</button>
   {item.deviceId&&<button type="button" disabled={!canUseStageOne}
    onClick={()=>onUseStageOne?.(item.deviceId!)}>
    {item.assignments.includes('stage1.track')?'Dipakai Stage 1':'Gunakan di Stage 1'}
   </button>}
  </div>
 </li>;
}
export function CameraHubControl({stageOneAvailable,onUseStageOne}:{
 stageOneAvailable:boolean;onUseStageOne?:(deviceId:string)=>void;
}){
 const hub=useCameraHub(),snapshot=useCameraHubSnapshot();
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<string|null>(null);
 const [error,setError]=useState('');
 const titleId=useId(),button=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLElement>(null);
 const refresh=async()=>{
  if(!navigator.mediaDevices?.enumerateDevices){
   setError('Browser belum menyediakan akses daftar kamera.');return;
  }
  try{
   const devices=await navigator.mediaDevices.enumerateDevices();
   hub.discover(devices);setError('');
  }catch{setError('Daftar kamera belum dapat dibaca. Periksa izin browser.');}
 };
 useEffect(()=>{if(open)void refresh();},[open]);
 useEffect(()=>{
  if(!open)return;
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setOpen(false);button.current?.focus();}
   if(event.key!=='Tab'||!dialog.current)return;
   const candidates=Array.from(dialog.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
   const first=candidates[0],last=candidates[candidates.length-1];
   if(!first||!last)return;
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',key);
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  const focus=requestAnimationFrame(()=>dialog.current?.querySelector<HTMLButtonElement>('button')?.focus());
  return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=previous;
   cancelAnimationFrame(focus);};
 },[open]);
 const used=snapshot.records.filter(item=>item.state==='ready'||item.state==='routed').length;
 const selectedRecord=snapshot.records.find(item=>item.cameraId===selected);
 return <>
  <button ref={button} type="button" className="soma-camera-hub-trigger"
   aria-label={'Camera Hub · '+used+' kamera aktif'}
   aria-expanded={open} aria-haspopup="dialog" aria-controls={titleId}
   title="Camera Hub · perangkat dan sambungan" onClick={()=>setOpen(value=>!value)}>
   <Camera size={17} aria-hidden="true"/>
   <span>Kamera · {used}</span>
  </button>
  {open&&<>
   <button type="button" className="soma-camera-hub-scrim"
    aria-label="Tutup Camera Hub" onClick={()=>setOpen(false)}/>
   <section ref={dialog} className="soma-camera-hub-panel" role="dialog"
    aria-modal="true" aria-labelledby={titleId}>
    <header className="soma-camera-hub-header">
     <div><strong id={titleId}>Camera Hub</strong>
      <small>{snapshot.records.length} terdaftar · {used} aktif · {snapshot.routed} digunakan</small>
     </div>
     <button type="button" aria-label="Tutup Camera Hub" onClick={()=>{
      setOpen(false);button.current?.focus();}}><X size={18}/></button>
    </header>
    <div className="soma-camera-hub-toolbar">
     <span>Perangkat di browser ini</span>
     <button type="button" onClick={()=>void refresh()}><RefreshCcw size={14}/> Perbarui</button>
    </div>
    {error&&<p className="soma-camera-hub-error" role="status">{error}</p>}
    {snapshot.records.length===0?<div className="soma-camera-hub-empty">
     <PlugZap size={22}/><strong>Belum ada kamera terdeteksi</strong>
     <span>Hubungkan webcam, capture card, atau buka Track untuk pairing HP.</span>
    </div>:<ul className="soma-camera-hub-list">
     {snapshot.records.map(item=><CameraItem key={item.cameraId} item={item}
      preview={selected===item.cameraId} onPreview={()=>setSelected(v=>v===item.cameraId?null:item.cameraId)}
      canUseStageOne={stageOneAvailable}
      onUseStageOne={id=>{onUseStageOne?.(id);setOpen(false);}}/>)}
    </ul>}
    {selectedRecord&&<CameraPreview cameraId={selectedRecord.cameraId}/>}
    <div className="soma-camera-hub-help"><CircleHelp size={15}/>
     <span>Perangkat terdeteksi belum tentu streaming. Untuk HP nirkabel, hubungkan lewat Track.
      Stage 1 dan F3 masih memakai jalur kameranya sendiri selama migrasi Camera Hub.</span>
    </div>
    <footer>Camera Hub V1 · monitoring koneksi. Maks. 10 terdaftar; pemrosesan multi-feed menyusul.</footer>
   </section>
  </>}
 </>;
}
