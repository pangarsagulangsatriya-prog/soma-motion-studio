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
 const [settingsOpen,setSettingsOpen]=useState(false);
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
  if(!connected){
   if(!/^[A-Za-z0-9_-]{12,128}$/.test(code.trim())){setSettingsOpen(true);return;}
   connect();return;
  }
  if(streaming){bridge.current?.stop();return;}
  bridge.current?.start(latest.current());
 };
 return <div className="soma-td-panel" role="group" aria-label="Koneksi TouchDesigner">
  <div className="soma-td-status" role="status" aria-live="polite">
   <span><Activity size={14}/> Data kaki · lokal</span>
   <strong data-state={status.status}>{streaming?'Mengirim data':connecting?'Menghubungkan':
    connected?'Terhubung':status.status==='error'?'Koneksi gagal':'Belum terhubung'}</strong>
  </div>
  <p className="soma-td-contract">Posisi A/B dan event ke TouchDesigner; output proyektor dikendalikan terpisah di TD.</p>
  <button type="button" className="soma-td-primary"
   disabled={connecting||connected&&!streaming&&(!ready||held)}
   onClick={primary}>
   <Link2 size={14}/>
   {streaming?'Hentikan Data':connected?'Mulai Kirim Data':
    /^[A-Za-z0-9_-]{12,128}$/.test(code.trim())?'Hubungkan TouchDesigner':'Atur Koneksi'}
  </button>
  <details className="soma-td-details" open={settingsOpen}
   onToggle={event=>setSettingsOpen(event.currentTarget.open)}>
   <summary>Detail koneksi &amp; uji data</summary>
   <div className="soma-td-connection-fields">
    <label>Alamat lokal<input aria-label="Alamat WebSocket TouchDesigner" value={address}
     disabled={connected||connecting} spellCheck={false} placeholder="127.0.0.1:8765"
     onChange={e=>setAddress(e.target.value)}/></label>
    <label>Kode sesi<input aria-label="Kode sesi TouchDesigner" type="password" autoComplete="off"
     value={code} disabled={connected||connecting} placeholder="Dari TouchDesigner"
     onChange={e=>setCode(e.target.value)}/></label>
   </div>
   <div className="soma-td-actions">
    <button type="button" disabled={!connected} className="soma-td-secondary"
     onClick={()=>{const ok=bridge.current?.testTrigger();setStatus(current=>({...current,message:ok?'Trigger uji dikirim; cek contact_A_L di TD.':'Trigger uji belum terkirim.'}));}}>
     <FlaskConical size={13}/> Trigger Uji
    </button>
    {connected&&<button type="button" className="soma-td-disconnect"
     onClick={()=>bridge.current?.disconnect()} aria-label="Putus koneksi TouchDesigner">
     <Unplug size={13}/>Putus
    </button>}
   </div>
   <p className="soma-td-info">A/B · contact, slide, pivot · {status.fps.toFixed(0)} Hz · {status.sentEvents} event</p>
   <p className="soma-td-warning"><ShieldAlert size={13}/> Gunakan gate proyektor dan Blackout terpisah di TouchDesigner.</p>
   <details className="soma-td-help"><summary>Setup TouchDesigner</summary>
    <p>Web Server DAT di 127.0.0.1:8765, callbacks DAT dan Script CHOP.
     Ambil kode sesi melalui <code>op('webserver1').fetch('soma_token')</code>
     pada Textport TouchDesigner. Izin jaringan lokal mungkin diperlukan.</p>
   </details>
  </details>
  {status.status==='error'||status.status==='disconnected'?
   <p className="soma-td-message" role="alert">{status.message}</p>:null}
 </div>;
}
