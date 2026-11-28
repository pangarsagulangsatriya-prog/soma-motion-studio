import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,Camera,Check,ChevronDown,Download,Hand,Maximize2,RotateCcw,ShieldAlert,VideoOff} from 'lucide-react';
import {F3CameraRegistry} from './F3CameraRegistry.ts';
import {PhoneCameraReceiver} from '../stage/PhoneCameraReceiver.tsx';
import {SOURCE_CHOICES,SOURCE_LABELS} from '../studio/v3/sourceSwitchModel.ts';
import {normalizeCameraDevices,cameraDeviceLabel,cameraErrorMessage} from '../engine/universalCamera.ts';
import {F3MotionFusion} from './F3MotionFusion.ts';
import {F3FramingController,f3SmoothCrop} from './F3FramingController.ts';
import {F3PunchEngine} from './F3PunchEngine.ts';
import {F3PhotoStore} from './F3PhotoStore.ts';
import {F3SessionMachine} from './F3SessionMachine.ts';
import {f3Zip} from './F3Zip.ts';
import {F3StageView} from './F3StageView.tsx';
import {F3VideoMonitor} from './F3VideoMonitor.tsx';
import {makeF3StageFrame} from './F3StageRenderer.ts';
import {f3ProjectorGate,f3Blackout} from './F3OutputAdapter.ts';
import type {F3Role,F3CameraStatus,F3PunchPreset,F3StageFrame,F3MotionFrame,F3Rect} from './F3Types.ts';
import './f3.css';
const emptyStatus=(role:F3Role):F3CameraStatus=>({role,id:'',kind:'camera',state:'idle',lastFrameAt:0,frameId:0,videoTime:-1,message:'Pilih sumber'});
type F3SourceChoice='webcam'|'phone'|'video';
const f3Sources=SOURCE_CHOICES.filter(source=>source.id!=='simulator');
const startFrame=makeF3StageFrame({sourceId:'',frameId:0,timestamp:0,crop:{x:0,y:0,width:0,height:0},slots:[null,null,null,null],state:'BLACKOUT'});
export function F3CaptureWorkspace(){
 const registry=useRef(new F3CameraRegistry()),fusion=useRef(new F3MotionFusion());
 const framing=useRef(new F3FramingController()),punch=useRef(new F3PunchEngine('uppercut'));
 const archive=useRef(new F3PhotoStore()),session=useRef(new F3SessionMachine());
 const videoA=useRef<HTMLVideoElement>(null),videoB=useRef<HTMLVideoElement>(null);
 const stageActor=useRef<HTMLVideoElement|null>(null),stagePhoto=useRef<HTMLVideoElement|null>(null);
 const stageHost=useRef<HTMLDivElement>(null),stageFrame=useRef<F3StageFrame>(startFrame);
 const [statuses,setStatuses]=useState({A:emptyStatus('A'),B:emptyStatus('B')});
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const [chosen,setChosen]=useState({A:'',B:''});
 const [sourceChoice,setSourceChoice]=useState<Record<F3Role,F3SourceChoice|null>>({A:null,B:null});
 const sourceChoiceRef=useRef(sourceChoice);sourceChoiceRef.current=sourceChoice;
 const [stageMode,setStageMode]=useState<'setup'|'fullscreen'|'inline'>('setup');
 const [stageCount,setStageCount]=useState(0),[replacement,setReplacement]=useState<number|null>(null);
 const [consent,setConsent]=useState(false),[armed,setArmed]=useState(false);
 const [rehearsal,setRehearsal]=useState(false),[positive,setPositive]=useState(0);
 const [negativeConfirmed,setNegativeConfirmed]=useState(false),[verified,setVerified]=useState(false);
 const [preset,setPreset]=useState<F3PunchPreset>('uppercut');
 const [modelState,setModelState]=useState('Menunggu Kamera A');
 const [zoom,setZoom]=useState(.6),[message,setMessage]=useState('Hubungkan Kamera A. Kamera B opsional untuk foto kaki.');
 const [busy,setBusy]=useState(false),[flash,setFlash]=useState(0);
 const [activeStep,setActiveStep]=useState<'input'|'motion'|'perform'>('input');
 const [skeletonVisible,setSkeletonVisible]=useState(true);
 const motionSnapshot=useRef<F3MotionFrame|null>(null);
 const displayCrop=useRef<{crop:F3Rect;sourceId:string;time:number}|null>(null);
 const motionLastUi=useRef(0);
 const [motionSummary,setMotionSummary]=useState({body:false,hands:0,label:'Menunggu Kamera A'});
 const shutterEpoch=useRef(0);
 const sourceFiles=useRef<{A:string|null;B:string|null}>({A:null,B:null});
 const statusRef=useRef(statuses),control=useRef({consent,armed,rehearsal,stageMode,replacement,verified});
 statusRef.current=statuses;control.current={consent,armed,rehearsal,stageMode,replacement,verified};
 const refresh=useCallback(()=>setStatuses({A:registry.current.status('A'),B:registry.current.status('B')}),[]);
 const refreshDevices=useCallback(async()=>{
  try{const list=await navigator.mediaDevices?.enumerateDevices();
   if(list)setDevices(normalizeCameraDevices(list));}
  catch{setMessage('Daftar kamera belum tersedia. Periksa izin browser.');}
 },[]);
 useEffect(()=>{
  if(!videoA.current||!videoB.current)return;
  const reg=registry.current;reg.attach('A',videoA.current);reg.attach('B',videoB.current);
  const off=reg.subscribe(refresh);void refreshDevices();
  const media=navigator.mediaDevices;
  media?.addEventListener?.('devicechange',refreshDevices);
  return()=>{off();media?.removeEventListener?.('devicechange',refreshDevices);
   reg.dispose();fusion.current.dispose();archive.current.revokeAll();};
 },[refresh,refreshDevices]);
 const connect=async(role:F3Role)=>{
  try{
   invalidateMotion();
   if(!chosen[role])throw Error('Pilih perangkat Kamera '+role+'.');
   await registry.current.connectDevice(role,chosen[role]);sourceFiles.current[role]=null;
   await refreshDevices();refresh();
   setMessage('Menunggu frame baru Kamera '+role+'…');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal menyambungkan kamera.');}
 };
 const connectFixture=async(role:F3Role,file:File|undefined)=>{
  if(!file)return;
  try{
   invalidateMotion();
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
 const invalidateMotion=()=>{
  last.current.lastA=-1;last.current.inference=0;
  disarm();setVerified(false);session.current.setVerified(false);setRehearsal(false);
  framing.current.reset();punch.current.reset();fusion.current.resetFrames();
  motionSnapshot.current=null;motionLastUi.current=0;displayCrop.current=null;
  setMotionSummary({body:false,hands:0,label:'Menunggu deteksi'});
  setZoom(.6);
 };
 const capture=useCallback(async(presetValue:F3PunchPreset|'manual',eventId:string)=>{
  const now=performance.now(),settings=control.current;
  const role:F3Role=registry.current.fresh('B',now)?'B':'A';
  const b=registry.current.status(role);
  if(presetValue!=='manual'&&stageFrame.current.cameraB.sourceId!==b.id)return;
  const requestEpoch=shutterEpoch.current;
  if(!settings.consent||!registry.current.fresh(role,now)){setMessage('Centang persetujuan dan sambungkan kamera foto.');return;}
  const v=role==='B'?videoB.current:videoA.current;if(!v)return;
  if(archive.current.busy)return;
  if(presetValue!=='manual'){
   if(!settings.armed||!registry.current.fresh('A',now))return;
   const free=archive.current.nextSlot(settings.replacement)>=0;
   if(!session.current.begin(eventId,true,true,free))return;
  }
  setBusy(true);
  try{
   // Save the exact visible crop, including animated interpolation.
   const shown=stageFrame.current.cameraB;
   const valid=shown.sourceId===b.id&&shown.crop.width>0&&shown.crop.height>0&&
    shown.crop.x>=0&&shown.crop.y>=0&&shown.crop.x+shown.crop.width<=v.videoWidth&&
    shown.crop.y+shown.crop.height<=v.videoHeight;
   const area=valid?{...shown.crop}:framing.current.crop(v.videoWidth,v.videoHeight,1.36);
   await archive.current.capture({video:v,crop:area,cameraId:b.id,frameId:b.frameId,
    sourceTimestamp:b.lastFrameAt,preset:presetValue,consent:settings.consent,
    replace:settings.replacement,eventId,fresh:registry.current.fresh(role,performance.now()),
    stillValid:()=>shutterEpoch.current===requestEpoch&&control.current.consent&&
     registry.current.fresh(role,performance.now())&&registry.current.status(role).id===b.id&&
     (presetValue==='manual'||control.current.armed)});
   const count=archive.current.count;setStageCount(count);setReplacement(null);
   setFlash(performance.now()+220);
   setMessage('Foto '+count+'/4 tersimpan dari Kamera '+role+'.');
   if(presetValue!=='manual'){session.current.complete(count);if(count<4)session.current.readyAgain();}
   if(count>=4)disarm();
  }catch(e){session.current.failed();setArmed(false);setMessage(e instanceof Error?e.message:'Gagal memotret.');}
  finally{setBusy(false);}
 },[disarm]);
 const manualShot=()=>{void capture('manual','manual-'+crypto.randomUUID());};
 const enterFullscreen=()=>{
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
 const leaveStage=useCallback(()=>{
  if(document.fullscreenElement===stageHost.current)void document.exitFullscreen().catch(()=>{});
  setStageMode('setup');
 },[]);
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&stageMode!=='setup'){event.preventDefault();leaveStage();}
   if(stageMode!=='setup'&&event.key.toLowerCase()==='d'&&!event.metaKey&&!event.ctrlKey)disarm();
  };
  document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
 },[stageMode,disarm]);
 const processMotion=useCallback((motion:F3MotionFrame,now:number)=>{
  motionSnapshot.current=motion;
  const prev=framing.current.fraction;
  const size=framing.current.step(motion,now);
  if(Math.abs(size-prev)>.001)setZoom(size);
  const cfg=control.current;
  if(framing.current.resizing)punch.current.pauseResize(now);
  const result=framing.current.resizing?{kind:'resize' as const}:punch.current.step(motion,now,cfg.armed||cfg.rehearsal);
  if(now-motionLastUi.current>180){
   motionLastUi.current=now;
   const joints=[11,12,13,14,15,16].map(k=>motion.pose[k]);
   const body=joints.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=.55);
   const label=framing.current.resizing?'Zoom aktif':result.kind==='prepared'?'Persiapan '+preset:
    result.kind==='capture'?preset+' terbaca':body?'Tubuh terbaca':'Periksa posisi aktor';
   setMotionSummary({body,hands:motion.hands.length,label});
  }
  if(result.kind==='capture'){
   if(cfg.rehearsal){setPositive(n=>n+1);setMessage('Pukulan '+preset+' terdeteksi dalam latihan.');}
   else if(cfg.armed&&cfg.consent&&!framing.current.resizing&&
    (registry.current.fresh('B',performance.now())||registry.current.fresh('A',performance.now()))&&result.eventId)void capture(preset,result.eventId);
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
   if(!aLive){
    if(control.current.armed){session.current.disarm();setArmed(false);}
   }
   session.current.setDevices(aLive,bLive||aLive);
   if(aLive&&fusion.current.status==='idle'){
    void fusion.current.init().then(()=>{if(!disposed)setModelState('Pose + Hands siap');})
     .catch(e=>{if(!disposed)setModelState('Model gestur gagal: '+String(e));});
   }
   if(!qaMode&&aLive&&fusion.current.status==='ready'&&now-last.current.inference>=60&&a.frameId!==last.current.lastA){
    last.current.inference=now;last.current.lastA=a.frameId;
    try{
     const motion=fusion.current.sample(videoA.current!,a.frameId,now);
     if(motion)processMotion(motion,now);
    }catch(e){fusion.current.dispose();setModelState('Pelacakan berhenti: '+String(e));disarm();}
   }
   const photo=bLive?b:a;
   const photoLive=bLive||aLive;
   stageActor.current=aLive?videoA.current:null;
   stagePhoto.current=bLive?videoB.current:aLive?videoA.current:null;
   const v=stagePhoto.current;
   const target=v&&v.videoWidth&&v.videoHeight?framing.current.crop(v.videoWidth,v.videoHeight,1.36):
    {x:0,y:0,width:0,height:0};
   const former=displayCrop.current;
   const crop=v&&v.videoWidth&&v.videoHeight&&photoLive?
    f3SmoothCrop(former?.sourceId===photo.id?former.crop:null,target,
     former?.sourceId===photo.id?now-former.time:0,v.videoWidth,v.videoHeight):target;
   displayCrop.current=photoLive?{crop,sourceId:photo.id,time:now}:null;
   stageFrame.current=makeF3StageFrame({sourceId:photo.id,frameId:photo.frameId,timestamp:photo.lastFrameAt,crop,
    slots:archive.current.slots,state:photoLive?(photo.kind==='fixture'||(aLive&&a.kind==='fixture')?'SIMULATION':'LIVE'):'FREEZE',flashUntil:flash});
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
  if(!consent){setMessage('Minta persetujuan penonton sebelum mengaktifkan rana.');return;}
  if(!session.current.arm(registry.current.fresh('A',now),registry.current.fresh('B',now)||registry.current.fresh('A',now))){
   setMessage('Kamera A harus live untuk membaca uppercut.');return;}
  setArmed(true);setRehearsal(false);setMessage('Gestur aktif. Uppercut langsung mengambil foto.');
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
 const photoReady=readyB||readyA;
 const screenActive=stageMode!=='setup';
 // Consent explicitly enables the direct shutter on entry, without a rehearsal gate.
 useEffect(()=>{
  if(activeStep!=='perform'||!consent||!readyA||archive.current.count>=4)return;
  if(session.current.arm(true,true)){setArmed(true);setRehearsal(false);setMessage('Gestur aktif · '+(readyB?'Foto dari B':'Mode satu kamera · foto dari A'));}
 },[activeStep,consent,readyA]);
 const status=(role:F3Role)=><span className="f3-pill" data-live={statuses[role].state==='live'}>
  {role==='A'?'A · GESTUR':'B · FOTO'} <b>{statuses[role].kind==='fixture'?'SIMULASI':statuses[role].state==='live'?'LIVE':statuses[role].message}</b>
 </span>;
 const chooseSource=(role:F3Role,kind:F3SourceChoice)=>{
  if(sourceChoiceRef.current[role]===kind)return;
  // Replacing a camera always clears its liveness/gesture authorization first.
  registry.current.disconnect(role);invalidateMotion();
  sourceFiles.current[role]=null;
  setChosen(old=>({...old,[role]:''}));
  const next={...sourceChoiceRef.current,[role]:kind};
  sourceChoiceRef.current=next;setSourceChoice(next);refresh();
  setMessage('Kamera '+role+': '+SOURCE_LABELS[kind]+'. Pilih perangkat atau sambungkan HP.');
 };
 const connectPhone=async(role:F3Role,stream:MediaStream)=>{
  if(sourceChoiceRef.current[role]!=='phone'){
   stream.getTracks().forEach(track=>track.stop());return;
  }
  try{
   invalidateMotion();
   await registry.current.connectPhoneStream(role,stream);
   refresh();
   setMessage('Kamera HP '+role+' tersambung. Menunggu frame segar…');
  }catch(error){
   const detail=cameraErrorMessage(error);
   setMessage('Kamera HP '+role+': '+detail);refresh();
   throw error;
  }
 };
 const disconnectPhone=(role:F3Role)=>{
  if(sourceChoiceRef.current[role]!=='phone')return;
  registry.current.disconnect(role);invalidateMotion();refresh();
  setMessage('Kamera HP '+role+' terputus. Sambungkan ulang.');
 };
 const requestPermission=async()=>{
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Buka SOMA melalui HTTPS dan izinkan kamera.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:true});
   stream.getTracks().forEach(track=>track.stop());
   await refreshDevices();
   setMessage('Izin kamera diterima. Pilih perangkat A dan B yang berbeda.');
  }catch(error){setMessage(cameraErrorMessage(error));}
 };
 const cameraSelect=(role:F3Role)=>{
  const source=sourceChoice[role],current=statuses[role];
  return <div className="f3-device-row" data-role={role}>
   <div className="f3-device-title"><b>{role==='A'?'A · Aktor':'B · Penonton'}</b>
    <span>{current.state==='live'?(current.kind==='phone'?'HP LIVE':current.kind==='fixture'?'SIMULASI':'LIVE'):current.message}</span>
   </div>
   <details className="f3-role-source-picker">
    <summary>{source?SOURCE_LABELS[source]:'Pilih sumber'} <ChevronDown size={15}/></summary>
    <div className="f3-role-source-options">
     {f3Sources.map(option=><button type="button" key={option.id}
      className="f3-source-option" data-source={option.id}
      aria-current={source===option.id?'true':undefined}
      onClick={event=>{
       chooseSource(role,option.id as F3SourceChoice);
       const details=event.currentTarget.closest('details');if(details)details.open=false;
      }}>{option.label}</button>)}
    </div>
   </details>
   {source==='webcam'&&<>
    <label htmlFor={'f3-device-'+role}>Kamera lain · Webcam / HDMI / OBS</label>
    <select id={'f3-device-'+role} value={chosen[role]}
     onChange={event=>setChosen(old=>({...old,[role]:event.target.value}))}>
     <option value="">Pilih kamera…</option>
     {devices.map((device,index)=><option key={device.deviceId} value={device.deviceId}
      disabled={!!device.deviceId&&chosen[role==='A'?'B':'A']===device.deviceId}>
      {cameraDeviceLabel(device,index)}</option>)}
    </select>
    <div className="f3-device-buttons">
     <button type="button" disabled={!chosen[role]||current.state==='connecting'}
      onClick={()=>void connect(role)}>{current.state==='live'?'Ganti':'Sambungkan'}</button>
     <button type="button" disabled={current.state==='idle'}
      onClick={()=>{registry.current.disconnect(role);invalidateMotion();refresh();}}>Putus</button>
    </div>
    {!devices.length&&<button type="button" className="f3-camera-permission"
     onClick={()=>void requestPermission()}>Izinkan kamera</button>}
   </>}
   {source==='phone'&&<section className="f3-phone-connection" aria-label={'Kamera HP '+role}>
    <PhoneCameraReceiver onStream={stream=>connectPhone(role,stream)}
     onDisconnect={()=>disconnectPhone(role)}/>
   </section>}
   {source==='video'&&<div className="f3-video-input">
    <p>Rekaman lokal untuk latihan. Kamera A dan B memakai MP4 berbeda.</p>
    <label className="f3-file" aria-label={'Video simulasi '+role}>Pilih MP4 {role}
     <input type="file" accept="video/mp4,.mp4" onChange={event=>void connectFixture(role,event.target.files?.[0])}/>
    </label>
   </div>}
  </div>;
 };
 return <section className="f3-workspace" aria-label="F3 Capture" data-stage-active={screenActive} data-step={activeStep}>
  {/* Stream A/B selalu mounted; monitor Input dan Motion hanya membaca pikselnya. */}
  <div className="f3-source-host" aria-hidden="true">
   <video ref={videoA} autoPlay muted playsInline aria-label="Live video Kamera A"/>
   <video ref={videoB} autoPlay muted playsInline aria-label="Live video Kamera B"/>
  </div>
  <div className="f3-setup f3-workspace-intro">
   <div className="f3-workspace-title"><h1>F3 Capture</h1><span>Input · Motion · Perform</span></div>
   <span className="f3-header-count">{stageCount}/4 foto</span>
  </div>
  <nav className="f3-pipeline-nav f3-setup" aria-label="Langkah F3 Capture">
   <div className="f3-pipeline-tabs" role="group" aria-label="Pilih langkah F3">
    <button type="button" className="f3-pipeline-tab" aria-current={activeStep==='input'?'page':undefined}
     onClick={()=>setActiveStep('input')}><span className="f3-step-num">01</span> Input</button>
    <span className="f3-step-sep" aria-hidden="true">›</span>
    <button type="button" className="f3-pipeline-tab" aria-current={activeStep==='motion'?'page':undefined}
     onClick={()=>setActiveStep('motion')}><span className="f3-step-num">02</span> Motion</button>
    <span className="f3-step-sep" aria-hidden="true">›</span>
    <button type="button" className="f3-pipeline-tab" aria-current={activeStep==='perform'?'page':undefined}
     onClick={()=>setActiveStep('perform')}><span className="f3-step-num">03</span> Perform</button>
   </div>
   {activeStep!=='perform'&&<button type="button" className="f3-next-cta"
    onClick={()=>setActiveStep('perform')}
    disabled={false}>
    Lanjut Perform <ArrowRight size={14}/>
   </button>}
  </nav>
  <div className="f3-main-layout">
   <aside className="f3-setup f3-left-column" aria-label="Kontrol F3">
    <section className="f3-source-panel f3-step-panel" data-active={activeStep==='input'} hidden={activeStep!=='input'}>
     <header className="f3-panel-heading">
      <h2>Sumber kamera</h2>
      <button type="button" className="f3-text-action" onClick={()=>void refreshDevices()} aria-label="Cari kamera">
       <RotateCcw size={14}/> Cari kamera
      </button>
     </header>
     {cameraSelect('A')}
     {cameraSelect('B')}
     <p className="f3-control-feedback" role="status">{message}</p>
     <details className="f3-source-help">
      <summary>Petunjuk koneksi <ChevronDown size={13}/></summary>
      <p>HP dapat memakai USB/Continuity atau WebRTC. MP4 dipakai untuk latihan lokal.</p>
     </details>
    </section>
    <section className="f3-motion-panel f3-step-panel" data-active={activeStep==='motion'} hidden={activeStep!=='motion'}>
     <header className="f3-panel-heading">
      <h2>Deteksi gerak</h2>
      <span className="f3-motion-light" data-live={readyA&&motionSummary.body}>
       <i aria-hidden="true"/>{readyA?(motionSummary.body?'Tracking aktif':'Mencari tubuh'):'Menunggu A'}
      </span>
     </header>
     <div className="f3-readiness-rows">
      <div><span>Tubuh</span><strong>{readyA?(motionSummary.body?'Terdeteksi':'Mencari tubuh'):'Belum terhubung'}</strong></div>
      <div><span>Tangan</span><strong>{readyA?motionSummary.hands+' terbaca':'–'}</strong></div>
      <div><span>Zoom B</span><strong>{Math.round(zoom*100)}%</strong></div>
      <div><span>Gerak</span><strong>{motionSummary.label}</strong></div>
     </div>
     <div className="f3-zoom-feedback" data-active={readyA&&motionSummary.label==='Zoom aktif'}>
      <div className="f3-zoom-feedback-caption"><span>Zoom Kamera B</span><strong>{(1/zoom).toFixed(1)}×</strong></div>
      <div className="f3-zoom-track" role="progressbar" aria-label="Perbesaran Kamera B"
       aria-valuemin={1} aria-valuemax={5} aria-valuenow={Number((1/zoom).toFixed(1))}>
       <span style={{width:(100-zoom*100)+'%'}}/>
      </div>
      <small>Rentangkan dua tangan untuk memperbesar · rapatkan untuk memperkecil</small>
     </div>
     <div className="f3-motion-presets">
      <h3>Gestur foto</h3>
      <div className="f3-switch" role="group" aria-label="Preset pukulan">
       <button type="button" aria-pressed={preset==='straight'} onClick={()=>updatePreset('straight')}>Straight</button>
       <button type="button" aria-pressed={preset==='uppercut'} onClick={()=>updatePreset('uppercut')}>Uppercut</button>
      </div>
     </div>
     <p className="f3-panel-description">Rentangkan atau rapatkan dua tangan untuk mengubah crop B. Uppercut langsung tersedia di Perform. Latihan hanya opsional.</p>
     <div className="f3-motion-test">
      <button type="button" className="f3-primary" onClick={()=>{
       setRehearsal(true);disarm();session.current.startRehearsal();
       setPositive(0);setNegativeConfirmed(false);setVerified(false);session.current.setVerified(false);
      }} disabled={!readyA}><Hand size={14}/> Mulai latihan</button>
      <span>{rehearsal?'Latihan aktif':verified?'Gerak terverifikasi':'Belum diverifikasi'}</span>
     </div>
     <div className="f3-readiness-rows f3-motion-results">
      <div><span>Pukulan terbaca</span><strong>{positive}</strong></div>
      <div><span>Gerak negatif</span><strong>{negativeConfirmed?'Sudah diperiksa':'Belum diperiksa'}</strong></div>
     </div>
     <div className="f3-actions">
      <button type="button" disabled={!rehearsal} onClick={()=>setNegativeConfirmed(true)}>
       Konfirmasi uji negatif
      </button>
      <button type="button" disabled={!rehearsal||!positive||!negativeConfirmed} onClick={()=>{
       setRehearsal(false);setVerified(true);session.current.setVerified(true);
       setMessage('Gestur siap. Buka Perform untuk mengaktifkan rana.');
      }}>Verifikasi gestur</button>
     </div>
     {modelState.toLowerCase().includes('gagal')||modelState.toLowerCase().includes('berhenti')?
      <button type="button" onClick={()=>{
       setModelState('Memuat ulang Pose + Hands…');
       void fusion.current.retry().then(()=>{invalidateMotion();setModelState('Pose + Hands siap');})
        .catch(e=>setModelState('Model gestur gagal: '+String(e)));
      }}>Coba lagi deteksi</button>:null}
     <p className="f3-control-feedback" role="status">{modelState}</p>
    </section>
    <section className="f3-control-panel f3-step-panel" data-active={activeStep==='perform'} hidden={activeStep!=='perform'}>
     <header className="f3-panel-heading"><h2>Perform</h2><span>{stageCount}/4 foto</span></header>
     <div className="f3-readiness-rows f3-perform-health">
      <div><span>Kamera A</span><strong>{readyA?(statuses.A.kind==='fixture'?'SIMULASI':'LIVE'):'Belum siap'}</strong></div>
      <div><span>Kamera B</span><strong>{readyB?(statuses.B.kind==='fixture'?'SIMULASI':'LIVE'):'Belum siap'}</strong></div>
      <div><span>Motion</span><strong>{motionSummary.body?'Tracking aktif':modelState}</strong></div>
     </div>
     <label className="f3-consent"><input type="checkbox" checked={consent} onChange={e=>markConsent(e.target.checked)}/>
      Penonton menyetujui foto kaki · aktifkan gestur otomatis saat Perform.</label>
     <button type="button" className="f3-primary f3-arm-button"
      disabled={armed||!consent||!readyA||(stageCount>=4&&replacement===null)}
      onClick={arm}><Hand size={14}/> {armed?'Gestur Aktif':'Aktifkan Gestur'}</button>
     <div className="f3-operator-secondary">
      <button type="button" onClick={disarm} disabled={!armed&&!rehearsal}>Hentikan Gestur</button>
      <button type="button" onClick={manualShot} disabled={!consent||!photoReady||busy||(stageCount>=4&&replacement===null)}>
       <Camera size={14}/> Jepret manual
      </button>
     </div>
     <p className="f3-shutter-state" role="status">{armed?'Rana gestur aktif':'Gestur berhenti'}</p>
     <button type="button" className="f3-primary f3-perform-fullscreen" onClick={enterFullscreen}
       ><Maximize2 size={15}/> Buka Fullscreen</button>
     <div className="f3-photo-operations">
      <header><strong>Foto tersimpan</strong><span>{stageCount}/4</span></header>
      <div className="f3-photo-ops">
       {archive.current.slots.map((photo,index)=><div key={index} data-selected={replacement===index}>
        <span>{String(index+1).padStart(2,'0')} · {photo?'Terisi':'Kosong'}</span>
        <button type="button" aria-label={'Ganti foto '+(index+1)} aria-pressed={replacement===index}
         onClick={()=>setReplacement(replacement===index?null:index)}>{replacement===index?'Batal':'Ganti'}</button>
        {photo&&<button type="button" aria-label={'Hapus foto '+(index+1)} onClick={()=>removePhoto(index)}>Hapus</button>}
       </div>)}
      </div>
      <div className="f3-archive-actions">
       <button type="button" onClick={undo} disabled={!stageCount}><RotateCcw size={13}/> Undo</button>
       <button type="button" onClick={()=>void saveZip()} disabled={!stageCount}><Download size={13}/> Ekspor ZIP</button>
      </div>
     </div>
     <p className="f3-control-feedback" role="status">{message}</p>
    </section>
   </aside>
   <main className="f3-monitor-column" aria-label="Monitor F3">
    <section className="f3-workspace-monitor f3-step-panel" hidden={activeStep!=='input'}>
     <header className="f3-panel-heading"><h2>Monitor kamera</h2><span>Input asli A/B</span></header>
     {activeStep==='input'&&<F3VideoMonitor mode="input" videoA={videoA} videoB={videoB}
      motion={motionSnapshot} stage={stageFrame} showSkeleton={false}/>}
    </section>
    <section className="f3-workspace-monitor f3-step-panel" hidden={activeStep!=='motion'}>
     <header className="f3-panel-heading">
      <h2>Motion · Kamera A</h2>
      <label className="f3-skeleton-toggle">
       <input type="checkbox" checked={skeletonVisible} onChange={event=>setSkeletonVisible(event.target.checked)}/>
       Skeleton <span>{skeletonVisible?'On':'Off'}</span>
      </label>
     </header>
     {activeStep==='motion'&&<F3VideoMonitor mode="motion" videoA={videoA} videoB={videoB}
      motion={motionSnapshot} stage={stageFrame} showSkeleton={skeletonVisible}/>}
    </section>
    <section className="f3-operator-preview f3-setup" aria-label="Preview operator Kamera A"
     hidden={activeStep!=='perform'}>
     <div className="f3-operator-preview-copy">
      <strong>Kamera A · Aktor</strong>
      <span className="f3-motion-light" data-live={readyA}>
       <i aria-hidden="true"/>{readyA?(statuses.A.kind==='fixture'?'SIMULASI':motionSummary.body?'LIVE · Tubuh terbaca':'LIVE · Tubuh belum terbaca'):statuses.A.message}
      </span>
      <small>Kamera A membaca uppercut. {readyB?'Foto dari Kamera B.':'Mode satu kamera: foto dari Kamera A.'}</small>
      <button type="button" onClick={()=>setActiveStep('input')}>Periksa sumber A/B</button>
     </div>
     {activeStep==='perform'&&<F3VideoMonitor mode="perform" videoA={videoA} videoB={videoB}
      motion={motionSnapshot} stage={stageFrame} showSkeleton={false}/>}
    </section>
    <section className="f3-surface-panel" aria-label="Pratinjau Stage View" hidden={activeStep!=='perform'&&!screenActive}>
     <header className="f3-surface-header f3-setup">
      <div><strong>Stage View</strong><small>Latar aktor A · Empat foto kiri · {readyB?'Kamera B':'Kamera A (satu kamera)'} kanan</small></div>
      <span className="f3-ratio-label">2:1</span>
     </header>
     <F3StageView hostRef={stageHost} frameRef={stageFrame} videoARef={stageActor} videoBRef={stagePhoto}
      stageActive={screenActive} onExit={leaveStage} onDisarm={disarm}
      onManualCapture={manualShot} canManual={consent&&photoReady&&!busy&&(stageCount<4||replacement!==null)}/>
     <div className="f3-surface-footer f3-setup" role="status">
      <span>{photoReady?(readyB?'Foto B · LIVE':'Foto A · mode satu kamera'):'Menunggu kamera'}</span>
      <span>Stage View 1600 × 800</span>
     </div>
    </section>
   </main>
  </div>
  <details className="f3-hardware-details f3-setup" hidden={activeStep!=='perform'}>
   <summary><ShieldAlert size={14}/> Pengaturan lanjutan <ChevronDown size={14}/></summary>
   <div className="f3-operator-footer">
    <p>{f3ProjectorGate().ready?'Gate BODY tersedia. Pengujian fisik F3 belum selesai.':
     'Output proyektor F3 terkunci sampai QA perangkat. Fullscreen lokal tetap tersedia.'}</p>
    <button type="button" disabled title="Output fisik F3 perlu pengujian panggung."
     onClick={f3Blackout}><VideoOff size={14}/> Output fisik belum tersedia</button>
   </div>
  </details>
 </section>;
}
