import {useCallback,useEffect,useRef,useState,type ChangeEvent} from 'react';
import {FlaskConical,Footprints,Pause,Play,RotateCcw,UploadCloud} from 'lucide-react';
import {VideoPoseGaitEngine,type ReplayAnalysisSnapshot}
 from '../../stage/VideoPoseGaitEngine.ts';
import {videoActorPresenceLabel} from '../../stage/videoAutoActorTracker.ts';
import {subscribeReplayFrames} from '../../stage/replayFrameClock.ts';
import {validVideoLabFile} from '../../stage/videoMotionLabUtils.ts';
import {DirectPuppetSession} from '../../footprints/simulator/puppet-controller.ts';
import {initialCamera} from '../../footprints/simulator/scene3d.ts';
import type {FootSide} from '../../footprints/spatial/events.ts';
import type {ExperimentInputKind,ExperimentalFrame} from './experimentSourceModel.ts';
import './footprints-experimental-source.css';

export function FootprintsExperimentalSource({kind,clip,onClip,model,onFrame,externalRevision,
 onAdvancedVideo,onAdvancedSimulator}:{
 kind:ExperimentInputKind;clip:File|null;onClip:(file:File|null)=>void;
 model:DirectPuppetSession;externalRevision:number;
 onFrame:(frame:ExperimentalFrame|null)=>void;
 onAdvancedVideo:()=>void;onAdvancedSimulator:()=>void;
}){
 const video=useRef<HTMLVideoElement>(null);
 const videoEngine=useRef<VideoPoseGaitEngine|null>(null);
 const generation=useRef(0);
 const userPaused=useRef(false);
 const showTechnicalLab=typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('lab');
 const [url,setUrl]=useState<string|null>(null);
 const [videoReady,setVideoReady]=useState(false);
 const [position,setPosition]=useState(0),[duration,setDuration]=useState(0);
 const [scrubPosition,setScrubPosition]=useState<number|null>(null);
 const [playing,setPlaying]=useState(false),[analyzing,setAnalyzing]=useState(false);
 const [analysisError,setAnalysisError]=useState('');
 const [snapshot,setSnapshot]=useState<ReplayAnalysisSnapshot|null>(null);
 const lastSnapshot=useRef<ReplayAnalysisSnapshot|null>(null);
 const previousSnapshot=useRef<ReplayAnalysisSnapshot|null>(null);
 const sessionRef=useRef(model);
 const [revision,setRevision]=useState(0);
 const [foot,setFoot]=useState<FootSide>('left');
 const [status,setStatus]=useState('Pilih sumber gerak untuk eksperimen.');
 const origin=useRef(performance.now());
 const orbit=useRef(initialCamera());
 const [simTime,setSimTime]=useState(0);
 const renderSimulation=useCallback(()=>{
  const model=sessionRef.current;
  onFrame({kind:'simulator',session:model.session,
   performers:model.performers.map(p=>({...p,left:{...p.left,positionM:{...p.left.positionM}},
    right:{...p.right,positionM:{...p.right.positionM}}})),
   orbit:orbit.current,timeMs:model.durationMs,name:'Direct Puppet'});
 },[onFrame]);
 useEffect(()=>{
  if(kind!=='simulator')return;
  renderSimulation();
 },[kind,revision,externalRevision,renderSimulation]);
 useEffect(()=>{
  if(kind!=='video'||!clip){setUrl(null);setVideoReady(false);setSnapshot(null);return;}
  const objectUrl=URL.createObjectURL(clip);setUrl(objectUrl);
  setVideoReady(false);setDuration(0);setPosition(0);setScrubPosition(null);setPlaying(false);setSnapshot(null);
  lastSnapshot.current=null;previousSnapshot.current=null;userPaused.current=false;
  setAnalysisError('');setAnalyzing(false);
  return()=>URL.revokeObjectURL(objectUrl);
 },[clip,kind]);
 useEffect(()=>{
  if(kind!=='video'||!clip||!videoReady)return;
  const el=video.current;if(!el)return;
  let disposed=false;
  const generationId=++generation.current;
  const engine=new VideoPoseGaitEngine(value=>{
   if(!disposed&&generationId===generation.current){
    const previous=lastSnapshot.current;
    previousSnapshot.current=previous&&previous.segment===value.segment&&previous.atMs<value.atMs?previous:null;
    lastSnapshot.current=value;setSnapshot(value);
   }
  });
  // Footprints stage is a two-performer rehearsal space. Keep both actor
  // slots active, even when one person's pose is temporarily invisible.
  engine.setPerformers(2);
  videoEngine.current=engine;
  setAnalyzing(true);setAnalysisError('');
  void engine.init().then(()=>{
   if(disposed||generationId!==generation.current)return;
   engine.process(el,el.currentTime,18,true);
   setAnalyzing(false);
   // Muted inline video can start itself. Tracking stays on the same stage,
   // and the user retains Pause/Play as a normal transport control.
   if(!userPaused.current&&el.paused){
    void el.play().then(()=>{if(!disposed)setPlaying(true);})
     .catch(()=>{if(!disposed)setStatus('Video siap. Tekan Putar untuk mulai.');});
   }
  }).catch(error=>{
   if(disposed||generationId!==generation.current)return;
   setAnalyzing(false);
   setAnalysisError(error instanceof Error?error.message:'Model pose belum tersedia.');
  });
  return()=>{
   disposed=true;generation.current++;
   engine.dispose();if(videoEngine.current===engine)videoEngine.current=null;
  };
 },[kind,clip,videoReady]);
 useEffect(()=>{
  if(kind!=='video'||!videoReady)return;
  const el=video.current;if(!el)return;
  return subscribeReplayFrames(el,(mediaTime,presentedFrames)=>{
   videoEngine.current?.recordPresentedFrame(presentedFrames);
   videoEngine.current?.process(el,mediaTime,18);
  });
 },[kind,videoReady]);
 useEffect(()=>{
  if(kind!=='video')return;
  const el=video.current;
  onFrame({kind:'video',snapshot,previousSnapshot:previousSnapshot.current,
   video:el,timeMs:(el?.currentTime??position)*1000,
   ready:videoReady,name:clip?.name??'Belum ada video'});
 },[kind,snapshot,clip,position,videoReady,onFrame]);
 useEffect(()=>{
  if(kind!=='video')return;
  const el=video.current;
  return()=>{
   el?.pause();
   if(el){el.removeAttribute('src');el.load();}
  };
 },[kind]);
 useEffect(()=>()=>onFrame(null),[onFrame]);
 const inputVideo=(e:ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0];if(file){
   const error=validVideoLabFile(file);
   if(error){setStatus(error);return;}
   onClip(file);setStatus('Membaca video dan menyiapkan Pose/Gait…');
  }
  e.target.value='';
 };
 const play=()=>{
  const el=video.current;if(!el||!videoReady)return;
  if(el.paused){userPaused.current=false;void el.play().then(()=>setPlaying(true))
   .catch(()=>setStatus('Codec video tidak dapat diputar. Coba MP4 H.264.'));}
  else{userPaused.current=true;el.pause();setPlaying(false);}
 };
 const seek=(seconds:number)=>{
  const el=video.current;if(!el||!videoReady)return;
  el.pause();setPlaying(false);
  videoEngine.current?.reset('Timeline dipindah. Event segmen sebelumnya disimpan di arsip analisis.');
  el.currentTime=seconds;setPosition(seconds);
 };
 const commitScrub=()=>{
  if(scrubPosition===null)return;
  seek(scrubPosition);setScrubPosition(null);
 };
 const timecode=(seconds:number)=>{
  const safe=Math.max(0,Number.isFinite(seconds)?seconds:0);
  return String(Math.floor(safe/60)).padStart(2,'0')+':'+
   String(Math.floor(safe%60)).padStart(2,'0');
 };
 const step=(dx:number)=>{
  const model=sessionRef.current,which={performerId:'A',foot};
  const v=model.getFoot(which);if(!v)return;
  const time=performance.now()-origin.current;
  model.lift(which,time);
  model.move(which,{xM:Math.max(.1,Math.min(model.floor.widthM-.1,v.positionM.xM+dx)),
   yM:Math.max(.1,Math.min(model.floor.depthM-.1,v.positionM.yM+.42))},time+80);
  model.land(which,time+160);
  setRevision(v=>v+1);
  setSimTime(model.durationMs);
  setStatus('Jejak simulasi ditambahkan pada FLOOR virtual.');
 };
 const reset=()=>{
  sessionRef.current.clear();origin.current=performance.now();
  setSimTime(0);setRevision(x=>x+1);setStatus('Sesi simulasi baru.');
 };
 const handleAdvanced=kind==='video'?onAdvancedVideo:onAdvancedSimulator;
 return <section className="fp-experiment-dock" data-experiment-kind={kind}
  aria-label={kind==='video'?'Sumber video MP4 Footprints':'Sumber simulasi 3D Footprints'}>
  {kind==='video'?<div className="fp-experiment-controls">
   <label className="fp-experiment-upload"><UploadCloud size={16}/>
    {clip?'Ganti video':'Pilih MP4 / WebM'}
    <input aria-label="Pilih file video Footprints" type="file"
     accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg" onChange={inputVideo}/>
   </label>
   <video ref={video} src={url??undefined} playsInline muted loop preload="metadata"
    aria-label="Pemutar MP4 untuk Footprints" className="fp-experiment-hidden-video"
    onLoadedMetadata={e=>{const el=e.currentTarget;setDuration(Number.isFinite(el.duration)?el.duration:0);setVideoReady(true);}}
    onSeeking={()=>videoEngine.current?.reset('Timeline diubah: identitas dan peristiwa diulang.')}
    onSeeked={e=>{
     const el=e.currentTarget;
     setPosition(el.currentTime);
     previousSnapshot.current=null;lastSnapshot.current=null;
     videoEngine.current?.process(el,el.currentTime,18,true);
    }}
    onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)}
    onEnded={()=>setPlaying(false)}/>
   <button type="button" onClick={play} disabled={!videoReady}
    aria-label={playing?'Jeda video':'Putar video'}>
    {playing?<Pause size={15}/>:<Play size={15}/>}
    {playing?'Jeda':'Putar'}</button>
   <input type="range" min={0} max={duration||1} step={.02}
    value={scrubPosition??position} aria-label="Geser waktu video"
    disabled={!videoReady} onChange={e=>setScrubPosition(+e.target.value)}
    onPointerUp={commitScrub} onPointerCancel={commitScrub}
    onKeyUp={commitScrub} onBlur={commitScrub}/>
   <output aria-label="Waktu video" className="fp-stable-timecode"
    title={`${(scrubPosition??position).toFixed(1)} dari ${duration.toFixed(1)} detik`}>
    {timecode(scrubPosition??position)} / {timecode(duration)}
   </output>
   <span className="fp-experiment-meta" role="status"
    data-state={analysisError?'error':analyzing?'busy':snapshot?'ready':'idle'}
    title={analysisError||'Status deteksi frame saat ini'}>
    {analysisError?'Tracking gagal':analyzing?'Memuat AI…':
     snapshot?`${snapshot.visibleCount}/2 tubuh`:
     clip?'Menyiapkan AI':'Belum ada video'}
   </span>
   {snapshot&&<div className="fp-duet-engine-status" role="group"
    aria-label="TRACKING OTOMATIS dua aktor">
    <b>TRACKING</b>
    <span className="fp-tracking-summary"
     title={snapshot.visibleCount===2?'Dua aktor terbaca':snapshot.visibleCount===1?
      'Satu aktor terbaca; menunggu aktor lainnya':'Menunggu tubuh yang dapat diatribusikan'}>
     {snapshot.visibleCount===2?'2/2 aktif':
      snapshot.persistentActors?.filter(a=>a.registered).length===2?
       'Re-ID aktif':snapshot.visibleCount===1?'1/2 aktif':'Mencari'}
    </span>
    <span className="fp-video-actor-status" aria-label="Status masing-masing aktor MP4">
     {snapshot.actorStates.map(actor=><span key={actor.id}
      data-actor={actor.id} data-presence={actor.presence}
      title={`Aktor ${actor.id}: ${videoActorPresenceLabel(actor.presence)}`}>
      <b>{actor.id}</b> {actor.presence==='visible'?'Aktif':
       actor.presence==='occluded'?'Tertahan':
       actor.presence==='reacquiring'||actor.presence==='uncertain'?'Pulih':
       actor.presence==='lost'?'Hilang':'Dicari'}
     </span>)}
    </span>
    <details className="fp-tracking-details">
     <summary aria-label="Detail tracking A dan B">Detail</summary>
     <div className="fp-tracking-details-panel">
      <strong>TRACKING / VIDEO</strong>
      <p>Sumber MP4 · output fisik terkunci</p>
      <dl>
       <div><dt>Model</dt><dd>MediaPipe Pose Lite · 33 titik</dd></div>
       <div><dt>Eksekusi</dt><dd>{snapshot.performance.backend==='worker'?'Worker':'CPU fallback'}</dd></div>
       <div><dt>Pose AI mentah</dt><dd>{snapshot.rawPoses.length}/2 terukur</dd></div>
       <div><dt>Identitas aktif</dt><dd>{snapshot.visibleCount}/2 valid</dd></div>
       <div><dt>Inferensi</dt><dd>{snapshot.performance.poseFps.toFixed(1)} FPS</dd></div>
       <div><dt>Lag video</dt><dd>{snapshot.performance.latestVideoLagMs.toFixed(0)} ms</dd></div>
       <div><dt>Registrasi</dt><dd>{snapshot.persistentActors?.filter(a=>a.registered).length??0}/2 tersimpan</dd></div>
      </dl>
      {snapshot.actorStates.map(actor=><p key={actor.id}>
       <b>{actor.id}</b> · {videoActorPresenceLabel(actor.presence)}
      </p>)}
      <small>Saat crossing, output BODY mengikuti pengaman identitas per aktor.</small>
     </div>
    </details>
   </div>}
   {snapshot&&showTechnicalLab&&<details className="fp-d4-performance" aria-label="D4 Performance Integration">
    <summary>D4 · Performance <b>{snapshot.performance.backend==='worker'?'Worker':'CPU fallback'}</b>
     <span>{snapshot.performance.poseFps.toFixed(1)} FPS AI · lag {snapshot.performance.latestVideoLagMs.toFixed(0)} ms</span></summary>
    <div className="fp-d4-metrics">
     <span>Pipeline p50 / p95 <b>{snapshot.performance.pipelineP50Ms.toFixed(0)} / {snapshot.performance.pipelineP95Ms.toFixed(0)} ms</b></span>
     <span>Frame drop (busy) <b>{snapshot.performance.busyDrops}</b></span>
     <span>Hasil AI kedaluwarsa <b>{snapshot.performance.staleResults}</b></span>
     <span>Lag maksimum <b>{snapshot.performance.maxVideoLagMs.toFixed(0)} ms</b></span>
     <span>Backend <b>{snapshot.performance.backend}</b></span>
     <span>D3 terakhir <b>{snapshot.d3?.accepted??0}/{snapshot.d3?.attempted??0} crop · {snapshot.d3?.status??'warming'}</b></span>
     <span>D3 waktu crop <b>{(snapshot.d3?.elapsedMs??0).toFixed(0)} ms</b></span>
    </div>
    {snapshot.performance.fallbackReason&&<p role="status">Fallback: {snapshot.performance.fallbackReason}</p>}
    {snapshot.d3?.reason&&<p role="status">D3: {snapshot.d3.reason}</p>}
    <small>MediaPipe multipose → D2 A/B → D3 crop 33 per aktor saat ID aman → gait → BODY/FLOOR. Crop gagal QA tetap memakai pose utama. MoveNet 384/512 masih benchmark terpisah.</small>
   </details>}

  </div>:<div className="fp-experiment-controls">
   <label>Pilih kaki <select aria-label="Kaki simulasi aktif" value={foot}
    onChange={e=>setFoot(e.target.value as FootSide)}>
    <option value="left">Kiri · A</option><option value="right">Kanan · A</option>
   </select></label>
   <button type="button" onClick={()=>step(-.14)}>
    <Footprints size={15}/> Langkah kiri</button>
   <button type="button" onClick={()=>step(.14)}>
    <Footprints size={15}/> Langkah kanan</button>
   <button type="button" onClick={reset}><RotateCcw size={15}/> Reset</button>
   <span className="fp-experiment-meta" role="status">{sessionRef.current.events.filter(e=>e.kind==='contact').length} kontak sintetis · {simTime} ms</span>
  </div>}
  {(kind==='simulator'||showTechnicalLab)&&<details className="fp-experiment-advanced-details">
   <summary>Lanjutan</summary>
   <div className="fp-experiment-advanced-content">
    <button type="button" className="fp-experiment-advanced" onClick={handleAdvanced}>
     <FlaskConical size={15}/> {kind==='video'?'Buka Video Motion Lab':'Buka Simulator 3D lengkap'}
    </button>
    <small>{kind==='video'?'Analisis pose dan gait di lab.':'Kontrol puppet 3D di lab.'}</small>
    <small>{status}</small>
   </div>
  </details>}
 </section>;
}
