import {useEffect,useRef,useState,type PointerEvent,type RefObject} from 'react';
import type {Point,Quad} from '../projection/geometry.ts';
import {validQuad} from '../projection/geometry.ts';
import {defaultFloorSpace,validateCameraFloorCalibration,type FloorSpace} from '../footprints/spatial/coordinates.ts';
import {cameraBinding,type LiveFloorTrackingEngine} from '../footprints/live/LiveFloorTrackingEngine.ts';
import {combineStableMarkerScans,FLOOR_MARKERS,scanFloorMarkers,type MarkerScan} from './GuidedSetupEngine.ts';

const labels=['1 · Kiri belakang','2 · Kanan belakang','3 · Kanan depan','4 · Kiri depan'];
function fit(w:number,h:number,sw:number,sh:number){
 const f=Math.min(w/sw,h/sh),width=f*sw,height=f*sh;
 return {x:(w-width)/2,y:(h-height)/2,width,height};
}
export function GuidedFloorCalibration({tracker,videoRef,cameraOn,active,onDirty,onConfirmed,onOpenPhysicalQA}:{
 tracker:LiveFloorTrackingEngine;videoRef:RefObject<HTMLVideoElement|null>;cameraOn:boolean;active:boolean;
 onDirty:()=>void;onConfirmed:()=>void;onOpenPhysicalQA:()=>void;
}){
 const canvas=useRef<HTMLCanvasElement>(null),scanGeneration=useRef(0);
 const [points,setPoints]=useState<Point[]>(()=>tracker.calibrationData?.cameraQuad.map(p=>({...p}))??[]);
 const [selected,setSelected]=useState(0);
 const [floor,setFloor]=useState<FloorSpace>(()=>tracker.floor??defaultFloorSpace(8,6));
 const [message,setMessage]=useState('Tandai empat sudut lantai pada gambar kamera.');
 const [scanning,setScanning]=useState(false),[approval,setApproval]=useState(tracker.status);
 const activeRef=useRef(active);activeRef.current=active;
 useEffect(()=>tracker.subscribe(()=>setApproval(tracker.status)),[tracker]);
 useEffect(()=>()=>{scanGeneration.current++;},[]);
 useEffect(()=>{
  if(!active)return;
  let raf=0,last=0;
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);if(now-last<55)return;last=now;
   const el=canvas.current,ctx=el?.getContext('2d');
   if(!el||!ctx)return;
   ctx.fillStyle='#08130c';ctx.fillRect(0,0,el.width,el.height);
   const v=videoRef.current;
   if(!cameraOn||!v||v.readyState<2||!v.videoWidth||!v.videoHeight){
    ctx.fillStyle='#d4e3d0';ctx.font='15px system-ui';ctx.textAlign='center';
    ctx.fillText('Aktifkan kamera terlebih dahulu',el.width/2,el.height/2);return;
   }
   const r=fit(el.width,el.height,v.videoWidth,v.videoHeight);
   try{ctx.drawImage(v,r.x,r.y,r.width,r.height);}catch{return;}
   if(points.length>=2){
    ctx.strokeStyle='#e2eba2';ctx.lineWidth=2;ctx.beginPath();
    points.forEach((p,i)=>{if(!p)return;
     const x=r.x+p.x*r.width,y=r.y+p.y*r.height;
     if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
    if(points.length===4)ctx.closePath();ctx.stroke();
   }
   points.forEach((p,i)=>{if(!p)return;
    const x=r.x+p.x*r.width,y=r.y+p.y*r.height;
    ctx.beginPath();ctx.arc(x,y,selected===i?10:8,0,Math.PI*2);
    ctx.fillStyle=i===selected?'#f4edac':'#d8e6d0';ctx.fill();
    ctx.strokeStyle='#14241c';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#12231a';ctx.font='bold 12px monospace';ctx.textAlign='center';
    ctx.fillText(String(i+1),x,y+4);
   });
  };
  raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
 },[active,cameraOn,videoRef,points,selected]);
 const addPoint=(event:PointerEvent<HTMLCanvasElement>)=>{
  if(scanning)return;
  const el=canvas.current,v=videoRef.current;
  if(!el||!v||!cameraOn||v.readyState<2||!v.videoWidth||!v.videoHeight)return;
  const rect=el.getBoundingClientRect();
  const px=(event.clientX-rect.left)/rect.width*el.width;
  const py=(event.clientY-rect.top)/rect.height*el.height;
  const r=fit(el.width,el.height,v.videoWidth,v.videoHeight);
  const x=(px-r.x)/r.width,y=(py-r.y)/r.height;
  if(x<0||x>1||y<0||y>1){setMessage('Klik di dalam gambar kamera.');return;}
  onDirty();
  setPoints(old=>{const next=old.slice(0,4);next[selected]={x,y};return next;});
  setSelected((selected+1)%4);
  setMessage('Titik '+(selected+1)+' diperbarui. Periksa semua sudut.');
 };
 const autoscan=async()=>{
  const v=videoRef.current;
  if(!cameraOn||!v||v.readyState<2||!v.videoWidth||!v.videoHeight){
   setMessage('Kamera belum siap.');return;
  }
  const generation=++scanGeneration.current;setScanning(true);
  setMessage('Memeriksa 5 frame marker warna…');
  try{
   const scratch=document.createElement('canvas');scratch.width=320;
   scratch.height=Math.max(80,Math.round(320*v.videoHeight/v.videoWidth));
   const ctx=scratch.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw Error('Canvas kamera tidak tersedia.');
   const scans:MarkerScan[]=[];
   for(let i=0;i<5;i++){
    if(generation!==scanGeneration.current||!activeRef.current)throw Error('Pemindaian dibatalkan.');
    if(v.readyState<2||v.videoWidth<1)throw Error('Video kamera terputus.');
    ctx.drawImage(v,0,0,scratch.width,scratch.height);
    scans.push(scanFloorMarkers(ctx.getImageData(0,0,scratch.width,scratch.height).data,
     scratch.width,scratch.height));
    await new Promise<void>(resolve=>setTimeout(resolve,170));
   }
   const result=combineStableMarkerScans(scans);
   onDirty();setPoints(result.map(p=>({...p})));setSelected(0);
   setMessage('Empat marker stabil. Periksa urutan, ukuran lantai, lalu simpan dan konfirmasi.');
  }catch(e){setMessage(e instanceof Error?e.message:'Marker gagal dibaca. Gunakan empat titik manual.');}
  finally{if(generation===scanGeneration.current)setScanning(false);}
 };
 const save=()=>{
  try{
   if(!validQuad(points))throw Error('Tandai empat sudut berurutan di gambar kamera.');
   const binding=cameraBinding(videoRef.current);
   if(!cameraOn||!binding)throw Error('Kamera harus aktif.');
   const value=validateCameraFloorCalibration({schema:'soma.footprints.camera-floor',
    version:1,floor,cameraQuad:points as Quad});
   onDirty();tracker.configure(value,binding);
   setApproval(tracker.status);
   setMessage('Empat sudut tersimpan. Periksa geometri dan tekan Konfirmasi Kamera.');
  }catch(e){setMessage(e instanceof Error?e.message:'Kalibrasi gagal.');}
 };
 const confirm=()=>{
  try{
   if(!cameraOn||!tracker.isCalibrated||
    !tracker.checkBinding(cameraBinding(videoRef.current)))
    throw Error('Kamera berubah. Simpan ulang empat sudut.');
   onConfirmed();tracker.confirm(true);
   setApproval(tracker.status);
   setMessage('Kamera–lantai dikonfirmasi. Lanjutkan ke Tracking.');
  }catch(e){setMessage(e instanceof Error?e.message:'Konfirmasi gagal.');}
 };
 return <div className="soma-inline-calibration">
  <div className="soma-calib-image">
   <canvas ref={canvas} width={800} height={450} onPointerDown={addPoint}
    aria-label="Video kamera mentah. Klik empat sudut lantai sesuai nomor 1 hingga 4."/>
   <div className="soma-calib-legend">RAW CAMERA · TANPA MIRROR · EMPAT SUDUT</div>
  </div>
  <p className="soma-setup-hint">Klik titik 1–4 sesuai urutan bidang lantai, atau letakkan marker warna pada keempat sudut lalu pindai otomatis.</p>
  <div className="soma-calib-corners" role="group" aria-label="Pilih sudut">
   {labels.map((label,i)=><button type="button" key={label}
    aria-pressed={selected===i} onClick={()=>setSelected(i)}>
    {label} {points[i]?'✓':'·'}</button>)}
  </div>
  <div className="soma-calib-controls">
   <label>Lebar lantai (meter)<input type="number" min=".5" max="100" step=".1"
    value={floor.widthM} onChange={e=>{onDirty();setFloor({...floor,widthM:Number(e.target.value)});}}/></label>
   <label>Kedalaman lantai (meter)<input type="number" min=".5" max="100" step=".1"
    value={floor.depthM} onChange={e=>{onDirty();setFloor({...floor,depthM:Number(e.target.value)});}}/></label>
  </div>
  <details className="soma-calib-markers">
   <summary>Auto Scan · marker warna di lantai</summary>
   <p>Taruh kertas/pita warna terang di keempat sudut lantai. Pastikan seluruh marker terlihat, besar, tidak bergerak, dan latar jauh dari warna serupa.</p>
   <div className="soma-calib-swatches">
    {FLOOR_MARKERS.map(m=><div key={m.id}><span style={{backgroundColor:m.hex}}/>
     <small>{m.label}</small></div>)}
   </div>
   <button type="button" disabled={scanning||!cameraOn} onClick={()=>void autoscan()}>
    {scanning?'Memeriksa lima frame…':'Pindai empat marker'}</button>
   <p className="soma-setup-hint">Marker membantu kamera mengenali sudut lantai. Akurasi kamera–proyektor tetap harus diuji dengan lima titik fisik.</p>
  </details>
  <div className="soma-calib-actions">
   <button type="button" onClick={()=>{onDirty();setPoints([]);setSelected(0);}}
    disabled={!points.length}>Ulangi titik</button>
   <button type="button" className="soma-setup-primary" onClick={save}
    disabled={!cameraOn||!validQuad(points)}>Simpan empat titik</button>
   <button type="button" className="soma-setup-primary" onClick={confirm}
    disabled={!cameraOn||!approval.calibrated||approval.confirmed}>Konfirmasi Kamera</button>
  </div>
  <div className="soma-setup-status" role="status">{message} · {
   approval.confirmed?'Terkonfirmasi':approval.calibrated?'Tersimpan, belum dikonfirmasi':'Belum dikalibrasi'}</div>
  <button type="button" className="soma-setup-primary" onClick={onOpenPhysicalQA}>
   S6.2 · Marker proyeksi, drag empat titik & QA lima titik</button>
 </div>;
}
