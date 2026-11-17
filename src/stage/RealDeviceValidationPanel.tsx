import {useEffect,useRef,useState,type RefObject} from 'react';
import type {MotionFrame} from '../engine/types.ts';
import type {LiveFloorTrackingEngine} from '../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../footprints/live/MultiPoseGaitRouter.ts';
import {cameraBinding,cameraBindingKey} from '../footprints/live/LiveFloorTrackingEngine.ts';
import {STAGE_BLACKOUT_EVENT} from '../footprints/stage-optics/StageBlackout.ts';
import {download} from '../engine/recording.ts';
import {readPhoneTransport} from './PhoneDeviceTelemetry.ts';
import {appendDeviceSample,assessDeviceTrial,beginDeviceTrial,
 exportDeviceTrial,finishDeviceTrial,recordDeviceObservation,recordSoftwareBlackout,
 withDeviceChecklist,type DeviceCase,type DeviceChecklist,type DeviceTrial}
 from './RealDeviceTrial.ts';

const scenarios:{kind:DeviceCase;title:string;instruction:string}[]=[
 {kind:'walk',title:'Walking',instruction:'Berjalan normal melintasi floor pad'},
 {kind:'slow-walk',title:'Slow walking',instruction:'Langkah pelan, telapak terlihat jelas'},
 {kind:'pivot',title:'Pivot',instruction:'Berputar dengan satu kaki sebagai tumpuan'},
 {kind:'slide',title:'Slide',instruction:'Kaki bergeser sepanjang permukaan'},
 {kind:'crossing',title:'Crossing A/B',instruction:'Dua performer saling berpapasan'},
 {kind:'disconnect',title:'Koneksi terputus',instruction:'Matikan Wi-Fi/kunci HP, amati perintah Blackout'}
];
const fmt=(n:number|null,suffix='')=>n===null?'Belum terukur':n.toFixed(1)+suffix;
export function RealDeviceValidationPanel({frameRef,videoRef,tracker,router,
 performers,phoneActive}:{frameRef:RefObject<MotionFrame>;
 videoRef:RefObject<HTMLVideoElement|null>;tracker:LiveFloorTrackingEngine;
 router:MultiPoseGaitRouter;performers:1|2;phoneActive:boolean}){
 const [trial,setTrial]=useState<DeviceTrial|null>(null);
 const trialRef=useRef(trial);trialRef.current=trial;
 const [now,setNow]=useState(()=>performance.now());
 const [phoneModel,setPhoneModel]=useState('');
 const [browserLabel,setBrowserLabel]=useState('');
 const [networkLabel,setNetworkLabel]=useState('Wi-Fi lokal');
 const [videoReference,setVideoReference]=useState('');
 const [reviewer,setReviewer]=useState(''),[note,setNote]=useState('');
 const [caseId,setCaseId]=useState<DeviceCase>('walk');
 const [performerId,setPerformerId]=useState<'performer-1'|'A'|'B'|'both'>('performer-1');
 const [eventNote,setEventNote]=useState('');
 const [videoFrame,setVideoFrame]=useState('');
 const [error,setError]=useState('');
 const transport=readPhoneTransport(now);
 const evalTrial=assessDeviceTrial(trial,now);
 const summary=evalTrial.summary;
 // One passive timer for browser data; no camera or projector side effects.
 useEffect(()=>{
  const timer=window.setInterval(()=>{
   const t=performance.now();setNow(t);
   const current=trialRef.current;
   if(!current||current.endedAtMs!==null)return;
   const incoming=readPhoneTransport(t),frame=frameRef.current;
   const matching=tracker.boundCamera!==null&&
    tracker.boundCamera===cameraBindingKey(cameraBinding(videoRef.current));
   const frameAge=frame.source==='camera'&&frame.time<=t?
    Math.max(0,t-frame.time):null;
   const identity=router.status;
   const value={
    elapsedMs:t-current.startedAtMs,
    transport:incoming.state,source:incoming.mode,
    phoneActive,framesDecoded:incoming.framesDecoded,fps:incoming.fps,
    packetsReceived:incoming.packetsReceived,packetsLost:incoming.packetsLost,
    jitterMs:incoming.jitterMs,rttMs:incoming.rttMs,
    frameWidth:incoming.frameWidth,frameHeight:incoming.frameHeight,
    frameAgeMs:frameAge,poseTracked:!!(frame.source==='camera'&&
     frame.tracked&&frameAge!==null&&frameAge<=450),
    identityAmbiguous:identity.ambiguous,
    observedTwo:identity.visible.length===2&&!identity.ambiguous&&
     identity.observedFrameTime===frame.time,
    calibrated:tracker.isConfirmed,calibrationMatched:matching,
    cameraContacts:tracker.status.contacts,
    inferenceMs:frame.telemetry?.inferenceMs??null,
    pipelineMs:frame.telemetry?.pipelineMs??null
   };
   try{setTrial(previous=>previous&&previous.endedAtMs===null?
    appendDeviceSample(previous,value):previous);}
   catch(e){setError(e instanceof Error?e.message:'Sampel tidak dapat direkam.');}
  },1000);
  return()=>window.clearInterval(timer);
 },[frameRef,videoRef,tracker,router,phoneActive]);
 // Only confirms the blackout SOFTWARE COMMAND. The physical photons require
 // a separate witnessed checklist item and a separate S5.7 acceptance.
 useEffect(()=>{
  const onBlackout=()=>{
   const t=performance.now();
   setTrial(previous=>previous&&previous.endedAtMs===null?
    recordSoftwareBlackout(previous,t-previous.startedAtMs):previous);
  };
  window.addEventListener(STAGE_BLACKOUT_EVENT,onBlackout);
  return()=>window.removeEventListener(STAGE_BLACKOUT_EVENT,onBlackout);
 },[]);
 const start=()=>{
  try{
   const stamp=performance.now(),current=readPhoneTransport(stamp);
   const next=beginDeviceTrial({nowMs:stamp,source:current.mode??'qr',
    performers,phoneActive,transport:current,phoneModel,browserLabel,
    networkLabel,videoReference});
   setTrial(next);setError('');setNow(stamp);
  }catch(e){setError(e instanceof Error?e.message:'Gagal memulai trial.');}
 };
 const observe=()=>{
  if(!trial)return;
  try{
   const v=videoFrame.trim()?Number(videoFrame):null;
   const kind=caseId;
   const performer=kind==='crossing'||kind==='disconnect'?'both':performerId;
   setTrial(recordDeviceObservation(trial,{
    case:kind,atMs:performance.now()-trial.startedAtMs,
    performer,videoFrame:v,note:eventNote
   }));
   setError('');setEventNote('');setVideoFrame('');
  }catch(e){setError(e instanceof Error?e.message:'Bukti gerak belum valid.');}
 };
 const finish=()=>{
  if(!trial)return;
  try{
   setTrial(finishDeviceTrial(trial,performance.now(),reviewer,note));
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Gagal mengakhiri trial.');}
 };
 const exportJson=()=>{
  if(!trial||trial.endedAtMs===null)return;
  const filename='SOMA-S6-1-2-REAL-DEVICE-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  download(new Blob([exportDeviceTrial(trial,performance.now())],{type:'application/json'}),filename);
 };
 const canStart=phoneActive&&transport.state==='connected'&&
  !!transport.mode;
 return <section className="soma-device-qa" aria-label="Uji kamera HP sungguhan">
  <header><div><small>S6.1.2 / LIVE DEVICE VALIDATION</small>
   <h3>Uji kamera HP — pencatatan nyata</h3></div>
   <span data-state={transport.state}>{transport.mode?.toUpperCase()??'HP'} · {transport.state}</span>
  </header>
  <p>Rekam pengukuran dari video HP yang benar-benar diterima laptop. Angka WebRTC dan pose dihitung di browser; bukti gerak dan cahaya fisik diperiksa operator.</p>
  <div className="soma-device-qa-metrics">
   <div><small>Video terdekode</small><strong>{transport.framesDecoded??'—'}</strong></div>
   <div><small>WebRTC FPS</small><strong>{fmt(transport.fps)}</strong></div>
   <div><small>Jitter</small><strong>{fmt(transport.jitterMs,' ms')}</strong></div>
   <div><small>RTT jaringan</small><strong>{fmt(transport.rttMs,' ms')}</strong></div>
  </div>
  <p className="soma-setup-hint">RTT jaringan dan jitter bukan latensi kaki-ke-cahaya. Angka bisa kosong jika browser tidak menyediakannya.</p>
  {!trial&&<>
   <div className="soma-device-qa-fields">
    <label>Model HP <input maxLength={180} value={phoneModel}
     onChange={e=>setPhoneModel(e.target.value)} placeholder="Contoh: iPhone / Samsung"/></label>
    <label>Browser HP <input maxLength={180} value={browserLabel}
     onChange={e=>setBrowserLabel(e.target.value)} placeholder="Safari / Chrome dan versi"/></label>
    <label>Jaringan <input maxLength={180} value={networkLabel}
     onChange={e=>setNetworkLabel(e.target.value)} placeholder="Wi-Fi 5 GHz, jarak router"/></label>
    <label>Referensi video bukti <input maxLength={220} value={videoReference}
     onChange={e=>setVideoReference(e.target.value)} placeholder="Nama file video eksternal"/></label>
   </div>
   <button type="button" className="soma-setup-primary" disabled={!canStart}
    onClick={start}>Mulai trial kamera HP</button>
   {!canStart&&<p>Hubungkan HP melalui QR atau kode manual, lalu pastikan SOMA memakai video HP.</p>}
  </>}
  {trial&&<>
   <div className="soma-setup-status">
    {trial.endedAtMs===null?'Merekam telemetry tiap 1 detik':'Trial selesai'} ·
    {Math.floor((summary?.durationMs??0)/1000)} detik ·
    {summary?.connectedSamples??0} sampel video aktif ·
    {summary?.contactDelta??0} kontak terdeteksi
   </div>
   <div className="soma-device-qa-metrics">
    <div><small>FPS median</small><strong>{fmt(summary?.fpsMedian??null)}</strong></div>
    <div><small>Frame segar</small><strong>{summary?.frameFreshFraction===null?'—':
     Math.round((summary?.frameFreshFraction??0)*100)+'%'}</strong></div>
    <div><small>Pose terdeteksi</small><strong>{summary?.trackedFraction===null?'—':
     Math.round((summary?.trackedFraction??0)*100)+'%'}</strong></div>
    <div><small>Inferensi P95</small><strong>{fmt(summary?.inferenceP95Ms??null,' ms')}</strong></div>
   </div>
   {trial.endedAtMs===null&&<>
    <label>Catat kejadian gerak
     <select value={caseId} onChange={e=>setCaseId(e.target.value as DeviceCase)}>
      {scenarios.filter(s=>performers===2||s.kind!=='crossing').map(s=>
       <option key={s.kind} value={s.kind}>{s.title} — {s.instruction}</option>)}
     </select></label>
    {caseId!=='crossing'&&caseId!=='disconnect'&&<label>Performer
     <select value={performerId} onChange={e=>setPerformerId(
      e.target.value as 'performer-1'|'A'|'B'|'both')}>
      {(performers===2?['A','B']:['performer-1']).map(v=><option key={v}>{v}</option>)}
     </select></label>}
    <div className="soma-device-qa-fields">
     <label>Frame video bukti (opsional) <input type="number" min="0" step="1"
      value={videoFrame} onChange={e=>setVideoFrame(e.target.value)}/></label>
     <label>Catatan yang terlihat <input maxLength={500} value={eventNote}
      onChange={e=>setEventNote(e.target.value)}
      placeholder="Apa yang terlihat saat gerakan terjadi?"/></label>
    </div>
    <button type="button" onClick={observe} disabled={!eventNote.trim()}>
     Tambah catatan gerak</button>
    <p className="soma-setup-hint">Untuk menguji kehilangan koneksi, matikan Wi-Fi atau kunci HP setelah berjalan. Perhatikan permintaan Blackout dan amati cahaya fisik terpisah.</p>
    <fieldset className="soma-device-qa-checklist"><legend>Pemeriksaan lapangan oleh operator</legend>
     {([
      ['phoneMounted','HP terpasang stabil pada tripod'],
      ['feetAndFloorVisible','Kedua kaki dan lantai terlihat jelas'],
      ['externalVideoRecorded','Video eksternal berisi gerak dan titik pijakan'],
      ['physicalBlackoutWitnessed','Blackout cahaya proyektor disaksikan langsung']
     ] as [keyof DeviceChecklist,string][]).map(([field,label])=>
      <label key={field}><input type="checkbox" checked={trial.checklist[field]}
       onChange={e=>setTrial(withDeviceChecklist(trial,{[field]:e.target.checked}))}/>
       {label}</label>)}
    </fieldset>
    <label>Nama pemeriksa <input value={reviewer} maxLength={120}
     onChange={e=>setReviewer(e.target.value)}/></label>
    <label>Catatan penutup <textarea rows={2} value={note} maxLength={500}
     onChange={e=>setNote(e.target.value)}/></label>
    <button type="button" className="soma-setup-primary" onClick={finish}
     disabled={!reviewer.trim()}>Akhiri trial & hitung hasil</button>
   </>}
   <div className="soma-device-qa-assessment">
    <strong>Penilaian software sementara: {evalTrial.status}</strong>
    {evalTrial.missing.slice(0,12).map((m,i)=><p key={'m'+i}>Perlu: {m}</p>)}
    {evalTrial.failed.map((m,i)=><p key={'f'+i}>Perlu perbaikan: {m}</p>)}
    {summary&&<p>Frame video {summary.decodedFrames} · Jitter P95 {fmt(summary.jitterP95Ms,' ms')} ·
     RTT P95 {fmt(summary.networkRttP95Ms,' ms')} ·
     Packet loss {summary.packetLossFraction===null?'belum terukur':
      Math.round(summary.packetLossFraction*1000)/10+'%'} ·
     Permintaan Blackout setelah putus: {summary.softwareBlackoutAfterLoss===null?
      'belum diuji':summary.softwareBlackoutAfterLoss?'tercatat':'tidak tercatat'}</p>}
   </div>
   {trial.endedAtMs!==null&&<button type="button" className="soma-setup-primary"
    onClick={exportJson}>Ekspor JSON laporan QA</button>}
   <button type="button" className="soma-setup-secondary" onClick={()=>{
    if(window.confirm('Mulai ulang trial? Ekspor JSON dulu agar data tidak hilang.')){
     setTrial(null);setError('');
    }
   }}>Reset trial</button>
  </>}
  {error&&<div className="soma-device-qa-error" role="alert">{error}</div>}
  <small>Hasil hanya memuat angka diagnostik dan catatan manusia. Tidak menyimpan video, token pairing, atau alamat IP. Status siap-review tidak memberi izin Live proyektor.</small>
 </section>;
}
