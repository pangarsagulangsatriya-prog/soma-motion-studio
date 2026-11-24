import {useEffect,useRef,useState} from 'react';
import {Activity,AudioLines,BookOpen,Camera,Film,Footprints,HelpCircle,
 Layers3,Network,Monitor,MonitorOff,Workflow,Save,ScanFace,Search,
 Sparkles,Type,X,Box,ChevronRight} from 'lucide-react';
import type {SceneId} from './ScenePicker.tsx';
import type {StageNavigationTool} from './stageNavigation.ts';
import type {FootprintsInputChoice} from './sourceSwitchModel.ts';
import {searchStageTwoLabs,STAGE_TWO_ITEM_COUNT,isStageTwoLab,type LabsId,type StageTwoLabId} from './labsCatalog.ts';
import {isDismissEscape,RAIL_TOOLTIP_DELAY_MS} from './interactionPolicy.ts';
import './workspace-navigation.css';
import './projector-shell.css';
import './ux-r1-unified-shell.css';
import './engine-rail.css';

export type Workspace='studio'|'archive'|'projection';
type LegacyScene=Exclude<SceneId,'footprints'>;
const mobileQuery='(max-width: 760px)';
const labsIcons:Record<LabsId,typeof Footprints>={
 liquid:Type,echo:Layers3,cut:Sparkles,body:ScanFace,hydra:Sparkles,
 sound:AudioLines,capture:Camera,archive:BookOpen,video:Film,rehearsal:Activity,simulator:Box
};

export function GlobalNav({workspace,scene,stageTwo=false,stageTwoLab='liquid',onStageTwoLab,onFootprints,onStageTwo,onInstrument,onArchive,
 onProjection,onPreset,onPerform,onHelp,onBlackout,onCameraHub,onNodeCanvas,cameraHubActive=false,captureActive=false,onF3Capture,onStageTool,onSoundLab,onHydraLab,onCaptureLab,preset,sourceLabel,trackingLabel,outputLabel,sourceSelection,sourceBusy,onSelectSource}:{
 workspace:Workspace;scene:SceneId;perform:boolean;stageTwo?:boolean;stageTwoLab?:StageTwoLabId;
 onStageTwoLab?:(id:StageTwoLabId)=>void;onFootprints:()=>void;onStageTwo:()=>void;
 onInstrument:(scene:LegacyScene)=>void;onArchive:()=>void;onProjection:()=>void;
 onPreset:()=>void;onPerform:()=>void;onHelp:()=>void;onBlackout:()=>void;
 onCameraHub:()=>void;onNodeCanvas?:()=>void;cameraHubActive?:boolean;captureActive?:boolean;onF3Capture:()=>void;
 onStageTool:(tool:StageNavigationTool)=>void;
 onSoundLab:()=>void;onHydraLab:()=>void;onCaptureLab:()=>void;
 selectedTool:StageNavigationTool;preset:string;
 sourceLabel:string;trackingLabel:string;outputLabel:string;
 sourceSelection:FootprintsInputChoice|null;sourceBusy:boolean;
 onSelectSource:(choice:FootprintsInputChoice)=>void;
}){
 const [mobile,setMobile]=useState(()=>window.matchMedia(mobileQuery).matches);
 const expanded=false; // Fixed-width navigation: no expanding rail.
 const [engineMenuOpen,setEngineMenuOpen]=useState(false);
 const [engineMenuPosition,setEngineMenuPosition]=useState({left:70,top:78});
 const engineTriggerRef=useRef<HTMLButtonElement>(null);
 const enginePanelRef=useRef<HTMLElement>(null);
 const [labsOpen,setLabsOpen]=useState(false),[labsQuery,setLabsQuery]=useState('');
 const [activeLab,setActiveLab]=useState<LabsId|null>(null);
 const [tip,setTip]=useState<{label:string;top:number}|null>(null);
 const labsRef=useRef<HTMLButtonElement>(null);
 const labsPanelRef=useRef<HTMLElement>(null),searchRef=useRef<HTMLInputElement>(null);
 const railRef=useRef<HTMLElement>(null);
 const tipTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(tipTimer.current!==null)clearTimeout(tipTimer.current);},[]);
 const labsContext=stageTwo;
 const stageModuleActive=!stageTwo&&workspace==='studio'&&scene==='footprints'&&!cameraHubActive&&!captureActive;
 useEffect(()=>{
  const media=window.matchMedia(mobileQuery);
  const update=()=>setMobile(media.matches);
  update();media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 const positionEngineMenu=()=>{
  const rect=engineTriggerRef.current?.getBoundingClientRect();
  if(!rect)return;
  setEngineMenuPosition({
   left:Math.min(rect.right+10,Math.max(8,window.innerWidth-258)),
   top:Math.min(rect.top,Math.max(64,window.innerHeight-276))
  });
 };
 useEffect(()=>{
  if(!engineMenuOpen)return;
  const raf=requestAnimationFrame(()=>{
   positionEngineMenu();
   enginePanelRef.current?.querySelector<HTMLButtonElement>('.soma-engine-choice')?.focus({preventScroll:true});
  });
  const closeOutside=(e:PointerEvent)=>{
   if(e.target instanceof Node&&!engineTriggerRef.current?.contains(e.target)&&
    !enginePanelRef.current?.contains(e.target))setEngineMenuOpen(false);
  };
  const onKey=(e:KeyboardEvent)=>{
   if(isDismissEscape(e)){
    e.preventDefault();setEngineMenuOpen(false);
    engineTriggerRef.current?.focus({preventScroll:true});
   }
  };
  const updatePosition=()=>positionEngineMenu();
  document.addEventListener('pointerdown',closeOutside);
  document.addEventListener('keydown',onKey);
  window.addEventListener('resize',updatePosition);
  window.addEventListener('scroll',updatePosition,true);
  return()=>{
   cancelAnimationFrame(raf);
   document.removeEventListener('pointerdown',closeOutside);
   document.removeEventListener('keydown',onKey);
   window.removeEventListener('resize',updatePosition);
   window.removeEventListener('scroll',updatePosition,true);
  };
 },[engineMenuOpen]);
 // Labs is a lightweight non-modal sidecar on desktop, a focused sheet on mobile.
 useEffect(()=>{
  if(!labsOpen)return;
  const raf=requestAnimationFrame(()=>searchRef.current?.focus({preventScroll:true}));
  const beforeOverflow=document.body.style.overflow;
  if(mobile)document.body.style.overflow='hidden';
  const onKey=(e:KeyboardEvent)=>{
   if(isDismissEscape(e)){
    e.preventDefault();e.stopPropagation();
    setLabsOpen(false);labsRef.current?.focus({preventScroll:true});return;
   }
   if(e.key==='Tab'&&mobile&&labsPanelRef.current){
    const controls=Array.from(labsPanelRef.current.querySelectorAll<HTMLElement>(
     'button:not(:disabled),input:not(:disabled),[href],[tabindex]:not([tabindex="-1"])'))
     .filter(node=>node.getClientRects().length>0);
    const first=controls[0],last=controls[controls.length-1];
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
  return()=>{
   cancelAnimationFrame(raf);document.body.style.overflow=beforeOverflow;
   document.removeEventListener('keydown',onKey);
   document.removeEventListener('pointerdown',outside);
  };
 },[labsOpen,mobile]);
 const clearTip=()=>{
  if(tipTimer.current!==null){clearTimeout(tipTimer.current);tipTimer.current=null;}
  setTip(null);
 };
 const showTip=(label:string,node:HTMLElement,mode:'hover'|'focus')=>{
  if(mobile||expanded||labsOpen||engineMenuOpen)return;
  if(tipTimer.current!==null)clearTimeout(tipTimer.current);
  const rect=node.getBoundingClientRect();
  const top=Math.max(69,Math.min(window.innerHeight-52,rect.top+rect.height/2));
  if(mode==='focus')setTip({label,top});
  else tipTimer.current=setTimeout(()=>{setTip({label,top});tipTimer.current=null;},RAIL_TOOLTIP_DELAY_MS);
 };
 const openStageStudio=()=>{
  setLabsOpen(false);clearTip();
  setEngineMenuOpen(false);
  onFootprints();
 };
 const action:Record<LabsId,()=>void>={
  liquid:()=>onInstrument('liquid'),echo:()=>onInstrument('echo'),
  cut:()=>onInstrument('cut'),body:()=>onInstrument('body'),
  hydra:onHydraLab,sound:onSoundLab,capture:onCaptureLab,archive:onArchive,
  video:()=>onStageTool('video'),rehearsal:()=>onStageTool('rehearsal'),
  simulator:()=>onStageTool('simulator')
 };
 const launch=(id:LabsId)=>{
  setActiveLab(id);setLabsOpen(false);clearTip();
  if(stageTwo&&isStageTwoLab(id))onStageTwoLab?.(id);
  else action[id]();
  requestAnimationFrame(()=>{
   const target=labsRef.current;
   target?.focus({preventScroll:true});
  });
 };
 const toggleLabs=()=>{
  setEngineMenuOpen(false);setLabsQuery('');clearTip();setLabsOpen(value=>!value);
 };
 const filtered=searchStageTwoLabs(labsQuery);
 const selectedLab=labsContext?stageTwoLab:(activeLab??null);
 return <>
  <header className="v3-global-nav v3-primary-nav soma-nav-header soma-primary-header">
   <div className="soma-nav-brand-row">
    <span className="soma-engine-brand-symbol" aria-hidden="true"><Workflow size={17}/></span>
    <div className="v3-brand"><b>SOMA</b>
     <span> / {cameraHubActive?'CAMERA HUB':captureActive?'F3 CAPTURE':stageTwo?'STAGE 2':stageModuleActive?'STAGE 1':'TOOLS'}</span>
    </div>
   </div>
   {stageModuleActive&&<div className="soma-uxr1-health" role="status" aria-label="Ringkasan status Stage 1">
    <span title="Ubah sumber di workspace Track">Sumber: {sourceLabel}</span>
    <span title="Status pelacakan">{trackingLabel}</span>
    <span title="Status koneksi output">{outputLabel}</span>
   </div>}
   <div className="v3-global-actions">
    {!stageTwo&&onNodeCanvas&&<button type="button" className="v3-preset" title="Unified Node Canvas · beta" onClick={onNodeCanvas}><Network size={15}/><span>Node Canvas</span></button>}
    {stageTwo&&<button ref={labsRef} type="button" className="soma-header-labs-btn"
     aria-label="Instrumen Stage 2" title="Cari semua instrumen Stage 2"
     aria-haspopup="dialog" aria-expanded={labsOpen} aria-controls="soma-labs-panel"
     onClick={toggleLabs}><Search size={17} aria-hidden="true"/></button>}
    {stageTwo&&scene!=='footprints'&&workspace==='studio'&&<button className="v3-preset"
     type="button" title="Preset instrumen SOMA Labs" onClick={onPreset}>
     <Save size={15}/><span>{preset}</span></button>}
    <button type="button" className="soma-ia-blackout" onClick={onBlackout}
     aria-label="Kirim perintah blackout SOMA" title="BLACKOUT · periksa keluaran cahaya fisik">
     <MonitorOff size={15}/><span>Blackout</span></button>
    <button className="v3-help" type="button" onClick={onHelp} aria-label="Bantuan SOMA">
     <HelpCircle size={18}/></button>
   </div>
  </header>
  <nav ref={railRef} className="soma-app-sidebar soma-primary-sidebar" id="soma-workspace-rail"
   aria-label="Sistem SOMA" data-expanded={expanded} data-mobile={mobile}
   data-labs-open={labsOpen}>
   <div className="soma-rail-scroll soma-primary-nav-list" aria-label="Modul SOMA">
    <button ref={engineTriggerRef} type="button"
     className="soma-rail-item soma-primary-destination soma-engine-trigger"
     aria-label="Engine" aria-controls="soma-engine-flyout"
     aria-haspopup="dialog" aria-expanded={engineMenuOpen}
     aria-current={!cameraHubActive?'page':undefined}
     title="Engine · Stage 1, Stage 2, F3 Capture"
     onMouseEnter={e=>showTip('Engine',e.currentTarget,'hover')}
     onMouseLeave={clearTip} onFocus={e=>showTip('Engine',e.currentTarget,'focus')}
     onBlur={clearTip}
     onClick={()=>{setLabsOpen(false);clearTip();positionEngineMenu();setEngineMenuOpen(value=>!value);}}>
     <Workflow size={20} aria-hidden="true"/>
     <span className="soma-rail-item-copy"><b>Engine</b></span>
    </button>
    <button type="button" className="soma-rail-item soma-primary-destination soma-camera-hub-trigger"
     aria-label="Camera Hub" aria-current={cameraHubActive?'page':undefined}
     title="Camera Hub · sumber dan sambungan"
     onMouseEnter={e=>showTip('Camera Hub',e.currentTarget,'hover')}
     onMouseLeave={clearTip} onFocus={e=>showTip('Camera Hub',e.currentTarget,'focus')}
     onBlur={clearTip}
     onClick={()=>{setLabsOpen(false);setEngineMenuOpen(false);clearTip();onCameraHub();}}>
     <Network size={20} aria-hidden="true"/>
     <span className="soma-rail-item-copy"><b>Camera Hub</b></span>
    </button>
   </div>
  </nav>
  {engineMenuOpen&&<section id="soma-engine-flyout" ref={enginePanelRef}
   className="soma-engine-flyout" role="dialog" aria-label="Pilih Stage"
   style={{left:engineMenuPosition.left,top:engineMenuPosition.top}}
   onKeyDown={e=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
    const choices=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.soma-engine-choice'));
    const i=choices.indexOf(document.activeElement as HTMLButtonElement);
    const next=e.key==='Home'?0:e.key==='End'?choices.length-1:
     e.key==='ArrowDown'?(i+1)%choices.length:(i-1+choices.length)%choices.length;
    e.preventDefault();choices[next]?.focus();
   }}>
   <p className="soma-engine-flyout-label">ENGINE <span>WORKSPACES</span></p>
   <button type="button" className="soma-engine-choice" aria-current={stageModuleActive?'page':undefined}
    onClick={openStageStudio}>
    <span className="soma-engine-choice-icon"><Monitor size={17}/></span>
    <span className="soma-engine-choice-text"><strong>Stage 1</strong><small>Motion · Projection</small></span>
    <ChevronRight size={15} aria-hidden="true"/>
   </button>
   <button type="button" className="soma-engine-choice" aria-current={stageTwo?'page':undefined}
    onClick={()=>{setEngineMenuOpen(false);onStageTwo();}}>
    <span className="soma-engine-choice-icon"><Layers3 size={17}/></span>
    <span className="soma-engine-choice-text"><strong>Stage 2</strong><small>Visual · Sound · Text</small></span>
    <ChevronRight size={15} aria-hidden="true"/>
   </button>
   <button type="button" className="soma-engine-choice" aria-current={captureActive?'page':undefined}
    onClick={()=>{setEngineMenuOpen(false);onF3Capture();}}>
    <span className="soma-engine-choice-icon"><Camera size={17}/></span>
    <span className="soma-engine-choice-text"><strong>F3 Capture</strong><small>Input · Motion · Perform</small></span>
    <ChevronRight size={15} aria-hidden="true"/>
   </button>
  </section>}
  {tip&&<div id="soma-rail-tooltip" className="soma-rail-tooltip" role="tooltip" style={{top:tip.top}}>
   {tip.label}
  </div>}
  {labsOpen&&mobile&&<button type="button" className="soma-labs-backdrop"
   aria-label="Tutup SOMA Labs" onClick={()=>{setLabsOpen(false);labsRef.current?.focus({preventScroll:true});}}/>}
  {labsOpen&&<section id="soma-labs-panel" ref={labsPanelRef} role="dialog"
   aria-modal={mobile?true:undefined} aria-labelledby="soma-labs-title"
   className="soma-labs-panel" data-expanded={expanded}>
   <header className="soma-labs-head">
    <div><h2 id="soma-labs-title">Instrumen Stage 2</h2></div>
    <button type="button" onClick={()=>{setLabsOpen(false);labsRef.current?.focus({preventScroll:true});}}
     aria-label="Tutup SOMA Labs" title="Tutup (Esc)"><X size={17}/></button>
   </header>
   <div className="soma-labs-search">
    <Search size={17} aria-hidden="true"/>
    <input ref={searchRef} type="search" value={labsQuery} maxLength={90}
     onChange={e=>setLabsQuery(e.target.value)} placeholder="Cari eksperimen..."
     aria-label="Cari modul SOMA Labs"/>
    <span>{filtered.reduce((sum,group)=>sum+group.items.length,0)}/{STAGE_TWO_ITEM_COUNT}</span>
   </div>
   <div className="soma-labs-scroll">
    {filtered.length===0&&<div className="soma-labs-empty">
     <Search size={21} aria-hidden="true"/>
     <strong>Tidak ada modul yang cocok</strong>
     <p>Cari teks, suara, visual, atau arsip.</p>
     <button type="button" onClick={()=>{setLabsQuery('');searchRef.current?.focus();}}>Lihat semua</button>
    </div>}
    {filtered.map(group=><div className="soma-labs-group" key={group.id}>
     <div className="soma-labs-group-head"><h3>{group.label}</h3>
      <small>{group.items.length} modul</small></div>
     {group.items.map(item=>{
      const Icon=labsIcons[item.id],isActive=item.id===selectedLab;
      return <button type="button" key={item.id} className="soma-labs-entry"
       aria-current={isActive?'page':undefined}
       onClick={()=>launch(item.id)}>
       <span className="soma-labs-entry-icon"><Icon size={18} aria-hidden="true"/></span>
       <span className="soma-labs-entry-copy"><b>{item.title}</b><small>{item.detail}</small></span>
       <span className="soma-labs-entry-chevron"><ChevronRight size={15} aria-hidden="true"/></span>
      </button>;
     })}
    </div>)}
   </div>
   <footer className="soma-labs-footer">
    <span>Stage 2 · instrumen eksperimental</span>
   </footer>
  </section>}
 </>;
}
