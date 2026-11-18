import {useState} from 'react';
import {FLOOR_SCENE_PRESETS,type FloorScenePreset} from '../../footprints/scenes/sceneRegistry.ts';
import type {FloorAudioSource} from '../../footprints/scenes/FloorAudioReactive.ts';
export type FloorAdvancedParams={
 intensity:number;radius:number;persistence:number;quality:'low'|'medium'|'high';audioMix:number;
};
type Props={
 params:FloorAdvancedParams;
 onParams:(next:Partial<FloorAdvancedParams>)=>void;
 presets:readonly FloorScenePreset[];
 onApplyPreset:(preset:FloorScenePreset)=>void;
 onSavePreset:(name:string)=>void;
 onDeletePreset:(name:string)=>void;
 audioSource:FloorAudioSource;
 audioLevel:number;audioError:string;onAudioSource:(next:FloorAudioSource)=>void;
};
export function FloorSceneAdvancedControls({
 params,onParams,presets,onApplyPreset,onSavePreset,onDeletePreset,
 audioSource,audioLevel,audioError,onAudioSource
}:Props){
 const [name,setName]=useState('Scene Panggung');
 const [selection,setSelection]=useState('');
 const chosen=selection.startsWith('saved:')?
  presets[Number(selection.slice(6))]:null;
 return <details className="fp-scene-advanced">
  <summary>Preset & Audio</summary>
  <div className="fp-scene-advanced-panel">
   <strong>SCENE LIBRARY · PRESET</strong>
   <label>Pilih preset
    <select aria-label="Preset scene FLOOR" value={selection} onChange={e=>{
     const choice=e.target.value;setSelection(choice);
     const item=choice.startsWith('built-in:')?
      FLOOR_SCENE_PRESETS[Number(choice.slice(9))]:
      choice.startsWith('saved:')?presets[Number(choice.slice(6))]:null;
     if(item){onApplyPreset(item);setName(item.name);}
    }}>
     <option value="">Pilih preset</option>
     {FLOOR_SCENE_PRESETS.map((p,i)=><option key={p.name} value={'built-in:'+i}>
      {p.name}
     </option>)}
     {presets.map((p,i)=><option key={p.name} value={'saved:'+i}>
      {p.name} · lokal
     </option>)}
    </select>
   </label>
   <label>Nama preset
    <input aria-label="Nama preset FLOOR" value={name} maxLength={64}
     onChange={e=>setName(e.target.value)}/>
   </label>
   <div className="fp-scene-preset-actions">
    <button type="button" onClick={()=>{onSavePreset(name);setSelection('');}}>Simpan preset</button>
    <button type="button" disabled={!chosen}
     onClick={()=>{
      if(!chosen)return;
      onDeletePreset(chosen.name);setSelection('');
     }}>Hapus preset</button>
   </div>
   <label>Intensitas {Math.round(params.intensity*100)}%
    <input type="range" min="0" max="1" step=".05" aria-label="Intensitas scene FLOOR"
     value={params.intensity} onChange={e=>onParams({intensity:Number(e.target.value)})}/>
   </label>
   <label>Radius {Math.round(params.radius*100)}%
    <input type="range" min="0" max="1" step=".05" aria-label="Radius scene FLOOR"
     value={params.radius} onChange={e=>onParams({radius:Number(e.target.value)})}/>
   </label>
   <label>Persistensi {Math.round(params.persistence*100)}%
    <input type="range" min="0" max="1" step=".05" aria-label="Persistensi scene FLOOR"
     value={params.persistence} onChange={e=>onParams({persistence:Number(e.target.value)})}/>
   </label>
   <label>Kualitas
    <select aria-label="Kualitas scene FLOOR" value={params.quality}
     onChange={e=>onParams({quality:e.target.value as FloorAdvancedParams['quality']})}>
     <option value="low">Low · 75 partikel</option>
     <option value="medium">Medium · 150 partikel</option>
     <option value="high">High · 260 partikel</option>
    </select>
   </label>
   <strong>AUDIO REACTIVE · OPT-IN</strong>
   <label>Sumber audio
    <select aria-label="Sumber audio scene FLOOR" value={audioSource}
     onChange={e=>onAudioSource(e.target.value as FloorAudioSource)}>
     <option value="off">Off</option>
     <option value="soma">Audio SOMA yang sudah aktif</option>
     <option value="microphone">Mikrofon lokal · minta izin</option>
    </select>
   </label>
   <label>Audio Mix {Math.round(params.audioMix*100)}%
    <input type="range" min="0" max="1" step=".05" aria-label="Mix audio reactive FLOOR"
     value={params.audioMix} onChange={e=>onParams({audioMix:Number(e.target.value)})}/>
   </label>
   <div className="fp-scene-audio-level" role="status">
    Audio {Math.round(audioLevel*100)}% · {audioSource==='off'?'Off':
     audioSource==='soma'?'Audio SOMA':'Mikrofon lokal'}
   </div>
   {audioError&&<p role="alert">{audioError}</p>}
   <small>Envelope audio memengaruhi visual, tidak menghasilkan pijakan. Mikrofon hanya diproses secara lokal dan dihentikan saat Off.</small>
  </div>
 </details>;
}
