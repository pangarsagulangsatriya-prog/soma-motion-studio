import {useEffect,useRef,useState} from 'react';
import {Check,ClipboardCheck,Download,RotateCcw,AlertTriangle,X} from 'lucide-react';
import type {FootprintsInputStatus} from './sourceSwitchModel.ts';
import type {InlineSetupHint} from './inlineSetupModel.ts';
import {BEGINNER_TASKS,beginnerUsabilityReport,classifySourceTransition,
 summarizeBeginnerUsability,type BeginnerOutcome,type BeginnerEvent,
 type BeginnerTaskResult} from './beginnerUsabilityModel.ts';
import {download} from '../../engine/recording.ts';
import './beginner-usability.css';

type Props={
 hidden:boolean;status:FootprintsInputStatus;hint:InlineSetupHint;
 previewReady:boolean;onClose:()=>void;
};
export function BeginnerUsabilityLab({hidden,status,hint,previewReady,onClose}:Props){
 const [startedAt,setStartedAt]=useState<string|null>(null);
 const [taskIndex,setTaskIndex]=useState(0);
 const [running,setRunning]=useState(false);
 const [finished,setFinished]=useState(false);
 const [assisted,setAssisted]=useState(false);
 const [note,setNote]=useState('');
 const [results,setResults]=useState<BeginnerTaskResult[]>([]);
 const [events,setEvents]=useState<BeginnerEvent[]>([]);
 const sessionStartRef=useRef(0);
 const taskStartRef=useRef(0);
 const previousRef=useRef({selection:status.selection,phase:status.phase});
 const snapshot={selection:status.selection,phase:status.phase};
 const task=BEGINNER_TASKS[taskIndex];
 const summary=summarizeBeginnerUsability(results,events);

 useEffect(()=>{
  const previous=previousRef.current;
  previousRef.current={selection:status.selection,phase:status.phase};
  if(!running)return;
  const next=classifySourceTransition(previous,
   {selection:status.selection,phase:status.phase},
   performance.now()-sessionStartRef.current);
  if(next.length)setEvents(old=>[...old,...next].slice(-200));
 },[status.selection,status.phase,running]);

 const start=()=>{
  const now=performance.now();
  sessionStartRef.current=now;taskStartRef.current=now;
  previousRef.current=snapshot;
  setStartedAt(new Date().toISOString());
  setResults([]);setEvents([]);
  setTaskIndex(0);setAssisted(false);setNote('');
  setFinished(false);setRunning(true);
 };
 const record=(outcome:BeginnerOutcome)=>{
  if(!running||finished)return;
  const elapsedMs=Math.max(0,Math.round(performance.now()-taskStartRef.current));
  const entry:BeginnerTaskResult={
   task:task.id,outcome,elapsedMs,assisted,note:note.trim().slice(0,240)
  };
  setResults(prev=>[...prev,entry]);
  setNote('');setAssisted(false);taskStartRef.current=performance.now();
  if(taskIndex>=BEGINNER_TASKS.length-1){setFinished(true);setRunning(false);}
  else setTaskIndex(i=>i+1);
 };
 const end=()=>{setRunning(false);setFinished(true);};
 const exportSession=()=>{
  if(!startedAt)return;
  const report=beginnerUsabilityReport({
   startedAt,endedAt:new Date().toISOString(),
   results,events,unfinished:results.length<BEGINNER_TASKS.length
  });
  download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),
   'SOMA-S6-8-6-beginner-usability.json');
 };

 return <section className="fp-usability" hidden={hidden}
  aria-label="S6.8.6 — Uji penggunaan pertama" data-running={running}
  data-finished={finished}>
  <div className="fp-usability-head">
   <div><small>OBSERVASI · S6.8.6</small><h2>Uji Pemula</h2>
    <p>Empat tugas untuk satu pengguna baru. Moderator mengamati, pengguna menjalankan SOMA.</p>
   </div>
   <button type="button" className="fp-usability-close" onClick={onClose}
    aria-label="Tutup panel Uji Pemula"><X size={17}/></button>
  </div>
  <div className="fp-usability-readout" role="status">
   <span>Sumber: <b>{status.selection??'belum dipilih'}</b> · {status.phase}</span>
   <span>Stage Preview: <b>{previewReady?'tersedia':'menunggu sumber'}</b></span>
   <span>Petunjuk SOMA: <b>{hint.title}</b></span>
  </div>
  {!startedAt?<div className="fp-usability-intro">
   <p>Minta peserta memakai aplikasi seperti biasa. Catat hambatan, waktu tugas, dan bantuan yang dibutuhkan.
    Hanya jenis sumber, status koneksi, durasi, dan catatan moderator yang disimpan dalam sesi browser ini.</p>
   <button type="button" className="fp-usability-primary" onClick={start}>
    <ClipboardCheck size={16}/> Mulai sesi observasi
   </button>
  </div>:<>
   <div className="fp-usability-steps" aria-label="Kemajuan tugas">
    {BEGINNER_TASKS.map((item,i)=><span key={item.id}
     data-state={i<results.length?'done':i===taskIndex&&running?'current':'waiting'}
     title={item.title}>{i+1}</span>)}
   </div>
   {running&&<div className="fp-usability-task" data-task={task.id}>
    <div className="fp-usability-task-title"><small>TUGAS {taskIndex+1} / {BEGINNER_TASKS.length}</small>
     <h3>{task.title}</h3></div>
    <p>{task.instruction}</p>
    <small>Amati: {task.check}</small>
    <label className="fp-usability-help">
     <input type="checkbox" checked={assisted} onChange={e=>setAssisted(e.target.checked)}/>
     Peserta meminta bantuan moderator
    </label>
    <label className="fp-usability-note">Catatan hambatan (opsional, hindari data pribadi)
     <textarea value={note} maxLength={240} rows={2}
      placeholder="Contoh: tombol INPUT tidak terlihat; butuh dua kali mencoba"
      onChange={e=>setNote(e.target.value)}/></label>
    <div className="fp-usability-actions">
     <button type="button" className="fp-usability-primary" onClick={()=>record('success')}>
      <Check size={15}/> Berhasil</button>
     <button type="button" onClick={()=>record('difficulty')}>
      <AlertTriangle size={15}/> Ada kendala</button>
     <button type="button" onClick={()=>record('skipped')}>Lewati</button>
    </div>
   </div>}
   {finished&&<p className="fp-usability-finished" role="status">
    Sesi ditutup. Hasil berasal dari penilaian moderator, bukan verifikasi otomatis tindakan pengguna.
   </p>}
   <div className="fp-usability-summary">
    <span>Tugas selesai <b>{summary.tasksPassed}/{BEGINNER_TASKS.length}</b></span>
    <span>Kendala <b>{summary.tasksWithDifficulty}</b></span>
    <span>Bantuan <b>{summary.assistedTasks}</b></span>
    <span>Perpindahan sumber <b>{summary.sourceChanges}</b></span>
    <span>Error / pemulihan <b>{summary.connectionErrors} / {summary.sameSourceRecoveries+summary.alternativeSourceFallbacks}</b></span>
   </div>
   <div className="fp-usability-end">
    {running&&<button type="button" onClick={end}>Akhiri sesi sekarang</button>}
    <button type="button" onClick={exportSession}><Download size={15}/> Ekspor hasil JSON</button>
    <button type="button" onClick={start}><RotateCcw size={15}/> Ulangi sesi</button>
   </div>
  </>}
  <p className="fp-usability-disclaimer">Pengujian ini tidak merekam gambar, suara, identitas, atau isi video.
   Catatan tetap di memori browser selama halaman terbuka; ekspor dilakukan manual.
   Untuk menguji pemulihan, hindari mencabut kabel proyektor saat output aktif dan gunakan Blackout.</p>
 </section>;
}
