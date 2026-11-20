import {useCallback,useEffect,useRef,useState} from 'react';
import {cameraDeviceLabel,cameraErrorMessage,normalizeCameraDevices,openUniversalCamera} from '../engine/universalCamera.ts';

type CameraPhase='searching'|'idle'|'connecting'|'connected'|'error';
const LAST_CAMERA_KEY='soma-universal-camera-last-v1';
/** CAM-01–05: All OS-visible video inputs use this one picker.
 * CameraTracker remains owned by App; this component only owns raw capture. */
export function UsbPhoneCameraReceiver({onStream,onDisconnect}:{
 onStream:(stream:MediaStream)=>Promise<void>|void;onDisconnect:()=>void;
}){
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const [deviceId,setDeviceId]=useState('');
 const [phase,setPhase]=useState<CameraPhase>('searching');
 const [message,setMessage]=useState('Mencari kamera laptop, USB, HDMI, dan virtual…');
 const [videoInfo,setVideoInfo]=useState('');
 const active=useRef<MediaStream|null>(null),generation=useRef(0);
 const selectedDevice=useRef('');selectedDevice.current=deviceId;
 const callbacks=useRef({onStream,onDisconnect});callbacks.current={onStream,onDisconnect};
 const endedHandler=useRef<(()=>void)|null>(null);
 const mounted=useRef(true);
 const stop=useCallback((notify=true)=>{
  generation.current++;
  const previous=active.current;active.current=null;
  if(previous){
   if(endedHandler.current)previous.getVideoTracks().forEach(t=>t.removeEventListener('ended',endedHandler.current!));
   previous.getTracks().forEach(t=>t.stop());
   if(notify)callbacks.current.onDisconnect();
  }
  endedHandler.current=null;
  if(mounted.current)setVideoInfo('');
 },[]);
 const refresh=useCallback(async()=>{
  if(!navigator.mediaDevices?.enumerateDevices){
   setPhase('error');setMessage('Browser tidak menyediakan daftar kamera. Gunakan browser HTTPS yang kompatibel.');return;
  }
  try{
   const list=normalizeCameraDevices(await navigator.mediaDevices.enumerateDevices());
   if(!mounted.current)return;
   setDevices(list);
   if(active.current&&selectedDevice.current&&!list.some(d=>d.deviceId===selectedDevice.current)){
    stop(true);setPhase('error');setMessage('Kamera dilepas. Hubungkan ulang dan periksa kalibrasi Map.');
    setDeviceId('');return;
   }
   setDeviceId(previous=>{
    if(list.some(d=>d.deviceId===previous))return previous;
    let saved='';
    try{saved=localStorage.getItem(LAST_CAMERA_KEY)||'';}catch{}
    return list.some(d=>d.deviceId===saved)?saved:'';
   });
   if(!active.current){setPhase('idle');setMessage(list.length?
    `${list.length} kamera tersedia. Pilih perangkat lalu klik Gunakan kamera.`:
    'Belum ada kamera. Sambungkan kabel USB, capture HDMI, atau jalankan OBS/NDI Webcam Input.');}
  }catch(error){if(mounted.current&&!active.current){
   setPhase('error');setMessage(cameraErrorMessage(error));
  }}
 },[stop]);
 useEffect(()=>{
  mounted.current=true;
  void refresh();
  const media=navigator.mediaDevices;
  media?.addEventListener?.('devicechange',refresh);
  return()=>{mounted.current=false;media?.removeEventListener?.('devicechange',refresh);stop(true);};
 },[refresh,stop]);
 const grant=async()=>{
  if(!window.isSecureContext){setPhase('error');setMessage('Izin kamera memerlukan HTTPS atau localhost.');return;}
  const media=navigator.mediaDevices;
  if(!media?.getUserMedia){setPhase('error');setMessage('Browser ini tidak mendukung kamera.');return;}
  try{
   setPhase('searching');setMessage('Izinkan kamera pada browser untuk membaca nama perangkat.');
   const permission=await media.getUserMedia({video:true,audio:false});
   permission.getTracks().forEach(t=>t.stop());
   await refresh();
  }catch(error){if(mounted.current){setPhase('error');setMessage(cameraErrorMessage(error));}}
 };
 const connect=async()=>{
  if(!deviceId||phase==='connecting')return;
  stop(true);
  const version=++generation.current;
  setPhase('connecting');setMessage('Menghubungkan kamera dan memeriksa video…');
  let input:MediaStream|null=null;
  try{
   if(!window.isSecureContext)throw Error('Buka SOMA melalui HTTPS atau localhost.');
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Browser tidak mendukung input kamera.');
   const result=await openUniversalCamera(navigator.mediaDevices,deviceId);
   input=result.stream;
   if(version!==generation.current){input.getTracks().forEach(t=>t.stop());return;}
   active.current=input;
   const track=input.getVideoTracks()[0];
   const ended=()=>{if(version!==generation.current)return;stop(true);
    if(mounted.current){setPhase('error');setMessage('Kamera kehilangan sinyal. Periksa HDMI/USB/OBS lalu sambungkan ulang.');}
   };
   endedHandler.current=ended;track.addEventListener('ended',ended);
   await callbacks.current.onStream(input);
   if(version!==generation.current)return;
   const settings=track.getSettings();
   const dimensions=settings.width&&settings.height?`${settings.width}×${settings.height}`:'Resolusi otomatis';
   const fps=settings.frameRate?` · ${Math.round(settings.frameRate)} fps`:'';
   setVideoInfo(dimensions+fps);
   try{localStorage.setItem(LAST_CAMERA_KEY,deviceId);}catch{}
   if(mounted.current){setPhase('connected');setMessage('Video kamera aktif. Periksa Stage Monitor, tracking kaki, dan Map.');}
  }catch(error){
   if(version!==generation.current)return;
   if(input){input.getTracks().forEach(t=>t.stop());
    if(active.current===input){active.current=null;callbacks.current.onDisconnect();}}
   if(mounted.current){setPhase('error');setMessage(cameraErrorMessage(error));}
  }
 };
 return <section className="soma-usb-phone" aria-label="Hubungkan semua jenis kamera">
  <p className="soma-usb-intro">Semua kamera yang dikenali laptop tampil di bawah: webcam, HP USB, HDMI capture, OBS, dan NDI Webcam Input. Tidak perlu memilih merek kamera.</p>
  <label htmlFor="soma-usb-phone-device">Kamera tersedia · {devices.length}</label>
  <select id="soma-usb-phone-device" value={deviceId} disabled={phase==='connecting'}
   onChange={e=>{if(active.current)stop(true);setDeviceId(e.target.value);setPhase('idle');}}>
   <option value="">Pilih kamera…</option>
   {devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{cameraDeviceLabel(d,i)}</option>)}
  </select>
  <div className="soma-usb-actions">
   <button type="button" className="soma-setup-primary" disabled={!deviceId||phase==='connecting'}
    onClick={()=>void connect()}>{phase==='connecting'?'Menghubungkan…':phase==='connected'?'Sambungkan ulang':'Gunakan kamera'}</button>
   <button type="button" className="soma-setup-secondary" onClick={()=>void grant()} disabled={phase==='connecting'}>Cari kamera</button>
   <button type="button" className="soma-setup-secondary" onClick={()=>void refresh()} disabled={phase==='connecting'}>Muat ulang</button>
   {phase==='connected'&&<button type="button" className="soma-setup-secondary" onClick={()=>{
    stop(true);setPhase('idle');setMessage('Kamera dihentikan.');}}>Putuskan</button>}
  </div>
  <p className="soma-usb-status" role={phase==='error'?'alert':'status'} data-phase={phase}>
   {message}{videoInfo?<span> · {videoInfo}</span>:null}
  </p>
  <details><summary>Bantuan HDMI, DSLR, OBS, IP, dan NDI</summary>
   <p>DSLR, handycam, atau kamera HDMI: sambungkan HDMI OUT ke capture card USB UVC; pilih perangkat capture yang muncul. Gunakan keluaran HDMI bersih.</p>
   <p>Kamera IP/RTSP: buka video di OBS, aktifkan OBS Virtual Camera, lalu pilih OBS dari daftar. Kamera NDI: aktifkan NDI Webcam Input pada laptop lebih dulu.</p>
   <p>Kamera hanya terdeteksi setelah OS menyediakan perangkat videoinput. SOMA tidak membuka alamat RTSP/NDI/HDMI mentah.</p>
  </details>
  <small>Preview utama tetap di Stage Monitor 16:9. Perubahan kamera memutus output LIVE dan meminta pemeriksaan Map ulang. Kamera dari jaringan lain memerlukan WebRTC/TURN terpisah.</small>
 </section>;
}
