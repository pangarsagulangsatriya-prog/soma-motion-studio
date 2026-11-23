import {useEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import type {Quad} from '../../projection/geometry.ts';
import {defaultFloorSpace,validateCameraFloorCalibration,type CameraFloorCalibration} from '../../footprints/spatial/coordinates.ts';

export type VideoFloorProfile={clip:File;width:number;height:number;calibration:CameraFloorCalibration};
/** An MP4 has its own camera viewpoint. Never reuse a live camera calibration. */
export function VideoSpatialCalibration({frameRef,profile,onSave}:{
 frameRef:RefObject<ExperimentalFrame|null>;
 profile:VideoFloorProfile|null;
 onSave:(next:VideoFloorProfile)=>void;
}){
 const canvas=useRef<HTMLCanvasElement|null>(null);
 const [quad,setQuad]=useState<Array<{x:number;y:number}>>([]);
 const [clip,setClip]=useState<File|null>(null);
 const [width,setWidth]=useState(5);
 const [depth,setDepth]=useState(5);
 const [message,setMessage]=useState('Ambil frame MP4, lalu klik empat sudut lantai secara berurutan.');
 useEffect(()=>{if(profile){setWidth(profile.calibration.floor.widthM);
  setDepth(profile.calibration.floor.depthM);}},[profile]);
 const take=()=>{
  const frame=frameRef.current;
  if(frame?.kind!=='video'||!frame.clip||!frame.video||!frame.ready||
     frame.video.readyState<2||!frame.video.videoWidth||!frame.video.videoHeight){
   setMessage('MP4 belum siap. Buka Track dan jalankan video.');return;
  }
  const ctx=canvas.current?.getContext('2d');
  if(!ctx)return;
  ctx.drawImage(frame.video,0,0,640,360);
  setClip(frame.clip);setQuad([]);setMessage('Klik sudut kiri atas, kanan atas, kanan bawah, kiri bawah.');
 };
 const point=(e:PointerEvent<SVGSVGElement>)=>{
  if(!clip||quad.length>=4)return;
  const rect=e.currentTarget.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return;
  const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));
  setQuad(old=>old.length<4?[...old,{x,y}]:old);
  setMessage(quad.length===3?'Empat sudut dipilih. Periksa bentuk bidang, lalu simpan.':
   'Sudut '+(quad.length+1)+' tercatat.');
 };
 const save=()=>{
  const frame=frameRef.current;
  if(quad.length!==4||!clip||frame?.kind!=='video'||frame.clip!==clip||!frame.video){
   setMessage('Frame berubah atau empat sudut belum lengkap. Ambil ulang frame.');return;
  }
  try{
   const calibration=validateCameraFloorCalibration({
    schema:'soma.footprints.camera-floor',version:1,
    floor:defaultFloorSpace(width,depth),cameraQuad:quad as Quad
   });
   onSave({clip,width:frame.video.videoWidth,height:frame.video.videoHeight,calibration});
   setMessage('Bidang MP4 tersimpan untuk file dan ukuran frame ini.');
  }catch(e){setMessage(e instanceof Error?e.message:'Bidang tidak valid.');}
 };
 const current=frameRef.current;
 const valid=!!profile&&current?.kind==='video'&&current.clip===profile.clip&&
  current.video?.videoWidth===profile.width&&current.video?.videoHeight===profile.height;
 return <details style={{border:'1px solid #395244',borderRadius:8,padding:10,marginBottom:10}}>
  <summary style={{cursor:'pointer',fontWeight:650}}>Sesuaikan lantai MP4 · {valid?'Tersimpan':'Ruang perkiraan'}</summary>
  <p style={{fontSize:12}}>Gunakan empat sudut bidang lantai pada video. Koordinat ini berlaku untuk file MP4 yang sama.</p>
  <button type="button" onClick={take}>Ambil frame MP4</button>
  <div style={{position:'relative',width:'100%',aspectRatio:'16 / 9',background:'#101511',marginTop:8}}>
   <canvas ref={canvas} width={640} height={360} style={{width:'100%',height:'100%',display:'block'}}/>
   <svg viewBox="0 0 640 360" onPointerDown={point} aria-label="Pilih empat sudut lantai dari kiri atas searah jarum jam"
    style={{position:'absolute',inset:0,width:'100%',height:'100%',touchAction:'none',cursor:'crosshair'}}>
    {quad.length>=2&&<polyline points={quad.map(p=>(p.x*640)+','+(p.y*360)).join(' ')}
     stroke="#e4edbd" fill="none" strokeWidth="2"/>}
    {quad.map((p,i)=><g key={i}><circle cx={p.x*640} cy={p.y*360} r="7" fill="#e4edbd" stroke="#17291e" strokeWidth="2"/>
     <text x={p.x*640+10} y={p.y*360-10} fontSize="16" fill="white">{i+1}</text></g>)}
   </svg>
  </div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginTop:8}}>
   <label>Lebar (m) <input type="number" min=".5" max="100" step=".5" value={width}
    onChange={e=>setWidth(Number(e.target.value))} style={{width:62}}/></label>
   <label>Dalam (m) <input type="number" min=".5" max="100" step=".5" value={depth}
    onChange={e=>setDepth(Number(e.target.value))} style={{width:62}}/></label>
   <button type="button" onClick={()=>{setQuad([]);setMessage('Klik empat sudut ulang.');}}>Ulang titik</button>
   <button type="button" disabled={quad.length!==4} onClick={save}>Simpan bidang MP4</button>
  </div>
  <p role="status" style={{fontSize:12}}>{message}</p>
 </details>;
}
