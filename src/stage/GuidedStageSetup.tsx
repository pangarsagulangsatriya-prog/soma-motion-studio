import {useEffect,useRef,useState,type PointerEvent,type RefObject,type ChangeEvent} from 'react';
import type {MotionFrame} from '../engine/types.ts';
import type {LiveFloorTrackingEngine} from '../footprints/live/LiveFloorTrackingEngine.ts';
import {cameraBinding,cameraBindingKey} from '../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../footprints/live/MultiPoseGaitRouter.ts';
import {defaultFloorSpace,validateCameraFloorCalibration} from '../footprints/spatial/coordinates.ts';
import type {Point,Quad} from '../projection/geometry.ts';
import {RealDeviceValidationPanel} from './RealDeviceValidationPanel.tsx';
import {PhoneCameraReceiver} from './PhoneCameraReceiver.tsx';
import {evaluateGuideGates} from './guidedSetupGates.ts';
import type {StageSessionController} from './useStageSession.ts';

const steps=[{name:'Input',hint:'Pilih kamera'},{name:'Tracking',hint:'Uji gerak kaki'},{name:'Stage',hint:'Siap latihan'}] as const;
const corners=['Kiri atas','Kanan atas','Kanan bawah','Kiri bawah'] as const;
const sizes=[{label:'4 × 3 m',w:4,d:3},{label:'6 × 4 m',w:6,d:4},{label:'8 × 6 m',w:8,d:6},{label:'10 × 8 m',w:10,d:8}] as const;
type Props={
 open:boolean;onClose:()=>void;session:StageSessionController;
 frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 bodyPreviewRef:RefObject<HTMLCanvasElement|null>;floorPreviewRef:RefObject<HTMLCanvasElement|null>;
 floorTracker:LiveFloorTrackingEngine;identityRouter:MultiPoseGaitRouter;
 phoneActive:boolean;performers:1|2;
 onStartLaptop:()=>void;onPhoneStream:(stream:MediaStream)=>Promise<void>|void;
 onPhoneDisconnect:()=>void;onCalibrate:()=>void;onSimulator:()=>void;
 onArchive:()=>void;onComposer:()=>void;onPerform:()=>void;onBlackout:()=>void;
 cameraOn:boolean;calibrated:boolean;confirmed:boolean;contacts:number;
};
const emptyCorners=():Array<Point|null>=>[null,null,null,null];
export function GuidedStageSetup({
 open,onClose,session,onStartLaptop,onPhoneStream,onPhoneDisconnect,
 onCalibrate,onSimulator,onArchive,onComposer,onPerform,onBlackout,cameraOn,
 calibrated,confirmed,contacts,frameRef,videoRef,bodyPreviewRef,floorPreviewRef,
 floorTracker,identityRouter,phoneActive,performers
}:Props){
 const [step,setStep]=useState<0|1|2>(0);
 const [pulse,setPulse]=useState(0);
 const [marks,setMarks]=useState<Array<Point|null>>(()=>floorTracker.calibrationData?.cameraQuad.map(p=>({...p}))??emptyCorners());
 const [editing,setEditing]=useState(0);
 const [widthM,setWidthM]=useState(()=>floorTracker.floor?.widthM??8);
 const [depthM,setDepthM]=useState(()=>floorTracker.floor?.depthM??6);
 const [skipArchive,setSkipArchive]=useState(false);
 const [message,setMessage]=useState('');
 const cameraPreview=useRef<HTMLCanvasElement>(null),bodyPreview=useRef<HTMLCanvasElement>(null),floorPreview=useRef<HTMLCanvasElement>(null);
 const currentSource=session.meta.source;
 // Poll for presentation only: all readiness decisions still derive from the
 // current frame, camera binding, identity router and existing floor engine.
 useEffect(()=>{if(!open)return;const timer=window.setInterval(()=>setPulse(p=>(p+1)%100000),200);return()=>clearInterval(timer);},[open]);
 useEffect(()=>{
  if(!open)return;let raf=0,last=0;
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);if(now-last<1000/20)return;last=now;
   const canvas=cameraPreview.current,video=videoRef.current;
   if(canvas){
    const ctx=canvas.getContext('2d');
    if(ctx){
     ctx.fillStyle='#060b08';ctx.fillRect(0,0,canvas.width,canvas.height);
     if(cameraOn&&video&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0){
      const scale=Math.min(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
      const w=video.videoWidth*scale,h=video.videoHeight*scale;
      const x=(canvas.width-w)/2,y=(canvas.height-h)/2;
      try{ctx.drawImage(video,x,y,w,h);}catch{/* Transient device switch: remain dark. */}
      if(step===1){
       const valid=marks.every(p=>p!==null);
       if(valid){
        ctx.beginPath();marks.forEach((p,i)=>{if(!p)return;
         const px=x+p.x*w,py=y+p.y*h;
         if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
        });ctx.closePath();ctx.fillStyle='rgba(194,230,158,.07)';ctx.fill();
        ctx.strokeStyle='#cbe6a5';ctx.lineWidth=2;ctx.stroke();
       }
       marks.forEach((point,i)=>{
        if(!point)return;
        const px=x+point.x*w,py=y+point.y*h;
        ctx.beginPath();ctx.arc(px,py,i===editing?11:8,0,Math.PI*2);
        ctx.fillStyle=i===editing?'#effccf':'#cce7a2';ctx.fill();
        ctx.fillStyle='#14221a';ctx.font='bold 12px system-ui';ctx.textAlign='center';
        ctx.fillText(String(i+1),px,py+4);
       });
      }
     }
    }
   }
   for(const [target,source] of [[bodyPreview.current,bodyPreviewRef.current],[floorPreview.current,floorPreviewRef.current]] as const){
    const ctx=target?.getContext('2d');
    if(!target||!ctx)continue;
    ctx.fillStyle='#030605';ctx.fillRect(0,0,target.width,target.height);
    if(source&&source.width>0&&source.height>0){
     try{ctx.drawImage(source,0,0,target.width,target.height);}catch{/* Keep the preview black when unmounted. */}
    }
   }
  };
  raf=requestAnimationFrame(paint);return()=>cancelAnimationFrame(raf);
 },[open,step,cameraOn,videoRef,bodyPreviewRef,floorPreviewRef,marks,editing]);
 const now=typeof performance!=='undefined'?performance.now():0;
 const frame=frameRef.current;
 const video=videoRef.current;
 const videoReady=!!video&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0;
 const key=cameraBindingKey(cameraBinding(video));
 const frameFresh=frame.source==='camera'&&frame.tracked&&frame.time>0&&now-frame.time>=0&&now-frame.time<450;
 const identity=identityRouter.status;
 const floorStatus=floorTracker.status;
 const identityStable=performers===1?!!frame.pose?.length||!!frame.poses?.length:
  !identity.ambiguous&&identity.mode===2&&identity.visible.includes('A')&&identity.visible.includes('B')&&
  identity.observedFrameTime===frame.time&&identity.poseIndices.A!==null&&identity.poseIndices.B!==null;
 const gate=evaluateGuideGates({
  source:currentSource,cameraOn,phoneActive,videoReady,
  calibrated:floorStatus.calibrated&&calibrated,
  confirmed:floorStatus.confirmed&&confirmed,
  cameraMatched:!!key&&key===floorTracker.boundCamera,
  frameFresh,tracked:frame.tracked,performers,identityStable,
  contactCount:Math.max(floorStatus.contacts,contacts),
  archiveA:!!session.media.A,archiveB:!!session.media.B,skipArchive
 });
 // Keep high-frequency source metrics fresh while the wizard is open.
 void pulse;
 const currentGate=step===0?gate.input:step===1?gate.tracking:gate.stage;
 const changeStep=(target:0|1|2)=>{
  if(target>gate.maxStep){setMessage(target===1?gate.input.reason:gate.tracking.reason);return;}
  setMessage('');setStep(target);
 };
 const dirty=()=>{
  onBlackout();
  if(floorTracker.isCalibrated)floorTracker.revoke('Sudut atau ukuran lantai berubah. Terapkan dan konfirmasi ulang.');
  identityRouter.reset();
 };
 const selectPoint=(e:PointerEvent<HTMLCanvasElement>)=>{
  if(step!==1||!gate.input.ready)return;
  const video=videoRef.current,canvas=cameraPreview.current;
  if(!video||!canvas||!video.videoWidth||!video.videoHeight)return;
  const rect=canvas.getBoundingClientRect();
  const px=(e.clientX-rect.left)*canvas.width/rect.width;
  const py=(e.clientY-rect.top)*canvas.height/rect.height;
  const scale=Math.min(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
  const w=video.videoWidth*scale,h=video.videoHeight*scale;
  const x=(px-(canvas.width-w)/2)/w,y=(py-(canvas.height-h)/2)/h;
  if(x<0||x>1||y<0||y>1){setMessage('Klik di dalam gambar kamera, pada sudut lantai yang terlihat.');return;}
  dirty();setMarks(prev=>prev.map((p,i)=>i===editing?{x,y}:p));
  setEditing(v=>(v+1)%4);setMessage('Sudut '+(editing+1)+' disimpan. Periksa posisi setiap titik sebelum menerapkan.');
 };
 const applyCalibration=()=>{
  try{
   if(!gate.input.ready)throw Error(gate.input.reason);
   if(marks.some(p=>p===null))throw Error('Tandai keempat sudut lantai terlebih dahulu.');
   const binding=cameraBinding(videoRef.current);
   if(!binding)throw Error('Sumber kamera belum siap.');
   const calibration=validateCameraFloorCalibration({
    schema:'soma.footprints.camera-floor',version:1,
    floor:defaultFloorSpace(widthM,depthM),cameraQuad:marks as Quad
   });
   dirty();floorTracker.configure(calibration,binding);
   setMessage('Empat titik diterapkan. Cocokkan urutan sudut, lalu konfirmasi di bawah.');
  }catch(e){setMessage(e instanceof Error?e.message:'Kalibrasi gagal.');}
 };
 const confirmCalibration=(value:boolean)=>{
  try{
   onBlackout();floorTracker.confirm(value);identityRouter.reset();
   setMessage(value?'Kalibrasi kamera–lantai dikonfirmasi. Langkahkan kaki sekali untuk memeriksa Contact.':'Kalibrasi dinonaktifkan.');
  }catch(e){setMessage(e instanceof Error?e.message:'Konfirmasi belum berhasil.');}
 };
 const enterPerform=()=>{
  if(!gate.stage.ready){setMessage(gate.stage.reason);return;}
  onBlackout();onClose();onPerform();
 };
 const chooseArchive=(slot:'A'|'B')=>(event:ChangeEvent<HTMLInputElement>)=>{
  const f=event.currentTarget.files?.[0];if(!f)return;
  void session.chooseMedia(slot,f).then(ok=>setMessage(ok?'Arsip '+slot+' tersimpan di proyek lokal.':'Arsip gagal disimpan. Periksa format dan ukuran file.'));
  event.currentTarget.value='';
 };
 const next=()=>{if(step===0){if(gate.input.ready)changeStep(1);else setMessage(gate.input.reason);}
  else if(step===1){if(gate.tracking.ready)changeStep(2);else setMessage(gate.tracking.reason);}
  else enterPerform();
 };
 const sourceLabel=currentSource==='phone'?'Kamera HP':currentSource==='laptop'?'Webcam laptop':'Simulasi';
 return <section className="soma-guided-setup soma-guided-v2" hidden={!open}
  aria-label="Guided Stage Setup 2.0" aria-hidden={!open}>
  <header>
   <div><small>SOMA / S6.5.1 · GUIDED SETUP 2.0</small><h2>Siapkan panggung</h2>
    <p>Hubungkan sumber, periksa gerak kaki, lalu atur media panggung.</p></div>
   <button type="button" onClick={onClose} aria-label="Tutup setup">Tutup</button>
  </header>
  <nav className="soma-guided-steps" aria-label="Tahap setup">
   {steps.map((item,i)=>{
    const phase=i===0?gate.input:i===1?gate.tracking:gate.stage;
    return <button key={item.name} type="button" disabled={i>gate.maxStep}
     aria-current={step===i?'step':undefined}
     aria-label={item.name+' — '+(phase.ready?'Siap':phase.reason)}
     onClick={()=>changeStep(i as 0|1|2)}>
     <span>{i+1<10?'0'+(i+1):i+1}</span>
     <strong>{item.name}</strong>
     <small>{phase.ready?'Siap':item.hint}</small>
    </button>;
   })}
  </nav>
  <div className="soma-guide-main">
   <div className="soma-guide-work">
    {step===0&&<div className="soma-setup-page">
     <div className="soma-guide-section-top"><h3>Pilih sumber gerak</h3><p>Cukup satu kamera untuk mulai.</p></div>
     <div className="soma-setup-choice">
      <button type="button" aria-pressed={currentSource==='laptop'} onClick={()=>{session.patch({source:'laptop'});onStartLaptop();setMessage('Menyambungkan webcam laptop…');}}>
       <b>Webcam laptop</b><small>Gunakan kamera komputer</small></button>
      <button type="button" aria-pressed={currentSource==='phone'} onClick={()=>{session.patch({source:'phone'});setMessage('Buka QR, lalu arahkan kamera HP ke panggung.');}}>
       <b>Kamera HP</b><small>Scan QR untuk video langsung</small></button>
     </div>
     {currentSource==='phone'&&!phoneActive&&
      <div className="soma-guide-pair"><PhoneCameraReceiver onStream={onPhoneStream} onDisconnect={onPhoneDisconnect}/></div>}
     {currentSource==='phone'&&phoneActive&&<div className="soma-setup-status">Kamera HP tersambung. Periksa preview di samping.</div>}
     <button type="button" className="soma-guide-text-link"
      onClick={()=>{session.patch({source:'simulation'});onClose();onSimulator();}}>Coba simulasi 3D tanpa kamera</button>
     <details className="soma-guide-advanced"><summary>Informasi koneksi</summary>
      <p>Sumber yang dipilih: {sourceLabel}. Preview berasal dari video yang sama dengan pelacak SOMA. Tidak mengunggah video ke server.</p>
      <p>Mode input MP4 akan tersedia melalui Video Motion Lab pada sprint terpisah.</p>
     </details>
    </div>}
    {step===1&&<div className="soma-setup-page">
     <div className="soma-guide-section-top"><h3>Kalibrasi & cek langkah</h3>
      <p>Klik empat sudut lantai pada preview kamera, sesuai urutan. Gambar kamera tidak dicerminkan.</p></div>
     <div className="soma-guide-corners" role="group" aria-label="Sudut lantai yang diedit">
      {corners.map((corner,i)=><button type="button" key={corner} aria-pressed={editing===i}
       onClick={()=>setEditing(i)}>{i+1}. {corner} {marks[i]?'✓':''}</button>)}
     </div>
     <div className="soma-guide-dimensions">
      <label>Ukuran lantai
       <select value={sizes.find(s=>s.w===widthM&&s.d===depthM)?.label??'custom'}
        onChange={e=>{const p=sizes.find(s=>s.label===e.target.value);if(p){dirty();setWidthM(p.w);setDepthM(p.d);}}}>
        {sizes.map(s=><option key={s.label} value={s.label}>{s.label}</option>)}
        <option value="custom" disabled>Ukuran khusus</option>
       </select></label>
      <button type="button" onClick={()=>{dirty();setMarks(emptyCorners());setEditing(0);setMessage('Empat titik direset.');}}>Ulangi titik</button>
     </div>
     <div className="soma-guide-actions">
      <button type="button" className="soma-setup-primary" disabled={!gate.input.ready||marks.some(x=>!x)}
       onClick={applyCalibration}>Terapkan 4 titik</button>
      <label className="soma-guide-confirm"><input type="checkbox" checked={floorStatus.confirmed}
       disabled={!floorStatus.calibrated||!gate.input.ready} onChange={e=>confirmCalibration(e.target.checked)}/>
       Saya sudah memeriksa urutan sudut lantai</label>
     </div>
     <div className="soma-guide-metrics">
      <div><small>Kalibrasi</small><b>{floorStatus.confirmed?'Dikonfirmasi':floorStatus.calibrated?'Perlu konfirmasi':'Belum siap'}</b></div>
      <div><small>Gerak kaki</small><b>{frameFresh?'Terbaca':'Menunggu tubuh'}</b></div>
      <div><small>Contact</small><b>{Math.max(contacts,floorStatus.contacts)} pijakan</b></div>
      <div><small>Performer</small><b>{performers===1?'1 tubuh':identityStable?'A/B stabil':'Periksa A/B'}</b></div>
     </div>
     <details className="soma-guide-advanced"><summary>Kalibrasi lanjutan & diagnostik</summary>
      <p>Editor empat titik ini mengatur bidang kamera–lantai. Kalibrasi proyektor dan uji optik lima titik dilakukan secara terpisah.</p>
      <button type="button" onClick={onCalibrate}>Buka kalibrasi & QA lengkap</button>
      {currentSource==='phone'&&<RealDeviceValidationPanel frameRef={frameRef} videoRef={videoRef}
       tracker={floorTracker} router={identityRouter} performers={performers} phoneActive={phoneActive}/>}
     </details>
    </div>}
    {step===2&&<div className="soma-setup-page">
     <div className="soma-guide-section-top"><h3>Siapkan materi panggung</h3>
      <p>Pasang arsip untuk BODY A/B atau mulai latihan gerak saja.</p></div>
     <div className="soma-guide-archives">
      {(['A','B'] as const).filter(slot=>slot==='A'||performers===2).map(slot=><label key={slot}>
       <b>BODY {slot}</b><small>{session.media[slot]?.name??'Belum ada video'}</small>
       <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" onChange={chooseArchive(slot)}/>
      </label>)}
     </div>
     <label className="soma-guide-confirm"><input type="checkbox" checked={skipArchive}
      onChange={e=>setSkipArchive(e.target.checked)}/> Latihan tanpa arsip video</label>
     <div className="soma-guide-work-links">
      <button type="button" onClick={()=>{onClose();onComposer();}}>Atur Surface Composer</button>
      <button type="button" onClick={()=>{onClose();onArchive();}}>Buka Archival Mapping</button>
     </div>
     <label>Nama proyek <input type="text" maxLength={100} value={session.meta.name}
      onChange={e=>session.patch({name:e.target.value})}/></label>
     <div className="soma-setup-status">Output BODY/FLOOR tetap Blackout sampai kalibrasi proyektor dan QA fisik disetujui operator.</div>
     <details className="soma-guide-advanced"><summary>Pengaturan lanjutan</summary>
      <p>{session.message}</p>
      <button type="button" onClick={()=>{if(window.confirm('Hapus proyek dan arsip lokal SOMA?'))void session.reset();}}>Reset proyek lokal</button>
     </details>
    </div>}
   </div>
   <aside className="soma-guide-preview" aria-label="Preview inline SOMA">
    <div className="soma-guide-preview-head"><b>Kamera langsung</b><span data-ready={gate.input.ready}>{gate.input.ready?'LIVE':'OFFLINE'}</span></div>
    <canvas ref={cameraPreview} width={800} height={450} onPointerDown={selectPoint}
     data-editing={step===1} aria-label={step===1?'Klik sudut lantai pada video kamera mentah':'Preview kamera SOMA'}/>
    {!gate.input.ready&&<p className="soma-guide-preview-help">Pilih dan hubungkan kamera untuk melihat panggung.</p>}
    <div className="soma-guide-preview-pair">
     <div><small>BODY MASK</small><canvas ref={bodyPreview} width={320} height={180}
       aria-label="Preview mask tubuh dari engine Footprints"/></div>
     <div><small>FLOOR PAD</small><canvas ref={floorPreview} width={320} height={180}
       aria-label="Preview lantai dari engine FloorSession"/></div>
    </div>
    <p className="soma-guide-preview-note">{step===1?'Klik keempat sudut pada bidang video di atas. Pastikan seluruh telapak terlihat.':'Preview berasal dari engine SOMA yang sedang berjalan, tanpa membuka kamera kedua.'}</p>
   </aside>
  </div>
  <footer className="soma-guide-footer">
   <button type="button" disabled={step===0} onClick={()=>{setStep(s=>(s-1) as 0|1|2);setMessage('');}}>Kembali</button>
   <div role="status" aria-live="polite" className="soma-guide-gate-note">
    <span data-ready={currentGate.ready}>{currentGate.ready?'✓ Siap':currentGate.reason}</span>
    {message&&<small>{message}</small>}
   </div>
   <button type="button" className="soma-setup-primary" disabled={!currentGate.ready}
    onClick={next}>{step===2?'Buka Perform':'Lanjutkan'}</button>
  </footer>
 </section>;
}
