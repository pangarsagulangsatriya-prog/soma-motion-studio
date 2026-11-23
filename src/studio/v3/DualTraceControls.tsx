import type {PainterlySettings} from '../../footprints/lines/v3/PainterlyCanvasRenderer.ts';
import type {V3Settings} from '../../footprints/lines/v3/TrajectoryRenderer.ts';

type Props={
 painterly:PainterlySettings;onPainterlyChange:(p:PainterlySettings)=>void;
 settings:V3Settings;onSettingsChange:(s:V3Settings)=>void;
 onClear:()=>void;onDemo:()=>void;demo:boolean;
 onExportFoot:()=>void;status:string;onExit:()=>void;
};
export function DualTraceControls(p:Props){
 const patch=(values:Partial<PainterlySettings>)=>
  p.onPainterlyChange({...p.painterly,...values});
 const slider=(name:string,value:number,min:number,max:number,step:number,
  property:keyof PainterlySettings,unit:string)=>(
  <label className="dual-trace-slider">{name}
   <output>{value.toFixed(step<1?2:0)}{unit}</output>
   <input type="range" min={min} max={max} step={step} value={value}
    aria-label={name} onChange={e=>patch({[property]:Number(e.target.value)})}/>
  </label>);
 return <section className="lt-beta-controls lt-v3-controls lt-painterly-controls dual-trace-controls"
   aria-label="Kontrol Dual Trace">
  <header><strong>Dual Trace</strong><span>V1 BETA · SPLIT</span></header>
  <p className="lt-beta-status" role="status">{p.status}</p>
  <div className="dual-trace-two-settings">
   <div><strong>FOOT PATH</strong>
    {slider('Bobot Foot Path',p.painterly.pathWeightPx??22,8,42,2,'pathWeightPx',' px')}
    {slider('Durasi footprint',p.painterly.footprintLifeMs/1000,1,30,1,
      'footprintLifeMs',' s')}
    <small>Tinta tetap · tapak kaki memudar 6 detik secara default</small>
   </div>
   <div><strong>HEAD &amp; SHOULDER</strong>
    <label><input aria-label="Aktifkan Kepala" type="checkbox"
     checked={p.painterly.dualHeadEnabled??true}
     onChange={e=>patch({dualHeadEnabled:e.target.checked})}/> Kepala</label>
    <label><input aria-label="Aktifkan Bahu" type="checkbox"
     checked={p.painterly.dualShoulderEnabled??true}
     onChange={e=>patch({dualShoulderEnabled:e.target.checked})}/> Bahu</label>
    {slider('Amplifikasi kepala',p.painterly.dualGain??1.35,1,2.5,.05,
     'dualGain','×')}
    {slider('Bobot garis kepala',p.painterly.dualHeadWidth??8,8,40,2,
     'dualHeadWidth',' px')}
    {slider('Bobot garis bahu',p.painterly.dualShoulderWidth??16,8,48,2,
     'dualShoulderWidth',' px')}
    <details><summary>Detail gesture</summary>
     {slider('Smoothing gesture',p.painterly.dualSmoothing??.42,.10,.85,.05,
      'dualSmoothing','')}
     {slider('Opacity kepala',p.painterly.dualHeadOpacity??.75,.2,1,.05,
      'dualHeadOpacity','')}
     {slider('Opacity bahu',p.painterly.dualShoulderOpacity??.9,.2,1,.05,
      'dualShoulderOpacity','')}
    </details>
   </div>
  </div>
  <div className="dual-trace-actors">
   {(['A','B'] as const).map(actor=>
    <label key={actor}>Aktor {actor}
     <input type="color" aria-label={'Warna Aktor '+actor}
      value={p.settings.actorColors[actor]}
      onChange={e=>p.onSettingsChange({...p.settings,
       actorColors:{...p.settings.actorColors,[actor]:e.target.value}})}/>
    </label>)}
  </div>
  <div className="dual-trace-actions">
   <button type="button" onClick={p.onClear}>Clear Both</button>
   <button type="button" onClick={p.onExportFoot}>Simpan Foot PNG</button>
   <button type="button" onClick={p.onDemo}>{p.demo?'Hentikan Demo':'Coba Demo'}</button>
   <button type="button" onClick={p.onExit}>Path Sumi V3.5.1</button>
  </div>
  <small>Satu sumber pose untuk dua kanvas. Demo kaki tidak menciptakan gestur kepala atau bahu.</small>
 </section>;
}
