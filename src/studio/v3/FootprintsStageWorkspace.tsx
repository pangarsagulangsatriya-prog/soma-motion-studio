import {useEffect,useRef,useState,type RefObject} from 'react';
import {Activity,Camera,CameraOff,ChevronRight,Film,Footprints,Monitor,Pause,Play,ShieldAlert,SlidersHorizontal,Video,Waypoints} from 'lucide-react';
import type {MotionFrame} from '../../engine/types.ts';
import type {Projection} from '../../projection/useProjection.ts';
import type {LiveFloorTrackingEngine,LiveFloorStatus} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter,MultiPoseStatus} from '../../footprints/live/MultiPoseGaitRouter.ts';
import {paintFloorCanvas} from '../../footprints/simulator/floorCanvas.ts';
import {buildLowerBodyMask,LOWER_BODY_MASK_DEFAULTS} from '../../footprints/stage-optics/LowerBodyMaskEngine.ts';
import {ArchivalMappingPanel} from '../../footprints/stage-optics/ArchivalMappingPanel.tsx';
import {palettes} from '../../footprints/pattern.ts';
import type {FootprintConfig,FootprintStyle} from '../../footprints/StudioFootprints.tsx';
import './footprints-stage-workspace.css';

type InspectorTab='tracking'|'visual'|'mapping'|'output';
type WorkspaceView='stage'|'archive';
type Props={
 frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 tracker:LiveFloorTrackingEngine;router:MultiPoseGaitRouter;projection:Projection;
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;
 performerCount:1|2;onPerformerCount:(count:1|2)=>void;
 onStartBody:()=>void;onOpenSimulator:()=>void;onOpenLiveFloor:()=>void;
 onBlackout:()=>void;footprint:FootprintConfig;
 updateFootprint:(value:Partial<FootprintConfig>)=>void;
};
const inspectorTabs:{id:InspectorTab;label:string}[]=[
 {id:'tracking',label:'Tracking'},{id:'visual',label:'Visual'},
 {id:'mapping',label:'Mapping'},{id:'output',label:'Output'}
];
const blockedReason=(cameraOn:boolean,calibrated:boolean,confirmed:boolean)=>
 !cameraOn?'Kamera Body belum aktif.':!calibrated?'Lantai belum dikalibrasi.':
 !confirmed?'Konfirmasi kalibrasi lantai.':'Menunggu event pijakan.';
export function FootprintsStageWorkspace({
 frameRef,videoRef,tracker,router,projection,cameraOn,cameraBusy,cameraError,
 performerCount,onPerformerCount,onStartBody,onOpenSimulator,onOpenLiveFloor,
 onBlackout,footprint,updateFootprint
}:Props){
 const cameraCanvas=useRef<HTMLCanvasElement>(null);
 const bodyCanvas=useRef<HTMLCanvasElement>(null);
 const floorCanvas=useRef<HTMLCanvasElement>(null);
 const [view,setView]=useState<WorkspaceView>('stage');
 const [inspector,setInspector]=useState<InspectorTab>('tracking');
 const [floorStatus,setFloorStatus]=useState<LiveFloorStatus>(()=>tracker.status);
 const [identityStatus,setIdentityStatus]=useState<MultiPoseStatus>(()=>router.status);
 const [maskStatus,setMaskStatus]=useState('Kamera belum terhubung');
 const [bodyVisible,setBodyVisible]=useState(0);
 const [frameFresh,setFrameFresh]=useState(false);
 const [viewError,setViewError]=useState('');
 const showArchive=()=>{
  setView('archive');setInspector('mapping');
 };
 useEffect(()=>{
  const sync=()=>{setFloorStatus(tracker.status);setIdentityStatus(router.status);};
  const offFloor=tracker.subscribe(sync),offRouter=router.subscribe(sync);
  const poll=window.setInterval(sync,450);
  sync();
  return()=>{offFloor();offRouter();window.clearInterval(poll);};
 },[tracker,router]);
 // Reuses the single SOMA camera frame and calibrated FloorSession V3.
 // No camera acquisition, new gait engine or pad event generation here.
 useEffect(()=>{
  let raf=0,lastDraw=0,lastFloorRevision=-1,lastStatus='';
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-lastDraw<1000/18)return;
   lastDraw=now;
   const f=frameRef.current,v=videoRef.current;
   const fresh=cameraOn&&f.source==='camera'&&f.tracked&&f.time<=now&&now-f.time<450;
   setFrameFresh(prev=>prev===fresh?prev:fresh);
   const camera=cameraCanvas.current,cam=camera?.getContext('2d');
   if(camera&&cam){
    cam.fillStyle='#050807';cam.fillRect(0,0,camera.width,camera.height);
    if(cameraOn&&v&&v.readyState>=2&&v.videoWidth&&v.videoHeight){
     const scale=Math.min(camera.width/v.videoWidth,camera.height/v.videoHeight);
     const w=v.videoWidth*scale,h=v.videoHeight*scale;
     try{cam.drawImage(v,(camera.width-w)/2,(camera.height-h)/2,w,h);}
     catch{/* Video can briefly detach on source changes. */}
    }
   }
   const options={...LOWER_BODY_MASK_DEFAULTS,performers:performerCount,
    requireSegmentation:false};
   const result=buildLowerBodyMask(fresh?f:null,options,now);
   const identities=router.status;
   const ambiguous=performerCount===2&&
    (identities.ambiguous||identities.visible.length<2||
     identities.observedFrameTime!==f.time);
   const allow=result.status==='ready'&&!ambiguous;
   const b=bodyCanvas.current,g=b?.getContext('2d');
   if(b&&g){
    const image=g.createImageData(result.mask.width,result.mask.height);
    let lit=0;
    if(allow)for(let i=0;i<result.mask.data.length;i++){
     const alpha=result.mask.data[i];if(alpha>20)lit++;
     const k=i*4;
     image.data[k]=Math.round(alpha*.86);
     image.data[k+1]=Math.round(alpha*.90);
     image.data[k+2]=Math.round(alpha*.83);
     image.data[k+3]=255;
    }
    else for(let i=0;i<image.data.length;i+=4)image.data[i+3]=255;
    if(b.width!==image.width)b.width=image.width;
    if(b.height!==image.height)b.height=image.height;
    g.putImageData(image,0,0);
    setBodyVisible(prev=>prev===lit?prev:lit);
   }
   const label=!cameraOn?'Kamera belum aktif':
    ambiguous?'Identitas A/B belum stabil':
    allow?'Mask tubuh terbaca':
    result.status==='stale'?'Frame terlambat':'Landmark kaki belum lengkap';
   if(label!==lastStatus){lastStatus=label;setMaskStatus(label);}
   const pad=floorCanvas.current;
   if(pad&&(lastFloorRevision!==tracker.eventRevision)){
    lastFloorRevision=tracker.eventRevision;
    const session=tracker.session;
    if(session){
     try{paintFloorCanvas(pad,session,{showGrid:false});setViewError('');}
     catch(e){setViewError(e instanceof Error?e.message:'Pad tidak dapat dirender.');}
    }else{
     const ctx=pad.getContext('2d');
     if(ctx){ctx.fillStyle='#000';ctx.fillRect(0,0,pad.width,pad.height);}
    }
   }
  };
  raf=requestAnimationFrame(draw);
  return()=>cancelAnimationFrame(raf);
 },[frameRef,videoRef,tracker,router,cameraOn,performerCount]);
 const projectionState=projection.status.connected?
  projection.transport==='blackout'?'Blackout aktif':projection.transport==='hold'?'Output ditahan':'Output aktif':
  'Output belum tersambung';
 const cameraLabel=cameraBusy?'Menghubungkan':cameraError?'Kamera bermasalah':frameFresh?'Tracking aktif':cameraOn?'Mencari tubuh':'Kamera mati';
 const totalFrames=bodyVisible;
 const changeView=(next:WorkspaceView)=>{
  if(next==='archive')showArchive();
  else{onBlackout();setView('stage');}
 };
 return <section className="fp-stage-workspace" aria-label="Workspace utama SOMA Footprints">
  <header className="fp-stage-heading">
   <div className="fp-stage-brand">
    <span className="fp-stage-eyebrow">SOMA / MOTION INTELLIGENCE</span>
    <h1><Footprints size={23}/> Footprints <small>Stage Workspace</small></h1>
    <p>Gerak kaki, arsip tubuh, dan pad lantai dalam satu ruang kerja.</p>
   </div>
   <div className="fp-stage-state" aria-label="Status perangkat">
    <span data-state={frameFresh?'ok':'idle'}><i/>{cameraLabel}</span>
    <span data-state={floorStatus.confirmed?'ok':'idle'}><i/>Lantai {floorStatus.confirmed?'siap':'belum siap'}</span>
    <span data-state={projection.transport==='blackout'?'idle':'warn'}><i/>{projectionState}</span>
   </div>
  </header>
  <div className="fp-stage-toolbar" role="group" aria-label="Tampilan Footprints">
   <div className="fp-stage-view-switch">
    <button type="button" aria-pressed={view==='stage'} onClick={()=>changeView('stage')}>
     <Waypoints size={15}/> Live Stage</button>
    <button type="button" aria-pressed={view==='archive'} onClick={()=>changeView('archive')}>
     <Film size={15}/> Archival Mapping</button>
   </div>
   <div className="fp-stage-top-actions">
    <button type="button" onClick={onOpenSimulator}><Play size={15}/> Simulasi 3D</button>
    <button type="button" onClick={onOpenLiveFloor}><SlidersHorizontal size={15}/> Kalibrasi & QA</button>
    <button type="button" className="fp-stage-blackout" onClick={onBlackout}>
     <Monitor size={15}/> Blackout</button>
   </div>
  </div>
  <div className="fp-stage-layout">
   <div className="fp-stage-main">
    <div className="fp-stage-overview" hidden={view!=='stage'}>
     <div className="fp-stage-video">
      <div className="fp-stage-surface-head"><span>01 / TRACKING CAMERA</span>
       <small>{cameraOn?'Kamera lokal':'Offline'}</small></div>
      <div className="fp-stage-video-content">
       <canvas ref={cameraCanvas} width={768} height={432}
        aria-label="Pratinjau video kamera SOMA Body"/>
       {!cameraOn&&<div className="fp-stage-empty">
        <CameraOff size={28}/>
        <strong>Mulai pelacakan kaki</strong>
        <p>Hubungkan kamera Body untuk membaca langkah dan kontak.</p>
        <button type="button" disabled={cameraBusy} onClick={onStartBody}>
         <Camera size={15}/>{cameraBusy?'Menghubungkan…':'Mulai kamera Body'}</button>
        <button type="button" className="fp-stage-ghost-button" onClick={onOpenSimulator}>
         Coba simulasi tanpa kamera</button>
       </div>}
      </div>
      <div className="fp-stage-surface-foot"><span>{frameFresh?'Pose kamera baru':'Menunggu pose valid'}</span>
       <span>{performerCount} performer</span></div>
     </div>
     <div className="fp-stage-side-previews">
      <div className="fp-stage-surface">
       <div className="fp-stage-surface-head"><span>02 / BODY MASK</span><small>Lower body</small></div>
       <div className="fp-stage-canvas-area">
        <canvas ref={bodyCanvas} width={160} height={90}
         aria-label="Pratinjau mask paha sampai telapak dengan latar hitam"/>
        {totalFrames===0&&<span className="fp-stage-canvas-empty">{maskStatus}</span>}
       </div>
       <div className="fp-stage-surface-foot"><span>{maskStatus}</span><span>Mask · preview</span></div>
      </div>
      <div className="fp-stage-surface">
       <div className="fp-stage-surface-head"><span>03 / FLOOR PAD</span><small>Metric floor</small></div>
       <div className="fp-stage-canvas-area">
        <canvas ref={floorCanvas} width={1280} height={720}
         aria-label="Pratinjau kontak kaki dan lintasan dari FloorSession V3"/>
        {!floorStatus.confirmed&&<span className="fp-stage-canvas-empty">
         {blockedReason(cameraOn,floorStatus.calibrated,floorStatus.confirmed)}</span>}
       </div>
       <div className="fp-stage-surface-foot"><span>{floorStatus.contacts} kontak</span>
        <span>{floorStatus.events} event</span></div>
      </div>
     </div>
    </div>
    {viewError&&<p className="fp-stage-error" role="alert">{viewError}</p>}
    {view==='archive'&&<div className="fp-stage-archive-view">
     <div className="fp-stage-view-note"><Film size={15}/>
      <span>Arsip BODY A/B dan residu FLOOR memakai engine S5.7 yang sama. Video tetap di browser. Kembali ke Live Stage menutup pemutar dan memadamkan output dual-surface.</span></div>
     <ArchivalMappingPanel frameRef={frameRef} cameraOn={cameraOn}
      performerCount={performerCount} router={router} projection={projection}/>
    </div>}
    {view==='stage'&&<div className="fp-stage-bottom-status">
     <Activity size={15}/>
     <span>{floorStatus.reason}</span>
     <button type="button" onClick={onOpenLiveFloor}>Atur tracking <ChevronRight size={14}/></button>
    </div>}
   </div>
   <aside className="fp-stage-inspector" aria-label="Inspector kontekstual Footprints">
    <div className="fp-stage-inspector-title"><span>CONTEXT INSPECTOR</span><h2>{
     inspector==='tracking'?'Tracking':inspector==='visual'?'Footprint Visual':
     inspector==='mapping'?'Archive Mapping':'Projection Output'}</h2></div>
    <div className="fp-stage-inspector-tabs" role="group" aria-label="Bagian inspector">
     {inspectorTabs.map(tab=><button key={tab.id} type="button" aria-pressed={inspector===tab.id}
      onClick={()=>setInspector(tab.id)}>{tab.label}</button>)}
    </div>
    <div className="fp-stage-inspector-content">
     {inspector==='tracking'&&<>
      <p className="fp-stage-label">SUMBER GERAK</p>
      <div className="fp-stage-inspector-kv"><span>Kamera</span><strong>{cameraLabel}</strong></div>
      <div className="fp-stage-inspector-kv"><span>Tracking lantai</span>
       <strong>{floorStatus.confirmed?'Terkalibrasi':'Perlu kalibrasi'}</strong></div>
      <p className="fp-stage-label">JUMLAH PERFORMER</p>
      <div className="fp-stage-segments">
       {([1,2] as const).map(v=><button type="button" key={v}
        aria-pressed={performerCount===v} onClick={()=>onPerformerCount(v)}>
        {v} performer</button>)}
      </div>
      {performerCount===2&&<p className="fp-stage-hint">Identitas A/B: {identityStatus.ambiguous?
       'Bersilangan / belum pasti':identityStatus.visible.length===2?'Dua tubuh terbaca':
       'Menunggu dua tubuh'}</p>}
      <div className="fp-stage-inspector-divider"/>
      <div className="fp-stage-inspector-kv"><span>Kontak tercatat</span><strong>{floorStatus.contacts}</strong></div>
      <div className="fp-stage-inspector-kv"><span>Jumlah event</span><strong>{floorStatus.events}</strong></div>
      <button type="button" className="fp-stage-primary-action" disabled={cameraBusy}
       onClick={onStartBody}><Camera size={15}/>{cameraBusy?'Memuat kamera…':
       cameraOn?'Periksa kamera Body':'Hubungkan kamera Body'}</button>
      <button type="button" onClick={onOpenLiveFloor}>
       <SlidersHorizontal size={15}/> Kalibrasi lantai & pemeriksaan</button>
      {cameraError&&<p className="fp-stage-error" role="alert">{cameraError}</p>}
     </>}
     {inspector==='visual'&&<>
      <p className="fp-stage-label">BENTUK JEJAK</p>
      <div className="fp-stage-style-grid">
       {(['Campuran','Tapak','Garis','Titik'] as FootprintStyle[]).map(style=>
        <button key={style} type="button" aria-pressed={footprint.style===style}
         onClick={()=>updateFootprint({style})}>{style}</button>)}
      </div>
      <label className="fp-stage-field">Ukuran jejak · {footprint.size}px
       <input type="range" min="12" max="90" value={footprint.size}
        onChange={e=>updateFootprint({size:Number(e.target.value)})}/></label>
      <label className="fp-stage-field">Umur jejak · {footprint.life} detik
       <input type="range" min="1" max="60" value={footprint.life}
        onChange={e=>updateFootprint({life:Number(e.target.value)})}/></label>
      <label className="fp-stage-field">Palet
       <select value={footprint.palette} onChange={e=>{
        const idx=Number(e.target.value),p=palettes[idx]??palettes[0];
        updateFootprint({palette:idx,colors:{background:p[1],left:p[2],right:p[3]}});
       }}>{palettes.map((p,i)=><option key={p[0]} value={i}>{p[0]}</option>)}</select>
      </label>
      <p className="fp-stage-hint">Gaya berlaku pada visual jejak Studio. BODY mask dan pad terkalibrasi punya kontrol masing-masing.</p>
     </>}
     {inspector==='mapping'&&<>
      <p className="fp-stage-label">DUA PERMUKAAN</p>
      <div className="fp-stage-inspector-kv"><span>BODY</span><strong>{maskStatus}</strong></div>
      <div className="fp-stage-inspector-kv"><span>FLOOR</span>
       <strong>{floorStatus.confirmed?'Terkalibrasi':'Perlu kalibrasi'}</strong></div>
      <p className="fp-stage-hint">Unggah video arsip A/B, atur batas mask pinggang–kaki, lalu lihat fragmen muncul di pad saat kontak.</p>
      <button type="button" className="fp-stage-primary-action" onClick={showArchive}>
       <Film size={15}/> Buka Archival Mapping</button>
      <button type="button" onClick={onOpenLiveFloor}>
       <SlidersHorizontal size={15}/> Stage Optics & QA</button>
      <p className="fp-stage-hint">Buka Mapping untuk preview video. Body Mask pada Live Stage hanya menampilkan geometri kaki.</p>
     </>}
     {inspector==='output'&&<>
      <p className="fp-stage-label">STATUS PROYEKTOR</p>
      <div className="fp-stage-inspector-kv"><span>Legacy output</span>
       <strong>{projectionState}</strong></div>
      <div className="fp-stage-inspector-kv"><span>BODY / FLOOR</span>
       <strong>Perlu QA fisik terpisah</strong></div>
      <p className="fp-stage-hint">Kontrol dua output berada pada Dual-Surface Calibration, dengan penguncian khusus pada build Production.</p>
      <button type="button" className="fp-stage-blackout fp-stage-primary-action" onClick={onBlackout}>
       <Monitor size={15}/> Blackout output Studio</button>
      <button type="button" onClick={onOpenLiveFloor}>
       <SlidersHorizontal size={15}/> Buka kalibrasi proyektor</button>
      <p className="fp-stage-hint"><ShieldAlert size={14}/> Blackout browser belum menggantikan pemutus daya proyektor fisik.</p>
     </>}
    </div>
   </aside>
  </div>
  <footer className="fp-stage-footer">
   <span><Video size={14}/> Gambar kamera diproses di perangkat ini.</span>
   <span><ShieldAlert size={14}/> Video mapping dan proyektor fisik membutuhkan kalibrasi dan QA.</span>
   <button type="button" onClick={onBlackout}><Pause size={13}/> Blackout Studio</button>
  </footer>
 </section>;
}
