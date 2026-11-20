import {useState,useSyncExternalStore} from 'react';
import {
 ArrowLeft,ArrowRight,Circle,Copy,ExternalLink,MonitorOff,Pause,Play,
 Settings2,ShieldAlert,Tv,X
} from 'lucide-react';
import {operatorCueAt} from './OperatorStageModel.ts';
import type {UnifiedUnit} from './unifiedStageStatus.ts';
import {PERFORM_VIEWS,type PerformCueGrid,type PerformSceneId,type PerformView} from './performCueModel.ts';
import {evaluatePerformOutputSummary,type PerformOutputRouteMode} from './performOutputModel.ts';
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

 // Keep default Perform uncluttered: show 4 nearby cues around activeSlot; full 8 slots inside collapsible Detail drawer.
 const windowStart=Math.max(0,Math.min(cueGrid.slots.length-4,activeSlot-1));
 const visibleIndices=[windowStart,windowStart+1,windowStart+2,windowStart+3].filter(i=>i<cueGrid.slots.length);

 const isResolume=outputRouteMode==='resolume';
 const isTouchDesigner=outputRouteMode==='touchdesigner';

 const handleBlackoutAll=()=>{
  blackoutAllDualSurfaces('BLACKOUT dari Perform. Periksa cahaya proyektor secara fisik.');
  onBlackout();
  window.dispatchEvent(new Event('soma:td-blackout'));
  setOutputNotice('BLACKOUT diperintahkan ke semua jalur SOMA; TouchDesigner memerlukan gate lokal tersendiri.');
 };

 const handleOpenSurface=(surface:StageSurface)=>{
  const res=openDualSurfaceOutputWindow(surface,outputRouteMode);
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
  if(isResolume){
   handleOpenSurface('floor');
   return;
  }
  const act=summary.primaryAction;
  if(act.kind==='open-output'||act.kind==='monitor-live'){
   handleOpenSurface(act.surface);
   return;
  }
  if(act.kind==='arm-live'){
   const res=armDualSurfaceLiveFromPerform(act.surface);
   setOutputNotice(res.message);
   return;
  }
  if(act.kind==='fix-setup'||act.kind==='preview-only'){
   if((!cameraOk||!identityOk||act.kind==='preview-only')&&onGoTrack){onGoTrack();return;}
   if(onGoMap){onGoMap();return;}
   onRecovery();
   return;
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
     <b className="ops-r1-global-pill" data-tone={summary.globalStatus.tone}>{summary.globalStatus.label}</b>
     <span>· {sourceLabel} · {performerCount}P · {contacts} kontak</span>
    </span>
   </div>
   <div className="ops-r1-head-right">
    <span className="ops-r1-surface-badge" data-tone={summary.floorBadge.tone}>
     FLOOR {summary.floorBadge.status}
    </span>
    <span className="ops-r1-surface-badge" data-tone={summary.bodyBadge.tone}>
     BODY {summary.bodyBadge.status}
    </span>
    <button type="button" className="ops-r1-head-btn" onClick={onExit}>
     <Settings2 size={13}/> Edit Compose
    </button>
   </div>
  </header>

  <div className="ops-r1-console-shell">
   {/* 1. Direct Output Control (SOMA Direct or Feed Resolume + FLOOR/BODY handoff) */}
   <section className="ops-r1-output-card" aria-label="Kontrol Output Proyektor">
    <div className="ops-r1-output-top">
     <strong>Output Proyektor</strong>
     <div className="ops-r1-route-toggle" role="group" aria-label="Jalur Output Perform">
      <button type="button" aria-pressed={outputRouteMode==='soma'} onClick={()=>{setOutputRouteMode('soma');setOutputNotice('');}}>
       SOMA Direct
      </button>
      <button type="button" aria-pressed={isResolume} onClick={()=>{setOutputRouteMode('resolume');setOutputNotice('');}}>
       Feed Resolume
      </button>
      <button type="button" aria-pressed={isTouchDesigner} onClick={()=>{setOutputRouteMode('touchdesigner');setOutputNotice('');}}>
       TouchDesigner
      </button>
     </div>
    </div>
    {isTouchDesigner?
     <TouchDesignerPerformPanel getSnapshot={getTouchDesignerSnapshot}
      activeSlot={activeSlot} cueLabel={cueGrid.slots[activeSlot].label} held={held}/>:
     <>
    <button type="button"
     className="ops-r1-primary-cta"
     data-kind={isResolume?'resolume-feed':summary.primaryAction.kind}
     onClick={handlePrimaryAction}>
     <Tv size={14}/> {isResolume
      ?(summary.floorBadge.opened?'Lihat Clean Feed Resolume (FLOOR)':'Buka Clean Feed Resolume (FLOOR)')
      :summary.primaryAction.label}
    </button>
    <p className="ops-r1-output-hint">
     {isResolume
      ?'16:9 hitam bersih (Luma Key / Add). Tangkap di Resolume Arena via Window Capture / Browser Source / OBS / Spout / Syphon.'
      :`${previewStatus} · ${summary.primaryAction.detail}`}
    </p>

    <div className="ops-r1-channel-row" role="group" aria-label="Channel output proyektor">
     {(['floor','body'] as const).map(surface=>{
      const badge=surface==='floor'?summary.floorBadge:summary.bodyBadge;
      const isFloor=surface==='floor';
      return <div key={surface} className="ops-r1-channel" data-tone={badge.tone}>
       <div className="ops-r1-channel-meta">
        <b>{isFloor?'FLOOR':'BODY'}</b>
        <span>{isResolume?(badge.opened?'Feed aktif':'Clean 16:9'):badge.status}</span>
       </div>
       <div className="ops-r1-channel-btns">
        <button type="button"
         disabled={!isResolume&&!STAGE_HARDWARE_ENABLED}
         onClick={()=>handleOpenSurface(surface)}>
         <ExternalLink size={11}/> {badge.opened?'Lihat':(isResolume?'Buka Feed':'Buka')}
        </button>
        {isResolume&&<button type="button"
         className="ops-r1-copy-btn"
         aria-label={`Salin URL Feed Resolume ${isFloor?'FLOOR':'BODY'}`}
         title="Salin URL Clean Feed"
         onClick={()=>handleCopyFeedUrl(surface)}>
         <Copy size={11}/> URL
        </button>}
        {badge.opened&&<button type="button"
         aria-label={`Tutup output ${badge.label}`}
         onClick={()=>handleCloseSurface(surface)}>
         <X size={11}/>
        </button>}
       </div>
      </div>;
     })}
    </div>

    {(popupBlocked||outputNotice)&&<div className={popupBlocked?'ops-r1-recovery':'ops-r1-notice'} role={popupBlocked?'alert':'status'}>
     <span>{outputNotice}</span>
     {popupBlocked&&<button type="button" onClick={()=>handleOpenSurface('floor')}>Coba lagi</button>}
    </div>}

    {unreadyReason&&!popupBlocked&&!isResolume&&<div className="ops-r1-recovery" role="alert">
     <span><ShieldAlert size={13}/> {unreadyReason}</span>
     <button type="button" onClick={onRecovery}>Map QA</button>
    </div>}
     </>}
   </section>

   {/* 2. Cue & Operator View (Active -> Next + 4 nearby cues; full 8-slot + editor + rec in collapsed drawer) */}
   <section className="ops-r1-cue-grid" aria-label="Cue presets · delapan slot">
    <div className="ops-r1-next-cue" aria-label="Ringkasan cue aktif dan berikutnya">
     <div className="ops-r1-cue-now">
      <small>AKTIF</small>
      <strong>{String(activeSlot+1).padStart(2,'0')} · {currentSlot.label}</strong>
      <span>{currentSlot.view.toUpperCase()} · {cue.name}</span>
     </div>
     <ArrowRight size={14} className="ops-r1-cue-arrow" aria-hidden="true"/>
     <div className="ops-r1-cue-upnext">
      <small>BERIKUTNYA</small>
      <strong>{nextSlot?String(activeSlot+2).padStart(2,'0')+' · '+nextSlot.label:'Akhir daftar cue'}</strong>
      <span>{nextSlot?nextSlot.view.toUpperCase():'—'}</span>
     </div>
    </div>

    <header className="ops-r1-cue-head">
     <strong>TAMPILAN &amp; CUE</strong>
     <span>Pilih cue untuk mengganti layout monitor. QA output di Map tetap berlaku terpisah.</span>
    </header>

    <div className="ops-r1-cue-slots">
     {visibleIndices.map(i=>{
      const slot=cueGrid.slots[i];
      return <button type="button" key={slot.id}
       className="ops-r1-slot" aria-pressed={activeSlot===i} data-next={activeSlot+1===i||undefined}
       aria-label={'Jalankan '+slot.label+', layout '+slot.view}
       onClick={()=>onApplySlot(i)}
       title={'GO '+slot.label+' · '+slot.view}>
       <small>{String(i+1).padStart(2,'0')}</small><b>{slot.label}</b>
       <em>{slot.view.toUpperCase()}</em>
      </button>;
     })}
    </div>

    <details className="ops-r1-cue-editor">
     <summary>Detail · Semua 8 cue, edit &amp; rekam</summary>
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
     <small>{cueMessage||'Cue hanya menyimpan layout monitor. Izin cahaya proyektor tetap di Map.'}</small>
    </details>
   </section>

   {/* 3. Compact Transport Bar */}
   <div className="fp-operator-dock" role="toolbar" aria-label="Kontrol Perform">
    <div className="fp-operator-dock-group">
     <button type="button" onClick={onPrevious} disabled={activeSlot===0}>
      <ArrowLeft size={14}/> Prev <kbd className="ops-r1-kbd">←</kbd>
     </button>
     <button type="button" onClick={onNext} disabled={activeSlot===cueGrid.slots.length-1}
      className="fp-operator-go">
      GO · Berikutnya <kbd className="ops-r1-kbd">Space</kbd> <ArrowRight size={14}/>
     </button>
    </div>
    <div className="fp-operator-dock-group">
     <button type="button" onClick={held?onResume:onHold}
      disabled={held&&!canResume} aria-pressed={held} className={held?'fp-operator-hold-active':''}>
      {held?<Play size={14}/>:<Pause size={14}/>}
      {held?'Lanjutkan Preview':'Tahan Preview'}
     </button>
     <button type="button" className="fp-operator-blackout" onClick={handleBlackoutAll}>
      <MonitorOff size={15}/> BLACKOUT <kbd className="ops-r1-kbd">B</kbd>
     </button>
    </div>
   </div>
   <p className="fp-operator-hotkeys">
    <kbd>Space</kbd>/<kbd>→</kbd> GO · <kbd>←</kbd> Prev · <kbd>B</kbd>/<kbd>Esc</kbd> Blackout
   </p>
  </div>
 </>;
}
