import {useCallback,useEffect,useRef,useState} from 'react';
import {Camera,ChevronDown,Download,Hand,Maximize2,RotateCcw,ShieldAlert,Video,VideoOff} from 'lucide-react';
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
import type {F3Role,F3CameraStatus,F3PunchPreset,F3StageFrame} from './F3Types.ts';
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
 const sourceFiles=useRef<{A:string|null;B:string|null}>({A:null,B:null});
 const statusRef=useRef(statuses),control=useRef({consent,armed,rehearsal,stageMode,replacement,verified});
 statusRef.current=statuses;control.current={consent,armed,rehearsal,stageMode,replacement,verified};
 const refresh=useCallback(()=>setStatuses({A:registry.current.status('A'),B:registry.current.status('B')}),[]);
 const refreshDevices=useCallback(async()=>{
  try{const list=await navigator.mediaDevices?.enumerateDevices();
   if(list)setDevices(list.filter(d=>d.kind==='videoinput'));}
  catch{setMessage('Daftar kamera belum tersedia. Periksa izin browser.');}
 },[]);
 const onExit=useCallback(()=>setStageMode('setup'),[]);
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
  session.current.disarm();setArmed(false);setMessage('Rana gestur dikunci.');
 },[]);
 const capture=useCallback(async(presetValue:F3PunchPreset|'manual',eventId:string)=>{
  const b=registry.current.status('B'),now=performance.now(),settings=control.current;
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
    replace:settings.replacement,eventId,fresh:registry.current.fresh('B',performance.now())});
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
   if(event.key==='Escape'&&stageMode==='inline'){event.preventDefault();leaveStage();}
   if(stageMode!=='setup'&&event.key.toLowerCase()==='d'&&!event.metaKey&&!event.ctrlKey)disarm();
  };
  document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
 },[stageMode,disarm]);
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
   if(aLive&&fusion.current.status==='ready'&&now-last.current.inference>=95&&a.frameId!==last.current.lastA){
    last.current.inference=now;last.current.lastA=a.frameId;
    try{
     const motion=fusion.current.sample(videoA.current!,a.frameId,now);
     if(motion){
      const prev=framing.current.fraction;
      const size=framing.current.step(motion,now);
      if(Math.abs(size-prev)>.001)setZoom(size);
      const cfg=control.current;
      const result=punch.current.step(motion,now,cfg.armed||cfg.rehearsal);
      if(result.kind==='capture'){
       if(cfg.rehearsal){setPositive(n=>n+1);setMessage('Pukulan '+preset+' terdeteksi dalam latihan.');}
       else if(cfg.armed&&cfg.consent&&!framing.current.resizing&&bLive&&result.eventId)
        void capture(preset,result.eventId);
      }
     }
    }catch(e){fusion.current.dispose();setModelState('Pelacakan berhenti: '+String(e));disarm();}
   }
   const v=videoB.current;
   const crop=v&&v.videoWidth&&v.videoHeight?framing.current.crop(v.videoWidth,v.videoHeight,1.36):
    {x:0,y:0,width:0,height:0};
   stageFrame.current=makeF3StageFrame({sourceId:b.id,frameId:b.frameId,timestamp:b.lastFrameAt,crop,
    slots:archive.current.slots,state:bLive?(b.kind==='fixture'?'SIMULATION':'LIVE'):'BLACKOUT',flashUntil:flash});
   if(now-last.current.ui>130){last.current.ui=now;refresh();}
  };
  raf=requestAnimationFrame(loop);
  return()=>{disposed=true;cancelAnimationFrame(raf);};
 },[capture,disarm,flash,preset,refresh]);
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
  <label htmlFor={'f3-device-'+role}>Kamera {role}</label>
  <select id={'f3-device-'+role} value={chosen[role]}
   onChange={e=>setChosen(old=>({...old,[role]:e.target.value}))}>
   <option value="">Pilih kamera…</option>
   {devices.map((d,index)=><option value={d.deviceId} key={d.deviceId||index}>{d.label||'Kamera '+(index+1)}</option>)}
  </select>
  <button type="button" onClick={()=>void connect(role)} disabled={!chosen[role]}>Sambungkan</button>
  <button type="button" onClick={()=>{registry.current.disconnect(role);disarm();}}>Putuskan</button>
  <label className="f3-file" aria-label={'Video simulasi '+role}>MP4 SIMULASI
   <input type="file" accept="video/mp4,.mp4" onChange={e=>void connectFixture(role,e.target.files?.[0])}/>
  </label>
 </div>;
 return <section className="f3-workspace" aria-label="F3 Capture" data-stage-active={screenActive}>
  <div className="f3-setup">
   <header className="f3-header">
    <div><small>UNPACKING / FRAGMEN 03</small><h1>F3 Capture</h1>
     <p>Dua kamera · satu Stage View · empat foto penonton</p></div>
    <div className="f3-header-action">
     <button type="button" className="f3-primary" onClick={enterFullscreen}
      disabled={!readyA||!readyB}><Maximize2 size={15}/> Coba Fullscreen</button>
     <span>{readyA&&readyB?'Kedua kamera siap untuk pratinjau.':'Hubungkan A dan B dahulu.'}</span>
    </div>
   </header>
   <div className="f3-status">{status('A')}{status('B')}<span className="f3-pill">{verified?'Gestur terverifikasi':'Rana belum diverifikasi'}</span>
    <span className="f3-pill">FOTO {stageCount}/4</span></div>
   <div className="f3-input-grid">
    <section className="f3-video-card f3-b-card"><div className="f3-card-head"><strong>KAMERA B — KAKI PENONTON</strong><small>Foto & crop</small></div>
     <div className="f3-video-frame"><video ref={videoB} autoPlay muted playsInline aria-label="Live video Kamera B"/>
      <div className="f3-frame-corners" aria-hidden="true"/></div>
     <p>Crop {Math.round(zoom*100)}% · Foto selalu memakai pixel Kamera B.</p>
    </section>
    <section className="f3-video-card"><div className="f3-card-head"><strong>KAMERA A — AKTOR 1</strong><small>Pose + hands</small></div>
     <div className="f3-video-frame"><video ref={videoA} autoPlay muted playsInline aria-label="Live video Kamera A"/></div>
     <p>{modelState}</p>
    </section>
   </div>
   <details className="f3-device-details"><summary>Input & perangkat <ChevronDown size={14}/></summary>
    {cameraSelect('A')}{cameraSelect('B')}
    <button type="button" onClick={()=>void refreshDevices()}><RotateCcw size={14}/> Cari kamera</button>
    <p>Fixture MP4 untuk QA memakai dua rekaman berbeda. Foto dan video tidak diunggah.</p>
   </details>
   <div className="f3-operator-grid">
    <section className="f3-operator-card"><h2>Pukulan & rana</h2>
     <div className="f3-switch" role="group" aria-label="Preset pukulan">
      <button aria-pressed={preset==='straight'} onClick={()=>updatePreset('straight')}>Straight</button>
      <button aria-pressed={preset==='uppercut'} onClick={()=>updatePreset('uppercut')}>Uppercut</button>
     </div>
     <p>Pinch untuk resize. Pukulan tidak bekerja selama resize dan cooldown.</p>
     <div className="f3-actions"><button onClick={()=>{setRehearsal(true);session.current.startRehearsal();setPositive(0);setNegativeConfirmed(false);disarm();}}>
      <Hand size={14}/> Mulai latihan</button>
      <button disabled={!rehearsal} onClick={()=>setNegativeConfirmed(true)}>Konfirmasi uji negatif</button>
      <button disabled={!rehearsal||!positive||!negativeConfirmed} onClick={()=>{
       setRehearsal(false);setVerified(true);session.current.setVerified(true);setMessage('Latihan tercatat; periksa consent sebelum Arm.');
      }}>Verifikasi gestur</button></div>
     <p className="f3-meta">Pukulan terbaca: {positive} · Negatif: {negativeConfirmed?'diperiksa':'belum diperiksa'}</p>
     <label className="f3-consent"><input type="checkbox" checked={consent} onChange={e=>markConsent(e.target.checked)}/>
      Penonton menyetujui pengambilan foto kaki.</label>
     <div className="f3-actions"><button disabled={!verified||!consent||!readyA||!readyB||stageCount>=4} onClick={arm}>Arm</button>
      <button className="f3-danger" onClick={disarm}>Disarm</button>
      <button disabled={!consent||!readyB||busy||stageCount>=4&&replacement===null} onClick={manualShot}><Camera size={14}/> Jepret manual</button></div>
     <p className="f3-meta" role="status">{armed?'ARMED · shutter gestur aktif':rehearsal?'REHEARSAL · belum memotret':'DISARMED · foto manual tetap perlu consent'}</p>
    </section>
    <section className="f3-operator-card"><h2>Arsip kaki <small>{stageCount}/4</small></h2>
     <div className="f3-slots">
      {archive.current.slots.map((photo,index)=><div key={index} className="f3-slot">
       {photo?<img src={photo.url} alt={'Foto kaki '+(index+1)}/>:<span>0{index+1}</span>}
       <button type="button" aria-label={'Ganti foto '+(index+1)}
        aria-pressed={replacement===index} onClick={()=>setReplacement(replacement===index?null:index)}>Ganti</button>
       {photo&&<button type="button" aria-label={'Hapus foto '+(index+1)} onClick={()=>removePhoto(index)}>Hapus</button>}
      </div>)}
     </div>
     <div className="f3-actions"><button onClick={undo}>Undo</button>
      <button onClick={()=>void saveZip()} disabled={!stageCount}><Download size={14}/> Ekspor ZIP</button></div>
     <p>Slot kosong berikutnya terisi otomatis. Ganti slot dipilih sebelum jepret.</p>
    </section>
   </div>
   <div className="f3-preview-head"><div><strong>Stage View</strong><span>Pratinjau keluaran 2:1 · grid 30% / gutter 2% / live B 68%</span></div>
    <button type="button" onClick={enterFullscreen} disabled={!readyA||!readyB}><Maximize2 size={14}/> Coba Fullscreen</button></div>
  </div>
  <F3StageView hostRef={stageHost} frameRef={stageFrame} videoRef={videoB}
   stageActive={screenActive} onExit={onExit}/>
  {stageMode==='inline'&&<div className="f3-inline-tools">
   <button type="button" onClick={leaveStage}>Kembali Setup (Esc)</button>
   <button type="button" onClick={disarm}>Disarm</button>
  </div>}
  <div className="f3-setup f3-operator-footer">
   <p role="status"><ShieldAlert size={14}/> {message}</p>
   <p>Output fisik: {f3ProjectorGate().ready?'Gate BODY siap, integrasi F3 menunggu uji fisik.':
    'Terkunci. Stage View lokal tidak membutuhkan proyektor.'}</p>
   <button type="button" disabled title="Integrasi proyekor F3 belum diverifikasi; output harus tetap Blackout."
    onClick={f3Blackout}><VideoOff size={14}/> Keluarkan ke Kanvas — belum tersedia</button>
  </div>
 </section>;
}
