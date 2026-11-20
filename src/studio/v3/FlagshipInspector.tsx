import {flagshipHydraPatch,type FlagshipId} from './flagshipVisualModel.ts';
import {FLAGSHIP_CONTROLS,flagshipControlPatch} from './flagshipInspectorModel.ts';
import {HydraEffectInspector} from './HydraEffectInspector.tsx';
import type {HydraFootprintSettings} from '../../footprints/scenes/hydraFootprintModel.ts';

export function FlagshipInspector({id,value,status,onChange}:{
 id:FlagshipId;value:HydraFootprintSettings;
 status?:string;onChange?:(patch:Partial<HydraFootprintSettings>)=>void;
}){
 const statusLabel=!value.enabled?'Paused':status==='ready'?'GPU ready':
  status==='fallback'?'Fallback · periksa WebGL':status==='loading'?'Loading':'Preview pending';
 return <div className="fv04-inspector" aria-label={'Inspector '+id.toUpperCase()}>
  <div className="fv04-inspector-head">
   <div><strong>{id.toUpperCase()}</strong><small>{
    id==='trace'?'Material Memory':id==='echo'?'Temporal Body':'Archive Displacement'
   }</small></div>
   <span role="status">{statusLabel}</span>
  </div>
  {FLAGSHIP_CONTROLS[id].map(control=><label key={control.key} className="msv4-parameter">
   <span>{control.label}<output>{Math.round(value[control.key]*100)}%</output></span>
   <input type="range" min="0" max={control.max} step=".01"
    value={value[control.key]} disabled={!value.enabled||!onChange}
    aria-label={control.label} onChange={event=>onChange?.(flagshipControlPatch(
     control.key,Number(event.currentTarget.value)))}/>
   <small>{control.description}</small>
  </label>)}
  <div className="fv04-inspector-utilities">
   <button type="button" disabled={!onChange} onClick={()=>onChange?.(flagshipHydraPatch(id))}>Reset visual</button>
   <label><input type="checkbox" checked={value.enabled}
    disabled={!onChange} onChange={e=>onChange?.({enabled:e.currentTarget.checked})}/> Enabled</label>
  </div>
  <details className="fv04-advanced">
   <summary>Advanced Hydra controls</summary>
   <HydraEffectInspector value={value} status={status} onChange={onChange}/>
  </details>
 </div>;
}
