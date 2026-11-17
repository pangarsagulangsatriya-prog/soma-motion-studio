import {useEffect,useRef,useState} from 'react';
import {collectPhoneIce,ICE_SERVERS} from './PhoneSignal.ts';
import {phonePairRequest,PHONE_PAIR_POLL_MS,type PhoneJoin} from './PhonePairProtocol.ts';

const pause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(Error('Pairing dibatalkan.'));return;}
 const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
 const cancel=()=>{clearTimeout(timer);reject(Error('Pairing dibatalkan.'));};
 signal.addEventListener('abort',cancel,{once:true});
});
export function AutomaticPhoneSender({invite}:{invite:PhoneJoin}){
 const [status,setStatus]=useState('QR terbaca. Pilih kamera dan izinkan akses untuk terhubung.');
 const [facing,setFacing]=useState<'environment'|'user'>('environment');
 const [phase,setPhase]=useState<'idle'|'connecting'|'connected'|'error'>('idle');
 const video=useRef<HTMLVideoElement>(null),pc=useRef<RTCPeerConnection|null>(null);
 const stream=useRef<MediaStream|null>(null),ctrl=useRef<AbortController|null>(null);
 const generation=useRef(0),phoneToken=useRef('');
 const terminate=(show=true)=>{
  generation.current++;ctrl.current?.abort();ctrl.current=null;
  const key=phoneToken.current;phoneToken.current='';
  if(key)void phonePairRequest('close',{room:invite.room,token:key}).catch(()=>{});
  pc.current?.close();pc.current=null;
  stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  if(video.current){video.current.pause();video.current.srcObject=null;}
  if(show){setPhase('idle');setStatus('Kamera berhenti. Minta QR baru pada laptop untuk menyambung ulang.');}
 };
 useEffect(()=>()=>terminate(false),[]);
 const connect=async()=>{
  terminate(false);
  const version=++generation.current;
  const controller=new AbortController();ctrl.current=controller;
  setPhase('connecting');setStatus('Meminta izin kamera belakang…');
  try{
   if(!window.isSecureContext)throw Error('Halaman HP harus HTTPS.');
   const media=await navigator.mediaDevices.getUserMedia({
    audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},
     height:{ideal:720},frameRate:{ideal:24,max:30}}
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
   peer.addEventListener('connectionstatechange',()=>{
    if(pc.current!==peer||version!==generation.current)return;
    if(peer.connectionState==='connected'){
     setPhase('connected');setStatus('Video HP dikirim ke SOMA laptop. Biarkan halaman terbuka.');
    }else if(peer.connectionState==='failed'||peer.connectionState==='disconnected'){
     setStatus('Sambungan laptop terputus. Kamera dihentikan.');setPhase('error');
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
   {(phase==='connecting'||phase==='connected')&&<button type="button"
    className="soma-setup-secondary" onClick={()=>terminate()}>Putuskan kamera</button>}
   {phase==='error'&&<p className="soma-setup-hint">Kode QR mungkin kedaluwarsa,
    telah digunakan, atau jaringan memblokir koneksi peer-to-peer. Buat QR baru pada laptop.</p>}
   <small>Biarkan layar aktif, letakkan HP pada tripod, dan pastikan seluruh kaki terlihat.
    Audio tidak diaktifkan. Kamera dapat berhenti saat browser HP masuk latar belakang.</small>
  </div>
 </main>;
}
