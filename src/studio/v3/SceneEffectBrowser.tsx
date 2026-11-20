import {useEffect,useRef,useState} from 'react';
import {ARTISTIC_CATALOG,type CatalogSceneId} from '../../footprints/scenes/artisticCatalog.ts';
import {HYDRA_FOOTPRINT_STYLES,type HydraFootprintStyle} from '../../footprints/scenes/hydraFootprintModel.ts';
import {paintSceneSample,type SceneAction} from './composeSceneEngine.ts';

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
    <button type="button" onClick={()=>onAction(id,'apply')} title={'Pakai '+title+' sebagai scene FLOOR aktif'}>Apply</button>
    <button type="button" onClick={()=>onAction(id,'replace')} title="Ganti layer yang dipilih">Replace</button>
    <button type="button" onClick={()=>onAction(id,'add')} title="Tambahkan sebagai layer baru">+ Layer</button>
   </div>
  </div>
 </article>;
}

export function SceneEffectBrowser({activeScene,onSceneAction,onEffectAction,hydraEnabled}:{
 activeScene:CatalogSceneId;
 onSceneAction:(id:CatalogSceneId,action:SceneAction)=>void;
 onEffectAction:(id:HydraFootprintStyle,action:'apply'|'add')=>void;
 hydraEnabled:boolean;
}){
 const [mode,setMode]=useState<'scenes'|'effects'>('scenes');
 const [query,setQuery]=useState('');
 const scenes=ARTISTIC_CATALOG.filter(scene=>(scene.title+' '+scene.subtitle+' '+scene.motif)
  .toLowerCase().includes(query.toLowerCase().trim()));
 const effects=HYDRA_FOOTPRINT_STYLES.filter(effect=>(effect.label+' '+effect.description)
  .toLowerCase().includes(query.toLowerCase().trim()));
 return <section className="cp08-browser" aria-label="Scene and Effect Browser">
  <div className="cp08-browser-tabs" role="group" aria-label="Jenis aset visual">
   <button type="button" aria-pressed={mode==='scenes'} onClick={()=>setMode('scenes')}>Scenes</button>
   <button type="button" aria-pressed={mode==='effects'} onClick={()=>setMode('effects')}>Effects</button>
  </div>
  <label className="cp08-search">Search <input type="search" value={query} placeholder="Search visual…"
   onChange={e=>setQuery(e.currentTarget.value)}/></label>
  {mode==='scenes'?<div className="cp08-scene-list">
   {scenes.map(scene=><SceneCard key={scene.id} id={scene.id} title={scene.title}
    subtitle={scene.subtitle} selected={activeScene===scene.id} onAction={onSceneAction}/>)}
   {!scenes.length&&<p className="cp08-empty">Tidak ditemukan scene.</p>}
   <small className="cp08-preview-note">Sampel memakai ArtisticFootprintRuntime dan kontak simulasi. Scene layer memakai event Track/MP4 saat tersedia.</small>
  </div>:<div className="cp08-effect-list">
   {effects.map(effect=><article key={effect.id} className="cp08-effect-card">
    <strong>{effect.label}</strong><small>{effect.description}</small>
    <div className="cp08-scene-actions">
     <button type="button" onClick={()=>onEffectAction(effect.id,'apply')}>Apply</button>
     <button type="button" onClick={()=>onEffectAction(effect.id,'add')}>+ Layer</button>
    </div>
   </article>)}
   {!effects.length&&<p className="cp08-empty">Tidak ditemukan efek.</p>}
   <small className="cp08-preview-note">Efek Hydra berbagi satu runtime. Parameter efek bersifat global untuk layer Hydra; status: {hydraEnabled?'aktif':'nonaktif'}.</small>
  </div>}
 </section>;
}
