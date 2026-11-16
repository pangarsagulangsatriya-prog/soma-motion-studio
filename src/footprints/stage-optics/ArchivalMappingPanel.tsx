import {useEffect,useRef,useState,type ChangeEvent,type RefObject} from 'react';
import {Download,Film,Pause,Play,Trash2} from 'lucide-react';
import type {MotionFrame} from '../../engine/types.ts';
import type {MultiPoseGaitRouter} from '../live/MultiPoseGaitRouter.ts';
import {download} from '../../engine/recording.ts';
import {defaultFloorSpace} from '../spatial/coordinates.ts';
import {BRIDGE_DEFAULTS,ContactArchiveBridge,makeBridgeSimulationEvents,bridgeExport,
 type BridgeSnapshot} from './ContactArchiveBridge.ts';
import {paintContactArchivePad} from './ContactArchivePadPreview.ts';
import {buildLowerBodyMask,LOWER_BODY_MASK_DEFAULTS,sampleLowerBodyFrame} from './LowerBodyMaskEngine.ts';
import {archiveSessionReport,compositeArchivalFrame,DEFAULT_ARCHIVE_PLAYBACK,
 type ArchivePlayback,type ArchivePixels,type ArchiveSettings,type ArchiveSlot,type ArchiveSources} from './ArchivalCompositeEngine.ts';
import './archival-mapping.css';

type Props={frameRef:RefObject<MotionFrame>;cameraOn:boolean;performerCount:1|2;
 router:MultiPoseGaitRouter};
const slots=['A','B'] as const;
const allowedTypes=new Set(['video/mp4','video/webm','video/ogg','video/quicktime']);
const maxBytes=300*1024*1024;
const percentage=(x:number)=>Math.round(x*100);
export function ArchivalMappingPanel({frameRef,cameraOn,performerCount,router}:Props){
 const canvas=useRef<HTMLCanvasElement>(null);
 const padCanvas=useRef<HTMLCanvasElement>(null);
 const contactBridge=useRef(new ContactArchiveBridge()).current;
 const thumbnails=useRef(new Map<string,HTMLCanvasElement>());
 const lastBridgeView=useRef('');
 const bridgeStateRef=useRef<BridgeSnapshot>(contactBridge.snapshot(0));
 const simulationClock=useRef(0);
 const lastHold=useRef({A:false,B:false});
 const videoRefs=useRef<{A:HTMLVideoElement|null;B:HTMLVideoElement|null}>({A:null,B:null});
 const urls=useRef<{A:string|null;B:string|null}>({A:null,B:null});
 const imageCanvases=useRef<{A:HTMLCanvasElement|null;B:HTMLCanvasElement|null}>({A:null,B:null});
 const phase=useRef(0),lastTime=useRef(0),renderCount=useRef(0);
 const [files,setFiles]=useState<{A:string|null;B:string|null}>({A:null,B:null});
 const [source,setSource]=useState<'simulation'|'live'>('simulation');
 const [playing,setPlaying]=useState(false);
 const [bridgeEnabled,setBridgeEnabled]=useState(false);
 const [bridgeHoldMs,setBridgeHoldMs]=useState(BRIDGE_DEFAULTS.holdMs);
 const [bridgeView,setBridgeView]=useState({
  contacts:0,fragments:0,drags:0,skipped:0,heldA:false,heldB:false,
  recent:'' as string,status:'Matikan/aktifkan Bridge untuk memulai simulasi.'});
 const [overlap,setOverlap]=useState(false);
 const [settings,setSettings]=useState<ArchiveSettings>({
  A:{...DEFAULT_ARCHIVE_PLAYBACK},B:{...DEFAULT_ARCHIVE_PLAYBACK,zoom:1.35,contrast:1.3}});
 const [status,setStatus]=useState('Unggah video arsip untuk performer A dan B.');
 const [renderStatus,setRenderStatus]=useState<'blackout'|'partial'|'ready'>('blackout');
 const [lit,setLit]=useState(0);
 const [torso,setTorso]=useState(.19);
 const [feather,setFeather]=useState(2);
 const stateRef=useRef({source,playing,overlap,settings,torso,feather,
  bridgeEnabled,bridgeHoldMs});
 stateRef.current={source,playing,overlap,settings,torso,feather,
  bridgeEnabled,bridgeHoldMs};
 useEffect(()=>()=>{for(const key of slots){
  videoRefs.current[key]?.pause();
  if(urls.current[key])URL.revokeObjectURL(urls.current[key]!);
  urls.current[key]=null;
 }},[]);
 const setVideo=(slot:ArchiveSlot,file:File|null)=>{
  const video=videoRefs.current[slot];
  if(!video)return;
  if(file&&(!allowedTypes.has(file.type)||file.size<=0||file.size>maxBytes)){
   setStatus('Gunakan video MP4/WebM/Ogg/MOV berukuran maksimal 300 MB.');return;
  }
  contactBridge.reset();thumbnails.current.clear();
  simulationClock.current=0;bridgeStateRef.current=contactBridge.snapshot(0);
  // Switching one file should not silently leave the other player's clock running.
  slots.forEach(k=>videoRefs.current[k]?.pause());
  video.removeAttribute('src');video.load();
  if(urls.current[slot])URL.revokeObjectURL(urls.current[slot]!);
  urls.current[slot]=null;
  setFiles(prev=>({...prev,[slot]:null}));
  if(!file){setStatus('Video '+slot+' dilepas dari preview.');return;}
  const url=URL.createObjectURL(file);urls.current[slot]=url;video.src=url;
  video.loop=true;video.muted=true;video.playsInline=true;video.preload='auto';video.load();
  setFiles(prev=>({...prev,[slot]:file.name}));
  setPlaying(false);setStatus('Video '+slot+' dimuat secara lokal; klik Putar.');
 };
 const selectFile=(slot:ArchiveSlot,e:ChangeEvent<HTMLInputElement>)=>{
  setVideo(slot,e.target.files?.[0]??null);e.target.value='';
 };
 const resetBridge=()=>{
  // Explicit reset is a user gesture: restart footage paused by a prior hold
  // when playback is still requested. Reset must not leave clips stuck paused.
  if(playing)for(const slot of slots){
   if(lastHold.current[slot])void videoRefs.current[slot]?.play().catch(()=>{});
  }
  contactBridge.reset();thumbnails.current.clear();simulationClock.current=0;
  lastHold.current={A:false,B:false};
  bridgeStateRef.current=contactBridge.snapshot(0);
  lastBridgeView.current='';
  setBridgeView({contacts:0,fragments:0,drags:0,skipped:0,heldA:false,heldB:false,
   recent:'',status:'Bridge dikosongkan. Arsip pad sebelumnya hilang dari preview.'});
 };
 const toggleBridge=()=>{
  resetBridge();setBridgeEnabled(v=>!v);
 };
 const playback=async()=>{
  if(playing){slots.forEach(k=>videoRefs.current[k]?.pause());setPlaying(false);return;}
  const active=slots.filter(k=>files[k]&&videoRefs.current[k]?.readyState&&videoRefs.current[k]!.readyState>=2);
  if(!active.length){setStatus('Tunggu file video selesai dibaca sebelum memutar.');return;}
  const results=await Promise.allSettled(active.map(k=>videoRefs.current[k]!.play()));
  if(results.some(x=>x.status==='rejected')){
   slots.forEach(k=>videoRefs.current[k]?.pause());
   setPlaying(false);setStatus('Browser menolak playback. Tekan Putar kembali setelah video siap.');
  }else{setPlaying(true);setStatus('Video arsip diputar di preview lokal.');}
 };
 const patch=(slot:ArchiveSlot,key:keyof ArchivePlayback,value:number|boolean)=>{
  setSettings(prev=>({...prev,[slot]:{...prev[slot],[key]:value}}));
 };
 useEffect(()=>{contactBridge.configure({...BRIDGE_DEFAULTS,holdMs:bridgeHoldMs});},
  [contactBridge,bridgeHoldMs]);
 useEffect(()=>{
  for(const slot of slots){
   const video=videoRefs.current[slot];
   if(video)video.playbackRate=settings[slot].speed;
  }
 },[settings.A.speed,settings.B.speed]);
 useEffect(()=>{
  const target=canvas.current,ctx=target?.getContext('2d');
  if(!target||!ctx)return;
  let raf=0,lastPaint=0,lastState='';
  const image=()=>{const images:ArchiveSources={A:null,B:null};
   for(const slot of slots){
    const video=videoRefs.current[slot];
    if(!video||!urls.current[slot]||video.readyState<2||!video.videoWidth||!video.videoHeight){
     images[slot]=null;continue;
    }
    let cv=imageCanvases.current[slot];
    if(!cv){cv=document.createElement('canvas');imageCanvases.current[slot]=cv;}
    // Preserve the actual video aspect ratio before its image is cropped against
    // a moving person's bounding box. Portrait archival clips stay portrait.
    const h=Math.max(48,Math.min(384,Math.round(192*video.videoHeight/video.videoWidth)));
    if(cv.width!==192)cv.width=192;
    if(cv.height!==h)cv.height=h;
    const g=cv.getContext('2d',{willReadFrequently:true});
    if(!g)continue;
    try{
     g.drawImage(video,0,0,cv.width,cv.height);
     const img=g.getImageData(0,0,cv.width,cv.height);
     images[slot]={width:img.width,height:img.height,data:img.data};
    }catch{images[slot]=null;}
   }
   return images;
  };
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);
   if(now-lastPaint<1000/15)return;
   const delta=lastTime.current?Math.max(0,Math.min(150,now-lastTime.current)):0;
   lastTime.current=now;lastPaint=now;renderCount.current++;
   const s=stateRef.current;
   if(s.source==='simulation'&&s.playing){
    phase.current=(phase.current+delta/900)%(Math.PI*2);
    simulationClock.current+=delta;
   }
   const frame=s.source==='simulation'?
    sampleLowerBodyFrame(now,performerCount,phase.current,s.overlap):
    cameraOn?frameRef.current:null;
   const mask=buildLowerBodyMask(frame,{
    ...LOWER_BODY_MASK_DEFAULTS,performers:performerCount,
    featherPx:s.feather,torsoExtension:s.torso,
    requireSegmentation:s.source==='live'
   },now,s.source==='live'?'camera':'simulation');
   const routing=router.status;
   const stable=s.source==='simulation'||performerCount===1||
    (!routing.ambiguous&&routing.mode===2&&routing.visible.includes('A')&&
     routing.visible.includes('B')&&routing.observedFrameTime===frame?.time);
   const identity=performerCount===1?{A:0,B:null}:
    s.source==='simulation'?{A:0,B:1}:stable?routing.poseIndices:{A:null,B:null};
   const safeMask=stable?mask:{...mask,status:'ambiguous' as const,
    reason:'Identitas A/B belum terkonfirmasi pada frame yang sama.'};
   const images=image();
   const composed=compositeArchivalFrame(safeMask,images,s.settings,identity,renderCount.current);
   if(s.bridgeEnabled){
    const floor=router.floor.floor??defaultFloorSpace(8,6);
    const simulated=makeBridgeSimulationEvents(floor,performerCount);
    const feed=s.source==='simulation'?simulated:router.floor.session?.events??[];
    const trusted=mask.status==='ready'&&stable&&composed.status!=='blackout'&&
     (s.source==='simulation'||(cameraOn&&router.floor.isConfirmed));
    const context=s.source==='simulation'?'simulated-footprint-v1:'+performerCount:
     JSON.stringify([router.floor.boundCamera,router.floor.calibrationData,performerCount]);
    const clock=s.source==='simulation'?simulationClock.current%11000:now;
    const snap=contactBridge.sync(feed,clock,context,floor,images,
     s.source==='simulation'?'simulation':'camera',trusted,s.source==='live');
    bridgeStateRef.current=snap;
    const panel=padCanvas.current;
    if(panel)paintContactArchivePad(panel,floor,snap,trusted,thumbnails.current);
    // Pauses are intentionally per-source: A's touchdown must not freeze B.
    // Resume only after an explicit user-play request; no background autoplay.
    for(const slot of slots){
     const video=videoRefs.current[slot],held=snap.holdActive[slot];
     if(video&&held&&!lastHold.current[slot])video.pause();
     if(video&&!held&&lastHold.current[slot]&&s.playing)
      void video.play().catch(()=>{});
     lastHold.current[slot]=held;
    }
    const preview={contacts:snap.contactCount,fragments:snap.residueCount,
     drags:snap.dragCount,skipped:snap.skipped,heldA:snap.holdActive.A,
     heldB:snap.holdActive.B,recent:snap.recent.at(-1)?.description??'Belum ada kontak baru.',
     status:snap.reason};
    const key=JSON.stringify(preview);
    if(key!==lastBridgeView.current){
     lastBridgeView.current=key;setBridgeView(preview);
    }
   }else{
    const pad=padCanvas.current;
    if(pad){const g=pad.getContext('2d');if(g){g.fillStyle='#000';g.fillRect(0,0,pad.width,pad.height);}}
   }
   if(target.width!==composed.pixels.width)target.width=composed.pixels.width;
   if(target.height!==composed.pixels.height)target.height=composed.pixels.height;
   // Browser ImageData expects a concretely backed ArrayBuffer; copy into
   // canvas-allocated storage rather than passing Uint8ClampedArray<ArrayBufferLike>.
   const outputImage=ctx.createImageData(composed.pixels.width,composed.pixels.height);
   outputImage.data.set(composed.pixels.data);
   ctx.putImageData(outputImage,0,0);
   const state=composed.status+':'+composed.reason;
   if(state!==lastState){lastState=state;setStatus(composed.reason);setRenderStatus(composed.status);}
   setLit(prev=>Math.abs(prev-composed.litPixels)>150?composed.litPixels:prev);
  };
  raf=requestAnimationFrame(paint);
  return()=>{cancelAnimationFrame(raf);lastTime.current=0;lastHold.current={A:false,B:false};};
 },[frameRef,cameraOn,performerCount,router]);
 const exportJson=()=>download(new Blob([JSON.stringify(
  archiveSessionReport(settings,files,performerCount),null,2)],{type:'application/json'}),
  'SOMA-S5-7-2-archive-preview-settings.json');
 const exportBridge=()=>{
  const floor=router.floor.floor??defaultFloorSpace(8,6);
  const report=bridgeExport(bridgeStateRef.current,
   source==='simulation'?'simulation':'camera',
   {...BRIDGE_DEFAULTS,holdMs:bridgeHoldMs},files,floor);
  download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),
   'SOMA-S5-7-3-contact-archive-preview.json');
 };
 return <section className="archive-map" aria-label="S5.7.2 Archival Video Mapping">
  <div className="live-floor-heading"><Film size={15}/> S5.7.2–S5.7.3 / ARCHIVAL VIDEO & CONTACT BRIDGE</div>
  <p>Masukkan potongan video asli dari perangkat Anda, misalnya kaki berjalan di sawah, area industri, atau pelabuhan. Dua sumber video dipotong oleh mask tubuh A/B secara independen. Video tetap di browser ini.</p>
  <div className="archive-map-output">
   <canvas ref={canvas} width={160} height={90} aria-label="Pratinjau hitam-putih arsip dalam dua mask tubuh, area lain hitam"/>
   <div className="archive-map-overlay"><span>{source==='live'?'LIVE SOMA CAMERA':'SIMULATION'} · {renderStatus.toUpperCase()}</span><span>{performerCount} BODY</span></div>
  </div>
  <div className="archive-bridge-panes" aria-label="Pratinjau pad kontak di samping tubuh">
   <div><b>PAD / FROZEN ARCHIVE RESIDUES</b>
    <canvas ref={padCanvas} width={640} height={360}
     aria-label="Pad hitam berisi fragmen gambar asli yang tertinggal di titik kontak kaki"/>
   </div>
  </div>
  <div className="archive-map-transport">
   <button type="button" onClick={playback}><>{playing?<Pause size={14}/>:<Play size={14}/>}</>{playing?'Jeda video':'Putar video'}</button>
   <label>Sumber mask<select value={source} onChange={e=>{
     slots.forEach(k=>videoRefs.current[k]?.pause());setPlaying(false);
     resetBridge();setSource(e.target.value as 'simulation'|'live');setLit(0);
    }}>
    <option value="simulation">Simulasi gerak tanpa kamera</option>
    <option value="live">SOMA Body aktif (mask dikunci saat ambigu)</option>
   </select></label>
   {source==='simulation'&&<label className="archive-map-check"><input type="checkbox" checked={overlap} onChange={e=>setOverlap(e.target.checked)}/> Uji crossing / blackout</label>}
  </div>
  <div className="archive-map-slots">
   {slots.filter(s=>s==='A'||performerCount===2).map(slot=>
    <div className="archive-map-slot" key={slot}>
     <b>PERFORMER {slot}</b>
     <video ref={element=>{videoRefs.current[slot]=element;}} hidden muted playsInline preload="metadata" loop
      onError={()=>setStatus('Video '+slot+' tidak dapat dibaca. Coba MP4/WebM yang didukung browser.')}
      aria-label={'Video arsip lokal '+slot}/>
     <label>Arsip lokal untuk {slot}<input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime,.mov"
      onChange={e=>selectFile(slot,e)}/></label>
     <div className="archive-map-file"><span>{files[slot]??'Belum memilih arsip'}</span>
      <button type="button" onClick={()=>setVideo(slot,null)} disabled={!files[slot]} aria-label={'Lepas video '+slot}><Trash2 size={14}/></button></div>
     {([
      ['speed','Kecepatan',.25,2,.05,'×'],
      ['zoom','Crop / zoom',1,3,.05,'×'],
      ['panX','Geser horizontal',-1,1,.05,''],
      ['panY','Geser vertikal',-1,1,.05,''],
      ['contrast','Kontras',.5,2,.05,'×'],
      ['brightness','Terang',.1,1.8,.05,'×'],
      ['grain','Butiran film',0,.65,.01,''],
      ['opacity','Kekuatan arsip',0,1,.05,'']
     ] as const).map(([key,label,min,max,step,unit])=>
      <label key={key}>{label} · {settings[slot][key].toFixed(2)}{unit}
       <input type="range" min={min} max={max} step={step}
        value={settings[slot][key]} onChange={e=>patch(slot,key,Number(e.target.value))}/></label>)}
     <label className="archive-map-check"><input type="checkbox" checked={settings[slot].invert}
      onChange={e=>patch(slot,'invert',e.target.checked)}/> Balik negatif hitam-putih</label>
    </div>)}
  </div>
  <div className="archive-bridge-controls">
   <b>03 / CONTACT-TO-ARCHIVE BRIDGE</b>
   <p>Kontak kaki menghentikan video yang bersangkutan untuk beberapa saat dan membekukan satu potongan frame asli pada pad. Slide menambah jalur. Release tidak menghapus arsip yang tertinggal. Fitur ini hanya preview.</p>
   <div className="archive-bridge-actions">
    <button type="button" aria-pressed={bridgeEnabled} onClick={toggleBridge}>
     {bridgeEnabled?'Nonaktifkan Bridge':'Aktifkan Bridge'}
    </button>
    <button type="button" onClick={resetBridge}>Hapus fragmen & mulai ulang</button>
    <button type="button" onClick={exportBridge} disabled={!bridgeEnabled}>
     <Download size={14}/> Ekspor event JSON
    </button>
   </div>
   <label>Kontak menahan video · {bridgeHoldMs} ms
    <input type="range" min="0" max="1500" step="30" value={bridgeHoldMs}
     onChange={e=>setBridgeHoldMs(Number(e.target.value))}/>
   </label>
   <div className="archive-bridge-metrics" role="status">
    <span>Kontak: <b>{bridgeView.contacts}</b></span>
    <span>Fragmen tersimpan: <b>{bridgeView.fragments}</b></span>
    <span>Seretan: <b>{bridgeView.drags}</b></span>
    <span>Hold A/B: <b>{bridgeView.heldA?'A ':''}{bridgeView.heldB?'B':'—'}</b></span>
   </div>
   <p>{bridgeEnabled?bridgeView.recent:'Bridge tidak aktif.'} {bridgeEnabled&&bridgeView.status}</p>
  </div>
  <div className="archive-map-mask-controls">
   <label>Batas paha → perut · {percentage(torso)}% torso
    <input type="range" min="0" max=".35" step=".01" value={torso}
     onChange={e=>setTorso(Number(e.target.value))}/></label>
   <label>Feather ke dalam · {feather} px
    <input type="range" min="0" max="6" step="1" value={feather}
     onChange={e=>setFeather(Number(e.target.value))}/></label>
  </div>
  <div className="archive-map-result" role="status">{status} · Pixel bercahaya: {lit}</div>
  <button type="button" onClick={exportJson}><Download size={14}/> Ekspor pengaturan JSON</button>
  <p className="archive-map-caution">Ini pratinjau lokal. Belum ada output proyektor, kalibrasi tubuh 3D, penanda arsip historis, atau pengiriman video. Pergantian urutan pose aman hanya saat router identitas A/B menyetujui kedua pose dalam frame yang sama. Kehilangan tracking atau crossing ambigu memadamkan seluruh arsip.</p>
 </section>;
}
