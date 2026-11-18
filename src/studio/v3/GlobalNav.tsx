import {useEffect,useRef,useState} from 'react';
import {Activity,AudioLines,BookOpen,Camera,Film,FlaskConical,Footprints,HelpCircle,
 Layers3,Monitor,MonitorOff,PanelLeftClose,PanelLeftOpen,Play,Save,ScanFace,Search,
 Sparkles,Type,X,Box,ChevronRight} from 'lucide-react';
import type {SceneId} from './ScenePicker.tsx';
import type {StageNavigationTool} from './stageNavigation.ts';
import {SOURCE_CHOICES,type FootprintsInputChoice} from './sourceSwitchModel.ts';
import {LABS_ITEM_COUNT,searchLabs,type LabsId} from './labsCatalog.ts';
import {isDismissEscape,RAIL_TOOLTIP_DELAY_MS} from './interactionPolicy.ts';
import './workspace-navigation.css';
import './projector-shell.css';
import './ux-r1-unified-shell.css';

export type Workspace='studio'|'archive'|'projection';
const NAV_KEY='soma-primary-navigation-v3';
type LegacyScene=Exclude<SceneId,'footprints'>;
const mobileQuery='(max-width: 760px)';
const labsIcons:Record<LabsId,typeof Footprints>={
 liquid:Type,echo:Layers3,cut:Sparkles,body:ScanFace,hydra:Sparkles,
 sound:AudioLines,capture:Camera,archive:BookOpen,video:Film,rehearsal:Activity,simulator:Box
};

export function GlobalNav({workspace,scene,perform,onFootprints,onInstrument,onArchive,
 onProjection,onPreset,onPerform,onHelp,onBlackout,onStageTool,onSoundLab,onHydraLab,onCaptureLab,selectedTool,preset,sourceLabel,trackingLabel,outputLabel,sourceSelection,sourceBusy,onSelectSource}:{
 workspace:Workspace;scene:SceneId;perform:boolean;onFootprints:()=>void;
 onInstrument:(scene:LegacyScene)=>void;onArchive:()=>void;onProjection:()=>void;
 onPreset:()=>void;onPerform:()=>void;onHelp:()=>void;onBlackout:()=>void;
 onStageTool:(tool:StageNavigationTool)=>void;
 onSoundLab:()=>void;onHydraLab:()=>void;onCaptureLab:()=>void;
 selectedTool:StageNavigationTool;preset:string;
 sourceLabel:string;trackingLabel:string;outputLabel:string;
 sourceSelection:FootprintsInputChoice|null;sourceBusy:boolean;
 onSelectSource:(choice:FootprintsInputChoice)=>void;
}){
 const [mobile,setMobile]=useState(()=>window.matchMedia(mobileQuery).matches);
 const [expanded,setExpanded]=useState(()=>{
  try{return !window.matchMedia(mobileQuery).matches&&localStorage.getItem(NAV_KEY)!=='false';}
  catch{return false;}
 });
 const [labsOpen,setLabsOpen]=useState(false),[labsQuery,setLabsQuery]=useState('');
 const [activeLab,setActiveLab]=useState<LabsId|null>(null);
 const [tip,setTip]=useState<{label:string;top:number}|null>(null);
 const toggleRef=useRef<HTMLButtonElement>(null),labsRef=useRef<HTMLButtonElement>(null);
 const labsPanelRef=useRef<HTMLElement>(null),searchRef=useRef<HTMLInputElement>(null);
 const railRef=useRef<HTMLElement>(null);
 const tipTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(tipTimer.current!==null)clearTimeout(tipTimer.current);},[]);
 const labsContext=workspace==='archive'||(workspace==='studio'&&scene!=='footprints');
 useEffect(()=>{
  const media=window.matchMedia(mobileQuery);
  const update=()=>{
   setMobile(media.matches);
   if(media.matches){setExpanded(false);setTip(null);}
  };
  update();media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  if(mobile)return;
  try{localStorage.setItem(NAV_KEY,String(expanded));}catch{}
 },[expanded,mobile]);
 useEffect(()=>{
  if(!expanded&&!labsOpen&&!mobile)return;
  if(tipTimer.current!==null){clearTimeout(tipTimer.current);tipTimer.current=null;}
  setTip(null);
 },[expanded,labsOpen,mobile]);
 // On mobile, the navigation rail behaves as a modal drawer with a focus loop.
 useEffect(()=>{
  if(!mobile||!expanded||labsOpen)return;
  const raf=requestAnimationFrame(()=>{
   const active=document.activeElement;
   if(!(active instanceof HTMLElement)||!railRef.current?.contains(active))
    railRef.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
  });
  const keydown=(e:KeyboardEvent)=>{
   if(isDismissEscape(e)){e.preventDefault();setExpanded(false);toggleRef.current?.focus({preventScroll:true});return;}
   if(e.key!=='Tab'||!railRef.current)return;
   const buttons=Array.from(railRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    .filter(node=>node.getClientRects().length>0);
   const first=buttons[0],last=buttons[buttons.length-1];
   if(!first||!last)return;
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',keydown);
  return()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',keydown);};
 },[mobile,expanded,labsOpen]);
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
  if(mobile||expanded||labsOpen)return;
  if(tipTimer.current!==null)clearTimeout(tipTimer.current);
  const rect=node.getBoundingClientRect();
  const top=Math.max(69,Math.min(window.innerHeight-52,rect.top+rect.height/2));
  if(mode==='focus')setTip({label,top});
  else tipTimer.current=setTimeout(()=>{setTip({label,top});tipTimer.current=null;},RAIL_TOOLTIP_DELAY_MS);
 };
 const navigate=(target:'track'|'compose'|'map'|'perform')=>{
  setLabsOpen(false);clearTip();
  if(mobile){setExpanded(false);requestAnimationFrame(()=>toggleRef.current?.focus({preventScroll:true}));}
  if(target==='track')onStageTool('tracking');
  else if(target==='compose')onFootprints();
  else if(target==='map')onStageTool('mapping');
  else onPerform();
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
  if(mobile)setExpanded(false);
  action[id]();
  requestAnimationFrame(()=>{
   const target=mobile?toggleRef.current:labsRef.current;
   target?.focus({preventScroll:true});
  });
 };
 const toggleLabs=()=>{
  setLabsQuery('');clearTip();setLabsOpen(value=>!value);
 };
 const filtered=searchLabs(labsQuery);
 const selectedLab=labsContext?(activeLab??(workspace==='archive'?'archive':scene)):null;
 return <>
  <header className="v3-global-nav v3-primary-nav soma-nav-header soma-primary-header">
   <div className="soma-nav-brand-row">
    <button ref={toggleRef} type="button" className="soma-nav-toggle"
     aria-controls="soma-workspace-rail" aria-expanded={expanded}
     aria-label={expanded?'Ciutkan navigasi':'Buka navigasi SOMA'}
     title={expanded?'Ciutkan navigasi':'Perluas navigasi'}
     onClick={()=>{setLabsOpen(false);clearTip();setExpanded(value=>!value);}}>
     {expanded?<PanelLeftClose size={17}/>:<PanelLeftOpen size={17}/>}
    </button>
    <div className="v3-brand"><b>SOMA</b>
     <span> / {perform?'PERFORM':selectedTool==='mapping'||workspace==='projection'?'MAP':selectedTool==='tracking'||selectedTool==='live'?'TRACK':labsContext?'LABS':'COMPOSE'}</span>
    </div>
   </div>
   <div className="soma-uxr1-health" role="group" aria-label="Source dan status Stage Studio">
    <details className="soma-uxr1-source" aria-label="Pilih sumber gerak SOMA">
     <summary title="Satu sumber untuk Track, Compose, Map, Perform">SOURCE: {sourceLabel}</summary>
     <div className="soma-uxr1-source-menu" role="group" aria-label="Pilihan sumber gerak">
      {SOURCE_CHOICES.map(option=><button key={option.id} type="button" disabled={sourceBusy||sourceSelection===option.id}
       aria-pressed={sourceSelection===option.id} onClick={e=>{onSelectSource(option.id);e.currentTarget.closest('details')?.removeAttribute('open');}}>
       <b>{option.label}</b><small>{option.description}</small>
      </button>)}
     </div>
    </details>
    <span title="Status koneksi sumber; bukan konfirmasi kualitas deteksi pose">{trackingLabel}</span>
    <span title="Koneksi output software bukan bukti proyeksi fisik atau QA">{outputLabel}</span>
   </div>
   <div className="v3-global-actions">
    {scene!=='footprints'&&workspace==='studio'&&<button className="v3-preset"
     type="button" title="Preset instrumen SOMA Labs" onClick={onPreset}>
     <Save size={15}/><span>{preset}</span></button>}
    <button type="button" className="soma-ia-blackout" onClick={onBlackout}
     aria-label="Kirim perintah blackout SOMA" title="BLACKOUT · periksa keluaran cahaya fisik">
     <MonitorOff size={15}/><span>Blackout</span></button>
    <button className="v3-help" type="button" onClick={onHelp} aria-label="Bantuan SOMA">
     <HelpCircle size={18}/></button>
   </div>
  </header>
  {mobile&&expanded&&!labsOpen&&<button className="soma-rail-scrim" type="button"
   aria-label="Tutup navigasi" onClick={()=>{setExpanded(false);toggleRef.current?.focus({preventScroll:true});}}/>}
  <nav ref={railRef} className="soma-app-sidebar soma-primary-sidebar" id="soma-workspace-rail"
   aria-label="Sistem SOMA" data-expanded={expanded} data-mobile={mobile}
   data-labs-open={labsOpen}>
   <div className="soma-rail-scroll soma-primary-nav-list">
    <button type="button" className="soma-rail-item soma-primary-destination"
     aria-current={workspace==='studio'&&(selectedTool==='tracking'||selectedTool==='live')&&!perform?'page':undefined}
     aria-label="Track" title={expanded?'Track · source dan pose':undefined}
     onMouseEnter={e=>showTip('Track',e.currentTarget,'hover')}
     onMouseLeave={clearTip} onFocus={e=>showTip('Track',e.currentTarget,'focus')}
     onBlur={clearTip} onClick={()=>navigate('track')}>
     <ScanFace size={20} aria-hidden="true"/>
     <span className="soma-rail-item-copy"><b>Track</b></span>
    </button>
    <button type="button" className="soma-rail-item soma-primary-destination"
     aria-current={workspace==='studio'&&selectedTool==='composer'&&!perform?'page':undefined}
     aria-label="Compose" aria-describedby={tip?.label==='Compose'?'soma-rail-tooltip':undefined}
     title={expanded?'Compose · gerak, scene dan komposisi':undefined}
     onMouseEnter={e=>showTip('Compose',e.currentTarget,'hover')}
     onMouseLeave={clearTip}
     onFocus={e=>showTip('Compose',e.currentTarget,'focus')}
     onBlur={clearTip}
     onClick={()=>navigate('compose')}>
     <Layers3 size={20} aria-hidden="true"/>
     <span className="soma-rail-item-copy"><b>Compose</b></span>
    </button>
    <button type="button" className="soma-rail-item soma-primary-destination"
     aria-current={(selectedTool==='mapping'||workspace==='projection')&&!perform?'page':undefined}
     aria-label="Map" aria-describedby={tip?.label==='Map'?'soma-rail-tooltip':undefined}
     title={expanded?'Map · kalibrasi dan output fisik':undefined}
     onMouseEnter={e=>showTip('Map',e.currentTarget,'hover')}
     onMouseLeave={clearTip}
     onFocus={e=>showTip('Projector',e.currentTarget,'focus')}
     onBlur={clearTip}
     onClick={()=>navigate('map')}>
     <Monitor size={20} aria-hidden="true"/>
     <span className="soma-rail-item-copy"><b>Map</b></span>
    </button>
    <button type="button" className="soma-rail-item soma-primary-destination"
     aria-current={perform?'page':undefined}
     aria-label="Perform" aria-describedby={tip?.label==='Perform'?'soma-rail-tooltip':undefined}
     title={expanded?'Perform · operator dan cue':undefined}
     onMouseEnter={e=>showTip('Perform',e.currentTarget,'hover')}
     onMouseLeave={clearTip}
     onFocus={e=>showTip('Perform',e.currentTarget,'focus')}
     onBlur={clearTip}
     onClick={()=>navigate('perform')}>
     <Play size={20} aria-hidden="true"/>
     <span className="soma-rail-item-copy"><b>Perform</b></span>
    </button>
   </div>
   <div className="soma-primary-labs-launch">
    <button ref={labsRef} type="button" className="soma-rail-item soma-labs-trigger"
     aria-label="Tools · SOMA Labs" aria-describedby={tip?.label==='SOMA Labs'?'soma-rail-tooltip':undefined}
     title={expanded?'Eksperimen dan instrumen lama':undefined}
     aria-haspopup="dialog" aria-expanded={labsOpen} aria-controls="soma-labs-panel"
     aria-current={labsContext?'page':undefined}
     onMouseEnter={e=>showTip('SOMA Labs',e.currentTarget,'hover')}
     onMouseLeave={clearTip}
     onFocus={e=>showTip('SOMA Labs',e.currentTarget,'focus')}
     onBlur={clearTip}
     onClick={toggleLabs}>
     <FlaskConical size={19} aria-hidden="true"/>
     <span className="soma-rail-item-copy"><b>Tools</b></span>
     {expanded&&<ChevronRight className="soma-labs-launch-chevron" size={15} aria-hidden="true"/>}
    </button>
   </div>
  </nav>
  {tip&&<div id="soma-rail-tooltip" className="soma-rail-tooltip" role="tooltip" style={{top:tip.top}}>
   {tip.label}
  </div>}
  {labsOpen&&mobile&&<button type="button" className="soma-labs-backdrop"
   aria-label="Tutup SOMA Labs" onClick={()=>{setLabsOpen(false);labsRef.current?.focus({preventScroll:true});}}/>}
  {labsOpen&&<section id="soma-labs-panel" ref={labsPanelRef} role="dialog"
   aria-modal={mobile?true:undefined} aria-labelledby="soma-labs-title"
   className="soma-labs-panel" data-expanded={expanded}>
   <header className="soma-labs-head">
    <div><h2 id="soma-labs-title">Tools</h2></div>
    <button type="button" onClick={()=>{setLabsOpen(false);labsRef.current?.focus({preventScroll:true});}}
     aria-label="Tutup SOMA Labs" title="Tutup (Esc)"><X size={17}/></button>
   </header>
   <div className="soma-labs-search">
    <Search size={17} aria-hidden="true"/>
    <input ref={searchRef} type="search" value={labsQuery} maxLength={90}
     onChange={e=>setLabsQuery(e.target.value)} placeholder="Cari eksperimen..."
     aria-label="Cari modul SOMA Labs"/>
    <span>{filtered.reduce((sum,group)=>sum+group.items.length,0)}/{LABS_ITEM_COUNT}</span>
   </div>
   <div className="soma-labs-scroll">
    {filtered.length===0&&<div className="soma-labs-empty">
     <Search size={21} aria-hidden="true"/>
     <strong>Tidak ada modul yang cocok</strong>
     <p>Gunakan kata kunci lain, seperti video, suara, atau siluet.</p>
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
    <span>Alat tambahan · output fisik terkunci</span>
   </footer>
  </section>}
 </>;
}
