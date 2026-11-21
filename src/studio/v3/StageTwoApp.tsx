import {useEffect,useRef,useState} from 'react';
import {Layers3,Monitor,MonitorOff,PanelLeftClose,PanelLeftOpen} from 'lucide-react';
import {requestStageBlackout} from '../../footprints/stage-optics/StageBlackout.ts';
import {requestSoftwarePreviewBlackout} from './stagePreviewCommands.ts';
import './workspace-navigation.css';
import './stage-two.css';

const mobileQuery='(max-width: 760px)';
const navigationKey='soma-primary-navigation-v3';

/** Stage 2 is an isolated route. Stage 1 capture/renderer is not mounted here. */
export function StageTwoApp(){
 const [mobile,setMobile]=useState(()=>window.matchMedia(mobileQuery).matches);
 const [expanded,setExpanded]=useState(()=>{
  try{return !window.matchMedia(mobileQuery).matches&&localStorage.getItem(navigationKey)==='true';}
  catch{return false;}
 });
 const toggleRef=useRef<HTMLButtonElement>(null);
 const railRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  // Enter fail-closed; Stage 2 has no capture or physical output session.
  requestStageBlackout(()=>{});
  requestSoftwarePreviewBlackout();
 },[]);
 useEffect(()=>{
  const media=window.matchMedia(mobileQuery);
  const update=()=>{setMobile(media.matches);if(media.matches)setExpanded(false);};
  media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  if(mobile)return;
  try{localStorage.setItem(navigationKey,String(expanded));}catch{}
 },[expanded,mobile]);
 useEffect(()=>{
  if(!mobile||!expanded)return;
  const frame=requestAnimationFrame(()=>railRef.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!event.shiftKey){
    event.preventDefault();setExpanded(false);toggleRef.current?.focus({preventScroll:true});
   }
  };
  document.addEventListener('keydown',keydown);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keydown);};
 },[mobile,expanded]);
 const openStageOne=()=>{
  requestStageBlackout(()=>{});
  requestSoftwarePreviewBlackout();
  const url=new URL(window.location.href);
  url.searchParams.delete('stage');
  window.location.assign(url.toString());
 };
 return <div className="app soma-v2 soma-v3 soma-stage2-app" data-stage="2">
  <div className="workspace">
   <header className="v3-global-nav v3-primary-nav soma-nav-header soma-primary-header">
    <div className="soma-nav-brand-row">
     <button ref={toggleRef} type="button" className="soma-nav-toggle"
      aria-controls="soma-workspace-rail" aria-expanded={expanded}
      aria-label={expanded?'Ciutkan navigasi':'Buka navigasi SOMA'}
      onClick={()=>setExpanded(value=>!value)}>
      {expanded?<PanelLeftClose size={17}/>:<PanelLeftOpen size={17}/>}
     </button>
     <div className="v3-brand"><b>SOMA</b><span> / STAGE 2</span></div>
    </div>
    <div className="v3-global-actions">
     <button className="soma-ia-blackout" type="button"
      aria-label="Kirim perintah blackout SOMA"
      onClick={()=>{requestStageBlackout(()=>{});requestSoftwarePreviewBlackout();}}>
      <MonitorOff size={15}/><span>Blackout</span>
     </button>
    </div>
   </header>
   {mobile&&expanded&&<button className="soma-rail-scrim" type="button"
    aria-label="Tutup navigasi" onClick={()=>{setExpanded(false);toggleRef.current?.focus({preventScroll:true});}}/>}
   <nav ref={railRef} className="soma-app-sidebar soma-primary-sidebar"
    id="soma-workspace-rail" aria-label="Sistem SOMA"
    data-expanded={expanded} data-mobile={mobile} data-labs-open={false}>
    <div className="soma-rail-scroll soma-primary-nav-list" aria-label="Modul SOMA">
     <button type="button" className="soma-rail-item soma-primary-destination soma-stage-module-launch"
      aria-label="Stage 1" title="Stage 1 · Motion & Projection" onClick={openStageOne}>
      <Monitor size={20} aria-hidden="true"/>
      <span className="soma-rail-item-copy"><b>Stage 1</b></span>
     </button>
     <button type="button" className="soma-rail-item soma-primary-destination soma-stage-module-launch"
      aria-label="Stage 2" aria-current="page" title="Stage 2">
      <Layers3 size={20} aria-hidden="true"/>
      <span className="soma-rail-item-copy"><b>Stage 2</b></span>
     </button>
    </div>
   </nav>
   <main>
    <section className="soma-stage2-workspace" aria-labelledby="soma-stage2-title">
     <div className="soma-stage2-topline"><span>STAGE 2</span><span>RUANG TERPISAH</span></div>
     <div className="soma-stage2-empty">
      <Layers3 size={29} strokeWidth={1.3} aria-hidden="true"/>
      <h1 id="soma-stage2-title">Stage 2</h1>
      <p>Ruang ini belum diisi.</p>
     </div>
    </section>
   </main>
  </div>
 </div>;
}
