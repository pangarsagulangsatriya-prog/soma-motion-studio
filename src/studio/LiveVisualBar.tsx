import type {Settings} from '../engine/types';
import {hydraDefaults} from './hydraConfig';
import {LIVE_MODES,PALETTES,TEXT_STYLES,switchLiveMode,type Palette} from './liveVisual';
export function LiveVisualBar({settings:s,update,shown,tracking,toggleTracking,photoCount=0,openPhotos,openCamera,voiceStatus}:{openCamera?:()=>void;voiceStatus?:string;photoCount?:number;openPhotos?:()=>void;settings:Settings;update:(p:Partial<Settings>)=>void;shown:boolean;tracking:boolean;toggleTracking:()=>void}){
 const h={...hydraDefaults(),...s.hydra};
 return <div className={`live-visual-bar ${shown?'shown':''}`} aria-label="Kontrol visual langsung">
  <label>MODE<select aria-label="Mode visual langsung" value={h.enabled?h.preset:'basic'} onChange={e=>update(switchLiveMode(s,e.target.value as typeof h.preset))}>{!h.enabled&&<option value="basic">Visual dasar</option>}{h.preset==='custom'&&<option value="custom">Patch kustom</option>}{LIVE_MODES.map(([id,label],i)=><option key={id} value={id}>{i+1} · {label}</option>)}</select></label>
  <label>HURUF<select aria-label="Gerak huruf langsung" value={h.typography} onChange={e=>update({...switchLiveMode(s,h.preset),hydra:{...h,enabled:true,text:true,typography:e.target.value as typeof h.typography}})}>{TEXT_STYLES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
  <label>WARNA<select aria-label="Palet warna langsung" value={h.palette} onChange={e=>update({hydra:{...h,palette:e.target.value as Palette}})}>{Object.entries(PALETTES).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}</select></label>
  <label>JEJAK<select aria-label="Jejak gerak" value={h.trails} onChange={e=>update({hydra:{...h,trails:e.target.value as typeof h.trails}})}><option value="stack">Menumpuk</option><option value="fade">Memudar</option><option value="off">Mati</option></select></label>
  {openCamera&&<button onClick={openCamera} title="Buka kotak kamera di tengah; atur dengan telapak lalu pukul">Bingkai kamera</button>}
  {openPhotos&&<button onClick={openPhotos} title="Atur suara kamera, gestur, dan empat foto">Arsip foto {photoCount}/4{voiceStatus==='listening'?' · MIC ●':''}</button>}
  <button aria-pressed={tracking} onClick={toggleTracking} title="Tampilkan rangka titik terdeteksi · T">Rangka <span>{tracking?'●':'○'}</span></button>
  <button aria-pressed={h.hold} onClick={()=>update({hydra:{...h,hold:!h.hold}})} title="Bekukan jejak dan gema; gerak dan suara terus berjalan">{h.hold?'Lepas jejak':'Tahan jejak'}</button>
  <button onClick={()=>update({hydra:{...h,textReset:h.textReset+1}})} title="Susun kembali huruf tanpa menghapus jejak">Pulihkan teks</button>
  <button onClick={()=>update({hydra:{...h,reset:h.reset+1}})} title="Hapus jejak dan feedback · R">Bersihkan</button>
 </div>;
}
