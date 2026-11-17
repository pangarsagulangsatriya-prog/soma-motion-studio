import {useEffect,useRef,useState} from 'react';
import {collectPhoneIce,ICE_SERVERS} from './PhoneSignal.ts';
import {phonePairRequest,pairedPhoneUrl,PHONE_PAIR_POLL_MS,
 type PairRoom} from './PhonePairProtocol.ts';
import {PhonePairQr} from './PhonePairQr.tsx';

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
 const [status,setStatus]=useState('Scan QR untuk mengirim video HP ke SOMA.');
 const [phase,setPhase]=useState<'idle'|'creating'|'waiting'|'negotiating'|'connected'|'error'>('idle');
 const roomRef=useRef<PairRoom|null>(null),pcRef=useRef<RTCPeerConnection|null>(null);
 const controllerRef=useRef<AbortController|null>(null);
 const generation=useRef(0),streamRef=useRef<MediaStream|null>(null);
 const callback=useRef({onStream,onDisconnect});callback.current={onStream,onDisconnect};
 const terminate=(feedback=true)=>{
  ++generation.current;controllerRef.current?.abort();controllerRef.current=null;
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
     pc.addTransceiver('video',{direction:'recvonly'});
     pc.addEventListener('track',event=>{
      if(pcRef.current!==pc||generation.current!==version)return;
      const stream=event.streams[0]??new MediaStream([event.track]);
      streamRef.current=stream;
      event.track.addEventListener('ended',()=>{
       if(generation.current!==version)return;
       callback.current.onDisconnect();
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
       setPhase('connected');setRoom(null);
       setStatus('Kamera HP tersambung. Kalibrasi ulang lantai sebelum proyeksi.');
      }else if(pc.connectionState==='failed'||pc.connectionState==='disconnected'){
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
  <div className="soma-setup-eyebrow">S6.1.1 / AUTOMATIC PHONE PAIRING</div>
  <p>HP cukup memindai QR, memberi izin kamera, lalu SOMA laptop menerima video. QR sekali pakai dan otomatis kedaluwarsa.</p>
  {!room&&phase!=='connected'&&<button className="soma-setup-primary" type="button"
   onClick={()=>void start()} disabled={phase==='creating'}>
   {phase==='creating'?'Membuat QR…':'Buat QR kamera HP'}</button>}
  {room&&<div className="soma-auto-pair-code">
   <PhonePairQr value={url}/>
   <div><strong>Scan dengan kamera HP</strong>
    <p>Gunakan kamera belakang. Setelah halaman HP terbuka, tekan Aktifkan kamera.</p>
    <a href={url} rel="noreferrer" target="_blank">Buka halaman kamera HP</a>
    <button type="button" onClick={()=>void copy()}>Salin tautan HP</button>
    <button type="button" onClick={()=>terminate()}>Batalkan QR</button>
    <small>Ruang berlaku 3 menit; satu HP per QR. Kode akses disembunyikan dari riwayat permintaan server.</small>
   </div>
  </div>}
  {phase==='connected'&&<button type="button" className="soma-setup-secondary"
   onClick={()=>terminate()}>Putuskan kamera HP</button>}
  <div className="soma-setup-status" role="status" aria-live="polite">{status}</div>
  {phase==='error'&&<p className="soma-setup-hint">
   Pairing otomatis membutuhkan Redis pada Vercel Preview. Saat layanan belum tersedia,
   gunakan opsi Pairing Manual di bawah atau ulangi setelah jaringan diperiksa.</p>}
 </div>;
}
