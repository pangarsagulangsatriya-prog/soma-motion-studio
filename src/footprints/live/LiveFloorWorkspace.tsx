import {useEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';
import {Camera,Download,Footprints,RefreshCcw,X} from 'lucide-react';
import type {MotionFrame} from '../../engine/types.ts';
import type {Projection} from '../../projection/useProjection.ts';
import {FloorProjectionPanel} from '../simulator/FloorProjectionPanel.tsx';
import {paintFloorCanvas} from '../simulator/floorCanvas.ts';
import {floorArtworkSVG} from '../simulator/floor-artwork.ts';
import {defaultFloorSpace,validateCameraFloorCalibration,type CameraFloorCalibration,type FloorSpace} from '../spatial/coordinates.ts';
import {createFloorSession} from '../spatial/events.ts';
import {cameraBinding,LiveFloorTrackingEngine,type LiveFloorStatus} from './LiveFloorTrackingEngine.ts';
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
 onOpenOutput,onCalibrateProjector,onLive,onHold,onBlackout,onCalibrationDirty,onCameraConfirmed
}:Props){
 const dialog=useRef<HTMLDialogElement>(null),cameraCanvas=useRef<HTMLCanvasElement>(null);
 const onDirtyRef=useRef(onCalibrationDirty);onDirtyRef.current=onCalibrationDirty;
 const [floor,setFloor]=useState<FloorSpace>(tracker.floor??initialFloor);
 const [marksAt,setMarksAt]=useState<Point[]>(()=>tracker.calibrationData?.cameraQuad.map(p=>({...p}))??[]);
 const [select,setSelect]=useState(0);
 const [version,setVersion]=useState(0);
 const [status,setStatus]=useState<LiveFloorStatus>(tracker.status);
 const [message,setMessage]=useState('Ambil empat sudut lantai dari gambar kamera mentah.');
 const refreshed=()=>{setVersion(v=>v+1);setStatus(tracker.status);};
 const floorActive=tracker.floor??floor;
 const session=tracker.session??createFloorSession(floorActive);
 const svg=floorArtworkSVG(session,{width:960,height:720,showGrid:true,showTrail:false});
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
 },[videoRef,cameraOn,marksAt,select]);
 useEffect(()=>{
  const tick=()=>{
   const binding=cameraBinding(videoRef.current);
   if(tracker.isConfirmed&&!tracker.checkBinding(binding)){
    onDirtyRef.current();setMessage('Kamera atau resolusinya berubah. Kalibrasi perlu diulang.');
   }
   try{
    const canvas=projectorArtworkRef.current;
    if(canvas){
     const current=tracker.session??createFloorSession(floor);
     paintFloorCanvas(canvas,current,{markersOnly:testPattern,showGrid:false});
    }
   }catch(e){setMessage(e instanceof Error?e.message:'Output lantai gagal dirender.');}
   setStatus(tracker.status);setVersion(v=>v+1);
  };
  tick();const id=setInterval(tick,170);
  return()=>clearInterval(id);
 },[tracker,videoRef,projectorArtworkRef,testPattern,floor]);
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
  // Any change of physical marker must revoke the old approved projection.
  onCalibrationDirty();
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
   refreshed();onCalibrationDirty();
   setMessage('Kalibrasi valid secara geometri. Cocokkan posisi empat sudut lalu konfirmasi kamera.');
  }catch(e){setMessage(e instanceof Error?e.message:'Kalibrasi kamera gagal.');}
 };
 const confirmCamera=(yes:boolean)=>{
  try{
   tracker.confirm(yes);refreshed();onCameraConfirmed();
   setMessage(yes?'Pelacakan lantai diaktifkan. Pendaratan dihitung sebagai estimasi kamera.':'Pelacakan lantai dihentikan.');
  }catch(e){setMessage(e instanceof Error?e.message:'Belum bisa mengaktifkan pelacakan.');}
 };
 const newSession=()=>{
  if(status.events>0&&!window.confirm('Hapus seluruh event live floor pada sesi ini?'))return;
  tracker.resetSession();refreshed();setMessage('Sesi lantai baru dimulai.');
 };
 const exportJSON=()=>{
  const s=tracker.session;
  if(!s||!s.events.length)return;
  download(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),'SOMA-LIVE-FLOOR-v3.json');
 };
 return <dialog ref={dialog} className="live-floor-dialog" onCancel={e=>{e.preventDefault();onClose();}}
  aria-label="Footprints Live Floor Tracking">
  <header className="live-floor-header">
   <div><small>SOMA / FOOTPRINTS · S5.3</small><h2><Footprints size={20}/> Live Floor Tracking <em>Kamera Body</em></h2></div>
   <button type="button" onClick={onClose} aria-label="Tutup Live Floor Tracking"><X size={20}/></button>
  </header>
  <div className="live-floor-layout">
   <section className="live-floor-camera">
    <div className="live-floor-heading">01 / KALIBRASI KAMERA → LANTAI</div>
    <div className="live-floor-view">
     <canvas ref={cameraCanvas} width={800} height={450} onPointerDown={choosePoint}
      aria-label="Gambar kamera mentah. Klik posisi sudut lantai sesuai urutan 1 sampai 4."/>
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
   </section>
   <aside className="live-floor-sidebar">
    <section className="live-floor-preview">
     <div className="live-floor-heading">02 / FLOOR COORDINATES</div>
     <div className="live-floor-svg" dangerouslySetInnerHTML={{__html:svg}} aria-label="Jejak kontak pada lantai yang dipetakan"/>
     <dl>
      <div><dt>Jejak kontak</dt><dd>{status.contacts}</dd></div>
      <div><dt>Total event</dt><dd>{status.events}</dd></div>
      <div><dt>Body</dt><dd>{frameRef.current.tracked?'Terbaca':'Menunggu'}</dd></div>
     </dl>
     <p>{status.reason} Kamera monokular memperkirakan posisi kontak; tekanan dan titik pijakan persis belum terukur.</p>
     <div className="live-floor-tools">
      <button type="button" onClick={newSession}>Sesi baru</button>
      <button type="button" disabled={status.events===0} onClick={exportJSON}><Download size={15}/> JSON V3</button>
     </div>
    </section>
    <FloorProjectionPanel projection={projection} sourceLabel="live"
     verified={projectorVerified} testPattern={testPattern}
     onVerify={onProjectorVerify} onTestPattern={onTestPattern}
     onOpenOutput={onOpenOutput} onCalibrate={onCalibrateProjector}
     onLive={onLive} onHold={onHold} onBlackout={onBlackout}/>
   </aside>
  </div>
  <canvas ref={projectorArtworkRef} width={1280} height={720} hidden aria-hidden="true"/>
 </dialog>;
}
