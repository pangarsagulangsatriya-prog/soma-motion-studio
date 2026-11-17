import {useEffect,useRef,useState} from 'react';
import {Activity,BookOpen,ChevronDown,Clapperboard,Film,FlaskConical,Footprints,
 HelpCircle,Layers3,Monitor,PanelLeftClose,PanelLeftOpen,Play,Save,
 ScanFace,Settings2,ShieldCheck,SlidersHorizontal,Sparkles,Type} from 'lucide-react';
import type {SceneId} from './ScenePicker.tsx';
import {LEGACY_INSTRUMENTS} from './footprintsUX.ts';
import type {StageNavigationTool} from './stageNavigation.ts';
import './workspace-navigation.css';

export type Workspace='studio'|'archive'|'projection';
const instrumentIcons={liquid:Type,echo:Layers3,cut:Sparkles,body:ScanFace} as const;
const SAVED_WIDTH='soma-navigation-expanded-v1';
export function GlobalNav({workspace,scene,perform,onFootprints,onInstrument,onArchive,
 onProjection,onPreset,onPerform,onHelp,onStageTool,selectedTool,preset}:{
 workspace:Workspace;scene:SceneId;perform:boolean;onFootprints:()=>void;
 onInstrument:(scene:Exclude<SceneId,'footprints'>)=>void;
 onArchive:()=>void;onProjection:()=>void;onPreset:()=>void;onPerform:()=>void;
 onHelp:()=>void;onStageTool:(tool:StageNavigationTool)=>void;
 selectedTool:StageNavigationTool;preset:string;
}){
 const [expanded,setExpanded]=useState(()=>{
  try{return localStorage.getItem(SAVED_WIDTH)==='true';}catch{return false;}
 });
 const [mobile,setMobile]=useState(false);
 const [instrumentsOpen,setInstrumentsOpen]=useState(false);
 const [visit,setVisit]=useState(0);
 const toggleRef=useRef<HTMLButtonElement>(null);
 const railRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  const media=window.matchMedia('(max-width: 760px)');
  const sync=()=>setMobile(media.matches);
  sync();media.addEventListener('change',sync);
  return()=>media.removeEventListener('change',sync);
 },[]);
 useEffect(()=>{if(!mobile)try{localStorage.setItem(SAVED_WIDTH,String(expanded));}catch{}},[mobile,expanded]);
 useEffect(()=>{
  if(!mobile||!expanded)return;
  const previous=document.activeElement;
  const raf=window.requestAnimationFrame(()=>railRef.current?.querySelector<HTMLElement>('button')?.focus({preventScroll:true}));
  const handle=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();setExpanded(false);toggleRef.current?.focus();return;}
   if(e.key!=='Tab'||!railRef.current)return;
   const controls=Array.from(railRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    .filter(node=>node.getClientRects().length>0);
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',handle);
  return()=>{window.cancelAnimationFrame(raf);document.removeEventListener('keydown',handle);
   if(previous instanceof HTMLElement&&document.contains(previous))previous.focus({preventScroll:true});
  };
 },[mobile,expanded]);
 const choose=()=>{setVisit(x=>x+1);if(mobile)setExpanded(false);};
 const stage=(tool:StageNavigationTool)=>{choose();onStageTool(tool);};
 const item=(icon:typeof Footprints,title:string,active:boolean,action:()=>void,detail?:string)=>{
  const Icon=icon;
  return <button type="button" key={title} className="soma-rail-item"
   title={!expanded?title+(detail?' · '+detail:''):detail}
   aria-label={title} aria-current={active?'page':undefined}
   onClick={()=>{action();choose();}}>
   <Icon size={19} aria-hidden="true"/><span className="soma-rail-item-copy"><b>{title}</b>
   {detail&&<small>{detail}</small>}</span></button>;
 };
 const stageItem=(icon:typeof Footprints,title:string,tool:StageNavigationTool,detail?:string)=>
  item(icon,title,workspace==='studio'&&scene==='footprints'&&selectedTool===tool,
   ()=>onStageTool(tool),detail);
 void visit;
 return <>
  <header className="v3-global-nav v3-primary-nav soma-nav-header">
   <div className="soma-nav-brand-row">
    <button ref={toggleRef} type="button" className="soma-nav-toggle" aria-controls="soma-workspace-rail"
     aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)}
     title={expanded?'Ciutkan navigasi':'Perluas navigasi'}
     aria-label={expanded?'Ciutkan navigasi SOMA':'Buka navigasi SOMA'}>
     {expanded?<PanelLeftClose size={19}/>:<PanelLeftOpen size={19}/>}
    </button>
    <div className="v3-brand"><b>SOMA</b><span> / STUDIO</span></div>
   </div>
   <div className="v3-global-actions">
    <button className="v3-preset" type="button" title="Pilih atau simpan preset" onClick={onPreset}>
     <Save size={15}/><span>{preset}</span></button>
    <button className="v3-perform" type="button" aria-pressed={perform} onClick={onPerform}>
     <Play size={15}/>{perform?'Kembali Edit':'Perform'}</button>
    <button className="v3-help" type="button" onClick={onHelp} aria-label="Bantuan SOMA">
     <HelpCircle size={19}/></button>
   </div>
  </header>
  {mobile&&expanded&&<button type="button" className="soma-rail-scrim"
   aria-label="Tutup navigasi" onClick={()=>setExpanded(false)}/>}
  <nav id="soma-workspace-rail" ref={railRef}
   className="soma-app-sidebar" data-expanded={expanded} data-mobile={mobile}
   aria-label="Navigasi utama SOMA">
   <div className="soma-rail-overview">
    <span className="soma-rail-icon">S</span>
    <div className="soma-rail-copy"><strong>WORKSPACE</strong><small>Motion / Image / Sound</small></div>
   </div>
   <div className="soma-rail-scroll">
    <div className="soma-rail-group" aria-label="Stage">
     <span className="soma-rail-group-label">STAGE</span>
     {stageItem(Footprints,'Live Stage','live','Tracking kamera & kaki')}
     {item(BookOpen,'Archive',workspace==='archive',onArchive,'Arsip dan materi')}
     {item(Monitor,'Projection',workspace==='projection',onProjection,'Output panggung')}
     {stageItem(SlidersHorizontal,'Guided Setup','setup','Kamera → Tracking → Stage')}
     {stageItem(Clapperboard,'Archival Mapping','archival-mapping','Media BODY/FLOOR')}
     {stageItem(Layers3,'Surface Composer','composer','Mask, media, efek')}
    </div>
    <div className="soma-rail-group" aria-label="Experiments">
     <span className="soma-rail-group-label">EXPERIMENTS</span>
     {stageItem(Film,'Video Motion Lab','video','MP4 → Pose/Gait')}
     {stageItem(Activity,'Rehearsal Lab','rehearsal','Video vs gerak live')}
     {stageItem(FlaskConical,'Simulasi 3D','simulator','Latihan tanpa kamera')}
    </div>
    <div className="soma-rail-group" aria-label="Systems and instruments">
     <span className="soma-rail-group-label">SYSTEMS</span>
     {stageItem(ShieldCheck,'Calibration & QA','calibration','Kamera, lantai, output')}
     <button type="button" className="soma-rail-item" aria-expanded={instrumentsOpen}
      aria-label="Instrumen tambahan" title="Instruments"
      onClick={()=>{setInstrumentsOpen(v=>!v);setExpanded(true);}}>
      <Settings2 size={19}/><span className="soma-rail-item-copy"><b>Instruments</b>
       <small>Visual & sound</small></span><ChevronDown className="soma-rail-chevron" size={14}/>
     </button>
     {expanded&&instrumentsOpen&&<div className="soma-rail-subnav" aria-label="Instrumen visual">
      {LEGACY_INSTRUMENTS.map(({id,name})=>{
       const Icon=instrumentIcons[id];
       return <button type="button" key={id} aria-current={workspace==='studio'&&scene===id?'page':undefined}
        onClick={()=>{onInstrument(id);choose();}}><Icon size={16}/>{name}</button>;
      })}
     </div>}
    </div>
   </div>
   <div className="soma-rail-bottom"><span className="soma-rail-bottom-icon">◎</span>
    <span className="soma-rail-bottom-copy">Local stage workspace</span></div>
  </nav>
 </>;
}
