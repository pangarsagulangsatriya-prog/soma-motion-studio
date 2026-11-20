import {useEffect,useRef,useState} from 'react';
import {Link2,Unplug,Activity,FlaskConical,ShieldAlert} from 'lucide-react';
import {TouchDesignerClient,type TdBridgeStatus} from './touchDesignerClient.ts';
import type {TdSnapshot} from './touchDesignerProtocol.ts';
import {STAGE_BLACKOUT_EVENT} from '../../footprints/stage-optics/StageBlackout.ts';
import './touchdesigner-perform.css';

export function TouchDesignerPerformPanel({getSnapshot,activeSlot,cueLabel,held}:{
 getSnapshot:()=>TdSnapshot;activeSlot:number;cueLabel:string;held:boolean;
}){
 const [address,setAddress]=useState('127.0.0.1:8765');
 const [code,setCode]=useState('');
 const [status,setStatus]=useState<TdBridgeStatus>({status:'idle',message:'Belum terhubung',sentEvents:0,fps:0});
 const bridge=useRef<TouchDesignerClient|null>(null);
 const latest=useRef(getSnapshot);latest.current=getSnapshot;
 if(!bridge.current)bridge.current=new TouchDesignerClient(next=>setStatus(next));
 useEffect(()=>{
  const client=bridge.current!;
  const timer=window.setInterval(()=>client.tick(latest.current()),50);
  const blackout=()=>client.blackout();
  window.addEventListener(STAGE_BLACKOUT_EVENT,blackout);
  window.addEventListener('soma:td-blackout',blackout);
  return()=>{
   clearInterval(timer);window.removeEventListener(STAGE_BLACKOUT_EVENT,blackout);
   window.removeEventListener('soma:td-blackout',blackout);client.dispose();
  };
 },[]);
 useEffect(()=>{bridge.current?.cue(activeSlot+1,cueLabel);},[activeSlot,cueLabel]);
 useEffect(()=>{if(held)bridge.current?.blackout();},[held]);
 const connected=status.status==='connected'||status.status==='streaming';
 const streaming=status.status==='streaming';
 const connecting=status.status==='connecting';
 const ready=getSnapshot().ready;
 const connect=()=>{bridge.current?.connect(address,code);};
 const primary=()=>{
  if(!connected){connect();return;}
  if(streaming){bridge.current?.stop();return;}
  bridge.current?.start(latest.current());
 };
 return <div className="soma-td-panel" role="group" aria-label="Koneksi TouchDesigner">
  <div className="soma-td-status">
   <span><Activity size={14}/> TouchDesigner · data gerak</span>
   <strong data-state={status.status}>{status.status==='streaming'?'Mengirim':connecting?'Menghubungkan':
    connected?'Terhubung':status.status==='error'?'Error':status.status==='disconnected'?'Terputus':'Belum terhubung'}</strong>
  </div>
  <div className="soma-td-connection-fields">
   <label>Alamat lokal<input aria-label="Alamat WebSocket TouchDesigner" value={address}
    disabled={connected||connecting} spellCheck={false} placeholder="127.0.0.1:8765" onChange={e=>setAddress(e.target.value)} /></label>
   <label>Kode sesi TD<input aria-label="Kode sesi TouchDesigner" type="password" autoComplete="off"
    value={code} disabled={connected||connecting} placeholder="Lihat di TouchDesigner"
    onChange={e=>setCode(e.target.value)} /></label>
  </div>
  <div className="soma-td-actions">
   <button type="button" className="soma-td-primary" disabled={connecting||connected&&!streaming&&(!ready||held)} onClick={primary}>
    <Link2 size={14}/>{streaming?'Hentikan Data':connected?'Mulai Kirim Data':'Hubungkan TouchDesigner'}
   </button>
   <button type="button" disabled={!connected} className="soma-td-secondary"
    onClick={()=>{const ok=bridge.current?.testTrigger();setStatus(current=>({...current,message:ok?'Trigger uji dikirim; cek contact_A_L di TouchDesigner.':'Trigger uji belum terkirim.'}));}}>
    <FlaskConical size={14}/> Trigger Uji
   </button>
   {connected&&<button type="button" className="soma-td-disconnect" onClick={()=>bridge.current?.disconnect()} aria-label="Putus koneksi TouchDesigner">
    <Unplug size={14}/>
   </button>}
  </div>
  <div className="soma-td-info">
   <span>Aktor A/B · kaki kiri/kanan · contact/slide/pivot</span>
   <span>{status.fps.toFixed(0)} Hz · {status.sentEvents} event · {ready?'Sumber siap':'Sumber belum siap'}</span>
  </div>
  <p className="soma-td-message" role="status" aria-live="polite">{status.message}</p>
  <p className="soma-td-warning"><ShieldAlert size={13}/> Data tidak menyalakan proyektor otomatis.
   Aktifkan gate fisik dan blackout mandiri di TouchDesigner.</p>
  <details className="soma-td-help"><summary>Setup di TouchDesigner</summary>
   <p>Jalankan Web Server DAT di 127.0.0.1, port 8765. Pasang callback dari
   <code> touchdesigner/soma_webserver_callbacks.py</code> dan Script CHOP. Ambil kode sesi dari
   <code> op('webserver1').fetch('soma_token')</code> di Textport TouchDesigner.
   Browser dapat meminta izin jaringan lokal.</p>
  </details>
 </div>;
}
