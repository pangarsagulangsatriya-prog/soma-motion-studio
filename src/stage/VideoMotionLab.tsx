import {useEffect,useRef,useState,type ChangeEvent,type DragEvent,type KeyboardEvent} from 'react';
import {Download,Film,Image as ImageIcon,Pause,Play,RotateCcw,SkipBack,SkipForward,UploadCloud,Volume2,VolumeX,X} from 'lucide-react';
import {VIDEO_LAB_FPS,VIDEO_LAB_SPEEDS,clampVideoTime,finiteDuration,formatVideoTime,simpleVideoFilename,
 stepVideoTime,validLoopRange,validVideoLabFile,type LoopRange} from './videoMotionLabUtils.ts';
import './video-motion-lab.css';

type Clip={name:string;size:number;type:string;url:string;lastModified:number};
const readableSize=(n:number)=>n>=1024*1024?(n/(1024*1024)).toFixed(1)+' MB':(n/1024).toFixed(1)+' KB';
const formatResolution=(w:number,h:number)=>w>0&&h>0?w+' × '+h:'—';
type Props={onClose:()=>void};
export function VideoMotionLab({onClose}:Props){
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
 const videoRef=useRef<HTMLVideoElement>(null);
 const fileRef=useRef<HTMLInputElement>(null);
 const lastUrl=useRef<string|null>(null);
 const loopRef=useRef({loop,rangeStart,rangeEnd,duration});
 loopRef.current={loop,rangeStart,rangeEnd,duration};
 const filename=clip?simpleVideoFilename(clip.name):'video';
 const range=rangeStart!==null&&rangeEnd!==null?validLoopRange(rangeStart,rangeEnd,duration):null;
 const loadFile=(file:File)=>{
  const error=validVideoLabFile(file);
  if(error){setMessage(error);return;}
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
 useEffect(()=>()=>{if(lastUrl.current)URL.revokeObjectURL(lastUrl.current);},[]);
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
   el.currentTime=section.start;
  }
 };
 const seek=(n:number)=>{
  const el=videoRef.current;if(!el||!ready)return;
  const next=clampVideoTime(n,duration);
  el.currentTime=next;setPosition(next);
 };
 const step=(direction:-1|1)=>{
  const el=videoRef.current;if(!el||!ready)return;
  el.pause();setPlaying(false);
  seek(stepVideoTime(el.currentTime,duration,fps,direction));
 };
 const togglePlay=async()=>{
  const el=videoRef.current;if(!el||!ready)return;
  if(!el.paused){el.pause();setPlaying(false);return;}
  if(el.ended)seek(0);
  try{await el.play();setPlaying(true);setMessage('Video diputar secara lokal. Tracking Pose/Gait belum aktif pada tahap ini.');}
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
  const data={
   schema:'soma.video-motion-lab',version:1,exportedAt:new Date().toISOString(),
   file:{name:clip.name,bytes:clip.size,mime:clip.type,lastModified:clip.lastModified},
   video:{durationSeconds:duration,width:resolution.width,height:resolution.height},
   playback:{positionSeconds:position,speed,muted,stepFpsAssumption:fps,
    loopEnabled:loop&&!!range,loopRange:range},
   annotation:{poseTracking:false,gaitEvents:false,physicalFloorCalibrated:false},
   notice:'S6.5.2 hanya menyimpan metadata. Berkas video tidak disertakan.'
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
  videoRef.current?.pause();setPlaying(false);
  setClip(null);setReady(false);setDuration(0);setPosition(0);resetMarks();
  setResolution({width:0,height:0});
  if(lastUrl.current){URL.revokeObjectURL(lastUrl.current);lastUrl.current=null;}
  setMessage('Video dilepas dari Lab. Tidak ada berkas yang diunggah ke server.');
 };
 return <section className="soma-video-lab" role="region" aria-label="S6.5.2 Video Motion Lab"
  tabIndex={0} onKeyDown={keyDown}>
  <header className="vml-heading">
   <div><small>SOMA / S6.5.2 · EXPERIMENTAL INPUT</small><h2><Film size={22}/> Video Motion Lab</h2>
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
      onTimeUpdate={syncPosition} onSeeked={syncPosition} onDurationChange={e=>{
       const d=finiteDuration(e.currentTarget.duration);setDuration(d);if(!d)setReady(false);
      }}
      onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
      onWaiting={()=>setBuffering(true)} onPlaying={()=>setBuffering(false)}
      onEnded={()=>setPlaying(false)}
      onError={()=>{setReady(false);setPlaying(false);setMessage('Browser gagal membaca video. Coba MP4 H.264/AAC atau WebM VP8/VP9.');}}
      aria-label="Video rekaman lokal"/>
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
     <button type="button" disabled={!range} onClick={()=>{if(range){seek(range.start);setLoop(x=>!x);}}} aria-pressed={loop}>Loop IN–OUT {loop?'ON':'OFF'}</button>
     <button type="button" disabled={rangeStart===null&&rangeEnd===null} onClick={resetMarks}>Hapus rentang</button>
     <small>{range?'Rentang '+formatVideoTime(range.start)+' – '+formatVideoTime(range.end):'Tandai awal dan akhir untuk loop latihan'}</small>
    </div>
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
     <p><strong>S6.5.2 · Playback siap.</strong> Pose/Gait, event Contact, identitas A/B, dan transformasi BODY/FLOOR dari video belum dihitung pada sprint ini.</p>
     <p>Frame stepping menggunakan asumsi fps yang Anda pilih. HTML video dapat seek ke frame terdekat; hasilnya belum frame-accurate.</p>
     <p>Video lokal tidak memberi persetujuan kalibrasi panggung atau membuka keluaran proyektor fisik.</p>
    </div>
   </aside>
  </div>
  <input ref={fileRef} type="file" accept=".mp4,.m4v,.webm,.ogv,.ogg,video/mp4,video/webm,video/ogg"
   onChange={changeFile} className="vml-hidden-input" aria-label="Pilih video MP4 atau WebM"/>
 </section>;
}
