import {BookOpen,ChevronDown,Footprints,Monitor,Play,Save,SlidersHorizontal,HelpCircle,Type,Layers3,Sparkles,ScanFace} from 'lucide-react';
import type {SceneId} from './ScenePicker.tsx';
import {LEGACY_INSTRUMENTS} from './footprintsUX.ts';

export type Workspace='studio'|'archive'|'projection';
const instrumentIcons={liquid:Type,echo:Layers3,cut:Sparkles,body:ScanFace} as const;
export function GlobalNav({workspace,scene,perform,onFootprints,onInstrument,onArchive,onProjection,onPreset,onPerform,onHelp,preset}:{
 workspace:Workspace;scene:SceneId;perform:boolean;onFootprints:()=>void;
 onInstrument:(scene:Exclude<SceneId,'footprints'>)=>void;
 onArchive:()=>void;onProjection:()=>void;onPreset:()=>void;onPerform:()=>void;onHelp:()=>void;preset:string;
}){
 return <header className="v3-global-nav v3-primary-nav">
  <div className="v3-brand"><b>SOMA</b><span>FOOTPRINTS / MOTION STUDIO</span></div>
  <nav className="v3-workspaces" aria-label="Ruang kerja utama">
   <button type="button" aria-current={workspace==='studio'&&scene==='footprints'?'page':undefined}
    onClick={onFootprints}><Footprints size={17}/>Footprints</button>
   <button type="button" aria-current={workspace==='archive'?'page':undefined}
    onClick={onArchive}><BookOpen size={16}/>Archive</button>
   <button type="button" aria-current={workspace==='projection'?'page':undefined}
    onClick={onProjection}><Monitor size={16}/>Projection</button>
   <details className="v3-instrument-switch">
    <summary aria-label="Buka instrumen visual lain" aria-current={workspace==='studio'&&scene!=='footprints'?'page':undefined}>
     <SlidersHorizontal size={16}/>Instruments<ChevronDown size={14}/>
    </summary>
    <div className="v3-instrument-options" role="group" aria-label="Instrumen visual">
     <span>INSTRUMEN TAMBAHAN</span>
     {LEGACY_INSTRUMENTS.map(({id,name,description})=>{const Icon=instrumentIcons[id];return
      <button key={id} type="button" aria-current={workspace==='studio'&&scene===id?'true':undefined}
       onClick={e=>{onInstrument(id);e.currentTarget.closest('details')?.removeAttribute('open');}}>
       <Icon size={16}/><span><strong>{name}</strong><small>{description}</small></span>
      </button>;})}
    </div>
   </details>
  </nav>
  <div className="v3-global-actions">
   <button className="v3-preset" type="button" title="Pilih atau simpan preset"
    onClick={onPreset}><Save size={15}/><span>{preset}</span></button>
   <button className="v3-perform" type="button" aria-pressed={perform} onClick={onPerform}>
    <Play size={15}/>{perform?'Kembali Edit':'Perform'}</button>
   <button className="v3-help" type="button" onClick={onHelp} aria-label="Bantuan SOMA"><HelpCircle size={19}/></button>
  </div>
 </header>;
}
