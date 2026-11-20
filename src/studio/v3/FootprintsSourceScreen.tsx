import {AlertTriangle,ArrowUpRight,Box,Camera,Film,LoaderCircle,Smartphone} from 'lucide-react';
import type {SourceScreenMode} from './sourceScreenModel.ts';

export function FootprintsSourceScreen({mode,cameraError,onWebcam,onPhone,onVideo,onSimulator}:{
 mode:Extract<SourceScreenMode,'select'|'connecting'|'recover'>;
 cameraError:string;onWebcam:()=>void;onPhone:()=>void;onVideo:()=>void;onSimulator:()=>void;
}){
 const connecting=mode==='connecting',failed=mode==='recover';
 return <section className="fp-source-launchpad" aria-label="Pilih sumber gerak Footprints"
  aria-busy={connecting}>
  <div className="fp-source-lead">
   <span className="fp-source-eyebrow">SOMA / FOOTPRINTS</span>
   <div className="fp-source-ledger" aria-hidden="true">
    <span>INPUT</span><i/><span>GAIT</span><i/><span>VISUAL</span>
   </div>
   <h2>{connecting?'Menghubungkan kamera':failed?'Kamera belum tersambung':'Mulai dengan gerak'}</h2>
   <p>{connecting?'Periksa permintaan izin kamera dari browser. SOMA sedang menyiapkan sumber langsung.':
    failed?'Coba webcam kembali atau pilih sumber lain untuk berlatih.':
    'Pilih sumber untuk membaca gerakan kaki. Gunakan kamera langsung atau coba rekaman latihan.'}</p>
   {connecting&&<div className="fp-source-feedback" role="status" aria-live="polite">
    <LoaderCircle size={16} className="fp-source-spinner" aria-hidden="true"/>
    <span>Menunggu izin dan sambungan kamera…</span>
   </div>}
   {failed&&<div className="fp-source-feedback fp-source-feedback-error" role="alert">
    <AlertTriangle size={16} aria-hidden="true"/>
    <span>{cameraError}</span>
   </div>}
   {!connecting&&!failed&&<div className="fp-source-led-note">
    <span className="fp-source-mark" aria-hidden="true"/>
    <span>Video dan simulasi diproses sebagai eksperimen. Projector tetap terkunci sampai QA.</span>
   </div>}
  </div>
  <div className="fp-source-groups" aria-label="Metode input">
   <div className="fp-source-choice-group">
    <div className="fp-source-choice-head"><span>LANGSUNG</span><small>Live capture</small></div>
    <div className="fp-source-choice-grid">
     <button type="button" className="fp-source-choice fp-source-choice-main"
      disabled={connecting} onClick={onWebcam}
      aria-label={failed?'Coba kembali webcam laptop':'Gunakan webcam laptop'}>
      <span className="fp-source-choice-icon"><Camera size={20} aria-hidden="true"/></span>
      <span className="fp-source-choice-copy"><strong>{failed?'Coba webcam lagi':'Webcam laptop'}</strong>
       <small>Gerakan langsung dari komputer</small></span>
      <ArrowUpRight size={15} className="fp-source-choice-arrow" aria-hidden="true"/>
     </button>
     <button type="button" className="fp-source-choice" disabled={connecting} onClick={onPhone}>
      <span className="fp-source-choice-icon"><Smartphone size={20} aria-hidden="true"/></span>
      <span className="fp-source-choice-copy"><strong>Hubungkan kamera</strong><small>USB · HDMI · OBS · HP / QR</small></span>
      <ArrowUpRight size={15} className="fp-source-choice-arrow" aria-hidden="true"/>
     </button>
    </div>
   </div>
   <div className="fp-source-choice-group">
    <div className="fp-source-choice-head"><span>LATIHAN & RISET</span><small>Experiments</small></div>
    <div className="fp-source-choice-grid">
     <button type="button" className="fp-source-choice" disabled={connecting} onClick={onVideo}>
      <span className="fp-source-choice-icon"><Film size={20} aria-hidden="true"/></span>
      <span className="fp-source-choice-copy"><strong>Video MP4</strong><small>Analisis pose dan gait</small></span>
      <ArrowUpRight size={15} className="fp-source-choice-arrow" aria-hidden="true"/>
     </button>
     <button type="button" className="fp-source-choice" disabled={connecting} onClick={onSimulator}>
      <span className="fp-source-choice-icon"><Box size={20} aria-hidden="true"/></span>
      <span className="fp-source-choice-copy"><strong>Simulasi 3D</strong><small>Gerak virtual tanpa kamera</small></span>
      <ArrowUpRight size={15} className="fp-source-choice-arrow" aria-hidden="true"/>
     </button>
    </div>
   </div>
  </div>
 </section>;
}
