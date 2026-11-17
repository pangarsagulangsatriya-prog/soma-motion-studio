import {ArrowLeft,ArrowRight,Circle,MonitorOff,Pause,Play,Settings2} from 'lucide-react';
import {OPERATOR_CUES,operatorCueAt} from './OperatorStageModel.ts';
import type {UnifiedUnit} from './unifiedStageStatus.ts';

type Props={
 index:number;onPrevious:()=>void;onNext:()=>void;onSelect:(index:number)=>void;
 onExit:()=>void;onBlackout:()=>void;
 held:boolean;onHold:()=>void;onResume:()=>void;
 videoRecording:boolean;canRecordVideo:boolean;onRecordVideo:()=>void;
 units:UnifiedUnit[];contacts:number;performerCount:1|2;
};
export function OperatorStageConsole({index,onPrevious,onNext,onSelect,onExit,
 onBlackout,held,onHold,onResume,videoRecording,canRecordVideo,onRecordVideo,
 units,contacts,performerCount}:Props){
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
  <div className="fp-operator-health" role="status" aria-live="polite">
   <span>{performerCount} performer</span>
   <span>{contacts} kontak</span>
   {warning.length>0?<strong>{warning[0]}{warning.length>1?' · +'+(warning.length-1)+' peringatan':''}</strong>
    :<strong>Tracking utama siap menurut telemetry software</strong>}
  </div>
  <nav className="fp-operator-cues" aria-label="Cue monitor operator">
   {OPERATOR_CUES.map((q,i)=><button key={q.id} type="button"
    aria-pressed={i===index} title={q.description} onClick={()=>onSelect(i)}>
     {q.name}</button>)}
  </nav>
  <div className="fp-operator-dock" role="toolbar" aria-label="Operator performance controls">
   <div className="fp-operator-dock-group">
    <button type="button" onClick={onPrevious} disabled={index===0}>
     <ArrowLeft size={17}/> Sebelumnya</button>
    <button type="button" onClick={onNext} disabled={index===OPERATOR_CUES.length-1}
     className="fp-operator-go">GO · Cue Berikutnya <ArrowRight size={18}/></button>
   </div>
   <div className="fp-operator-dock-group">
    <button type="button" onClick={held?onResume:onHold}
     aria-pressed={held} className={held?'fp-operator-hold-active':''}>
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
  <p className="fp-operator-hotkeys">Shortcut: <kbd>Space</kbd> / <kbd>→</kbd> cue berikutnya ·
   <kbd>←</kbd> sebelumnya · <kbd>B</kbd> / <kbd>Esc</kbd> Blackout.
   Tombol Blackout mengirim perintah software; matikan proyektor fisik saat darurat.</p>
 </>;
}
