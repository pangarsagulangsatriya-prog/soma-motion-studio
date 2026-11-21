import {useEffect,useRef,useState,useSyncExternalStore,type RefObject} from 'react';
import {
 ArrowRight,RotateCcw,ShieldAlert,Target
} from 'lucide-react';
import type {MotionFrame} from '../../engine/types.ts';
import type {Quad} from '../../projection/geometry.ts';
import type {Projection} from '../../projection/useProjection.ts';
import {cameraBinding,type LiveFloorTrackingEngine} from '../live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../live/MultiPoseGaitRouter.ts';
import {defaultFloorSpace,validateCameraFloorCalibration} from '../spatial/coordinates.ts';
import type {FootMotionEventV2} from '../scenes/FootMotionEventV2.ts';
import {STAGE_BLACKOUT_EVENT} from './StageBlackout.ts';
import {type PreviewView} from './projectorWysiwygModel.ts';
import {shouldLatchProjectionBlackout} from '../../studio/v3/safeProjectionPreflight.ts';
import {SURFACE_TARGETS,defaultStageSurfacePlan,stageSurfaceSignature,
 assessSurfaceProof,emptySurfaceProof,recordSurfaceSample,validateStageSurfacePlan,
 type StageSurface,type StageSurfacePlan,type SurfaceProof,type StageOutputContext}
 from './DualSurfaceCalibration.ts';
import {
 DUAL_SURFACE_IDS,STAGE_HARDWARE_ENABLED,
 getDualSurfacePorts,getDualSurfaceState,getDualSurfaceTestCanvases,
 patchDualSurfaceState,subscribeDualSurface,syncDualSurfaceRuntime,
 urgentBlackoutDualSurface,blackoutAllDualSurfaces,
 type RequestedMode,type StageRouteInput
} from './DualSurfaceSessionStore.ts';
import './dual-surface-routing.css';
import {MapWysiwygWorkspace} from '../../studio/v3/MapWysiwygWorkspace.tsx';
import {moveMapCorner,type MapCornerIndex} from '../../studio/v3/mapCornerModel.ts';
import {
 DEFAULT_STAGE_DIMENSIONS,STAGE_DIMENSION_PRESETS,clampStageDimensions,createDefaultMapSim,
 deriveMapStageStatus,moveMapSimPerformer,stepMapSimState,
 type MapSimState,type MapStageDimensions
} from '../../studio/v3/mapStageModel.ts';

export type {StageRouteInput};

const ids=DUAL_SURFACE_IDS;
type Requested=RequestedMode;

type Props={
 frameRef:RefObject<StageRouteInput|null>;
 bodyCanvas:RefObject<HTMLCanvasElement|null>;
 floorCanvas:RefObject<HTMLCanvasElement|null>;
 legacyProjection:Projection;
 experimentLocked?:boolean;
 liquidCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
 videoRef?:RefObject<HTMLVideoElement|null>;
 motionFrameRef?:RefObject<MotionFrame>;
 floorTracker?:LiveFloorTrackingEngine;
 router?:MultiPoseGaitRouter;
 motionEvents?:()=>readonly FootMotionEventV2[];
 cameraOn?:boolean;
 floorReady?:boolean;
 performerCount?:1|2;
 identitySafe?:boolean;
 experimentSource?:'video'|'simulator'|null;
 onEnterPerform?:()=>void;
 onOpenTrack?:()=>void;
 onOpenCompose?:()=>void;
};

export function DualSurfaceRoutingPanel({
 frameRef,bodyCanvas,floorCanvas,legacyProjection,experimentLocked=false,
 liquidCanvas,experimentInputCanvas,videoRef,motionFrameRef,floorTracker,router,motionEvents,
 cameraOn=false,floorReady=false,performerCount=2,identitySafe=true,experimentSource=null,
 onEnterPerform,onOpenTrack,onOpenCompose
}:Props){
 // Keep shouldLatchProjectionBlackout referenced here and enforced in DualSurfaceSessionStore.
 void shouldLatchProjectionBlackout;
 const session=useSyncExternalStore(subscribeDualSurface,getDualSurfaceState,getDualSurfaceState);
 const ports=getDualSurfacePorts();
 const testCanvasesRef=useRef<Record<StageSurface,HTMLCanvasElement>|null>(getDualSurfaceTestCanvases());
 testCanvasesRef.current=getDualSurfaceTestCanvases();
 const legacyRef=useRef(legacyProjection);legacyRef.current=legacyProjection;

 const {plans,proofs,requested,epoch,target,selected,message,devices,operatorConfirm,previewView}=session;

 const setPlans=(updater:Record<StageSurface,StageSurfacePlan>|((prev:Record<StageSurface,StageSurfacePlan>)=>Record<StageSurface,StageSurfacePlan>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().plans):updater;
  patchDualSurfaceState({plans:next});
 };
 const setProofs=(updater:Record<StageSurface,SurfaceProof|null>|((prev:Record<StageSurface,SurfaceProof|null>)=>Record<StageSurface,SurfaceProof|null>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().proofs):updater;
  patchDualSurfaceState({proofs:next});
 };
 const setRequested=(updater:Record<StageSurface,Requested>|((prev:Record<StageSurface,Requested>)=>Record<StageSurface,Requested>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().requested):updater;
  patchDualSurfaceState({requested:next});
 };
 const setArmed=(updater:Record<StageSurface,boolean>|((prev:Record<StageSurface,boolean>)=>Record<StageSurface,boolean>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().armed):updater;
  patchDualSurfaceState({armed:next});
 };
 const setEpoch=(updater:Record<StageSurface,number>|((prev:Record<StageSurface,number>)=>Record<StageSurface,number>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().epoch):updater;
  patchDualSurfaceState({epoch:next});
 };
 const setTarget=(updater:Record<StageSurface,string>|((prev:Record<StageSurface,string>)=>Record<StageSurface,string>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().target):updater;
  patchDualSurfaceState({target:next});
 };
 const setSelected=(next:StageSurface)=>patchDualSurfaceState({selected:next});
 const setMessage=(next:string)=>patchDualSurfaceState({message:next});
 const setOperatorConfirm=(next:boolean)=>patchDualSurfaceState({operatorConfirm:next});
 const setPreviewView=(next:PreviewView)=>patchDualSurfaceState({previewView:next});

 const [dx,setDx]=useState(''),[dy,setDy]=useState('');
 // Calibration-first state: handles ready immediately on Map open
 const [monitorView,setMonitorView]=useState<'stage'>('stage');
 const editingCorners=true;
 const [activeCorner,setActiveCorner]=useState<MapCornerIndex>(0);
 const snapEnabled=true;
 const [resetArmed,setResetArmed]=useState(false);
 const [stageDimensions,setStageDimensions]=useState<MapStageDimensions>(()=>floorTracker?.floor?{widthM:floorTracker.floor.widthM,depthM:floorTracker.floor.depthM}:DEFAULT_STAGE_DIMENSIONS);
 const [simState,setSimState]=useState<MapSimState>(createDefaultMapSim);
 const hasLiveSource=Boolean(cameraOn||experimentSource);
 const sourceKind:'camera'|'video'|'simulator'|'demo-sim'|'none'=
  experimentSource==='video'?'video'
  :experimentSource==='simulator'?'simulator'
  :cameraOn?'camera'
  :simState.active?'demo-sim'
  :'none';

 useEffect(()=>{
  if(!simState.active||!simState.playing||hasLiveSource)return;
  let last=performance.now();
  const timer=window.setInterval(()=>{
   const now=performance.now();
   const dt=now-last;
   last=now;
   setSimState(prev=>stepMapSimState(prev,dt));
  },40);
  return()=>window.clearInterval(timer);
 },[simState.active,simState.playing,hasLiveSource]);

 useEffect(()=>{
  syncDualSurfaceRuntime({frameRef,bodyCanvas,floorCanvas,legacyProjection,experimentLocked});
 },[frameRef,bodyCanvas,floorCanvas,legacyProjection,experimentLocked]);

 useEffect(()=>{setResetArmed(false);},[selected]);

 const context=(id:StageSurface,plan=plans[id],output=devices[id]):StageOutputContext=>{
  const stage=frameRef.current;
  return {cameraBinding:stage?.cameraKey??null,floorContext:stage?.floorKey??null,
   windowSession:epoch[id]>0?ports[id].id+':'+epoch[id]:'',
   viewport:output.viewport};
 };
 const signature=(id:StageSurface)=>stageSurfaceSignature(plans[id],context(id));
 const assessment=(id:StageSurface)=>assessSurfaceProof(plans[id],signature(id),proofs[id]);

 const urgentBlackout=(id:StageSurface)=>{
  urgentBlackoutDualSurface(id);
 };
 const editPlan=(id:StageSurface,fn:(p:StageSurfacePlan)=>StageSurfacePlan)=>{
  try{
   const next=validateStageSurfacePlan(fn(getDualSurfaceState().plans[id]));
   urgentBlackout(id);
   setPlans(prev=>({...prev,[id]:next}));
   setRequested(prev=>({...prev,[id]:'blackout'}));
   setArmed(prev=>({...prev,[id]:false}));
   setMessage('Kalibrasi '+id.toUpperCase()+' diperbarui. Output kembali ke Blackout hingga uji fisik selesai.');
  }catch(e){setMessage(e instanceof Error?e.message:'Kalibrasi tidak valid.');}
 };

 const changeRoomSize=(size:MapStageDimensions)=>{
  const next=clampStageDimensions(size);
  if(next.widthM===stageDimensions.widthM&&next.depthM===stageDimensions.depthM)return;
  allBlackout();
  setProofs({body:null,floor:null});
  setRequested({body:'blackout',floor:'blackout'});
  setArmed({body:false,floor:false});
  if(floorTracker?.isCalibrated)floorTracker.revoke('Ukuran lantai berubah di Map. Tandai ulang lantai pada gambar kamera.');
  setStageDimensions(next);
  setMessage('Ukuran lantai diubah. Tandai ulang bidang pada kamera sebelum menguji proyektor.');
 };
 const commitMonitorQuad=(quad:Quad)=>{
  try{
   validateStageSurfacePlan({...getDualSurfaceState().plans[selected],projectorQuad:quad});
   setResetArmed(false);
   editPlan(selected,p=>({...p,projectorQuad:quad}));
  }catch(e){setMessage(e instanceof Error?e.message:'Quad tidak valid.');}
 };

 const resetMonitorQuad=()=>{
  if(!resetArmed){
   setResetArmed(true);
   return;
  }
  setResetArmed(false);
  editPlan(selected,p=>({...p,projectorQuad:defaultStageSurfacePlan(selected).projectorQuad}));
 };

 const open=(id:StageSurface)=>{
  if(!STAGE_HARDWARE_ENABLED){
   setMessage('Output proyektor fisik terkunci pada rilis Production. Gunakan preview lokal untuk QA.');
   return;
  }
  if(!operatorConfirm){setMessage('Konfirmasi terlebih dahulu bahwa area cahaya aman dan diawasi.');return;}
  legacyRef.current.setTransport('blackout');
  legacyRef.current.closeOutput();
  ids.forEach(urgentBlackout);
  setRequested({body:'blackout',floor:'blackout'});
  setArmed({body:false,floor:false});
  if(ports[id].opened&&!ports[id].connected)ports[id].closeOutput();
  const opened=ports[id].open(id);
  if(opened){
   setEpoch(prev=>({...prev,[id]:prev[id]+1}));
   setProofs(prev=>({...prev,[id]:null}));
   setMessage('Jendela '+id.toUpperCase()+' dibuka dalam Blackout. Pindahkan ke layar proyektor lalu tekan F.');
  }else setMessage(ports[id].error||'Browser memblokir jendela proyeksi.');
 };
 const allBlackout=()=>{
  ids.forEach(urgentBlackout);
  blackoutAllDualSurfaces('Dua output diperintah Blackout. Periksa cahaya proyektor secara fisik.');
 };
 useEffect(()=>{
  const external=()=>allBlackout();
  window.addEventListener(STAGE_BLACKOUT_EVENT,external);
  return()=>window.removeEventListener(STAGE_BLACKOUT_EVENT,external);
 },[]);

 const changeMode=(id:StageSurface,mode:Requested)=>{
  if(!STAGE_HARDWARE_ENABLED&&mode!=='blackout'){
   urgentBlackout(id);
   setMessage('Build Production ini belum mengizinkan output fisik.');
   return;
  }
  if(mode==='blackout')urgentBlackout(id);
  if(mode==='live'){
   if(!operatorConfirm||assessment(id).status!=='within-provisional-target'){
    setMessage('Live memerlukan kelima pengukuran, uji Blackout, pemeriksa, dan izin manual.');
    return;
   }
   setArmed(prev=>({...prev,[id]:true}));
  }else setArmed(prev=>({...prev,[id]:false}));
  setRequested(prev=>({...prev,[id]:mode}));
  setMessage(mode==='test'?'Uji optik '+id.toUpperCase()+' dimulai dengan gambar terbatas.':
   mode==='live'?'Live '+id.toUpperCase()+' diminta; engine tetap memeriksa frame dan QA pada setiap kiriman.':
    'Blackout '+id.toUpperCase()+' aktif.');
 };

 const triggerProjectorTest=()=>{
  const dev=devices[selected];
  if(!dev.connected){open(selected);return;}
  if(dev.mode==='test'){changeMode(selected,'blackout');return;}
  changeMode(selected,'test');
 };

 const ensureProof=():SurfaceProof|null=>{
  const sig=signature(selected);
  if(!sig){setMessage('Hubungkan output '+selected.toUpperCase()+' dan pastikan kamera/lantai terkalibrasi.');return null;}
  const previous=proofs[selected];
  return previous&&previous.signature===sig?previous:emptySurfaceProof(plans[selected],sig);
 };
 const updateProof=(fn:(p:SurfaceProof)=>SurfaceProof)=>{
  const base=ensureProof();if(!base)return;
  try{
   const updated=fn(base);
   urgentBlackout(selected);
   setProofs(prev=>({...prev,[selected]:updated}));
   setRequested(prev=>({...prev,[selected]:'blackout'}));
   setArmed(prev=>({...prev,[selected]:false}));
  }catch(e){setMessage(e instanceof Error?e.message:'Bukti QA tidak valid.');}
 };
 const addSample=()=>{
  if(!dx.trim()||!dy.trim())return setMessage('Isi selisih X dan Y dalam sentimeter.');
  updateProof(proof=>recordSurfaceSample(proof,target[selected],Number(dx),Number(dy)));
  setDx('');setDy('');
 };
 const signOff=()=>{
  updateProof(p=>{
   if(!p.reviewer.trim()||p.samples.length<5||!Object.values(p.checklist).every(Boolean))
    throw Error('Lengkapi lima titik, checklist optik, dan nama pemeriksa.');
   return {...p,completedAt:new Date().toISOString()};
  });
  setMessage('Pengukuran dicatat sebagai bukti operator, bukan verifikasi otomatis cahaya.');
 };
 const handleEnterPerform=()=>{
  if(devices.floor.mode==='test'||requested.floor==='test')changeMode('floor','blackout');
  if(devices.body.mode==='test'||requested.body==='test')changeMode('body','blackout');
  onEnterPerform?.();
 };

 const activePlan=plans[selected],proof=proofs[selected],qa=assessment(selected);
 const qaBadge=qa.status==='within-provisional-target'?'Lulus sementara ('+qa.count+'/5)':
  qa.status==='needs-adjustment'?'Perlu koreksi ('+qa.count+'/5)':'Belum lengkap ('+qa.count+'/5)';
 const dominantStatus=deriveMapStageStatus({
  source:sourceKind,
  cameraOn,
  floorCalibrated:floorReady,
  hardwareEnabled:STAGE_HARDWARE_ENABLED,
  experimentLocked,
  operatorConfirm,
  outputConnected:devices[selected].connected,
  outputMode:devices[selected].mode,
  qa,
  selected
 });
 const projectorTestDisabled=!STAGE_HARDWARE_ENABLED||!operatorConfirm;
 const projectorTestLabel=
  devices[selected].mode==='test'?'Hentikan uji':
  devices[selected].connected?'Uji pola proyektor':'Buka output';

 return <section className="stage-dual map-r2-shell" aria-label="Map — kalibrasi ruang dan uji proyektor">
  {/* Track-matching single top header bar */}
  <header className="map-r2-topbar">
   <div className="map-r2-brand">
    <h2>Map</h2>
    <div className="map-r2-status-inline map-r7-status" data-status={dominantStatus.id}
     role="status" aria-label={dominantStatus.sourceLabel+' · '+dominantStatus.label}
     title={dominantStatus.sourceLabel+' · '+dominantStatus.label}>
     <span className="map-r7-status-dot" aria-hidden="true"/>
     <strong>{dominantStatus.label}</strong>
    </div>
   </div>
   <div className="map-r2-top-right">
 <details className="soma-map-v2-room" aria-label="Ubah ukuran ruang">
  <summary>{stageDimensions.widthM} × {stageDimensions.depthM} m</summary>
  <div className="soma-map-v2-room-options">
   {STAGE_DIMENSION_PRESETS.map(preset=><button type="button" key={preset.id}
    aria-pressed={stageDimensions.widthM===preset.widthM&&stageDimensions.depthM===preset.depthM}
    onClick={()=>changeRoomSize({widthM:preset.widthM,depthM:preset.depthM})}>{preset.label}</button>)}
   <label>Lebar (m)<input type="number" min={1} max={20} step={.5}
    value={stageDimensions.widthM}
    onChange={e=>changeRoomSize({...stageDimensions,widthM:Number(e.target.value)})}/></label>
   <label>Dalam (m)<input type="number" min={1} max={20} step={.5}
    value={stageDimensions.depthM}
    onChange={e=>changeRoomSize({...stageDimensions,depthM:Number(e.target.value)})}/></label>
  </div>
 </details>
    <div className="stage-dual-surface-tabs" role="group" aria-label="Pilih bidang kalibrasi">
     <button type="button" aria-pressed={selected==='floor'} onClick={()=>{setSelected('floor');setDx('');setDy('');}}>Lantai</button>
     <button type="button" aria-pressed={selected==='body'}
      title="Satu output BODY mencakup mask tubuh bawah Performer A dan B."
      onClick={()=>{setSelected('body');setDx('');setDy('');}}>Tubuh</button>
    </div>
   </div>
  </header>

  <main className="soma-map-v2-main">
 <MapWysiwygWorkspace selected={selected} stageDimensions={stageDimensions} plan={activePlan}
  sourceKind={sourceKind} hasLiveSource={hasLiveSource}
  videoRef={videoRef} motionFrameRef={motionFrameRef} experimentInputCanvas={experimentInputCanvas} floorTracker={floorTracker}
  floorCanvas={floorCanvas} bodyCanvas={bodyCanvas} liquidCanvas={liquidCanvas}
  simState={simState}
  onStartSim={()=>{setSimState(prev=>({...prev,active:true,playing:true}));setMessage('Simulasi jejak berjalan di Map.');}}
  onStopSim={()=>{setSimState(prev=>({...prev,active:false,playing:false}));setMessage('Simulasi berhenti.');}}
  onToggleSimPlay={()=>setSimState(prev=>({...prev,playing:!prev.playing}))}
  onBeginCameraEdit={()=>{
   allBlackout();setProofs({body:null,floor:null});
   setRequested({body:'blackout',floor:'blackout'});setArmed({body:false,floor:false});
   if(floorTracker?.isCalibrated)floorTracker.revoke('Bidang kamera berubah. Terapkan ulang empat sudut.');
   router?.reset();
  }}
  onBeginProjectorEdit={()=>{
   allBlackout();setProofs({body:null,floor:null});
   setRequested({body:'blackout',floor:'blackout'});setArmed({body:false,floor:false});
  }}
  onCommitCameraQuad={quad=>{
   try{
    const binding=cameraBinding(videoRef?.current??null);
    if(!binding||!floorTracker)throw Error('Hubungkan kamera aktif di Track sebelum menerapkan bidang.');
    const config=validateCameraFloorCalibration({
     schema:'soma.footprints.camera-floor',version:1,
     floor:defaultFloorSpace(stageDimensions.widthM,stageDimensions.depthM),cameraQuad:quad
    });
    allBlackout();
    floorTracker.configure(config,binding);floorTracker.confirm(true);
    router?.reset();
    setProofs({body:null,floor:null});
    setRequested({body:'blackout',floor:'blackout'});setArmed({body:false,floor:false});
    setMessage('Bidang kamera disimpan. Uji output fisik perlu diulang.');
    return {ok:true,message:'Bidang kamera tersimpan. Coba gerakkan kaki di lantai.'};
   }catch(err){return {ok:false,message:err instanceof Error?err.message:'Titik kamera belum valid.'};}
  }}
  onOpenTrack={()=>onOpenTrack?.()} onOpenCompose={()=>onOpenCompose?.()}
  onSourceLost={()=>{
   allBlackout();setProofs({body:null,floor:null});
   setRequested({body:'blackout',floor:'blackout'});
   setArmed({body:false,floor:false});
   if(floorTracker?.isCalibrated)floorTracker.revoke('Kamera terputus. Periksa ulang bidang lantai.');
   router?.reset();setMessage('Sumber kamera terputus. Buka Track untuk menyambungkan kembali.');
  }}
  onCommitProjectorQuad={commitMonitorQuad} onMessage={setMessage}
 />
</main>
<div className="soma-map-v2-foot">
 {STAGE_HARDWARE_ENABLED&&<details className="map-r2-step map-r7-qa-step map-r8-projector-setup">
     <summary className="map-r2-step-head">
      <span className="map-r2-step-num">3</span>
      <strong>Uji proyektor fisik</strong>
     </summary>
     <label className="stage-dual-check map-r7-safety-check" title="Pastikan cahaya tidak mengenai mata/wajah; operator siap menjalankan Blackout fisik.">
      <input type="checkbox" disabled={!STAGE_HARDWARE_ENABLED} checked={operatorConfirm}
       aria-label="Area aman dari sorot mata/wajah; operator siap Blackout fisik"
       onChange={e=>{setOperatorConfirm(e.target.checked);if(!e.target.checked)allBlackout();}}/>
      <span>Area aman <small>Mata/wajah · Blackout siap</small></span>
     </label>
     <div className="map-r2-test-row">
      <button type="button" className="map-r2-test-btn" disabled={projectorTestDisabled}
       onClick={triggerProjectorTest}>
       <Target size={12}/> {projectorTestLabel}
      </button>
     </div>
     {STAGE_HARDWARE_ENABLED&&operatorConfirm&&devices[selected].connected&&
      <p className="map-r7-output-hint" role="status">
       {qa.status==='within-provisional-target'?'QA selesai · lanjut Perform':'Uji cahaya lalu lengkapi QA'}
      </p>}

     <details className="stage-dual-qa-disclosure">
      <summary title={'QA Fisik 5 Titik · '+qaBadge} aria-label={'QA Fisik 5 Titik · '+(selected==='floor'?'Lantai':'Tubuh')+' · '+qaBadge}>
        <ShieldAlert size={13}/><span>QA fisik</span><span className="map-r7-qa-count">{qa.count}/5</span>
       </summary>
      <div className="stage-dual-qa">
       <p title="Catat ΔX dan ΔY dari tanda fisik di panggung. Sistem tidak mengukur cahaya secara otomatis.">Selisih cahaya terukur, dalam cm.</p>
       <label>Titik uji ({selected.toUpperCase()})
        <select value={target[selected]} onChange={e=>setTarget(prev=>({...prev,[selected]:e.target.value}))}>
         {SURFACE_TARGETS[selected].map(t=><option key={t.id} value={t.id}>{t.id} · {t.label}</option>)}
        </select></label>
       <div className="stage-dual-measure">
        <label>ΔX (cm)<input type="number" step=".1" value={dx} onChange={e=>setDx(e.target.value)} placeholder="0.0"/></label>
        <label>ΔY (cm)<input type="number" step=".1" value={dy} onChange={e=>setDy(e.target.value)} placeholder="0.0"/></label>
        <button type="button" onClick={addSample}>Simpan titik</button>
       </div>
       <p className="map-r7-output-hint">{qa.count}/5 titik diperiksa</p>
       <label>Nama pemeriksa
        <input type="text" value={proof?.signature===signature(selected)?proof.reviewer:''}
         onChange={e=>updateProof(p=>({...p,reviewer:e.target.value.slice(0,120),completedAt:null}))}
         placeholder="nama pemeriksa fisik"/></label>
       {([
        ['fixedOptics','Posisi kamera, lensa dan rig tetap selama pengukuran'],
        ['blackoutObserved','Blackout sungguh memadamkan cahaya pada perangkat'],
        ['noUnsafeSpill','Cahaya tidak menyentuh wajah/mata/penonton; oklusi telah diperiksa']
       ] as const).map(([field,label])=><label key={field} className="stage-dual-check">
        <input type="checkbox" checked={proof?.signature===signature(selected)?proof.checklist[field]:false}
         onChange={e=>updateProof(p=>({...p,checklist:{...p.checklist,[field]:e.target.checked},
          completedAt:null}))}/>{label}</label>)}
       <div className="stage-dual-qa-actions">
        <button type="button" onClick={signOff}>Selesaikan QA manual</button>
        
       </div>
       <details className="map-r7-qa-result">
         <summary>Detail hasil QA</summary>
         <p>Status: <b>{qa.status}</b>. {qa.missing.join(' ')}</p>
        </details>
      </div>
     </details>
     
    </details>}
 {onEnterPerform&&<button type="button" className="map-r7-perform-cta"
  onClick={handleEnterPerform} title="Buka ruang Perform">
  Lanjut Perform <ArrowRight size={13}/>
 </button>}
</div>
 {message&&<footer className="map-r2-footer map-r7-footer" role="status"
    aria-label={message} title={message}>
    <span className="map-r7-feedback-dot" aria-hidden="true"/>
    <span className="map-r2-blocker">
     {message.includes('Dua output diperintah Blackout')?'Blackout aktif':message}
    </span>
   </footer>}
 </section>;
}
