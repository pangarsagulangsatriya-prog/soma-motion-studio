import {useState} from 'react';
import {PhoneCameraReceiver} from './PhoneCameraReceiver.tsx';
import type {StageSessionController} from './useStageSession.ts';
const steps=['Sumber','Kalibrasi','Tracking','Arsip','Latihan'] as const;
export function GuidedStageSetup({open,onClose,session,onStartLaptop,onPhoneStream,onPhoneDisconnect,
 onCalibrate,onSimulator,onArchive,onPerform,cameraOn,calibrated,confirmed,contacts}:{
 open:boolean;onClose:()=>void;session:StageSessionController;
 onStartLaptop:()=>void;onPhoneStream:(stream:MediaStream)=>Promise<void>|void;
 onPhoneDisconnect:()=>void;onCalibrate:()=>void;onSimulator:()=>void;
 onArchive:()=>void;onPerform:()=>void;cameraOn:boolean;
 calibrated:boolean;confirmed:boolean;contacts:number;
}){
 const [step,setStep]=useState(0);
 return <section className="soma-guided-setup" hidden={!open}
  aria-label="Guided Stage Setup" aria-hidden={!open}>
  <header>
   <div><small>SOMA / S6.1 · STAGE SETUP</small><h2>Siapkan ruang gerak</h2>
    <p>Kamera → lantai → kaki → arsip → latihan. Setiap langkah memakai engine Footprints yang sama.</p></div>
   <button type="button" onClick={onClose}>Tutup setup</button>
  </header>
  <nav className="soma-guided-steps" aria-label="Tahap setup">
   {steps.map((name,i)=><button type="button" key={name}
    aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}>
    <span>{String(i+1).padStart(2,'0')}</span>{name}</button>)}
  </nav>
  <div className="soma-setup-page" hidden={step!==0}>
   <h3>01 / Pilih sumber kamera</h3>
   <p>Webcam laptop dan kamera HP masuk ke pipeline pose tracking yang sama. Pilih salah satu kamera aktif.</p>
   <div className="soma-setup-choice">
    <button type="button" onClick={()=>{session.patch({source:'laptop'});onStartLaptop();}}>
     <b>Webcam laptop</b><small>Langsung melalui browser · HTTPS</small></button>
    <button type="button" onClick={()=>session.patch({source:'phone'})}
     aria-pressed={session.meta.source==='phone'}>
     <b>Kamera HP</b><small>Browser HP · WebRTC · pairing manual MVP</small></button>
    <button type="button" onClick={()=>{session.patch({source:'simulation'});onSimulator();}}>
     <b>Simulasi 3D</b><small>Tanpa kamera untuk latihan gerakan</small></button>
   </div>
   {session.meta.source==='phone'&&
    <PhoneCameraReceiver onStream={onPhoneStream} onDisconnect={onPhoneDisconnect}/>}
   <div className="soma-setup-status">Sumber tersimpan: {session.meta.source} ·
    kamera {cameraOn?'aktif':'belum aktif'}</div>
  </div>
  {step===1&&<div className="soma-setup-page">
   <h3>02 / Kalibrasi lantai & proyektor</h3>
   <p>Tandai keempat sudut lantai dalam gambar kamera, ukur dimensi asli, lalu verifikasi sudut dan lima titik QA.</p>
   <div className="soma-setup-status">Lantai: {confirmed?'sudah dikonfirmasi':calibrated?'menunggu konfirmasi':'belum dikalibrasi'}</div>
   <button type="button" className="soma-setup-primary" onClick={onCalibrate}>Buka kalibrasi Footprints</button>
   <p>Kalibrasi otomatis dengan marker masih tahap berikut. Jangan menggunakan hasil simulasi sebagai persetujuan proyeksi fisik.</p>
  </div>}
  {step===2&&<div className="soma-setup-page">
   <h3>03 / Periksa deteksi kaki</h3>
   <p>Pastikan kedua telapak terlihat. Uji walking, slow step, slide, pivot, dan crossing saat memakai dua performer.</p>
   <div className="soma-setup-status">{contacts} kontak tercatat · kamera {cameraOn?'aktif':'mati'}</div>
   <p>Hasil contact hanya dapat dipercaya setelah posisi kamera dan lantai selesai dikalibrasi.</p>
   <button type="button" onClick={onSimulator}>Uji gerak dengan 3D Direct Puppet</button>
  </div>}
  {step===3&&<div className="soma-setup-page">
   <h3>04 / Pasang video arsip A/B</h3>
   <p>Unggah video kaki, pilih sumber mask, lalu hubungkan contact ke fragmen pad. Arsip disimpan secara lokal.</p>
   <div className="soma-setup-status">
    A: {session.media.A?.name??'belum ada'} · B: {session.media.B?.name??'belum ada'}</div>
   <button type="button" className="soma-setup-primary" onClick={onArchive}>Buka Archival Mapping</button>
  </div>}
  {step===4&&<div className="soma-setup-page">
   <h3>05 / Rehearsal dan Perform</h3>
   <p>Periksa video BODY, pad FLOOR, status output dan Blackout. Simpan proyek sebelum latihan.</p>
   <label>Nama proyek <input type="text" maxLength={100} value={session.meta.name}
    onChange={e=>session.patch({name:e.target.value})}/></label>
   <div className="soma-setup-status">{session.message}</div>
   <button type="button" className="soma-setup-primary"
    onClick={()=>{onClose();onPerform();}}>Buka Perform Monitor</button>
   <button type="button" onClick={()=>{if(window.confirm('Hapus proyek dan arsip SOMA yang tersimpan di browser ini?'))void session.reset();}}>
    Reset proyek lokal</button>
  </div>}
  <footer><button type="button" disabled={step===0} onClick={()=>setStep(i=>Math.max(0,i-1))}>Sebelumnya</button>
   <span>Langkah {step+1} / 5</span>
   <button type="button" disabled={step===4} onClick={()=>setStep(i=>Math.min(4,i+1))}>Berikutnya</button></footer>
 </section>;
}
