import {useEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';
import {moveOperatorCue,operatorCueAt,operatorShortcut} from './OperatorStageModel.ts';
import {OperatorStageConsole} from './OperatorStageConsole.tsx';
import {GuidedStageSetup} from '../../stage/GuidedStageSetup.tsx';
import {VideoMotionLab} from '../../stage/VideoMotionLab.tsx';
import {RehearsalComparisonLab} from '../../stage/RehearsalComparisonLab.tsx';
import type {ReplayReport} from '../../stage/rehearsalComparisonModel.ts';
import {SurfaceComposer} from './SurfaceComposer.tsx';
import {useStageSession} from '../../stage/useStageSession.ts';
import {Camera,Film} from 'lucide-react';
import {CompactFootprintsStatus} from './CompactFootprintsStatus.tsx';
import {compactFootprintsReadiness} from './compactStageStatusModel.ts';
import {FootprintsSourceScreen} from './FootprintsSourceScreen.tsx';
import {deriveSourceScreenMode,showsSourcePicker,showsGaitPreviews} from './sourceScreenModel.ts';
import {FootprintsFlowInspector} from './FootprintsFlowInspector.tsx';
import {footprintsSteps,type FootprintsStep} from './footprintsFlow.ts';
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
import type {FootprintConfig} from '../../footprints/StudioFootprints.tsx';
import {cameraBinding,cameraBindingKey} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import {readDualOutputStatus,watchDualOutputStatus,verifiedDualStatus} from '../../footprints/stage-optics/DualSurfaceTelemetry.ts';
import {stageHardwareAvailable} from '../../footprints/stage-optics/StageHardwareGate.ts';
import {deriveUnifiedStageStatus,legacyStageTransportGate,type LegacyOutputStatus} from './unifiedStageStatus.ts';
import {FootprintsStageTransport} from './UnifiedStageConsole.tsx';
import './footprints-stage-workspace.css';
import './source-screen.css';
import './compact-stage.css';

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
 onOpenProjection:()=>void;
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
 performerCount,onPerformerCount,onStartBody,onOpenSimulator,onOpenLiveFloor,onOpenProjection,
 onPhoneStream,onPhoneDisconnect,onEnterOperator,
 onBlackout,onToggleCamera,onRecordVideo,onCapture,videoRecording,canRecordVideo,
 operatorMode,onExitOperator,footprint,updateFootprint
}:Props){
 const cameraCanvas=useRef<HTMLCanvasElement>(null);
 const bodyCanvas=useRef<HTMLCanvasElement>(null);
 const floorCanvas=useRef<HTMLCanvasElement>(null);
 const stageSession=useStageSession();
 const [setupOpen,setSetupOpen]=useState(false);
 const [flowStep,setFlowStep]=useState<FootprintsStep>('input');
 const [inspectorOpen,setInspectorOpen]=useState(false);
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
 const [operatorCue,setOperatorCue]=useState(0);
 const [floorStatus,setFloorStatus]=useState<LiveFloorStatus>(()=>tracker.status);
 const [identityStatus,setIdentityStatus]=useState<MultiPoseStatus>(()=>router.status);
 const [maskStatus,setMaskStatus]=useState('Kamera belum terhubung');
 const [bodyVisible,setBodyVisible]=useState(0);
 const [frameFresh,setFrameFresh]=useState(false);
 const [videoReady,setVideoReady]=useState(false);
 const [viewError,setViewError]=useState('');
 const [dualRaw,setDualRaw]=useState(readDualOutputStatus);
 const hardwareEnabled=stageHardwareAvailable(import.meta.env.DEV,
  import.meta.env.VITE_SOMA_STAGE_OUTPUTS);
 useEffect(()=>watchDualOutputStatus(()=>setDualRaw(readDualOutputStatus())),[]);
 const showArchive=()=>{
  setFlowStep('compose');setSetupOpen(false);setInspectorOpen(false);
  setView('archive');
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
   const videoAvailable=!!(cameraOn&&v&&v.readyState>=2&&v.videoWidth&&v.videoHeight);
   setVideoReady(prev=>prev===videoAvailable?prev:videoAvailable);
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
 const setupTrigger=useRef<HTMLElement|null>(null);
 const restoreFlowFocus=()=>{
  window.requestAnimationFrame(()=>{
   const target=setupTrigger.current;
   if(target?.isConnected)target.focus({preventScroll:true});
   else document.querySelector<HTMLButtonElement>('.fp-flow-local-tabs button[aria-current="step"]')
    ?.focus({preventScroll:true});
   setupTrigger.current=null;
  });
 };
 const closeSetup=()=>{setSetupOpen(false);setInspectorOpen(false);restoreFlowFocus();};
 const closeInspector=()=>{setSetupOpen(false);setInspectorOpen(false);restoreFlowFocus();};
 useEffect(()=>{
  const request=navigationRequest;
  if(!request||lastNavRequest.current===request.id)return;
  lastNavRequest.current=request.id;
  setSetupOpen(false);setVideoLabOpen(false);setRehearsalOpen(false);
  setComposerOpen(false);
  onBlackout();
  switch(request.tool){
   case 'live':setView('stage');setFlowStep('input');setInspectorOpen(false);break;
   case 'setup':setView('stage');setFlowStep('input');setInspectorOpen(true);setSetupOpen(true);break;
   case 'archival-mapping':showArchive();break;
   case 'composer':setView('stage');setFlowStep('compose');setComposerOpen(true);break;
   case 'video':setView('stage');setFlowStep('input');setVideoLabOpen(true);break;
   case 'rehearsal':setView('stage');setFlowStep('process');setRehearsalOpen(true);break;
   case 'simulator':setView('stage');onOpenSimulator();break;
   case 'calibration':setView('stage');setFlowStep('process');onOpenLiveFloor();break;
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
 const selectFlowStep=(step:FootprintsStep)=>{
  const reselect=flowStep===step&&inspectorOpen&&!setupOpen&&view==='stage';
  setFlowStep(step);setInspectorOpen(!reselect&&(step==='input'?cameraOn:true));
  setSetupOpen(false);
  setView('stage');setVideoLabOpen(false);setRehearsalOpen(false);setComposerOpen(false);
 };
 const openPhoneInput=()=>{
  setupTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  stageSession.patch({source:'phone'});
  setFlowStep('input');setView('stage');setInspectorOpen(true);setSetupOpen(true);
  setVideoLabOpen(false);setRehearsalOpen(false);setComposerOpen(false);
 };
 const openVideoInput=()=>{
  onBlackout();setFlowStep('input');setView('stage');
  setInspectorOpen(false);setSetupOpen(false);setComposerOpen(false);setRehearsalOpen(false);
  setVideoLabOpen(true);
 };
 const sourceMode=deriveSourceScreenMode({
  cameraOn,cameraBusy,cameraError,bodySelected,videoReady
 });
 const compactItems=compactFootprintsReadiness({
  cameraOn,cameraBusy,cameraError,bodySelected,frameFresh,
  visibleCount:identityStatus.visible.length,performerCount,
  identityAmbiguous:identityStatus.ambiguous,
  identityMatchedFrame:identityStatus.observedFrameTime===frameRef.current.time,
  floorCalibrated:floorStatus.calibrated,floorConfirmed:floorStatus.confirmed,cameraMatched
 });
 const sourcePickerVisible=!operatorMode&&!setupOpen&&showsSourcePicker(sourceMode);
 const gaitPreviewVisible=showsGaitPreviews(sourceMode);
 const screenMode=operatorMode?'operator':setupOpen?'setup':sourcePickerVisible?'source':
  gaitPreviewVisible?'live':'preparing';
 return <section className={'fp-stage-workspace'+(operatorMode?' fp-operator-mode':'')+(setupOpen&&!operatorMode?' fp-setup-docked':'')}
  data-operator-cue={operatorCueAt(operatorCue).id} data-context={setupOpen?'setup':'inspector'}
  data-inspector-open={inspectorOpen&&!operatorMode} data-source-ready={operatorMode||gaitPreviewVisible}
  data-screen={screenMode} data-source-mode={sourceMode}
  data-flow={flowStep} data-utility={videoLabOpen?'video':rehearsalOpen?'rehearsal':composerOpen?'composer':'none'}
  aria-label="Workspace utama SOMA Footprints">
  {!operatorMode&&<nav className="fp-flow-nav" aria-label="Pengaturan Footprints">
   <div className="fp-flow-nav-left">
    <span className="fp-flow-name">FOOTPRINTS</span>
    {setupOpen?<span className="fp-flow-guide-label">Guided Setup · Kamera dan kalibrasi</span>:
    <div className="fp-flow-local-tabs" role="group" aria-label="Bagian kerja Footprints">
     {footprintsSteps.map(item=><button type="button" key={item.id}
      aria-current={flowStep===item.id?'step':undefined}
      aria-expanded={flowStep===item.id&&inspectorOpen}
      aria-controls={flowStep===item.id&&inspectorOpen?'fp-context-panel':undefined}
      onClick={()=>selectFlowStep(item.id)} title={item.hint}>
      {item.title}</button>)}
    </div>}
   </div>
   {!setupOpen&&<CompactFootprintsStatus items={compactItems}
    onSource={()=>{setFlowStep('input');setInspectorOpen(cameraOn);setView('stage');}}
    onProcess={()=>{setFlowStep('process');setInspectorOpen(true);setView('stage');}}/>}
  </nav>}
  {operatorMode?
   <OperatorStageConsole index={operatorCue} onPrevious={previousCue} onNext={nextCue}
    onSelect={setOperatorCue} onExit={onExitOperator} onBlackout={onBlackout}
    held={footprint.hold} onHold={()=>updateFootprint({hold:true})}
    onResume={()=>updateFootprint({hold:false})}
    videoRecording={videoRecording} canRecordVideo={canRecordVideo}
    onRecordVideo={onRecordVideo} units={units}
    contacts={floorStatus.contacts} performerCount={performerCount}/>
   :null}
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
     {sourcePickerVisible&&<FootprintsSourceScreen mode={sourceMode as 'select'|'connecting'|'recover'}
      cameraError={cameraError} onWebcam={onStartBody} onPhone={openPhoneInput}
      onVideo={openVideoInput} onSimulator={onOpenSimulator}/>}
     <div className="fp-stage-video">
      <div className="fp-stage-surface-head"><span>KAMERA · LIVE INPUT</span>
       <small>{sourceMode==='live'?'VIDEO AKTIF':sourceMode==='warming'?'MENYIAPKAN VIDEO':
        sourceMode==='switch-body'?'PERLU MODE BODY':'OFFLINE'}</small></div>
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
       {sourceMode==='switch-body'&&!operatorMode&&<div className="fp-stage-empty fp-source-correction" role="status">
        <Camera size={24} aria-hidden="true"/>
        <strong>Kamera sudah terhubung</strong>
        <p>Aktifkan pelacakan Body untuk membaca gerakan kaki.</p>
        <button type="button" onClick={onStartBody}>
         <Camera size={15} aria-hidden="true"/> Gunakan mode Body</button>
       </div>}
       {sourceMode==='warming'&&!operatorMode&&<div className="fp-stage-empty fp-source-warming" role="status">
        <span className="fp-source-spinner" aria-hidden="true"/>
        <strong>Menyiapkan preview kamera</strong>
        <p>Menunggu frame pertama dari perangkat. Periksa sambungan dan izin kamera.</p>
       </div>}
      </div>
      <div className="fp-stage-surface-foot"><span>{frameFresh?'Pose kamera baru':'Menunggu pose valid'}</span>
       <span>{performerCount} performer</span></div>
     </div>
     <div className="fp-stage-side-previews">
      <div className="fp-stage-surface">
       <div className="fp-stage-surface-head"><span>BODY · MASK PREVIEW</span><small>Lower body</small></div>
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
       <div className="fp-stage-surface-head"><span>FLOOR · PATH PREVIEW</span><small>Metric floor</small></div>
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
     <button type="button" className="fp-flow-back" onClick={()=>{setView('stage');setInspectorOpen(true);setFlowStep('compose');}}>
      ← Kembali ke preview Footprints
     </button>
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
   </div>
   {!operatorMode&&inspectorOpen&&<aside id="fp-context-panel" className="fp-stage-inspector"
    data-mode={setupOpen?'setup':'inspector'} aria-label={setupOpen?'Panduan Footprints':'Pengaturan tahap '+flowStep}>
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
   onVideoLab={()=>{onBlackout();setSetupOpen(false);setInspectorOpen(false);setComposerOpen(false);setView('stage');setVideoLabOpen(true);}}
   onPerform={onEnterOperator}
   cameraOn={cameraOn} calibrated={floorStatus.calibrated}
   confirmed={floorStatus.confirmed} contacts={floorStatus.contacts}/>}
    {!setupOpen&&<FootprintsFlowInspector
     step={flowStep} onClose={closeInspector}
     cameraOn={cameraOn} cameraBusy={cameraBusy} cameraError={cameraError}
     cameraLabel={cameraLabel}
     floorConfirmed={floorStatus.confirmed} floorCalibrated={floorStatus.calibrated}
     cameraMatched={cameraMatched} floorContacts={floorStatus.contacts}
     floorEvents={floorStatus.events} floorReason={floorStatus.reason}
     performerCount={performerCount} onPerformerCount={count=>{
      stageSession.patch({performers:count});onPerformerCount(count);
     }}
     identityAmbiguous={identityStatus.ambiguous} identities={identityStatus.visible.length}
     maskStatus={maskStatus} footprint={footprint} updateFootprint={updateFootprint}
     bodyReady={totalFrames>0&&frameFresh}
     floorReady={floorStatus.confirmed&&cameraMatched}
     projectionReason={legacyGate.reason}
     onStartBody={onStartBody}
     onGuidedSetup={()=>{
      setupTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
      setSetupOpen(true);setInspectorOpen(true);
     }}
     onVideo={()=>{onBlackout();setSetupOpen(false);setInspectorOpen(false);setView('stage');setVideoLabOpen(true);}}
     onSimulation={onOpenSimulator}
     onCalibration={onOpenLiveFloor}
     onRehearsal={()=>{onBlackout();setSetupOpen(false);setInspectorOpen(false);setView('stage');setRehearsalOpen(true);}}
     onMapping={showArchive}
     onComposer={()=>{onBlackout();setSetupOpen(false);setInspectorOpen(false);setView('stage');setComposerOpen(true);}}
     onProjector={onOpenProjection}/>}
   </aside>}
  </div>
  {!operatorMode&&<FootprintsStageTransport cameraOn={cameraOn} cameraBusy={cameraBusy}
   frameFresh={frameFresh} videoRecording={videoRecording} canRecordVideo={canRecordVideo}
   bodySelected={bodySelected}
   held={footprint.hold} legacy={legacy} dual={dual} canPreview={view==='stage'}
   onCamera={onToggleCamera} onRecordVideo={onRecordVideo} onCapture={onCapture}
   onHold={()=>updateFootprint({hold:true})}
   onLivePreview={()=>updateFootprint({hold:false})} onBlackout={onBlackout}
   onOutputSettings={onOpenProjection}/>}
 </section>;
}
