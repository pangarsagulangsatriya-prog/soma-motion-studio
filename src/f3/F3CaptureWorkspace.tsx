import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,Camera,Check,ChevronDown,Download,Hand,Maximize2,RotateCcw,ShieldAlert,VideoOff} from 'lucide-react';
import {F3CameraRegistry} from './F3CameraRegistry.ts';
import {F3MotionFusion} from './F3MotionFusion.ts';
import {F3FramingController} from './F3FramingController.ts';
import {F3PunchEngine} from './F3PunchEngine.ts';
import {F3PhotoStore} from './F3PhotoStore.ts';
import {F3SessionMachine} from './F3SessionMachine.ts';
import {f3Zip} from './F3Zip.ts';
import {F3StageView} from './F3StageView.tsx';
import {makeF3StageFrame} from './F3StageRenderer.ts';
import {f3ProjectorGate,f3Blackout} from './F3OutputAdapter.ts';
import type {F3Role,F3CameraStatus,F3PunchPreset,F3StageFrame,F3MotionFrame} from './F3Types.ts';
import './f3.css';
const emptyStatus=(role:F3Role):F3CameraStatus=>({role,id:'',kind:'camera',state:'idle',lastFrameAt:0,frameId:0,videoTime:-1,message:'Pilih sumber'});
const startFrame=makeF3StageFrame({sourceId:'',frameId:0,timestamp:0,crop:{x:0,y:0,width:0,height:0},slots:[null,null,null,null],state:'BLACKOUT'});
export function F3CaptureWorkspace(){
 const registry=useRef(new F3CameraRegistry()),fusion=useRef(new F3MotionFusion());
 const framing=useRef(new F3FramingController()),punch=useRef(new F3PunchEngine());
 const archive=useRef(new F3PhotoStore()),session=useRef(new F3SessionMachine());
 const videoA=useRef<HTMLVideoElement>(null),videoB=useRef<HTMLVideoElement>(null);
 const stageHost=useRef<HTMLDivElement>(null),stageFrame=useRef<F3StageFrame>(startFrame);
 const [statuses,setStatuses]=useState({A:emptyStatus('A'),B:emptyStatus('B')});
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const [chosen,setChosen]=useState({A:'',B:''});
 const [stageMode,setStageMode]=useState<'setup'|'fullscreen'|'inline'>('setup');
 const [stageCount,setStageCount]=useState(0),[replacement,setReplacement]=useState<number|null>(null);
 const [consent,setConsent]=useState(false),[armed,setArmed]=useState(false);
 const [rehearsal,setRehearsal]=useState(false),[positive,setPositive]=useState(0);
 const [negativeConfirmed,setNegativeConfirmed]=useState(false),[verified,setVerified]=useState(false);
 const [preset,setPreset]=useState<F3PunchPreset>('straight');
 const [modelState,setModelState]=useState('Menunggu Kamera A');
 const [zoom,setZoom]=useState(.6),[message,setMessage]=useState('Hubungkan dua kamera untuk mencoba fullscreen.');
 const [busy,setBusy]=useState(false),[flash,setFlash]=useState(0);
 const [activeStep,setActiveStep]=useState<'camera'|'stage'|'photo'>('camera');
 const shutterEpoch=useRef(0);
 const sourceFiles=useRef<{A:string|null;B:string|null}>({A:null,B:null});
 const statusRef=useRef(statuses),control=useRef({consent,armed,rehearsal,stageMode,replacement,verified});
 statusRef.current=statuses;control.current={consent,armed,rehearsal,stageMode,replacement,verified};
 const refresh=useCallback(()=>setStatuses({A:registry.current.status('A'),B:registry.current.status('B')}),[]);
 const refreshDevices=useCallback(async()=>{
  try{const list=await navigator.mediaDevices?.enumerateDevices();
   if(list)setDevices(list.filter(d=>d.kind==='videoinput'));}
  catch{setMessage('Daftar kamera belum tersedia. Periksa izin browser.');}
 },[]);
 useEffect(()=>{
  if(!videoA.current||!videoB.current)return;
  const reg=registry.current;reg.attach('A',videoA.current);reg.attach('B',videoB.current);
  const off=reg.subscribe(refresh);void refreshDevices();
  return()=>{off();reg.dispose();fusion.current.dispose();archive.current.revokeAll();};
 },[refresh,refreshDevices]);
 const connect=async(role:F3Role)=>{
  try{
   if(!chosen[role])throw Error('Pilih perangkat Kamera '+role+'.');
   await registry.current.connectDevice(role,chosen[role]);sourceFiles.current[role]=null;
   await refreshDevices();refresh();
   setMessage('Menunggu frame baru Kamera '+role+'…');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal menyambungkan kamera.');}
 };
 const connectFixture=async(role:F3Role,file:File|undefined)=>{
  if(!file)return;
  try{
   if(!/\.mp4$/i.test(file.name)&&file.type!=='video/mp4')throw Error('Gunakan rekaman MP4.');
   const key=file.name+':'+file.size+':'+file.lastModified;
   if(sourceFiles.current[role==='A'?'B':'A']===key)throw Error('Fixture A dan B harus berbeda.');
   await registry.current.connectFixture(role,file);sourceFiles.current[role]=key;
   setMessage('SIMULASI · '+role+' memakai MP4 '+file.name);refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'MP4 gagal dibuka.');}
 };
 const disarm=useCallback(()=>{
  shutterEpoch.current++;
  session.current.disarm();setArmed(false);setMessage('Rana gestur dikunci.');
 },[]);
 const capture=useCallback(async(presetValue:F3PunchPreset|'manual',eventId:string)=>{
  const b=registry.current.status('B'),now=performance.now(),settings=control.current;
  const requestEpoch=shutterEpoch.current;
  if(!settings.consent||!registry.current.fresh('B',now)){setMessage('Persetujuan penonton dan Kamera B yang live diperlukan.');return;}
  const v=videoB.current;if(!v)return;
  if(archive.current.busy)return;
  if(presetValue!=='manual'){
   if(!settings.armed||!registry.current.fresh('A',now))return;
   const free=archive.current.nextSlot(settings.replacement)>=0;
   if(!session.current.begin(eventId,true,true,free))return;
  }
  setBusy(true);
  try{
   const area=framing.current.crop(v.videoWidth,v.videoHeight,1.36);
   await archive.current.capture({video:v,crop:area,cameraId:b.id,frameId:b.frameId,
    sourceTimestamp:b.lastFrameAt,preset:presetValue,consent:settings.consent,
    replace:settings.replacement,eventId,fresh:registry.current.fresh('B',performance.now()),
    stillValid:()=>shutterEpoch.current===requestEpoch&&control.current.consent&&
     registry.current.fresh('B',performance.now())&&registry.current.status('B').id===b.id&&
     (presetValue==='manual'||control.current.armed)});
   const count=archive.current.count;setStageCount(count);setReplacement(null);
   setFlash(performance.now()+220);
   setMessage('Foto '+count+'/4 tersimpan dari Kamera B.');
   if(presetValue!=='manual'){session.current.complete(count);if(count<4)session.current.readyAgain();}
   if(count>=4)disarm();
  }catch(e){session.current.failed();setArmed(false);setMessage(e instanceof Error?e.message:'Gagal memotret.');}
  finally{setBusy(false);}
 },[disarm]);
 const manualShot=()=>{void capture('manual','manual-'+crypto.randomUUID());};
 const enterFullscreen=()=>{
  if(!registry.current.bothReady(performance.now())){setMessage('Kamera A dan B harus mengirim frame segar.');return;}
  const target=stageHost.current;
  if(!target){setMessage('Stage View belum terpasang.');return;}
  // Call during the user click: never await a camera/model operation before this.
  try{
   if(!target.requestFullscreen){setStageMode('inline');setMessage('Fullscreen tidak tersedia; Stage View inline dibuka.');return;}
   const request=target.requestFullscreen();
   request.then(()=>setStageMode('fullscreen')).catch(()=>{
    setStageMode('inline');setMessage('Fullscreen ditolak browser; Stage View inline tetap tersedia.');
   });
  }catch{setStageMode('inline');setMessage('Fullscreen ditolak browser; memakai Stage View inline.');}
 };
 const leaveStage=()=>{
  if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
  setStageMode('setup');
 };
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&stageMode!=='setup'){event.preventDefault();leaveStage();}
   if(stageMode!=='setup'&&event.key.toLowerCase()==='d'&&!event.metaKey&&!event.ctrlKey)disarm();
  };
  document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
 },[stageMode,disarm]);
 const processMotion=useCallback((motion:F3MotionFrame,now:number)=>{
  const prev=framing.current.fraction;
  const size=framing.current.step(motion,now);
  if(Math.abs(size-prev)>.001)setZoom(size);
  const cfg=control.current;
  const result=punch.current.step(motion,now,cfg.armed||cfg.rehearsal);
  if(result.kind==='capture'){
   if(cfg.rehearsal){setPositive(n=>n+1);setMessage('Pukulan '+preset+' terdeteksi dalam latihan.');}
   else if(cfg.armed&&cfg.consent&&!framing.current.resizing&&
    registry.current.fresh('B',performance.now())&&result.eventId)void capture(preset,result.eventId);
  }
 },[capture,preset]);
 const qaMode=import.meta.env.DEV&&new URL(window.location.href).searchParams.has('f3qa');
 useEffect(()=>{
  if(!qaMode)return;
  const host=window as Window&{__SOMA_F3_QA__?:{inject:(frame:F3MotionFrame)=>boolean;registry:()=>object}};
  host.__SOMA_F3_QA__={
   inject:(frame:F3MotionFrame)=>{
    const a=registry.current.status('A'),b=registry.current.status('B');
    if(a.kind!=='fixture'||b.kind!=='fixture'||a.state!=='live'||b.state!=='live')return false;
    processMotion(frame,performance.now());return true;
   },
   registry:()=>({A:registry.current.status('A'),B:registry.current.status('B')})
  };
  return()=>{delete host.__SOMA_F3_QA__;};
 },[qaMode,processMotion]);
 const last=useRef({ui:0,inference:0,lastA:-1});
 useEffect(()=>{
  let raf=0,disposed=false;
  const loop=(now:number)=>{
   if(disposed)return;
   raf=requestAnimationFrame(loop);
   registry.current.poll(now);
   const a=registry.current.status('A'),b=registry.current.status('B');
   const aLive=registry.current.fresh('A',now),bLive=registry.current.fresh('B',now);
   if(!aLive||!bLive){
    if(control.current.armed){session.current.disarm();setArmed(false);}
   }
   session.current.setDevices(aLive,bLive);
   if(aLive&&fusion.current.status==='idle'){
    void fusion.current.init().then(()=>{if(!disposed)setModelState('Pose + Hands siap');})
     .catch(e=>{if(!disposed)setModelState('Model gestur gagal: '+String(e));});
   }
   if(!qaMode&&aLive&&fusion.current.status==='ready'&&now-last.current.inference>=95&&a.frameId!==last.current.lastA){
    last.current.inference=now;last.current.lastA=a.frameId;
    try{
     const motion=fusion.current.sample(videoA.current!,a.frameId,now);
     if(motion)processMotion(motion,now);
    }catch(e){fusion.current.dispose();setModelState('Pelacakan berhenti: '+String(e));disarm();}
   }
   const v=videoB.current;
   const crop=v&&v.videoWidth&&v.videoHeight?framing.current.crop(v.videoWidth,v.videoHeight,1.36):
    {x:0,y:0,width:0,height:0};
   stageFrame.current=makeF3StageFrame({sourceId:b.id,frameId:b.frameId,timestamp:b.lastFrameAt,crop,
    slots:archive.current.slots,state:aLive&&bLive?(b.kind==='fixture'?'SIMULATION':'LIVE'):'FREEZE',flashUntil:flash});
   if(now-last.current.ui>130){last.current.ui=now;refresh();}
  };
  raf=requestAnimationFrame(loop);
  return()=>{disposed=true;cancelAnimationFrame(raf);};
 },[disarm,flash,processMotion,qaMode,refresh]);
 const markConsent=(value:boolean)=>{
  setConsent(value);session.current.setConsent(value);
  if(!value){disarm();setVerified(false);session.current.setVerified(false);}
 };
 const arm=()=>{
  const now=performance.now();
  if(!verified){setMessage('Latih pukulan dan verifikasi contoh negatif terlebih dahulu.');return;}
  if(!consent){setMessage('Minta persetujuan penonton sebelum mengaktifkan rana.');return;}
  if(!session.current.arm(registry.current.fresh('A',now),registry.current.fresh('B',now))){
   setMessage('Kamera A/B harus live dan segar.');return;}
  setArmed(true);setMessage('Rana aktif. Resize tetap mengunci pukulan.');
 };
 const updatePreset=(value:F3PunchPreset)=>{setPreset(value);punch.current.setPreset(value);setVerified(false);session.current.setVerified(false);disarm();setPositive(0);setNegativeConfirmed(false);};
 const saveZip=async()=>{
  const photos=archive.current.slots.filter(p=>p!==null);
  if(!photos.length)return;
  const blob=await f3Zip(photos),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download='SOMA-F3-empat-foto.zip';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const removePhoto=(slot:number)=>{archive.current.remove(slot);setStageCount(archive.current.count);disarm();};
 const undo=()=>{if(archive.current.undo()){setStageCount(archive.current.count);disarm();}};
 const readyA=statuses.A.state==='live'&&performance.now()-statuses.A.lastFrameAt<850;
 const readyB=statuses.B.state==='live'&&performance.now()-statuses.B.lastFrameAt<850;
 const screenActive=stageMode!=='setup';
 const status=(role:F3Role)=><span className="f3-pill" data-live={statuses[role].state==='live'}>
  {role==='A'?'A · GESTUR':'B · FOTO'} <b>{statuses[role].kind==='fixture'?'SIMULASI':statuses[role].state==='live'?'LIVE':statuses[role].message}</b>
 </span>;
 const cameraSelect=(role:F3Role)=><div className="f3-device-row">
  <div className="f3-device-title"><b>{role==='A'?'A · Aktor':'B · Penonton'}</b><span>{statuses[role].state==='live'?'LIVE':statuses[role].message}</span></div>
  <label htmlFor={'f3-device-'+role}>Pilih kamera</label>
  <select id={'f3-device-'+role} value={chosen[role]} onChange={e=>setChosen(old=>({...old,[role]:e.target.value}))}>
   <option value="">Pilih kamera…</option>
   {devices.map((d,index)=><option value={d.deviceId} key={d.deviceId||index} disabled={!!d.deviceId&&chosen[role==='A'?'B':'A']===d.deviceId}>{d.label||'Kamera '+(index+1)}</option>)}
  </select>
  <div className="f3-device-buttons"><button type="button" onClick={()=>void connect(role)} disabled={!chosen[role]}>{statuses[role].state==='live'?'Ganti':'Sambungkan'}</button>
   <button type="button" onClick={()=>{registry.current.disconnect(role);disarm();}} disabled={statuses[role].state==='idle'}>Putus</button></div>
  <details className="f3-simulation"><summary>Simulasi MP4</summary>
   <label className="f3-file" aria-label={'Video simulasi '+role}>Pilih MP4 {role}<input type="file" accept="video/mp4,.mp4" onChange={e=>void connectFixture(role,e.target.files?.[0])}/></label>
  </details>
 </div>;
 return <section className="f3-workspace" aria-label="F3 Capture" data-stage-active={screenActive} data-step={activeStep}>
  <div className="f3-setup f3-workspace-intro">
   <div className="f3-workspace-title"><h1>F3 Capture</h1><span>Dua kamera · Stage View · empat foto kaki</span></div>
   <span className="f3-header-count">{stageCount}/4 foto</span>
  </div>
  <nav className="f3-pipeline-nav f3-setup" aria-label="Langkah F3 Capture">
   <div className="f3-pipeline-tabs" role="group" aria-label="Pilih langkah F3">
    <button type="button" className="f3-pipeline-tab" aria-current={activeStep==='camera'?'page':undefined}
     onClick={()=>setActiveStep('camera')}><span className="f3-step-num">{readyA&&readyB&&activeStep!=='camera'?<Check size={12}/>: '01'}</span> Kamera</button>
    <span className="f3-step-sep" aria-hidden="true">›</span>
    <button type="button" className="f3-pipeline-tab" aria-current={activeStep==='stage'?'page':undefined}
     onClick={()=>setActiveStep('stage')}><span className="f3-step-num">{readyA&&readyB&&activeStep==='photo'?<Check size={12}/>: '02'}</span> Stage View</button>
    <span className="f3-step-sep" aria-hidden="true">›</span>
    <button type="button" className="f3-pipeline-tab" aria-current={activeStep==='photo'?'page':undefined}
     onClick={()=>setActiveStep('photo')}><span className="f3-step-num">{stageCount===4&&activeStep!=='photo'?<Check size={12}/>: '03'}</span> Foto</button>
   </div>
   {activeStep!=='photo'&&<button type="button" className="f3-next-cta" onClick={()=>setActiveStep(activeStep==='camera'?'stage':'photo')}>
    Lanjut {activeStep==='camera'?'Stage View':'Foto'} <ArrowRight size={14}/>
   </button>}
  </nav>
  <div className="f3-main-layout">
   <aside className="f3-setup f3-left-column" aria-label="Kontrol F3">
    <section className="f3-source-panel f3-step-panel" data-active={activeStep==='camera'} hidden={activeStep!=='camera'}>
     <header className="f3-panel-heading"><h2>Sumber</h2></header>
     <details className="f3-device-details" open>
      <summary>Pilih kamera A dan B <ChevronDown size={15}/></summary>
      {cameraSelect('A')}{cameraSelect('B')}
      <div className="f3-source-utilities">
       <button type="button" onClick={()=>void refreshDevices()}><RotateCcw size={14}/> Cari kamera</button>
       <span>USB / Continuity muncul saat perangkat dikenali.</span>
      </div>
     </details>
     <section className="f3-input-health" aria-label="Status kamera">
      <h3>Periksa input</h3>
      <div className="f3-input-health-row">{status('A')}{status('B')}</div>
      <p role="status">{message}</p>
     </section>
     <details className="f3-monitor-details"><summary>Lihat gambar kamera <ChevronDown size={14}/></summary>
      <div className="f3-input-grid">
       <section className="f3-video-card">
        <div className="f3-card-head"><strong>A · Gerak aktor</strong><small>Pose + Hands</small></div>
        <div className="f3-video-frame"><video ref={videoA} autoPlay muted playsInline aria-label="Live video Kamera A"/></div>
        <p role="status">{modelState}</p>
        {fusion.current.status==='error'&&<button type="button" onClick={()=>{
         setModelState('Memuat ulang Pose + Hands…');
         void fusion.current.retry().then(()=>setModelState('Pose + Hands siap'))
          .catch(e=>setModelState('Model gagal: '+String(e)));
        }}>Coba lagi model gestur</button>}
       </section>
       <section className="f3-video-card f3-b-card">
        <div className="f3-card-head"><strong>B · Kaki penonton</strong><small>Foto</small></div>
        <div className="f3-video-frame"><video ref={videoB} autoPlay muted playsInline aria-label="Live video Kamera B"/>
         <div className="f3-frame-corners" aria-hidden="true"/></div>
        <p>Crop {Math.round(zoom*100)}% · sumber foto Kamera B.</p>
       </section>
      </div>
     </details>
    </section>
    <section className="f3-stage-panel f3-step-panel" data-active={activeStep==='stage'} hidden={activeStep!=='stage'}>
     <header className="f3-panel-heading"><h2>Coba panggung</h2></header>
     <p className="f3-panel-description">Pratinjau keluaran asli. Empat foto di kiri, video kaki kamera B di kanan.</p>
     <div className="f3-stage-readiness"><span>Kamera A</span><b data-ready={readyA}>{readyA?'Siap':'Belum siap'}</b></div>
     <div className="f3-stage-readiness"><span>Kamera B</span><b data-ready={readyB}>{readyB?'Siap':'Belum siap'}</b></div>
     <div className="f3-input-health"><h3>Periksa hasil</h3>
      <p>{readyA&&readyB?'Kedua gambar siap. Klik Coba Fullscreen pada monitor.':'Sambungkan kedua kamera melalui langkah Kamera.'}</p>
     </div>
    </section>
    <section className="f3-control-panel f3-step-panel" data-active={activeStep==='photo'} hidden={activeStep!=='photo'}>
     <header className="f3-panel-heading"><h2>Ambil foto</h2><span>{stageCount}/4</span></header>
     <label className="f3-consent"><input type="checkbox" checked={consent} onChange={e=>markConsent(e.target.checked)}/>
      Penonton menyetujui pengambilan foto kaki.</label>
     <button type="button" className="f3-primary f3-manual-shot"
      disabled={!consent||!readyB||busy||(stageCount>=4&&replacement===null)}
      onClick={manualShot}><Camera size={15}/> Jepret manual</button>
     <p className="f3-shutter-state" role="status">{armed?'Gestur aktif':rehearsal?'Latihan gestur':'Rana gestur terkunci'}</p>
     <details className="f3-gesture-details">
      <summary>Atur rana gestur <ChevronDown size={14}/></summary>
      <div className="f3-gesture-inner">
       <p>Latih pukulan sebelum mengaktifkan rana. Gerak resize tidak memotret.</p>
       <div className="f3-switch" role="group" aria-label="Preset pukulan">
        <button type="button" aria-pressed={preset==='straight'} onClick={()=>updatePreset('straight')}>Straight</button>
        <button type="button" aria-pressed={preset==='uppercut'} onClick={()=>updatePreset('uppercut')}>Uppercut</button>
       </div>
       <div className="f3-actions">
        <button type="button" onClick={()=>{setRehearsal(true);disarm();session.current.startRehearsal();setPositive(0);setNegativeConfirmed(false);}}>
         <Hand size={14}/> Mulai latihan</button>
        <button type="button" disabled={!rehearsal} onClick={()=>setNegativeConfirmed(true)}>Konfirmasi uji negatif</button>
        <button type="button" disabled={!rehearsal||!positive||!negativeConfirmed} onClick={()=>{
         setRehearsal(false);setVerified(true);session.current.setVerified(true);setMessage('Latihan tercatat; periksa persetujuan sebelum Arm.');
        }}>Verifikasi gestur</button>
       </div>
       <p className="f3-meta">Pukulan terbaca: {positive} · Negatif: {negativeConfirmed?'diperiksa':'belum diperiksa'}</p>
       <div className="f3-actions">
        <button type="button" disabled={!verified||!consent||!readyA||!readyB||stageCount>=4} onClick={arm}>Arm</button>
        <button type="button" className="f3-danger" onClick={disarm}>Disarm</button>
       </div>
       <p className="f3-meta">{armed?'ARMED · rana gestur aktif':rehearsal?'REHEARSAL · belum memotret':'DISARMED · rana terkunci'}</p>
      </div>
     </details>
     <p className="f3-control-feedback" role="status">{message}</p>
    </section>
   </aside>
   <div className="f3-monitor-column">
    <section className="f3-surface-panel" aria-label="Pratinjau Stage View">
     <header className="f3-surface-header f3-setup">
      <div><strong>Stage View</strong><small>Empat foto · Live Kamera B</small></div>
      <button type="button" className="f3-preview-fullscreen" onClick={enterFullscreen}
       disabled={!readyA||!readyB}><Maximize2 size={15}/> Coba Fullscreen</button>
     </header>
     <F3StageView hostRef={stageHost} frameRef={stageFrame} videoRef={videoB}
      stageActive={screenActive} onExit={leaveStage} onDisarm={disarm}
      onManualCapture={manualShot} canManual={consent&&readyB&&!busy&&(stageCount<4||replacement!==null)}/>
     <div className="f3-surface-footer f3-setup" role="status">
      <span>{statuses.B.kind==='fixture'&&readyB?'SIMULASI':readyA&&readyB?'LIVE':'Menunggu dua kamera'}</span>
      <span>2:1</span>
     </div>
    </section>
    <section className="f3-archive-panel f3-setup" hidden={activeStep!=='photo'}>
     <div className="f3-archive-heading"><h2>Foto tersimpan <span>{stageCount}/4</span></h2>
      <div className="f3-archive-actions">
       <button type="button" onClick={undo} disabled={!stageCount}><RotateCcw size={13}/> Undo</button>
       <button type="button" onClick={()=>void saveZip()} disabled={!stageCount}><Download size={13}/> Ekspor ZIP</button>
      </div>
     </div>
     <div className="f3-slots">
      {archive.current.slots.map((photo,index)=><div key={index} className="f3-slot" data-selected={replacement===index}>
       {photo?<img src={photo.url} alt={'Foto kaki '+(index+1)}/>:<span>0{index+1}</span>}
       <div className="f3-slot-actions">
        <button type="button" aria-label={'Ganti foto '+(index+1)}
         aria-pressed={replacement===index} onClick={()=>setReplacement(replacement===index?null:index)}>Ganti</button>
        {photo&&<button type="button" aria-label={'Hapus foto '+(index+1)} onClick={()=>removePhoto(index)}>Hapus</button>}
       </div>
      </div>)}
     </div>
    </section>
   </div>
  </div>
  <details className="f3-hardware-details f3-setup"><summary><ShieldAlert size={14}/> Info teknis & proyektor <ChevronDown size={14}/></summary>
   <div className="f3-operator-footer">
    <p>{f3ProjectorGate().ready?'Gate BODY tersedia. Pengujian fisik F3 belum selesai.':
     'Output proyektor terkunci. Stage View lokal tidak memerlukan proyektor.'}</p>
    <button type="button" disabled title="Integrasi F3 memerlukan uji fisik."
     onClick={f3Blackout}><VideoOff size={14}/> Keluarkan ke Kanvas — belum tersedia</button>
   </div>
  </details>
 </section>;
}
