import {useEffect,useId,useRef,useState} from 'react';
import {Cable,CircleHelp,Copy,KeyRound,Link2,QrCode,X} from 'lucide-react';
import {AutomaticPhoneReceiver} from './AutomaticPhoneReceiver.tsx';
import {UsbPhoneCameraReceiver} from './UsbPhoneCameraReceiver.tsx';
import {claimPhoneTransport,releasePhoneTransport,reportPhoneTransport,
 samplePhonePeer} from './PhoneDeviceTelemetry.ts';
import {collectPhoneIce,encodePhoneSignal,ICE_SERVERS,parsePhoneSignal,phoneCameraUrl} from './PhoneSignal.ts';

function ManualPhoneCameraReceiver({onStream,onDisconnect,engineError}:{
 onStream:(stream:MediaStream)=>Promise<void>|void;onDisconnect:()=>void;engineError?:string;
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
 useEffect(()=>{if(engineError&&active.current){stop();setConnection(engineError);}},[engineError]);
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
    Promise.resolve(onStream(stream)).then(()=>{if(generation.current===version)setConnection('Video HP diterima oleh engine SOMA.');}).catch(err=>{if(generation.current!==version)return;stop();setConnection('Video diterima tetapi pelacak gagal: '+String(err));});
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
    setConnection(state==='connected'?'Jalur HP tersambung · menunggu video dan pelacak.':
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
 const url=phoneCameraUrl(window.location.origin,window.location.pathname);
 const copy=async(text:string)=>{
  try{
   await navigator.clipboard.writeText(text);
   setConnection(text===url?'Tautan disalin. Buka di HP.':'Kode disalin. Tempel ke halaman HP.');
  }catch{setConnection('Salin melalui bagian Lihat tautan atau Lihat kode.');}
 };
 const connected=pc.current?.connectionState==='connected';
 const showStatus=connection!=='Belum dipasangkan'&&connection!=='Koneksi HP ditutup.'&&
  !connection.startsWith('Kirim kode OFFER');
 return <section className="soma-manual-pair" aria-label="Pairing kamera HP lewat kode">
  <div className="soma-manual-step">
   <span className="soma-manual-number" aria-hidden="true">1</span>
   <div className="soma-manual-step-text"><strong>Buka kamera di HP</strong></div>
   <button type="button" className="soma-manual-copy" onClick={()=>void copy(url)}
    title="Salin tautan halaman kamera ke HP"><Link2 size={14} aria-hidden="true"/> Salin tautan</button>
  </div>
  <details className="soma-manual-reveal">
   <summary>Lihat tautan HP</summary>
   <a href={url} target="_blank" rel="noreferrer" title="Buka halaman kamera di HP">{url}</a>
  </details>
  {!offer?<button type="button" className="soma-setup-primary soma-manual-primary" disabled={busy}
    onClick={()=>void begin()}>
    <span className="soma-manual-number" aria-hidden="true">2</span>
    {busy?'Menyiapkan kode…':'Buat kode laptop'}
   </button>:<>
   <div className="soma-manual-step soma-manual-offer">
    <span className="soma-manual-number" aria-hidden="true">2</span>
    <div className="soma-manual-step-text"><strong>Kode laptop siap</strong></div>
    <button type="button" className="soma-manual-copy" onClick={()=>void copy(offer)}
     title="Salin kode laptop ke halaman HP"><Copy size={14} aria-hidden="true"/> Salin kode</button>
   </div>
   <details className="soma-manual-reveal">
    <summary>Lihat kode laptop</summary>
    <textarea readOnly rows={3} value={offer} aria-label="Kode OFFER laptop"
     onFocus={e=>e.currentTarget.select()}/>
   </details>
   <label className="soma-manual-answer">
    <span><span className="soma-manual-number" aria-hidden="true">3</span> Kode balasan HP</span>
    <textarea rows={2} value={answer} onChange={e=>setAnswer(e.target.value)}
     placeholder="Tempel kode dari HP…" aria-label="Tempel kode balasan HP"/>
   </label>
   <button type="button" className="soma-setup-primary soma-manual-primary" disabled={!answer.trim()||busy}
    onClick={()=>void apply()}>{busy?'Menghubungkan…':'Sambungkan HP'}</button>
  </>}
  {showStatus&&<div className="soma-manual-status" role="status" aria-live="polite"
   data-phase={/gagal|ditolak|terputus|error/i.test(connection)?'error':connected?'connected':'info'}>
   {connection}
  </div>}
  {(offer||connected)&&<button type="button" className="soma-manual-stop" onClick={stop}>
   Putuskan
  </button>}
 </section>;
}

/** Camera transport modes. Long instructions stay behind contextual help. */
export function PhoneCameraReceiver({onStream,onDisconnect,initialMode='usb',engineError}:{
 onStream:(stream:MediaStream)=>Promise<void>|void;onDisconnect:()=>void;
 initialMode?:'usb'|'qr';engineError?:string;
}){
 const [mode,setMode]=useState<'usb'|'qr'|'manual'>(initialMode);
 const [helpOpen,setHelpOpen]=useState(false);
 const helpId=useId();
 const helpButton=useRef<HTMLButtonElement>(null);
 const helpPanel=useRef<HTMLElement>(null);
 const staticPages=window.location.hostname.endsWith('github.io');
 const guide=mode==='usb'?[
  'iPhone: aktifkan Continuity Camera dan percayai Mac. Android: pilih USB → Webcam di HP, jika tersedia.',
  'Pilih kamera HP yang muncul di Mac lalu klik Sambungkan.',
  'Kamera HP yang belum dikenali macOS tidak bisa dibuka lewat browser.'
 ]:mode==='qr'?(staticPages?[
  'Scan QR untuk membuka kamera HP dan izinkan akses video.',
  'GitHub Pages masih membutuhkan pertukaran kode WebRTC.',
  'Tekan Lanjut ke Kode, lalu tukar kode laptop dan HP.'
 ]:[
  'Tampilkan QR dan pindai menggunakan HP.',
  'Izinkan kamera HP, lalu cek gambar SOMA.',
  'Jika server pairing tidak aktif, gunakan kode manual.'
 ]):[
  'Salin tautan halaman kamera ke HP dan buka di browser HP.',
  'Buat kode laptop, lalu salin ke halaman HP.',
  'Tempel kode balasan dari HP dan klik Sambungkan HP.'
 ];
 useEffect(()=>{
  if(!helpOpen)return;
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();setHelpOpen(false);helpButton.current?.focus();}
  };
  const outside=(e:PointerEvent)=>{
   const target=e.target as Node;
   if(!helpButton.current?.contains(target)&&!helpPanel.current?.contains(target))setHelpOpen(false);
  };
  document.addEventListener('keydown',key);
  document.addEventListener('pointerdown',outside);
  return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);};
 },[helpOpen]);
 return <div className="soma-setup-phone-choices soma-camera-pairing-compact">
  <div className="soma-camera-method-row">
   <div className="soma-setup-pair-tabs" role="group" aria-label="Metode sambungan kamera">
    <button type="button" aria-pressed={mode==='usb'}
     onClick={()=>{setMode('usb');setHelpOpen(false);}} aria-label="Kamera HP lewat kabel" title="Kamera HP yang dikenali Mac">
     <Cable size={15} aria-hidden="true"/><span>Kabel</span>
    </button>
    <button type="button" aria-pressed={mode==='qr'||mode==='manual'}
     onClick={()=>{setMode('qr');setHelpOpen(false);}} aria-label="Kamera HP nirkabel" title="WebRTC lewat QR">
     <QrCode size={15} aria-hidden="true"/><span>Nirkabel</span>
    </button>
   </div>
   <button type="button" ref={helpButton} className="soma-camera-help-button"
    title="Cara menghubungkan kamera" aria-label="Petunjuk koneksi kamera" aria-expanded={helpOpen}
    aria-controls={helpId} onClick={()=>setHelpOpen(value=>!value)}>
    <CircleHelp size={18} aria-hidden="true"/>
   </button>
  </div>
  {helpOpen&&<section ref={helpPanel} id={helpId} className="soma-camera-help-pop"
   role="dialog" aria-label="Panduan sambungan kamera" aria-modal={false}>
   <header><strong>{mode==='usb'?'HP lewat kabel':mode==='qr'?'HP nirkabel':'Sambungkan dengan kode'}</strong>
    <button type="button" onClick={()=>{setHelpOpen(false);helpButton.current?.focus();}}
     aria-label="Tutup petunjuk"><X size={16} aria-hidden="true"/></button>
   </header>
   <ol>{guide.map((step,index)=><li key={index}>{step}</li>)}</ol>
   {mode==='qr'&&staticPages&&<p>GitHub Pages membutuhkan pertukaran kode manual setelah QR dibuka.</p>}
  </section>}
  {mode==='usb'?<UsbPhoneCameraReceiver onStream={onStream} onDisconnect={onDisconnect} intent="phone" engineError={engineError}/>:mode==='qr'?
   <><AutomaticPhoneReceiver onStream={onStream} onDisconnect={onDisconnect} engineError={engineError}
    onUseManual={()=>setMode('manual')}/>
    {!staticPages&&<button type="button" className="soma-phone-manual-fallback" onClick={()=>setMode('manual')}>
     <KeyRound size={14} aria-hidden="true"/> Kode manual
    </button>}</>:
   <><button type="button" className="soma-phone-manual-back" onClick={()=>setMode('qr')}>
     Kembali ke QR
    </button><ManualPhoneCameraReceiver onStream={onStream} onDisconnect={onDisconnect} engineError={engineError}/></>}
 </div>;
}
