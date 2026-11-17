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
 const [url,setUrl]=useState<string|null>(null);
 const [videoReady,setVideoReady]=useState(false);
 const [position,setPosition]=useState(0),[duration,setDuration]=useState(0);
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
  setVideoReady(false);setDuration(0);setPosition(0);setPlaying(false);setSnapshot(null);
  lastSnapshot.current=null;previousSnapshot.current=null;
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
  if(el.paused){void el.play().then(()=>setPlaying(true))
   .catch(()=>setStatus('Codec video tidak dapat diputar. Coba MP4 H.264.'));}
  else{el.pause();setPlaying(false);}
 };
 const seek=(seconds:number)=>{
  const el=video.current;if(!el||!videoReady)return;
  el.pause();setPlaying(false);
  videoEngine.current?.reset('Timeline dipindah. Event segmen sebelumnya disimpan di arsip analisis.');
  el.currentTime=seconds;setPosition(seconds);
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
   <video ref={video} src={url??undefined} playsInline muted preload="metadata"
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
   <input type="range" min={0} max={duration||1} step={.02} value={position}
    aria-label="Geser waktu video" disabled={!videoReady} onChange={e=>seek(+e.target.value)}/>
   <output>{position.toFixed(1)} / {duration.toFixed(1)} dtk</output>
   <span className="fp-experiment-meta" role="status">
    {analyzing?'Menyiapkan model Pose/Gait…':analysisError?'Analisis belum aktif: '+analysisError:
     snapshot?'Dual tracking · '+snapshot.detectedCount+'/2 pose · '+
      snapshot.visibleCount+'/2 ID stabil'+
      (snapshot.ambiguous?' · HOLD crossing':'')+
      (snapshot.rescueCount?' · crop rescue':'')+' · '+
      snapshot.performance.backend+' · '+Math.round(snapshot.performance.poseFps)+' FPS':
     clip?'Video siap, mulai analisis':'Video belum dipilih'}
   </span>
   {snapshot&&<div className="fp-duet-engine-status" role="status">
    <b>DUAL MOVEMENT ENGINE</b>
    <span>MP4 → Pose 33 × 2 → identitas A/B → gait → BODY/FLOOR</span>
    <span>{snapshot.ambiguous?'ID HOLD · event meragukan ditahan':
     snapshot.visibleCount===2?'Dua aktor terpisah · analisis berjalan':
      snapshot.visibleCount===1?'Satu aktor terlacak · pasangan dipantau':
      'Mencari tubuh dan memulihkan ID'}</span>
    <span>A: {snapshot.gait['A:left']?.motion??'—'} / {snapshot.gait['A:right']?.motion??'—'}
     {' · '}B: {snapshot.gait['B:left']?.motion??'—'} / {snapshot.gait['B:right']?.motion??'—'}</span>
    <span data-d3-status={snapshot.d3?.status??'warming'}>
     D3 · Crop A/B: {snapshot.d3Total?.accepted??0}/{snapshot.d3Total?.attempted??0}
     {' · '}{snapshot.d3?.status==='active'?'Model siap':
      snapshot.d3?.status==='fallback'?'Fallback multipose':'Memuat model crop'}
     {snapshot.d3?.refined.length?' · Baru: '+snapshot.d3.refined.join(', '):''}
    </span>
   </div>}
   {snapshot&&<details className="fp-d4-performance" aria-label="D4 Performance Integration">
    <summary>D4 · Performance <b>{snapshot.performance.backend==='worker'?'Worker':'CPU fallback'}</b>
     <span>{snapshot.performance.poseFps.toFixed(1)} FPS AI · lag {snapshot.performance.latestVideoLagMs.toFixed(0)} ms</span></summary>
    <div className="fp-d4-metrics">
     <span>Pipeline p50 / p95 <b>{snapshot.performance.pipelineP50Ms.toFixed(0)} / {snapshot.performance.pipelineP95Ms.toFixed(0)} ms</b></span>
     <span>Frame drop (busy) <b>{snapshot.performance.busyDrops}</b></span>
     <span>Hasil AI kedaluwarsa <b>{snapshot.performance.staleResults}</b></span>
     <span>Lag maksimum <b>{snapshot.performance.maxVideoLagMs.toFixed(0)} ms</b></span>
     <span>Backend <b>{snapshot.performance.backend}</b></span>
    </div>
    {snapshot.performance.fallbackReason&&<p role="status">Fallback: {snapshot.performance.fallbackReason}</p>}
    <small>MediaPipe multipose → D2 A/B → D3 crop 33 per aktor saat ID aman → gait → BODY/FLOOR. Crop gagal QA tetap memakai pose utama. MoveNet 384/512 masih benchmark terpisah.</small>
   </details>}
   {snapshot&&<span className="fp-video-actor-status" role="status"
    aria-label="Status masing-masing aktor MP4">
    {snapshot.actorStates.map(actor=><span key={actor.id}
     data-actor={actor.id} data-presence={actor.presence}>
     <b>{actor.id}</b> {videoActorPresenceLabel(actor.presence)}
    </span>)}
   </span>}
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
  <details className="fp-experiment-advanced-details">
   <summary>Lanjutan</summary>
   <div className="fp-experiment-advanced-content">
    <button type="button" className="fp-experiment-advanced" onClick={handleAdvanced}>
     <FlaskConical size={15}/> {kind==='video'?'Buka Video Motion Lab':'Buka Simulator 3D lengkap'}
    </button>
    <small>{kind==='video'?'Analisis pose dan gait di lab.':'Kontrol puppet 3D di lab.'}</small>
    <small>{status}</small>
   </div>
  </details>
 </section>;
}
