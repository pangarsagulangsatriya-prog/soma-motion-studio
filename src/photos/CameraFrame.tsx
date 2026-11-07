import {useEffect,useRef,useState} from 'react';
import {Camera,Mic,MicOff,X} from 'lucide-react';
import type {CameraCue} from './useCameraCue';
import {cameraCrop} from './framing';
import {cameraAvailable} from './store';

export function CameraFrame({cue}:{cue:CameraCue}){
 const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),[extent,setExtent]=useState(300),current=useRef(cue);current.current=cue;
 useEffect(()=>{const stage=root.current?.parentElement;if(!stage)return;const resize=()=>{const b=stage.getBoundingClientRect();setExtent(Math.max(1,Math.min(b.width,b.height)-80));};resize();const observer=new ResizeObserver(resize);observer.observe(stage);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!cue.frame.open)return;let raf=0;const draw=()=>{raf=requestAnimationFrame(draw);const c=canvas.current,a=current.current,v=a.videoRef.current;if(!c||!cameraAvailable(v))return;const crop=cameraCrop(v!.videoWidth,v!.videoHeight,a.frame.size);const resolution=Math.min(960,Math.max(1,Math.round(c.clientWidth*(window.devicePixelRatio||1))));if(c.width!==resolution)c.width=c.height=resolution;const x=c.getContext('2d')!;x.save();x.clearRect(0,0,c.width,c.height);if(a.settingsRef.current.mirror){x.translate(c.width,0);x.scale(-1,1);}x.drawImage(v!,crop.x,crop.y,crop.width,crop.height,0,0,c.width,c.height);x.restore();};raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);},[cue.frame.open]);
 const phase=cue.frame.phase;
 return <div ref={root} className={`camera-frame-layer ${cue.frame.open?'is-open':''}`} aria-hidden={!cue.frame.open}>
  {cue.frame.open&&<div className={`camera-viewfinder ${phase}`} style={{width:extent*cue.frame.size,height:extent*cue.frame.size}} aria-label="Bingkai kamera langsung">
   <canvas ref={canvas} aria-label="Gambar yang akan dipotret"/>
   <i className="finder-corner tl"/><i className="finder-corner tr"/><i className="finder-corner bl"/><i className="finder-corner br"/>
   <div className="finder-caption"><span><i/>KAMERA</span><button onClick={cue.close} aria-label="Tutup bingkai kamera"><X size={14}/></button></div>
   <div className="finder-instruction" role="status">{phase==='ready'?'Pukul pendek ke bawah → jepret':phase==='prepare'?'Tahan kepalan sebentar…':phase==='resize'?'Jauhkan / dekatkan dua telapak': 'Dua telapak: ukuran · kepalkan lalu pukul'}</div>
  </div>}
 </div>;
}

export function CameraCueControls({cue,ready}:{cue:CameraCue;ready:boolean}){
 return <section className="camera-cue-controls" aria-label="Suara dan bingkai kamera">
  <div className="section-label">KAMERA PANGGUNG <span>SUARA → TANGAN → FOTO</span></div>
  <p>Ucapkan <strong>“kamera”</strong>. Kotak muncul di tengah. Jauhkan atau dekatkan dua telapak, lalu kepalkan satu tangan dan pukul pendek ke bawah.</p>
  <div className="photo-main-actions"><button className={cue.listening?'outline-button listening':'primary-button'} disabled={cue.voice.status==='unsupported'} onClick={()=>cue.setVoiceEnabled(!cue.listening)}>{cue.listening?<MicOff size={16}/>:<Mic size={16}/>} {cue.listening?'Matikan mikrofon':'Aktifkan suara “kamera”'}</button><button className="outline-button" disabled={!ready} onClick={cue.open}><Camera size={16}/>Buka bingkai</button></div>
  <p className={`voice-status ${cue.voice.status}`} role="status"><i/>{cue.voice.message}</p>
  <p className="fine-print">Aktifkan mikrofon sekali sebelum tampil. Pengenal suara browser dapat mengirim audio ke layanan browser dan membutuhkan internet. SOMA tidak menyimpan ucapan. Saat tab ditinggalkan, mikrofon dimatikan. Tombol Buka bingkai tetap bisa dipakai.</p>
 </section>;
}
