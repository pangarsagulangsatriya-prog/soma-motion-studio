import {useEffect,useState,type RefObject} from 'react';
import type {SafeProjectionPreflight} from './safeProjectionPreflight.ts';
import {startSetupBench} from './safeProjectionBench.ts';
import {Camera,CheckCircle2,ChevronDown,Clock3,HardDrive,Monitor,RefreshCw,
 ShieldAlert,SlidersHorizontal} from 'lucide-react';
import {cameraBinding,type LiveFloorTrackingEngine} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import {QUICK_STAGE_CAMERA_KEY,QUICK_STAGE_PROFILES_KEY,loadQuickStageProfiles,
 quickStageDiagnostics,quickStageMatchesCamera,storeQuickStageProfile,
 type QuickStageProfile} from './quickStageProfiles.ts';
import './quick-stage-setup.css';

type Props={
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;bodySelected:boolean;
 videoReady:boolean;frameFresh:boolean;cameraMatched:boolean;
 outputConnected:boolean;performerCount:1|2;visibleCount:number;
 identityAmbiguous:boolean;identityMatchedFrame:boolean;
 devices:MediaDeviceInfo[];deviceId:string;
 videoRef:RefObject<HTMLVideoElement|null>;
 tracker:LiveFloorTrackingEngine;router:MultiPoseGaitRouter;
 onConnectCamera:()=>Promise<boolean>;onSelectCamera:(deviceId:string)=>Promise<void>;
 onOpenCalibration:()=>void;onOpenProjector:()=>void;onBlackout:()=>void;
 projectionPreflight:SafeProjectionPreflight;onPrepareProjection:()=>void;
};
const readProfiles=()=>{try{return loadQuickStageProfiles(localStorage);}catch{return [];}};
const makeId=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?
 crypto.randomUUID():'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
export function QuickStageSetup({
 cameraOn,cameraBusy,cameraError,bodySelected,videoReady,frameFresh,cameraMatched,
 outputConnected,performerCount,visibleCount,identityAmbiguous,identityMatchedFrame,
 devices,deviceId,videoRef,tracker,router,
 onConnectCamera,onSelectCamera,onOpenCalibration,onOpenProjector,onBlackout,
 projectionPreflight,onPrepareProjection
}:Props){
 const [profiles,setProfiles]=useState<QuickStageProfile[]>(readProfiles);
 const [profileId,setProfileId]=useState<string>(()=>readProfiles()[0]?.id??'');
 const [profileName,setProfileName]=useState('Panggung Utama');
 const [feedback,setFeedback]=useState('');
 const [busy,setBusy]=useState(false);
 const [sessionStarted,setSessionStarted]=useState<number|null>(null);
 const [elapsed,setElapsed]=useState(0);
 useEffect(()=>{
  if(sessionStarted===null)return;
  const tick=()=>setElapsed(Math.round((Date.now()-sessionStarted)/1000));
  tick();
  const timer=window.setInterval(tick,1000);
  return()=>window.clearInterval(timer);
 },[sessionStarted]);
 const diagnostics=quickStageDiagnostics({
  cameraOn,cameraBusy,cameraError,bodySelected,videoReady,frameFresh,
  performerCount,visibleCount,identityAmbiguous,identityMatchedFrame,
  floorCalibrated:tracker.isCalibrated,floorConfirmed:tracker.isConfirmed,
  cameraMatched,outputConnected
 });
 const ready=diagnostics.filter(d=>d.state==='ready').length;
 const selected=profiles.find(p=>p.id===profileId)??null;
 const binding=cameraBinding(videoRef.current);
 const matched=selected?quickStageMatchesCamera(selected,binding):false;
 const start=async()=>{
  if(busy)return;
  setBusy(true);setFeedback('');setSessionStarted(Date.now());setElapsed(0);
  try{startSetupBench(sessionStorage,Date.now(),true);}catch{}
  try{
   const ok=await onConnectCamera();
   setFeedback(ok?'Kamera diminta. Tunggu gambar pertama lalu periksa profil lantai.':
    'Kamera belum tersedia. Periksa izin atau pilih perangkat.');
  }catch(e){setFeedback(e instanceof Error?e.message:'Gagal menghubungkan kamera.');}
  finally{setBusy(false);}
 };
 const save=()=>{
  const live=cameraBinding(videoRef.current);
  const calibration=tracker.calibrationData;
  if(!cameraOn||!bodySelected||!tracker.isConfirmed||!cameraMatched||
   !live||!calibration){
   setFeedback('Konfirmasi empat titik pada kamera aktif sebelum menyimpan profil.');return;
  }
  if(!live.deviceId){
   setFeedback('Browser belum menyediakan ID kamera. Periksa izin kamera lalu coba lagi.');return;
  }
  const name=profileName.trim().slice(0,100);
  if(!name){setFeedback('Isi nama profil panggung.');return;}
  const next:QuickStageProfile={
   schema:'soma.quick-stage-profile',version:1,
   id:selected?.id??makeId(),name,
   camera:{deviceId:live.deviceId,
    label:devices.find(d=>d.deviceId===live.deviceId)?.label??'Webcam',
    width:live.width,height:live.height},
   calibration,performers:performerCount,updatedAt:new Date().toISOString()
  };
  try{
   const records=storeQuickStageProfile(localStorage,next);
   setProfiles(records);setProfileId(next.id);
   setFeedback('Profil disimpan lokal. Gunakan Periksa profil pada sesi berikutnya.');
  }catch(e){setFeedback(e instanceof Error?e.message:'Profil gagal disimpan.');}
 };
 const restore=()=>{
  if(!selected){setFeedback('Pilih profil lebih dahulu.');return;}
  if(!matched||!binding){
   setFeedback('Perangkat atau resolusi berbeda. Pilih kamera profil, lalu ulangi kalibrasi.');return;
  }
  try{
   // Never restore a previous physical authorization or automatically approve
   // a floor. The current live camera stream gets a fresh binding.
   onBlackout();
   tracker.configure(selected.calibration,binding);
   router.reset();
   setFeedback('Profil lantai dimuat sebagai draft. Periksa keempat sudut dan konfirmasi ulang.');
   onOpenCalibration();
  }catch(e){setFeedback(e instanceof Error?e.message:'Profil gagal dimuat.');}
 };
 const remove=()=>{
  if(!selected)return;
  try{
   const next=profiles.filter(p=>p.id!==selected.id);
   localStorage.setItem(QUICK_STAGE_PROFILES_KEY,JSON.stringify(next));
   setProfiles(next);setProfileId(next[0]?.id??'');
   setFeedback('Profil lokal dihapus. Kalibrasi aktif tidak berubah.');
  }catch{setFeedback('Penyimpanan browser tidak dapat diperbarui.');}
 };
 return <details className="fp-quick-setup" aria-label="Quick Start dan profil panggung">
  <summary title="Quick Start · cek kesiapan dan profil panggung">
   <CheckCircle2 size={14} aria-hidden="true"/>
   <span>Stage Setup</span><small>{ready}/4</small><ChevronDown size={14}/>
  </summary>
  <div className="fp-quick-setup-panel">
   <header><strong>QUICK START</strong><span>Target sesi ulang ≤2 menit</span></header>
   <div className="fp-quick-setup-readiness" role="list" aria-label="Diagnosis persiapan panggung">
    {diagnostics.map(d=><div role="listitem" key={d.id}
     data-ready={d.state} title={d.detail}>
     <span className="fp-quick-setup-indicator" aria-hidden="true"/>
     <b>{d.label}</b><small>{d.state==='ready'?'Siap':
      d.state==='warning'?'Periksa':'Belum siap'}</small>
    </div>)}
   </div>
   <label className="fp-quick-setup-field">Kamera
    <select value={deviceId} disabled={cameraBusy||busy}
     onChange={event=>{
      setFeedback('Mengganti kamera. Kalibrasi lama perlu diperiksa ulang.');
      void onSelectCamera(event.target.value);
     }}>
     <option value="">Kamera default</option>
     {devices.filter(d=>d.deviceId).map((d,i)=><option key={d.deviceId}
      value={d.deviceId}>{d.label||`Kamera ${i+1}`}</option>)}
    </select>
   </label>
   <button className="fp-quick-setup-primary" type="button"
    onClick={()=>void start()} disabled={cameraBusy||busy}>
    <Camera size={15}/>{cameraOn?'Periksa kamera':'Hubungkan kamera'}
   </button>
   <div className="fp-quick-setup-divider"/>
   <label className="fp-quick-setup-field">Profil tersimpan
    <select value={profileId} onChange={e=>{
     setProfileId(e.target.value);setFeedback('');
     const p=profiles.find(p=>p.id===e.target.value);
     if(p)setProfileName(p.name);
    }}>
     <option value="">Pilih profil panggung</option>
     {profiles.map(p=><option key={p.id} value={p.id}>
      {p.name} · {p.calibration.floor.widthM}×{p.calibration.floor.depthM} m
     </option>)}
    </select>
   </label>
   {selected&&<p className="fp-quick-setup-detail">
    {selected.camera.label} · {selected.camera.width}×{selected.camera.height}
    {matched?' · kamera cocok':' · perlu pemeriksaan kamera'}
   </p>}
   <div className="fp-quick-setup-actions">
    <button type="button" onClick={restore} disabled={!selected||!cameraOn||cameraBusy}>
     <RefreshCw size={14}/> Gunakan profil
    </button>
    <button type="button" onClick={onOpenCalibration}>
     <SlidersHorizontal size={14}/> Periksa lantai
    </button>
   </div>
   <label className="fp-quick-setup-field">Nama profil
    <input maxLength={100} value={profileName}
     onChange={event=>setProfileName(event.target.value)}/>
   </label>
   <div className="fp-quick-setup-actions">
    <button type="button" onClick={save}><HardDrive size={14}/> Simpan profil</button>
    {selected&&<button type="button" onClick={remove}>Hapus</button>}
   </div>
   <div className="fp-quick-projection" role="group" aria-label="Persiapan proyeksi aman">
    <div className="fp-quick-projection-status">
     <strong>PROJECTION · {projectionPreflight.progress}/4</strong>
     <small>{projectionPreflight.detail}</small>
    </div>
    <button type="button" className="fp-quick-setup-primary"
     onClick={()=>{
      try{startSetupBench(sessionStorage,Date.now());}catch{}
      onPrepareProjection();
     }} disabled={cameraBusy&&projectionPreflight.step==='source'}>
     <Monitor size={14}/>{projectionPreflight.label}
    </button>
    <button type="button" className="fp-quick-setup-output" onClick={onOpenProjector}>
     <SlidersHorizontal size={14}/> Output QA · pengaturan lengkap
    </button>
   </div>
   {sessionStarted!==null&&<p className="fp-quick-setup-timer">
    <Clock3 size={14}/> Sesi: {Math.floor(elapsed/60).toString().padStart(2,'0')}:
    {(elapsed%60).toString().padStart(2,'0')} / target 02:00
    {ready===4?' · 4 indikator software siap':''}
   </p>}
   {feedback&&<p className="fp-quick-setup-message" role="status">{feedback}</p>}
   <p className="fp-quick-setup-note"><ShieldAlert size={13}/>
    Profil lokal menyimpan geometri, bukan izin proyektor. Periksa lantai dan
    output fisik sebelum Perform. Tidak ada upload video.</p>
  </div>
 </details>;
}
