import {PALETTES,TEXT_STYLES,COLOR_STYLES,switchLiveMode,type Palette} from './liveVisual';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {Range} from '../components';
import type {Settings} from '../engine/types';
import {hydraDefaults,type HydraConfig} from './hydraConfig';
import {parseHydraPatch} from './hydraPatch';
import {hydraStatus} from './hydraStatus';

export function HydraControls({settings:s,update}:{settings:Settings;update:(p:Partial<Settings>)=>void}){
 const h={...hydraDefaults(),...s.hydra};
 const status=useSyncExternalStore(hydraStatus.subscribe,hydraStatus.get);
 const [draft,setDraft]=useState(h.code),[error,setError]=useState('');
 useEffect(()=>{setDraft(h.code);setError('');},[h.code]);
 const change=(p:Partial<HydraConfig>)=>update({hydra:{...h,...p},...(p.enabled?{visual:{...s.visual,enabled:true}}:{})});
 const apply=()=>{try{parseHydraPatch(draft);change({code:draft,preset:'custom',enabled:true});setError('');}catch(e){setError((e as Error).message);}};
 return <section className="hydra-controls" aria-label="Mesin visual Hydra">
  <div className="section-label">EFEK GAMBAR <button className={`pill-toggle ${h.enabled?'on':''}`} aria-pressed={h.enabled} onClick={()=>change({enabled:!h.enabled})}>{h.enabled?'Aktif':'Aktifkan'}</button></div>
  <p className="hydra-status" role="status">{!h.enabled?'Visual dasar · Hydra nonaktif':!s.visual.enabled?'Visual dijeda · nyalakan melalui tombol Visual':s.output==='sound'?'Pilih keluaran Visual atau Keduanya':status}</p>
  {h.enabled&&<>
   {!s.visual.enabled&&<button className="outline-button small" onClick={()=>update({visual:{...s.visual,enabled:true}})}>Tampilkan visual</button>}
   <div className="hydra-presets">{([['liquid','01','Teks cair','Huruf melentur dalam gambar'],['echo','02','Jejak berulang','Lapisan gambar terus kembali'],['cut','03','Potongan','Ritme garis dan pecahan'],['body','04','Siluet × teks','Tubuh membuka bidang']] as const).map(([id,n,label,desc])=><button key={id} className={h.preset===id?'selected':''} aria-pressed={h.preset===id} onClick={()=>update(switchLiveMode(s,id))}><small>{n}</small><b>{label}</b><span>{desc}</span></button>)}</div>
   <p className="fine-print">Ganti langsung dengan tombol 1–4. Jejak dan feedback tetap tersimpan.</p>
   <label className="material-label">Palet warna<select aria-label="Palet warna" value={h.palette} onChange={e=>change({palette:e.target.value as Palette})}>{Object.entries(PALETTES).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}</select></label>
   <label className="material-label">Jejak tangan<select aria-label="Cara jejak bertahan" value={h.trails} onChange={e=>change({trails:e.target.value as typeof h.trails})}><option value="stack">Menumpuk sampai dibersihkan</option><option value="fade">Memudar perlahan</option><option value="off">Mati</option></select></label>
   {h.trails==='fade'&&<Range label="Lama jejak" min={.5} max={30} step={.5} value={h.trailLife} display={`${h.trailLife} s`} onChange={v=>change({trailLife:v})}/>}
   <details className="advanced-controls"><summary>Pengaturan visual lanjutan</summary>
   <div className="section-label">GERAK HURUF</div>
   <label className="material-label">Perilaku huruf<select aria-label="Perilaku huruf" value={h.typography} onChange={e=>change({typography:e.target.value as typeof h.typography,text:true})}>{TEXT_STYLES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <p className="fine-print">{h.typography==='classic'?'Gerak kata versi sebelumnya tetap tersedia.':h.typography==='elastic'?'Jepit dekat huruf untuk menarik. Buka kedua tangan untuk meregangkan kalimat.':h.typography==='fragments'?'Sapuan cepat memecah huruf. Perlambat gerak agar serpihan menyatu kembali.':h.typography==='flow'?'Sapuan menciptakan pusaran lokal. Huruf terus melayang sebentar setelah tangan berhenti.':'Foto yang diunggah mengisi huruf. Belum ada foto? Huruf tetap tampil dengan warna palet.'}</p>
   <label className="material-label">Perilaku warna<select aria-label="Perilaku warna" value={h.colorMode} onChange={e=>change({colorMode:e.target.value as typeof h.colorMode})}>{COLOR_STYLES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <Range label="Kepadatan jejak" value={h.density} onChange={v=>change({density:v})}/>
   <Range label="Peralihan mode" min={0} max={3} step={.1} value={h.transition} display={`${h.transition.toFixed(1)} s`} onChange={v=>change({transition:v})}/>
   <label className="check-field"><input type="checkbox" checked={h.echoes} onChange={e=>change({echoes:e.target.checked})}/>Gema rangka</label>
   {h.echoes&&<Range label="Lama gema" min={.5} max={30} step={.5} value={h.trailLife} display={`${h.trailLife} s`} onChange={v=>change({trailLife:v})}/>}
   <div className="performance-actions"><button className="outline-button small" aria-pressed={h.hold} onClick={()=>change({hold:!h.hold})}>{h.hold?'Lepas jejak':'Tahan jejak'}</button><button className="outline-button small" onClick={()=>change({textReset:h.textReset+1})}>Pulihkan teks</button></div>
   <p className="fine-print">Tahan membekukan jejak dan gema. Teks aktif, tracking, suara, dan rekaman terus berjalan. Peralihan membawa gambar mode sebelumnya, lalu melepasnya perlahan.</p>
   <div className="section-label">SUMBER CAMPURAN <span>BISA DIGABUNG</span></div>
   <div className="hydra-sources">{([['text','Teks'],['photo','Foto'],['camera','Kamera'],['silhouette','Siluet']] as const).map(([key,label])=><label className="check-field" key={key}><input type="checkbox" checked={h[key]} onChange={e=>change({[key]:e.target.checked})}/>{label}</label>)}</div>
   {(h.camera||h.silhouette)&&<p className="fine-print">Kamera memakai sesi yang sudah aktif. Siluet Body memakai area terdeteksi; Hands dan Mouse memakai bidang dari titik gerak. Face belum memiliki mask siluet.</p>}
   <div className="macro-controls">{([['mix','Campuran foto'],['distortion','Distorsi'],['repeat','Pengulangan'],['feedback','Bekas / feedback'],['readability','Keterbacaan'],['motion','Pengaruh gerak']] as const).map(([key,label])=><Range key={key} label={label} value={h[key]} onChange={v=>change({[key]:v})}/>)}</div>
   <p className="fine-print">Sapuan → distorsi · jepitan → campuran foto · bentangan tangan → pengulangan. Pengulangan bekerja pada Jejak berulang dan Potongan.</p>
   <button className="outline-button small" onClick={()=>change({reset:h.reset+1})}>Bersihkan jejak & feedback</button>
   <details className="hydra-editor"><summary>Editor patch Hydra {h.preset==='custom'?'· aktif':''}</summary><p className="fine-print">s0 teks · s1 foto · s2 kamera · s3 siluet · o0 feedback. Satu rangkaian fungsi visual, akhiri dengan .out(o0).</p><label className="material-label">Rangkaian visual<textarea aria-label="Patch Hydra" spellCheck={false} rows={8} maxLength={8000} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();apply();}}}/></label><button className="outline-button small" onClick={apply}>Terapkan patch</button>{error&&<p role="alert" className="inline-note">{error}</p>}<p className="fine-print">Kontrol: motion.x, y, speed, pinch, spread, mix, distortion, repeat, feedback, rotation. Gunakan motion.nama di dalam parameter. Patch kustom merespons kontrol yang ditulis di rangkaiannya. Editor menerima fungsi visual Hydra; JavaScript umum tidak dijalankan.</p></details>
   </details>
  </>}
 </section>;
}
