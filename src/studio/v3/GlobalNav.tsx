import {useEffect,useRef,useState} from 'react';
import {Footprints,Monitor,PanelLeftClose,PanelLeftOpen,Play,Save,HelpCircle} from 'lucide-react';
import type {SceneId} from './ScenePicker.tsx';
import type {StageNavigationTool} from './stageNavigation.ts';
import './workspace-navigation.css';

export type Workspace='studio'|'archive'|'projection';
const NAV_KEY='soma-primary-navigation-v2';

/** Only two primary destinations. All capture, tracking, media and experiments
 * are actions within Footprints; physical projection remains separate. */
export function GlobalNav({workspace,perform,onFootprints,onProjection,onPreset,onPerform,onHelp,preset}:{
 workspace:Workspace;scene:SceneId;perform:boolean;onFootprints:()=>void;
 onInstrument:(scene:Exclude<SceneId,'footprints'>)=>void;
 onArchive:()=>void;onProjection:()=>void;onPreset:()=>void;onPerform:()=>void;
 onHelp:()=>void;onStageTool:(tool:StageNavigationTool)=>void;
 selectedTool:StageNavigationTool;preset:string;
}){
 const [expanded,setExpanded]=useState(()=>{
  try{const saved=localStorage.getItem(NAV_KEY);return saved===null?true:saved==='true';}
  catch{return true;}
 });
 const [mobile,setMobile]=useState(false);
 const toggleRef=useRef<HTMLButtonElement>(null);
 const railRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  const media=window.matchMedia('(max-width: 760px)');
  const update=()=>setMobile(media.matches);
  update();media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 useEffect(()=>{if(!mobile)try{localStorage.setItem(NAV_KEY,String(expanded));}catch{}},[mobile,expanded]);
 useEffect(()=>{
  if(!mobile||!expanded)return;
  const before=document.activeElement;
  const raf=requestAnimationFrame(()=>railRef.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));
  const keydown=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();setExpanded(false);toggleRef.current?.focus();return;}
   if(e.key!=='Tab'||!railRef.current)return;
   const buttons=Array.from(railRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
   const first=buttons[0],last=buttons[buttons.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',keydown);
  return()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',keydown);
   if(before instanceof HTMLElement&&document.contains(before))before.focus({preventScroll:true});};
 },[mobile,expanded]);
 const navigate=(target:'footprints'|'projector')=>{
  if(mobile)setExpanded(false);
  if(target==='footprints')onFootprints();
  else onProjection();
 };
 return <>
  <header className="v3-global-nav v3-primary-nav soma-nav-header soma-primary-header">
   <div className="soma-nav-brand-row">
    <button ref={toggleRef} type="button" className="soma-nav-toggle"
     aria-controls="soma-workspace-rail" aria-expanded={expanded}
     aria-label={expanded?'Ciutkan navigasi':'Buka navigasi SOMA'}
     title={expanded?'Ciutkan navigasi':'Perluas navigasi'}
     onClick={()=>setExpanded(value=>!value)}>
     {expanded?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>}
    </button>
    <div className="v3-brand"><b>SOMA</b><span> / FOOTPRINTS SYSTEM</span></div>
   </div>
   <div className="v3-global-actions">
    <button className="v3-preset" type="button" title="Pilih atau simpan preset"
     onClick={onPreset}><Save size={15}/><span>{preset}</span></button>
    <button className="v3-perform" type="button" aria-pressed={perform} onClick={onPerform}>
     <Play size={15}/>{perform?'Kembali Edit':'Perform'}</button>
    <button className="v3-help" type="button" onClick={onHelp} aria-label="Bantuan SOMA">
     <HelpCircle size={19}/></button>
   </div>
  </header>
  {mobile&&expanded&&<button className="soma-rail-scrim" type="button"
   aria-label="Tutup navigasi" onClick={()=>setExpanded(false)}/>}
  <nav ref={railRef} className="soma-app-sidebar soma-primary-sidebar" id="soma-workspace-rail"
   aria-label="Pilih sistem SOMA" data-expanded={expanded} data-mobile={mobile}>
   <div className="soma-rail-scroll soma-primary-nav-list">
    <button type="button" className="soma-rail-item soma-primary-destination"
     aria-current={workspace!=='projection'?'page':undefined} title="Footprints · Capture → Process → Compose"
     onClick={()=>navigate('footprints')}>
     <Footprints size={21}/><span className="soma-rail-item-copy"><b>Footprints</b>
      <small>Input → Process → Compose</small></span>
    </button>
    <button type="button" className="soma-rail-item soma-primary-destination"
     aria-current={workspace==='projection'?'page':undefined} title="Projector · Output & calibration"
     onClick={()=>navigate('projector')}>
     <Monitor size={21}/><span className="soma-rail-item-copy"><b>Projector</b>
      <small>Mapping & output</small></span>
    </button>
   </div>
   <div className="soma-primary-nav-note"><span aria-hidden="true">●</span>
    <span className="soma-rail-item-copy">Software output · safety gate</span>
   </div>
  </nav>
 </>;
}
