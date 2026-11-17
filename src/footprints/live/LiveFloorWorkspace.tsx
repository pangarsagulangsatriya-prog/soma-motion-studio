import {useEffect,useMemo,useRef,useState,type RefObject,type PointerEvent} from 'react';
import {Camera,Download,Footprints,RefreshCcw,X} from 'lucide-react';
import type {MotionFrame} from '../../engine/types.ts';
import type {Projection} from '../../projection/useProjection.ts';
import {FloorProjectionPanel} from '../simulator/FloorProjectionPanel.tsx';
import {paintFloorCanvas} from '../simulator/floorCanvas.ts';
import {floorArtworkSVG} from '../simulator/floor-artwork.ts';
import {defaultFloorSpace,validateCameraFloorCalibration,type CameraFloorCalibration,type FloorSpace} from '../spatial/coordinates.ts';
import {createFloorSession} from '../spatial/events.ts';
import {cameraBinding,cameraBindingKey,LiveFloorTrackingEngine,type LiveFloorStatus} from './LiveFloorTrackingEngine.ts';
import {FLOOR_MARKERS} from '../../stage/GuidedSetupEngine.ts';
import {differentialProjectedScan,resolveProjectedMatch,
 type ProjectedMatch} from '../../stage/ProjectedMarkerCalibration.ts';
import type {MarkerScan} from '../../stage/GuidedSetupEngine.ts';
import type {MultiPoseGaitRouter} from './MultiPoseGaitRouter.ts';
import {FloorRenderGate,floorPaintKey} from './FloorRenderGate.ts';
import {FloorRealtimeTimingWindow} from './FloorRealtimeDiagnostics.ts';
import {FloorRepaintScheduler} from './FloorRepaintScheduler.ts';
import {StageValidationPanel} from '../validation/StageValidationPanel.tsx';
import {CalibrationQAPanel} from '../validation/CalibrationQAPanel.tsx';
import {PhysicalAcceptancePanel} from '../validation/PhysicalAcceptancePanel.tsx';
import {StageOpticsPanel} from '../stage-optics/StageOpticsPanel.tsx';
import {CALIBRATION_QA_TARGETS,calibrationQAContextKey,calibrationQAReport,
 measureCalibrationQATarget,summarizeCalibrationQA,type CalibrationQASample} from '../validation/CalibrationQA.ts';
import {SoftwarePerformanceWindow} from '../validation/StageValidationRecorder.ts';
import type {Point,Quad} from '../../projection/geometry.ts';
import {download} from '../../engine/recording.ts';
import './live-floor.css';

const marks=[
 '1 · Kiri belakang / upstage left','2 · Kanan belakang / upstage right',
 '3 · Kanan depan / downstage right','4 · Kiri depan / downstage left'
];
const dims=[{label:'8 × 6 meter',w:8,h:6},{label:'6 × 4 meter',w:6,h:4},{label:'10 × 7 meter',w:10,h:7}];
type Props={
 onClose:()=>void;tracker:LiveFloorTrackingEngine;
 videoRef:RefObject<HTMLVideoElement|null>;frameRef:RefObject<MotionFrame>;
 projectorArtworkRef:RefObject<HTMLCanvasElement|null>;
 projection:Projection;cameraOn:boolean;cameraBusy:boolean;onStartBody:()=>void;
 projectorVerified:boolean;testPattern:boolean;onProjectorVerify:(v:boolean)=>void;
 onTestPattern:(v:boolean)=>void;onOpenOutput:()=>void;onCalibrateProjector:()=>void;
 onLive:()=>void;onHold:()=>void;onBlackout:()=>void;
 onCalibrationDirty:()=>void;onCameraConfirmed:()=>void;
 router:MultiPoseGaitRouter;performerCount:1|2;onPerformerCount:(v:1|2)=>void;
 showPredictions:boolean;onShowPredictions:(v:boolean)=>void;onResetIdentity:()=>void;
};
const initialFloor=defaultFloorSpace(8,6);
function videoRect(width:number,height:number,videoWidth:number,videoHeight:number){
 const factor=Math.min(width/videoWidth,height/videoHeight);
 const w=videoWidth*factor,h=videoHeight*factor;
 return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
export function LiveFloorWorkspace({
 onClose,tracker,videoRef,frameRef,projectorArtworkRef,projection,
 cameraOn,cameraBusy,onStartBody,projectorVerified,testPattern,onProjectorVerify,onTestPattern,
 onOpenOutput,onCalibrateProjector,onLive,onHold,onBlackout,onCalibrationDirty,onCameraConfirmed,
 router,performerCount,onPerformerCount,showPredictions,onShowPredictions,onResetIdentity
}:Props){
 const dialog=useRef<HTMLDialogElement>(null),cameraCanvas=useRef<HTMLCanvasElement>(null);
 const onDirtyRef=useRef(onCalibrationDirty);onDirtyRef.current=onCalibrationDirty;
 const [floor,setFloor]=useState<FloorSpace>(tracker.floor??initialFloor);
 const [marksAt,setMarksAt]=useState<Point[]>(()=>tracker.calibrationData?.cameraQuad.map(p=>({...p}))??[]);
 const [select,setSelect]=useState(0);
 const [qaTargetIndex,setQaTargetIndex]=useState<number|null>(null);
 const [qaSamples,setQaSamples]=useState<CalibrationQASample[]>([]);
 const [qaMessage,setQaMessage]=useState('Lima titik QA menunggu kalibrasi dan output fisik.');
 const [version,setVersion]=useState(0);
 const [,setMetricsTick]=useState(0);
 const renderGate=useRef(new FloorRenderGate()).current;
 const perfWindow=useRef(new SoftwarePerformanceWindow()).current;
 const realtime=useRef(new FloorRealtimeTimingWindow()).current;
 const paintCurrent=useRef<()=>void>(()=>{});
 const requestCurrent=useRef<()=>void>(()=>{});
 const prevViewKey=useRef(''),prevStatusKey=useRef('');
 const lastSoftwareUpdate=useRef(0);
 const [status,setStatus]=useState<LiveFloorStatus>(tracker.status);
 const [message,setMessage]=useState('Ambil empat sudut lantai dari gambar kamera mentah.');
 const [physicalUnsaved,setPhysicalUnsaved]=useState(false);
 const [projectedMarkers,setProjectedMarkers]=useState(false);
 const [assistedBusy,setAssistedBusy]=useState(false);
 const [assistedMessage,setAssistedMessage]=useState(
  'Proyeksikan empat marker pada lantai, baca dengan kamera, lalu periksa hasil.');
 const [projectedMatch,setProjectedMatch]=useState<ProjectedMatch|null>(null);
 const [floorAligned,setFloorAligned]=useState(false);
 const baseline=useRef<{
  image:Uint8ClampedArray;width:number;height:number;camera:string
 }|null>(null);
 const scanVersion=useRef(0),dragCorner=useRef<number|null>(null);
 const cameraScratch=useRef<HTMLCanvasElement|null>(null);
 const requestClose=()=>{
  scanVersion.current++;onBlackout();onTestPattern(false);
  if(physicalUnsaved&&!window.confirm('Anotasi panggung belum diekspor. Tutup dan hilangkan data review ini?'))return;
  onClose();
 };
 const refreshed=()=>{setVersion(v=>v+1);setStatus(tracker.status);};
 const floorActive=tracker.floor??floor;
 const qaContextKey=useMemo(()=>{
  try{return calibrationQAContextKey(tracker.calibrationData,tracker.boundCamera,
   projection.config.quad,projection.config.resolution);}
  catch{return '';}
 },[tracker.calibrationData,tracker.boundCamera,projection.config.quad,projection.config.resolution,version]);
 const qaSummary=useMemo(()=>qaContextKey?summarizeCalibrationQA(qaSamples,qaContextKey):null,
  [qaSamples,qaContextKey]);
 const qaOldContext=useRef(qaContextKey);
 useEffect(()=>{
  if(qaOldContext.current===qaContextKey)return;
  qaOldContext.current=qaContextKey;setQaSamples([]);setQaTargetIndex(null);
  setQaMessage('Kalibrasi atau perangkat berubah. Lima titik QA harus diukur ulang.');
  onTestPattern(false);onBlackout();
 },[qaContextKey]);
 const qaReady=!!qaContextKey&&cameraOn&&status.confirmed&&projection.status.connected;
 const qaOutputLive=testPattern&&projection.status.connected&&projection.transport==='live';
 const beginQA=()=>{
  setProjectedMarkers(false);baseline.current=null;setProjectedMatch(null);
  if(!qaReady){setQaMessage('Kalibrasi kamera harus dikonfirmasi dan proyektor tersambung.');return;}
  setQaSamples([]);setQaTargetIndex(0);setQaMessage('Aktifkan Live pada panel proyektor, lalu klik silang Q1 pada kamera.');
  onTestPattern(true);
 };
 const cancelQA=()=>{
  setQaTargetIndex(null);onTestPattern(false);onBlackout();
  setQaMessage('Uji dibatalkan dan proyektor di-Blackout. Hasil parsial dapat diekspor.');
 };
 const exportQA=()=>{
  try{
   if(!tracker.calibrationData||!tracker.boundCamera)throw Error('Kalibrasi belum lengkap.');
   const report=calibrationQAReport(tracker.calibrationData,projection.config.quad,
    tracker.boundCamera,projection.config.resolution,qaSamples);
   download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),
    'SOMA-S5-6-3-camera-projector-QA.json');
   setQaMessage('Laporan QA disimpan sebagai JSON; status berdasarkan titik yang diukur.');
  }catch(e){setQaMessage(e instanceof Error?e.message:'Laporan QA gagal diekspor.');}
 };
 const session=useMemo(()=>(showPredictions?router.previewSession:tracker.session)??createFloorSession(floorActive),
  [showPredictions,router,tracker,floorActive,version]);
 const svg=useMemo(()=>floorArtworkSVG(session,{width:960,height:720,showGrid:true,showTrail:false}),[session]);
 const softwareMetrics=perfWindow.metrics(projection.status.connected?projection.status.output:null);
 useEffect(()=>{
  dialog.current?.showModal();
  return()=>{dialog.current?.close();};
 },[]);
 useEffect(()=>{
  let raf=0,lastPaint=0;
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-lastPaint<1000/24)return;lastPaint=now;
   const canvas=cameraCanvas.current;if(!canvas)return;
   const ctx=canvas.getContext('2d');if(!ctx)return;
   const w=canvas.width,h=canvas.height,v=videoRef.current;
   ctx.fillStyle='#0b1410';ctx.fillRect(0,0,w,h);
   if(!v||!cameraOn||!v.videoWidth||!v.videoHeight||v.readyState<2){
    ctx.font='16px system-ui';ctx.fillStyle='#d7e6cd';ctx.textAlign='center';
    ctx.fillText('Kamera Body belum siap',w/2,h/2);
    return;
   }
   const box=videoRect(w,h,v.videoWidth,v.videoHeight);
   // Draw raw, unmirrored camera pixels: MediaPipe stage mirror is NOT used.
   ctx.drawImage(v,box.x,box.y,box.width,box.height);
   ctx.strokeStyle='#91b5a4';ctx.lineWidth=1.4;
   ctx.strokeRect(box.x,box.y,box.width,box.height);
   marksAt.forEach((p,i)=>{
    const x=box.x+p.x*box.width,y=box.y+p.y*box.height;
    ctx.beginPath();ctx.arc(x,y,i===select?12:9,0,Math.PI*2);
    ctx.fillStyle=i===select?'#d9e79d':'#bad3c3';ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle='#17281c';ctx.stroke();
    ctx.fillStyle='#09170e';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText(String(i+1),x,y+4.5);
   });
   if(marksAt.length===4){
    ctx.beginPath();
    marksAt.forEach((p,i)=>{
     const x=box.x+p.x*box.width,y=box.y+p.y*box.height;
     if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    });
    ctx.closePath();ctx.strokeStyle='#d3e9a0';ctx.lineWidth=2.5;ctx.stroke();
   }
  };
  raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
 },[videoRef,cameraOn,marksAt,select,qaTargetIndex,qaSamples]);
 // Floor contacts notify the workspace directly and schedule the NEXT animation
 // frame. A 120ms watchdog covers camera changes, ghost expiry and telemetry.
 paintCurrent.current=()=>{
  const binding=cameraBinding(videoRef.current);
  if(tracker.isConfirmed&&!tracker.checkBinding(binding)){
   onDirtyRef.current();setMessage('Kamera atau resolusinya berubah. Kalibrasi perlu diulang.');
  }
  try{
   const canvas=projectorArtworkRef.current,now=performance.now();
   perfWindow.observeCamera(frameRef.current.telemetry??null);
   const ghostIds=showPredictions?router.getGhosts(router.displayClockMs).map(g=>g.id):[];
   const activeFloor=tracker.floor??floor;
   const key=floorPaintKey(tracker.eventRevision,ghostIds,testPattern,
    activeFloor.widthM,activeFloor.depthM,showPredictions)+':qa:'+String(qaTargetIndex)+
    ':projected:'+String(projectedMarkers);
   if(canvas&&renderGate.shouldPaint(key,now)){
    const current=(showPredictions?router.previewSession:tracker.session)??createFloorSession(activeFloor);
    const start=performance.now();
    paintFloorCanvas(canvas,current,{markersOnly:testPattern,showGrid:false,
     projectedMarkers:testPattern&&projectedMarkers&&qaTargetIndex===null,
     qaTarget:testPattern&&qaTargetIndex!==null?CALIBRATION_QA_TARGETS[qaTargetIndex]:null});
    canvas.dataset.floorRevision=key;
    const paintedAt=performance.now();
    perfWindow.observePaint(start,paintedAt);
    if(testPattern||!tracker.isConfirmed)realtime.dropPending();
    else realtime.painted(paintedAt);
   }
   if(prevViewKey.current!==key){
    prevViewKey.current=key;setVersion(v=>v+1);
   }
   const next=tracker.status,statusKey=JSON.stringify(next);
   if(statusKey!==prevStatusKey.current){prevStatusKey.current=statusKey;setStatus(next);}
   if(now-lastSoftwareUpdate.current>=600){
    lastSoftwareUpdate.current=now;setMetricsTick(v=>v+1);
   }
  }catch(e){setMessage(e instanceof Error?e.message:'Output lantai gagal dirender.');}
 };
 useEffect(()=>{
  const scheduler=new FloorRepaintScheduler(
   callback=>requestAnimationFrame(callback),
   id=>cancelAnimationFrame(id),
   ()=>paintCurrent.current()
  );
  const schedule=()=>scheduler.invalidate();
  requestCurrent.current=schedule;
  const offEvents=tracker.subscribe(change=>{
   realtime.observe(change);schedule();
  });
  const offGhost=router.subscribe(schedule);
  schedule();
  const timer=setInterval(schedule,120);
  return()=>{
   offEvents();offGhost();clearInterval(timer);
   scheduler.dispose();requestCurrent.current=()=>{};
  };
 },[tracker,router,realtime]);
 useEffect(()=>{requestCurrent.current();},[
  showPredictions,testPattern,floor,qaTargetIndex,projectedMarkers
 ]);

 const videoPixel=(e:PointerEvent<HTMLCanvasElement>)=>{
  const v=videoRef.current,canvas=cameraCanvas.current;
  if(!v||!canvas||!v.videoWidth||!v.videoHeight||v.readyState<2)return null;
  const rect=canvas.getBoundingClientRect(),pixel={
   x:(e.clientX-rect.left)/rect.width*canvas.width,
   y:(e.clientY-rect.top)/rect.height*canvas.height
  };
  const box=videoRect(canvas.width,canvas.height,v.videoWidth,v.videoHeight);
  const point={x:(pixel.x-box.x)/box.width,y:(pixel.y-box.y)/box.height};
  return point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1?point:null;
 };
 const pointerDown=(e:PointerEvent<HTMLCanvasElement>)=>{
  if(qaTargetIndex!==null){choosePoint(e);return;}
  const pt=videoPixel(e);
  if(!pt){setMessage('Pilih titik di dalam gambar kamera.');return;}
  const closest=marksAt.map((p,i)=>({i,d:Math.hypot(p.x-pt.x,p.y-pt.y)}))
   .filter(x=>Number.isFinite(x.d)&&x.d<.043).sort((a,b)=>a.d-b.d)[0];
  if(!closest){choosePoint(e);return;}
  // Dragging an existing point remains a draft until apply+camera confirmation.
  scanVersion.current++;setProjectedMarkers(false);baseline.current=null;
  onTestPattern(false);onBlackout();onCalibrationDirty();
  setQaSamples([]);setQaTargetIndex(null);setProjectedMatch(null);
  dragCorner.current=closest.i;setSelect(closest.i);
  e.currentTarget.setPointerCapture(e.pointerId);
  setMessage('Geser sudut '+(closest.i+1)+' lalu terapkan empat titik.');
 };
 const pointerMove=(e:PointerEvent<HTMLCanvasElement>)=>{
  const idx=dragCorner.current;
  if(idx===null)return;
  const pt=videoPixel(e);if(!pt)return;
  setMarksAt(old=>old.map((p,i)=>i===idx?pt:p));
 };
 const pointerUp=(e:PointerEvent<HTMLCanvasElement>)=>{
  if(dragCorner.current===null)return;
  dragCorner.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))
   e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const captureProjectedFrame=()=>{
  const v=videoRef.current;
  const key=cameraBindingKey(cameraBinding(v));
  if(!v||!key||!cameraOn||v.readyState<2||v.videoWidth<1||v.videoHeight<1)
   throw Error('Aktifkan kamera Body yang memperlihatkan seluruh lantai.');
  const canvas=cameraScratch.current??document.createElement('canvas');
  cameraScratch.current=canvas;canvas.width=320;
  canvas.height=Math.max(80,Math.round(320*v.videoHeight/v.videoWidth));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Akses frame kamera tidak tersedia.');
  ctx.drawImage(v,0,0,canvas.width,canvas.height);
  return {image:ctx.getImageData(0,0,canvas.width,canvas.height).data,
   width:canvas.width,height:canvas.height,camera:key};
 };
 const startProjected=async()=>{
  const version=++scanVersion.current;
  setAssistedBusy(true);setProjectedMatch(null);setAssistedMessage('Menyiapkan frame awal saat proyektor Blackout…');
  onBlackout();onTestPattern(false);setProjectedMarkers(false);baseline.current=null;
  try{
   // Allow the browser output and camera exposure to settle after Blackout.
   await new Promise<void>(r=>setTimeout(r,650));
   if(version!==scanVersion.current)return;
   baseline.current=captureProjectedFrame();
   setQaTargetIndex(null);setQaSamples([]);
   setProjectedMarkers(true);onTestPattern(true);
   setAssistedMessage('Baseline tersimpan. Buka output, lalu tekan Live Test untuk memproyeksikan empat marker.');
  }catch(e){setAssistedMessage(e instanceof Error?e.message:'Gagal membaca baseline kamera.');}
  finally{if(version===scanVersion.current)setAssistedBusy(false);}
 };
 const stopProjected=()=>{
  scanVersion.current++;baseline.current=null;setProjectedMarkers(false);
  onTestPattern(false);onBlackout();setAssistedBusy(false);
  setAssistedMessage('Marker dihentikan; Blackout diminta. Kalibrasi manual tetap tersedia.');
 };
 const scanProjected=async()=>{
  if(!floorAligned){
   setAssistedMessage('Konfirmasi dulu bahwa marker diproyeksikan pada bidang lantai yang benar.');return;
  }
  if(!projectedMarkers||!testPattern||!projection.status.connected||
   projection.transport!=='live'){
   setAssistedMessage('Buka output dan tampilkan marker melalui Live Test lebih dulu.');return;
  }
  const reference=baseline.current;
  if(!reference){setAssistedMessage('Baseline belum ada. Ulangi persiapan marker.');return;}
  const version=++scanVersion.current;setAssistedBusy(true);
  try{
   const scans:MarkerScan[]=[];
   for(let i=0;i<5;i++){
    if(version!==scanVersion.current)throw Error('Scan dibatalkan.');
    if(!testPattern||projection.transport!=='live')throw Error('Output uji sudah tidak Live.');
    const frame=captureProjectedFrame();
    if(frame.camera!==reference.camera||frame.width!==reference.width||
     frame.height!==reference.height)throw Error('Kamera berubah. Rekam ulang baseline.');
    scans.push(differentialProjectedScan(frame.image,reference.image,frame.width,frame.height));
    await new Promise<void>(r=>setTimeout(r,190));
   }
   const match=resolveProjectedMatch(scans);
   if(version!==scanVersion.current)return;
   // Candidate never activates the projector: revoke old geometry & blackout.
   onBlackout();onTestPattern(false);setProjectedMarkers(false);baseline.current=null;
   onCalibrationDirty();setQaSamples([]);setQaTargetIndex(null);
   setMarksAt(match.cameraQuad.map(p=>({...p})));setSelect(0);
   setProjectedMatch(match);
   setAssistedMessage('Empat marker cocok selama lima frame. Periksa bidang kamera, geser jika perlu, terapkan dan konfirmasi secara manual.');
  }catch(e){
   if(version===scanVersion.current)
    setAssistedMessage(e instanceof Error?e.message:'Scan gagal. Gunakan empat titik manual.');
  }finally{if(version===scanVersion.current)setAssistedBusy(false);}
 };

 const choosePoint=(e:PointerEvent<HTMLCanvasElement>)=>{
  const v=videoRef.current,canvas=cameraCanvas.current;
  if(!v||!canvas||!v.videoWidth||!v.videoHeight||v.readyState<2)return;
  const rect=canvas.getBoundingClientRect(),pixel={
   x:(e.clientX-rect.left)/rect.width*canvas.width,
   y:(e.clientY-rect.top)/rect.height*canvas.height
  };
  const box=videoRect(canvas.width,canvas.height,v.videoWidth,v.videoHeight);
  const x=(pixel.x-box.x)/box.width,y=(pixel.y-box.y)/box.height;
  if(x<0||x>1||y<0||y>1){setMessage('Pilih titik di dalam gambar kamera.');return;}
  if(qaTargetIndex!==null){
   if(!qaOutputLive){setQaMessage('Pastikan mode Live aktif dan silang proyeksi terlihat sebelum mengambil titik.');return;}
   if(!tracker.isConfirmed||!tracker.checkBinding(cameraBinding(videoRef.current))){
    setQaMessage('Kamera berubah atau kalibrasi perlu disahkan ulang.');cancelQA();return;
   }
   try{
    if(!tracker.calibrationData)throw Error('Kalibrasi kamera belum tersedia.');
    const sample=measureCalibrationQATarget(tracker.calibrationData,qaTargetIndex,{x,y},qaContextKey);
    setQaSamples(old=>[...old.filter(s=>s.targetIndex!==qaTargetIndex),sample]);
    const next=qaTargetIndex+1;
    if(next===CALIBRATION_QA_TARGETS.length){
     setQaTargetIndex(null);onTestPattern(false);onBlackout();
     setQaMessage('Lima titik selesai. Output di-Blackout. Periksa galat dan ekspor JSON.');
    }else{
     setQaTargetIndex(next);
     setQaMessage(sample.targetId+' tercatat: galat '+sample.errorCm+' cm. Lanjutkan ke Q'+(next+1)+'.');
    }
   }catch(e){setQaMessage(e instanceof Error?e.message:'Titik QA gagal dibaca.');}
   return;
  }
  // Any change of physical marker must revoke prior projector approval and light.
  scanVersion.current++;setProjectedMarkers(false);baseline.current=null;
  onTestPattern(false);onBlackout();
  onCalibrationDirty();setQaSamples([]);setQaTargetIndex(null);
  setProjectedMatch(null);
  setMarksAt(old=>{
   const copy=old.slice(0,4);copy[select]={x,y};
   // Selecting a later point is allowed; the Apply button still requires all 4.
   return copy;
  });
  setSelect(i=>(i+1)%4);
  setMessage('Titik '+(select+1)+' ditandai. Lanjutkan dengan urutan sudut lantai.');
 };
 const commit=()=>{
  try{
   if(marksAt.length!==4||marksAt.some(p=>!p))throw Error('Tandai seluruh empat sudut lantai.');
   const binding=cameraBinding(videoRef.current);
   if(!binding)throw Error('Hubungkan kamera Body terlebih dahulu.');
   const calibration:CameraFloorCalibration={
    schema:'soma.footprints.camera-floor',version:1,floor,
    cameraQuad:marksAt as Quad
   };
   tracker.configure(validateCameraFloorCalibration(calibration),binding);
   setQaSamples([]);setQaTargetIndex(null);
   refreshed();onCalibrationDirty();
   setMessage('Kalibrasi valid secara geometri. Cocokkan posisi empat sudut lalu konfirmasi kamera.');
  }catch(e){setMessage(e instanceof Error?e.message:'Kalibrasi kamera gagal.');}
 };
 const confirmCamera=(yes:boolean)=>{
  try{
   tracker.confirm(yes);refreshed();onCameraConfirmed();
   if(!yes){setQaSamples([]);setQaTargetIndex(null);}
   setMessage(yes?'Pelacakan lantai diaktifkan. Pendaratan dihitung sebagai estimasi kamera.':'Pelacakan lantai dihentikan.');
  }catch(e){setMessage(e instanceof Error?e.message:'Belum bisa mengaktifkan pelacakan.');}
 };
 const newSession=()=>{
  if(status.events>0&&!window.confirm('Hapus seluruh event live floor pada sesi ini?'))return;
  tracker.resetSession();router.reset();realtime.clear();refreshed();setMessage('Sesi lantai baru dimulai.');
 };
 const exportJSON=()=>{
  const s=tracker.session;
  if(!s||!s.events.length)return;
  download(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),'SOMA-LIVE-FLOOR-v3.json');
 };
 return <dialog ref={dialog} className="live-floor-dialog" onCancel={e=>{e.preventDefault();requestClose();}}
  aria-label="Footprints Live Floor Tracking">
  <header className="live-floor-header">
   <div><small>SOMA / FOOTPRINTS · S5.7.4</small><h2><Footprints size={20}/> Live Floor Tracking <em>Kamera Body</em></h2></div>
   <button type="button" onClick={requestClose} aria-label="Tutup Live Floor Tracking"><X size={20}/></button>
  </header>
  <div className="live-floor-layout">
   <section className="live-floor-camera">
    <details className="live-floor-validation-drawer">
     <summary>00 / Stage Optics & Spatial Design <span>Denah, dua tubuh, pad, kamera dan proyektor</span></summary>
     <StageOpticsPanel key={floorActive.widthM+'x'+floorActive.depthM}
      floorWidthM={floorActive.widthM} floorDepthM={floorActive.depthM}
      frameRef={frameRef} cameraOn={cameraOn} performerCount={performerCount}
      identityAmbiguous={router.status.ambiguous} router={router} projection={projection}/>
    </details>
    <div className="live-floor-heading">01 / KALIBRASI KAMERA → LANTAI</div>
    <div className="live-floor-view">
     <canvas ref={cameraCanvas} width={800} height={450}
      onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={pointerUp} onPointerCancel={pointerUp}
      aria-label="Gambar kamera mentah. Klik posisi sudut atau geser empat titik dengan pointer."/>
    </div>
    <p className="live-floor-help">Kamera yang sama dengan SOMA Body. Klik sudut lantai di gambar mentah, sesuai nomor. Jangan ikuti posisi kaki yang sedang terangkat.</p>
    <div className="live-floor-corners" role="group" aria-label="Pilih sudut lantai">
     {marks.map((label,i)=><button type="button" key={label} aria-pressed={select===i}
      className={select===i?'selected':''} onClick={()=>setSelect(i)}>
      {label} {marksAt[i]?'✓':'·'}
     </button>)}
    </div>
    <div className="live-floor-tools">
     <button type="button" disabled={cameraBusy} onClick={onStartBody}><Camera size={15}/> {cameraBusy?'Menghubungkan…':'Hubungkan Body'}</button>
     <button type="button" onClick={()=>{onCalibrationDirty();setMarksAt([]);setSelect(0);setMessage('Empat titik dihapus. Tandai ulang pada gambar kamera.');}}><RefreshCcw size={15}/> Ulangi titik</button>
     <label>UKURAN LANTAI<select value={dims.find(v=>v.w===floor.widthM&&v.h===floor.depthM)?.label??''}
      onChange={e=>{
       const size=dims.find(v=>v.label===e.target.value);if(!size)return;
       onCalibrationDirty();setFloor(defaultFloorSpace(size.w,size.h));
       setMessage('Ukuran lantai diganti. Terapkan ulang kalibrasi kamera.');
      }}>{dims.map(v=><option key={v.label}>{v.label}</option>)}</select></label>
    </div>
    <div className="live-floor-tools">
     <button type="button" disabled={!cameraOn||marksAt.length!==4} onClick={commit}>Terapkan 4 titik kamera</button>
    </div>
    <label className="live-floor-confirm">
     <input type="checkbox" checked={status.confirmed} disabled={!status.calibrated}
      onChange={e=>confirmCamera(e.target.checked)}/>
     <span>Saya sudah memeriksa keempat sudut kamera dan arah kiri–kanan lantai.</span>
    </label>
    <div className="live-floor-status" role="status">
     <b>{!cameraOn?'Kamera mati':status.confirmed?'Kamera lantai aktif':status.calibrated?'Perlu konfirmasi':'Belum dikalibrasi'}</b>
     <span>{message}</span>
    </div>
    <details className="live-floor-validation-drawer soma-projected-assist">
     <summary>S6.2 / Assisted Auto Calibration <span>Marker proyeksi → kamera → drag → QA</span></summary>
     <p>Empat lingkaran warna muncul pada bidang proyektor FLOOR. Kamera memotret keadaan Blackout terlebih dahulu, kemudian membandingkannya dengan lima frame cahaya marker. Hasil cocok warna masih berupa draf.</p>
     <div className="soma-projected-fiducials" aria-label="Empat marker proyeksi berurutan">
      {FLOOR_MARKERS.map(m=><div key={m.id}>
       <span style={{backgroundColor:m.hex}}/><small>{m.label}</small>
      </div>)}
     </div>
     <label className="live-floor-confirm"><input type="checkbox" checked={floorAligned}
      onChange={e=>setFloorAligned(e.target.checked)}/>
      <span>Saya melihat bidang raster proyektor tepat pada area lantai yang hendak dikalibrasi, dan siap menggunakan Blackout.</span>
     </label>
     <div className="live-floor-tools">
      <button type="button" disabled={!cameraOn||assistedBusy||!floorAligned}
       onClick={()=>void startProjected()}>1 · Rekam baseline & siapkan marker</button>
      <button type="button" onClick={onOpenOutput}>2 · Buka jendela proyektor</button>
      <button type="button" disabled={!projectedMarkers||!projection.status.connected||assistedBusy}
       onClick={onLive}>3 · Tampilkan marker (Live Test)</button>
      <button type="button" disabled={!projectedMarkers||!testPattern||
       !projection.status.connected||projection.transport!=='live'||assistedBusy}
       onClick={()=>void scanProjected()}>
       {assistedBusy?'Membaca lima frame…':'4 · Cocokkan marker dari kamera'}</button>
      <button type="button" onClick={stopProjected}>Blackout / Batalkan</button>
     </div>
     {projectedMatch&&<p>Deteksi {projectedMatch.scans} frame; keyakinan warna minimum {
      Math.round(projectedMatch.confidence*100)}%. Sudut masih bisa digeser pada video sebelum diterapkan.</p>}
     <p role="status">{assistedMessage}</p>
     <p className="live-floor-help">Fallback: klik atau drag keempat sudut pada video, lalu Terapkan 4 titik kamera. Titik proyeksi tidak menggantikan bukti posisi lantai fisik. Lanjutkan uji silang lima titik setelah konfirmasi kamera; hasil QA tetap diperiksa operator.</p>
    </details>
    <CalibrationQAPanel activeIndex={qaTargetIndex} contextKey={qaContextKey}
     samples={qaSamples} ready={qaReady} outputLive={qaOutputLive} message={qaMessage}
     onBegin={beginQA} onCancel={cancelQA}
     onClear={()=>{setQaSamples([]);setQaMessage('Titik QA lama dihapus.');}}
     onExport={exportQA}/>
   </section>
   <aside className="live-floor-sidebar">
    <section className="live-floor-preview">
     <div className="live-floor-heading">02 / FLOOR COORDINATES</div>
     <div className="live-floor-mode" role="group" aria-label="Jumlah performer">
      <button type="button" aria-pressed={performerCount===1} onClick={()=>onPerformerCount(1)}>1 performer</button>
      <button type="button" aria-pressed={performerCount===2} onClick={()=>onPerformerCount(2)}>2 performer</button>
     </div>
     <label className="live-floor-ghost-toggle">
      <input type="checkbox" checked={showPredictions} onChange={e=>onShowPredictions(e.target.checked)}/>
      Jejak kemungkinan berikutnya <span>(bayangan, bukan kontak)</span>
     </label>
     {performerCount===2&&<div className="live-floor-identity" role="status">
      <b>{router.status.ambiguous?'Identitas belum pasti':router.status.visible.length?router.status.visible.join(' & ')+' terbaca':'Menunggu tubuh'}</b>
      <span>{router.status.reason}</span>
      <button type="button" onClick={onResetIdentity}>Reset identitas A/B</button>
     </div>}
     {status.footMotions.length>0&&<div className="live-floor-gait-state" aria-label="Estimasi gerak tiap kaki">
      <strong>GAIT / ESTIMASI KAMERA</strong>
      <div>{status.footMotions.map(m=><span key={m.performerId+':'+m.foot}
       className={'live-floor-motion-'+m.motion}>
       <b>{m.performerId==='performer-1'?'Solo':m.performerId} · {m.foot==='left'?'Kiri':'Kanan'}</b>
       <em>{m.motion==='step'?'Step':m.motion==='pivot'?'Pivot':m.motion==='slide'?'Slide':
        m.motion==='hold'?'Hold':'Belum pasti'}</em>
      </span>)}</div>
      <small>Label berdasarkan landmark kamera. Tekanan telapak dan kontak fisik belum diukur.</small>
     </div>}
     <div className="live-floor-svg" dangerouslySetInnerHTML={{__html:svg}} aria-label="Jejak kontak pada lantai yang dipetakan"/>
     <dl>
      <div><dt>Jejak kontak</dt><dd>{status.contacts}</dd></div>
      <div><dt>Total event</dt><dd>{status.events}</dd></div>
      <div><dt>Body</dt><dd>{performerCount===2?router.status.visible.length:frameRef.current.tracked?'1':'0'} / {performerCount}</dd></div>
      <div><dt>Bayangan</dt><dd>{showPredictions?router.status.ghostCount:0}</dd></div>
     </dl>
     <p>{status.reason} Kamera monokular memperkirakan posisi kontak; tekanan dan titik pijakan persis belum terukur.</p>
     <div className="live-floor-tools">
      <button type="button" onClick={newSession}>Sesi baru</button>
      <button type="button" disabled={status.events===0} onClick={exportJSON}><Download size={15}/> JSON V3</button>
     </div>
    </section>
    <details className="live-floor-validation-drawer">
     <summary>03 / Validasi fisik & performa <span>Pengukuran panggung</span></summary>
     <StageValidationPanel key={floorActive.widthM+'x'+floorActive.depthM}
      floor={floorActive} events={tracker.session?.events??[]} software={softwareMetrics}
      realtime={realtime.metrics} outputAck={projection.status.artworkTransfer}/>
    </details>
    <details className="live-floor-validation-drawer">
     <summary>04 / Physical Stage Acceptance <span>Video, pijakan nyata dan keputusan uji</span></summary>
     <PhysicalAcceptancePanel floor={floorActive} events={tracker.session?.events??[]}
      performerCount={performerCount} contextKey={qaContextKey}
      calibrationQA={qaSummary} calibrationSamples={qaSamples}
      cameraConfirmed={status.confirmed} projectorVerified={projectorVerified}
      onBlackout={onBlackout} onUnsavedChange={setPhysicalUnsaved}/>
    </details>
    <FloorProjectionPanel projection={projection} sourceLabel="live"
     verified={projectorVerified} testPattern={testPattern} qaActive={qaTargetIndex!==null}
     onVerify={onProjectorVerify} onTestPattern={onTestPattern}
     onOpenOutput={onOpenOutput} onCalibrate={onCalibrateProjector}
     onLive={onLive} onHold={onHold} onBlackout={onBlackout}/>
   </aside>
  </div>
  <canvas ref={projectorArtworkRef} width={1280} height={720} hidden aria-hidden="true"/>
 </dialog>;
}
