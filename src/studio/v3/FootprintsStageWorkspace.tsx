import {useEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';
import {STAGE_INSPECTOR_TABS,moveOperatorCue,
 operatorCueAt,operatorShortcut,type StageInspectorTab} from './OperatorStageModel.ts';
import {OperatorStageConsole} from './OperatorStageConsole.tsx';
import {GuidedStageSetup} from '../../stage/GuidedStageSetup.tsx';
import {VideoMotionLab} from '../../stage/VideoMotionLab.tsx';
import {RehearsalComparisonLab} from '../../stage/RehearsalComparisonLab.tsx';
import type {ReplayReport} from '../../stage/rehearsalComparisonModel.ts';
import {SurfaceComposer} from './SurfaceComposer.tsx';
import {useStageSession} from '../../stage/useStageSession.ts';
import {Activity,Camera,CameraOff,ChevronRight,Film,Play,ShieldAlert,SlidersHorizontal,Video} from 'lucide-react';
import type {StageNavigationRequest} from './stageNavigation.ts';
import type {Point} from '../../projection/geometry.ts';
import type {MotionFrame} from '../../engine/types.ts';
import type {Projection} from '../../projection/useProjection.ts';
import type {LiveFloorTrackingEngine,LiveFloorStatus} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter,MultiPoseStatus} from '../../footprints/live/MultiPoseGaitRouter.ts';
import {paintFloorCanvas} from '../../footprints/simulator/floorCanvas.ts';
import {buildLowerBodyMask,LOWER_BODY_MASK_DEFAULTS} from '../../footprints/stage-optics/LowerBodyMaskEngine.ts';
import {ArchivalMappingPanel} from '../../footprints/stage-optics/ArchivalMappingPanel.tsx';
import {stageBodyPreviewGate} from './footprintsUX.ts';
import {palettes} from '../../footprints/pattern.ts';
import type {FootprintConfig,FootprintStyle} from '../../footprints/StudioFootprints.tsx';
import {cameraBinding,cameraBindingKey} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import {readDualOutputStatus,watchDualOutputStatus,verifiedDualStatus} from '../../footprints/stage-optics/DualSurfaceTelemetry.ts';
import {stageHardwareAvailable} from '../../footprints/stage-optics/StageHardwareGate.ts';
import {deriveUnifiedStageStatus,legacyStageTransportGate,type LegacyOutputStatus} from './unifiedStageStatus.ts';
import {FootprintsStageTransport,UnifiedStageStatusStrip} from './UnifiedStageConsole.tsx';
import './footprints-stage-workspace.css';

type WorkspaceView='stage'|'archive';
type Props={
 navigationRequest?:StageNavigationRequest|null;
 onActiveToolChange?:(tool:StageNavigationRequest['tool'])=>void;
 frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 tracker:LiveFloorTrackingEngine;router:MultiPoseGaitRouter;projection:Projection;
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;bodySelected:boolean;legacyApproved:boolean;
 phoneActive:boolean;
 performerCount:1|2;onPerformerCount:(count:1|2)=>void;
 onStartBody:()=>void;onOpenSimulator:()=>void;onOpenLiveFloor:()=>void;
 onPhoneStream:(stream:MediaStream)=>Promise<void>|void;
 onPhoneDisconnect:()=>void;onEnterOperator:()=>void;
 onBlackout:()=>void;onToggleCamera:()=>void;onRecordVideo:()=>void;onCapture:()=>void;
 operatorMode:boolean;onExitOperator:()=>void;
 videoRecording:boolean;canRecordVideo:boolean;
 footprint:FootprintConfig;
 updateFootprint:(value:Partial<FootprintConfig>)=>void;
};
const blockedReason=(cameraOn:boolean,calibrated:boolean,confirmed:boolean)=>
 !cameraOn?'Kamera Body belum aktif.':!calibrated?'Lantai belum dikalibrasi.':
 !confirmed?'Konfirmasi kalibrasi lantai.':'Menunggu event pijakan.';
export function FootprintsStageWorkspace({
 navigationRequest,onActiveToolChange,frameRef,videoRef,tracker,router,projection,cameraOn,cameraBusy,cameraError,bodySelected,legacyApproved,
 phoneActive,
 performerCount,onPerformerCount,onStartBody,onOpenSimulator,onOpenLiveFloor,
 onPhoneStream,onPhoneDisconnect,onEnterOperator,
 onBlackout,onToggleCamera,onRecordVideo,onCapture,videoRecording,canRecordVideo,
 operatorMode,onExitOperator,footprint,updateFootprint
}:Props){
 const cameraCanvas=useRef<HTMLCanvasElement>(null);
 const bodyCanvas=useRef<HTMLCanvasElement>(null);
 const floorCanvas=useRef<HTMLCanvasElement>(null);
 const stageSession=useStageSession();
 const [setupOpen,setSetupOpen]=useState(false);
 const [calibrationOverlay,setCalibrationOverlay]=useState<{marks:Array<Point|null>;editing:number}|null>(null);
 const calibrationTap=useRef<((x:number,y:number)=>void)|null>(null);
 useEffect(()=>{if(!setupOpen)setCalibrationOverlay(null);},[setupOpen]);
 const lastNavRequest=useRef(0);
 const [composerOpen,setComposerOpen]=useState(false);
 const [videoLabOpen,setVideoLabOpen]=useState(false);
 const [rehearsalOpen,setRehearsalOpen]=useState(false);
 const [rehearsalReference,setRehearsalReference]=useState<ReplayReport|null>(null);
 const restoredPerformers=useRef(false);
 useEffect(()=>{
  if(!stageSession.loaded||restoredPerformers.current)return;
  restoredPerformers.current=true;
  if(stageSession.meta.performers!==performerCount)
   onPerformerCount(stageSession.meta.performers);
 },[stageSession.loaded,stageSession.meta.performers,performerCount,onPerformerCount]);
 const [view,setView]=useState<WorkspaceView>('stage');
 useEffect(()=>{
  if(navigationRequest?.tool==='simulator'||navigationRequest?.tool==='calibration')return;
  const tool=setupOpen?'setup':videoLabOpen?'video':rehearsalOpen?'rehearsal':
   composerOpen?'composer':view==='archive'?'archival-mapping':'live';
  onActiveToolChange?.(tool);
 },[setupOpen,videoLabOpen,rehearsalOpen,composerOpen,view,onActiveToolChange,navigationRequest?.tool]);
 const previewHoldRef=useRef(footprint.hold);
 previewHoldRef.current=footprint.hold;
 const [inspector,setInspector]=useState<StageInspectorTab>('tracking');
 const [operatorCue,setOperatorCue]=useState(0);
 const [floorStatus,setFloorStatus]=useState<LiveFloorStatus>(()=>tracker.status);
 const [identityStatus,setIdentityStatus]=useState<MultiPoseStatus>(()=>router.status);
 const [maskStatus,setMaskStatus]=useState('Kamera belum terhubung');
 const [bodyVisible,setBodyVisible]=useState(0);
 const [frameFresh,setFrameFresh]=useState(false);
 const [viewError,setViewError]=useState('');
 const [dualRaw,setDualRaw]=useState(readDualOutputStatus);
 const hardwareEnabled=stageHardwareAvailable(import.meta.env.DEV,
  import.meta.env.VITE_SOMA_STAGE_OUTPUTS);
 useEffect(()=>watchDualOutputStatus(()=>setDualRaw(readDualOutputStatus())),[]);
 const showArchive=()=>{
  setView('archive');setInspector('archive');
 };
 useEffect(()=>{
  if(!operatorMode)return;
  // Archive unmounts when entering Perform; its dual windows are also
  // disarmed by the App-level global Blackout before the mode is changed.
  setSetupOpen(false);
  setView('stage');setOperatorCue(0);
 },[operatorMode]);
 const nextCue=()=>setOperatorCue(index=>moveOperatorCue(index,1));
 const previousCue=()=>setOperatorCue(index=>moveOperatorCue(index,-1));
 const onBlackoutRef=useRef(onBlackout);
 onBlackoutRef.current=onBlackout;
 useEffect(()=>{
  if(!operatorMode)return;
  const handle=(event:KeyboardEvent)=>{
   const el=event.target as HTMLElement|null;
   const editing=!!el?.closest('input,textarea,select,button,summary,[contenteditable="true"],dialog')||
    !!document.querySelector('dialog[open]')||event.isComposing;
   const action=operatorShortcut(event.code,editing,event.ctrlKey,event.altKey,event.metaKey);
   if(!action||event.repeat)return;
   event.preventDefault();
   if(action==='blackout')onBlackoutRef.current();
   if(action==='next')setOperatorCue(index=>moveOperatorCue(index,1));
   if(action==='previous')setOperatorCue(index=>moveOperatorCue(index,-1));
  };
  window.addEventListener('keydown',handle);
  return()=>window.removeEventListener('keydown',handle);
 },[operatorMode]);
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
   const identities=router.status;
   const gate=stageBodyPreviewGate({
    cameraOn:cameraOn&&bodySelected,tracked:f.tracked,source:f.source,ageMs:now-f.time,
    performerCount,visibleCount:identities.visible.length,
    identityAmbiguous:identities.ambiguous,matchedFrame:identities.observedFrameTime===f.time
   });
   const fresh=cameraOn&&bodySelected&&f.source==='camera'&&f.tracked&&
    f.time<=now&&now-f.time<450;
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
   const allow=result.status==='ready'&&gate==='ready';
   const b=bodyCanvas.current,g=b?.getContext('2d');
   // HOLD freezes only the operator's BODY/FLOOR raster. Tracking and
   // FloorSession event collection continue; software projector transport is separate.
   if(b&&g&&!previewHoldRef.current){
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
    gate==='identity-unsafe'?'Identitas A/B belum stabil':
    allow?'Mask tubuh terbaca':
    result.status==='stale'?'Frame terlambat':'Landmark kaki belum lengkap';
   if(label!==lastStatus){lastStatus=label;setMaskStatus(label);}
   const pad=floorCanvas.current;
   if(pad&&!previewHoldRef.current&&(lastFloorRevision!==tracker.eventRevision)){
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
 },[frameRef,videoRef,tracker,router,cameraOn,bodySelected,performerCount]);
 const projectionState=projection.status.connected?
  projection.transport==='blackout'?'Blackout aktif':projection.transport==='hold'?'Output ditahan':'Output aktif':
  'Output belum tersambung';
 const cameraLabel=cameraBusy?'Menghubungkan':cameraError?'Kamera bermasalah':
  cameraOn&&!bodySelected?'Pilih sumber Body':frameFresh?'Tracking aktif':
  cameraOn?'Mencari tubuh':'Kamera mati';
 const totalFrames=bodyVisible;
 const dual={body:verifiedDualStatus(dualRaw.body,performance.now()),
  floor:verifiedDualStatus(dualRaw.floor,performance.now())};
 const cameraMatched=tracker.boundCamera!==null&&
  tracker.boundCamera===cameraBindingKey(cameraBinding(videoRef.current));
 const legacy:LegacyOutputStatus={opened:projection.opened,connected:projection.status.connected,
  mode:projection.transport,approved:legacyApproved};
 const units=deriveUnifiedStageStatus({
  camera:{on:cameraOn,busy:cameraBusy,error:cameraError,frameFresh,bodySelected},
  identity:{count:performerCount,visibleCount:identityStatus.visible.length,
   ambiguous:identityStatus.ambiguous,
   observedSameFrame:identityStatus.observedFrameTime===frameRef.current.time},
  floor:{calibrated:floorStatus.calibrated,confirmed:floorStatus.confirmed,
   cameraMatched,contacts:floorStatus.contacts},
  bodyMask:{ready:totalFrames>0,reason:maskStatus},
  dual,hardwareEnabled
 });
 const legacyGate=legacyStageTransportGate({
  cameraOn,frameFresh,floorConfirmed:floorStatus.confirmed,cameraMatched,
  dualOpened:dual.body.opened||dual.floor.opened,legacy
 });
 const closeSetup=()=>{
  setSetupOpen(false);
  window.requestAnimationFrame(()=>{
   document.querySelector<HTMLButtonElement>('.soma-rail-item[data-soma-tool="setup"]')
    ?.focus({preventScroll:true});
  });
 };
 useEffect(()=>{
  const request=navigationRequest;
  if(!request||lastNavRequest.current===request.id)return;
  lastNavRequest.current=request.id;
  setSetupOpen(false);setVideoLabOpen(false);setRehearsalOpen(false);
  setComposerOpen(false);
  onBlackout();
  switch(request.tool){
   case 'live':setView('stage');setInspector('tracking');break;
   case 'setup':setView('stage');setSetupOpen(true);break;
   case 'archival-mapping':showArchive();break;
   case 'composer':setView('stage');setComposerOpen(true);break;
   case 'video':setView('stage');setVideoLabOpen(true);break;
   case 'rehearsal':setView('stage');setRehearsalOpen(true);break;
   case 'simulator':setView('stage');onOpenSimulator();break;
   case 'calibration':setView('stage');onOpenLiveFloor();break;
  }
 },[navigationRequest]);
 const onMainCameraPoint=(event:PointerEvent<HTMLCanvasElement>)=>{
  if(!setupOpen||!calibrationOverlay||!calibrationTap.current||!cameraOn)return;
  const canvas=cameraCanvas.current,video=videoRef.current;
  if(!canvas||!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const pixelX=(event.clientX-rect.left)*canvas.width/rect.width;
  const pixelY=(event.clientY-rect.top)*canvas.height/rect.height;
  const scale=Math.min(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
  const videoWidth=video.videoWidth*scale,videoHeight=video.videoHeight*scale;
  const nx=(pixelX-(canvas.width-videoWidth)/2)/videoWidth;
  const ny=(pixelY-(canvas.height-videoHeight)/2)/videoHeight;
  if(nx<0||nx>1||ny<0||ny>1)return;
  event.preventDefault();
  calibrationTap.current(nx,ny);
 };
 const rawW=videoRef.current?.videoWidth||768;
 const rawH=videoRef.current?.videoHeight||432;
 const camScale=Math.min(768/rawW,432/rawH);
 const camDrawWidth=rawW*camScale,camDrawHeight=rawH*camScale;
 const camLeft=(768-camDrawWidth)/2,camTop=(432-camDrawHeight)/2;
 return <section className={'fp-stage-workspace'+(operatorMode?' fp-operator-mode':'')+(setupOpen&&!operatorMode?' fp-setup-docked':'')}
  data-operator-cue={operatorCueAt(operatorCue).id} data-context={setupOpen?'setup':'inspector'}
  aria-label="Workspace utama SOMA Footprints">
  {operatorMode?
   <OperatorStageConsole index={operatorCue} onPrevious={previousCue} onNext={nextCue}
    onSelect={setOperatorCue} onExit={onExitOperator} onBlackout={onBlackout}
    held={footprint.hold} onHold={()=>updateFootprint({hold:true})}
    onResume={()=>updateFootprint({hold:false})}
    videoRecording={videoRecording} canRecordVideo={canRecordVideo}
    onRecordVideo={onRecordVideo} units={units}
    contacts={floorStatus.contacts} performerCount={performerCount}/>
   :<UnifiedStageStatusStrip units={units} legacy={legacy}/>}
  {videoLabOpen&&!operatorMode&&view==='stage'&&<VideoMotionLab
   onClose={()=>{onBlackout();setVideoLabOpen(false);}}
   onUseReference={report=>{
    onBlackout();setRehearsalReference(report);setVideoLabOpen(false);
    setComposerOpen(false);setRehearsalOpen(true);setView('stage');
   }}/>}
  {rehearsalOpen&&!operatorMode&&view==='stage'&&<RehearsalComparisonLab
   frameRef={frameRef} videoRef={videoRef} tracker={tracker} router={router}
   cameraOn={cameraOn} bodySelected={bodySelected} performers={performerCount}
   initialReference={rehearsalReference}
   onStartCamera={onStartBody} onCalibrate={onOpenLiveFloor}
   onClose={()=>{onBlackout();setRehearsalOpen(false);}}/>}
  {composerOpen&&!operatorMode&&view==='stage'&&<SurfaceComposer
   bodyCanvas={bodyCanvas} floorCanvas={floorCanvas} frameRef={frameRef} videoRef={videoRef}
   router={router} floorTracker={tracker} projection={projection}
   cameraOn={cameraOn} bodySelected={bodySelected} performerCount={performerCount}
   floorReady={floorStatus.confirmed&&cameraMatched}
   floorEvents={()=>tracker.session?.events??[]}
   identitySafe={!identityStatus.ambiguous}
   onClose={()=>{onBlackout();setComposerOpen(false);}}/>}
  <div className="fp-stage-layout">
   <div className="fp-stage-main">
    <div className="fp-stage-overview" hidden={view!=='stage'}>
     <div className="fp-stage-video">
      <div className="fp-stage-surface-head"><span>01 / TRACKING CAMERA</span>
       <small>{cameraOn?'Kamera lokal':'Offline'}</small></div>
      <div className="fp-stage-video-content">
       <canvas ref={cameraCanvas} width={768} height={432}
        onPointerDown={onMainCameraPoint}
        data-calibration-active={setupOpen&&!!calibrationOverlay}
        aria-label={setupOpen&&calibrationOverlay?'Klik empat sudut kalibrasi lantai pada kamera besar':'Pratinjau video kamera SOMA Body'}/>
       {setupOpen&&calibrationOverlay&&<div className="fp-stage-calibration-overlay" aria-hidden="true">
        <svg viewBox="0 0 768 432" preserveAspectRatio="none">
         {calibrationOverlay.marks.every(p=>p!==null)&&<polygon
          points={calibrationOverlay.marks.map(p=>{
           const q=p!;return [(camLeft+q.x*camDrawWidth),(camTop+q.y*camDrawHeight)].join(',');
          }).join(' ')} fill="#b9e4a319" stroke="#c7eba6" strokeWidth="2"/>}
         {calibrationOverlay.marks.map((p,i)=>p&&<g key={i}>
          <circle cx={camLeft+p.x*camDrawWidth} cy={camTop+p.y*camDrawHeight}
           r={i===calibrationOverlay.editing?13:11} fill="#d8efbb" stroke="#273c2c" strokeWidth="2"/>
          <text x={camLeft+p.x*camDrawWidth} y={camTop+p.y*camDrawHeight+4}
           textAnchor="middle" fontSize="12" fontWeight="700" fill="#122217">{i+1}</text>
         </g>)}
        </svg>
        <div className="fp-stage-calibration-hint">TRACKING · Pilih sudut {calibrationOverlay.editing+1}/4 pada gambar kamera</div>
       </div>}
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
        {totalFrames===0&&!footprint.hold&&
         <span className="fp-stage-canvas-empty">{maskStatus}</span>}
        {footprint.hold&&<span className="fp-stage-hold-label">
         HOLD · frame BODY ditahan, tracking tetap berjalan</span>}
       </div>
       <div className="fp-stage-surface-foot"><span>{maskStatus}</span><span>Mask · preview</span></div>
      </div>
      <div className="fp-stage-surface">
       <div className="fp-stage-surface-head"><span>03 / FLOOR PAD</span><small>Metric floor</small></div>
       <div className="fp-stage-canvas-area">
        <canvas ref={floorCanvas} width={1280} height={720}
         aria-label="Pratinjau kontak kaki dan lintasan dari FloorSession V3"/>
        {!floorStatus.confirmed&&!footprint.hold&&<span className="fp-stage-canvas-empty">
         {blockedReason(cameraOn,floorStatus.calibrated,floorStatus.confirmed)}</span>}
        {footprint.hold&&<span className="fp-stage-hold-label">
         HOLD · frame FLOOR ditahan, event tetap tercatat</span>}
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
      performerCount={performerCount} router={router} projection={projection}
      stageMedia={stageSession.media} onStageMedia={stageSession.chooseMedia}
      stageSettings={stageSession.meta.archiveSettings}
      onStageSettings={settings=>stageSession.patch({archiveSettings:settings})}
      stageHoldMs={stageSession.meta.bridgeHoldMs}
      onStageHoldMs={ms=>stageSession.patch({bridgeHoldMs:ms})}/>
    </div>}
    {view==='stage'&&<div className="fp-stage-bottom-status">
     <Activity size={15}/>
     <span>{floorStatus.reason}</span>
     <button type="button" onClick={onOpenLiveFloor}>Atur tracking <ChevronRight size={14}/></button>
    </div>}
   </div>
   {!operatorMode&&<aside className="fp-stage-inspector" data-mode={setupOpen?'setup':'inspector'}
   aria-label={setupOpen?'Guided Setup — Inspector kanan':'Inspector kontekstual Footprints'}>
   {setupOpen&&<GuidedStageSetup embedded open={true} onClose={closeSetup}
   onCalibrationState={setCalibrationOverlay}
   onBindCalibrationTap={handler=>{calibrationTap.current=handler;}}
   session={stageSession} frameRef={frameRef} videoRef={videoRef}
   bodyPreviewRef={bodyCanvas} floorPreviewRef={floorCanvas}
   floorTracker={tracker} identityRouter={router} phoneActive={phoneActive}
   performers={performerCount} onStartLaptop={onStartBody}
   onPhoneStream={onPhoneStream} onPhoneDisconnect={onPhoneDisconnect}
   onCalibrate={onOpenLiveFloor} onSimulator={onOpenSimulator}
   onArchive={()=>{onBlackout();showArchive();setSetupOpen(false);}}
   onComposer={()=>{onBlackout();setSetupOpen(false);setVideoLabOpen(false);setView('stage');setComposerOpen(true);}}
   onBlackout={onBlackout}
   onVideoLab={()=>{onBlackout();setSetupOpen(false);setComposerOpen(false);setView('stage');setVideoLabOpen(true);}}
   onPerform={onEnterOperator}
   cameraOn={cameraOn} calibrated={floorStatus.calibrated}
   confirmed={floorStatus.confirmed} contacts={floorStatus.contacts}/>}

    <div className="fp-stage-inspector-title"><span>CONTEXT INSPECTOR</span><h2>{
     inspector==='tracking'?'Tracking':inspector==='visual'?'Footprint Visual':
     inspector==='archive'?'Archival Mapping':inspector==='projection'?'Projection Output':'QA & Engineering'}</h2></div>
    <div className="fp-stage-inspector-tabs" role="group" aria-label="Bagian inspector">
     {STAGE_INSPECTOR_TABS.map(tab=><button key={tab.id} type="button"
      title={tab.description} aria-pressed={inspector===tab.id}
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
        aria-pressed={performerCount===v} onClick={()=>{
        stageSession.patch({performers:v});onPerformerCount(v);
       }}>
        {v} performer</button>)}
      </div>
      {performerCount===2&&<p className="fp-stage-hint">Identitas A/B: {identityStatus.ambiguous?
       'Bersilangan / belum pasti':identityStatus.visible.length===2?'Dua tubuh terbaca':
       'Menunggu dua tubuh'}</p>}
      <details className="fp-stage-progressive">
       <summary>Diagnostik kaki dan event</summary>
       <div className="fp-stage-progressive-body">
        <div className="fp-stage-inspector-kv"><span>Kontak tercatat</span><strong>{floorStatus.contacts}</strong></div>
        <div className="fp-stage-inspector-kv"><span>Jumlah event</span><strong>{floorStatus.events}</strong></div>
       </div>
      </details>
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
      <details className="fp-stage-progressive">
       <summary>Detail visual · ukuran, durasi, palet</summary>
       <div className="fp-stage-progressive-body">
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
        <p className="fp-stage-hint">Gaya ini hanya memengaruhi jejak Studio. BODY mask dan pad terkalibrasi memakai kontrol masing-masing.</p>
       </div>
      </details>
     </>}
     {inspector==='archive'&&<>
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
     {inspector==='projection'&&<>
      <p className="fp-stage-label">STATUS PROYEKTOR</p>
      <div className="fp-stage-inspector-kv"><span>Legacy output</span>
       <strong>{projectionState}</strong></div>
      <div className="fp-stage-inspector-kv"><span>BODY</span>
       <strong>{units.find(u=>u.id==='body')?.detail}</strong></div>
      <div className="fp-stage-inspector-kv"><span>FLOOR</span>
       <strong>{units.find(u=>u.id==='floor')?.detail}</strong></div>
      <p className="fp-stage-hint">Kontrol output fisik tetap di Dual-Surface Calibration dan membutuhkan persetujuan terpisah.</p>
      <p className="fp-stage-hint">Output tunggal: {legacyGate.reason}</p>
      <button type="button" className="fp-stage-primary-action" onClick={()=>{
       setView('archive');setInspector('projection');
      }}><SlidersHorizontal size={15}/> Atur output BODY / FLOOR</button>
      <button type="button" onClick={onOpenLiveFloor}>
       <SlidersHorizontal size={15}/> Kalibrasi Footprints</button>
      <p className="fp-stage-hint"><ShieldAlert size={14}/> Blackout browser belum menggantikan pemutus daya proyektor fisik.</p>
     </>}
     {inspector==='qa'&&<>
      <p className="fp-stage-label">REHEARSAL / QA</p>
      <p className="fp-stage-hint">Periksa gerak, koordinat lantai, simulasi dan bukti fisik dari sumber data yang sama.</p>
      <button type="button" className="fp-stage-primary-action" onClick={onOpenLiveFloor}>
       <SlidersHorizontal size={15}/> Calibration & Physical QA</button>
      <button type="button" onClick={onOpenSimulator}><Play size={15}/> Simulation Lab · 3D</button>
      <details className="fp-stage-progressive">
       <summary>Engineering diagnostics</summary>
       <div className="fp-stage-progressive-body">
        <div className="fp-stage-inspector-kv"><span>Floor events</span><strong>{floorStatus.events}</strong></div>
        <div className="fp-stage-inspector-kv"><span>Contacts</span><strong>{floorStatus.contacts}</strong></div>
        <div className="fp-stage-inspector-kv"><span>Body mask</span><strong>{maskStatus}</strong></div>
        <div className="fp-stage-inspector-kv"><span>Renderer</span><strong>{projection.status.reason}</strong></div>
        <p className="fp-stage-hint">Kalibrasi dan pengukuran optik asli tetap dikerjakan lewat panel QA.</p>
       </div>
      </details>
     </>}
    </div>
   </aside>}
  </div>
  {!operatorMode&&<FootprintsStageTransport cameraOn={cameraOn} cameraBusy={cameraBusy}
   frameFresh={frameFresh} videoRecording={videoRecording} canRecordVideo={canRecordVideo}
   bodySelected={bodySelected}
   held={footprint.hold} legacy={legacy} canPreview={view==='stage'}
   onCamera={onToggleCamera} onRecordVideo={onRecordVideo} onCapture={onCapture}
   onHold={()=>updateFootprint({hold:true})}
   onLivePreview={()=>updateFootprint({hold:false})} onBlackout={onBlackout}
   onOutputSettings={()=>{setView('archive');setInspector('projection');}}/>}
  {!operatorMode&&<footer className="fp-stage-footer">
   <span><Video size={14}/> Kamera dan video arsip diproses pada perangkat ini.</span>
   <span><ShieldAlert size={14}/> Status output menunjukkan perintah software, bukan pengukuran cahaya proyektor.</span>
  </footer>}
 </section>;
}
