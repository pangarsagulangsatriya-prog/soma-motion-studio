import {useEffect,useRef,useState} from 'react';
import {Activity,AudioLines,BookOpen,Camera,Film,FlaskConical,Footprints,HelpCircle,
 Layers3,Monitor,PanelLeftClose,PanelLeftOpen,Play,Save,ScanFace,Sparkles,Type,X} from 'lucide-react';
import type {SceneId} from './ScenePicker.tsx';
import type {StageNavigationTool} from './stageNavigation.ts';
import './workspace-navigation.css';

export type Workspace='studio'|'archive'|'projection';
const NAV_KEY='soma-primary-navigation-v2';
type LegacyScene=Exclude<SceneId,'footprints'>;

/** Two production workspaces, with independent access to preserved experiments. */
export function GlobalNav({workspace,scene,perform,onFootprints,onInstrument,onArchive,
 onProjection,onPreset,onPerform,onHelp,onStageTool,onSoundLab,onHydraLab,onCaptureLab,preset}:{
 workspace:Workspace;scene:SceneId;perform:boolean;onFootprints:()=>void;
 onInstrument:(scene:LegacyScene)=>void;onArchive:()=>void;onProjection:()=>void;
 onPreset:()=>void;onPerform:()=>void;onHelp:()=>void;
 onStageTool:(tool:StageNavigationTool)=>void;
 onSoundLab:()=>void;onHydraLab:()=>void;onCaptureLab:()=>void;
 selectedTool:StageNavigationTool;preset:string;
}){
 const [expanded,setExpanded]=useState(()=>{
  try{const saved=localStorage.getItem(NAV_KEY);return saved===null?true:saved==='true';}
  catch{return true;}
 });
 const [mobile,setMobile]=useState(false),[labsOpen,setLabsOpen]=useState(false);
 const toggleRef=useRef<HTMLButtonElement>(null),labsRef=useRef<HTMLButtonElement>(null);
 const labsPanelRef=useRef<HTMLElement>(null),railRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  const media=window.matchMedia('(max-width: 760px)');
  const update=()=>setMobile(media.matches);
  update();media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 useEffect(()=>{if(!mobile)try{localStorage.setItem(NAV_KEY,String(expanded));}catch{}},[mobile,expanded]);
 useEffect(()=>{
  if(!mobile||!expanded||labsOpen)return;
  const previous=document.activeElement;
  const raf=requestAnimationFrame(()=>railRef.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));
  const handle=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();setLabsOpen(false);setExpanded(false);toggleRef.current?.focus();return;}
   if(e.key!=='Tab'||!railRef.current)return;
   const controls=Array.from(railRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    .filter(node=>node.getClientRects().length>0);
   const first=controls[0],last=controls[controls.length-1];
   if(!first||!last)return;
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',handle);
  return()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',handle);
   if(previous instanceof HTMLElement&&document.contains(previous))previous.focus({preventScroll:true});};
 },[mobile,expanded,labsOpen]);
 useEffect(()=>{
  if(!labsOpen)return;
  const raf=requestAnimationFrame(()=>labsPanelRef.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setLabsOpen(false);labsRef.current?.focus();return;}
   if(e.key==='Tab'&&mobile&&labsPanelRef.current){
    const buttons=Array.from(labsPanelRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
     .filter(node=>node.getClientRects().length>0);
    const first=buttons[0],last=buttons[buttons.length-1];
    if(!first||!last)return;
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   }
  };
  const outside=(e:PointerEvent)=>{
   if(e.target instanceof Node&&!labsPanelRef.current?.contains(e.target)&&
    !labsRef.current?.contains(e.target))setLabsOpen(false);
  };
  document.addEventListener('keydown',onKey);
  document.addEventListener('pointerdown',outside);
  return()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',outside);};
 },[labsOpen,mobile]);
 const navigate=(target:'footprints'|'projector')=>{
  setLabsOpen(false);if(mobile)setExpanded(false);
  if(target==='footprints')onFootprints();else onProjection();
 };
 const launch=(fn:()=>void)=>{setLabsOpen(false);if(mobile)setExpanded(false);fn();};
 const visual=(id:LegacyScene,title:string,sub:string,Icon:typeof Type)=>
  <button type="button" key={id} aria-current={scene===id&&workspace==='studio'?'page':undefined}
   onClick={()=>launch(()=>onInstrument(id))}><Icon size={16}/><span><b>{title}</b><small>{sub}</small></span></button>;
 return <>
  <header className="v3-global-nav v3-primary-nav soma-nav-header soma-primary-header">
   <div className="soma-nav-brand-row">
    <button ref={toggleRef} type="button" className="soma-nav-toggle"
     aria-controls="soma-workspace-rail" aria-expanded={expanded}
     aria-label={expanded?'Ciutkan navigasi':'Buka navigasi SOMA'}
     title={expanded?'Ciutkan navigasi':'Perluas navigasi'}
     onClick={()=>{setLabsOpen(false);setExpanded(value=>!value);}}>
     {expanded?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>}
    </button>
    <div className="v3-brand"><b>SOMA</b><span> / {workspace==='projection'?'PROJECTOR':workspace==='archive'||scene!=='footprints'?'LABS':'FOOTPRINTS'}</span></div>
   </div>
   <div className="v3-global-actions">
    {scene!=='footprints'&&workspace==='studio'&&<button className="v3-preset"
     type="button" title="Preset instrumen SOMA Labs" onClick={onPreset}>
     <Save size={15}/><span>{preset}</span></button>}
    {workspace!=='projection'&&<button className="v3-perform" type="button"
     aria-pressed={perform} onClick={onPerform}>
     <Play size={15}/>{perform?'Kembali Edit':'Perform'}</button>}
    <button className="v3-help" type="button" onClick={onHelp} aria-label="Bantuan SOMA">
     <HelpCircle size={19}/></button>
   </div>
  </header>
  {mobile&&expanded&&<button className="soma-rail-scrim" type="button"
   aria-label="Tutup navigasi" onClick={()=>{setLabsOpen(false);setExpanded(false);}}/>}
  <nav ref={railRef} className="soma-app-sidebar soma-primary-sidebar" id="soma-workspace-rail"
   aria-label="Sistem SOMA" data-expanded={expanded} data-mobile={mobile}>
   <div className="soma-rail-scroll soma-primary-nav-list">
    <button type="button" className="soma-rail-item soma-primary-destination"
     aria-current={workspace==='studio'&&scene==='footprints'?'page':undefined}
     title="Footprints · Kamera, tracking dan komposisi" onClick={()=>navigate('footprints')}>
     <Footprints size={21}/><span className="soma-rail-item-copy"><b>Footprints</b>
      <small>Gerak, jejak & arsip</small></span>
    </button>
    <button type="button" className="soma-rail-item soma-primary-destination"
     aria-current={workspace==='projection'?'page':undefined}
     title="Projector · Mapping dan output fisik" onClick={()=>navigate('projector')}>
     <Monitor size={21}/><span className="soma-rail-item-copy"><b>Projector</b>
      <small>Mapping & output</small></span>
    </button>
   </div>
   <div className="soma-primary-labs-launch">
    <button ref={labsRef} type="button" className="soma-rail-item soma-labs-trigger"
     title="SOMA Labs · Eksperimen & fitur lama"
     aria-haspopup="dialog" aria-expanded={labsOpen} aria-controls="soma-labs-panel"
     aria-current={workspace==='archive'||(workspace==='studio'&&scene!=='footprints')?'page':undefined}
     onClick={()=>setLabsOpen(v=>!v)}>
     <FlaskConical size={20}/><span className="soma-rail-item-copy">
      <b>SOMA Labs</b><small>Eksperimen & legacy</small></span>
    </button>
   </div>
   <div className="soma-primary-nav-note"><span aria-hidden="true">●</span>
    <span className="soma-rail-item-copy">Output memerlukan QA</span>
   </div>
  </nav>
  {labsOpen&&<section id="soma-labs-panel" ref={labsPanelRef} role="dialog"
   aria-modal="false" aria-labelledby="soma-labs-title"
   className="soma-labs-panel" data-expanded={expanded}>
   <header><div><small>SECONDARY WORKSPACE</small><h2 id="soma-labs-title">SOMA Labs</h2>
    <p>Eksperimen dan instrumen lama tetap tersedia. Output panggung tidak otomatis aktif.</p></div>
    <button type="button" onClick={()=>{setLabsOpen(false);labsRef.current?.focus();}}
     aria-label="Tutup SOMA Labs" title="Tutup (Esc)"><X size={16}/></button>
   </header>
   <div className="soma-labs-scroll">
    <h3>VISUAL EXPERIMENTS <span>LEGACY</span></h3>
    {visual('liquid','Teks Cair','Huruf & gerak tangan',Type)}
    {visual('echo','Jejak Berulang','Lapisan gambar yang kembali',Layers3)}
    {visual('cut','Potongan','Pecahan ritmis',Sparkles)}
    {visual('body','Siluet × Teks','Tubuh & tipografi',ScanFace)}
    <button type="button" onClick={()=>launch(onHydraLab)}>
     <Sparkles size={16}/><span><b>Hydra / Visual Generatif</b><small>Material, feedback, teks dan visual</small></span></button>
    <h3>MOTION, SOUND & CAPTURE <span>LEGACY</span></h3>
    <button type="button" onClick={()=>launch(onSoundLab)}>
     <AudioLines size={16}/><span><b>Motion & Sound</b><small>Sintesis suara, mapping dan instrumen gerak</small></span></button>
    <button type="button" onClick={()=>launch(onCaptureLab)}>
     <Camera size={16}/><span><b>Capture Experiments</b><small>Foto dan rekaman gestur</small></span></button>
    <button type="button" onClick={()=>launch(onArchive)}>
     <BookOpen size={16}/><span><b>Archive Studio</b><small>Arsip performatif lama</small></span></button>
    <h3>GAIT EXPERIMENTS <span>EXPERIMENTAL</span></h3>
    <button type="button" onClick={()=>launch(()=>onStageTool('video'))}>
     <Film size={16}/><span><b>Video Motion Lab</b><small>MP4 → Pose/Gait</small></span></button>
    <button type="button" onClick={()=>launch(()=>onStageTool('rehearsal'))}>
     <Activity size={16}/><span><b>Rehearsal Lab</b><small>Bandingkan video dan kamera</small></span></button>
    <button type="button" onClick={()=>launch(()=>onStageTool('simulator'))}>
     <Play size={16}/><span><b>Simulasi 3D</b><small>Latihan gerak kaki virtual</small></span></button>
   </div>
  </section>}
 </>;
}
