import {useEffect,useRef,useState,useSyncExternalStore,type RefObject} from 'react';
import {
 ArrowDown,ArrowLeft,ArrowRight,ArrowUp,Crosshair,Download,Grid2x2,
 Redo2,RotateCcw,ShieldAlert,SlidersHorizontal,Square,Target,Undo2
} from 'lucide-react';
import type {MotionFrame} from '../../engine/types.ts';
import type {Quad} from '../../projection/geometry.ts';
import type {Projection} from '../../projection/useProjection.ts';
import type {LiveFloorTrackingEngine} from '../live/LiveFloorTrackingEngine.ts';
import type {FootMotionEventV2} from '../scenes/FootMotionEventV2.ts';
import {download} from '../../engine/recording.ts';
import {STAGE_BLACKOUT_EVENT} from './StageBlackout.ts';
import {ProjectorWysiwygPreview} from './ProjectorWysiwygPreview.tsx';
import {type PreviewView} from './projectorWysiwygModel.ts';
import {shouldLatchProjectionBlackout} from '../../studio/v3/safeProjectionPreflight.ts';
import {startSetupBench,readSetupStart,finishSetupBench,FIRST_SETUP_TARGET_MS}
 from '../../studio/v3/safeProjectionBench.ts';
import {loadStageOutputDrafts,saveStageOutputDraft,stableStageEquipmentKey,
 matchingStageOutputDraft,type StageOutputDraft} from '../../studio/v3/stageOutputDraftProfiles.ts';
import {SURFACE_TARGETS,defaultStageSurfacePlan,stageSurfaceSignature,stageSurfaceReport,
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
import {MapFourCornerEditor} from '../../studio/v3/MapFourCornerEditor.tsx';
import {MapStageMonitor,type MapMonitorView} from '../../studio/v3/MapStageMonitor.tsx';
import {moveMapCorner,type MapCornerIndex} from '../../studio/v3/mapCornerModel.ts';
import {
 DEFAULT_STAGE_DIMENSIONS,STAGE_DIMENSION_PRESETS,clampStageDimensions,createDefaultMapSim,
 deriveMapStageStatus,emptyQuadHistory,moveMapSimPerformer,pushQuadHistory,
 redoQuadHistory,stepMapSimState,undoQuadHistory,
 type MapQuadHistory,type MapSimState,type MapStageDimensions
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
 motionEvents?:()=>readonly FootMotionEventV2[];
 cameraOn?:boolean;
 floorReady?:boolean;
 performerCount?:1|2;
 identitySafe?:boolean;
 experimentSource?:'video'|'simulator'|null;
 onOpenCameraCalibration?:()=>void;
 onEnterPerform?:()=>void;
};

const labels:{[K in StageSurface]:string}={body:'BODY · proyeksi tubuh',floor:'FLOOR · proyeksi lantai'};
const CORNER_TAGS=['1 TL','2 TR','3 BR','4 BL'] as const;

function detectDisplayStatus():{extended:boolean|null;label:string}{
 if(typeof window==='undefined'||!('screen' in window))
  return {extended:null,label:'Deteksi layar tidak tersedia di browser ini. Buka output → pindahkan ke layar proyektor → tekan F untuk fullscreen.'};
 const scr=window.screen as Screen&{isExtended?:boolean};
 if(typeof scr.isExtended==='boolean'){
  return scr.isExtended
   ?{extended:true,label:'Layar ganda terdeteksi. Klik Buka output → geser ke layar proyektor → tekan F untuk fullscreen.'}
   :{extended:false,label:'Hanya 1 layar terdeteksi. Sambungkan proyektor (mode Extended), lalu klik Buka output dan tekan F.'};
 }
 return {extended:null,label:'Deteksi layar otomatis tidak didukung browser ini. Klik Buka output → pindahkan ke proyektor → tekan F.'};
}

export function DualSurfaceRoutingPanel({
 frameRef,bodyCanvas,floorCanvas,legacyProjection,experimentLocked=false,
 liquidCanvas,experimentInputCanvas,videoRef,motionFrameRef,floorTracker,motionEvents,
 cameraOn=false,floorReady=false,performerCount=2,identitySafe=true,experimentSource=null,
 onOpenCameraCalibration,onEnterPerform
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
 const [savedDrafts,setSavedDrafts]=useState<StageOutputDraft[]>(()=>{
  try{return loadStageOutputDrafts(localStorage);}catch{return [];}
 });
 const [draftName,setDraftName]=useState('Panggung Utama');
 const [draftId,setDraftId]=useState('');
 const [benchObserved,setBenchObserved]=useState(false);
 const [benchNotes,setBenchNotes]=useState('');
 const [benchResult,setBenchResult]=useState('');
 const [displayInfo,setDisplayInfo]=useState(detectDisplayStatus);

 // Calibration-first state: handles ready immediately on Map open
 const [monitorView,setMonitorView]=useState<MapMonitorView>('stage');
 const sourceFirstShown=useRef(false);
 const [editingCorners,setEditingCorners]=useState(true);
 const [activeCorner,setActiveCorner]=useState<MapCornerIndex>(0);
 const [snapEnabled,setSnapEnabled]=useState(true);
 const [resetArmed,setResetArmed]=useState(false);
 const [stageDimensions,setStageDimensions]=useState<MapStageDimensions>(DEFAULT_STAGE_DIMENSIONS);
 const [simState,setSimState]=useState<MapSimState>(createDefaultMapSim);
 const [quadHistory,setQuadHistory]=useState<Record<StageSurface,MapQuadHistory>>({
  body:emptyQuadHistory(),
  floor:emptyQuadHistory()
 });

 const hasLiveSource=Boolean(cameraOn||experimentSource);
 // When a real input becomes ready, show it beside the projected room first.
 useEffect(()=>{
  if(hasLiveSource&&!sourceFirstShown.current){
   sourceFirstShown.current=true;
   setMonitorView('align');
  }else if(!hasLiveSource)sourceFirstShown.current=false;
 },[hasLiveSource]);
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

 useEffect(()=>{
  const refresh=()=>setDisplayInfo(detectDisplayStatus());
  window.addEventListener('resize',refresh);
  return()=>window.removeEventListener('resize',refresh);
 },[]);

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

 const commitMonitorQuad=(quad:Quad)=>{
  const prevQuad=getDualSurfaceState().plans[selected].projectorQuad;
  try{
   validateStageSurfacePlan({...getDualSurfaceState().plans[selected],projectorQuad:quad});
   setQuadHistory(prev=>({...prev,[selected]:pushQuadHistory(prev[selected],prevQuad)}));
   setResetArmed(false);
   editPlan(selected,p=>({...p,projectorQuad:quad}));
  }catch(e){setMessage(e instanceof Error?e.message:'Quad tidak valid.');}
 };

 const nudgeActiveCorner=(dxStep:number,dyStep:number)=>{
  const q=plans[selected].projectorQuad;
  const p=q[activeCorner];
  const next=moveMapCorner(q,activeCorner,{
   x:Math.min(1,Math.max(0,Number((p.x+dxStep).toFixed(4)))),
   y:Math.min(1,Math.max(0,Number((p.y+dyStep).toFixed(4))))
  });
  commitMonitorQuad(next);
 };

 const undoMonitorQuad=()=>{
  const res=undoQuadHistory(quadHistory[selected],plans[selected].projectorQuad);
  if(!res)return;
  setQuadHistory(prev=>({...prev,[selected]:res.history}));
  setResetArmed(false);
  editPlan(selected,p=>({...p,projectorQuad:res.quad}));
 };

 const redoMonitorQuad=()=>{
  const res=redoQuadHistory(quadHistory[selected],plans[selected].projectorQuad);
  if(!res)return;
  setQuadHistory(prev=>({...prev,[selected]:res.history}));
  setResetArmed(false);
  editPlan(selected,p=>({...p,projectorQuad:res.quad}));
 };

 const resetMonitorQuad=()=>{
  if(!resetArmed){
   setResetArmed(true);
   return;
  }
  const prevQuad=plans[selected].projectorQuad;
  setQuadHistory(prev=>({...prev,[selected]:pushQuadHistory(prev[selected],prevQuad)}));
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
 const close=(id:StageSurface)=>{
  urgentBlackout(id);
  ports[id].closeOutput();
  setRequested(prev=>({...prev,[id]:'blackout'}));
  setArmed(prev=>({...prev,[id]:false}));
  setMessage('Output '+id.toUpperCase()+' ditutup.');
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
 const saveOutputDraft=()=>{
  const key=stableStageEquipmentKey(frameRef.current?.cameraKey??null,
   frameRef.current?.floorKey??null);
  if(!key){setMessage('Aktifkan kamera, mask dan profil lantai sebelum menyimpan draf optik.');return;}
  const name=draftName.trim().slice(0,100);
  if(!name){setMessage('Isi nama profil output.');return;}
  const existing=savedDrafts.find(p=>p.id===draftId);
  const id=existing?.id??('output-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  try{
   const next=saveStageOutputDraft(localStorage,{
    schema:'soma.stage-output-draft',version:1,id,name,
    equipmentKey:key,updatedAt:new Date().toISOString(),
    plans:{body:plans.body,floor:plans.floor}
   });
   setSavedDrafts(next);setDraftId(id);
   setMessage('Draf optik tersimpan lokal. QA dan izin fisik tidak ikut disimpan.');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal menyimpan draf output.');}
 };
 const applyOutputDraft=()=>{
  const draft=savedDrafts.find(p=>p.id===draftId);
  const key=stableStageEquipmentKey(frameRef.current?.cameraKey??null,
   frameRef.current?.floorKey??null);
  if(!draft||!matchingStageOutputDraft(draft,key)){
   setMessage('Profil tidak cocok dengan kamera, resolusi, performer atau kalibrasi lantai.');
   return;
  }
  ids.forEach(urgentBlackout);
  const next={body:draft.plans.body,floor:draft.plans.floor};
  setPlans(next);setProofs({body:null,floor:null});
  setRequested({body:'blackout',floor:'blackout'});
  setArmed({body:false,floor:false});
  setDraftName(draft.name);
  setMessage('Draf BODY/FLOOR dimuat. Keduanya BLACKOUT. Ulangi QA lima titik.');
 };
 const removeOutputDraft=()=>{
  if(!draftId)return;
  try{
   const remaining=savedDrafts.filter(d=>d.id!==draftId);
   localStorage.setItem('soma-stage-output-drafts-v1',JSON.stringify(remaining));
   setSavedDrafts(remaining);setDraftId('');
   setMessage('Profil lokal dihapus. Kalibrasi aktif tidak berubah.');
  }catch{setMessage('Penyimpanan lokal tidak tersedia.');}
 };
 const beginBench=()=>{
  try{
   const started=startSetupBench(sessionStorage,Date.now(),true);
   setBenchObserved(false);setBenchResult('');
   setMessage(started?'Timer setup pertama dimulai. Ikuti persiapan proyeksi hingga efek terlihat.':
    'Browser tidak menyediakan penyimpanan sesi untuk timer.');
  }catch{setMessage('Timer sesi tidak tersedia.');}
 };
 const recordBench=()=>{
  try{
   if(devices.floor.mode!=='live'||assessment('floor').status!=='within-provisional-target')
    throw Error('Output FLOOR harus LIVE dan QA lima titik lulus.');
   const record=finishSetupBench({
    startStore:sessionStorage,resultsStore:localStorage,now:Date.now(),
    softwareLive:true,operatorObserved:benchObserved,notes:benchNotes
   });
   setBenchResult(
    Math.floor(record.elapsedMs/60000)+':'+Math.floor(record.elapsedMs%60000/1000).toString().padStart(2,'0')+
    (record.passedTarget?' · Target <10 menit: tercapai menurut laporan operator.':
     ' · Target <10 menit: belum tercapai.'));
   setMessage('Hasil UAT tersimpan lokal. Ini laporan operator, bukan pengukuran cahaya otomatis.');
  }catch(e){setMessage(e instanceof Error?e.message:'Uji setup belum bisa dicatat.');}
 };
 const exportReport=()=>{
  const result={schema:'soma.footprints.dual-surface-report',version:1,
   files:ids.map(id=>stageSurfaceReport(plans[id],proofs[id],context(id))),
   exportedAt:new Date().toISOString(),
   releaseApproved:false};
  download(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),
   'SOMA-S5-7-4-dual-surface-calibration.json');
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
 const activeHistory=quadHistory[selected];
 const projectorTestDisabled=!STAGE_HARDWARE_ENABLED||!operatorConfirm;
 const projectorTestLabel=
  devices[selected].mode==='test'?'Hentikan uji':
  devices[selected].connected?'Uji pola proyektor':'Buka output';
 const activeCornerPt=activePlan.projectorQuad[activeCorner];

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
    <div className="stage-dual-surface-tabs" role="group" aria-label="Pilih bidang kalibrasi">
     <button type="button" aria-pressed={selected==='floor'} onClick={()=>{setSelected('floor');setDx('');setDy('');}}>Lantai</button>
     <button type="button" aria-pressed={selected==='body'}
      title="Satu output BODY mencakup mask tubuh bawah Performer A dan B."
      onClick={()=>{setSelected('body');setDx('');setDy('');}}>Tubuh</button>
    </div>
    <button type="button" className="stage-dual-emergency map-r2-blackout" onClick={allBlackout}
     title="Padamkan proyektor Lantai dan Tubuh segera">
     <Square size={12}/> Blackout
    </button>
   </div>
  </header>

  {/* Track-aligned center-centric 2-column layout: Left Calibration Rail + Right-Center Calibration Monitor */}
  <div className="map-r2-workbench">
   <aside className="map-r2-rail" aria-label="Alur 3 langkah kalibrasi Map">
    <section className="map-r2-step">
     <div className="map-r2-step-head">
      <span className="map-r2-step-num">1</span>
      <strong>Ukuran ruang</strong>
     </div>
     <details className="map-r4-disclosure map-r4-room-extra">
      <summary className="map-r5-room-summary" aria-label="Ubah ukuran panggung">
       <b>{stageDimensions.widthM} × {stageDimensions.depthM} m</b><span>Ubah</span>
      </summary>
     <div className="map-r2-presets map-r4-main-presets" role="group" aria-label="Preset ukuran ruang panggung">
      {STAGE_DIMENSION_PRESETS.filter(preset=>['3x2','3x4','5x5'].includes(preset.id)).map(preset=>{
       const isMatch=stageDimensions.widthM===preset.widthM&&stageDimensions.depthM===preset.depthM;
       return <button type="button" key={preset.id} aria-pressed={isMatch}
        onClick={()=>{
         setStageDimensions({widthM:preset.widthM,depthM:preset.depthM});
         setMessage(`Ukuran ruang kalibrasi diatur ke ${preset.label}.`);
        }}>{preset.label}</button>;
      })}
     </div>
     <p className="map-r5-extra-size-title">Ukuran lain / kustom</p>
      <div className="map-r2-presets" role="group" aria-label="Ukuran ruang tambahan">
       {STAGE_DIMENSION_PRESETS.filter(preset=>!['3x2','3x4','5x5'].includes(preset.id)).map(preset=>{
        const isMatch=stageDimensions.widthM===preset.widthM&&stageDimensions.depthM===preset.depthM;
        return <button type="button" key={preset.id} aria-pressed={isMatch}
         onClick={()=>{
          setStageDimensions({widthM:preset.widthM,depthM:preset.depthM});
          setMessage(`Ukuran ruang kalibrasi diatur ke ${preset.label}.`);
         }}>{preset.label}</button>;
       })}
      </div>
      <div className="map-r2-dims" role="group" aria-label="Ukuran ruang kustom (meter)">
       <label>Lebar (m)
        <input type="number" min={1} max={20} step={0.5} value={stageDimensions.widthM}
         onChange={e=>setStageDimensions(prev=>clampStageDimensions({...prev,widthM:Number(e.target.value)}))}/>
       </label>
       <label>Dalam (m)
        <input type="number" min={1} max={20} step={0.5} value={stageDimensions.depthM}
         onChange={e=>setStageDimensions(prev=>clampStageDimensions({...prev,depthM:Number(e.target.value)}))}/>
       </label>
      </div>
     </details>
    </section>

    <section className="map-r2-step">
     <div className="map-r2-step-head">
      <span className="map-r2-step-num">2</span>
      <strong>Cocokkan sudut</strong>
     </div>

     <p className="map-r7-sr-only" id="map-corner-help">Tarik titik 1–4 di monitor. Pilih sudut untuk penyesuaian halus.</p>
     <details className="map-r4-disclosure map-r4-precision">
      <summary title="Geser halus, Snap, Undo, Redo, dan Reset"
        aria-label={'Penyetelan halus · titik '+(activeCorner+1)}>
        Presisi <span>Titik {activeCorner+1}</span>
       </summary>
     <div className="map-r2-corner-picks" role="group" aria-label="Pilih sudut aktif kalibrasi">
      {CORNER_TAGS.map((tag,idx)=><button type="button" key={tag}
       aria-pressed={activeCorner===idx}
       onClick={()=>{setActiveCorner(idx as MapCornerIndex);setEditingCorners(true);}}>
       {tag}
      </button>)}
     </div>
     <div className="map-r4-active-corner" role="status">
      <span>Titik {activeCorner+1}</span>
      <output className="map-r2-corner-readout">
       {(activeCornerPt.x*stageDimensions.widthM).toFixed(2)}m, {(activeCornerPt.y*stageDimensions.depthM).toFixed(2)}m
      </output>
     </div>
      <div className="map-r2-nudge-row">
       <div className="map-r2-nudge-pad" role="group" aria-label="Geser halus sudut aktif">
        <button type="button" aria-label="Geser sudut ke kiri" onClick={()=>nudgeActiveCorner(-0.005,0)}><ArrowLeft size={12}/></button>
        <button type="button" aria-label="Geser sudut ke atas" onClick={()=>nudgeActiveCorner(0,-0.005)}><ArrowUp size={12}/></button>
        <button type="button" aria-label="Geser sudut ke bawah" onClick={()=>nudgeActiveCorner(0,0.005)}><ArrowDown size={12}/></button>
        <button type="button" aria-label="Geser sudut ke kanan" onClick={()=>nudgeActiveCorner(0.005,0)}><ArrowRight size={12}/></button>
       </div>
       <span className="map-r4-nudge-hint">Langkah 0,5%</span>
      </div>
      <div className="map-r2-corner-actions" role="group" aria-label="Kontrol sudut proyektor">
       <button type="button" className="map-r2-primary-toggle" aria-pressed={editingCorners}
        onClick={()=>{
         const next=!editingCorners;
         setEditingCorners(next);
         if(next&&monitorView==='output')setMonitorView('stage');
        }}>
        <Crosshair size={12}/> {editingCorners?'Handle aktif':'Atur sudut'}
       </button>
       <button type="button" aria-pressed={snapEnabled} onClick={()=>setSnapEnabled(v=>!v)}
        title="Tempel sudut ke grid 5%">
        <Grid2x2 size={12}/> Snap
       </button>
       <button type="button" disabled={activeHistory.past.length===0} onClick={undoMonitorQuad}
        aria-label="Batalkan perubahan sudut" title="Undo">
        <Undo2 size={12}/>
       </button>
       <button type="button" disabled={activeHistory.future.length===0} onClick={redoMonitorQuad}
        aria-label="Ulangi perubahan sudut" title="Redo">
        <Redo2 size={12}/>
       </button>
       <button type="button" className={resetArmed?'map-r2-reset-armed':undefined} onClick={resetMonitorQuad}
        title="Kembalikan 4 sudut ke posisi awal">
        <RotateCcw size={12}/> {resetArmed?'Yakin?':'Reset'}
       </button>
      </div>
     </details>
     {cameraOn&&!floorReady&&onOpenCameraCalibration&&
      <button type="button" className="map-r2-link-action" onClick={onOpenCameraCalibration}>
       Kalibrasi kamera ke lantai di Track →
      </button>}
    </section>

    <section className="map-r2-step map-r7-qa-step">
     <div className="map-r2-step-head">
      <span className="map-r2-step-num">3</span>
      <strong>Uji proyektor</strong>
     </div>
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
     {!STAGE_HARDWARE_ENABLED&&
      <p className="map-r7-output-hint" role="status" title="Output fisik tidak tersedia pada build ini. Pratinjau software tetap bisa dipakai.">Pratinjau saja · output terkunci</p>}
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
       <div className="stage-dual-metrics">
        <span>Sampel <b>{qa.count}/5</b></span>
        <span>RMSE <b>{qa.rmseCm??'—'} cm</b></span>
        <span>P95 <b>{qa.p95Cm??'—'} cm</b></span>
        <span>Maks <b>{qa.maximumCm??'—'} cm</b></span>
       </div>
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
        <button type="button" onClick={exportReport}><Download size={13}/> Ekspor QA JSON</button>
       </div>
       <details className="map-r7-qa-result">
         <summary>Detail hasil QA</summary>
         <p>Status: <b>{qa.status}</b>. {qa.missing.join(' ')}</p>
        </details>
      </div>
     </details>
     {onEnterPerform&&<button type="button" className="map-r7-perform-cta"
      onClick={handleEnterPerform} title="Lanjutkan pengaturan LIVE di Perform">
      Lanjut Perform <ArrowRight size={13}/>
     </button>}
    </section>

    <details className="map-r2-advanced">
     <summary><SlidersHorizontal size={12}/> Teknis &amp; diagnostik</summary>
     <div className="map-r2-advanced-body">
     <details className="stage-dual-profile">
      <summary>Simpan profil ({savedDrafts.length})</summary>
      <p>Menyimpan geometri BODY/FLOOR untuk kamera dan lantai yang sama. QA 5 titik dan izin LIVE selalu diulang.</p>
      <label>Nama profil
       <input value={draftName} maxLength={100} onChange={e=>setDraftName(e.target.value)}/>
      </label>
      <button type="button" onClick={saveOutputDraft}>Simpan draf output</button>
      <label>Profil lokal
       <select value={draftId} onChange={e=>{
        setDraftId(e.target.value);
        const p=savedDrafts.find(q=>q.id===e.target.value);
        if(p)setDraftName(p.name);
       }}>
        <option value="">Pilih profil</option>
        {savedDrafts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
       </select>
      </label>
      <div className="stage-dual-buttons">
       <button type="button" onClick={applyOutputDraft} disabled={!draftId}>Muat profil (QA ulang)</button>
       <button type="button" onClick={removeOutputDraft} disabled={!draftId}>Hapus</button>
      </div>
     </details>
      <div className="stage-dual-calibration">
       <div className="stage-dual-cal-controls">
        <label>Kecerahan {selected.toUpperCase()} · {Math.round(activePlan.brightness*100)}%
         <input type="range" min="0" max=".6" step=".02" value={activePlan.brightness}
          onChange={e=>editPlan(selected,p=>({...p,brightness:Number(e.target.value)}))}/></label>
        <label>Resolusi Output<select value={activePlan.resolution}
         onChange={e=>editPlan(selected,p=>({...p,resolution:e.target.value as '720p'|'1080p'}))}>
         <option value="720p">720p</option><option value="1080p">1080p</option>
        </select></label>
       </div>
       <details className="map-r2-aux-details">
        <summary>Warp UV sumber / proyektor · editor lanjutan</summary>
        <MapFourCornerEditor key={selected} sourceQuad={activePlan.sourceQuad}
        projectorQuad={activePlan.projectorQuad}
        previewCanvas={selected==='body'?bodyCanvas:floorCanvas}
        onReset={group=>editPlan(selected,p=>({...p,[group]:defaultStageSurfacePlan(selected)[group]}))}
        onCommit={(group,quad)=>editPlan(selected,p=>({...p,[group]:quad}))}/>
       </details>
       <details className="map-r5-model-diagnostics">
        <summary>Diagnostik geometri · teknisi</summary>
       <div className="stage-dual-advanced-row">
        <details>
         <summary>Advanced · angka presisi empat titik</summary>
         <p>Urutan: kiri atas, kanan atas, kanan bawah, kiri bawah (0–1). Ulangi uji fisik jika proyektor bergeser.</p>
         <div className="stage-dual-quad">
          {(['sourceQuad','projectorQuad'] as const).map(group=><div key={group}>
           <b>{group==='sourceQuad'?'Sumber kamera/pad':'Target proyektor'}</b>
           {activePlan[group].map((point,i)=><div key={i}>
            <span>{i+1}</span>
            {(['x','y'] as const).map(axis=><label key={axis}>{axis.toUpperCase()}
             <input type="number" min="0" max="1" step=".01" value={point[axis]}
              onChange={e=>editPlan(selected,p=>({
               ...p,[group]:p[group].map((v,j)=>j===i?{...v,[axis]:Number(e.target.value)}:v) as typeof p[typeof group]
              }))}/></label>)}
           </div>)}
          </div>)}
         </div>
        </details>
       </div>
       </details>
      </div>

      <details className="map-r2-aux-details">
       <summary>Status perangkat &amp; output teknisi</summary>
       <ol className="stage-dual-stepper" aria-label={'Alur kesiapan proyektor '+selected.toUpperCase()}>
       {([
        {id:'display',label:'1. Layar',done:displayInfo.extended===true},
        {id:'safe',label:'2. Aman',done:operatorConfirm},
        {id:'output',label:'3. Output',done:devices[selected].connected},
        {id:'qa',label:'4. QA 5/5',done:qa.status==='within-provisional-target'},

       ] as const).map((step,idx,arr)=>{
        const isCurrent=!step.done&&arr.slice(0,idx).every(s=>s.done);
        return <li key={step.id} data-done={step.done||undefined} data-current={isCurrent||undefined}>
         {step.label}
        </li>;
       })}
      </ol>
      <div className="stage-dual-display-hint" data-extended={String(displayInfo.extended)} role="status">
       <span>{displayInfo.label}</span>
      </div>

      <details className="map-r5-output-diagnostics">
       <summary>Kontrol output BODY / FLOOR</summary>
      <div className="stage-dual-outputs">
       {ids.map(id=>{
        const s=devices[id],a=assessment(id);
        return <div className="stage-dual-output" key={id} data-selected={selected===id}>
         <div className="stage-dual-output-head">
          <b>{labels[id]}</b>
          <span className="stage-dual-output-mode" data-mode={s.mode}>{s.mode.toUpperCase()}</span>
         </div>
         <p>{s.opened?(s.connected?'Jendela terhubung':'Menunggu jendela output…'):'Jendela belum dibuka'} · QA {a.count}/5</p>
         <div className="stage-dual-buttons">
          <button type="button" disabled={!STAGE_HARDWARE_ENABLED||!operatorConfirm||s.connected}
            onClick={()=>open(id)}>{s.opened&&!s.connected?'Pulihkan output':'Buka output'}</button>
          <button type="button" disabled={!s.opened} onClick={()=>close(id)}>Tutup</button>
          <button type="button" disabled={!STAGE_HARDWARE_ENABLED||!s.connected||!operatorConfirm}
           onClick={()=>changeMode(id,'test')}><Target size={13}/> Pola uji</button>
          </div>
         <small>{s.reason}</small>
        </div>;
       })}
      </div>

      <section className="stage-wysiwyg" aria-label="Preview proyektor ganda WYSIWYG">
       <div className="stage-wysiwyg-head">
        <div><b>Pratinjau output BODY + FLOOR</b>
         <small>Transformasi kalibrasi sama dengan jendela output</small>
        </div>
        <div className="stage-wysiwyg-switch" role="group" aria-label="Mode preview proyektor">
         <button type="button" aria-pressed={previewView==='draft'}
          onClick={()=>setPreviewView('draft')}>Draf lokal</button>
         <button type="button" aria-pressed={previewView==='sent'}
          onClick={()=>setPreviewView('sent')}>Sinyal dikirim</button>
        </div>
       </div>
       <div className="stage-wysiwyg-grid">
        {ids.map(id=><ProjectorWysiwygPreview key={id} surface={id}
         plan={plans[id]} view={previewView} softwareMode={devices[id].mode}
         connected={devices[id].connected} qa={assessment(id)}
         liveCanvas={id==='body'?bodyCanvas:floorCanvas}
         testCanvases={testCanvasesRef} viewport={devices[id].viewport}/>)}
       </div>
      </section>
      </details>

      <details className="stage-dual-setup-uat">
       <summary>Uji setup panggung (&lt;10 menit)</summary>
       <p>Catat waktu setup hanya setelah operator melihat efek pada lantai fisik.</p>
       <div className="stage-dual-setup-elapsed">
        {(()=>{const started=readSetupStart(sessionStorage,Date.now());
         if(started===null)return 'Timer belum dimulai';
         const total=Math.floor((Date.now()-started)/1000);
         return 'Waktu '+Math.floor(total/60).toString().padStart(2,'0')+':'+
          (total%60).toString().padStart(2,'0')+' / target '+(FIRST_SETUP_TARGET_MS/60000)+' menit';
        })()}
       </div>
       <button type="button" onClick={beginBench} disabled={devices.floor.mode==='live'}>
        Mulai uji setup baru
       </button>
       <label className="stage-dual-setup-check">
        <input type="checkbox" checked={benchObserved}
         onChange={e=>setBenchObserved(e.target.checked)}/>
        Efek FLOOR terlihat sesuai di lantai fisik dan Blackout nyata sudah diuji
       </label>
       <label>Catatan uji
        <input maxLength={180} value={benchNotes} onChange={e=>setBenchNotes(e.target.value)}
         placeholder="Kamera, proyektor, ruangan, hambatan"/>
       </label>
       <button type="button" disabled={!benchObserved||devices.floor.mode!=='live'||
        assessment('floor').status!=='within-provisional-target'} onClick={recordBench}>
        Catat hasil uji fisik
       </button>
       {benchResult&&<p role="status">{benchResult}</p>}
      </details>
      </details>
     </div>
    </details>
   </aside>

   <div className="map-r2-monitor-col">
    <MapStageMonitor
     view={monitorView}
     onChangeView={setMonitorView}
     selected={selected}
     plan={activePlan}
     editingCorners={editingCorners}
     activeCorner={activeCorner}
     onSelectCorner={setActiveCorner}
     snapEnabled={snapEnabled}
     stageDimensions={stageDimensions}
     hasLiveSource={hasLiveSource}
     sourceKind={sourceKind}
     simState={simState}
     onStartSim={()=>{
      setSimState(prev=>({...prev,active:true,playing:true}));
      setMessage('Simulasi uji aktif di atas grid kalibrasi (software lokal, output fisik terkunci).');
     }}
     onStopSim={()=>{
      setSimState(prev=>({...prev,active:false}));
      setMessage('Simulasi ditutup; kembali ke tampilan grid kalibrasi murni.');
     }}
     onToggleSimPlay={()=>setSimState(prev=>({...prev,playing:!prev.playing}))}
     onMoveSimPerformer={(actorId,pos)=>setSimState(prev=>moveMapSimPerformer(prev,actorId,pos))}
     onCommitProjectorQuad={commitMonitorQuad}
     onOpenCameraCalibration={onOpenCameraCalibration}
     previewView={previewView}
     onChangePreviewView={setPreviewView}
     softwareMode={devices[selected].mode}
     connected={devices[selected].connected}
     qa={qa}
     viewport={devices[selected].viewport}
     bodyCanvas={bodyCanvas}
     floorCanvas={floorCanvas}
     liquidCanvas={liquidCanvas}
     experimentInputCanvas={experimentInputCanvas}
     videoRef={videoRef}
     frameRef={motionFrameRef}
     floorTracker={floorTracker}
     motionEvents={motionEvents}
     testCanvases={testCanvasesRef}
     performerCount={performerCount}
     identitySafe={identitySafe}
    />
   </div>
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
