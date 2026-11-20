import {useCallback,useEffect,useRef,useState} from 'react';
import {buildHorizontalCameraConstraints} from '../engine/cameraConstraints.ts';

type UsbCameraPhase='searching'|'idle'|'connecting'|'connected'|'error';
export function UsbPhoneCameraReceiver({onStream,onDisconnect}:{
 onStream:(stream:MediaStream)=>Promise<void>|void;onDisconnect:()=>void;
}){
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const [deviceId,setDeviceId]=useState('');
 const [phase,setPhase]=useState<UsbCameraPhase>('searching');
 const [message,setMessage]=useState('Mencari kamera yang dikenali laptop…');
 const active=useRef<MediaStream|null>(null),generation=useRef(0);
 const selectedDevice=useRef('');selectedDevice.current=deviceId;
 const callback=useRef({onStream,onDisconnect});callback.current={onStream,onDisconnect};
 const currentEnded=useRef<(()=>void)|null>(null);
 const stop=useCallback((notify=true)=>{
  generation.current++;
  const current=active.current;active.current=null;
  if(current){if(currentEnded.current)current.getVideoTracks().forEach(t=>t.removeEventListener('ended',currentEnded.current!));
   current.getTracks().forEach(t=>t.stop());if(notify)callback.current.onDisconnect();}
  currentEnded.current=null;
 },[]);
 const refresh=useCallback(async()=>{
  if(!navigator.mediaDevices?.enumerateDevices){setPhase('error');setMessage('Browser laptop tidak mendukung daftar kamera.');return;}
  try{
   const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
   setDevices(list);
   if(active.current&&selectedDevice.current&&!list.some(d=>d.deviceId===selectedDevice.current)){
    stop(true);setPhase('error');setMessage('Kamera USB dilepas. Sambungkan kembali, lalu periksa kalibrasi Map.');
    setDeviceId('');return;
   }
   setDeviceId(id=>list.some(d=>d.deviceId===id)?id:'');
   if(!active.current){setPhase('idle');setMessage(list.length?
    'Pilih kamera HP yang tampil di daftar, lalu sambungkan.':'Belum ada kamera. Sambungkan kabel data dan aktifkan mode Webcam di HP.');}
  }catch{if(!active.current){setPhase('error');setMessage('Daftar kamera gagal dibaca. Periksa izin kamera browser.');}}
 },[stop]);
 useEffect(()=>{
  void refresh();
  const media=navigator.mediaDevices;
  media?.addEventListener?.('devicechange',refresh);
  return()=>{media?.removeEventListener?.('devicechange',refresh);stop(true);};
 },[refresh,stop]);
 const grant=async()=>{
  if(!window.isSecureContext){setPhase('error');setMessage('Kamera USB memerlukan HTTPS atau localhost.');return;}
  try{
   setPhase('searching');setMessage('Izinkan kamera di browser untuk menampilkan nama perangkat.');
   const permission=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
   permission.getTracks().forEach(t=>t.stop());await refresh();
  }catch{setPhase('error');setMessage('Izin kamera belum diberikan. Periksa pengaturan browser.');}
 };
 const connect=async()=>{
  if(!deviceId||phase==='connecting')return;
  stop(true);
  const version=++generation.current;
  setPhase('connecting');setMessage('Menghubungkan kamera HP dalam format horizontal 16:9…');
  let input:MediaStream|null=null;
  try{
   if(!window.isSecureContext)throw Error('Buka SOMA melalui HTTPS atau localhost.');
   input=await navigator.mediaDevices.getUserMedia({audio:false,video:{
    ...buildHorizontalCameraConstraints({deviceId,captureSize:'720p',frameRateIdeal:24,frameRateMax:30}),
    width:{ideal:1280},height:{ideal:720},aspectRatio:{ideal:16/9}
   }});
   if(version!==generation.current){input.getTracks().forEach(t=>t.stop());return;}
   if(!input.active||!input.getVideoTracks().length)throw Error('Kamera tidak mengirim video.');
   active.current=input;
   const ended=()=>{if(version!==generation.current)return;
    stop(true);setPhase('error');setMessage('Kabel atau kamera terputus. Sambungkan ulang lalu pilih kamera.');};
   currentEnded.current=ended;input.getVideoTracks()[0].addEventListener('ended',ended);
   await callback.current.onStream(input);
   if(version!==generation.current)return;
   setPhase('connected');setMessage('Video HP aktif. SOMA menjaga bingkai horizontal 16:9. Periksa orientasi gambar dan kalibrasi ulang Map.');
  }catch(error){
   if(version!==generation.current)return;
   if(input){input.getTracks().forEach(t=>t.stop());if(active.current===input){active.current=null;callback.current.onDisconnect();}}
   setPhase('error');
   const e=error as {name?:string;message?:string};
   setMessage(e.name==='NotAllowedError'?'Izin kamera ditolak. Izinkan kamera lewat browser.':
    e.name==='NotFoundError'?'Kamera belum ditemukan. Periksa kabel dan mode Webcam HP.':
    e.name==='NotReadableError'?'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu dulu.':
    e.message||'Kamera USB belum bisa tersambung.');
  }
 };
 return <section className="soma-usb-phone" aria-label="Hubungkan kamera HP lewat USB">
  <p className="soma-usb-intro">Colok kabel USB <b>data</b> ke laptop. Aktifkan <b>Webcam</b> pada Android yang mendukung, atau Continuity Camera di iPhone + Mac. Untuk HP lain, gunakan aplikasi webcam virtual.</p>
  <label htmlFor="soma-usb-phone-device">Kamera di laptop</label>
  <select id="soma-usb-phone-device" value={deviceId} disabled={phase==='connecting'}
   onChange={e=>{if(active.current)stop(true);setDeviceId(e.target.value);setPhase('idle');}}>
   <option value="">Pilih kamera HP / USB…</option>
   {devices.map((d,i)=><option key={d.deviceId||i} value={d.deviceId}>{d.label||`Kamera ${i+1} (izinkan akses untuk melihat nama)`}</option>)}
  </select>
  <div className="soma-usb-actions">
   <button type="button" className="soma-setup-primary" disabled={!deviceId||phase==='connecting'}
    onClick={()=>void connect()}>{phase==='connecting'?'Menghubungkan…':phase==='connected'?'Sambungkan ulang':'Gunakan kamera'}</button>
   <button type="button" className="soma-setup-secondary" onClick={()=>void grant()} disabled={phase==='connecting'}>Cari kamera</button>
   {phase==='connected'&&<button type="button" className="soma-setup-secondary" onClick={()=>{stop(true);setPhase('idle');setMessage('Kamera HP dihentikan.');}}>Putuskan</button>}
  </div>
  <p className="soma-usb-status" role={phase==='error'?'alert':'status'} data-phase={phase}>{message}</p>
  <small>Kamera dibaca sebagai webcam oleh laptop. Kabel pengisian yang tidak membawa data tidak dapat mengirim video. QR tetap tersedia pada tab sebelah.</small>
 </section>;
}
