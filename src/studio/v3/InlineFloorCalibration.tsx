import {useCallback,useEffect,useState,type RefObject} from 'react';
import {Check,RotateCcw,ShieldAlert,SlidersHorizontal,X} from 'lucide-react';
import {cameraBinding,cameraBindingKey,type LiveFloorTrackingEngine}
 from '../../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import {defaultFloorSpace,validateCameraFloorCalibration}
 from '../../footprints/spatial/coordinates.ts';
import type {Point,Quad} from '../../projection/geometry.ts';
import './inline-floor-calibration.css';

const corners=['Kiri atas','Kanan atas','Kanan bawah','Kiri bawah'] as const;
const sizes=[{label:'5 × 5 m',w:5,d:5},{label:'4 × 3 m',w:4,d:3},{label:'6 × 4 m',w:6,d:4},
 {label:'8 × 6 m',w:8,d:6},{label:'10 × 8 m',w:10,d:8}] as const;
const emptyCorners=():Array<Point|null>=>[null,null,null,null];
export type InlineCalibrationOverlay={marks:Array<Point|null>;editing:number};

/** Uses the existing FloorSession + camera binding; no new capture or tracker.
 * S6.8.3 editor lives in Tracking Inspector and marks the main camera canvas. */
export function InlineFloorCalibration({videoRef,tracker,router,cameraOn,bodySelected,
 videoReady,cameraMatched,floorSize,onBlackout,onClose,onOpenQA,onOverlay,onTap}:{
 videoRef:RefObject<HTMLVideoElement|null>;tracker:LiveFloorTrackingEngine;
 router:MultiPoseGaitRouter;cameraOn:boolean;bodySelected:boolean;
 videoReady:boolean;cameraMatched:boolean;
 floorSize?:{widthM:number;depthM:number};
 onBlackout:()=>void;onClose:()=>void;onOpenQA:()=>void;
 onOverlay:(state:InlineCalibrationOverlay|null)=>void;
 onTap:(handler:((x:number,y:number)=>void)|null)=>void;
}){
 const [marks,setMarks]=useState<Array<Point|null>>(()=>
  tracker.calibrationData?.cameraQuad.map(p=>({...p}))??emptyCorners());
 const [editing,setEditing]=useState(0);
 const [localWidthM,setWidthM]=useState(()=>tracker.floor?.widthM??5);
 const [localDepthM,setDepthM]=useState(()=>tracker.floor?.depthM??5);
 const widthM=floorSize?.widthM??localWidthM;
 const depthM=floorSize?.depthM??localDepthM;
 const [message,setMessage]=useState('');
 const cameraReady=cameraOn&&bodySelected&&videoReady;
 const allMarked=marks.every(p=>p!==null);
 const dirty=useCallback(()=>{
  onBlackout();
  if(tracker.isCalibrated)tracker.revoke('Bidang lantai diubah. Terapkan dan konfirmasi ulang.');
  router.resetCalibrated();
 },[onBlackout,tracker,router]);
 const place=useCallback((x:number,y:number)=>{
  if(!cameraReady)return;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1){
   setMessage('Pilih titik dalam gambar kamera.');return;
  }
  dirty();
  setMarks(prev=>prev.map((point,i)=>i===editing?{x,y}:point));
  setEditing(prev=>(prev+1)%4);
  setMessage('Titik '+(editing+1)+' ditandai. Periksa urutan sebelum menerapkan.');
 },[cameraReady,dirty,editing]);
 useEffect(()=>{
  if(cameraReady)onOverlay({marks:marks.map(p=>p?{...p}:null),editing});
  else onOverlay(null);
 },[cameraReady,marks,editing,onOverlay]);
 useEffect(()=>()=>onOverlay(null),[onOverlay]);
 useEffect(()=>{onTap(place);},[place,onTap]);
 useEffect(()=>()=>onTap(null),[onTap]);
 const reset=()=>{
  dirty();setMarks(emptyCorners());setEditing(0);
  setMessage('Empat titik dikosongkan. Tandai ulang pada monitor kamera.');
 };
 const apply=()=>{
  try{
   if(!cameraReady)throw Error('Aktifkan kamera Body sampai gambar muncul.');
   if(!allMarked)throw Error('Tandai keempat sudut lantai terlebih dahulu.');
   const binding=cameraBinding(videoRef.current);
   if(!binding)throw Error('Video kamera belum siap untuk kalibrasi.');
   const calibration=validateCameraFloorCalibration({
    schema:'soma.footprints.camera-floor',version:1,
    floor:defaultFloorSpace(widthM,depthM),cameraQuad:marks as Quad
   });
   dirty();tracker.configure(calibration,binding);
   setMessage('Empat titik diterapkan. Periksa urutannya, lalu konfirmasi.');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal menerapkan kalibrasi.');}
 };
 const confirm=()=>{
  try{
   if(!cameraReady)throw Error('Kamera Body belum aktif.');
   const key=cameraBindingKey(cameraBinding(videoRef.current));
   if(!key||tracker.boundCamera!==key)
    throw Error('Kamera atau resolusi berubah. Terapkan ulang empat titik.');
   if(!tracker.isCalibrated)throw Error('Terapkan empat titik terlebih dahulu.');
   onBlackout();tracker.confirm(true);router.resetCalibrated();
   setMessage('Kalibrasi dikonfirmasi. Langkahkan kaki untuk memeriksa Contact.');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal mengonfirmasi lantai.');}
 };
 const matchesCurrentCamera=tracker.isCalibrated&&cameraMatched;
 return <section className="fp-inline-floor-editor" aria-label="Kalibrasi lantai empat titik">
  <header className="fp-inline-floor-heading">
   <div><small>TRACK / BIDANG KAMERA</small>
    <h2 id="fp-flow-inspector-title" tabIndex={-1}>Kalibrasi lantai</h2>
    <p>Tandai sudut bidang lantai langsung pada monitor kamera.</p></div>
   <button type="button" aria-label="Tutup kalibrasi" title="Kembali ke Track" onClick={onClose}><X size={17}/></button>
  </header>
  <div className="fp-inline-floor-body">
   <div className="fp-inline-floor-status" role="status">
    {cameraReady?'Kamera Body siap untuk penandaan.':'Hubungkan kamera Body hingga gambar muncul, lalu tandai bidang lantai.'}
   </div>
   <p className="fp-inline-floor-label">URUTAN SUDUT LANTAI</p>
   <div className="fp-inline-floor-corners" role="group" aria-label="Pilih titik yang akan ditandai">
    {corners.map((name,i)=><button type="button" key={name}
     aria-pressed={editing===i} disabled={!cameraReady}
     onClick={()=>setEditing(i)}>
     <span>{i+1}</span>{name}{marks[i]&&<Check size={13} aria-hidden="true"/>}
    </button>)}
   </div>
   <p className="fp-inline-floor-note">Klik sudut di monitor kamera. Pastikan keempat titik mengikuti urutan searah jarum jam. Video tidak dicerminkan.</p>
   {!floorSize&&<label className="fp-inline-floor-size">Ukuran lantai
    <select value={sizes.find(s=>s.w===widthM&&s.d===depthM)?.label??'custom'}
     onChange={event=>{
      const size=sizes.find(s=>s.label===event.target.value);
      if(size){dirty();setWidthM(size.w);setDepthM(size.d);}
     }}>
     {sizes.map(size=><option value={size.label} key={size.label}>{size.label}</option>)}
     <option value="custom" disabled>Ukuran khusus</option>
    </select>
   </label>}
   {floorSize&&<p className="fp-inline-floor-note">Bidang {widthM} × {depthM} m · ubah ukurannya di Map.</p>}
   <div className="fp-inline-floor-actions">
    <button type="button" onClick={reset}><RotateCcw size={14}/>Ulangi</button>
    <button type="button" className="fp-inline-floor-primary" disabled={!cameraReady||!allMarked}
     onClick={apply}><SlidersHorizontal size={14}/>Terapkan 4 titik</button>
   </div>
   <button type="button" className="fp-inline-floor-confirm"
    disabled={!cameraReady||!matchesCurrentCamera}
    onClick={confirm}>
    <Check size={15}/> {tracker.isConfirmed&&matchesCurrentCamera?'Kalibrasi dikonfirmasi':'Periksa urutan & konfirmasi'}
   </button>
   {message&&<p role="status" aria-live="polite" className="fp-inline-floor-message">{message}</p>}
   <div className="fp-inline-floor-readout">
    <span>Bidang lantai</span><strong>{!tracker.isCalibrated?'Belum diterapkan':
     !matchesCurrentCamera?'Kamera perlu pemeriksaan':tracker.isConfirmed?'Terkonfirmasi':'Menunggu konfirmasi'}</strong>
   </div>
   <details className="fp-inline-floor-advanced">
    <summary><ShieldAlert size={14}/> Kalibrasi & QA lanjutan</summary>
    <p>Kalibrasi kamera–lantai terpisah dari kalibrasi optik proyektor. Output fisik memerlukan pemeriksaan tersendiri.</p>
    <button type="button" onClick={onOpenQA}>Buka Calibration & QA</button>
   </details>
  </div>
 </section>;
}
