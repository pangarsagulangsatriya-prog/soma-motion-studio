import {useEffect,useRef,useState} from 'react';
import type {RefObject} from 'react';
import {ARTISTIC_CATALOG,type CatalogSceneId} from '../../footprints/scenes/artisticCatalog.ts';
import {HYDRA_FOOTPRINT_STYLES,type HydraFootprintStyle} from '../../footprints/scenes/hydraFootprintModel.ts';
import type {HydraFootprintSettings} from '../../footprints/scenes/hydraFootprintModel.ts';
import {FlagshipLivePreview} from './FlagshipLivePreview.tsx';
import {paintSceneSample,syntheticSceneEvents,type SceneAction} from './composeSceneEngine.ts';
import {FLAGSHIP_RECIPES,type FlagshipId,type FlagshipRecipe} from './flagshipVisualModel.ts';

function SceneCard({id,title,subtitle,selected,onAction}:{
 id:CatalogSceneId;title:string;subtitle:string;selected:boolean;
 onAction:(id:CatalogSceneId,action:SceneAction)=>void;
}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{if(ref.current)paintSceneSample(ref.current,id);},[id]);
 return <article className="cp08-scene-card" data-selected={selected} aria-label={'Scene '+title}>
  <canvas ref={ref} width={176} height={100} className="cp08-scene-frame"
   aria-label={'Sampel render '+title}/>
  <div className="cp08-scene-body"><strong>{title}</strong><small>{subtitle}</small>
   <div className="cp08-scene-actions">
    <button type="button" onClick={()=>onAction(id,'apply')}>Apply</button>
    <button type="button" onClick={()=>onAction(id,'replace')}>Replace</button>
    <button type="button" onClick={()=>onAction(id,'add')}>+ Layer</button>
   </div>
  </div>
 </article>;
}
export function SceneEffectBrowser({activeScene,onSceneAction,onEffectAction,onFlagshipApply,activeFlagship,hydraEnabled,hydraSettings,stageCanvas,stageStatus}:{
 activeScene:CatalogSceneId;
 onSceneAction:(id:CatalogSceneId,action:SceneAction)=>void;
 onEffectAction:(id:HydraFootprintStyle,action:'apply'|'add')=>void;
 onFlagshipApply:(id:FlagshipId)=>void;
 activeFlagship:FlagshipId|null;
 hydraEnabled:boolean;
 hydraSettings?:HydraFootprintSettings;
 stageCanvas?:RefObject<HTMLCanvasElement|null>;
 stageStatus?:string;
}){
 const [query,setQuery]=useState('');
 const [legacyMode,setLegacyMode]=useState<'scenes'|'effects'>('scenes');
 const term=query.trim().toLowerCase();
 const flagships=FLAGSHIP_RECIPES.filter(p=>(p.title+' '+p.subtitle+' '+p.description).toLowerCase().includes(term));
 const scenes=ARTISTIC_CATALOG.filter(s=>(s.title+' '+s.subtitle+' '+s.motif).toLowerCase().includes(term));
 const effects=HYDRA_FOOTPRINT_STYLES.filter(e=>(e.label+' '+e.description).toLowerCase().includes(term));
 return <section className="cp08-browser fv01-browser" aria-label="Flagship Visual Browser">
  <div className="fv01-browser-head">
   <strong>VISUALS</strong><small>3 flagship recipes</small>
  </div>
  <label className="cp08-search">Search <input type="search" value={query}
   placeholder="Cari TRACE, ECHO, RIFT…" onChange={e=>setQuery(e.currentTarget.value)}/></label>
  <div className="cp08-scene-list fv01-flagship-list">
   {flagships.map(p=><article className="cp08-scene-card fv01-flagship-card" key={p.id}
      data-selected={activeFlagship===p.id} aria-label={'Flagship '+p.title}>
     <FlagshipLivePreview recipe={p} active={activeFlagship===p.id}
       settings={hydraSettings} stageCanvas={stageCanvas} stageStatus={stageStatus}/>
     <div className="cp08-scene-body">
      <div className="fv01-name"><strong>{p.title}</strong><small>{p.subtitle}</small></div>
      <small>{p.description}</small>
      <button type="button" className="fv01-apply" aria-pressed={activeFlagship===p.id}
       onClick={()=>onFlagshipApply(p.id)}>
       {activeFlagship===p.id?'Active':'Use '+p.title}
      </button>
     </div>
    </article>)}
   {!flagships.length&&<p className="cp08-empty">Visual flagship tidak ditemukan.</p>}
  </div>
  <small className="cp08-preview-note">Thumbnail bergerak memakai material GPU SOMA dengan langkah simulasi. Visual aktif menampilkan output Hydra Stage ketika siap; RIFT sampel menggunakan arsip sintetis.</small>
  <details className="fv01-legacy" aria-label="Legacy visual scenes and effects">
   <summary>Legacy · 14 scenes &amp; 4 effects</summary>
   <div className="cp08-browser-tabs" role="group" aria-label="Jenis aset Legacy">
    <button type="button" aria-pressed={legacyMode==='scenes'} onClick={()=>setLegacyMode('scenes')}>Scenes</button>
    <button type="button" aria-pressed={legacyMode==='effects'} onClick={()=>setLegacyMode('effects')}>Effects</button>
   </div>
   {legacyMode==='scenes'?<div className="cp08-scene-list">
    {scenes.map(s=><SceneCard key={s.id} id={s.id} title={s.title} subtitle={s.subtitle}
     selected={activeScene===s.id} onAction={onSceneAction}/>)}
   </div>:<div className="cp08-effect-list">
    {effects.map(effect=><article key={effect.id} className="cp08-effect-card">
     <strong>{effect.label}</strong><small>{effect.description}</small>
     <div className="cp08-scene-actions">
      <button type="button" onClick={()=>onEffectAction(effect.id,'apply')}>Apply</button>
      <button type="button" onClick={()=>onEffectAction(effect.id,'add')}>+ Layer</button>
     </div>
    </article>)}
   </div>}
   <small className="cp08-preview-note">Preset lama tetap dapat dibuka. Hydra: {hydraEnabled?'aktif':'nonaktif'}.</small>
  </details>
 </section>;
}
