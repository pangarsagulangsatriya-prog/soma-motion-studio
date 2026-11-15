import {BookOpen,Monitor,Play,Save,Settings2} from 'lucide-react';

export type Workspace='studio'|'archive'|'projection';
export function GlobalNav({workspace,perform,onStudio,onArchive,onProjection,onPreset,onPerform,onHelp,preset}:{
 workspace:Workspace;perform:boolean;onStudio:()=>void;onArchive:()=>void;onProjection:()=>void;
 onPreset:()=>void;onPerform:()=>void;onHelp:()=>void;preset:string;
}){
 return <header className="v3-global-nav">
  <div className="v3-brand"><b>SOMA</b><span>MOTION / SOUND / IMAGE</span></div>
  <nav className="v3-workspaces" aria-label="Ruang kerja">
   <button type="button" aria-current={workspace==='studio'?'page':undefined} onClick={onStudio}><Settings2 size={16}/>Studio</button>
   <button type="button" aria-current={workspace==='archive'?'page':undefined} onClick={onArchive}><BookOpen size={16}/>Archive</button>
   <button type="button" aria-current={workspace==='projection'?'page':undefined} onClick={onProjection}><Monitor size={16}/>Projection</button>
  </nav>
  <div className="v3-global-actions">
   <button className="v3-preset" type="button" title="Pilih atau simpan preset" onClick={onPreset}><Save size={15}/><span>{preset}</span></button>
   <button className="v3-perform" type="button" aria-pressed={perform} onClick={onPerform}><Play size={15}/>{perform?'Kembali Edit':'Perform'}</button>
   <button className="v3-help" type="button" onClick={onHelp} aria-label="Bantuan SOMA">?</button>
  </div>
 </header>;
}
