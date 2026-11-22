import {useEffect,useRef,useState} from 'react';
import {collectPhoneIce,ICE_SERVERS} from './PhoneSignal.ts';
import {phonePairRequest,PHONE_PAIR_POLL_MS,type PhoneJoin} from './PhonePairProtocol.ts';
import {buildHorizontalCameraConstraints} from '../engine/cameraConstraints.ts';
import {PHONE_LINK_GRACE_MS,phoneLinkAction} from './phoneLinkRecovery.ts';
import {usePhoneWakeLock} from './usePhoneWakeLock.ts';

const pause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(Error('Pairing dibatalkan.'));return;}
 const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
 const cancel=()=>{clearTimeout(timer);reject(Error('Pairing dibatalkan.'));};
 signal.addEventListener('abort',cancel,{once:true});
});
export function AutomaticPhoneSender({invite}:{invite:PhoneJoin}){
 const [status,setStatus]=useState('QR terbaca. Posisikan HP horizontal (landscape) untuk wide view lalu izinkan kamera.');
 const [facing,setFacing]=useState<'environment'|'user'>('environment');
 const [phase,setPhase]=useState<'idle'|'connecting'|'connected'|'recovering'|'error'>('idle');
 const video=useRef<HTMLVideoElement>(null),pc=useRef<RTCPeerConnection|null>(null);
 const stream=useRef<MediaStream|null>(null),ctrl=useRef<AbortController|null>(null);
 const generation=useRef(0),phoneToken=useRef('');
 const pulseTimer=useRef<ReturnType<typeof setInterval>|null>(null);
 const retryTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const {awake,supported}=usePhoneWakeLock(phase==='connecting'||phase==='connected'||phase==='recovering');
 const clearRetry=()=>{if(retryTimer.current)clearTimeout(retryTimer.current);retryTimer.current=null;};
 const terminate=(show=true)=>{
  generation.current++;ctrl.current?.abort();ctrl.current=null;
  if(pulseTimer.current)clearInterval(pulseTimer.current);
  pulseTimer.current=null;clearRetry();
  const key=phoneToken.current;phoneToken.current='';
  if(key)void phonePairRequest('close',{room:invite.room,token:key}).catch(()=>{});
  pc.current?.close();pc.current=null;
  stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  if(video.current){video.current.pause();video.current.srcObject=null;}
  if(show){setPhase('idle');setStatus('Kamera berhenti. Minta QR baru pada laptop untuk menyambung ulang.');}
 };
 useEffect(()=>()=>terminate(false),[]);
 // A page refresh destroys the peer, so ask before unloading a live camera.
 useEffect(()=>{
  if(phase!=='connected'&&phase!=='recovering')return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[phase]);
 useEffect(()=>{
  const resume=()=>{
   if(document.visibilityState==='visible'&&video.current&&stream.current?.active)
    void video.current.play().catch(()=>{});
  };
  document.addEventListener('visibilitychange',resume);
  return()=>document.removeEventListener('visibilitychange',resume);
 },[]);
 const connect=async()=>{
  terminate(false);
  const version=++generation.current;
  const controller=new AbortController();ctrl.current=controller;
  setPhase('connecting');setStatus('Meminta izin kamera wide horizontal…');
  try{
   if(!window.isSecureContext)throw Error('Halaman HP harus HTTPS.');
   try{await (screen.orientation as ScreenOrientation&{lock?:(o:string)=>Promise<void>})?.lock?.('landscape');}catch{}
   const media=await navigator.mediaDevices.getUserMedia({
    audio:false,
    video:buildHorizontalCameraConstraints({captureSize:'720p',facingMode:facing,frameRateIdeal:24,frameRateMax:30})
   });
   if(version!==generation.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;
   if(video.current){video.current.srcObject=media;
    void video.current.play().catch(()=>{});}
   setStatus('Mengunci ruang kamera sekali pakai…');
   const reply=await phonePairRequest('join',{room:invite.room,ticket:invite.ticket},controller.signal);
   if(!reply.phoneToken)throw Error('Server tidak mengirim kunci HP.');
   phoneToken.current=reply.phoneToken;
   const peer=new RTCPeerConnection(ICE_SERVERS);pc.current=peer;
   for(const track of media.getVideoTracks())peer.addTrack(track,media);
   peer.addEventListener('datachannel',event=>{
    if(event.channel.label!=='soma-stage-health')return;
    const channel=event.channel;
    channel.addEventListener('open',()=>{
     if(pulseTimer.current)clearInterval(pulseTimer.current);
     pulseTimer.current=setInterval(()=>{
      // Browsers may suspend mobile camera capture in the background. Fail closed.
      const capturing=media.getVideoTracks().some(t=>t.readyState==='live'&&t.enabled&&!t.muted);
      if(channel.readyState==='open'&&document.visibilityState==='visible'&&capturing)
       channel.send('pulse');
     },700);
    });
    channel.addEventListener('close',()=>{
     if(pulseTimer.current)clearInterval(pulseTimer.current);
     pulseTimer.current=null;
    });
   });
   peer.addEventListener('connectionstatechange',()=>{
    if(pc.current!==peer||version!==generation.current)return;
    const action=phoneLinkAction(peer.connectionState);
    if(action==='healthy'){
     clearRetry();
     setPhase('connected');setStatus('Video HP dikirim ke SOMA laptop. Biarkan halaman terbuka.');
    }else if(action==='recovering'){
     setPhase('recovering');setStatus('Sinyal terganggu. Menyambungkan kembali ke laptop…');
     if(!retryTimer.current)retryTimer.current=setTimeout(()=>{
      if(version!==generation.current||pc.current!==peer||peer.connectionState==='connected')return;
      setPhase('error');setStatus('Sambungan tidak pulih. Minta pairing baru di laptop.');
      terminate(false);
     },PHONE_LINK_GRACE_MS);
    }else if(action==='fatal'){
     setStatus('Koneksi WebRTC gagal. Minta pairing baru di laptop.');setPhase('error');
     terminate(false);
    }
   });
   media.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{
    if(version!==generation.current)return;
    setStatus('Kamera HP berhenti. Minta QR baru.');setPhase('error');
    terminate(false);
   },{once:true}));
   while(version===generation.current&&!controller.signal.aborted){
    const data=await phonePairRequest('poll',{room:invite.room,
     token:phoneToken.current},controller.signal);
    if(data.state==='offered'&&data.sdp){
     await peer.setRemoteDescription({type:'offer',sdp:data.sdp});
     await peer.setLocalDescription(await peer.createAnswer());
     setStatus('Mengirim jawaban WebRTC ke laptop…');
     await collectPhoneIce(peer);
     if(!peer.localDescription?.sdp)throw Error('WebRTC tidak menghasilkan jawaban.');
     await phonePairRequest('answer',{room:invite.room,token:phoneToken.current,
      sdp:peer.localDescription.sdp},controller.signal);
     setStatus('Menunggu video diterima SOMA…');
     return;
    }
    await pause(PHONE_PAIR_POLL_MS,controller.signal);
   }
  }catch(e){
   if(version!==generation.current)return;
   const message=e instanceof Error?e.message:'Koneksi HP gagal.';
   terminate(false);setPhase('error');setStatus(message);
  }
 };
 return <main className="soma-phone-sender">
  <div className="soma-phone-sender-inner">
   <div className="soma-setup-eyebrow">SOMA / AUTOMATIC PHONE CAMERA</div>
   <h1>Kamera HP untuk Footprints</h1>
   <p>HP mengirim video ke SOMA laptop melalui WebRTC. Tidak perlu menginstal aplikasi khusus.</p>
   <video ref={video} muted autoPlay playsInline aria-label="Preview kamera HP"/>
   <div className="soma-setup-status" role="status" aria-live="polite">{status}</div>
   <label>Pilih kamera
    <select disabled={phase==='connecting'||phase==='connected'} value={facing}
     onChange={e=>setFacing(e.target.value as 'environment'|'user')}>
     <option value="environment">Kamera belakang — disarankan</option>
     <option value="user">Kamera depan</option>
    </select>
   </label>
   {phase==='idle'&&<button type="button" className="soma-setup-primary"
    onClick={()=>void connect()}>Aktifkan kamera dan hubungkan ke SOMA</button>}
   {phase==='connecting'&&<button type="button" disabled>Menyiapkan video…</button>}
   {(phase==='connecting'||phase==='connected'||phase==='recovering')&&<button type="button"
    className="soma-setup-secondary" onClick={()=>{
     if(window.confirm('Hentikan kamera HP dan putuskan sambungan SOMA?'))terminate();
    }}>Hentikan kamera</button>}
   {phase==='recovering'&&<p className="soma-setup-hint" role="status">
    Kamera dipertahankan sementara. Periksa Wi-Fi dan biarkan halaman HP aktif.</p>}
   <small role="status">{awake?'Layar HP dijaga tetap menyala':
    supported?'Aktifkan layar HP agar video tetap terkirim.':
    'Jaga layar HP tetap aktif; browser tidak mendukung pengunci layar.'}</small>
   {phase==='error'&&<p className="soma-setup-hint">Kode QR mungkin kedaluwarsa,
    telah digunakan, atau jaringan memblokir koneksi peer-to-peer. Buat QR baru pada laptop.</p>}
   <small>Biarkan layar aktif, letakkan HP pada tripod, dan pastikan seluruh kaki terlihat.
    Audio tidak diaktifkan. Kamera dapat berhenti saat browser HP masuk latar belakang.</small>
  </div>
 </main>;
}
