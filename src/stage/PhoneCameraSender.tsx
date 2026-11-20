import {useEffect,useRef,useState} from 'react';
import {collectPhoneIce,encodePhoneSignal,ICE_SERVERS,parsePhoneSignal} from './PhoneSignal.ts';
import {parsePhoneInvite} from './PhonePairProtocol.ts';
import {AutomaticPhoneSender} from './AutomaticPhoneSender.tsx';
import {buildHorizontalCameraConstraints} from '../engine/cameraConstraints.ts';
import './stage-setup.css';
function ManualPhoneCameraSender(){
 const [offer,setOffer]=useState(''),[answer,setAnswer]=useState('');
 const [status,setStatus]=useState('Buka kode sambungan dari SOMA laptop. Posisikan HP horizontal (landscape) untuk wide view.');
 const [facing,setFacing]=useState<'environment'|'user'>('environment');
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const video=useRef<HTMLVideoElement>(null),pc=useRef<RTCPeerConnection|null>(null);
 const camera=useRef<MediaStream|null>(null);
 const stop=()=>{
  pc.current?.close();pc.current=null;
  camera.current?.getTracks().forEach(t=>t.stop());camera.current=null;
  if(video.current){video.current.pause();video.current.srcObject=null;}
  setReady(false);setAnswer('');setStatus('Kamera HP dihentikan.');
 };
 useEffect(()=>()=>{pc.current?.close();camera.current?.getTracks().forEach(t=>t.stop());},[]);
 const connect=async()=>{
  if(busy)return;setBusy(true);
  pc.current?.close();camera.current?.getTracks().forEach(t=>t.stop());
  pc.current=null;camera.current=null;setAnswer('');setReady(false);
  try{
   if(!window.isSecureContext)throw new Error('Halaman kamera HP harus HTTPS.');
   const remote=parsePhoneSignal(offer,'offer');
   try{await (screen.orientation as ScreenOrientation&{lock?:(o:string)=>Promise<void>})?.lock?.('landscape');}catch{}
   const stream=await navigator.mediaDevices.getUserMedia({
    audio:false,
    video:buildHorizontalCameraConstraints({captureSize:'720p',facingMode:facing,frameRateIdeal:24,frameRateMax:30})
   });
   camera.current=stream;
   if(video.current){video.current.srcObject=stream;void video.current.play().catch(()=>{});}
   const connection=new RTCPeerConnection(ICE_SERVERS);pc.current=connection;
   stream.getVideoTracks().forEach(track=>connection.addTrack(track,stream));
   connection.addEventListener('connectionstatechange',()=>{
    if(pc.current!==connection)return;
    const s=connection.connectionState;
    setReady(s==='connected');
    setStatus(s==='connected'?'Video kamera dikirim ke SOMA laptop.':
     s==='failed'?'Jalur WebRTC gagal. Coba lagi dengan kedua perangkat pada Wi-Fi sama.':
     'WebRTC: '+s);
   });
   await connection.setRemoteDescription(remote);
   await connection.setLocalDescription(await connection.createAnswer());
   setStatus('Mengumpulkan alamat jaringan…');
   await collectPhoneIce(connection);
   if(!connection.localDescription)throw new Error('Jawaban kamera belum terbentuk.');
   setAnswer(encodePhoneSignal(connection.localDescription));
   setStatus('Salin kode jawaban ke SOMA laptop untuk menyelesaikan sambungan.');
  }catch(e){stop();setStatus(e instanceof Error?e.message:'Koneksi HP gagal.');}
  finally{setBusy(false);}
 };
 const copy=async()=>{
  try{await navigator.clipboard.writeText(answer);setStatus('Kode jawaban disalin. Kirim ke laptop.');}
  catch{setStatus('Pilih dan salin kode jawaban secara manual.');}
 };
 return <main className="soma-phone-sender">
  <div className="soma-phone-sender-inner">
   <div className="soma-setup-eyebrow">SOMA / PHONE CAMERA</div>
   <h1>HP sebagai kamera Footprints</h1>
   <p>Kamera HP mengirim video langsung ke SOMA laptop melalui WebRTC. Pelacakan kaki dan proyektor tetap berjalan di laptop.</p>
   <video ref={video} autoPlay muted playsInline aria-label="Preview kamera HP"/>
   <div className="soma-setup-status" role="status">{status}</div>
   <label>1. Pilih lensa
    <select value={facing} onChange={e=>setFacing(e.target.value as 'environment'|'user')}
     disabled={busy||ready}>
     <option value="environment">Belakang (disarankan)</option>
     <option value="user">Depan</option>
    </select></label>
   <label>2. Tempel kode OFFER dari laptop
    <textarea value={offer} onChange={e=>setOffer(e.target.value)}
     rows={4} placeholder="Tempel kode koneksi SOMA laptop…" disabled={busy||ready}/></label>
   <button className="soma-setup-primary" type="button" disabled={busy||!offer.trim()||ready}
    onClick={()=>void connect()}>{busy?'Menyiapkan sambungan…':'Aktifkan kamera dan buat jawaban'}</button>
   {answer&&<><label>3. Kirim kode ANSWER ke laptop
    <textarea value={answer} readOnly rows={4} onFocus={e=>e.target.select()}/></label>
    <button type="button" onClick={()=>void copy()}>Salin kode jawaban</button>
   </>}
   <button type="button" className="soma-setup-secondary" onClick={stop}>Hentikan dan putuskan kamera</button>
   <small>Gunakan Wi-Fi yang sama. Biarkan halaman HP tetap terbuka, layar menyala dan kamera menghadap seluruh tubuh aktor. Tidak ada audio yang dikirim.</small>
  </div>
 </main>;
}

export function PhoneCameraSender(){
 const [invite]=useState(()=>parsePhoneInvite(window.location.hash));
 useEffect(()=>{
  if(invite)window.history.replaceState(null,'',window.location.pathname+window.location.search);
 },[invite]);
 return invite?<AutomaticPhoneSender invite={invite}/>:<ManualPhoneCameraSender/>;
}
