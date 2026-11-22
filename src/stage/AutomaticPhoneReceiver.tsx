import {useEffect,useRef,useState} from 'react';
import {QrCode,LoaderCircle,RefreshCw,Copy,Check,AlertCircle} from 'lucide-react';
import {collectPhoneIce,ICE_SERVERS,phoneCameraUrl} from './PhoneSignal.ts';
import {PHONE_LINK_GRACE_MS,phoneHeartbeatAction,phoneLinkAction} from './phoneLinkRecovery.ts';
import {phonePairRequest,pairedPhoneUrl,PHONE_PAIR_POLL_MS,PHONE_SESSION_TTL_MS,
 type PairRoom} from './PhonePairProtocol.ts';
import {readPhoneSession,savePhoneSession,clearPhoneSession,
 type StoredPhoneSession} from './PhonePairPersistence.ts';
import {PhonePairQr} from './PhonePairQr.tsx';
import {claimPhoneTransport,reportPhoneTransport,releasePhoneTransport,
 samplePhonePeer} from './PhoneDeviceTelemetry.ts';

const wait=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(Error('Pairing dibatalkan.'));return;}
 const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},PHONE_PAIR_POLL_MS);
 const cancel=()=>{clearTimeout(timer);reject(Error('Pairing dibatalkan.'));};
 signal.addEventListener('abort',cancel,{once:true});
});
export function AutomaticPhoneReceiver({onStream,onDisconnect,onInterrupted,onUseManual}:{
 onStream:(stream:MediaStream)=>Promise<void>|void;
 onDisconnect:()=>void;
 onInterrupted?:()=>void;
 onUseManual?:()=>void;
}){
 // GitHub Pages cannot run /api/phone-pair. Show a real scan-able link to
 // the hosted phone sender, and explicitly continue via manual SDP exchange.
 const staticPages=window.location.hostname.endsWith('github.io');
 const [room,setRoom]=useState<PairRoom|null>(null);
 const [secondsLeft,setSecondsLeft]=useState(0);
 useEffect(()=>{
  if(!room){setSecondsLeft(0);return;}
  const calculate=()=>setSecondsLeft(Math.max(0,Math.ceil((room.expiresAt-Date.now())/1000)));
  calculate();
  const timer=setInterval(calculate,1000);
  return()=>clearInterval(timer);
 },[room]);
 const [status,setStatus]=useState('Scan QR untuk mengirim video HP ke SOMA.');
 const [phase,setPhase]=useState<'idle'|'creating'|'waiting'|'negotiating'|'connected'|'recovering'|'error'>('idle');
 const roomRef=useRef<PairRoom|null>(null),pcRef=useRef<RTCPeerConnection|null>(null);
 const controllerRef=useRef<AbortController|null>(null);
 const generation=useRef(0),streamRef=useRef<MediaStream|null>(null);
 const heartbeatTimer=useRef<ReturnType<typeof setInterval>|null>(null);
 const recoveryTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const interrupted=useRef(false);
 const statsTimer=useRef<ReturnType<typeof setInterval>|null>(null);
 const telemetryOwner=useRef('qr-'+crypto.randomUUID()).current;
 const callback=useRef({onStream,onDisconnect,onInterrupted});
 callback.current={onStream,onDisconnect,onInterrupted};
 const resetRecovery=()=>{
  if(recoveryTimer.current)clearTimeout(recoveryTimer.current);
  recoveryTimer.current=null;interrupted.current=false;
 };
 const terminate=(feedback=true,closeRemote=true)=>{
  ++generation.current;controllerRef.current?.abort();controllerRef.current=null;
  if(heartbeatTimer.current)clearInterval(heartbeatTimer.current);
  heartbeatTimer.current=null;resetRecovery();
  if(statsTimer.current)clearInterval(statsTimer.current);
  statsTimer.current=null;
  releasePhoneTransport(telemetryOwner);
  const existing=roomRef.current;roomRef.current=null;
  const hadStream=!!streamRef.current;
  pcRef.current?.close();pcRef.current=null;
  streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
  setRoom(null);
  if(closeRemote){
   clearPhoneSession('desktop');
   if(existing)void phonePairRequest('close',{
    room:existing.room,token:existing.desktopToken
   }).catch(()=>{});
  }
  if(hadStream)callback.current.onDisconnect();
  if(feedback){setStatus('Pairing dihentikan. Buat QR baru untuk menyambung.');setPhase('idle');}
 };
 useEffect(()=>{
  if(!staticPages){const stored=readPhoneSession('desktop');
   if(stored)void start(stored);}
  return()=>terminate(false,false);
 },[]);
 // Full refresh destroys RTCPeerConnection; warn before accidentally
 // replacing the live desktop tab. In-app Track/Compose/Map navigation is safe.
 useEffect(()=>{
  if(phase!=='connected'&&phase!=='recovering')return;
  const warn=(event:BeforeUnloadEvent)=>{
   event.preventDefault();event.returnValue='';
  };
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[phase]);
 const start=async(saved?:StoredPhoneSession)=>{
  terminate(false,!saved);
  const version=++generation.current;
  const controller=new AbortController();controllerRef.current=controller;
  claimPhoneTransport(telemetryOwner,'qr');
  setPhase('creating');setStatus('Membuat ruang sementara di server SOMA…');
  try{
   let current:PairRoom;
   let initialState:'waiting'|'joined'='waiting';
   if(saved){
    const response=await phonePairRequest('resume',{
     room:saved.room,token:saved.token
    },controller.signal);
    if(response.state!=='waiting'&&response.state!=='joined')
     throw Error('Sesi HP tidak dapat dipulihkan.');
    initialState=response.state;
    current={room:saved.room,desktopToken:saved.token,
     ticket:saved.ticket??'',expiresAt:response.expiresAt??saved.expiresAt};
   }else{
    const response=await phonePairRequest('create',{},controller.signal);
    if(!response.room||!response.ticket||!response.desktopToken||!response.expiresAt)
     throw Error('Server tidak memberikan ruang pairing lengkap.');
    current={room:response.room,ticket:response.ticket,
     desktopToken:response.desktopToken,expiresAt:response.expiresAt};
   }
   if(version!==generation.current)return;
   roomRef.current=current;
   savePhoneSession({version:2,role:'desktop',room:current.room,
    token:current.desktopToken,expiresAt:current.expiresAt,
    ...(current.ticket?{ticket:current.ticket}:{})});
   if(initialState==='waiting'){
    if(!current.ticket)throw Error('Undangan QR tidak tersedia. Buat QR baru.');
    setRoom(current);setPhase('waiting');
    setStatus('Scan QR HP. Setelah tersambung, sesi dapat dipulihkan.');
   }else{
    setRoom(null);setPhase('recovering');
    callback.current.onInterrupted?.();
   }
   let offeredEpoch=0,answeredEpoch=0,resumeInFlight=false;
   const resumeSession=async()=>{
    if(resumeInFlight||version!==generation.current)return;
    resumeInFlight=true;
    try{
     callback.current.onInterrupted?.();
     await phonePairRequest('resume',{room:current.room,token:current.desktopToken},controller.signal);
     setPhase('recovering');setStatus('Mencari ulang kamera HP…');
    }catch(error){
     if(version===generation.current){setPhase('error');
      setStatus(error instanceof Error?error.message:'Sesi HP belum dapat dilanjutkan.');}
    }finally{resumeInFlight=false;}
   };
   while(version===generation.current&&!controller.signal.aborted){
    if(Date.now()>=current.expiresAt)throw Error('QR kedaluwarsa. Buat QR baru.');
    const info=await phonePairRequest('poll',{
     room:current.room,token:current.desktopToken
    },controller.signal);
    if(version!==generation.current)return;
    if(info.expiresAt&&info.expiresAt>Date.now()){
     current.expiresAt=info.expiresAt;
     savePhoneSession({version:2,role:'desktop',room:current.room,
      token:current.desktopToken,expiresAt:current.expiresAt,
      ...(info.state==='waiting'&&current.ticket?{ticket:current.ticket}:{})});
    }
    const epoch=info.epoch??1;
    if(info.state==='joined'&&epoch>offeredEpoch){
     if(pcRef.current){
      callback.current.onInterrupted?.();
      const previous=pcRef.current;pcRef.current=null;previous.close();
      streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;
     }
     if(heartbeatTimer.current)clearInterval(heartbeatTimer.current);
     if(statsTimer.current)clearInterval(statsTimer.current);
     resetRecovery();offeredEpoch=epoch;answeredEpoch=0;setPhase('negotiating');setStatus('HP terhubung ke ruang. Menyiapkan WebRTC…');
     const pc=new RTCPeerConnection(ICE_SERVERS);pcRef.current=pc;
     statsTimer.current=setInterval(()=>{
      if(generation.current===version&&!interrupted.current)
       void samplePhonePeer(telemetryOwner,pc,'qr');
     },1000);
     pc.addTransceiver('video',{direction:'recvonly'});
     // Keep the peer alive briefly for transient ICE/Wi-Fi interruptions.
     // The parent revokes projector approval before any reconnect attempt.
     let lastHeartbeat=performance.now();
     const channel=pc.createDataChannel('soma-stage-health');
     const hold=(reason:string)=>{
      if(generation.current!==version||pcRef.current!==pc)return;
      if(!interrupted.current){
       interrupted.current=true;
       callback.current.onInterrupted?.();
      }
      reportPhoneTransport(telemetryOwner,{state:'interrupted',reason});
      setPhase('recovering');setStatus(reason+' Mencoba menyambung kembali…');
      if(!recoveryTimer.current)recoveryTimer.current=setTimeout(()=>{
       if(generation.current!==version||pcRef.current!==pc||!interrupted.current)return;
       setStatus('Kamera belum pulih. Menyiapkan ulang video HP…');
       void resumeSession();
      },PHONE_LINK_GRACE_MS);
     };
     const recover=()=>{
      if(!interrupted.current)return;
      resetRecovery();
      reportPhoneTransport(telemetryOwner,{state:'connected',
       reason:'Video HP pulih; kalibrasi perlu dikonfirmasi ulang.'});
      setPhase('connected');setStatus('HP tersambung lagi. Periksa Map sebelum proyeksi.');
     };
     channel.addEventListener('message',event=>{
      if(event.data!=='pulse')return;
      lastHeartbeat=performance.now();
      if(pc.connectionState==='connected')recover();
     });
     heartbeatTimer.current=setInterval(()=>{
      if(generation.current!==version||pcRef.current!==pc)return;
      const assessment=phoneHeartbeatAction(
       performance.now()-lastHeartbeat,pc.connectionState,channel.readyState==='open');
      if(assessment==='fatal')hold('Video HP tidak mengirim heartbeat.');
      else if(assessment==='recovering')hold(pc.connectionState==='disconnected'?
       'Wi-Fi HP terputus sementara.':'Video HP tertahan atau layar tidak aktif.');
      else if(assessment==='healthy')recover();
     },850);
     pc.addEventListener('track',event=>{
      if(pcRef.current!==pc||generation.current!==version)return;
      const stream=event.streams[0]??new MediaStream([event.track]);
      streamRef.current=stream;
      event.track.addEventListener('ended',()=>{
       if(generation.current!==version||pcRef.current!==pc)return;
       hold('Track video HP berhenti.');
      },{once:true});
      void Promise.resolve(callback.current.onStream(stream)).catch(e=>{
       if(pcRef.current!==pc)return;
       hold('SOMA tidak dapat mengolah video HP: '+String(e));
      });
     });
     pc.addEventListener('connectionstatechange',()=>{
      if(pcRef.current!==pc||generation.current!==version)return;
      const action=phoneLinkAction(pc.connectionState);
      if(action==='healthy'){
       setRoom(null);
       if(!interrupted.current){
        reportPhoneTransport(telemetryOwner,{state:'connected',
         reason:'WebRTC QR tersambung; statistik video dipantau.'});
        void samplePhonePeer(telemetryOwner,pc,'qr');
        setPhase('connected');
        setStatus('Kamera HP tersambung. Kalibrasi ulang lantai sebelum proyeksi.');
       }else if(channel.readyState==='open'&&performance.now()-lastHeartbeat<4500)recover();
      }else if(action==='recovering')hold('Sinyal kamera HP terganggu.');
      else if(action==='fatal'){
       hold('Koneksi kamera HP gagal.');
       setStatus('Jalur WebRTC gagal. Menyambungkan ulang dari sesi HP…');
       void resumeSession();
      }
     });
     await pc.setLocalDescription(await pc.createOffer());
     await collectPhoneIce(pc);
     if(!pc.localDescription?.sdp)throw Error('Offer WebRTC belum terbentuk.');
     await phonePairRequest('offer',{room:current.room,token:current.desktopToken,
      sdp:pc.localDescription.sdp,epoch:String(epoch)},controller.signal);
     setStatus('Menunggu izin kamera pada HP…');
    }
    if(info.state==='answered'&&epoch===offeredEpoch&&answeredEpoch!==epoch&&pcRef.current){
     if(!info.sdp)throw Error('Jawaban HP belum tersedia.');
     answeredEpoch=epoch;
     await pcRef.current.setRemoteDescription({type:'answer',sdp:info.sdp});
     // Room persists for authenticated reoffer after laptop refresh.
     roomRef.current=current;setRoom(null);
     setStatus('WebRTC sedang menyambungkan video HP…');
    }
    await wait(controller.signal);
   }
  }catch(e){
   if(version!==generation.current)return;
   const message=e instanceof Error?e.message:'Pairing gagal.';
   terminate(false,false);
   if(/kedaluwarsa|expired|tidak sah|tidak dapat dilanjutkan/i.test(message))
    clearPhoneSession('desktop');
   setPhase('error');setStatus(message);
  }
 };
 const url=room?pairedPhoneUrl(window.location.origin,{
  room:room.room,ticket:room.ticket},window.location.pathname):'';
 const [copied,setCopied]=useState(false);
 const copy=async()=>{
  try{
   await navigator.clipboard.writeText(url);
   setCopied(true);setStatus('Tautan disalin.');
  }catch{setCopied(false);setStatus('Gagal menyalin tautan.');}
 };
 if(staticPages){
  const cameraUrl=phoneCameraUrl(window.location.origin,window.location.pathname);
  return <div className="soma-auto-pair soma-track-static-qr" data-phase="static"
   aria-label="QR membuka halaman kamera HP untuk pairing manual">
   <div className="soma-auto-pair-code" aria-label="QR pembuka kamera HP">
    <div className="soma-track-qr-frame"><PhonePairQr value={cameraUrl}/></div>
   </div>
   <p className="soma-track-static-qr-hint">
    Scan QR untuk membuka kamera HP. Di GitHub Pages, sambungkan videonya melalui Kode.
   </p>
   {onUseManual&&<button type="button" className="soma-setup-primary soma-track-create-qr"
    onClick={onUseManual}>Lanjut ke Kode</button>}
  </div>;
 }
 return <div className="soma-auto-pair" data-phase={phase}
  aria-label="QR pairing kamera HP">
  {!room&&(phase==='idle'||phase==='error')&&<button type="button"
   className="soma-setup-primary soma-track-create-qr"
   onClick={()=>void start(readPhoneSession('desktop')??undefined)} disabled={phase==='creating'}
   aria-label={phase==='creating'?'Menyiapkan kode QR':'Tampilkan QR kamera HP'}>
   {phase==='creating'?<LoaderCircle size={17} className="soma-track-spinning" aria-hidden="true"/>:
    phase==='error'?<RefreshCw size={17} aria-hidden="true"/>:
    <QrCode size={20} aria-hidden="true"/>}
   <span>{phase==='creating'?'Menyiapkan QR…':phase==='error'?'Coba lagi':'Tampilkan QR'}</span>
  </button>}
  {room&&<div className="soma-auto-pair-code" aria-label="Kode QR kamera HP aktif">
   <div className="soma-track-qr-frame">
    <PhonePairQr value={url}/>
   </div>
   <div className="soma-track-qr-actions">
    <span className="soma-pair-expiry" role="timer" aria-label="Sisa masa berlaku QR">
     {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}
    </span>
    <button type="button" onClick={()=>void copy()} className="soma-track-copy-link">
     {copied?<Check size={15} aria-hidden="true"/>:
      <Copy size={15} aria-hidden="true"/>}
     {copied?'Disalin':'Salin tautan'}
    </button>
    <button type="button" className="soma-track-regenerate" onClick={()=>void start()}
     aria-label="Buat ulang kode QR"><RefreshCw size={15} aria-hidden="true"/></button>
   </div>
  </div>}
  {(phase==='connected'||phase==='recovering')&&<div className="soma-track-pair-connected" role="status" data-phase={phase}>
   <Check size={15} aria-hidden="true"/> {phase==='recovering'?'Menyambung ulang HP…':'HP tersambung'}
   <button type="button" className="soma-setup-secondary"
    onClick={()=>terminate()}>Putuskan</button>
  </div>}
  {phase==='error'&&<button type="button" className="soma-phone-manual-fallback"
   onClick={()=>{clearPhoneSession('desktop');void start();}}>Buat QR baru</button>}
  {(phase==='creating'||phase==='negotiating'||phase==='recovering'||phase==='error')&&
   <div className="soma-setup-status" data-phase={phase} role="status" aria-live="polite">
    {phase==='error'&&<AlertCircle size={16} aria-hidden="true"/>}
    <span>{phase==='error'&&window.location.hostname.endsWith('github.io')?
     'QR otomatis membutuhkan backend pairing. Gunakan SOMA di server Vercel, atau pilih Manual.':
     status}</span>
   </div>}
 </div>;
}
