import {ArrowLeft,ArrowRight,Circle,MonitorOff,Pause,Play,Settings2} from 'lucide-react';
import {OPERATOR_CUES,operatorCueAt} from './OperatorStageModel.ts';
import type {UnifiedUnit} from './unifiedStageStatus.ts';
import {PERFORM_SCENES,PERFORM_VIEWS,type PerformCueGrid,type PerformSceneId,type PerformView} from './performCueModel.ts';
import './ops-r1-perform.css';

type Props={
 index:number;onPrevious:()=>void;onNext:()=>void;onSelect:(index:number)=>void;
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
export function OperatorStageConsole({index,onPrevious,onNext,onSelect,onExit,
 onBlackout,held,onHold,onResume,videoRecording,canRecordVideo,onRecordVideo,
 units,contacts,performerCount,cueGrid,activeSlot,onApplySlot,onUpdateSlot,
 onSaveCue,onResetCues,cueMessage,scene,previewStatus,hardwareStatus,sourceLabel,
 unreadyReason,onRecovery,canResume}:Props){
 const cue=operatorCueAt(index);
 const warning=units.filter(u=>['camera','identity','calibration'].includes(u.id)&&u.level!=='ok')
  .map(u=>u.title+': '+u.detail);
 return <>
  <div className="fp-operator-heading">
   <div>
    <span>FOOTPRINTS / PERFORM · LOCAL MONITOR</span>
    <h2>{cue.name} <small>{cue.description}</small></h2>
    <p>Perubahan cue hanya mengatur tampilan monitor. Output proyektor tetap mengikuti persetujuan QA terpisah.</p>
   </div>
   <button type="button" onClick={onExit}><Settings2 size={16}/> Kembali Build</button>
  </div>
  <div className="ops-r1-status" role="status" aria-live="polite">
   <div><small>ACTIVE SOURCE</small><strong>{sourceLabel}</strong></div>
   <div><small>SCENE / SOFTWARE</small><strong>{scene}</strong></div>
   <div><small>TRACKING</small><strong>{previewStatus}</strong></div>
   <div><small>HARDWARE</small><strong>{hardwareStatus}</strong></div>
  </div>
  {unreadyReason&&<div className="ops-r1-recovery" role="alert">
   <span>{unreadyReason}</span><button type="button" onClick={onRecovery}>Periksa sumber / Map QA</button>
  </div>}
  <section className="ops-r1-cue-grid" aria-label="Cue presets · delapan slot">
   <header><strong>PERFORM CUE GRID</strong><span>GO menerapkan scene dan tata letak preview; proyektor tetap mengikuti QA Map.</span></header>
   <div className="ops-r1-cue-slots">
    {cueGrid.slots.map((slot,i)=><button type="button" key={slot.id}
     className="ops-r1-slot" aria-pressed={activeSlot===i}
     onClick={()=>onApplySlot(i)}
     title={'GO '+slot.label+' · '+slot.scene+' · '+slot.view}>
     <small>{String(i+1).padStart(2,'0')}</small><b>{slot.label}</b>
     <span>{slot.scene}</span><em>{slot.view.toUpperCase()}</em>
    </button>)}
   </div>
   <details className="ops-r1-cue-editor"><summary>Edit cue {activeSlot+1} · preset lokal</summary>
    <label>Nama cue<input type="text" maxLength={44}
     value={cueGrid.slots[activeSlot].label}
     onChange={e=>onUpdateSlot(activeSlot,{label:e.target.value})}/></label>
    <label>Scene<select value={cueGrid.slots[activeSlot].scene}
     onChange={e=>onUpdateSlot(activeSlot,{scene:e.target.value as PerformSceneId})}>
     {PERFORM_SCENES.map(id=><option key={id} value={id}>{id}</option>)}
    </select></label>
    <label>Preview<select value={cueGrid.slots[activeSlot].view}
     onChange={e=>onUpdateSlot(activeSlot,{view:e.target.value as PerformView})}>
     {PERFORM_VIEWS.map(view=><option key={view} value={view}>{view.toUpperCase()}</option>)}
    </select></label>
    <div className="ops-r1-cue-actions">
     <button type="button" onClick={onSaveCue}>Simpan cue lokal</button>
     <button type="button" onClick={onResetCues}>Reset default</button>
    </div>
    <small>{cueMessage||'Profil cue hanya menyimpan scene dan preview. Izin cahaya tidak tersimpan.'}</small>
   </details>
  </section>
  <div className="fp-operator-health" role="status" aria-live="polite">
   <span>{performerCount} performer</span>
   <span>{contacts} kontak</span>
   {warning.length>0?<strong>{warning[0]}{warning.length>1?' · +'+(warning.length-1)+' peringatan':''}</strong>
    :<strong>Tracking utama siap menurut telemetry software</strong>}
  </div>
  <nav className="fp-operator-cues" aria-label="Pilihan layout monitor operator">
   {OPERATOR_CUES.map((q,i)=><button key={q.id} type="button"
    aria-pressed={i===index} title={q.description} onClick={()=>onSelect(i)}>
     {q.name}</button>)}
  </nav>
  <div className="fp-operator-dock" role="toolbar" aria-label="Operator performance controls">
   <div className="fp-operator-dock-group">
    <button type="button" onClick={onPrevious} disabled={activeSlot===0}>
     <ArrowLeft size={17}/> Sebelumnya</button>
    <button type="button" onClick={onNext} disabled={activeSlot===cueGrid.slots.length-1}
     className="fp-operator-go">GO · Cue Berikutnya <ArrowRight size={18}/></button>
   </div>
   <div className="fp-operator-dock-group">
    <button type="button" onClick={held?onResume:onHold}
     disabled={held&&!canResume} aria-pressed={held} className={held?'fp-operator-hold-active':''}>
     {held?<Play size={17}/>:<Pause size={17}/>}
     {held?'Resume Preview':'Hold Preview'}</button>
    <button type="button" onClick={onRecordVideo}
     disabled={!videoRecording&&!canRecordVideo}
     aria-pressed={videoRecording} className={videoRecording?'fp-operator-rec':''}>
     <Circle size={16} fill={videoRecording?'currentColor':'none'}/>
     {videoRecording?'Stop REC':'Rekam'}</button>
   </div>
   <button type="button" className="fp-operator-blackout" onClick={onBlackout}>
    <MonitorOff size={19}/> BLACKOUT</button>
  </div>
  <p className="ops-r1-guard">Profil panggung dapat dipilih lagi melalui Map. Memuat cue tidak mengaktifkan output fisik atau memulihkan persetujuan QA.</p>
  <p className="fp-operator-hotkeys">Shortcut: <kbd>Space</kbd> / <kbd>→</kbd> cue berikutnya ·
   <kbd>←</kbd> sebelumnya · <kbd>B</kbd> / <kbd>Esc</kbd> Blackout.
   Tombol Blackout mengirim perintah software; matikan proyektor fisik saat darurat.</p>
 </>;
}
