import type {HydraFootprintSettings,HydraFootprintStatus} from '../../footprints/scenes/hydraFootprintModel.ts';
import {HYDRA_FOOTPRINT_STYLES} from '../../footprints/scenes/hydraFootprintModel.ts';

/** VC-03: controls the existing persistent Hydra runtime. No second canvas or global Hydra instance. */
export function HydraEffectInspector({value,status,onChange}:{
 value:HydraFootprintSettings|null|undefined;
 status:string|HydraFootprintStatus|undefined;
 onChange?:(patch:Partial<HydraFootprintSettings>)=>void;
}){
 const v=value;
 if(!v)return <p role="status">Hydra belum terhubung ke scene FLOOR.</p>;
 const slider=(key:'mix'|'distortion'|'feedback'|'motion',label:string,max:number)=>
  <label key={key} className="msv4-parameter"><span>{label}<output>{Math.round(v[key]*100)}%</output></span>
   <input type="range" min={0} max={max} step={.01} value={v[key]}
    disabled={!v.enabled||!onChange} onChange={e=>onChange?.({[key]:Number(e.currentTarget.value)})}/>
  </label>;
 return <div className="msv4-hydra-controls" aria-label="Hydra generative effect editor">
  <label className="msv4-inline-check"><input type="checkbox" checked={v.enabled}
   onChange={e=>onChange?.({enabled:e.currentTarget.checked})} disabled={!onChange}/>
   Enable generative processing</label>
  <p role="status" className="msv4-editor-hint">Engine: {v.enabled?status??'loading':'off'} · Preview texture only until calibrated output QA.</p>
  <label className="msv4-select">Effect style
   <select value={v.style} disabled={!v.enabled||!onChange}
    onChange={e=>onChange?.({style:e.currentTarget.value as HydraFootprintSettings['style']})}>
    {HYDRA_FOOTPRINT_STYLES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
   </select>
  </label>
  {slider('mix','Effect mix',1)}
  {slider('distortion','Distortion',.4)}
  {slider('feedback','Feedback / trail',.65)}
  {slider('motion','Motion response',1)}
  <label className="msv4-select">Render quality
   <select value={v.quality} disabled={!onChange||!v.enabled}
    onChange={e=>onChange?.({quality:e.currentTarget.value as HydraFootprintSettings['quality']})}>
    <option value="low">Low · rehearsal</option><option value="medium">Medium</option><option value="high">High</option>
   </select>
  </label>
  <p className="msv4-editor-hint">Feedback bekerja pada tekstur visual. Durasi tiap jejak tetap dikendalikan oleh Footprint Engine.</p>
 </div>;
}
