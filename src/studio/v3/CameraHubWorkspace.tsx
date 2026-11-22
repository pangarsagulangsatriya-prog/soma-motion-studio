import {useCallback,useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {Camera,RefreshCw,Monitor,Layers3,ScanLine,Plus,Maximize,Unplug,AlertCircle} from 'lucide-react';
import './camera-hub-workspace.css';

type Props={
 devices:MediaDeviceInfo[];selectedId:string;cameraOn:boolean;cameraBusy:boolean;
 cameraError:string;videoRef:RefObject<HTMLVideoElement|null>;
 onSelectStageOne:(id:string)=>Promise<void>;onGoStageOne:()=>void;
};
type Destination='stage1'|'stage2'|'f3';
const targets:{id:Destination;title:string;detail:string;enabled:boolean}[]=[
 {id:'stage1',title:'Stage 1',detail:'Footprints · Track',enabled:true},
 {id:'stage2',title:'Stage 2',detail:'Adapter belum tersedia',enabled:false},
 {id:'f3',title:'F3 Capture',detail:'Migrasi jalur kamera',enabled:false}
];
const selectedKey=(d:MediaDeviceInfo,i:number)=>d.deviceId||'unavailable-'+i;

export function CameraHubWorkspace({devices,selectedId,cameraOn,cameraBusy,cameraError,videoRef,onSelectStageOne,onGoStageOne}:Props){
 const [inventory,setInventory]=useState<MediaDeviceInfo[]>(devices);
 const [refreshing,setRefreshing]=useState(false);
 const [busyId,setBusyId]=useState<string|null>(null);
 const [focused,setFocused]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [zoom,setZoom]=useState(1);
 const preview=useRef<HTMLVideoElement>(null);
 const refresh=useCallback(async()=>{
  setRefreshing(true);setError('');
  try{
   if(!navigator.mediaDevices?.enumerateDevices)throw new Error('Browser tidak mendukung pemeriksaan kamera.');
   const found=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
   setInventory(found);
  }catch(e){setError(e instanceof Error?e.message:'Gagal memeriksa kamera.');}
  finally{setRefreshing(false);}
 },[]);
 useEffect(()=>{setInventory(devices);},[devices]);
 useEffect(()=>{
  if(!navigator.mediaDevices)return;
  const changed=()=>{void refresh();};
  navigator.mediaDevices.addEventListener?.('devicechange',changed);
  return()=>navigator.mediaDevices.removeEventListener?.('devicechange',changed);
 },[refresh]);
 useEffect(()=>{
  const video=preview.current,source=videoRef.current;
  if(!video||!source)return;
  const attach=()=>{
   if(video.srcObject!==source.srcObject)video.srcObject=source.srcObject;
   if(source.srcObject&&cameraOn)void video.play().catch(()=>{});
  };
  attach();
  const timer=window.setInterval(attach,700);
  return()=>{window.clearInterval(timer);video.pause();video.srcObject=null;};
 },[videoRef,cameraOn]);
 const list=useMemo(()=>inventory.map((d,i)=>({id:selectedKey(d,i),name:d.label||'Kamera '+(i+1),physicalId:d.deviceId})),[inventory]);
 const active=Boolean(cameraOn&&!cameraBusy&&!cameraError&&videoRef.current?.srcObject);
 const connectedId=list.find(x=>x.physicalId===selectedId)?.id??(selectedId===''?list[0]?.id:undefined);
 const liveCount=active?1:0;
 const usedCount=active&&connectedId?1:0;
 const chosen=list.find(x=>x.id===focused);
 const route=async(id:string)=>{
  const node=list.find(x=>x.id===id);
  if(!node?.physicalId){setError('Perangkat belum memberikan ID. Izinkan kamera melalui Track terlebih dahulu.');return;}
  setError('');setBusyId(id);setFocused(id);
  try{await onSelectStageOne(node.physicalId);}
  catch(e){setError(e instanceof Error?e.message:'Tidak dapat menghubungkan perangkat.');}
  finally{setBusyId(null);}
 };
 return <section className="ch-workspace" aria-label="Camera Hub">
  <header className="ch-head">
   <div><p className="ch-eyebrow">SOMA / SOURCES</p><h1>Camera Hub</h1>
    <p className="ch-subtitle">{list.length} terdeteksi <span>·</span> {liveCount} streaming <span>·</span> {usedCount} dipakai Stage 1</p></div>
   <div className="ch-actions">
    <button type="button" onClick={()=>void refresh()} disabled={refreshing}><RefreshCw size={16}/>{refreshing?'Memeriksa…':'Perbarui'}</button>
    <button type="button" className="ch-primary" onClick={onGoStageOne}><Plus size={17}/> Hubungkan sumber</button>
   </div>
  </header>
  {(error||cameraError)&&<div className="ch-error" role="alert"><AlertCircle size={17}/>{error||cameraError}</div>}
  <div className="ch-layout">
   <div className="ch-graph-scroll">
    <div className="ch-graph-head"><span><span className="ch-pulse"/> LIVE ROUTING</span><div className="ch-zoom"><button type="button" aria-label="Perkecil" onClick={()=>setZoom(v=>Math.max(.75,v-.1))}>−</button><span>{Math.round(zoom*100)}%</span><button type="button" aria-label="Perbesar" onClick={()=>setZoom(v=>Math.min(1.25,v+.1))}>+</button><button type="button" aria-label="Fit view" onClick={()=>setZoom(1)}><Maximize size={14}/></button></div></div>
    <div className="ch-graph" style={{minWidth:Math.round(650*zoom),minHeight:Math.max(440,Math.round((list.length*110+80)*zoom))}}>
     <div className="ch-grid"/>
     <div className="ch-graph-inner" style={{transform:`scale(${zoom})`,transformOrigin:'top left'}}>
      <div className="ch-col-title ch-col-a">SOURCES <span>{list.length}</span></div>
      <div className="ch-col-title ch-col-b">DESTINATIONS <span>3</span></div>
      <svg className="ch-connections" width="650" height={Math.max(380,list.length*110+45)} aria-hidden="true">
       {list.map((node,i)=>{
        const routed=active&&connectedId===node.id;
        const drafted=!active&&connectedId===node.id&&cameraOn;
        if(!routed&&!drafted)return null;
        const y=100+i*110;
        return <path key={node.id} d={`M 248 ${y} C 330 ${y}, 325 100, 406 100`}
         fill="none" stroke={routed?'#71d69c':'#7e9c88'} strokeWidth={routed?3:1.5}
         strokeDasharray={routed?undefined:'6 6'} className={routed?'ch-live-edge':undefined}/>;
       })}
      </svg>
      <div className="ch-sources">
       {list.length===0&&<div className="ch-empty"><Camera size={25}/><strong>Belum ada kamera</strong><p>Hubungkan webcam atau HP melalui Track, kemudian perbarui daftar perangkat.</p></div>}
       {list.map((node,i)=>{
        const isActive=active&&connectedId===node.id;
        const isConnecting=busyId===node.id;
        return <button type="button" key={node.id} className={`ch-node ch-source ${focused===node.id?'ch-selected':''}`}
          onClick={()=>setFocused(node.id)} aria-label={`Pilih ${node.name}`}>
          <div className="ch-node-top"><span className="ch-camera-icon"><Camera size={18}/></span><span className="ch-node-name">{node.name}</span></div>
          <div className="ch-node-bottom"><span className={`ch-dot ${isActive?'ch-green':''}`}/>{isActive?'LIVE · Stage 1':isConnecting?'Menghubungkan…':'Terdeteksi'}</div>
          <span className="ch-port" aria-hidden="true"/>
         </button>;
       })}
      </div>
      <div className="ch-targets">
       {targets.map((t,i)=><div key={t.id} className={`ch-node ch-target ${!t.enabled?'ch-disabled':''}`}>
        <span className="ch-port ch-input-port" aria-hidden="true"/>
        <div className="ch-node-top">{i===0?<Monitor size={18}/>:i===1?<Layers3 size={18}/>:<ScanLine size={18}/>}<span className="ch-node-name">{t.title}</span></div>
        <div className="ch-target-detail">{t.detail}</div>
        <span className="ch-target-status">{i===0&&usedCount?'● Menerima gambar':t.enabled?'Belum tersambung':'Belum terhubung ke Hub'}</span>
       </div>)}
      </div>
     </div>
    </div>
    <div className="ch-graph-footer"><span><i className="ch-legend-live"/> Streaming aktif</span><span><i className="ch-legend-idle"/> Perangkat terdeteksi</span><span>Perbarui untuk menemukan perangkat baru</span></div>
   </div>
   <aside className="ch-inspector" aria-label="Detail kamera">
    <p className="ch-inspector-eyebrow">INSPECTOR</p><h2>{chosen?.name||'Pilih kamera'}</h2>
    <div className="ch-preview">
     {active&&connectedId===focused?<video ref={preview} autoPlay muted playsInline aria-label="Preview kamera langsung"/>:<div className="ch-preview-empty"><Camera size={25}/><span>{focused?'Preview tersedia setelah kamera aktif':'Pilih sumber di kanvas'}</span></div>}
    </div>
    {chosen?<><div className="ch-row"><span>Perangkat</span><strong>Terdeteksi</strong></div>
     <div className="ch-row"><span>Stream</span><strong>{active&&connectedId===chosen.id?'LIVE':'Belum terverifikasi'}</strong></div>
     <div className="ch-row"><span>Tujuan</span><strong>{active&&connectedId===chosen.id?'Stage 1':'Belum terhubung'}</strong></div>
     <button type="button" className="ch-route-button" onClick={()=>void route(chosen.id)} disabled={busyId!==null||!chosen.physicalId}>{busyId===chosen.id?'Menghubungkan…':'Gunakan di Stage 1'}</button>
     <p className="ch-inspector-note">Mengganti kamera Stage 1 meminta verifikasi ulang kalibrasi. Stage 2 dan F3 masih memakai koneksi terpisah.</p>
    </>:<p className="ch-inspector-note">Klik salah satu node kamera untuk melihat status dan menghubungkannya ke Stage 1.</p>}
    <div className="ch-note"><Unplug size={16}/>Perangkat terdeteksi belum tentu sedang streaming. Garis hanya muncul ketika sambungan terkonfirmasi.</div>
   </aside>
  </div>
 </section>;
}
