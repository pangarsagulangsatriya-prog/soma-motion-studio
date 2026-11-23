import {useEffect,useState,useSyncExternalStore,type RefObject} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import type {ExperimentalFrame} from '../../studio/v3/experimentSourceModel.ts';
import type {Quad} from '../../projection/geometry.ts';
import type {Projection} from '../../projection/useProjection.ts';
import {cameraBinding,type LiveFloorTrackingEngine} from '../live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../live/MultiPoseGaitRouter.ts';
import {defaultFloorSpace,validateCameraFloorCalibration,type CameraFloorCalibration} from '../spatial/coordinates.ts';
import type {FootMotionEventV2} from '../scenes/FootMotionEventV2.ts';
import {STAGE_BLACKOUT_EVENT} from './StageBlackout.ts';
import {shouldLatchProjectionBlackout} from '../../studio/v3/safeProjectionPreflight.ts';
import {validateStageSurfacePlan,
 type StageSurface,type StageSurfacePlan,type SurfaceProof}
 from './DualSurfaceCalibration.ts';
import {
 DUAL_SURFACE_IDS,
 getDualSurfaceState,
 patchDualSurfaceState,subscribeDualSurface,syncDualSurfaceRuntime,
 urgentBlackoutDualSurface,blackoutAllDualSurfaces,
 type RequestedMode,type StageRouteInput
} from './DualSurfaceSessionStore.ts';
import './dual-surface-routing.css';
import {MapWysiwygWorkspace} from '../../studio/v3/MapWysiwygWorkspace.tsx';
import {
 DEFAULT_STAGE_DIMENSIONS,STAGE_DIMENSION_PRESETS,clampStageDimensions,createDefaultMapSim,
 stepMapSimState,
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
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 motionSession?:()=>string;
 liveSourceKind?:'camera'|'phone';
 videoFloorCalibration?:CameraFloorCalibration|null;
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
 onOpenTrack?:()=>void;
 onOpenCompose?:()=>void;
 onMapOutputSaved?:(surface:StageSurface)=>void;
 onMapOutputInvalidated?:(surface?:StageSurface)=>void;
 mapOutputSaved?:Record<StageSurface,boolean>;
};

export function DualSurfaceRoutingPanel({
 frameRef,bodyCanvas,floorCanvas,legacyProjection,experimentLocked=false,
 liquidCanvas,experimentInputCanvas,experimentFrameRef,motionSession,liveSourceKind='camera',videoFloorCalibration=null,videoRef,motionFrameRef,floorTracker,router,motionEvents,
 cameraOn=false,floorReady=false,performerCount=2,identitySafe=true,experimentSource=null,
 onOpenTrack,onOpenCompose,onMapOutputSaved,onMapOutputInvalidated,mapOutputSaved={floor:false,body:false}
}:Props){
 // Keep shouldLatchProjectionBlackout referenced here and enforced in DualSurfaceSessionStore.
 void shouldLatchProjectionBlackout;
 const session=useSyncExternalStore(subscribeDualSurface,getDualSurfaceState,getDualSurfaceState);
 const {plans,selected,message}=session;

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
 const setSelected=(next:StageSurface)=>patchDualSurfaceState({selected:next});
 const setMessage=(next:string)=>patchDualSurfaceState({message:next});

 // Map only edits geometry; direct physical output keeps its independent safety interlock.
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
   setMessage('Bidang '+id.toUpperCase()+' tersimpan. Output fisik tetap Blackout.');
   return true;
  }catch(e){setMessage(e instanceof Error?e.message:'Kalibrasi tidak valid.');return false;}
 };

 const changeRoomSize=(size:MapStageDimensions)=>{
  const next=clampStageDimensions(size);
  if(next.widthM===stageDimensions.widthM&&next.depthM===stageDimensions.depthM)return;
  allBlackout();
  setProofs({body:null,floor:null});
  setRequested({body:'blackout',floor:'blackout'});
  setArmed({body:false,floor:false});
  if(floorTracker?.isCalibrated)floorTracker.revoke('Ukuran lantai berubah di Map. Tandai ulang lantai pada gambar kamera.');
  onMapOutputInvalidated?.();
  setStageDimensions(next);
  setMessage('Ukuran lantai diubah. Tandai ulang bidang kamera.');
 };
 const commitMonitorQuad=(quad:Quad)=>{
  try{
   validateStageSurfacePlan({...getDualSurfaceState().plans[selected],projectorQuad:quad});
   if(editPlan(selected,p=>({...p,projectorQuad:quad})))onMapOutputSaved?.(selected);
  }catch(e){setMessage(e instanceof Error?e.message:'Quad tidak valid.');}
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

 const activePlan=plans[selected];
 const selectedOutputSaved=mapOutputSaved[selected];
 const mapStatus=sourceKind==='none'?'Belum ada sumber':
  selectedOutputSaved?'Bidang output tersimpan · periksa QA':'Bidang output belum disimpan';

 return <section className="stage-dual map-r2-shell" aria-label="Map — kalibrasi ruang">
  {/* Track-matching single top header bar */}
  <header className="map-r2-topbar">
   <div className="map-r2-brand">
    <h2>Map</h2>
    <div className="map-r2-status-inline map-r7-status"
     data-status={selectedOutputSaved?'output-quad-saved':'output-quad-draft'}
     role="status" aria-label={mapStatus} title={mapStatus}>
     <span className="map-r7-status-dot" aria-hidden="true"/>
     <strong>{mapStatus}</strong>
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
     <button type="button" aria-pressed={selected==='floor'} onClick={()=>setSelected('floor')}>Lantai</button>
     <button type="button" aria-pressed={selected==='body'}
      title="Satu output BODY mencakup mask tubuh bawah Performer A dan B."
      onClick={()=>setSelected('body')}>Tubuh</button>
    </div>
   </div>
  </header>

  <main className="soma-map-v2-main">
 <MapWysiwygWorkspace selected={selected} stageDimensions={stageDimensions} plan={activePlan}
  sourceKind={sourceKind} hasLiveSource={hasLiveSource}
  videoRef={videoRef} motionFrameRef={motionFrameRef} experimentInputCanvas={experimentInputCanvas} floorTracker={floorTracker}
  router={router} experimentFrameRef={experimentFrameRef} motionSession={motionSession} liveSourceKind={liveSourceKind}
  videoFloorCalibration={videoFloorCalibration}
  mapOutputSaved={selectedOutputSaved}
  performerCount={performerCount} cameraOn={cameraOn}
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
   onMapOutputInvalidated?.(selected);
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
  externalNotice={message}
 />
 </main>
 </section>;
}
