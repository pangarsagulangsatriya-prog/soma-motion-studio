import {Monitor,Pause,Play,Square,SlidersHorizontal} from 'lucide-react';
import type {Projection} from '../../projection/useProjection.ts';
import {identityQuad} from '../../projection/geometry.ts';

export function FloorProjectionPanel({projection:p,verified,testPattern,onVerify,onTestPattern,onOpenOutput,onCalibrate,onLive,onHold,onBlackout,sourceLabel='simulator',qaActive=false}:{
 projection:Projection;verified:boolean;testPattern:boolean;sourceLabel?:'simulator'|'live';qaActive?:boolean;onVerify:(value:boolean)=>void;onTestPattern:(value:boolean)=>void;
 onOpenOutput:()=>void;onCalibrate:()=>void;onLive:()=>void;onHold:()=>void;onBlackout:()=>void;
}){
 const connected=p.status.connected,hasDefaultCorners=JSON.stringify(p.config.quad)===JSON.stringify(identityQuad());
 return <section className="puppet-projection" aria-label="Proyeksi lantai bersama SOMA">
  <div className="puppet-section-title"><Monitor size={16}/><b>FLOOR → PROJECTION</b>
   <span>{connected?'Output tersambung':p.opened?'Menghubungkan…':'Output tertutup'}</span>
  </div>
  <p>{sourceLabel==='live'?'Jejak kaki dari kamera Body':'Jejak simulator'} dikirim lewat jendela SOMA Projection yang sama. Titik 1–4 harus sesuai keempat sudut lantai fisik.</p>
  <div className="puppet-output-actions">
   <button type="button" onClick={onOpenOutput}><Monitor size={15}/> {p.opened?'Buka ulang output':'Buka output'}</button>
   <button type="button" onClick={onCalibrate}><SlidersHorizontal size={15}/> Kalibrasi lantai</button>
   <button type="button" aria-pressed={testPattern} className={testPattern?'active':''} disabled={qaActive}
    onClick={()=>onTestPattern(!testPattern)}>{qaActive?'QA · silang interior aktif':'Tanda 4 sudut '+(testPattern?'aktif':'uji')}</button>
  </div>
  <div className="puppet-calibration-warning">
   <b>{hasDefaultCorners?'Kalibrasi masih memakai empat sudut default.':'Periksa empat sudut kalibrasi yang tersimpan.'}</b>
   <span>Tempatkan jendela output pada proyektor fisik. Di SOMA Projection → Kalibrasi, cocokkan titik 1–4 dengan batas lantai. Screen Mapping dipakai satu kali; mirror, offset, dan registration siluet tidak diterapkan pada artwork lantai.</span>
  </div>
  <label className="puppet-confirm-floor">
   <input type="checkbox" checked={verified} onChange={e=>onVerify(e.target.checked)}/>
   <span>Saya sudah memeriksa proyeksi empat sudut lantai pada perangkat yang dipakai.</span>
  </label>
  <div className="puppet-output-actions puppet-output-transport" role="group" aria-label="Transport proyektor">
   <button type="button" className={p.transport==='live'?'active':''} aria-pressed={p.transport==='live'}
    disabled={!(verified||testPattern)||!p.opened} onClick={onLive}><Play size={15}/> Live</button>
   <button type="button" className={p.transport==='hold'?'active':''} aria-pressed={p.transport==='hold'}
    disabled={!(verified||testPattern)||!p.opened||p.transport==='blackout'} onClick={onHold}><Pause size={15}/> Hold</button>
   <button type="button" className={p.transport==='blackout'?'active blackout':''}
    aria-pressed={p.transport==='blackout'} onClick={onBlackout}><Square size={15}/> Blackout</button>
  </div>
  <p className="puppet-projector-status" role="status">
   {p.status.error||(qaActive?'Mode QA: satu silang interior diproyeksikan bergantian. Klik pusat cahaya pada gambar kamera.':testPattern?'Mode uji: empat tanda sudut diproyeksikan. Ukur posisinya, lalu atur kalibrasi.':!verified?'Output jejak dikunci sampai kalibrasi lantai dikonfirmasi.':
    !connected?'Menunggu heartbeat dari jendela output. Pastikan pop-up tidak diblokir.':
    p.transport==='blackout'?'Proyektor dipadamkan.':
    p.transport==='hold'?'Jejak terakhir ditahan pada output.':
    sourceLabel==='live'?'Live: jejak kontak perkiraan kamera diteruskan ke proyektor.':'Live: jejak virtual mengikuti sesi Footprints.')}
  </p>
 </section>;
}
