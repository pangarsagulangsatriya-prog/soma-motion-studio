import {useEffect,useRef,useState} from 'react';
import {AutomaticPhoneReceiver} from './AutomaticPhoneReceiver.tsx';
import {UsbPhoneCameraReceiver} from './UsbPhoneCameraReceiver.tsx';
import {claimPhoneTransport,releasePhoneTransport,reportPhoneTransport,
 samplePhonePeer} from './PhoneDeviceTelemetry.ts';
import {collectPhoneIce,encodePhoneSignal,ICE_SERVERS,parsePhoneSignal,phoneCameraUrl} from './PhoneSignal.ts';

function ManualPhoneCameraReceiver({onStream,onDisconnect}:{
 onStream:(stream:MediaStream)=>Promise<void>|void;onDisconnect:()=>void;
}){
 const [offer,setOffer]=useState(''),[answer,setAnswer]=useState('');
 const [busy,setBusy]=useState(false),[connection,setConnection]=useState('Belum dipasangkan');
 const pc=useRef<RTCPeerConnection|null>(null);
 const active=useRef<MediaStream|null>(null),generation=useRef(0);
 const statsTimer=useRef<ReturnType<typeof setInterval>|null>(null);
 const telemetryOwner=useRef('manual-'+crypto.randomUUID()).current;
 const stop=()=>{
  generation.current++;
  if(statsTimer.current)clearInterval(statsTimer.current);statsTimer.current=null;
  releasePhoneTransport(telemetryOwner);
  pc.current?.close();pc.current=null;
  active.current?.getTracks().forEach(t=>t.stop());active.current=null;
  setOffer('');setAnswer('');setBusy(false);
  setConnection('Koneksi HP ditutup.');onDisconnect();
 };
 const onDisconnectRef=useRef(onDisconnect);onDisconnectRef.current=onDisconnect;
 useEffect(()=>()=>{generation.current++;
  if(statsTimer.current)clearInterval(statsTimer.current);
  releasePhoneTransport(telemetryOwner);pc.current?.close();
  const hadActive=!!active.current;
  active.current?.getTracks().forEach(t=>t.stop());active.current=null;
  if(hadActive)onDisconnectRef.current();
 },[]);
 const begin=async()=>{
  const version=++generation.current;
  pc.current?.close();active.current?.getTracks().forEach(t=>t.stop());
  active.current=null;pc.current=null;setBusy(true);setOffer('');setAnswer('');
  claimPhoneTransport(telemetryOwner,'manual');
  try{
   const p=new RTCPeerConnection(ICE_SERVERS);pc.current=p;
   statsTimer.current=setInterval(()=>{
    if(pc.current===p)void samplePhonePeer(telemetryOwner,p,'manual');
   },1000);
   p.addTransceiver('video',{direction:'recvonly'});
   p.addEventListener('track',e=>{
    if(pc.current!==p||generation.current!==version)return;
    const stream=e.streams[0]??new MediaStream([e.track]);
    active.current=stream;
    Promise.resolve(onStream(stream)).catch(err=>setConnection(
     'Video diterima tetapi pelacak gagal: '+String(err)));
   });
   p.addEventListener('connectionstatechange',()=>{
    if(pc.current!==p||generation.current!==version)return;
    const state=p.connectionState;
    if(state==='connected'){
     reportPhoneTransport(telemetryOwner,{state:'connected',reason:'WebRTC manual tersambung.'});
     void samplePhonePeer(telemetryOwner,p,'manual');
    }
    if(state==='failed'||state==='disconnected')
     reportPhoneTransport(telemetryOwner,{state:'interrupted',reason:'Koneksi manual terputus.'});
    setConnection(state==='connected'?'Kamera HP tersambung ke engine SOMA.':
     state==='failed'?'Koneksi gagal. Coba Wi-Fi sama atau periksa firewall.':
     'Jalur HP: '+state);
    if(state==='failed'||state==='disconnected')onDisconnect();
   });
   await p.setLocalDescription(await p.createOffer());
   setConnection('Mengumpulkan alamat jaringan…');
   await collectPhoneIce(p);
   if(generation.current!==version||!p.localDescription)return;
   setOffer(encodePhoneSignal(p.localDescription));
   setConnection('Kirim kode OFFER ke HP; tunggu kode ANSWER.');
  }catch(e){
   if(generation.current!==version)return;
   setConnection(e instanceof Error?e.message:'Gagal menyiapkan pairing.');
  }finally{if(generation.current===version)setBusy(false);}
 };
 const apply=async()=>{
  if(!pc.current||busy)return;
  setBusy(true);
  try{
   await pc.current.setRemoteDescription(parsePhoneSignal(answer,'answer'));
   setConnection('Menunggu video HP tersambung…');
  }catch(e){setConnection(e instanceof Error?e.message:'Kode jawaban gagal.');}
  finally{setBusy(false);}
 };
 const copy=async(text:string)=>{
  try{await navigator.clipboard.writeText(text);setConnection('Kode disalin. Tempel melalui chat pribadi ke perangkat tujuan.');}
  catch{setConnection('Pilih teks kode dan salin secara manual.');}
 };
 const url=phoneCameraUrl(window.location.origin,window.location.pathname);
 return <section className="soma-setup-phone" aria-label="Hubungkan kamera HP">
  <h3>Gunakan HP sebagai kamera</h3>
  <p>SOMA berjalan di laptop. HP cukup membuka halaman kamera melalui HTTPS, mengirim video tanpa audio, dan tetap menyala selama latihan.</p>
  <p><b>Halaman HP:</b> <a href={url} target="_blank" rel="noreferrer">{url}</a></p>
  <button type="button" onClick={()=>void copy(url)}>Salin tautan halaman HP</button>
  <p className="soma-setup-hint">Pairing manual awal: salin kode OFFER ke HP lewat pesan pribadi; salin kode ANSWER kembali ke laptop. Kode panjang karena belum ada server signaling/QR room. Gunakan kedua perangkat di Wi-Fi sama.</p>
  <button type="button" className="soma-setup-primary" disabled={busy} onClick={()=>void begin()}>
   {busy?'Menyiapkan…':'1. Buat kode OFFER di laptop'}</button>
  {offer&&<><label>Kode OFFER dari laptop
    <textarea readOnly rows={3} value={offer} onFocus={e=>e.target.select()}/></label>
    <button type="button" onClick={()=>void copy(offer)}>Salin OFFER</button>
    <label>2. Tempel kode ANSWER dari HP
     <textarea rows={3} value={answer} onChange={e=>setAnswer(e.target.value)}
      placeholder="Paste kode dari halaman kamera HP…"/></label>
    <button type="button" className="soma-setup-primary" disabled={!answer.trim()||busy}
     onClick={()=>void apply()}>3. Sambungkan video HP ke SOMA</button>
  </>}
  <button type="button" className="soma-setup-secondary" onClick={stop}>Putuskan sambungan HP</button>
  <div className="soma-setup-status" role="status">{connection}</div>
  <small>WebRTC berusaha membuat jalur terenkripsi secara langsung. Pada jaringan yang memblokir koneksi peer-to-peer, TURN mungkin diperlukan; server relay belum disediakan pada MVP ini.</small>
 </section>;
}

/** USB webcam is the default; existing QR and manual WebRTC remain available. */
export function PhoneCameraReceiver({onStream,onDisconnect}:{
 onStream:(stream:MediaStream)=>Promise<void>|void;onDisconnect:()=>void;
}){
 const [mode,setMode]=useState<'usb'|'qr'|'manual'>('usb');
 return <div className="soma-setup-phone-choices">
  <div className="soma-setup-pair-tabs" role="group" aria-label="Metode kamera HP">
   <button type="button" aria-pressed={mode==='usb'} onClick={()=>setMode('usb')}>Kabel USB</button>
   <button type="button" aria-pressed={mode==='qr'} onClick={()=>setMode('qr')}>
    QR</button>
   <button type="button" aria-pressed={mode==='manual'} onClick={()=>setMode('manual')}>
    Manual</button>
  </div>
  {mode==='usb'?<UsbPhoneCameraReceiver onStream={onStream} onDisconnect={onDisconnect}/>:mode==='qr'?
   <AutomaticPhoneReceiver onStream={onStream} onDisconnect={onDisconnect}
    onUseManual={()=>setMode('manual')}/>:
   <ManualPhoneCameraReceiver onStream={onStream} onDisconnect={onDisconnect}/>}
 </div>;
}
