import type {FootprintConfig,FootprintStyle} from './StudioFootprints';
import {palettes} from './pattern';
export function FootprintsPanel({config:c,update,onOpenOutput,onOpenCalibration,onCapture,onClear,onNewSession,onExportSVG,onExportJSON,onImportJSON,onRecord,isRecording}:{
 config:FootprintConfig;update:(next:Partial<FootprintConfig>)=>void;
 onOpenOutput:()=>void;onOpenCalibration:()=>void;onCapture:()=>void;
 onClear:()=>void;onNewSession:()=>void;onExportSVG:()=>void;onExportJSON:()=>void;
 onRecord?:()=>void;isRecording?:boolean;onImportJSON:(file:File)=>void;
}){
 const setPalette=(v:number)=>{const a=palettes[v]??palettes[0];update({palette:v,colors:{background:a[1],left:a[2],right:a[3]}});};
 const setColor=(key:keyof FootprintConfig['colors'],value:string)=>update({colors:{...c.colors,[key]:value}});
 return <section className="footprints-config" aria-label="Pengaturan visual Footprints">
  <div className="fp-title-row"><b>FOOTPRINTS / BODY</b><span className="fp-tag">VISUAL LIVE</span></div>
  <p className="fp-intro">Gerak tumit dan ujung kaki dari kamera Body membentuk tapak, lintasan, dan residu. Suara, arsip foto, serta lapisan Studio tetap dapat dipakai.</p>
  <div className="section-label">BENTUK JEJAK <span>PRESET</span></div>
  <div className="fp-style-grid">{([
   ['Campuran','Tapak + lintasan'],['Tapak','Cetak kaki'],['Garis','Jalur gerak'],['Titik','Partikel titik']
  ] as [FootprintStyle,string][]).map(([id,label])=><button key={id} type="button" aria-pressed={c.style===id} onClick={()=>update({style:id})}><strong>{id}</strong><small>{label}</small></button>)}</div>
  <label className="fp-range">Palet warna<select value={c.palette} onChange={e=>setPalette(+e.target.value)}>{palettes.map((p,i)=><option key={p[0]} value={i}>{p[0]}</option>)}</select></label>
  <div className="fp-colors">
   <label>Latar<input type="color" aria-label="Warna latar Footprints" value={c.colors.background} onChange={e=>setColor('background',e.target.value)}/></label>
   <label>Kaki kiri<input type="color" aria-label="Warna kaki kiri" value={c.colors.left} onChange={e=>setColor('left',e.target.value)}/></label>
   <label>Kaki kanan<input type="color" aria-label="Warna kaki kanan" value={c.colors.right} onChange={e=>setColor('right',e.target.value)}/></label>
  </div>
  <div className="section-label">RESPONS JEJAK <span>REALTIME</span></div>
  <label className="fp-range"><span>Ukuran tapak <b>{c.size}px</b></span><input type="range" min="12" max="90" value={c.size} onChange={e=>update({size:+e.target.value})}/></label>
  <label className="fp-range"><span>Umur jejak <b>{c.life} detik</b></span><input type="range" min="1" max="60" value={c.life} onChange={e=>update({life:+e.target.value})}/></label>
  <label className="fp-range"><span>Jeda tampil <b>{c.delay.toFixed(1)} detik</b></span><input type="range" min="0" max="2" step=".1" value={c.delay} onChange={e=>update({delay:+e.target.value})}/></label>
  <div className="fp-options">
   <label><input type="checkbox" checked={c.showLive} onChange={e=>update({showLive:e.target.checked})}/> Kaki bergerak</label>
   <label><input type="checkbox" checked={c.showTrail} onChange={e=>update({showTrail:e.target.checked})}/> Garis lintasan</label>
   <label><input type="checkbox" checked={c.hold} onChange={e=>update({hold:e.target.checked})}/> Tahan jejak</label>
  </div>
  <div className="section-label">PANGGUNG <span>PAKAI PROJECTION SOMA</span></div>
  <div className="fp-actions">
   <button className="fp-primary" onClick={onOpenOutput}>Buka output</button>
   <button onClick={onOpenCalibration}>Kalibrasi bidang</button>
  </div>
  <p className="fp-footnote">Output memakai kalibrasi empat titik, Live/Hold/Blackout, dan jendela proyektor SOMA yang sama. Tidak ada konfigurasi proyeksi kedua.</p>
  <div className="section-label">POLA SESI <span>ARSIP VISUAL</span></div>
  <div className="fp-actions">
   <button className="fp-primary" onClick={onCapture}>Simpan PNG</button>
   <button onClick={onExportSVG}>Simpan SVG</button>
   <button onClick={onExportJSON}>Data JSON</button>
   <button onClick={onClear}>Bersihkan layar</button>
   <button onClick={onNewSession}>Sesi baru</button>
   {onRecord&&<button onClick={onRecord}>{isRecording?'Stop video':'Rekam video'}</button>}
  </div>
  <label className="fp-range">Buka sesi JSON<input type="file" accept=".json,application/json" aria-label="Impor data Footprints" onChange={e=>{const file=e.target.files?.[0];if(file)onImportJSON(file);e.target.value='';}}/></label>
  <p className="fp-footnote">PNG dan SVG menggambar seluruh pola gerak sesi, termasuk jejak yang sudah memudar di layar. Pemetaan kontak lantai masih berupa interpretasi jarak langkah.</p>
 </section>;
}
