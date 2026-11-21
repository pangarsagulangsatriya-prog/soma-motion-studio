import {useEffect,useRef,useState} from 'react';
import {Link2,Unplug,Activity,FlaskConical,ShieldAlert,Info,ChevronDown,Check} from 'lucide-react';
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
   <span><Activity size={14} aria-hidden="true"/> Data A/B</span>
   <strong data-state={status.status}>{streaming?'Mengirim data':connecting?'Menghubungkan':
    connected?'Terhubung':status.status==='error'?'Koneksi gagal':'Belum terhubung'}</strong>
   <button type="button" className="soma-td-info-button" aria-label="Info koneksi TouchDesigner"
    title="Data gerak melalui WebSocket lokal" aria-expanded={settingsOpen}
    onClick={()=>setSettingsOpen(value=>!value)}><Info size={15} aria-hidden="true"/></button>
  </div>
  <button type="button" className="soma-td-primary"
   disabled={connecting||connected&&!streaming&&(!ready||held)}
   onClick={primary}>
   <Link2 size={14}/>
   {streaming?'Hentikan Data':connected?'Mulai Kirim Data':
    /^[A-Za-z0-9_-]{12,128}$/.test(code.trim())?'Hubungkan TouchDesigner':'Atur Koneksi'}
  </button>
  <div className="ops-r1-route-steps soma-td-route-steps" role="list" aria-label="Langkah sambungan TouchDesigner">
   {([{label:'Receiver',done:false,help:'Jalankan Web Server DAT dan Script CHOP'},
     {label:'Hubungkan',done:connected,help:'Handshake WebSocket dengan kode sesi'},
     {label:'Kirim data',done:streaming,help:'State kaki dikirim, periksa CHOP di TD'}] as const).map((step,i)=>
    <div key={step.label} className="ops-r1-route-step" role="listitem"
     data-complete={step.done} title={step.help}>
     <span className="ops-r1-step-marker">{step.done?<Check size={12} aria-hidden="true"/>:i+1}</span>
     <span>{step.label}</span>
    </div>)}
  </div>
  <details className="soma-td-details" open={settingsOpen}
   onToggle={event=>setSettingsOpen(event.currentTarget.open)}>
   <summary><span>Koneksi &amp; pengaturan</span><ChevronDown size={14} aria-hidden="true"/></summary>
   <div className="soma-td-detail-body">
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
   {connected&&<p className="soma-td-feedback" role="status">{status.message}</p>}
   {streaming&&<p className="soma-td-info">Dikirim {status.fps.toFixed(0)} Hz · {status.sentEvents} event · cek hasil di Script CHOP</p>}
   <details className="soma-td-help"><summary>Pasang receiver di TouchDesigner <ChevronDown size={14}/></summary>
    <div className="soma-td-setup-visual">
     <div><b>01 · Web Server DAT</b><span>127.0.0.1 · port 8765 · Active ON</span></div>
     <div><b>02 · Callbacks DAT</b><span>Tempel skrip receiver dan aktifkan ulang server</span></div>
     <div><b>03 · Script CHOP</b><span>Tempel skrip CHOP untuk kanal kaki A/B</span></div>
    </div>
    <p>Kode sesi dari Textport: <code>op('webserver1').fetch('soma_token')</code></p>
    <div className="soma-td-script-links">
     <a href="https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/blob/main/touchdesigner/soma_webserver_callbacks.py"
      target="_blank" rel="noopener noreferrer">Skrip Web Server</a>
     <a href="https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/blob/main/touchdesigner/soma_script_chop.py"
      target="_blank" rel="noopener noreferrer">Skrip CHOP</a>
    </div>
    <small><ShieldAlert size={12} aria-hidden="true"/> Output proyektor memerlukan gate manual di TouchDesigner.</small>
   </details>
   </div>
  </details>
  {status.status==='error'||status.status==='disconnected'?
   <p className="soma-td-message" role="alert">{status.message}</p>:null}
 </div>;
}
