import {useCallback,useEffect,useRef,useState,type ChangeEvent,type DragEvent,type KeyboardEvent} from 'react';
import {Download,Film,Image as ImageIcon,Pause,Play,RotateCcw,SkipBack,SkipForward,UploadCloud,Volume2,VolumeX,X} from 'lucide-react';
import {VideoPoseGaitEngine,type ReplayAnalysisSnapshot} from './VideoPoseGaitEngine.ts';
import {drawSkeletonBodies,replaySkeletonPresentation} from './fullBodySkeleton.ts';
import {HandLimbInspector} from './HandLimbInspector.tsx';
import {MotionSemanticsInspector} from './MotionSemanticsInspector.tsx';
import {videoActorPresenceLabel,type VideoActorId} from './videoAutoActorTracker.ts';
import {TemporalJointInspector} from './TemporalJointInspector.tsx';
import {ReplayPerformanceInspector} from './ReplayPerformanceInspector.tsx';
import {subscribeReplayFrames} from './replayFrameClock.ts';
import {VideoSurfaceComposer} from './VideoSurfaceComposer.tsx';
import {replayEventCounts} from './videoGaitAnalysis.ts';
import {buildReplayEventExport,replayEventsCsv} from './videoReplayExport.ts';
import type {ReplayReport} from './rehearsalComparisonModel.ts';
import {VIDEO_LAB_FPS,VIDEO_LAB_SPEEDS,clampVideoTime,finiteDuration,formatVideoTime,simpleVideoFilename,
 stepVideoTime,validLoopRange,validVideoLabFile,type LoopRange} from './videoMotionLabUtils.ts';
import './video-motion-lab.css';

type Clip={name:string;size:number;type:string;url:string;lastModified:number};
const readableSize=(n:number)=>n>=1024*1024?(n/(1024*1024)).toFixed(1)+' MB':(n/1024).toFixed(1)+' KB';
const formatResolution=(w:number,h:number)=>w>0&&h>0?w+' × '+h:'—';
type Props={onClose:()=>void;onUseReference?:(report:ReplayReport)=>void;initialFile?:File|null};
export function VideoMotionLab({onClose,onUseReference,initialFile}:Props){
 const [clip,setClip]=useState<Clip|null>(null);
 const [duration,setDuration]=useState(0);
 const [position,setPosition]=useState(0);
 const [ready,setReady]=useState(false);
 const [playing,setPlaying]=useState(false);
 const [buffering,setBuffering]=useState(false);
 const [fps,setFPS]=useState<number>(30);
 const [speed,setSpeed]=useState(1);
 const [muted,setMuted]=useState(true);
 const [rangeStart,setRangeStart]=useState<number|null>(null);
 const [rangeEnd,setRangeEnd]=useState<number|null>(null);
 const [loop,setLoop]=useState(false);
 const [resolution,setResolution]=useState({width:0,height:0});
 const [dropActive,setDropActive]=useState(false);
 const [message,setMessage]=useState('Pilih video dari perangkat untuk memulai.');
 const [analysisOn,setAnalysisOn]=useState(false);
 const [composerOpen,setComposerOpen]=useState(false);
 const [analysisBusy,setAnalysisBusy]=useState(false);
 const [analysisError,setAnalysisError]=useState('');
 const [replayPeople,setReplayPeople]=useState<'auto'|1|2>('auto');
 const [analysisSnapshot,setAnalysisSnapshot]=useState<ReplayAnalysisSnapshot|null>(null);
 const snapshotRef=useRef<ReplayAnalysisSnapshot|null>(null);
 snapshotRef.current=analysisSnapshot;
 const engineRef=useRef<VideoPoseGaitEngine|null>(null);
 const getTemporalTrace=useCallback((actor:VideoActorId,joint:number)=>
  engineRef.current?.getTemporalTrace(actor,joint)??[],[]);
 const getTemporalWindow=useCallback(()=>
  engineRef.current?.getTemporalWindow()??[],[]);
 const getHandLimbWindow=useCallback(()=>
  engineRef.current?.getHandLimbWindow()??[],[]);
 const generationRef=useRef(0);
 const pendingSeekReason=useRef('Pemutaran berpindah ke waktu lain.');
 const overlayRef=useRef<HTMLCanvasElement|null>(null);
 const videoRef=useRef<HTMLVideoElement>(null);
 const fileRef=useRef<HTMLInputElement>(null);
 const lastUrl=useRef<string|null>(null);
 const loopRef=useRef({loop,rangeStart,rangeEnd,duration});
 loopRef.current={loop,rangeStart,rangeEnd,duration};
 const filename=clip?simpleVideoFilename(clip.name):'video';
 const analysisCounts=analysisSnapshot?.gaitCounts??replayEventCounts(analysisSnapshot?.events??[]);
 const qa=analysisSnapshot?.qa;
 const archivedStats=engineRef.current?.archiveStats;
 const archiveCount=archivedStats?.segments??0;
 const totalEventCount=(analysisSnapshot?.totalEventCount??0)+(archivedStats?.events??0);
 const download=(name:string,mime:string,content:string)=>{
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 const getReport=()=>{
  if(!clip||!analysisOn||!analysisSnapshot||!ready)return null;
  return buildReplayEventExport({
   file:{name:clip.name,bytes:clip.size,mime:clip.type,lastModified:clip.lastModified},
   video:{durationSeconds:duration,width:resolution.width,height:resolution.height},
   snapshot:engineRef.current?.snapshot??analysisSnapshot,archives:engineRef.current?.archivedSegments??[],
   discardedSegments:engineRef.current?.archiveOverflow??0,
   requestedAt:new Date().toISOString()
  });
 };
 const exportEvents=(type:'json'|'csv')=>{
  const report=getReport();
  if(!report){setMessage('Jalankan analisis video sebelum mengekspor event.');return;}
  download(filename+'-gait-events.'+type,
   type==='json'?'application/json':'text/csv;charset=utf-8',
   type==='json'?JSON.stringify(report,null,2):replayEventsCsv(report));
  setMessage('Ekspor '+type.toUpperCase()+' berisi '+report.summary.events+
   ' event dari '+report.summary.segments+' segmen replay. Video tidak ikut diekspor.');
 };
 const stopAnalysis=()=>{
  ++generationRef.current;
  engineRef.current?.dispose();engineRef.current=null;
  setAnalysisOn(false);setAnalysisBusy(false);setAnalysisSnapshot(null);
 };
 const startAnalysis=async()=>{
  const video=videoRef.current;
  if(!ready||!video||!clip)return;
  stopAnalysis();setAnalysisError('');setAnalysisBusy(true);
  const generation=++generationRef.current;
  const engine=new VideoPoseGaitEngine(snapshot=>{
   if(generation===generationRef.current)setAnalysisSnapshot(snapshot);
  });
  engineRef.current=engine;
  try{
   await engine.init();
   if(generation!==generationRef.current)return;
   engine.setPerformers(replayPeople);
   setAnalysisOn(true);
   engine.process(video,video.currentTime,18,true);
   setMessage('Analisis tujuh event gerak berjalan pada video lokal. Semua pengukuran memakai estimasi gambar 2D.');
  }catch(e){
   if(generation!==generationRef.current)return;
   const reason=e instanceof Error?e.message:String(e);
   setAnalysisError('Model pose belum tersedia: '+reason);
   engine.dispose();engineRef.current=null;
   setAnalysisOn(false);
  }finally{if(generation===generationRef.current)setAnalysisBusy(false);}
 };
 useEffect(()=>{
  const video=videoRef.current;
  if(!analysisOn||!clip||!ready||!video)return;
  return subscribeReplayFrames(video,(mediaTime,presentedFrames)=>{
   engineRef.current?.recordPresentedFrame(presentedFrames);
   engineRef.current?.process(video,mediaTime,18);
  });
 },[analysisOn,clip,ready]);
 useEffect(()=>{
  const canvas=overlayRef.current,video=videoRef.current;
  if(!canvas||!video)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  let raf=0,lastAt=0;
  const draw=(now:number)=>{
   if(now-lastAt>=1000/30||!analysisOn){
    lastAt=now;const started=performance.now();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const snapshot=snapshotRef.current;
    if(analysisOn&&snapshot&&video.videoWidth&&video.videoHeight){
     const scale=Math.min(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
     const width=scale*video.videoWidth,height=scale*video.videoHeight;
     const x=(canvas.width-width)/2,y=(canvas.height-height)/2,rect={x,y,width,height};
     const overlay=replaySkeletonPresentation(snapshot,video.currentTime*1000);
     drawSkeletonBodies(ctx,overlay.poses,rect,{labels:overlay.labels,colors:overlay.colors});
    }
    if(analysisOn)engineRef.current?.recordRender(performance.now()-started);
   }
   raf=requestAnimationFrame(draw);
  };
  raf=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(raf);ctx.clearRect(0,0,canvas.width,canvas.height);};
 },[analysisOn,clip,ready]);

 const range=rangeStart!==null&&rangeEnd!==null?validLoopRange(rangeStart,rangeEnd,duration):null;
 const loadFile=(file:File)=>{
  const error=validVideoLabFile(file);
  if(error){setMessage(error);return;}
  stopAnalysis();setAnalysisError('');setComposerOpen(false);
  const old=lastUrl.current;
  const url=URL.createObjectURL(file);
  lastUrl.current=url;
  videoRef.current?.pause();
  setClip({name:file.name,size:file.size,type:file.type||'video',url,lastModified:file.lastModified});
  setReady(false);setPlaying(false);setBuffering(false);setDuration(0);setPosition(0);
  setRangeStart(null);setRangeEnd(null);setLoop(false);
  setResolution({width:0,height:0});
  setMessage('Membaca metadata video…');
  if(old)URL.revokeObjectURL(old);
 };
 useEffect(()=>()=>{engineRef.current?.dispose();if(lastUrl.current)URL.revokeObjectURL(lastUrl.current);},[]);
 // S6.8.4: carry the locally selected Footprints clip into the advanced Lab.
 const importedInitialFile=useRef<File|null>(null);
 useEffect(()=>{
  if(!initialFile||importedInitialFile.current===initialFile)return;
  importedInitialFile.current=initialFile;loadFile(initialFile);
 },[initialFile]);
 const changeFile=(e:ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0];if(file)loadFile(file);e.target.value='';
 };
 const dropFile=(e:DragEvent<HTMLElement>)=>{
  e.preventDefault();setDropActive(false);
  const file=e.dataTransfer.files[0];if(file)loadFile(file);
 };
 const syncPosition=()=>{
  const el=videoRef.current;if(!el)return;
  setPosition(clampVideoTime(el.currentTime,finiteDuration(el.duration)||duration));
  const r=loopRef.current;
  const section=r.rangeStart!==null&&r.rangeEnd!==null?
   validLoopRange(r.rangeStart,r.rangeEnd,r.duration):null;
  if(r.loop&&section&&el.currentTime>=section.end-0.015){
   pendingSeekReason.current='Loop IN–OUT menuju '+section.start.toFixed(3)+' detik.';
   el.currentTime=section.start;
  }
 };
 const seek=(n:number,kind='Timeline scrub')=>{
  const el=videoRef.current;if(!el||!ready)return;
  const next=clampVideoTime(n,duration);
  if(Math.abs(el.currentTime-next)<.0005)return;
  pendingSeekReason.current=kind+' menuju '+next.toFixed(3)+' detik.';
  el.currentTime=next;setPosition(next);
 };
 const step=(direction:-1|1)=>{
  const el=videoRef.current;if(!el||!ready)return;
  el.pause();setPlaying(false);
  seek(stepVideoTime(el.currentTime,duration,fps,direction),direction<0?'Frame step mundur':'Frame step maju');
 };
 const togglePlay=async()=>{
  const el=videoRef.current;if(!el||!ready)return;
  if(!el.paused){el.pause();setPlaying(false);return;}
  if(el.ended)seek(0);
  try{await el.play();setPlaying(true);setMessage(analysisOn?'Membaca pose dan gait dari video…':'Video diputar secara lokal. Aktifkan Pose/Gait untuk memulai analisis.');}
  catch{setMessage('Browser belum dapat memutar berkas ini. Periksa codec video atau coba MP4 H.264.');}
 };
 const mark=(kind:'in'|'out')=>{
  if(!ready)return;
  const at=clampVideoTime(videoRef.current?.currentTime??position,duration);
  if(kind==='in'){setRangeStart(at);if(rangeEnd!==null&&rangeEnd<=at+0.05){setRangeEnd(null);setLoop(false);}}
  else{setRangeEnd(at);if(rangeStart!==null&&rangeStart>=at-0.05){setRangeStart(null);setLoop(false);}}
 };
 const resetMarks=()=>{setRangeStart(null);setRangeEnd(null);setLoop(false);};
 const snapshot=()=>{
  const video=videoRef.current;
  if(!video||!ready||video.readyState<2){setMessage('Tunggu frame video tampil terlebih dahulu.');return;}
  const w=video.videoWidth,h=video.videoHeight;
  if(!w||!h)return;
  const scale=Math.min(1,1920/w,1080/h);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.floor(w*scale));canvas.height=Math.max(1,Math.floor(h*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx){setMessage('Canvas untuk capture tidak tersedia.');return;}
  try{ctx.drawImage(video,0,0,canvas.width,canvas.height);}
  catch{setMessage('Frame tidak dapat diambil.');return;}
  canvas.toBlob(blob=>{
   if(!blob){setMessage('Capture PNG gagal.');return;}
   const href=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=href;
   a.download=filename+'-'+Math.round(position*1000)+'ms.png';a.click();
   window.setTimeout(()=>URL.revokeObjectURL(href),1200);
   setMessage('Frame PNG dibuat di perangkat ini.');
  },'image/png');
 };
 const exportSession=()=>{
  if(!clip||!ready)return;
  const report=getReport();
  const data={
   schema:'soma.video-motion-lab',version:1,exportedAt:new Date().toISOString(),
   file:{name:clip.name,bytes:clip.size,mime:clip.type,lastModified:clip.lastModified},
   video:{durationSeconds:duration,width:resolution.width,height:resolution.height},
   playback:{positionSeconds:position,speed,muted,stepFpsAssumption:fps,
    loopEnabled:loop&&!!range,loopRange:range},
   annotation:{poseTracking:analysisOn&&!!analysisSnapshot,gaitEvents:analysisOn&&!!analysisSnapshot,physicalFloorCalibrated:false},
   analysis:report?{
    schema:report.schema,version:report.version,
    summary:report.summary,identityQA:analysisSnapshot?.qa??null,
    segmentEndReasons:report.segments.map(s=>({segment:s.segment,reason:s.endReason}))
   }:null,
   notice:'Analisis berbasis landmark video 2D, bukan kontak lantai fisik. Video tidak disertakan.'
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const href=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=href;a.download=filename+'-motion-lab.json';a.click();
  window.setTimeout(()=>URL.revokeObjectURL(href),1200);
  setMessage('Metadata sesi diekspor sebagai JSON; video tetap di perangkat.');
 };
 const keyDown=(event:KeyboardEvent<HTMLElement>)=>{
  if(event.target instanceof HTMLElement&&event.target.closest('input,select,textarea,button,[contenteditable=true]'))return;
  if(!ready)return;
  if(event.code==='Space'){event.preventDefault();event.stopPropagation();void togglePlay();}
  if(event.code==='ArrowLeft'){event.preventDefault();event.stopPropagation();step(-1);}
  if(event.code==='ArrowRight'){event.preventDefault();event.stopPropagation();step(1);}
 };
 const removeFile=()=>{
  stopAnalysis();setAnalysisError('');setComposerOpen(false);
  videoRef.current?.pause();setPlaying(false);
  setClip(null);setReady(false);setDuration(0);setPosition(0);resetMarks();
  setResolution({width:0,height:0});
  if(lastUrl.current){URL.revokeObjectURL(lastUrl.current);lastUrl.current=null;}
  setMessage('Video dilepas dari Lab. Tidak ada berkas yang diunggah ke server.');
 };
 return <section className="soma-video-lab" role="region" aria-label="S6.5.3 Video Pose Gait Lab"
  tabIndex={0} onKeyDown={keyDown}>
  <header className="vml-heading">
   <div><small>SOMA / S6.5.4 · VIDEO → SURFACE COMPOSER</small><h2><Film size={22}/> Video Motion Lab</h2>
    <p>Video rekaman sebagai sumber latihan dan penelusuran frame. File tetap di browser; kamera dan output proyektor tidak berubah.</p></div>
   <button type="button" onClick={onClose}><X size={16}/> Tutup Lab</button>
  </header>
  <div className="vml-content">
   <div className="vml-main">
    {!clip&&<div className={'vml-dropzone'+(dropActive?' active':'')}
     onDragOver={e=>{e.preventDefault();setDropActive(true);}}
     onDragLeave={e=>{e.preventDefault();setDropActive(false);}}
     onDrop={dropFile}>
     <UploadCloud size={38}/>
     <h3>Masukkan video gerak</h3>
     <p>Seret MP4/WebM ke sini atau pilih dari perangkat.</p>
     <button type="button" className="vml-primary" onClick={()=>fileRef.current?.click()}>Pilih video</button>
     <small>MP4 · WebM · Ogg · maks. 500 MB · lokal di browser</small>
    </div>}
    <div className="vml-player" hidden={!clip}>
     <video key={clip?.url??'empty'} ref={videoRef} src={clip?.url??undefined}
      playsInline preload="auto" controls={false} muted={muted}
      onLoadedMetadata={e=>{
       const v=e.currentTarget;
       const length=finiteDuration(v.duration);
       setDuration(length);
       setResolution({width:v.videoWidth,height:v.videoHeight});
       setReady(length>0&&v.videoWidth>0&&v.videoHeight>0);
       setMessage(length>0?'Video siap. Gunakan timeline untuk menelusuri gerak.':'Durasi video tidak terbaca. Coba berkas lain.');
       v.playbackRate=speed;
      }}
      onTimeUpdate={syncPosition}
      onSeeking={()=>{if(engineRef.current){engineRef.current.reset(pendingSeekReason.current);pendingSeekReason.current='Pemutaran berpindah ke waktu lain.';}}}
      onSeeked={e=>{syncPosition();engineRef.current?.process(e.currentTarget,e.currentTarget.currentTime,18,true);}}
      onDurationChange={e=>{
       const d=finiteDuration(e.currentTarget.duration);setDuration(d);if(!d)setReady(false);
      }}
      onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
      onWaiting={()=>setBuffering(true)} onPlaying={()=>setBuffering(false)}
      onEnded={()=>setPlaying(false)}
      onError={()=>{setReady(false);setPlaying(false);setMessage('Browser gagal membaca video. Coba MP4 H.264/AAC atau WebM VP8/VP9.');}}
      aria-label="Video rekaman lokal"/>
     <canvas ref={overlayRef} className="vml-pose-overlay" width={960} height={540}
      aria-label="Overlay skeleton seluruh tubuh 33 landmark dari video"/>
     {analysisOn&&<span className="vml-overlay-badge">FULL BODY · {analysisSnapshot?.detectedCount??0} POSE TERDETEKSI</span>}
     {clip&&!ready&&<div className="vml-player-empty">Membuka video…</div>}
     {buffering&&ready&&<div className="vml-buffer">Memuat frame…</div>}
    </div>
    <div className="vml-play-controls">
     <div className="vml-time"><span>{formatVideoTime(position)}</span><span>{formatVideoTime(duration)}</span></div>
     <div className="vml-seek">
      <input type="range" min="0" max={Math.max(duration,.001)} step=".001"
       value={Math.min(position,Math.max(duration,.001))} disabled={!ready}
       onChange={e=>seek(Number(e.target.value))}
       aria-label="Geser timeline video"/>
      {duration>0&&rangeStart!==null&&<span className="vml-range-mark" style={{left:(rangeStart/duration*100)+'%'}} aria-hidden="true"/>}
      {duration>0&&rangeEnd!==null&&<span className="vml-range-mark end" style={{left:(rangeEnd/duration*100)+'%'}} aria-hidden="true"/>}
      {duration>0&&analysisOn&&analysisSnapshot?.events.slice(-120).map(event=>
       <span key={event.id} className={'vml-event-mark vml-event-'+event.kind}
        style={{left:(event.atMs/1000/duration*100)+'%'}} title={event.kind+' '+event.performer}
        aria-hidden="true"/> )}
     </div>
     <div className="vml-transport">
      <button type="button" disabled={!ready} onClick={()=>seek(0)} title="Kembali ke awal" aria-label="Kembali ke awal"><RotateCcw size={17}/></button>
      <button type="button" disabled={!ready} onClick={()=>step(-1)} title="Mundur satu langkah frame perkiraan" aria-label="Mundur satu frame perkiraan"><SkipBack size={18}/></button>
      <button type="button" className="vml-primary" disabled={!ready} onClick={()=>void togglePlay()}>{playing?<><Pause size={18}/> Jeda</>:<><Play size={18}/> Putar</>}</button>
      <button type="button" disabled={!ready} onClick={()=>step(1)} title="Maju satu langkah frame perkiraan" aria-label="Maju satu frame perkiraan"><SkipForward size={18}/></button>
      <button type="button" disabled={!ready} onClick={()=>setMuted(value=>!value)} aria-label={muted?'Aktifkan suara video':'Matikan suara video'}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>} {muted?'Audio Off':'Audio On'}</button>
      <label>Kecepatan<select value={speed} disabled={!ready} onChange={e=>{
       const rate=Number(e.target.value);setSpeed(rate);if(videoRef.current)videoRef.current.playbackRate=rate;
      }}>{VIDEO_LAB_SPEEDS.map(n=><option key={n} value={n}>{n}×</option>)}</select></label>
      <label>Langkah frame<select value={fps} disabled={!ready} onChange={e=>setFPS(Number(e.target.value))}>
       {VIDEO_LAB_FPS.map(n=><option key={n} value={n}>{n} fps</option>)}
      </select></label>
     </div>
    </div>
    <div className="vml-range-tools">
     <button type="button" disabled={!ready} onClick={()=>mark('in')}>Tandai IN</button>
     <button type="button" disabled={!ready} onClick={()=>mark('out')}>Tandai OUT</button>
     <button type="button" disabled={!range} onClick={()=>{if(range){seek(range.start,'Aktifkan loop IN–OUT');setLoop(x=>!x);}}} aria-pressed={loop}>Loop IN–OUT {loop?'ON':'OFF'}</button>
     <button type="button" disabled={rangeStart===null&&rangeEnd===null} onClick={resetMarks}>Hapus rentang</button>
     <small>{range?'Rentang '+formatVideoTime(range.start)+' – '+formatVideoTime(range.end):'Tandai awal dan akhir untuk loop latihan'}</small>
    </div>
    <section className="vml-analysis" aria-label="Analisis Pose dan Gait dari video">
     <div className="vml-analysis-head">
      <div><h3>Pose / Gait Analysis</h3>
       <p>Deteksi lokal dari MP4 menggunakan MediaPipe dan gait analyzer SOMA.</p></div>
      <label>Jumlah aktor<select value={replayPeople}
       aria-label="Mode jumlah aktor video"
       onChange={e=>{
        const v=e.target.value;
        const choice=v==='auto'?'auto':Number(v) as 1|2;
        setReplayPeople(choice);engineRef.current?.setPerformers(choice);
       }}>
       <option value="auto">Otomatis</option>
       <option value={1}>1 aktor (manual)</option>
       <option value={2}>2 aktor (manual)</option>
      </select></label>
     </div>
     <ReplayPerformanceInspector performance={analysisSnapshot?.performance??null}/>
     <div className="vml-analysis-actions">
      <button type="button" className="vml-primary" disabled={!ready||analysisBusy}
       onClick={()=>analysisOn?stopAnalysis():void startAnalysis()}>
       {analysisBusy?'Memuat model…':analysisOn?'Hentikan analisis':'Mulai analisis Pose / Gait'}</button>
      <button type="button" disabled={!analysisOn} onClick={()=>{
       engineRef.current?.reset('Identitas dan histori segmen direset secara manual oleh pengguna.');
       const v=videoRef.current;if(v)engineRef.current?.process(v,v.currentTime,18,true);
      }}>Reset identitas & event</button>
      <button type="button" disabled={!ready} aria-expanded={composerOpen}
       onClick={()=>setComposerOpen(current=>!current)}>{composerOpen?'Tutup BODY/FLOOR Composer':'Buka BODY/FLOOR Composer'}</button>
     </div>
     {analysisError&&<div role="alert" className="vml-analysis-error">{analysisError}</div>}
     <p className="vml-analysis-status" role="status">
      {analysisOn?(analysisSnapshot?.status??'Model siap, menunggu frame video.'):
       'Analisis belum aktif. Putar video atau gunakan frame stepping setelah mengaktifkan model.'}
     </p>
     {analysisOn&&<div className="vml-actor-readout" role="status"
       aria-label="Status deteksi aktor video">
       <strong>{analysisSnapshot?.detectedCount??0} pose terdeteksi · {analysisSnapshot?.performerMode==='auto'?'AUTO':'MANUAL'}</strong>
       {analysisSnapshot?.actorStates.map(actor=><span key={actor.id}
        data-actor={actor.id} data-presence={actor.presence}>
        <b>{actor.id}</b> · {videoActorPresenceLabel(actor.presence)}
       </span>)}
      </div>}
      <TemporalJointInspector
       getTrace={getTemporalTrace} getWindow={getTemporalWindow}
       revision={analysisSnapshot?.sampledFrames??0}
       segment={analysisSnapshot?.segment??0}/>
      <HandLimbInspector frame={analysisSnapshot?.handLimb??null}
       getHistory={getHandLimbWindow} segment={analysisSnapshot?.segment??0}/>
      <MotionSemanticsInspector events={analysisSnapshot?.semanticEvents??[]}
       totals={analysisSnapshot?.semanticTotals}
       statuses={analysisSnapshot?.semanticStatuses??[]}
       segment={analysisSnapshot?.segment??0} durationMs={duration*1000}/>
      {analysisOn&&<div className="vml-identity-qa" data-state={qa?.state??'waiting'}>
      <div className="vml-qa-top"><strong>Identity QA · {(analysisSnapshot?.performers??1)===2?'BODY A/B':'BODY A'}</strong>
       <span>{qa?.perActor?.some(a=>a.approved)?
        qa.perActor.every(a=>a.approved)?'A/B ACTIVE':'PARTIAL ACTIVE':
        qa?.state==='warming'?'WARMING':'HOLD'}</span></div>
      <p>{qa?.reason??'Menunggu frame analisis.'}</p>
      {qa?.perActor&&<div className="vml-recovery-actors" aria-label="Recovery dan QA setiap aktor">
       {qa.perActor.map(actor=><span key={actor.id} data-actor={actor.id}
        data-recovery={actor.state} data-approved={actor.approved}>
        <b>{actor.id}</b> {actor.approved?'Event aktif':
         actor.state==='reacquiring'?'Memulihkan ID':
         actor.state==='warming'?'Verifikasi '+actor.streak+'/'+qa.requiredFrames:
         actor.state==='occluded'?'Tertutup':
         actor.state==='lost'?'Keluar frame':'Ditahan'}
       </span>)}
      </div>}
      <div className="vml-qa-grid">
       <span><small>Frame stabil</small><b>{qa?.streak??0}/{qa?.requiredFrames??3}</b></span>
       <span><small>Confidence minimum</small><b>{Math.round((qa?.confidence??0)*100)}%</b></span>
       <span><small>Frame ditahan</small><b>{qa?.droppedFrames??0}</b></span>
       <span><small>Ambiguitas</small><b>{qa?.ambiguousFrames??0}</b></span>
      </div>
      <small>Reset terakhir: {qa?.lastResetReason??'Belum ada'} · segmen {analysisSnapshot?.segment??0}</small>
      {qa?.perActor?.some(a=>a.state==='uncertain')&&
       !qa.perActor.some(a=>a.approved)&&
       <p role="alert">Identitas A/B belum pasti. Kerangka mentah tetap tampil. Gunakan Reset identitas atau seek untuk membentuk identitas baru.</p>}
     </div>}
     <div className="vml-analysis-counters">
      <span><small>Frame dianalisis</small><b>{analysisSnapshot?.sampledFrames??0}</b></span>
      <span><small>Contact*</small><b>{analysisCounts.contact}</b></span>
      <span><small>Swing*</small><b>{analysisCounts.swing}</b></span>
      <span><small>Slide*</small><b>{analysisCounts.slide}</b></span>
      <span><small>Pivot*</small><b>{analysisCounts.pivot}</b></span>
     </div>
     {analysisOn&&<div className="vml-replay-export">
      <div><strong>Event Export</strong>
       <small>{archiveCount} segmen tersimpan + 1 segmen aktif · {totalEventCount} event tercatat</small></div>
      <button type="button" disabled={!analysisSnapshot} onClick={()=>exportEvents('json')}>Unduh JSON QA</button>
      <button type="button" disabled={!analysisSnapshot} onClick={()=>exportEvents('csv')}>Unduh CSV event</button>
      {onUseReference&&<button type="button" disabled={!analysisSnapshot}
       onClick={()=>{
        const report=getReport();
        if(!report||report.summary.events<1){
         setMessage('Belum ada event pijakan untuk dibandingkan. Putar video lebih lama.');return;
        }
        onUseReference(report);
       }}>Kirim ke Rehearsal Lab</button>}
      <small>Ekspor mencatat alasan reset, segmen replay, A/B, jenis event, waktu video, confidence, koordinat 2D, dan status QA. Batas retensi segmen/event dilaporkan agar data lama yang terpotong tidak dianggap lengkap.</small>
     </div>}
     {analysisOn&&<div className="vml-events">
      <strong>Event terdeteksi</strong>
      {analysisSnapshot?.events.length?analysisSnapshot.events.slice(-8).reverse().map(e=>
       <div key={e.id}><span>{formatVideoTime(e.atMs/1000)}</span>
        <b>BODY {e.performer} · {e.foot}</b><em>{e.kind}</em>
        <small>{Math.round(e.confidence*100)}%</small></div>):
       <p>Belum ada event. Rekam pijakan dengan kedua telapak terlihat.</p>}
     </div>}
     <small className="vml-analysis-disclaimer">*Estimasi berbasis gambar 2D. Tidak mengukur tekanan, gaya kontak, atau koordinat lantai dalam meter. Seeking dan looping menghapus histori analisis agar urutan gerak tetap valid.</small>
    </section>
    {composerOpen&&clip&&<VideoSurfaceComposer videoRef={videoRef} snapshot={analysisSnapshot}
     active={analysisOn&&ready} performers={analysisSnapshot?.performers??1} fileKey={clip.url}/>}
    <div className="vml-status" role="status" aria-live="polite">{message}</div>
   </div>
   <aside className="vml-inspector">
    <h3>Video</h3>
    <div className="vml-info">
     <div><span>Berkas</span><strong title={clip?.name}>{clip?.name??'Belum dipilih'}</strong></div>
     <div><span>Ukuran</span><strong>{clip?readableSize(clip.size):'—'}</strong></div>
     <div><span>Resolusi</span><strong>{formatResolution(resolution.width,resolution.height)}</strong></div>
     <div><span>Durasi</span><strong>{ready?formatVideoTime(duration):'—'}</strong></div>
     <div><span>Frame step</span><strong>{fps} fps (asumsi)</strong></div>
    </div>
    <button type="button" onClick={()=>fileRef.current?.click()}>
     <UploadCloud size={15}/>{clip?'Ganti video':'Pilih video'}
    </button>
    <button type="button" disabled={!ready} onClick={snapshot}><ImageIcon size={15}/> Capture frame PNG</button>
    <button type="button" disabled={!ready} onClick={exportSession}><Download size={15}/> Ekspor metadata JSON</button>
    <button type="button" disabled={!clip} onClick={removeFile}>Lepas video</button>
    <div className="vml-limits">
     <h3>Analisis gerak</h3>
     <p><strong>S6.5.3 · Pose/Gait Video.</strong> Pose A/B, estimasi fase kaki, serta Contact/Swing/Slide/Pivot dapat dianalisis setelah model diaktifkan. Semua tetap di browser.</p>
     <p>Frame stepping menggunakan asumsi fps yang Anda pilih. HTML video dapat seek ke frame terdekat; hasilnya belum frame-accurate.</p>
     <p>S6.5.4 memberi preview BODY A/B dan FLOOR lokal dengan layer, mask perkiraan, media arsip, preset, dan event recipe. Jalur ini tidak terhubung ke proyektor fisik.</p>
    </div>
   </aside>
  </div>
  <input ref={fileRef} type="file" accept=".mp4,.m4v,.webm,.ogv,.ogg,video/mp4,video/webm,video/ogg"
   onChange={changeFile} className="vml-hidden-input" aria-label="Pilih video MP4 atau WebM"/>
 </section>;
}
