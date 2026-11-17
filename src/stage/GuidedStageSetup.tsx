import {useState,type RefObject} from 'react';
import {GuidedFloorCalibration} from './GuidedFloorCalibration.tsx';
import {StageSetupPreview} from './StageSetupPreview.tsx';
import {guidedSetupReadiness,canVisitGuidedStep,GUIDED_STEPS} from './GuidedSetupEngine.ts';
import {cameraBinding,cameraBindingKey} from '../footprints/live/LiveFloorTrackingEngine.ts';
import type {MotionFrame} from '../engine/types.ts';
import type {LiveFloorTrackingEngine} from '../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../footprints/live/MultiPoseGaitRouter.ts';
import {RealDeviceValidationPanel} from './RealDeviceValidationPanel.tsx';
import {PhoneCameraReceiver} from './PhoneCameraReceiver.tsx';
import type {StageSessionController} from './useStageSession.ts';
const steps=['Sumber','Kalibrasi','Tracking','Arsip','Latihan'] as const;
export function GuidedStageSetup({open,onClose,session,onStartLaptop,onPhoneStream,onPhoneDisconnect,
 onCalibrate,onSimulator,onArchive,onPerform,cameraOn,calibrated,confirmed,contacts,
 frameRef,videoRef,floorTracker,identityRouter,phoneActive,performers,
 frameFresh,bodySelected,bodyPreviewReady,floorPreviewReady,
 cameraPreviewRef,bodyPreviewRef,floorPreviewRef,onCalibrationDirty,onCameraConfirmed}:{
 open:boolean;onClose:()=>void;session:StageSessionController;
 frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 floorTracker:LiveFloorTrackingEngine;identityRouter:MultiPoseGaitRouter;
 phoneActive:boolean;performers:1|2;
 frameFresh:boolean;bodySelected:boolean;bodyPreviewReady:boolean;floorPreviewReady:boolean;
 cameraPreviewRef:RefObject<HTMLCanvasElement|null>;bodyPreviewRef:RefObject<HTMLCanvasElement|null>;
 floorPreviewRef:RefObject<HTMLCanvasElement|null>;
 onCalibrationDirty:()=>void;onCameraConfirmed:()=>void;
 onStartLaptop:()=>void;onPhoneStream:(stream:MediaStream)=>Promise<void>|void;
 onPhoneDisconnect:()=>void;onCalibrate:()=>void;onSimulator:()=>void;
 onArchive:()=>void;onPerform:()=>void;cameraOn:boolean;
 calibrated:boolean;confirmed:boolean;contacts:number;
}){
 const [step,setStep]=useState(0);
 const [skipArchive,setSkipArchive]=useState(false);
 const [hint,setHint]=useState('');
 const current=frameRef.current,ids=identityRouter.status;
 const matched=floorTracker.boundCamera!==null&&
  floorTracker.boundCamera===cameraBindingKey(cameraBinding(videoRef.current));
 const readiness=guidedSetupReadiness({
  cameraOn,bodySelected,frameFresh,source:session.meta.source,phoneActive,
  videoReady:!!videoRef.current?.videoWidth&&!!videoRef.current?.videoHeight,
  floorConfirmed:confirmed,cameraMatched:matched,
  poseTracked:current.source==='camera'&&current.tracked&&frameFresh,
  contacts,performers,visibleCount:ids.visible.length,
  identityAmbiguous:ids.ambiguous,sameFrame:ids.observedFrameTime===current.time,
  hasArchive:!!(session.media.A||session.media.B),skipArchive,
  bodyPreview:bodyPreviewReady,floorPreview:floorPreviewReady
 });
 const advance=(to:number)=>{
  if(canVisitGuidedStep(to,readiness)){setHint('');setStep(to);}
  else {
   const first=GUIDED_STEPS.slice(0,to).find(key=>!readiness[key].ready);
   setHint(first?readiness[first].reason:'Langkah berikutnya belum siap.');
  }
 };
 return <section className="soma-guided-setup" hidden={!open}
  aria-label="Guided Stage Setup" aria-hidden={!open}>
  <header>
   <div><small>SOMA / S6.1 · STAGE SETUP</small><h2>Siapkan ruang gerak</h2>
    <p>Kamera → lantai → kaki → arsip → latihan. Setiap langkah memakai engine Footprints yang sama.</p></div>
   <button type="button" onClick={onClose}>Tutup setup</button>
  </header>
  <nav className="soma-guided-steps" aria-label="Tahap setup">
   {steps.map((name,i)=><button type="button" key={name}
    aria-current={step===i?'step':undefined} disabled={!canVisitGuidedStep(i,readiness)}
    title={!canVisitGuidedStep(i,readiness)?
     'Selesaikan langkah sebelumnya terlebih dahulu':readiness[GUIDED_STEPS[i]].reason}
    onClick={()=>advance(i)}>
    <span>{String(i+1).padStart(2,'0')}</span>{name}
    <small aria-hidden="true">{readiness[GUIDED_STEPS[i]].ready?'✓':'·'}</small></button>)}
  </nav>
  <div className="soma-setup-page" hidden={step!==0}>
   <h3>01 / Pilih sumber kamera</h3>
   <p>Webcam laptop dan kamera HP masuk ke pipeline pose tracking yang sama. Pilih salah satu kamera aktif.</p>
   <div className="soma-setup-choice">
    <button type="button" onClick={()=>{session.patch({source:'laptop'});onStartLaptop();}}>
     <b>Webcam laptop</b><small>Langsung melalui browser · HTTPS</small></button>
    <button type="button" onClick={()=>session.patch({source:'phone'})}
     aria-pressed={session.meta.source==='phone'}>
     <b>Kamera HP</b><small>Scan QR otomatis · WebRTC · kode manual cadangan</small></button>
    <button type="button" onClick={()=>{session.patch({source:'simulation'});onSimulator();}}>
     <b>Simulasi 3D</b><small>Tanpa kamera untuk latihan gerakan</small></button>
   </div>
   {session.meta.source==='phone'&&
    <PhoneCameraReceiver onStream={onPhoneStream} onDisconnect={onPhoneDisconnect}/>}
   <div className="soma-setup-status">Sumber tersimpan: {session.meta.source} ·
    kamera {cameraOn?'aktif':'belum aktif'}</div>
  </div>
  {step===1&&<div className="soma-setup-page">
   <h3>02 / Kalibrasi langsung di SOMA</h3>
   <p>Pilih empat titik bidang lantai pada gambar kamera. Auto Scan membaca marker warna di lantai dengan konfirmasi manusia.</p>
   <GuidedFloorCalibration tracker={floorTracker} videoRef={videoRef} cameraOn={cameraOn}
    active={open&&step===1} onDirty={onCalibrationDirty}
    onConfirmed={onCameraConfirmed} onOpenPhysicalQA={onCalibrate}/>
   <div className="soma-setup-status">Lantai: {confirmed&&matched?
    'sudah dikonfirmasi pada kamera aktif':calibrated?'perlu konfirmasi ulang':'belum dikalibrasi'}</div>
  </div>}
  <div className="soma-setup-page" hidden={step!==2}>
   <h3>03 / Periksa deteksi kaki</h3>
   <p>Pastikan kedua telapak terlihat. Uji walking, slow step, slide, pivot, dan crossing saat memakai dua performer.</p>
   <div className="soma-setup-status">{contacts} kontak tercatat · kamera {cameraOn?'aktif':'mati'} ·
    {readiness.tracking.reason}</div>
   <StageSetupPreview camera={cameraPreviewRef} body={bodyPreviewRef} floor={floorPreviewRef}
    cameraReady={frameFresh&&cameraOn}
    bodyReady={bodyPreviewReady} floorReady={floorPreviewReady}/>
   <p>Preview di atas memakai canvas yang sama dengan Stage Workspace. Hasil contact perlu diverifikasi pada lantai yang sudah dikalibrasi.</p>
   <button type="button" onClick={onSimulator}>Uji gerak dengan 3D Direct Puppet</button>
   {session.meta.source==='phone'&&<details className="soma-device-qa-disclosure">
    <summary>Real-Device Validation · S6.1.2</summary>
    <RealDeviceValidationPanel frameRef={frameRef} videoRef={videoRef}
     tracker={floorTracker} router={identityRouter}
     performers={performers} phoneActive={phoneActive}/>
   </details>}
  </div>
  {step===3&&<div className="soma-setup-page">
   <h3>04 / Pasang video arsip A/B</h3>
   <p>Unggah video kaki, pilih sumber mask, lalu hubungkan contact ke fragmen pad. Arsip disimpan secara lokal.</p>
   <div className="soma-setup-status">
    A: {session.media.A?.name??'belum ada'} · B: {session.media.B?.name??'belum ada'}</div>
   <label className="soma-setup-optional">
    <input type="checkbox" checked={skipArchive}
     onChange={e=>setSkipArchive(e.target.checked)}/>
    Lewati arsip pada sesi ini (pakai BODY mask dan FLOOR pad)</label>
   <button type="button" className="soma-setup-primary" onClick={onArchive}>Buka Archival Mapping</button>
  </div>}
  {step===4&&<div className="soma-setup-page">
   <h3>05 / Rehearsal dan Perform</h3>
   <p>Periksa video BODY, pad FLOOR, status output dan Blackout. Simpan proyek sebelum latihan.</p>
   <label>Nama proyek <input type="text" maxLength={100} value={session.meta.name}
    onChange={e=>session.patch({name:e.target.value})}/></label>
   <div className="soma-setup-status">{session.message}</div>
   <StageSetupPreview camera={cameraPreviewRef} body={bodyPreviewRef} floor={floorPreviewRef}
    cameraReady={frameFresh&&cameraOn} bodyReady={bodyPreviewReady}
    floorReady={floorPreviewReady}/>
   <div className="soma-setup-status">{readiness.rehearsal.reason}</div>
   <button type="button" className="soma-setup-primary"
    disabled={!readiness.rehearsal.ready}
    onClick={()=>{if(!readiness.rehearsal.ready)return;onClose();onPerform();}}>Buka Perform Monitor</button>
   <button type="button" onClick={()=>{if(window.confirm('Hapus proyek dan arsip SOMA yang tersimpan di browser ini?'))void session.reset();}}>
    Reset proyek lokal</button>
  </div>}
  {hint&&<div className="soma-setup-status" role="alert">{hint}</div>}
  <footer><button type="button" disabled={step===0} onClick={()=>advance(Math.max(0,step-1))}>Sebelumnya</button>
   <span>Langkah {step+1} / 5 · {readiness[GUIDED_STEPS[step]].reason}</span>
   <button type="button" disabled={step===4||!readiness[GUIDED_STEPS[step]].ready}
    title={readiness[GUIDED_STEPS[step]].reason}
    onClick={()=>advance(Math.min(4,step+1))}>Berikutnya</button></footer>
 </section>;
}
