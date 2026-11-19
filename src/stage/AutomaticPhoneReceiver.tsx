import {useEffect,useRef,useState} from 'react';
import {collectPhoneIce,ICE_SERVERS} from './PhoneSignal.ts';
import {phonePairRequest,pairedPhoneUrl,PHONE_PAIR_POLL_MS,
 type PairRoom} from './PhonePairProtocol.ts';
import {PhonePairQr} from './PhonePairQr.tsx';
import {claimPhoneTransport,reportPhoneTransport,releasePhoneTransport,
 samplePhonePeer} from './PhoneDeviceTelemetry.ts';

const wait=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(Error('Pairing dibatalkan.'));return;}
 const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},PHONE_PAIR_POLL_MS);
 const cancel=()=>{clearTimeout(timer);reject(Error('Pairing dibatalkan.'));};
 signal.addEventListener('abort',cancel,{once:true});
});
export function AutomaticPhoneReceiver({onStream,onDisconnect}:{
 onStream:(stream:MediaStream)=>Promise<void>|void;
 onDisconnect:()=>void;
}){
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
 const [phase,setPhase]=useState<'idle'|'creating'|'waiting'|'negotiating'|'connected'|'error'>('idle');
 const roomRef=useRef<PairRoom|null>(null),pcRef=useRef<RTCPeerConnection|null>(null);
 const controllerRef=useRef<AbortController|null>(null);
 const generation=useRef(0),streamRef=useRef<MediaStream|null>(null);
 const heartbeatTimer=useRef<ReturnType<typeof setInterval>|null>(null);
 const statsTimer=useRef<ReturnType<typeof setInterval>|null>(null);
 const telemetryOwner=useRef('qr-'+crypto.randomUUID()).current;
 const callback=useRef({onStream,onDisconnect});callback.current={onStream,onDisconnect};
 const terminate=(feedback=true)=>{
  ++generation.current;controllerRef.current?.abort();controllerRef.current=null;
  if(heartbeatTimer.current)clearInterval(heartbeatTimer.current);
  heartbeatTimer.current=null;
  if(statsTimer.current)clearInterval(statsTimer.current);
  statsTimer.current=null;
  releasePhoneTransport(telemetryOwner);
  const existing=roomRef.current;roomRef.current=null;
  const hadStream=!!streamRef.current;
  pcRef.current?.close();pcRef.current=null;
  streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
  setRoom(null);
  if(existing)void phonePairRequest('close',{
   room:existing.room,token:existing.desktopToken
  }).catch(()=>{});
  if(hadStream)callback.current.onDisconnect();
  if(feedback){setStatus('Pairing dihentikan. Buat QR baru untuk menyambung.');setPhase('idle');}
 };
 useEffect(()=>()=>terminate(false),[]);
 const start=async()=>{
  terminate(false);
  const version=++generation.current;
  const controller=new AbortController();controllerRef.current=controller;
  claimPhoneTransport(telemetryOwner,'qr');
  setPhase('creating');setStatus('Membuat ruang sementara di server SOMA…');
  try{
   const response=await phonePairRequest('create',{},controller.signal);
   if(version!==generation.current)return;
   if(!response.room||!response.ticket||!response.desktopToken||!response.expiresAt)
    throw Error('Server tidak memberikan ruang pairing lengkap.');
   const current:PairRoom={room:response.room,ticket:response.ticket,
    desktopToken:response.desktopToken,expiresAt:response.expiresAt};
   roomRef.current=current;setRoom(current);
   setPhase('waiting');setStatus('Scan QR lewat kamera HP. Ruang aktif selama 3 menit.');
   let offerSent=false,answerSet=false;
   while(version===generation.current&&!controller.signal.aborted){
    if(Date.now()>=current.expiresAt)throw Error('QR kedaluwarsa. Buat QR baru.');
    const info=await phonePairRequest('poll',{
     room:current.room,token:current.desktopToken
    },controller.signal);
    if(version!==generation.current)return;
    if(info.state==='joined'&&!offerSent){
     offerSent=true;setPhase('negotiating');setStatus('HP terhubung ke ruang. Menyiapkan WebRTC…');
     const pc=new RTCPeerConnection(ICE_SERVERS);pcRef.current=pc;
     statsTimer.current=setInterval(()=>{
      if(generation.current===version)
       void samplePhonePeer(telemetryOwner,pc,'qr');
     },1000);
     pc.addTransceiver('video',{direction:'recvonly'});
     // Phone sends a local WebRTC heartbeat while capture remains visible.
     // A frozen phone/tab must trigger the same fail-closed disconnect as a dropped peer.
     let lastHeartbeat=performance.now();
     const channel=pc.createDataChannel('soma-stage-health');
     channel.addEventListener('message',e=>{
      if(e.data==='pulse')lastHeartbeat=performance.now();
     });
     heartbeatTimer.current=setInterval(()=>{
      if(generation.current!==version)return;
      if(pc.connectionState==='connected'&&
       (channel.readyState!=='open'||performance.now()-lastHeartbeat>4500)){
       setPhase('error');
       setStatus('Kamera HP berhenti mengirim heartbeat. Blackout dan kalibrasi ulang.');
       terminate(false);
      }
     },850);
     pc.addEventListener('track',event=>{
      if(pcRef.current!==pc||generation.current!==version)return;
      const stream=event.streams[0]??new MediaStream([event.track]);
      streamRef.current=stream;
      event.track.addEventListener('ended',()=>{
       if(generation.current!==version)return;
       setPhase('error');setStatus('Track video HP berhenti. Periksa kamera dan sambungkan ulang.');
       terminate(false);
      },{once:true});
      void Promise.resolve(callback.current.onStream(stream)).catch(e=>{
       setStatus('SOMA tidak dapat mengolah video HP: '+String(e));setPhase('error');
       terminate(false);
      });
     });
     pc.addEventListener('connectionstatechange',()=>{
      if(pcRef.current!==pc||generation.current!==version)return;
      if(pc.connectionState==='connected'){
       reportPhoneTransport(telemetryOwner,{state:'connected',
        reason:'WebRTC QR tersambung; statistik video dipantau.'});
       void samplePhonePeer(telemetryOwner,pc,'qr');
       setPhase('connected');setRoom(null);
       setStatus('Kamera HP tersambung. Kalibrasi ulang lantai sebelum proyeksi.');
      }else if(pc.connectionState==='failed'||pc.connectionState==='disconnected'){
       reportPhoneTransport(telemetryOwner,{state:'interrupted',
        reason:'Koneksi HP terputus; ulangi pairing dan kalibrasi.'});
       setPhase('error');setStatus('Jaringan HP terputus. Output harus Blackout.');
       terminate(false);
      }
     });
     await pc.setLocalDescription(await pc.createOffer());
     await collectPhoneIce(pc);
     if(!pc.localDescription?.sdp)throw Error('Offer WebRTC belum terbentuk.');
     await phonePairRequest('offer',{room:current.room,token:current.desktopToken,
      sdp:pc.localDescription.sdp},controller.signal);
     setStatus('Menunggu izin kamera pada HP…');
    }
    if(info.state==='answered'&&!answerSet&&pcRef.current){
     if(!info.sdp)throw Error('Jawaban HP belum tersedia.');
     answerSet=true;
     await pcRef.current.setRemoteDescription({type:'answer',sdp:info.sdp});
     // Room is spent after the answer is consumed. The WebRTC stream persists.
     void phonePairRequest('close',{room:current.room,token:current.desktopToken}).catch(()=>{});
     roomRef.current=null;setRoom(null);
     setStatus('WebRTC sedang menyambungkan video HP…');
     return;
    }
    await wait(controller.signal);
   }
  }catch(e){
   if(version!==generation.current)return;
   const message=e instanceof Error?e.message:'Pairing gagal.';
   terminate(false);setPhase('error');setStatus(message);
  }
 };
 const url=room?pairedPhoneUrl(window.location.origin,{
  room:room.room,ticket:room.ticket}):'';
 const copy=async()=>{
  try{await navigator.clipboard.writeText(url);setStatus('Tautan kamera HP disalin.');}
  catch{setStatus('Salin tautan secara manual bila clipboard tidak tersedia.');}
 };
 return <div className="soma-auto-pair" aria-label="QR pairing kamera HP">
  <p>Scan QR di HP, lalu izinkan kamera.</p>
  {!room&&phase!=='connected'&&<button className="soma-setup-primary" type="button"
   onClick={()=>void start()} disabled={phase==='creating'}>
   {phase==='creating'?'Membuat QR…':'Buat QR'}</button>}
  {room&&<div className="soma-auto-pair-code">
   <PhonePairQr value={url}/>
   <div><strong>Scan QR dengan HP</strong>
    <span className="soma-pair-expiry" role="status">
     QR tersisa {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}
    </span>
    <p>Buka tautan, lalu aktifkan kamera.</p>
    <a href={url} rel="noreferrer" target="_blank">Buka halaman kamera HP</a>
    <button type="button" onClick={()=>void copy()}>Salin tautan HP</button>
    <button type="button" onClick={()=>terminate()}>Batalkan QR</button>
    <small>QR berlaku 3 menit.</small>
   </div>
  </div>}
  {phase==='connected'&&<button type="button" className="soma-setup-secondary"
   onClick={()=>terminate()}>Putuskan kamera HP</button>}
  <div className="soma-setup-status" role="status" aria-live="polite">{status}</div>
  {phase==='error'&&<p className="soma-setup-hint">
   QR tidak tersedia. Coba opsi Manual.</p>}
 </div>;
}
