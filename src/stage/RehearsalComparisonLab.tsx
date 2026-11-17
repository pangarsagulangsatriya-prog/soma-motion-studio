import {useEffect,useRef,useState,type RefObject,type ChangeEvent} from 'react';
import {Activity,Download,Play,Square,UploadCloud,X} from 'lucide-react';
import type {MotionFrame} from '../engine/types.ts';
import type {LiveFloorTrackingEngine} from '../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../footprints/live/MultiPoseGaitRouter.ts';
import {cameraBinding,cameraBindingKey} from '../footprints/live/LiveFloorTrackingEngine.ts';
import type {FootstepEvent} from '../footprints/spatial/events.ts';
import type {FloorSpace} from '../footprints/spatial/coordinates.ts';
import type {ReplayPerformer} from './videoGaitAnalysis.ts';
import {fromReplayReport,parseReferenceReport,selectReferenceSegment,contactMetrics,
 referenceContacts,liveContacts,comparisonWindow,safeLiveCapture,validLiveEvent,
 referenceTimeline,liveTimeline,normalizedLivePath,
 type RehearsalReference,type ReplayReport} from './rehearsalComparisonModel.ts';
import {RehearsalPath,RehearsalTimeline,referenceFootPath} from './RehearsalVisuals.tsx';
import './rehearsal-comparison-lab.css';
type Capture={status:'complete'|'interrupted';reason:string;start:number;end:number;
 duration:number;performers:1|2;floor:FloorSpace;events:FootstepEvent[]};
type Recording={start:number;end:number;cursor:number;performers:1|2;
 floor:FloorSpace;events:FootstepEvent[]};
type Props={frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 tracker:LiveFloorTrackingEngine;router:MultiPoseGaitRouter;
 cameraOn:boolean;bodySelected:boolean;performers:1|2;initialReference:ReplayReport|null;
 onClose:()=>void;onStartCamera:()=>void;onCalibrate:()=>void};
const windows=[10,20,30,60] as const;
const bestSegment=(r:RehearsalReference)=>r.segments.filter(s=>s.firstAtMs!==null&&s.lastAtMs!==null)
 .sort((a,b)=>(b.lastAtMs!-b.firstAtMs!)-(a.lastAtMs!-a.firstAtMs!))[0]?.segment??0;
const shown=(value:number|null|undefined,unit='')=>value===null||value===undefined||!Number.isFinite(value)?
 '—':(Number.isInteger(value)?value.toString():value.toFixed(1))+unit;
export function RehearsalComparisonLab({
 frameRef,videoRef,tracker,router,cameraOn,bodySelected,performers,
 initialReference,onClose,onStartCamera,onCalibrate
}:Props){
 const [reference,setReference]=useState<RehearsalReference|null>(null);
 const [segment,setSegment]=useState(0);
 const [person,setPerson]=useState<ReplayPerformer>('A');
 const [seconds,setSeconds]=useState<number>(30);
 const [capture,setCapture]=useState<Capture|null>(null);
 const [recording,setRecording]=useState(false);
 const [capturedCount,setCapturedCount]=useState(0);
 const [ticker,setTicker]=useState(0);
 const [message,setMessage]=useState('Impor JSON QA S6.5.5 atau kirim hasil dari Video Motion Lab.');
 const picker=useRef<HTMLInputElement>(null),run=useRef<Recording|null>(null);
 const apply=(r:RehearsalReference)=>{
  run.current=null;setRecording(false);setReference(r);setSegment(bestSegment(r));
  setCapture(null);setPerson('A');setMessage('Referensi '+r.name+' dimuat.');
 };
 useEffect(()=>{if(!initialReference)return;try{apply(fromReplayReport(initialReference));}
  catch{setMessage('Referensi tidak valid. Unggah JSON QA.');}},[initialReference]);
 const upload=async(e:ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(file.size>8*1024*1024){setMessage('JSON QA maksimal 8 MB.');return;}
  try{apply(parseReferenceReport(JSON.parse(await file.text())));}
  catch(error){setMessage(error instanceof Error?error.message:'JSON gagal diparsing.');}
 };
 const gate=()=>{
  const f=frameRef.current,ids=router.status,key=cameraBindingKey(cameraBinding(videoRef.current));
  return safeLiveCapture({cameraOn,bodySelected,frameSource:f.source,
   frameTracked:f.tracked,frameAgeMs:performance.now()-f.time,
   floorConfirmed:tracker.isConfirmed,cameraMatched:!!key&&key===tracker.boundCamera,
   performerCount:performers,identityAmbiguous:ids.ambiguous,
   visibleIds:ids.visible,frameMatched:ids.observedFrameTime===f.time});
 };
 const selected=reference?selectReferenceSegment(reference,segment):null;
 const windowMs=comparisonWindow(reference,segment,seconds*1000);
 const finish=(status:'complete'|'interrupted',reason:string,now:number)=>{
  const v=run.current;if(!v)return;run.current=null;setRecording(false);
  const end=Math.min(v.end,Math.max(v.start,now));
  setCapture({status,reason,start:v.start,end,duration:end-v.start,
   performers:v.performers,floor:v.floor,events:[...v.events]});
  setMessage(reason);
 };
 const start=()=>{
  const ready=gate();if(!ready.ready){setMessage(ready.reason);return;}
  if(!reference||windowMs<3000){setMessage('Pilih segmen video minimal 3 detik.');return;}
  const data=tracker.session,floor=tracker.floor;
  if(!data||!floor){setMessage('FloorSession belum siap.');return;}
  const now=performance.now();
  run.current={start:now,end:now+windowMs,cursor:data.events.length,
   performers,floor:{...floor},events:[]};
  setCapture(null);setCapturedCount(0);setRecording(true);
  setMessage('Merekam event baru dari FloorSession; event historis dikecualikan.');
 };
 useEffect(()=>{
  const timer=window.setInterval(()=>{
   const now=performance.now();setTicker(Math.floor(now/200));
   const v=run.current;if(!v)return;
   const readiness=gate();if(!readiness.ready){
    finish('interrupted','Kamera/identitas tidak siap: '+readiness.reason,now);return;}
   if(v.performers!==performers){finish('interrupted','Mode performer berubah.',now);return;}
   const data=tracker.session,floor=tracker.floor;
   if(!data||!floor||data.events.length<v.cursor||
    floor.widthM!==v.floor.widthM||floor.depthM!==v.floor.depthM){
    finish('interrupted','FloorSession/kalibrasi berganti.',now);return;}
   for(const e of data.events.slice(v.cursor)){
    if(validLiveEvent(e,v.start,v.end,v.performers))v.events.push(e);
   }
   v.cursor=data.events.length;setCapturedCount(v.events.length);
   if(now>=v.end)finish('complete','Perekaman latihan selesai.',v.end);
  },200);
  return()=>window.clearInterval(timer);
 },[tracker,router,frameRef,videoRef,cameraOn,bodySelected,performers]);
 const readiness=gate();void ticker;
 const full=!!capture&&capture.status==='complete'&&capture.duration>=windowMs-250&&windowMs>0;
 const referenceMetrics=selected&&reference?contactMetrics(
  referenceContacts(reference,segment,person),selected.startMs,windowMs):null;
 const liveMetrics=full?contactMetrics(liveContacts(capture.events,person),capture.start,windowMs):null;
 const refMarks=selected?referenceTimeline(selected.events,selected.startMs,windowMs,person):[];
 const liveMarks=full?liveTimeline(capture.events,capture.start,windowMs,person,capture.performers):[];
 const refPath=selected?referenceFootPath(selected.events,selected.startMs,selected.startMs+windowMs,person):[];
 const livePath=full?normalizedLivePath(capture.events,capture.floor,person):[];
 const elapsed=run.current?Math.max(0,Math.min(windowMs,performance.now()-run.current.start)):0;

 const exportResult=()=>{
  if(!reference||!selected||!capture||!full||!referenceMetrics||!liveMetrics)return;
  const data={
   schema:'soma.rehearsal-comparison',version:1,exportedAt:new Date().toISOString(),
   safety:{physicalProjectionAuthorized:false,referenceBasis:'video-2d-estimate',
    liveBasis:'calibrated-estimate',spatialOverlayAllowed:false,slidePivotDirectlyComparable:false},
   reference:{filename:reference.name,segment,startMs:selected.startMs,
    durationMs:windowMs,performer:person,warnings:reference.warnings},
   live:{startMs:capture.start,durationMs:capture.duration,
    performers:capture.performers,status:capture.status,floor:capture.floor,
    events:capture.events.map(e=>({...e,elapsedMs:e.timestampMs-capture.start}))},
   summary:{reference:referenceMetrics,live:liveMetrics,
    differenceContact:liveMetrics.count-referenceMetrics.count,
    differenceCadence:liveMetrics.cadence!==null&&referenceMetrics.cadence!==null?
     liveMetrics.cadence-referenceMetrics.cadence:null},
   note:'Temporal comparison only. Independent video image coordinates and estimated physical floor positions must not be overlaid.'
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='SOMA-REHEARSAL-COMPARISON.json';link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  setMessage('Laporan perbandingan berhasil diekspor.');
 };
 return <section className="rcl-root" aria-label="S6.5.6 Rehearsal Comparison Lab">
  <header className="rcl-heading">
   <div><small>SOMA / S6.5.6 · REHEARSAL</small>
    <h2><Activity size={21}/> Rehearsal Comparison Lab</h2>
    <p>Bandingkan ritme pijakan MP4 dengan Footprints kamera, dengan data dan lintasan terpisah.</p></div>
   <button type="button" onClick={()=>{if(recording)finish('interrupted','Lab ditutup.',performance.now());onClose();}}>
    <X size={15}/> Tutup</button>
  </header>
  <div className="rcl-top">
   <section className="rcl-pane"><h3>01 · Referensi MP4</h3>
    <button type="button" disabled={recording} onClick={()=>picker.current?.click()}>
     <UploadCloud size={15}/> Impor JSON QA</button>
    <input hidden ref={picker} type="file" accept=".json,application/json" onChange={upload}/>
    {reference?<><p>{reference.name}</p>
     <label>Segmen referensi <select disabled={recording} value={segment}
      onChange={e=>{setSegment(Number(e.target.value));setCapture(null);}}>
      {reference.segments.map(s=><option key={s.segment} value={s.segment}>
       #{s.segment} · {s.firstAtMs===null||s.lastAtMs===null?'belum ada waktu':
        ((s.lastAtMs-s.firstAtMs)/1000).toFixed(1)+' detik'} · {s.eventCount} event
      </option>)}
     </select></label>
     {reference.warnings.map((w,i)=><p key={i} className="rcl-warning">{w}</p>)}
    </>:<p>Ekspor JSON QA dari Video Motion Lab atau tekan “Kirim ke Rehearsal Lab” pada video yang sudah dianalisis.</p>}
   </section>
   <section className="rcl-pane"><h3>02 · Kamera langsung</h3>
    <p className={readiness.ready?'rcl-ready':'rcl-warning'}>
     {readiness.ready?'READY · ':'HOLD · '}{readiness.reason}</p>
    {!cameraOn&&<button type="button" onClick={onStartCamera}>Aktifkan kamera Body</button>}
    {!tracker.isConfirmed&&<button type="button" onClick={onCalibrate}>Kalibrasi lantai</button>}
    <p>{performers===2?'2 performer · A/B':'1 performer · A'} · {tracker.status.contacts} contact historis (dikecualikan)</p>
   </section>
  </div>
  <div className="rcl-config">
   <label>Performer <select disabled={recording} value={person}
    onChange={e=>{setPerson(e.target.value as ReplayPerformer);setCapture(null);}}>
    <option value="A">BODY A</option><option value="B" disabled={performers===1}>BODY B</option>
   </select></label>
   <label>Durasi maksimal <select value={seconds} disabled={recording}
    onChange={e=>{setSeconds(Number(e.target.value));setCapture(null);}}>
    {windows.map(n=><option key={n} value={n}>{n} detik</option>)}
   </select></label>
   <div><small>Jendela sama</small><strong>{windowMs>=3000?(windowMs/1000).toFixed(1)+' detik':'Segmen terlalu pendek'}</strong></div>
   {!recording?<button type="button" className="rcl-primary"
     disabled={!readiness.ready||windowMs<3000||!reference} onClick={start}>
     <Play size={15}/> Rekam latihan</button>:
    <button type="button" onClick={()=>finish('interrupted','Dihentikan manual.',performance.now())}>
     <Square size={15}/> Hentikan</button>}
  </div>
  {recording&&<p className="rcl-status" role="status">Merekam {Math.round(elapsed/1000)} / {(windowMs/1000).toFixed(1)} detik · {capturedCount} event baru</p>}
  {capture&&<p className={full?'rcl-ready':'rcl-warning'}>
   {capture.reason} · {capture.events.length} event.
   {!full&&' Hasil parsial tidak dipakai untuk menghitung selisih.'}</p>}
  <p className="rcl-status" role="status" aria-live="polite">{message}</p>
  <section className="rcl-results">
   <div className="rcl-result-head">
    <div><h3>Rhythm Comparison — BODY {person}</h3>
     <p>Waktu 0 sejajar pada awal jendela masing-masing sesi.</p></div>
    <button type="button" disabled={!full} onClick={exportResult}>
     <Download size={15}/> Ekspor JSON</button>
   </div>
   <div className="rcl-side">
    <div><strong>MP4 · koordinat video</strong>
     <RehearsalTimeline marks={refMarks} title="Timeline pijakan video"/>
     <RehearsalPath points={refPath} title="Lintasan telapak dari koordinat gambar"/></div>
    <div><strong>Live · lantai terkalibrasi</strong>
     <RehearsalTimeline marks={liveMarks} title="Timeline pijakan kamera"/>
     <RehearsalPath points={livePath} title="Lintasan estimasi lantai fisik"/></div>
   </div>
