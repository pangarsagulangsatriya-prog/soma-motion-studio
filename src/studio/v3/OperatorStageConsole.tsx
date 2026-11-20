import {ArrowLeft,ArrowRight,Circle,MonitorOff,Pause,Play,Settings2} from 'lucide-react';
import {operatorCueAt} from './OperatorStageModel.ts';
import type {UnifiedUnit} from './unifiedStageStatus.ts';
import {PERFORM_VIEWS,type PerformCueGrid,type PerformSceneId,type PerformView} from './performCueModel.ts';
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
};
export function OperatorStageConsole({index,onPrevious,onNext,onExit,
 onBlackout,held,onHold,onResume,videoRecording,canRecordVideo,onRecordVideo,
 units,contacts,performerCount,cueGrid,activeSlot,onApplySlot,onUpdateSlot,
 onSaveCue,onResetCues,cueMessage,previewStatus,hardwareStatus,sourceLabel,
 unreadyReason,onRecovery,canResume}:Props){
 const cue=operatorCueAt(index);
 const warning=units.filter(u=>['camera','identity','calibration'].includes(u.id)&&u.level!=='ok')
  .map(u=>u.title+': '+u.detail);
 return <div className="ops-r1-console-shell">
  <div className="fp-operator-heading">
   <div>
    <span>STAGE 1 · PERFORM</span>
    <h2>Perform <small>{cue.name} · {cue.description}</small></h2>
   </div>
   <button type="button" onClick={onExit}><Settings2 size={15}/> Edit Compose</button>
  </div>
  <div className="ops-r1-status" role="status" aria-live="polite">
   <div><small>SUMBER</small><strong>{sourceLabel}</strong></div>
   <div><small>PELACAKAN</small><strong>{previewStatus}</strong></div>
   <div><small>PROYEKTOR</small><strong>{hardwareStatus}</strong></div>
   <div><small>KONTAK</small><strong>{performerCount} performer · {contacts} kontak</strong></div>
  </div>
  {unreadyReason&&<div className="ops-r1-recovery" role="alert">
   <span>{unreadyReason}</span><button type="button" onClick={onRecovery}>Periksa sumber / Map QA</button>
  </div>}
  <section className="ops-r1-cue-grid" aria-label="Cue presets · delapan slot">
   <header><strong>CUE PANGGUNG</strong><span>Pilih cue untuk mengganti layout monitor. QA output di Map tetap berlaku terpisah.</span></header>
   <div className="ops-r1-cue-slots">
    {cueGrid.slots.map((slot,i)=><button type="button" key={slot.id}
     className="ops-r1-slot" aria-pressed={activeSlot===i} aria-label={'Jalankan '+slot.label+', layout '+slot.view}
     onClick={()=>onApplySlot(i)}
     title={'GO '+slot.label+' · '+slot.view}>
     <small>{String(i+1).padStart(2,'0')}</small><b>{slot.label}</b>
     <em>{slot.view.toUpperCase()}</em>
    </button>)}
   </div>
   <details className="ops-r1-cue-editor"><summary>Edit cue {activeSlot+1} · preset lokal</summary>
    <label>Nama cue<input type="text" maxLength={44}
     value={cueGrid.slots[activeSlot].label}
     onChange={e=>onUpdateSlot(activeSlot,{label:e.target.value})}/></label>
    <label>Layout monitor<select value={cueGrid.slots[activeSlot].view}
     onChange={e=>onUpdateSlot(activeSlot,{view:e.target.value as PerformView})}>
     {PERFORM_VIEWS.map(view=><option key={view} value={view}>{view.toUpperCase()}</option>)}
    </select></label>
    <div className="ops-r1-cue-actions">
     <button type="button" onClick={onSaveCue}>Simpan cue lokal</button>
     <button type="button" onClick={onResetCues}>Reset default</button>
    </div>
    <small>{cueMessage||'Cue hanya menyimpan layout monitor. Izin cahaya proyektor tetap di Map.'}</small>
   </details>
  </section>
  {warning.length>0&&<div className="fp-operator-health" role="status" aria-live="polite">
   <strong>{warning[0]}{warning.length>1?' · +'+(warning.length-1)+' catatan':''}</strong>
  </div>}
  <div className="fp-operator-dock" role="toolbar" aria-label="Kontrol Perform">
   <div className="fp-operator-dock-group">
    <button type="button" onClick={onPrevious} disabled={activeSlot===0}>
     <ArrowLeft size={16}/> Prev</button>
    <button type="button" onClick={onNext} disabled={activeSlot===cueGrid.slots.length-1}
     className="fp-operator-go">GO · Berikutnya <ArrowRight size={17}/></button>
   </div>
   <div className="fp-operator-dock-group">
    <button type="button" onClick={held?onResume:onHold}
     disabled={held&&!canResume} aria-pressed={held} className={held?'fp-operator-hold-active':''}>
     {held?<Play size={16}/>:<Pause size={16}/>}
     {held?'Lanjutkan Preview':'Tahan Preview'}</button>
    <button type="button" onClick={onRecordVideo}
     disabled={!videoRecording&&!canRecordVideo}
     aria-pressed={videoRecording} className={videoRecording?'fp-operator-rec':''}>
     <Circle size={15} fill={videoRecording?'currentColor':'none'}/>
     {videoRecording?'Stop REC':'Rekam'}</button>
   </div>
   <button type="button" className="fp-operator-blackout" onClick={onBlackout}>
    <MonitorOff size={17}/> BLACKOUT</button>
  </div>
  <p className="fp-operator-hotkeys">Shortcut: <kbd>Space</kbd> / <kbd>→</kbd> GO · <kbd>←</kbd> Prev · <kbd>B</kbd> / <kbd>Esc</kbd> Blackout · Memuat cue tidak mengubah QA proyektor fisik.</p>
 </div>;
}
