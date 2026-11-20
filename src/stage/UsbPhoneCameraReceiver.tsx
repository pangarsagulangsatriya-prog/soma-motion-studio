import {useCallback,useEffect,useRef,useState} from 'react';
import {Check,ChevronDown,HelpCircle,LoaderCircle,RefreshCw,Video,VideoOff} from 'lucide-react';
import {cameraDeviceLabel,cameraErrorMessage,normalizeCameraDevices,openUniversalCamera} from '../engine/universalCamera.ts';
import {preferredCameraDevice,prioritizedCameraDevices,looksLikePhoneWebcam,cameraPathHelp,type CameraIntent} from '../engine/cameraRouteModel.ts';

type CameraPhase='searching'|'idle'|'connecting'|'connected'|'error';
const LAST_CAMERA_KEY='soma-universal-camera-last-v1';
const LAST_CAMERA_LABEL_KEY='soma-universal-camera-label-v1';

/** Compact universal device picker. CameraTracker stays in App; this component
 * only owns capture, permissions, and release of the raw MediaStream. */
export function UsbPhoneCameraReceiver({onStream,onDisconnect,intent='phone'}:{
 onStream:(stream:MediaStream)=>Promise<void>|void;onDisconnect:()=>void;
 intent?:CameraIntent;
}){
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const [deviceId,setDeviceId]=useState('');
 const [phase,setPhase]=useState<CameraPhase>('searching');
 const [message,setMessage]=useState('Memindai kamera…');
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
   setPhase('error');setMessage('Browser belum mendukung daftar kamera.');return;
  }
  try{
   const list=prioritizedCameraDevices(normalizeCameraDevices(await navigator.mediaDevices.enumerateDevices()),intent);
   if(!mounted.current)return;
   setDevices(list);
   if(active.current&&selectedDevice.current&&!list.some(d=>d.deviceId===selectedDevice.current)){
    stop(true);setPhase('error');setMessage('Kamera terputus. Periksa sambungan dan Map.');
    setDeviceId('');return;
   }
   setDeviceId(previous=>{
    if(list.some(d=>d.deviceId===previous))return previous;
    let saved='',savedLabel='';
    try{saved=localStorage.getItem(LAST_CAMERA_KEY)||'';
     savedLabel=localStorage.getItem(LAST_CAMERA_LABEL_KEY)||'';}catch{}
    // On a Mac with one built-in FaceTime camera, never silently pick it as HP.
    return preferredCameraDevice(list,intent,saved,savedLabel);
   });
   if(!active.current){
    setPhase('idle');
    setMessage(list.length?'Pilih kamera, lalu sambungkan.':intent==='phone'?'HP belum muncul sebagai webcam Mac.':'Kamera belum ditemukan.');
   }
  }catch(error){
   if(mounted.current&&!active.current){setPhase('error');setMessage(cameraErrorMessage(error));}
  }
 },[stop,intent]);
 useEffect(()=>{
  mounted.current=true;
  void refresh();
  const media=navigator.mediaDevices;
  media?.addEventListener?.('devicechange',refresh);
  return()=>{mounted.current=false;media?.removeEventListener?.('devicechange',refresh);stop(true);};
 },[refresh,stop]);
 const grant=async()=>{
  if(!window.isSecureContext){setPhase('error');setMessage('Buka SOMA melalui HTTPS atau localhost.');return;}
  const media=navigator.mediaDevices;
  if(!media?.getUserMedia){setPhase('error');setMessage('Browser ini tidak mendukung kamera.');return;}
  try{
   setPhase('searching');setMessage('Izinkan kamera lewat browser…');
   const permission=await media.getUserMedia({video:true,audio:false});
   permission.getTracks().forEach(t=>t.stop());
   if(mounted.current)await refresh();
  }catch(error){if(mounted.current){setPhase('error');setMessage(cameraErrorMessage(error));}}
 };
 const connect=async()=>{
  if(!deviceId||phase==='connecting'||phase==='searching')return;
  stop(true);
  const version=++generation.current;
  setPhase('connecting');setMessage('Memeriksa video…');
  let input:MediaStream|null=null;
  try{
   if(!window.isSecureContext)throw Error('Buka SOMA melalui HTTPS atau localhost.');
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Browser tidak mendukung input kamera.');
   const result=await openUniversalCamera(navigator.mediaDevices,deviceId);
   input=result.stream;
   if(version!==generation.current){input.getTracks().forEach(t=>t.stop());return;}
   active.current=input;
   const track=input.getVideoTracks()[0];
   const ended=()=>{
    if(version!==generation.current)return;
    stop(true);
    if(mounted.current){setPhase('error');setMessage('Sinyal kamera terputus. Sambungkan ulang.');}
   };
   endedHandler.current=ended;track.addEventListener('ended',ended);
   await callbacks.current.onStream(input);
   if(version!==generation.current)return;
   const settings=track.getSettings();
   const dimensions=settings.width&&settings.height?`${settings.width}×${settings.height}`:'Video aktif';
   const fps=settings.frameRate?` · ${Math.round(settings.frameRate)} fps`:'';
   setVideoInfo(dimensions+fps);
   try{localStorage.setItem(LAST_CAMERA_KEY,deviceId);
    const label=devices.find(d=>d.deviceId===deviceId)?.label;
    if(label)localStorage.setItem(LAST_CAMERA_LABEL_KEY,label);}catch{}
   if(mounted.current){setPhase('connected');setMessage('Tersambung');}
  }catch(error){
   if(version!==generation.current)return;
   if(input){
    input.getTracks().forEach(t=>t.stop());
    if(active.current===input){active.current=null;callbacks.current.onDisconnect();}
   }
   if(mounted.current){setPhase('error');setMessage(cameraErrorMessage(error));}
  }
 };
 const busy=phase==='connecting'||phase==='searching';
 const connected=phase==='connected';
 const needsPermission=devices.length===0||devices.some(device=>!device.label);
 const phoneDetected=devices.some(device=>looksLikePhoneWebcam(device.label));
 const showFeedback=phase==='error'||phase==='searching'||phase==='connecting'||connected||devices.length===0;
 return <section className="soma-usb-phone soma-camera-quick-connect" aria-label="Pilih kamera" data-phase={phase}>
  <div className="soma-usb-head">
   <label htmlFor="soma-usb-phone-device">{intent==='phone'?'Kamera HP':'Kamera'} <span className="soma-usb-count">{devices.length} terdeteksi di Mac</span></label>
   <button type="button" className="soma-usb-refresh" onClick={()=>void refresh()}
    title="Muat ulang daftar kamera" aria-label="Muat ulang daftar kamera" disabled={busy}>
    <RefreshCw size={15} aria-hidden="true"/>
   </button>
  </div>
  <div className="soma-usb-select-wrap">
   <select id="soma-usb-phone-device" value={deviceId} disabled={busy}
    title={devices.find(device=>device.deviceId===deviceId)?.label||'Pilih kamera'}
    onChange={e=>{if(active.current)stop(true);setDeviceId(e.target.value);setPhase('idle');setMessage('Pilih perangkat, lalu sambungkan.');}}>
    <option value="">{devices.length?'Pilih perangkat…':'Belum ada kamera'}</option>
    {devices.map((device,i)=><option key={device.deviceId} value={device.deviceId}>{cameraDeviceLabel(device,i)}</option>)}
   </select>
   <ChevronDown size={16} aria-hidden="true" className="soma-usb-chevron"/>
  </div>
  <div className="soma-usb-actions">
   {connected?
    <div className="soma-usb-connected" role="status">
     <Check size={16} aria-hidden="true"/> <span>Tersambung</span>
     {videoInfo&&<small>{videoInfo}</small>}
    </div>:
    <button type="button" className="soma-usb-primary soma-setup-primary"
     disabled={!deviceId||busy} onClick={()=>void connect()}>
     {busy?<LoaderCircle className="soma-usb-spin" size={16} aria-hidden="true"/>:<Video size={16} aria-hidden="true"/>}
     {phase==='connecting'?'Menghubungkan…':'Sambungkan'}
    </button>}
   {connected?<button type="button" className="soma-usb-disconnect"
     onClick={()=>{stop(true);setPhase('idle');setMessage('Kamera dihentikan.');}}
     title="Putuskan kamera" aria-label="Putuskan kamera"><VideoOff size={17} aria-hidden="true"/></button>:
    needsPermission?<button type="button" className="soma-usb-permission" onClick={()=>void grant()} disabled={busy}>
     Izinkan kamera
    </button>:null}
  </div>
  {showFeedback&&!connected&&<p className="soma-usb-status" role={phase==='error'?'alert':'status'} aria-live="polite" data-phase={phase}>
   <span className="soma-usb-status-dot" aria-hidden="true"/>
   <span>{message}</span>
  </p>}
  {intent==='phone'&&!phoneDetected&&!connected&&<p className="soma-phone-no-auto" role="status">
   HP belum teridentifikasi. Pilih kamera HP secara manual bila sudah muncul di Mac.
  </p>}
  <details className="soma-usb-help">
   <summary><HelpCircle size={14} aria-hidden="true"/> Kamera tidak muncul?</summary>
   <div className="soma-usb-help-body">
    <p>{cameraPathHelp(intent)}</p>
    <p><b>HDMI / OBS / NDI:</b> pilih Kamera lain di sumber SOMA, lalu aktifkan kamera/capture virtual.</p>
   </div>
  </details>
 </section>;
}
