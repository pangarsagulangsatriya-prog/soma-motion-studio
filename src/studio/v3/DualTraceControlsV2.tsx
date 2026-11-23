import type {PainterlySettings} from '../../footprints/lines/v3/PainterlyCanvasRenderer.ts';
import {DEFAULT_DUAL_TRACE_PALETTE,type DualTraceChannel} from '../../footprints/dual-trace/DualTraceV2Renderer.ts';

type Props={
 settings:PainterlySettings;
 onChange:(next:PainterlySettings)=>void;
 onClearAll:()=>void;onExportPNG:()=>void;
 demo:boolean;onDemo:()=>void;onExit:()=>void;onLegacy:()=>void;
 status:string;diagnostics?:string;
};
const channels:{id:DualTraceChannel;label:string}[]=[
 {id:'path',label:'Garis'},
 {id:'footprint',label:'Tapak'},
 {id:'upper',label:'Gesture'}
];
export function DualTraceControlsV2(p:Props){
 const patch=(v:Partial<PainterlySettings>)=>p.onChange({...p.settings,...v});
 const colors=p.settings.dualV2Palette??DEFAULT_DUAL_TRACE_PALETTE;
 const setColor=(actor:'A'|'B',channel:DualTraceChannel,value:string)=>{
  patch({dualV2Palette:{...colors,[actor]:{...colors[actor],[channel]:value}}});
 };
 const slider=(label:string,value:number,min:number,max:number,step:number,
  onChange:(v:number)=>void)=>(
  <label className="dual-v2-slider">{label}<output>{value.toFixed(0)}</output>
   <input type="range" aria-label={label} min={min} max={max} step={step}
    value={value} onChange={e=>onChange(Number(e.target.value))}/>
  </label>
 );
 return <section className="lt-beta-controls lt-v3-controls dual-v2-controls"
  aria-label="Kontrol Dual Trace V2">
  <header><strong>Dual Trace</strong><span>V2 · SATU KANVAS</span></header>
  <div className="dual-v21-status" role="group" aria-label="Status sumber dan lukisan">
   <p className="lt-beta-status" role="status">Sumber sekarang · {p.status}</p>
   <p className="dual-v21-ink-status">Lukisan · {p.diagnostics?.match(/Jalur nyata: ([^|]+)/)?.[1]?.trim()??p.diagnostics?.match(/Path tinta: ([^|]+)/)?.[1]?.trim()??'Jalur disimpan sampai dibersihkan'}</p>
  </div>
  <div className="dual-v2-group" aria-label="Mode tampilan">
   <strong>Tampilan</strong>
   <div className="dual-v2-toggle">
    <button type="button" aria-pressed={(p.settings.dualV2Display??'composite')==='composite'}
     onClick={()=>patch({dualV2Display:'composite'})}>Gabung</button>
    <button type="button" aria-pressed={p.settings.dualV2Display==='split-debug'}
     onClick={()=>patch({dualV2Display:'split-debug'})}>Pisah · Debug</button>
   </div>
  </div>
  <div className="dual-v2-group" aria-label="Urutan lapisan">
   <strong>Lapisan depan</strong>
   <div className="dual-v2-toggle">
    <button type="button" aria-pressed={(p.settings.dualV2Order??'foot-on-top')==='foot-on-top'}
     onClick={()=>patch({dualV2Order:'foot-on-top'})}>Tapak depan</button>
    <button type="button" aria-pressed={p.settings.dualV2Order==='upper-on-top'}
     onClick={()=>patch({dualV2Order:'upper-on-top'})}>Gesture depan</button>
   </div>
   <small>Garis, tapak dan gesture digabung pada keluaran yang sama.</small>
  </div>
  <details open className="dual-v2-group">
   <summary>Warna A/B · tiap lapisan</summary>
   <div className="dual-v2-palette">
    <span></span><strong>Aktor A</strong><strong>Aktor B</strong>
    {channels.map(({id,label})=><div className="dual-v2-palette-row" key={id}>
     <span>{label}</span>
     {(['A','B'] as const).map(actor=><input key={actor} type="color"
      aria-label={label+' Aktor '+actor}
      value={colors[actor][id]} onChange={e=>setColor(actor,id,e.target.value)}/>)}
    </div>)}
   </div>
  </details>
  <details className="dual-v2-group">
   <summary>Sapuan & gestur</summary>
   <label className="dual-v2-setting">Karakter tinta
    <select aria-label="Karakter tinta" value={p.settings.dualV2Material??'path-sumi'}
     onChange={e=>patch({dualV2Material:e.target.value as NonNullable<PainterlySettings['dualV2Material']>})}>
     <option value="path-sumi">Natural Sumi</option>
     <option value="dry-ink">Dry Brush</option>
     <option value="pigment-mass">Dense Ink</option>
    </select>
   </label>
   {slider('Bobot garis',p.settings.pathWeightPx??36,8,42,2,v=>patch({pathWeightPx:v}))}
   <label className="dual-v2-setting"><input type="checkbox" checked={p.settings.dualV2Expressive??true}
    onChange={e=>patch({dualV2Expressive:e.target.checked})}/> Respons gerak ekspresif</label>
   <label className="dual-v2-setting"><input type="checkbox" checked={p.settings.dualV2UpperModulation!==false}
    onChange={e=>patch({dualV2UpperModulation:e.target.checked})}/>
    Kepala & bahu mengubah bobot garis kaki</label>
   <label className="dual-v2-setting"><input type="checkbox" checked={p.settings.dualHeadEnabled??true}
    onChange={e=>patch({dualHeadEnabled:e.target.checked})}/> Kepala</label>
   <label className="dual-v2-setting"><input type="checkbox" checked={p.settings.dualShoulderEnabled??true}
    onChange={e=>patch({dualShoulderEnabled:e.target.checked})}/> Bahu</label>
   {slider('Ketebalan kepala',p.settings.dualHeadWidth??8,8,40,2,v=>patch({dualHeadWidth:v}))}
   {slider('Ketebalan bahu',p.settings.dualShoulderWidth??16,8,48,2,v=>patch({dualShoulderWidth:v}))}
   {slider('Opasitas garis',Math.round((p.settings.dualV2PathOpacity??.95)*100),10,100,5,
    v=>patch({dualV2PathOpacity:v/100}))}
   {slider('Opasitas tapak',Math.round((p.settings.dualV2FootOpacity??.85)*100),10,100,5,
    v=>patch({dualV2FootOpacity:v/100}))}
   {slider('Opasitas gesture',Math.round((p.settings.dualV2UpperOpacity??.35)*100),10,100,5,
    v=>patch({dualV2UpperOpacity:v/100}))}
  </details>
  <div className="dual-v2-group">
   <strong>Tapak</strong>
   {slider('Durasi tapak (detik)',(p.settings.footprintLifeMs??6000)/1000,1,30,1,
    v=>patch({footprintLifeMs:v*1000,footprintKeep:false}))}
   <small>Cap memudar sesuai waktu video; tinta garis tetap sampai dibersihkan.</small>
  </div>
  <div className="dual-v2-actions">
   <button type="button" onClick={p.onClearAll}>Bersihkan semua</button>
   <button type="button" onClick={p.onExportPNG}>PNG gabungan</button>
   <button type="button" onClick={p.onDemo}>{p.demo?'Stop demo':'Coba demo'}</button>
   <button type="button" onClick={p.onExit}>Kembali ke Path Sumi</button>
  </div>
  <details className="dual-v21-diagnostics">
   <summary>Tracking jalur · V2.2</summary>
   <label className="dual-v2-setting">
    <input type="checkbox" checked={p.settings.trajectoryV22Enabled!==false}
     onChange={e=>patch({trajectoryV22Enabled:e.target.checked})}/>
    Gunakan fusi kaki + pinggul (V2.2)
   </label>
   <small>Matikan untuk kembali ke V2.1. Tidak membuat cap kaki dari estimasi pinggul.</small>
   <label className="dual-v2-setting">
    <input type="checkbox" checked={p.settings.trajectoryV23Enabled===true}
     disabled={p.settings.trajectoryV22Enabled===false}
     onChange={e=>patch({trajectoryV23Enabled:e.target.checked})}/>
    Path Continuity V2.3 (beta) · sambung gap tervalidasi
   </label>
   <small>V2.3 memeriksa identitas, waktu, jarak dan arah sebelum menyambung. Matikan untuk fallback V2.2.</small>
   <p>{p.diagnostics||'Menunggu pengukuran pose dan jalur.'}</p>
  </details>
  <details className="dual-v21-diagnostics">
   <summary>Diagnostik teknis</summary>
   <p>{p.diagnostics||'Menunggu pengukuran pose dan jalur.'}</p>
  </details>
  <details className="dual-v2-legacy"><summary>Mode lama</summary>
   <button type="button" onClick={p.onLegacy}>Dual Trace V1 · Pisah</button>
  </details>
 </section>;
}
