import {useState,useSyncExternalStore} from 'react';
import {
 ArrowLeft,ArrowRight,Circle,Copy,ExternalLink,MonitorOff,Pause,Play,
 Settings2,ShieldAlert,Tv,X,Monitor,Clapperboard,Waypoints,Info,ChevronDown
} from 'lucide-react';
import {operatorCueAt} from './OperatorStageModel.ts';
import type {UnifiedUnit} from './unifiedStageStatus.ts';
import {PERFORM_VIEWS,type PerformCueGrid,type PerformSceneId,type PerformView} from './performCueModel.ts';
import {evaluatePerformOutputSummary,type PerformOutputRouteMode} from './performOutputModel.ts';
import {PERFORM_DESTINATIONS,presentPerformDestination,performCueScope,routeChangeRequiresBlackout} from './performDestinationModel.ts';
import {TouchDesignerPerformPanel} from './TouchDesignerPerformPanel.tsx';
import type {TdSnapshot} from './touchDesignerProtocol.ts';
import {
 STAGE_HARDWARE_ENABLED,armDualSurfaceLiveFromPerform,blackoutAllDualSurfaces,
 closeDualSurfaceOutputWindow,getDualSurfaceFeedUrl,getDualSurfaceState,openDualSurfaceOutputWindow,
 subscribeDualSurface
} from '../../footprints/stage-optics/DualSurfaceSessionStore.ts';
import type {StageSurface} from '../../footprints/stage-optics/DualSurfaceCalibration.ts';
import './ops-r1-perform.css';

type Props={
 index:number;onPrevious:()=>void;onNext:()=>void;
 onExit:()=>void;onBlackout:()=>void;
 held:boolean;onHold:()=>void;onResume:()=>void;
 videoRecording:boolean;canRecordVideo:boolean;onRecordVideo:()=>void;
 units:UnifiedUnit[];contacts:number;performerCount:1|2;
 cueGrid:PerformCueGrid;activeSlot:number;onApplySlot:(index:number)=>void;
 onUpdateSlot:(index:number,changes:{label?:string;scene?:PerformSceneId;view?:PerformView})=>void;
 onSaveCue:()=>void;onResetCues:()=>void;cueMessage:string;
 scene:PerformSceneId;previewStatus:string;hardwareStatus:string;sourceLabel:string;unreadyReason:string;
 onRecovery:()=>void;canResume:boolean;
 sourceKind?:'webcam'|'phone'|'video'|'simulator'|null;
 cameraOk?:boolean;identityOk?:boolean;floorOk?:boolean;
 floorQaOk?:boolean;bodyQaOk?:boolean;
 onGoTrack?:()=>void;onGoMap?:()=>void;getTouchDesignerSnapshot:()=>TdSnapshot;
};

export function OperatorStageConsole({index,onPrevious,onNext,onExit,
 onBlackout,held,onHold,onResume,videoRecording,canRecordVideo,onRecordVideo,
 units,contacts,performerCount,cueGrid,activeSlot,onApplySlot,onUpdateSlot,
 onSaveCue,onResetCues,cueMessage,previewStatus,sourceLabel,
 unreadyReason,onRecovery,canResume,
 sourceKind=null,cameraOk=false,identityOk=false,floorOk=false,
 floorQaOk=false,bodyQaOk=false,onGoTrack,onGoMap,getTouchDesignerSnapshot}:Props){
 const dualSession=useSyncExternalStore(subscribeDualSurface,getDualSurfaceState,getDualSurfaceState);
 const [outputRouteMode,setOutputRouteMode]=useState<PerformOutputRouteMode>('soma');
 const [outputNotice,setOutputNotice]=useState('');
 const [popupBlocked,setPopupBlocked]=useState(false);
 const [outputDetailsOpen,setOutputDetailsOpen]=useState(false);

 const cue=operatorCueAt(index);
 const currentSlot=cueGrid.slots[activeSlot];
 const nextSlot=activeSlot+1<cueGrid.slots.length?cueGrid.slots[activeSlot+1]:null;
 const warning=units.filter(u=>['camera','identity','calibration'].includes(u.id)&&u.level!=='ok')
  .map(u=>u.title+': '+u.detail);

 const summary=evaluatePerformOutputSummary({
  hardwareEnabled:STAGE_HARDWARE_ENABLED,
  source:sourceKind,
  cameraOk,
  identityOk,
  floorOk,
  floorDevice:dualSession.devices.floor,
  bodyDevice:dualSession.devices.body,
  floorQaOk,
  bodyQaOk,
  operatorConfirm:dualSession.operatorConfirm
 });


 const isResolume=outputRouteMode==='resolume';
 const isTouchDesigner=outputRouteMode==='touchdesigner';
 const destination=presentPerformDestination({
  route:outputRouteMode,primary:summary.primaryAction,
  floor:summary.floorBadge,body:summary.bodyBadge
 });
 const handleRouteChange=(next:PerformOutputRouteMode)=>{
  if(!routeChangeRequiresBlackout(outputRouteMode,next))return;
  // Switching destinations cannot silently leave prior output illuminating the stage.
  blackoutAllDualSurfaces('Tujuan output diganti; verifikasi sebelum membuka ulang.');
  window.dispatchEvent(new Event('soma:td-blackout'));
  setOutputRouteMode(next);setOutputDetailsOpen(false);setPopupBlocked(false);
  setOutputNotice('');
 };

 const handleBlackoutAll=()=>{
  blackoutAllDualSurfaces('BLACKOUT dari Perform. Periksa cahaya proyektor secara fisik.');
  onBlackout();
  window.dispatchEvent(new Event('soma:td-blackout'));
  setOutputNotice('BLACKOUT diperintahkan ke semua jalur SOMA; TouchDesigner memerlukan gate lokal tersendiri.');
 };

 const handleOpenSurface=(surface:StageSurface)=>{
  const res=openDualSurfaceOutputWindow(surface,isResolume?'resolume':'soma');
  setPopupBlocked(res.popupBlocked);
  setOutputNotice(res.message);
 };

 const handleCopyFeedUrl=(surface:StageSurface)=>{
  const url=getDualSurfaceFeedUrl(surface,'resolume');
  if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){
   navigator.clipboard.writeText(url)
    .then(()=>setOutputNotice(`URL Clean Feed ${surface==='floor'?'FLOOR':'BODY'} disalin untuk Resolume / OBS.`))
    .catch(()=>setOutputNotice(`URL Feed ${surface==='floor'?'FLOOR':'BODY'}: ${url}`));
   return;
  }
  setOutputNotice(`URL Feed ${surface==='floor'?'FLOOR':'BODY'}: ${url}`);
 };

 const handleCloseSurface=(surface:StageSurface)=>{
  closeDualSurfaceOutputWindow(surface);
  setPopupBlocked(false);
  setOutputNotice(`Output ${surface==='floor'?'FLOOR':'BODY'} ditutup (Blackout).`);
 };

 const handlePrimaryAction=()=>{
  if(destination.kind==='info'){setOutputDetailsOpen(true);return;}
  if(isResolume){handleOpenSurface('floor');return;}
  const act=summary.primaryAction;
  if(act.kind==='open-output'||act.kind==='monitor-live'){
   handleOpenSurface(act.surface);return;
  }
  if(act.kind==='arm-live'){
   const res=armDualSurfaceLiveFromPerform(act.surface);
   setOutputNotice(res.message);return;
  }
  if(act.kind==='fix-setup'){
   if((!cameraOk||!identityOk)&&onGoTrack){onGoTrack();return;}
   if(onGoMap){onGoMap();return;}
   onRecovery();return;
  }
  if(onGoMap){onGoMap();return;}
  onRecovery();
 };

 return <>
  {/* Minimal single-line Perform header matching Track / Compose / Map rhythm */}
  <header className="fp-operator-heading">
   <div className="ops-r1-head-left">
    <h1>Perform</h1>
    <span className="ops-r1-head-meta">
     <span>{sourceLabel} · {performerCount}P</span>
    </span>
   </div>
   <div className="ops-r1-head-right">
    <button type="button" className="ops-r1-head-btn" onClick={onExit}>
     <Settings2 size={13}/> Edit Compose
    </button>
   </div>
  </header>

  <div className="ops-r1-console-shell">
   {/* Only the destination and operational status stay visible. Technical context lives behind Info/Detail. */}
   <section className="ops-r1-output-card" aria-label="Tujuan output">
    <div className="ops-r1-output-top">
     <strong>Output</strong>
     <button type="button" className="ops-r1-mini-help" aria-label="Bantuan tujuan output"
      title="Jenis keluaran SOMA, Resolume, dan TouchDesigner"
      aria-expanded={outputDetailsOpen} onClick={()=>setOutputDetailsOpen(value=>!value)}>
      <Info size={15} aria-hidden="true"/>
     </button>
    </div>
    <div className="ops-r1-route-toggle" role="group" aria-label="Jalur Output Perform">
     {PERFORM_DESTINATIONS.map(item=><button key={item.id} type="button"
      aria-pressed={outputRouteMode===item.id} aria-label={item.label}
      onClick={()=>handleRouteChange(item.id)} title={item.description}>
      {item.id==='soma'?<Monitor size={16} aria-hidden="true"/>:
       item.id==='resolume'?<Clapperboard size={16} aria-hidden="true"/>:
       <Waypoints size={16} aria-hidden="true"/>}
      <span>{item.label}</span>
     </button>)}
    </div>
    {isTouchDesigner?
     <TouchDesignerPerformPanel getSnapshot={getTouchDesignerSnapshot}
      activeSlot={activeSlot} cueLabel={cueGrid.slots[activeSlot].label} held={held}/>:
     <>
      <div key={outputRouteMode+destination.state} className="ops-r1-destination-status"
       data-tone={destination.tone} role="status" aria-live="polite">
       <span className="ops-r1-status-indicator" aria-hidden="true"/>
       <strong>{destination.state}</strong>
       <button type="button" className="ops-r1-mini-help" aria-label="Penjelasan status output"
        title={destination.hint} aria-expanded={outputDetailsOpen}
        onClick={()=>setOutputDetailsOpen(value=>!value)}>
        <Info size={15} aria-hidden="true"/>
       </button>
      </div>
      {destination.kind!=='info'&&<button type="button" className="ops-r1-primary-cta"
       data-kind={isResolume?'resolume-feed':summary.primaryAction.kind}
       onClick={handlePrimaryAction}>
       <Tv size={14}/>{destination.action}
      </button>}
      {(popupBlocked||outputNotice)&&<div className={popupBlocked?'ops-r1-recovery':'ops-r1-notice'}
       role={popupBlocked?'alert':'status'}>
       <span>{outputNotice}</span>
       {popupBlocked&&<button type="button" onClick={()=>handleOpenSurface('floor')}>Coba lagi</button>}
      </div>}
      <details className="ops-r1-output-details" open={outputDetailsOpen}
       onToggle={event=>setOutputDetailsOpen(event.currentTarget.open)}>
       <summary><span>Pengaturan</span><ChevronDown size={14} aria-hidden="true"/></summary>
       <div className="ops-r1-detail-content">
       <p className="ops-r1-destination-explain">{destination.hint}</p>
       <p>{PERFORM_DESTINATIONS.find(item=>item.id===outputRouteMode)?.description}</p>
       {!isResolume&&<p>{summary.primaryAction.detail}</p>}
       <div className="ops-r1-channel-row" role="group" aria-label="Channel output proyektor">
        {(['floor','body'] as const).map(surface=>{
         const badge=surface==='floor'?summary.floorBadge:summary.bodyBadge;
         const isFloor=surface==='floor';
         return <div key={surface} className="ops-r1-channel" data-tone={badge.tone}>
          <div className="ops-r1-channel-meta">
           <b>{isFloor?'FLOOR':'BODY'}</b>
           <span>{isResolume?(badge.opened?'Jendela terbuka':'Belum dibuka'):badge.status}</span>
          </div>
          <div className="ops-r1-channel-btns">
           <button type="button" disabled={!isResolume&&!STAGE_HARDWARE_ENABLED}
            onClick={()=>handleOpenSurface(surface)}>
            <ExternalLink size={11}/>{badge.opened?'Lihat':isResolume?'Buka Feed':'Buka'}
           </button>
           {isResolume&&<button type="button" className="ops-r1-copy-btn"
            aria-label={`Salin URL Feed Resolume ${isFloor?'FLOOR':'BODY'}`}
            title="Salin URL Clean Feed" onClick={()=>handleCopyFeedUrl(surface)}>
            <Copy size={11}/>URL
           </button>}
           {badge.opened&&<button type="button"
            aria-label={`Tutup output ${badge.label}`}
            onClick={()=>handleCloseSurface(surface)}><X size={11}/></button>}
          </div>
         </div>;
        })}
       </div>
       {!isResolume&&unreadyReason&&<div className="ops-r1-recovery">
        <span><ShieldAlert size={13}/>{unreadyReason}</span>
        <button type="button" onClick={onRecovery}>Map QA</button>
       </div>}
       <button type="button" className="ops-r1-detail-blackout" onClick={handleBlackoutAll}>
        <MonitorOff size={13}/>Blackout
       </button>
       </div>
      </details>
     </>}
   </section>

   {/* 2. Cue & Operator View (Active -> Next + 4 nearby cues; full 8-slot + editor + rec in collapsed drawer) */}
   <section className="ops-r1-cue-grid" aria-label="Cue presets · delapan slot">
    <div className="ops-r1-next-cue" aria-label="Ringkasan cue aktif dan berikutnya">
     <div className="ops-r1-cue-now">
      <small>AKTIF</small>
      <strong>{currentSlot.label}</strong>
     </div>
     <ArrowRight size={14} className="ops-r1-cue-arrow" aria-hidden="true"/>
     <div className="ops-r1-cue-upnext">
      <small>BERIKUTNYA</small>
      <strong>{nextSlot?nextSlot.label:'Selesai'}</strong>
     </div>
    </div>

    <div className="ops-r1-cue-transport" role="group" aria-label="Kontrol tampilan operator">
     <button type="button" onClick={onPrevious} disabled={activeSlot===0}
      title="Tampilan sebelumnya (←)" aria-label="Tampilan sebelumnya">
      <ArrowLeft size={14}/>Sebelumnya
     </button>
     <button type="button" onClick={onNext} disabled={activeSlot===cueGrid.slots.length-1}
      title="Tampilan berikutnya (Space atau →)"
      className="fp-operator-go">Berikutnya <ArrowRight size={14}/></button>
    </div>
    <details className="ops-r1-cue-editor">
     <summary><span>8 cue · pengaturan</span><ChevronDown size={14} aria-hidden="true"/></summary>
     <div className="ops-r1-cue-detail-body">
     <p className="ops-r1-cue-scope">{performCueScope(outputRouteMode)}</p>
     <div className="ops-r1-all-slots">
      {cueGrid.slots.map((slot,i)=><button type="button" key={slot.id}
       className="ops-r1-slot ops-r1-slot-mini" aria-pressed={activeSlot===i}
       onClick={()=>onApplySlot(i)}>
       <small>{String(i+1).padStart(2,'0')}</small><b>{slot.label}</b>
       <em>{slot.view.toUpperCase()}</em>
      </button>)}
     </div>
     <label>Nama cue aktif<input type="text" maxLength={44}
      value={cueGrid.slots[activeSlot].label}
      onChange={e=>onUpdateSlot(activeSlot,{label:e.target.value})}/></label>
     <label>Layout monitor<select value={cueGrid.slots[activeSlot].view}
      onChange={e=>onUpdateSlot(activeSlot,{view:e.target.value as PerformView})}>
      {PERFORM_VIEWS.map(view=><option key={view} value={view}>{view.toUpperCase()}</option>)}
     </select></label>
     <div className="ops-r1-cue-actions">
      <button type="button" onClick={held?onResume:onHold}
       disabled={held&&!canResume} aria-pressed={held}>
       {held?<Play size={12}/>:<Pause size={12}/>}
       {held?'Lanjutkan Preview':'Tahan Preview'}
      </button>
      <button type="button" onClick={onSaveCue}>Simpan cue lokal</button>
      <button type="button" onClick={onResetCues}>Reset default</button>
      <button type="button" onClick={onRecordVideo}
       disabled={!videoRecording&&!canRecordVideo}
       aria-pressed={videoRecording} className={videoRecording?'fp-operator-rec':''}>
       <Circle size={12} fill={videoRecording?'currentColor':'none'}/>
       {videoRecording?'Stop REC':'Rekam'}
      </button>
     </div>
     {warning.length>0&&<div className="fp-operator-health" role="status" aria-live="polite">
      <strong>{warning[0]}{warning.length>1?' · +'+(warning.length-1)+' catatan':''}</strong>
     </div>}
     <small>{cueMessage||'Cue monitor tidak mengubah izin proyektor; Map tetap berlaku.'}</small>
     <small className="ops-r1-keyboard-help">Pintasan: <kbd className="ops-r1-kbd">Space</kbd> berikutnya ·
      <kbd className="ops-r1-kbd">←</kbd> sebelumnya ·
      <kbd className="ops-r1-kbd">B / Esc</kbd> Blackout</small>
     </div>
    </details>
   </section>

   {/* Blackout remains persistently available in the global SOMA header.
       Physical switching, browser disconnect and TD all remain fail-closed. */}
  </div>
 </>;
}
