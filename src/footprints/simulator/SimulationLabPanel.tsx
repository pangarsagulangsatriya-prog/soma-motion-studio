import {Download,Pause,Play,ShieldCheck,TestTube2} from 'lucide-react';
import {QA_DURATION_MS,QA_FAULTS,QA_PHASES,qaFaultAt,qaFormatTime,
 qaOutputTransportAt,qaPhaseAt,type QAScenario} from './QAScenario.ts';
import type {QAReport} from './SimulationQAReport.ts';

export function SimulationLabPanel({active,onActiveChange,scenario,report,playhead,playing,
 onPlaying,onSeek,rate,onRateChange,faultsEnabled,onFaultsEnabled,verified,actualTransport,
 onExportReport,onExportSession}:{
 active:boolean;onActiveChange:(v:boolean)=>void;scenario:QAScenario;report:QAReport;
 playhead:number;playing:boolean;onPlaying:(v:boolean)=>void;onSeek:(v:number)=>void;
 rate:number;onRateChange:(v:number)=>void;faultsEnabled:boolean;onFaultsEnabled:(v:boolean)=>void;
 verified:boolean;actualTransport:string;onExportReport:()=>void;onExportSession:()=>void;
}){
 const fault=qaFaultAt(playhead,faultsEnabled),phase=qaPhaseAt(playhead);
 const simulated=qaOutputTransportAt(playhead,verified,faultsEnabled);
 return <section className="puppet-qa-lab" aria-label="S5.6 laboratorium simulasi 15 menit">
  <div className="puppet-section-title"><TestTube2 size={17}/><b>QA LAB · 15 MENIT</b>
   <span>{report.passed}/{report.total} software checks</span></div>
  <p>Uji sintetis dua performer dengan engine Footprints yang sama. Kamera tidak diperlukan; hasilnya belum membuktikan akurasi panggung fisik.</p>
  <button type="button" className="puppet-qa-activate" aria-pressed={active}
   onClick={()=>onActiveChange(!active)}>{active?'Keluar QA Lab · kembali ke Puppet':'Masuk QA Lab · dua performer'}</button>
  {active&&<>
   <div className="puppet-qa-stage-time">
    <strong>{qaFormatTime(playhead)} <span>/ 15:00</span></strong>
    <small>{phase.name}</small>
   </div>
   <label className="puppet-qa-seek">Timeline 15 menit
    <input type="range" min={0} max={QA_DURATION_MS} step={250}
     value={Math.round(playhead/250)*250} onChange={e=>{onPlaying(false);onSeek(Number(e.target.value));}}
     aria-label="Pindahkan waktu simulasi"/>
   </label>
   <div className="puppet-qa-playback">
    <button type="button" onClick={()=>onPlaying(!playing)}>
     {playing?<Pause size={15}/>:<Play size={15}/>} {playing?'Jeda':'Jalankan'}</button>
    <label>Kecepatan
     <select value={rate} onChange={e=>onRateChange(Number(e.target.value))}>
      {[1,4,16,64].map(n=><option key={n} value={n}>{n}×</option>)}
     </select>
    </label>
    <button type="button" onClick={()=>{onPlaying(false);onSeek(0);}}>Ulang 00:00</button>
   </div>
   <div className="puppet-qa-phases" aria-label="Bagian latihan">
    {QA_PHASES.map(p=><button key={p.name} type="button"
     aria-pressed={phase.name===p.name} onClick={()=>{onPlaying(false);onSeek(p.atMs);}}>
     {qaFormatTime(p.atMs)} · {p.name}</button>)}
   </div>
   <label className="puppet-qa-fault-switch">
    <input type="checkbox" checked={faultsEnabled} onChange={e=>{onPlaying(false);onFaultsEnabled(e.target.checked);onSeek(0);}}/>
    Sertakan gangguan tracking, crossing, kamera, Hold & Blackout
   </label>
   <div className="puppet-qa-faults" aria-label="Titik gangguan QA">
    {QA_FAULTS.map(f=><button type="button" key={f.id} disabled={!faultsEnabled}
     aria-pressed={fault?.id===f.id} onClick={()=>{onPlaying(false);onSeek(f.startMs+500);}}>
     <span>{qaFormatTime(f.startMs)}</span> {f.name}</button>)}
   </div>
   <div className="puppet-qa-transport">
    <span>Transport skenario: <b>{simulated.toUpperCase()}</b></span>
    <span>Transport SOMA: <b>{actualTransport.toUpperCase()}</b></span>
    <small>Ketika QA aktif, gangguan menahan atau memadamkan output yang sudah diizinkan. Persetujuan kalibrasi lantai tetap diperlukan.</small>
   </div>
   {fault&&<p className="puppet-qa-fault-note" role="status">{fault.name}: {fault.effect}</p>}
   <div className="puppet-qa-checks">
    <div className="puppet-section-title"><ShieldCheck size={15}/><b>ASSERTION REPORT</b>
     <span>{report.ok?'PASS':'NEEDS FIX'}</span></div>
    {report.checks.map(c=><div className="puppet-qa-check" key={c.id}>
     <span aria-label={c.pass?'Lulus':'Gagal'}>{c.pass?'✓':'!'}</span>
     <div><b>{c.name}</b><small>{c.detail}</small></div>
    </div>)}
   </div>
   <div className="puppet-qa-export">
    <button type="button" onClick={onExportReport}><Download size={15}/> QA JSON</button>
    <button type="button" onClick={onExportSession}>Scenario V3</button>
   </div>
   <p className="puppet-qa-warning">PASS mencakup aturan software dengan input sintetis. Hasil ukur fisik, kesalahan kamera nyata, dan respons proyektor panggung tetap harus diuji terpisah.</p>
  </>}
 </section>;
}
