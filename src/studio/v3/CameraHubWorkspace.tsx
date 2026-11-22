import {useCallback,useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {Camera,RefreshCw,Monitor,Layers3,ScanLine,Plus,Maximize,Unplug,AlertCircle,
 Eye,EyeOff,Trash2,Video,VideoOff,Check,Settings2} from 'lucide-react';
import {drawSkeletonBodies} from '../../stage/fullBodySkeleton.ts';
import type {MotionFrame} from '../../engine/types.ts';
import {normalizeCameraDevices,cameraErrorMessage} from '../../engine/universalCamera.ts';
import {hubFrameIsFresh,hubSourceAvailable,CameraHubRegistry,type HubCameraRecord} from './CameraHubRegistry.ts';
import './camera-hub-workspace.css';

type Props={
 devices:MediaDeviceInfo[];selectedId:string;cameraOn:boolean;cameraBusy:boolean;
 cameraError:string;videoRef:RefObject<HTMLVideoElement|null>;frameRef:RefObject<MotionFrame>;
 registry:CameraHubRegistry;onSelectStageOne:(id:string)=>Promise<void>;onGoStageOne:()=>void;
};
type Feed={video:HTMLVideoElement|null;frame:MotionFrame|null;frameAt:number};
type PreviewProps={
 registry:CameraHubRegistry;nodeId:string;borrowed:boolean;showSkeleton:boolean;
 cameraOn:boolean;videoRef:RefObject<HTMLVideoElement|null>;frameRef:RefObject<MotionFrame>;
 large?:boolean;
};
/** Each visible node paints its own independent Track source, including its own
 * 33-point skeleton. Rendering stops on unmount, capture stays alive in App. */
function CameraPreview({registry,nodeId,borrowed,showSkeleton,cameraOn,videoRef,frameRef,large=false}:PreviewProps){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let raf=0,last=0;
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);
   if(now-last<45)return;
   last=now;
   const c=canvas.current,ctx=c?.getContext('2d',{alpha:false});if(!c||!ctx)return;
   const feed:Feed=borrowed?
    {video:cameraOn?videoRef.current:null,frame:frameRef.current,frameAt:frameRef.current?.time??0}:
    (registry.feed(nodeId)??{video:null,frame:null,frameAt:0});
   const video=feed.video;
   ctx.fillStyle='#050a07';ctx.fillRect(0,0,c.width,c.height);
   if(!video||video.readyState<2||video.videoWidth<=0||video.videoHeight<=0||video.paused)return;
   const scale=Math.min(c.width/video.videoWidth,c.height/video.videoHeight);
   const w=video.videoWidth*scale,h=video.videoHeight*scale;
   const x=(c.width-w)/2,y=(c.height-h)/2;
   try{ctx.drawImage(video,x,y,w,h);}catch{return;}
   const f=feed.frame;
   if(showSkeleton&&f?.source==='camera'&&hubFrameIsFresh(feed.frameAt,now)&&f.tracked){
    const poses=f.poses?.length?f.poses:(f.pose?.length?[f.pose]:[]);
    drawSkeletonBodies(ctx,poses,{x,y,width:w,height:h},{labels:large,lineWidth:large?2.4:1.4});
   }
  };
  raf=requestAnimationFrame(paint);
  return()=>cancelAnimationFrame(raf);
 },[registry,nodeId,borrowed,showSkeleton,cameraOn,videoRef,frameRef,large]);
 return <canvas ref={canvas} width={large?640:320} height={large?360:180}
  className="ch-camera-canvas" aria-label={showSkeleton?'Preview kamera dengan skeleton':'Preview video asli'} role="img"/>;
}
const targets=[
 {id:'stage1',name:'Stage 1',detail:'Footprints · Track',enabled:true},
 {id:'stage2',name:'Stage 2',detail:'Router belum terintegrasi',enabled:false},
 {id:'f3',name:'F3 Capture',detail:'Input A/B masih mandiri',enabled:false}
] as const;
type NodeView={id:string;deviceId:string;name:string;phase:string;message:string;showSkeleton:boolean;borrowed:boolean;record?:HubCameraRecord};
const stageKey='stage-one-source';
export function CameraHubWorkspace({devices,selectedId,cameraOn,cameraBusy,cameraError,videoRef,frameRef,registry,onSelectStageOne,onGoStageOne}:Props){
 const [inventory,setInventory]=useState<MediaDeviceInfo[]>(devices);
 const [records,setRecords]=useState<HubCameraRecord[]>(()=>registry.snapshot());
 const [refreshing,setRefreshing]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const [showAdd,setShowAdd]=useState(false);
 const [picked,setPicked]=useState('');
 const [renameValue,setRenameValue]=useState('');
 const [swapDevice,setSwapDevice]=useState('');
 const [stageSkeleton,setStageSkeleton]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [zoom,setZoom]=useState(1);
 useEffect(()=>registry.subscribe(()=>setRecords(registry.snapshot())),[registry]);
 useEffect(()=>{setInventory(current=>devices.length?normalizeCameraDevices(devices):current);},[devices]);
 const refresh=useCallback(async()=>{
  setRefreshing(true);setError('');
  try{
   if(!navigator.mediaDevices?.enumerateDevices)throw Error('Browser tidak mendukung daftar kamera.');
   setInventory(normalizeCameraDevices(await navigator.mediaDevices.enumerateDevices()));
  }catch(e){setError(cameraErrorMessage(e));}
  finally{setRefreshing(false);}
 },[]);
 useEffect(()=>{
  void refresh();
  const m=navigator.mediaDevices;
  m?.addEventListener?.('devicechange',refresh);
  return()=>m?.removeEventListener?.('devicechange',refresh);
 },[refresh]);
 const borrowed=Boolean(cameraOn&&!cameraBusy&&!cameraError&&videoRef.current?.srcObject);
 const trackDevice=selectedId||((videoRef.current?.srcObject as MediaStream|null)?.getVideoTracks()[0]?.getSettings().deviceId??'');
 const sources=useMemo<NodeView[]>(()=>{
  const active:NodeView[]=records.map(r=>({...r,borrowed:false,record:r}));
  if(borrowed){
   active.unshift({id:stageKey,deviceId:trackDevice,name:'Stage 1 · Kamera aktif',
    phase:'live',message:'Dipakai Track',showSkeleton:stageSkeleton,borrowed:true});
  }
  return active;
 },[records,borrowed,trackDevice,stageSkeleton]);
 const selectedNode=sources.find(x=>x.id===selected)??null;
 useEffect(()=>{if(selected&&!sources.some(x=>x.id===selected))setSelected(null);},[selected,sources]);
 useEffect(()=>{setRenameValue(selectedNode?.name??'');setSwapDevice(selectedNode?.deviceId??'');},[selectedNode?.id]);
 const live=sources.filter(s=>s.phase==='live').length;
 const trackLinked=borrowed?1:0;
 const freeDevices=inventory.filter(d=>hubSourceAvailable(d.deviceId,records)&&!(borrowed&&trackDevice===d.deviceId));
 const newCamera=async()=>{
  const device=inventory.find(d=>d.deviceId===picked);
  if(!device){setError('Pilih kamera terlebih dahulu.');return;}
  if(borrowed&&device.deviceId===trackDevice){setSelected(stageKey);setShowAdd(false);return;}
  let id='';
  try{
   id=registry.create(device.deviceId,device.label||'Kamera '+(records.length+1));
   setSelected(id);setShowAdd(false);setBusy(true);setError('');
   await registry.connect(id);
  }catch(e){setError(e instanceof Error?e.message:'Kamera tidak dapat ditambahkan.');}
  finally{setBusy(false);}
 };
 const act=async(action:()=>Promise<void>)=>{
  setBusy(true);setError('');
  try{await action();}catch(e){setError(e instanceof Error?e.message:'Operasi kamera gagal.');}
  finally{setBusy(false);}
 };
 const updateDevice=()=>{
  if(!selectedNode||selectedNode.borrowed)return;
  if(borrowed&&swapDevice===trackDevice){setError('Kamera tersebut sedang dipakai Stage 1. Pilih sumber lain.');return;}
  const d=inventory.find(x=>x.deviceId===swapDevice);
  if(!d){setError('Pilih kamera yang terdeteksi.');return;}
  void act(()=>registry.replace(selectedNode.id,d.deviceId,d.label||renameValue));
 };
 const sendTrack=()=>{
  if(!selectedNode||!selectedNode.deviceId)return;
  void act(async()=>{
   if(!selectedNode.borrowed)registry.disconnect(selectedNode.id);
   await onSelectStageOne(selectedNode.deviceId);
   setSelected(stageKey);
  });
 };
 return <section className="ch-workspace" aria-label="Camera Hub">
  <header className="ch-head">
   <div><p className="ch-eyebrow">SOMA / SOURCES</p><h1>Camera Hub</h1>
    <p className="ch-subtitle">{inventory.length} terdeteksi <span>·</span> {live} streaming
     <span>·</span> {trackLinked} dipakai Stage 1</p></div>
   <div className="ch-actions">
    <button type="button" onClick={()=>void refresh()} disabled={refreshing}><RefreshCw size={16}/>{refreshing?'Memeriksa…':'Perbarui'}</button>
    <button type="button" className="ch-primary" onClick={()=>{setShowAdd(v=>!v);setPicked('');setError('');}}>
     <Plus size={17}/> Tambah kamera</button>
   </div>
  </header>
  {showAdd&&<section className="ch-add-panel" aria-label="Tambah kamera">
   <div><strong>Tambah sumber kamera</strong><p>Gunakan daftar perangkat Track: webcam, HDMI/OBS, serta HP yang muncul sebagai webcam USB/Continuity.</p></div>
   <label htmlFor="ch-device-add">Perangkat</label>
   <select id="ch-device-add" value={picked} onChange={e=>setPicked(e.target.value)}>
    <option value="">Pilih perangkat…</option>
    {freeDevices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||'Kamera '+(i+1)}</option>)}
   </select>
   <button type="button" className="ch-add-confirm" disabled={!picked||busy} onClick={()=>void newCamera()}>
    <Plus size={15}/> Sambungkan
   </button>
   <button type="button" className="ch-add-close" onClick={()=>setShowAdd(false)}>Batal</button>
   {!freeDevices.length&&<p className="ch-add-help">Tidak ada kamera bebas. Sambungkan perangkat lain atau perbarui daftar. HP nirkabel tetap bisa dipasangkan melalui Track.</p>}
  </section>}
  {(error||cameraError)&&<div className="ch-error" role="alert"><AlertCircle size={17}/>{error||cameraError}</div>}
  <div className="ch-layout">
   <div className="ch-graph-scroll">
    <div className="ch-graph-head"><span><span className="ch-pulse"/> CAMERA ROUTES</span>
     <div className="ch-zoom"><button type="button" aria-label="Perkecil" onClick={()=>setZoom(z=>Math.max(.75,z-.1))}>−</button>
      <span>{Math.round(zoom*100)}%</span><button type="button" aria-label="Perbesar" onClick={()=>setZoom(z=>Math.min(1.25,z+.1))}>+</button>
      <button type="button" aria-label="Fit view" onClick={()=>setZoom(1)}><Maximize size={14}/></button></div>
    </div>
    <div className="ch-graph" style={{minWidth:Math.round(650*zoom),minHeight:Math.max(510,Math.round((sources.length*172+100)*zoom))}}>
     <div className="ch-grid"/>
     <div className="ch-graph-inner" style={{transform:`scale(${zoom})`,transformOrigin:'top left',
      minHeight:Math.max(490,sources.length*172+75)}}>
      <div className="ch-col-title ch-col-a">SOURCES <span>{sources.length}</span></div>
      <div className="ch-col-title ch-col-b">DESTINATIONS <span>3</span></div>
      <svg className="ch-connections" width="650" height={Math.max(490,sources.length*172+75)} aria-hidden="true">
       {sources.map((n,i)=>{
        const routed=n.borrowed&&borrowed;
        if(!routed)return null;
        const y=145+i*172;
        return <path key={n.id} d={`M 251 ${y} C 340 ${y}, 320 112, 406 112`}
         fill="none" stroke="#71d69c" strokeWidth={2.5} className="ch-live-edge"/>;
       })}
      </svg>
      <div className="ch-sources">
       {sources.length===0&&<div className="ch-empty"><Camera size={25}/><strong>Belum ada kamera terdaftar</strong>
        <p>Klik Tambah kamera untuk membuka perangkat. Preview dan skeleton muncul setelah koneksi aktif.</p></div>}
       {sources.map(n=><button type="button" key={n.id} className={`ch-node ch-source ch-camera-node ${selected===n.id?'ch-selected':''}`}
        onClick={()=>setSelected(n.id)} aria-label={`Pilih ${n.name}`}>
        <div className="ch-node-top"><span className="ch-camera-icon"><Camera size={16}/></span>
         <span className="ch-node-name">{n.name}</span></div>
        <div className="ch-node-preview"><CameraPreview registry={registry} nodeId={n.id} borrowed={n.borrowed}
         showSkeleton={n.showSkeleton} cameraOn={cameraOn} videoRef={videoRef} frameRef={frameRef}/></div>
        <div className="ch-node-bottom"><span className={`ch-dot ${n.phase==='live'?'ch-green':''}`}/>
         {n.phase==='live'?'LIVE · '+(n.record?.detectedBodies??0)+' tubuh':n.message}</div>
        <span className="ch-port" aria-hidden="true"/>
       </button>)}
      </div>
      <div className="ch-targets">
       {targets.map((t,i)=><div key={t.id} className={`ch-node ch-target ${!t.enabled?'ch-disabled':''}`}>
        <span className="ch-port ch-input-port" aria-hidden="true"/>
        <div className="ch-node-top">{i===0?<Monitor size={18}/>:i===1?<Layers3 size={18}/>:<ScanLine size={18}/>}
         <span className="ch-node-name">{t.name}</span></div>
        <div className="ch-target-detail">{t.detail}</div>
        <span className="ch-target-status">{i===0&&borrowed?'● Menerima video Track':t.enabled?'Belum terhubung':'Belum dirutekan dari Hub'}</span>
       </div>)}
      </div>
     </div>
    </div>
    <div className="ch-graph-footer">
     <span><i className="ch-legend-live"/> Video Track aktif</span>
     <span><i className="ch-legend-idle"/> Kamera terdaftar</span>
     <span>Preview + skeleton per kamera, memakai engine Track</span>
    </div>
   </div>
   <aside className="ch-inspector" aria-label="Detail kamera">
    <p className="ch-inspector-eyebrow">INSPECTOR</p><h2>{selectedNode?.name||'Pilih kamera'}</h2>
    <div className="ch-preview">
     {selectedNode?<CameraPreview registry={registry} nodeId={selectedNode.id} borrowed={selectedNode.borrowed}
      showSkeleton={selectedNode.showSkeleton} cameraOn={cameraOn} videoRef={videoRef} frameRef={frameRef} large/>:
      <div className="ch-preview-empty"><Camera size={25}/><span>Pilih node kamera di kanvas</span></div>}
    </div>
    {selectedNode?<div className="ch-inspector-body">
     <div className="ch-row"><span>Status</span><strong>{selectedNode.phase==='live'?'LIVE':selectedNode.message}</strong></div>
     <div className="ch-row"><span>Skeleton</span><strong>{selectedNode.showSkeleton?'Tampil':'Tersembunyi'}</strong></div>
     <button type="button" className="ch-inspector-toggle"
      onClick={()=>selectedNode.borrowed?setStageSkeleton(v=>!v):registry.setSkeleton(selectedNode.id,!selectedNode.showSkeleton)}>
      {selectedNode.showSkeleton?<EyeOff size={15}/>:<Eye size={15}/>}
      {selectedNode.showSkeleton?'Sembunyikan skeleton':'Tampilkan skeleton'}</button>
     {selectedNode.borrowed?<p className="ch-inspector-note">Kamera ini sedang dipakai Track. Video dan pose yang sama ditampilkan di Hub, tanpa membuka perangkat dua kali.</p>:<>
      <label htmlFor="ch-rename">Nama kamera</label>
      <div className="ch-inline"><input id="ch-rename" maxLength={64} value={renameValue} onChange={e=>setRenameValue(e.target.value)}/>
       <button type="button" onClick={()=>registry.rename(selectedNode.id,renameValue)} disabled={!renameValue.trim()}>Simpan</button></div>
      <label htmlFor="ch-swap">Ganti perangkat</label>
      <div className="ch-inline"><select id="ch-swap" value={swapDevice} onChange={e=>setSwapDevice(e.target.value)}>
       <option value="">Pilih kamera…</option>
       {inventory.filter(d=>d.deviceId===selectedNode.deviceId||freeDevices.some(f=>f.deviceId===d.deviceId))
        .map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'Kamera tersedia'}</option>)}
      </select><button type="button" disabled={busy||!swapDevice} onClick={updateDevice}><Settings2 size={14}/></button></div>
      <div className="ch-operations">
       {selectedNode.phase==='live'||selectedNode.phase==='connecting'?
        <button type="button" onClick={()=>registry.disconnect(selectedNode.id)}><VideoOff size={15}/> Putus</button>:
        <button type="button" disabled={busy} onClick={()=>void act(()=>registry.connect(selectedNode.id))}><Video size={15}/> Sambungkan ulang</button>}
       <button type="button" className="ch-remove" onClick={()=>{
        registry.remove(selectedNode.id);setSelected(null);
       }}><Trash2 size={15}/> Hapus</button>
      </div>
     </>}
     <button type="button" className="ch-route-button" onClick={sendTrack} disabled={busy||!selectedNode.deviceId}>
      <Check size={15}/> {selectedNode.borrowed?'Dipakai Stage 1':'Gunakan di Stage 1'}</button>
     <p className="ch-inspector-note">Memindahkan kamera ke Stage 1 melepaskan sesi Hub untuk perangkat itu. Kalibrasi lantai harus diperiksa ulang. Stage 2 dan F3 masih memiliki jalur input sendiri.</p>
    </div>:<p className="ch-inspector-note">Pilih kamera untuk melihat preview, mengubah nama, mengganti sumber, mengatur skeleton, atau menghapus perangkat.</p>}
    <div className="ch-note"><Unplug size={16}/>Kamera terlihat di daftar belum tentu streaming. Node LIVE muncul setelah video aktif; skeleton hanya menggambar pose yang benar-benar terdeteksi.</div>
    <button type="button" className="ch-track-link" onClick={onGoStageOne}>Buka Track untuk sumber MP4, HP nirkabel atau Simulasi 3D</button>
   </aside>
  </div>
 </section>;
}
