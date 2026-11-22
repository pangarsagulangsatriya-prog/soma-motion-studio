import {useCallback,useEffect,useLayoutEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';
import {operatorCueAt,operatorShortcut} from './OperatorStageModel.ts';
import {OperatorStageConsole} from './OperatorStageConsole.tsx';
import {poseFootObservations,type TdFootObservation} from './touchDesignerProtocol.ts';
import {PERFORM_CUE_STORAGE_KEY,defaultPerformCueGrid,normalizePerformCueGrid,updatePerformCueSlot,evaluatePerformReadiness,type PerformCueGrid} from './performCueModel.ts';
import {InlineSetupAssistant} from './InlineSetupAssistant.tsx';
import {safeProjectionPreflight} from './safeProjectionPreflight.ts';
import {startSetupBench} from './safeProjectionBench.ts';
import {inlineSetupHint,type InlineSetupAction} from './inlineSetupModel.ts';
import {InlineFloorCalibration} from './InlineFloorCalibration.tsx';
import {VideoMotionLab} from '../../stage/VideoMotionLab.tsx';
import {RehearsalComparisonLab} from '../../stage/RehearsalComparisonLab.tsx';
import type {ReplayReport} from '../../stage/rehearsalComparisonModel.ts';
import {SurfaceComposer} from './SurfaceComposer.tsx';
import {useSharedAssetRegistry} from './useSharedAssetRegistry.ts';
import {useComposeMonitorLayout,type ComposeLayoutPreset} from './useComposeMonitorLayout.ts';
import {StageModuleNav,type StageModuleWorkspace} from './StageModuleNav.tsx';
import {useStageSession} from '../../stage/useStageSession.ts';
import {Camera,Film,Layers3,MonitorPlay,Maximize2,Minimize2,ChevronDown} from 'lucide-react';
import {PerformFinalPreview} from './PerformFinalPreview.tsx';
import {cameraDeviceLabel} from '../../engine/universalCamera.ts';
import {STAGE_PREVIEW_MODES,parseStagePreviewMode,previewLabel,type StagePreviewMode} from './stagePreviewModel.ts';
import {isDismissEscape,shouldOpenInspector} from './interactionPolicy.ts';
import {FootprintsExperimentalSource} from './FootprintsExperimentalSource.tsx';
import {DirectPuppetSession} from '../../footprints/simulator/puppet-controller.ts';
import {activeExperimentKind,currentExperimentFrameForClip,canPaintVideoFrame,experimentFrameLabel,type ExperimentalFrame} from './experimentSourceModel.ts';
import {paintExperimentBody,paintExperimentCamera,paintExperimentFloor} from './experimentStagePainter.ts';
import {drawSkeletonBodies} from '../../stage/fullBodySkeleton.ts';
import {ActorMotionStateBuffer} from '../../stage/actorMotionStateBuffer.ts';
import {FootprintsVideoOpticalFlow} from '../../stage/footprintsVideoOpticalFlow.ts';
import {PersistentBodyMaskEngine} from '../../stage/persistentBodyMaskEngine.ts';
import {LiveBodyProjectionBridge} from '../../stage/liveBodyProjectionBridge.ts';
import {PhoneCameraReceiver} from '../../stage/PhoneCameraReceiver.tsx';
import {SOURCE_CHOICES,type FootprintsInputChoice,type FootprintsInputStatus} from './sourceSwitchModel.ts';
import {trackStatus} from './trackViewModel.ts';
import {liveSkeletonPresentation,observedLiveTorso} from './trackFeedbackModel.ts';
import {useTrackFeedbackPulse} from './useTrackFeedbackPulse.ts';
import {trackStatusOwnership} from './trackStatusOwnership.ts';
import {deriveSourceScreenMode,showsSourcePicker,showsGaitPreviews} from './sourceScreenModel.ts';
import {FootprintsFlowInspector} from './FootprintsFlowInspector.tsx';
import type {FootprintsStep} from './footprintsFlow.ts';
import type {StageNavigationRequest} from './stageNavigation.ts';
import type {Point} from '../../projection/geometry.ts';
import type {MotionFrame} from '../../engine/types.ts';
import type {Projection} from '../../projection/useProjection.ts';
import type {LiveFloorTrackingEngine,LiveFloorStatus} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter,MultiPoseStatus} from '../../footprints/live/MultiPoseGaitRouter.ts';
import {paintFloorCanvas} from '../../footprints/simulator/floorCanvas.ts';
import {FloorInteractionEngine,type FloorInteractionSource} from '../../footprints/scenes/FloorInteractionEngine.ts';
import {floorPointerCoordinates} from '../../footprints/scenes/floorPointerCoordinates.ts';
import {feedLiveFloorInteractions,feedVideoFloorInteractions,feedSimulatorFloorInteractions,
 feedTouchFloorInteraction,paintFloorInteractionOverlay} from '../../footprints/scenes/interactionAdapters.ts';
import {buildLowerBodyMask,LOWER_BODY_MASK_DEFAULTS} from '../../footprints/stage-optics/LowerBodyMaskEngine.ts';
import {ArchivalMappingPanel} from '../../footprints/stage-optics/ArchivalMappingPanel.tsx';
import {stageBodyPreviewGate} from './footprintsUX.ts';
import type {FootprintConfig} from '../../footprints/StudioFootprints.tsx';
import {cameraBinding,cameraBindingKey} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import {readDualOutputStatus,watchDualOutputStatus,verifiedDualStatus} from '../../footprints/stage-optics/DualSurfaceTelemetry.ts';
import {stageHardwareAvailable} from '../../footprints/stage-optics/StageHardwareGate.ts';
import {deriveUnifiedStageStatus,legacyStageTransportGate,type LegacyOutputStatus} from './unifiedStageStatus.ts';
import './footprints-stage-workspace.css';
import './source-screen.css';
import './compact-stage.css';
import './interaction-refinement.css';
import './source-switcher-layout.css';
import './persistent-stage-workspace.css';
import './inline-setup-assistant.css';
import './s6-8-7-simplified-stage.css';
import './s6-8-8-1-full-skeleton.css';
import './ux-r1-stage.css';
import './floor-interaction.css';
import './ia-r1-four-workspaces.css';
import './track-compact.css';
import './trk02-layout.css';
import './trk03-source-flow.css';
import './trk04-feedback.css';
import './trk06-control-polish.css';
import './trk06a-status-ownership.css';
import './trk06c-micro-feedback.css';
import './trk07-functional-layout.css';
import './trk08-mp4-compact.css';
import './trk09-ux-polish.css';
import './cp01-compose-shell.css';
import './cp02-cp03-composition.css';
import './cp04-compose-microinteraction.css';
import './cpux-compose-focus.css';

type WorkspaceView='stage'|'archive';
type Props={
 navigationRequest?:StageNavigationRequest|null;
 onActiveToolChange?:(tool:StageNavigationRequest['tool'])=>void;
 onNavigateStageWorkspace:(workspace:StageModuleWorkspace)=>void;
 frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 tracker:LiveFloorTrackingEngine;router:MultiPoseGaitRouter;projection:Projection;
 audioAnalyser?:AnalyserNode|null;
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;bodySelected:boolean;legacyApproved:boolean;
 cameraDevices:MediaDeviceInfo[];selectedCameraId:string;
 onSelectCameraDevice:(deviceId:string)=>Promise<void>;
 phoneActive:boolean;sourceStatus:FootprintsInputStatus;
 experimentPuppet:DirectPuppetSession;experimentPuppetRevision:number;
 onSwitchSource:(choice:FootprintsInputChoice)=>Promise<boolean>;
 performerCount:1|2;onPerformerCount:(count:1|2)=>void;
 onStartBody:()=>void;onOpenSimulator:()=>void;onOpenLiveFloor:()=>void;
 onOpenProjection:()=>void;
 onPhoneStream:(stream:MediaStream)=>Promise<void>|void;
 onPhoneInterrupted:()=>void;onPhoneDisconnect:()=>void;onRotatePhone:()=>void;onMirrorCamera:()=>void;onEnterOperator:()=>void;
 onBlackout:()=>void;onToggleCamera:()=>void;onRecordVideo:()=>void;onCapture:()=>void;
 operatorMode:boolean;onExitOperator:()=>void;
 softwareBlackout:boolean;onResumeSoftwarePreview:()=>void;
 videoRecording:boolean;canRecordVideo:boolean;
 footprint:FootprintConfig;
 updateFootprint:(value:Partial<FootprintConfig>)=>void;
};
const blockedReason=(cameraOn:boolean,calibrated:boolean,confirmed:boolean)=>
 !cameraOn?'Kamera Body belum aktif.':!calibrated?'Lantai belum dikalibrasi.':
 !confirmed?'Konfirmasi kalibrasi lantai.':'Menunggu event pijakan.';
export function FootprintsStageWorkspace({
 navigationRequest,onActiveToolChange,onNavigateStageWorkspace,frameRef,videoRef,tracker,router,projection,audioAnalyser,cameraOn,cameraBusy,cameraError,bodySelected,legacyApproved,
 cameraDevices,selectedCameraId,onSelectCameraDevice,
 phoneActive,sourceStatus,onSwitchSource,experimentPuppet,experimentPuppetRevision,
 performerCount,onPerformerCount,onStartBody,onOpenSimulator,onOpenLiveFloor,onOpenProjection,
 onPhoneStream,onPhoneInterrupted,onPhoneDisconnect,onRotatePhone,onMirrorCamera,
 onBlackout,onToggleCamera,onRecordVideo,onCapture,videoRecording,canRecordVideo,
 operatorMode,onExitOperator,softwareBlackout,onResumeSoftwarePreview,footprint,updateFootprint
}:Props){
 const composeLayout=useComposeMonitorLayout();
 const cameraCanvas=useRef<HTMLCanvasElement>(null);
 const composeFloorOverlay=useRef<HTMLCanvasElement>(null);
 const [showComposeEvents,setShowComposeEvents]=useState(true);
 const bodyCanvas=useRef<HTMLCanvasElement>(null);
 const floorCanvas=useRef<HTMLCanvasElement>(null);
 const cleanFloorOutput=useRef<HTMLCanvasElement|null>(null);
 const performBodyRaster=useRef<HTMLCanvasElement>(null);
 const performFloorRaster=useRef<HTMLCanvasElement>(null);
 const interactionCanvas=useRef<HTMLCanvasElement>(null);
 const interactionEngineRef=useRef(new FloorInteractionEngine());
 const touchPointers=useRef(new Set<number>());
 const [touchDemo,setTouchDemo]=useState(false);
 const [floorInteractionStats,setFloorInteractionStats]=useState({actors:0,contacts:0,events:0});
 const floorScene='footprints' as const;
 cleanFloorOutput.current=floorCanvas.current;
 const stageSession=useStageSession();
 const [calibrationOpen,setCalibrationOpen]=useState(false);
 const [phonePanelOpen,setPhonePanelOpen]=useState(false);
 useEffect(()=>{
  // Connected HP switches directly to the live preview. Receiver stays mounted
  // while the sidebar pairing section is hidden, so the WebRTC track survives.
  if(sourceStatus.selection==='phone')setPhonePanelOpen(!phoneActive);
  else setPhonePanelOpen(false);
 },[sourceStatus.selection,phoneActive]);
 const experimentalKind=activeExperimentKind(sourceStatus.selection);
 const [experimentClip,setExperimentClip]=useState<File|null>(null);
 const [experimentFrame,setExperimentFrame]=useState<ExperimentalFrame|null>(null);
 const experimentFrameRef=useRef<ExperimentalFrame|null>(null);
 const motionBufferRef=useRef<ActorMotionStateBuffer>(new ActorMotionStateBuffer());
 const opticalFlowRef=useRef<FootprintsVideoOpticalFlow>(new FootprintsVideoOpticalFlow());
 const bodyMaskRef=useRef<PersistentBodyMaskEngine>(new PersistentBodyMaskEngine());
 const bodyProjectionRef=useRef<LiveBodyProjectionBridge>(new LiveBodyProjectionBridge());
 useEffect(()=>{
  motionBufferRef.current.reset();
  opticalFlowRef.current.reset();
  bodyMaskRef.current.reset();
  bodyProjectionRef.current.reset();
 },[experimentalKind,experimentClip]);
 const selectedExperimentFrame=currentExperimentFrameForClip(experimentalKind,experimentFrame,experimentClip);
 experimentFrameRef.current=selectedExperimentFrame;
 const sharedAssetRegistry=useSharedAssetRegistry(experimentalKind==='video'?experimentClip:null);
 // Clear old source pixels before the next browser paint, including BODY/FLOOR
 // buffers consumed by Compose. Source changes may not reuse the prior epoch.
 useLayoutEffect(()=>{
  experimentFrameRef.current=null;
  setExperimentFrame(null);
  for(const canvas of [cameraCanvas.current,bodyCanvas.current,floorCanvas.current]){
   const ctx=canvas?.getContext('2d');
   if(canvas&&ctx){ctx.fillStyle='#040806';ctx.fillRect(0,0,canvas.width,canvas.height);}
  }
 },[sourceStatus.selection,experimentClip]);
 // The phone can disconnect without changing the selected source.
 // Clear the live buffer on pairing/error so no old body pixels survive.
 useLayoutEffect(()=>{
  if((sourceStatus.selection!=='webcam'&&sourceStatus.selection!=='phone')||
   sourceStatus.phase==='ready')return;
  for(const canvas of [cameraCanvas.current,bodyCanvas.current,floorCanvas.current]){
   const ctx=canvas?.getContext('2d');
   if(canvas&&ctx){ctx.fillStyle='#040806';ctx.fillRect(0,0,canvas.width,canvas.height);}
  }
 },[sourceStatus.selection,sourceStatus.phase]);
 const interactionSource:FloorInteractionSource|null=touchDemo?'touch':
  experimentalKind??(sourceStatus.selection==='phone'?'phone':
   sourceStatus.selection==='webcam'?'camera':null);
 useEffect(()=>{
  interactionEngineRef.current.reset(interactionSource);
  touchPointers.current.clear();
  setFloorInteractionStats({actors:0,contacts:0,events:0});
 },[interactionSource,experimentClip,sourceStatus.phase]);
 // The same preview event bus accepts all four source adapters and Touch.
 // It draws an independent SOFTWARE overlay; existing FloorSession/projector
 // raster and its hardware authorization are never modified.
 useEffect(()=>{
  let raf=0,lastPaint=0,lastRead=0;
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-lastPaint<1000/24)return;
   lastPaint=now;
   const engine=interactionEngineRef.current;
   const current=experimentFrameRef.current;
   const time=touchDemo?now:
    current?.kind==='video'?(current.video?.currentTime??current.timeMs/1000)*1000:
    current?.kind==='simulator'?current.timeMs:now;
   engine.expire(time);
   const canvas=interactionCanvas.current;
   if(canvas&&!previewHoldRef.current)
    paintFloorInteractionOverlay(canvas,engine,time,Math.max(1200,footprint.life*1000));
   if(now-lastRead>=500){
    lastRead=now;
    const snap=engine.snapshot;
    const next={actors:snap.actors.length,
     contacts:snap.counts.contact+snap.counts.touch,events:snap.events.length};
    setFloorInteractionStats(prev=>prev.actors===next.actors&&
     prev.contacts===next.contacts&&prev.events===next.events?prev:next);
   }
  };
  raf=requestAnimationFrame(draw);
  return()=>cancelAnimationFrame(raf);
 },[touchDemo,footprint.life]);
 const onExperimentFrame=useCallback((frame:ExperimentalFrame|null)=>setExperimentFrame(frame),[]);
 const onExperimentClip=useCallback((clip:File|null)=>{
  experimentFrameRef.current=null;setExperimentFrame(null);setExperimentClip(clip);
 },[]);
 const [flowStep,setFlowStep]=useState<FootprintsStep>('process');
 const [inspectorOpen,setInspectorOpen]=useState(false);
 const [skeletonVisible,setSkeletonVisible]=useState(true);
 const [previewMode,setPreviewMode]=useState<StagePreviewMode>(()=>{
  try{return parseStagePreviewMode(localStorage.getItem('soma-stage-preview-mode-v1'));}
  catch{return 'split';}
 });
 useEffect(()=>{try{localStorage.setItem('soma-stage-preview-mode-v1',previewMode);}catch{}},[previewMode]);
 const [focusPreview,setFocusPreview]=useState<'split'|'body'|'floor'|'input'>('split');
 const restoreFocusRef=useRef<HTMLElement|null>(null);
 const selectPreviewFocus=(pane:'body'|'floor'|'input',trigger?:HTMLElement|null)=>{
  if(focusPreview===pane){setFocusPreview('split');setPreviewMode('split');return;}
  restoreFocusRef.current=trigger??null;
  setFocusPreview(pane);
  // The same canvases and MP4 element remain mounted through every focus change.
  setPreviewMode(pane==='input'?'split':pane);
 };
 useEffect(()=>{
  if(focusPreview==='split')return;
  const onEscape=(event:KeyboardEvent)=>{
   if(event.key!=='Escape'||event.defaultPrevented||
    event.target instanceof HTMLElement&&event.target.closest(
     'input,select,textarea,[contenteditable="true"],dialog,[role="dialog"]'))return;
   event.preventDefault();setFocusPreview('split');setPreviewMode('split');
   restoreFocusRef.current?.focus({preventScroll:true});
  };
  window.addEventListener('keydown',onEscape);
  return()=>window.removeEventListener('keydown',onEscape);
 },[focusPreview]);
 const [calibrationOverlay,setCalibrationOverlay]=useState<{marks:Array<Point|null>;editing:number}|null>(null);
 const calibrationTap=useRef<((x:number,y:number)=>void)|null>(null);
 const bindCalibrationTap=useCallback((handler:((x:number,y:number)=>void)|null)=>{
  calibrationTap.current=handler;
 },[]);
 useEffect(()=>{if(!calibrationOpen)setCalibrationOverlay(null);},[calibrationOpen]);
 const lastNavRequest=useRef(0);
 const [composerOpen,setComposerOpen]=useState(false);
 const [previewResumeRevision,setPreviewResumeRevision]=useState(0);
 const [mappingOpen,setMappingOpen]=useState(false);
 const [composerStartQA,setComposerStartQA]=useState(false);
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
  const tool=calibrationOpen?'setup':videoLabOpen?'video':rehearsalOpen?'rehearsal':
   composerOpen?(mappingOpen?'mapping':'composer'):view==='archive'?'archival-mapping':'tracking';
  onActiveToolChange?.(tool);
 },[calibrationOpen,videoLabOpen,rehearsalOpen,composerOpen,mappingOpen,view,onActiveToolChange,navigationRequest?.tool]);
 const previewHoldRef=useRef(footprint.hold);
 previewHoldRef.current=footprint.hold;
 const [operatorCue,setOperatorCue]=useState(0);
 const [performGrid,setPerformGrid]=useState<PerformCueGrid>(()=>{
  try{return normalizePerformCueGrid(JSON.parse(localStorage.getItem(PERFORM_CUE_STORAGE_KEY)??'null'));}
  catch{return defaultPerformCueGrid();}
 });
 const [activePerformSlot,setActivePerformSlot]=useState(0);
 const [performMessage,setPerformMessage]=useState('');
 const [performBlackout,setPerformBlackout]=useState(false);
 const applyPerformSlot=(index:number)=>{
  const slot=performGrid.slots[index];if(!slot)return;
  // Cue loads scene/layout only, never hardware light permissions.
  setOperatorCue(['overview','body','floor','split'].indexOf(slot.view));
  setActivePerformSlot(index);setPerformMessage('Cue '+(index+1)+' diterapkan. Output fisik mengikuti QA Map.');
 };
 const savePerformGrid=()=>{
  try{localStorage.setItem(PERFORM_CUE_STORAGE_KEY,JSON.stringify(performGrid));
   setPerformMessage('Cue tersimpan lokal; izin LIVE dan QA tidak disimpan.');
  }catch{setPerformMessage('Penyimpanan cue di browser gagal.');}
 };
 const resetPerformGrid=()=>{
  setPerformGrid(defaultPerformCueGrid());setActivePerformSlot(0);
  try{localStorage.removeItem(PERFORM_CUE_STORAGE_KEY);}catch{}
  setPerformMessage('Cue dikembalikan ke default; output fisik tetap terkunci menurut QA.');
 };
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
  setFlowStep('compose');setCalibrationOpen(false);setInspectorOpen(false);
  setView('archive');
 };
 useEffect(()=>{
  if(!operatorMode)return;
  // Stage 1 local navigation may bypass App's global nav. Always fail closed
  // for physical projector transport, without blacking out software preview.
  onBlackout();
  // Archive unmounts when entering Perform; its dual windows are also
  // disarmed by the App-level global Blackout before the mode is changed.
  setCalibrationOpen(false);
  // Keep the Compose renderer mounted while Perform shows its final raster.
  // Map's editor closes, but the art recipe, media and event timeline remain alive.
  setMappingOpen(false);
  setSkeletonVisible(false); // Perform input defaults to the original camera image.
  setView('stage');setOperatorCue(0);setActivePerformSlot(0);
  if(performUnsafeRef.current||softwareBlackout){
   setPerformBlackout(true);updateFootprint({hold:true});
  }else{
   setPerformBlackout(false);updateFootprint({hold:false});
  }
 },[operatorMode]);
 const nextCue=()=>applyPerformSlot(Math.min(performGrid.slots.length-1,activePerformSlot+1));
 const previousCue=()=>applyPerformSlot(Math.max(0,activePerformSlot-1));
 const cueNavigationRef=useRef({next:nextCue,previous:previousCue});
 cueNavigationRef.current={next:nextCue,previous:previousCue};
 const operatorBlackout=()=>{onBlackout();setPerformBlackout(true);updateFootprint({hold:true});};
 const onBlackoutRef=useRef(operatorBlackout);
 onBlackoutRef.current=operatorBlackout;
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
   if(action==='next')cueNavigationRef.current.next();
   if(action==='previous')cueNavigationRef.current.previous();
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
   if(experimentalKind)return;
   if(now-lastDraw<1000/18)return;
   lastDraw=now;
   const f=frameRef.current,v=videoRef.current;
   const identities=router.status;
   const cameraSourceReady=cameraOn&&sourceStatus.phase==='ready'&&
    (sourceStatus.selection==='webcam'||sourceStatus.selection==='phone');
   if(!touchDemo&&cameraSourceReady&&bodySelected){
    const binding=cameraBinding(v);
    feedLiveFloorInteractions(interactionEngineRef.current,{
     source:sourceStatus.selection==='phone'?'phone':'camera',
     frame:f,identity:identities,performerCount,tracker,
     cameraMatched:!!binding&&tracker.boundCamera===cameraBindingKey(binding),
     videoAspect:v?.videoWidth&&v.videoHeight?v.videoWidth/v.videoHeight:16/9,
     nowMs:now
    });
   }
   const gate=stageBodyPreviewGate({
    cameraOn:cameraSourceReady&&bodySelected,tracked:f.tracked,source:f.source,ageMs:now-f.time,
    performerCount,visibleCount:identities.visible.length,
    identityAmbiguous:identities.ambiguous,matchedFrame:identities.observedFrameTime===f.time
   });
   // Track 2P uses real raw torso observations even when the legacy
   // single-pose aggregator says tracked=false. Projector gates stay separate.
   const rawObserved=performerCount===2?observedLiveTorso(f):f.tracked;
   const fresh=cameraSourceReady&&bodySelected&&f.source==='camera'&&rawObserved&&
    f.time<=now&&now-f.time<450;
   setFrameFresh(prev=>prev===fresh?prev:fresh);
   const videoAvailable=!!(cameraSourceReady&&v&&v.readyState>=2&&v.videoWidth&&v.videoHeight);
   setVideoReady(prev=>prev===videoAvailable?prev:videoAvailable);
   const camera=cameraCanvas.current,cam=camera?.getContext('2d');
   if(camera&&cam){
    cam.fillStyle='#050807';cam.fillRect(0,0,camera.width,camera.height);
    if(videoAvailable&&v&&v.readyState>=2&&v.videoWidth&&v.videoHeight){
     const scale=Math.min(camera.width/v.videoWidth,camera.height/v.videoHeight);
     const w=v.videoWidth*scale,h=v.videoHeight*scale;
     try{cam.drawImage(v,(camera.width-w)/2,(camera.height-h)/2,w,h);}
     catch{/* Video can briefly detach on source changes. */}
     // Diagnostic only: uses latest raw CameraTracker poses, never the
     // physical BODY/FLOOR output, gait event gate or projector approval.
     if(skeletonVisible&&!calibrationOpen&&f.source==='camera'&&f.time>0&&
      now>=f.time&&now-f.time<450){
      const actorFeedback=trackingFeedbackRef.current;
      // Color A/B only once the visible identity/landmark state is confirmed.
      const identityConfirmed=actorFeedback.state==='ready'||
       (actorFeedback.state==='framing'&&
        actorFeedback.actors.length===performerCount&&
        actorFeedback.actors.every(a=>a.state==='visible'||a.state==='partial'));
      const presentation=liveSkeletonPresentation(f,identities,performerCount,identityConfirmed);
      drawSkeletonBodies(cam,presentation.poses,
       {x:(camera.width-w)/2,y:(camera.height-h)/2,width:w,height:h},
       {colors:presentation.colors});
     }
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
 },[frameRef,videoRef,tracker,router,cameraOn,bodySelected,performerCount,experimentalKind,skeletonVisible,calibrationOpen,touchDemo,sourceStatus.selection,sourceStatus.phase]);
 // S0.2/S0.3: AI snapshots update a per-actor motion buffer; software
 // canvases paint at DISPLAY refresh (rAF), not only on AI arrival or 30 FPS.
 // FLOOR continues to render only measured contact events.
 useEffect(()=>{
  if(experimentalKind!=='video')return;
  let raf=0,lastFloorAt=-Infinity,lastVideoAt=-1;
  let source:HTMLVideoElement|null=null,wasSeeking=false;
  const buffer=motionBufferRef.current;
  const flowTracker=opticalFlowRef.current;
  const maskTracker=bodyMaskRef.current;
  const bodyBridge=bodyProjectionRef.current;
  const cam=cameraCanvas.current,body=bodyCanvas.current,floor=floorCanvas.current;
  const draw=(now:number)=>{
   const current=experimentFrameRef.current;
   if(current?.kind==='video'){
    const atMs=(current.video?.currentTime??current.timeMs/1000)*1000;
    const frame={...current,timeMs:atMs};
    const sourceChanged=source!==current.video;
    const movedBackwards=lastVideoAt>=0&&atMs<lastVideoAt-50;
    const seeking=!!current.video?.seeking;
    const seekStarted=seeking&&!wasSeeking;
    // Drop pre-seek events before sampling a new frame. Seeking frames are not
    // allowed to create contacts; a changed playback epoch must start clean.
    if(sourceChanged||movedBackwards||seekStarted){
     buffer.reset();flowTracker.reset();maskTracker.reset();bodyBridge.reset();lastFloorAt=-Infinity;
     if(!touchDemo)interactionEngineRef.current.reset('video');
    }
    source=current.video;
    lastVideoAt=atMs;wasSeeking=seeking;
    // Never paint last webcam/MP4 pixels while metadata loads or the decoder seeks.
    if(!canPaintVideoFrame(current)){
     for(const canvas of [cam,body,floor]){
      const ctx=canvas?.getContext('2d');
      if(canvas&&ctx){ctx.fillStyle='#040806';ctx.fillRect(0,0,canvas.width,canvas.height);}
     }
     raf=requestAnimationFrame(draw);
     return;
    }
    if(!touchDemo)
     feedVideoFloorInteractions(interactionEngineRef.current,frame);
    if(!current.video?.seeking&&current.snapshot){
     buffer.ingest(current.snapshot);
     maskTracker.ingest({atMs:current.snapshot.atMs,
      segment:current.snapshot.segment,
      persistentActors:current.snapshot.persistentActors});
    }
    // S0.6.2: camera decoder provides intermediate frames while the AI worker
    // samples more slowly. Optical flow is strictly a BODY visual translation.
    const flow=current.video&&!current.video.seeking?
     flowTracker.step(current.video,atMs,current.snapshot?.persistentActors??[]):undefined;
    const motion=buffer.present(atMs,flow);
    // S0.6.3: independent A/B alpha masks track pixel flow through
    // short AI gaps, with no contact/identity/hardware side effects.
    const masks=maskTracker.present(atMs,flow);
    // S0.6.5: one per-actor continuity gate owns the clean BODY output.
    // INPUT remains a diagnostic display of all raw observations.
    const bodyOutput=current.snapshot&&!current.video?.seeking?
     bodyBridge.present({atMs,segment:current.snapshot.segment,masks,
      actorStates:current.snapshot.actorStates,
      persistentActors:current.snapshot.persistentActors??[]}):null;
    if(cam)paintExperimentCamera(cam,frame,skeletonVisible,motion,masks);
    if(body&&!footprint.hold)paintExperimentBody(body,frame,skeletonVisible,
     motion,bodyOutput??undefined,true);
    if(floor&&!footprint.hold&&current.snapshot?.atMs!==lastFloorAt){
     paintExperimentFloor(floor,frame,footprint);
     lastFloorAt=current.snapshot?.atMs??-Infinity;
    }
   }else{
    for(const canvas of [cam,body,floor]){
     if(!canvas)continue;
     const ctx=canvas.getContext('2d');
     if(ctx){ctx.fillStyle='#040806';ctx.fillRect(0,0,canvas.width,canvas.height);}
    }
   }
   raf=requestAnimationFrame(draw);
  };
  raf=requestAnimationFrame(draw);
  return()=>cancelAnimationFrame(raf);
 },[experimentalKind,footprint,skeletonVisible,touchDemo]);
 useEffect(()=>{
  if(experimentalKind!=='simulator')return;
  const cam=cameraCanvas.current,body=bodyCanvas.current,floor=floorCanvas.current;
  const frame=experimentFrameRef.current;
  if(!frame||frame.kind!=='simulator')return;
  if(!touchDemo)feedSimulatorFloorInteractions(interactionEngineRef.current,frame);
  if(cam)paintExperimentCamera(cam,frame,skeletonVisible);
  if(!footprint.hold){
   if(body)paintExperimentBody(body,frame,skeletonVisible);
   if(floor)paintExperimentFloor(floor,frame,footprint);
  }
 },[experimentalKind,experimentFrame,footprint,skeletonVisible,touchDemo]);
 const floorPointer=(event:PointerEvent<HTMLDivElement>,kind:'down'|'move'|'up')=>{
  if(!touchDemo||operatorMode)return;
  const target=event.currentTarget;
  const surface=floorCanvas.current;
  const rect=surface?.getBoundingClientRect()??target.getBoundingClientRect();
  const uv=floorPointerCoordinates(event.clientX,event.clientY,rect);
  if(!uv)return;
  if(kind==='down'){
   if(!uv.inside)return; // Ignore letterboxed empty space.
   event.preventDefault();event.stopPropagation();
   target.setPointerCapture(event.pointerId);
   touchPointers.current.add(event.pointerId);
  }else if(!touchPointers.current.has(event.pointerId))return;
  feedTouchFloorInteraction(interactionEngineRef.current,{
   kind,pointerId:event.pointerId,x:uv.x,y:uv.y,atMs:performance.now()
  });
  if(kind==='up'){
   touchPointers.current.delete(event.pointerId);
   if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);
  }
 };
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
 const performReadiness=evaluatePerformReadiness({
  source:sourceStatus.selection,
  cameraOk:experimentalKind?Boolean(selectedExperimentFrame&&
    (selectedExperimentFrame.kind==='simulator'||canPaintVideoFrame(selectedExperimentFrame))):cameraOn&&bodySelected&&frameFresh&&!cameraBusy,
  identityOk:experimentalKind?Boolean(selectedExperimentFrame&&
   (selectedExperimentFrame.kind==='simulator'||canPaintVideoFrame(selectedExperimentFrame))):
   performerCount===1?!identityStatus.ambiguous:
   identityStatus.visible.length===2&&!identityStatus.ambiguous&&
   identityStatus.observedFrameTime===frameRef.current.time,
  floorOk:experimentalKind?Boolean(selectedExperimentFrame&&
   (selectedExperimentFrame.kind==='simulator'||canPaintVideoFrame(selectedExperimentFrame))):
   floorStatus.confirmed&&cameraMatched,
  bodyOutputQa:dual.body.connected&&dual.body.qa==='within-provisional-target',
  floorOutputQa:dual.floor.connected&&dual.floor.qa==='within-provisional-target'
 });
 const performUnsafe=performReadiness.state==='attention';
 const performUnsafeRef=useRef(performUnsafe);
 performUnsafeRef.current=performUnsafe;
 useEffect(()=>{
  if(!operatorMode||!performUnsafe)return;
  onBlackoutRef.current();setPerformBlackout(true);
  updateFootprint({hold:true});
 },[operatorMode,performUnsafe]);
 const legacyGate=legacyStageTransportGate({
  cameraOn,frameFresh,floorConfirmed:floorStatus.confirmed,cameraMatched,
  dualOpened:dual.body.opened||dual.floor.opened,legacy
 });
 const projectionPreflight=safeProjectionPreflight({
  source:sourceStatus.selection,cameraOn,cameraBusy,bodySelected,
   frameFresh:experimentalKind?Boolean(selectedExperimentFrame&&
    (selectedExperimentFrame.kind==='simulator'||canPaintVideoFrame(selectedExperimentFrame))):frameFresh,
   identities:performerCount===1?
   (frameFresh&&frameRef.current.pose.length>=29?1:0):identityStatus.visible.length,
  performers:performerCount,identityAmbiguous:identityStatus.ambiguous,
  matchedFrame:performerCount===1||
   identityStatus.observedFrameTime===frameRef.current.time,
  floorConfirmed:floorStatus.confirmed,cameraMatched,
  hardwareEnabled,floorOutput:dual.floor
 });
 const setupTrigger=useRef<HTMLElement|null>(null);
 const restoreFlowFocus=()=>{
  window.requestAnimationFrame(()=>{
   const target=setupTrigger.current;
   if(target?.isConnected)target.focus({preventScroll:true});
   else document.querySelector<HTMLButtonElement>('.soma-ia-advanced-button')
    ?.focus({preventScroll:true});
   setupTrigger.current=null;
  });
 };
 const closeCalibration=()=>{
  setCalibrationOpen(false);setInspectorOpen(true);restoreFlowFocus();
 };
 const closePhonePanel=()=>{
  setPhonePanelOpen(false);
  requestAnimationFrame(()=>(document.querySelector<HTMLElement>(
   '.soma-track-side-action')??document.querySelector<HTMLElement>(
   '.soma-ux01-source-switch > summary'))?.focus({preventScroll:true}));
 };
 const closeInspector=()=>{setCalibrationOpen(false);setInspectorOpen(false);restoreFlowFocus();};
 useEffect(()=>{
  const request=navigationRequest;
  if(!request||lastNavRequest.current===request.id)return;
  lastNavRequest.current=request.id;
  setCalibrationOpen(false);setVideoLabOpen(false);setRehearsalOpen(false);
  setComposerOpen(false);setMappingOpen(false);
  if(request.tool!=='tracking'&&request.tool!=='composer'&&request.tool!=='mapping')onBlackout();
  switch(request.tool){
   case 'live':
   case 'tracking':setView('stage');setFlowStep('process');setInspectorOpen(false);break;
   case 'setup':setView('stage');setFlowStep('process');setInspectorOpen(true);setCalibrationOpen(true);break;
   case 'archival-mapping':showArchive();break;
   case 'composer':setView('stage');setFlowStep('compose');setInspectorOpen(false);setComposerOpen(true);setMappingOpen(false);break;
   case 'mapping':setView('stage');setFlowStep('compose');setInspectorOpen(false);setComposerOpen(true);setMappingOpen(true);setComposerStartQA(true);break;
   case 'video':setView('stage');setFlowStep('input');setVideoLabOpen(true);break;
   case 'rehearsal':setView('stage');setFlowStep('process');setRehearsalOpen(true);break;
   case 'simulator':setView('stage');onOpenSimulator();break;
   case 'calibration':setView('stage');setFlowStep('process');onOpenLiveFloor();break;
  }
 },[navigationRequest]);
 const onMainCameraPoint=(event:PointerEvent<HTMLCanvasElement>)=>{
  if(!calibrationOpen||!calibrationOverlay||!calibrationTap.current||!cameraOn)return;
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
 const selectFlowStep=(step:FootprintsStep,trigger?:HTMLElement|null,forceOpen=false)=>{
  // MP4 Tracking is an automatic operator surface, never a settings wizard.
  // The Visual tab retains creative recipe controls; QA remains in SOMA Labs.
  if(experimentalKind==='video'&&step==='process'){
   setFlowStep(step);setInspectorOpen(false);setCalibrationOpen(false);
   setView('stage');setVideoLabOpen(false);
   setRehearsalOpen(false);setComposerOpen(false);
   return;
  }
  const reselect=flowStep===step&&inspectorOpen&&!calibrationOpen&&view==='stage';
  if((!reselect||forceOpen)&&trigger)setupTrigger.current=trigger;
  setFlowStep(step);
  setInspectorOpen(shouldOpenInspector({
   sameStep:reselect,panelOpen:inspectorOpen,cameraOn,step,forceOpen
  }));
  setCalibrationOpen(false);
  setView('stage');setVideoLabOpen(false);setRehearsalOpen(false);setComposerOpen(false);
 };
 const chooseSource=async(choice:FootprintsInputChoice):Promise<boolean>=>{
  const accepted=await onSwitchSource(choice);
  if(!accepted)return false;
  setView('stage');setCalibrationOpen(false);setInspectorOpen(false);
  setPhonePanelOpen(choice==='phone');
  setVideoLabOpen(false);setRehearsalOpen(false);setComposerOpen(false);
  return true;
 };
 const openProjectorQA=()=>{
  onBlackout();setCalibrationOpen(false);setInspectorOpen(false);
  setView('stage');setComposerStartQA(true);setMappingOpen(true);setComposerOpen(true);
 };
 const openVideoInput=()=>{void chooseSource('video');};
 const openSimulatorInput=()=>{void chooseSource('simulator');};
 const openCalibration=()=>{
  setupTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setFlowStep('process');setPhonePanelOpen(false);setView('stage');
  setInspectorOpen(true);setCalibrationOpen(true);
 };
 /** Single guided action: check current state; existing QA retains optical permission. */
 const prepareProjection=()=>{
  // Start the end-to-end supervised timer on the first setup action.
  // It never proves physical correctness without operator UAT signoff.
  try{startSetupBench(sessionStorage,Date.now());}catch{}
  switch(projectionPreflight.action){
   case 'choose-camera':
    if(!cameraBusy)void chooseSource(sourceStatus.selection==='phone'?'phone':'webcam');
    break;
   case 'inspect-tracking':selectFlowStep('process',undefined,true);break;
   case 'confirm-floor':openCalibration();break;
   case 'open-output-qa':
   case 'monitor-output':openProjectorQA();break;
  }
 };
 const sourceMode=deriveSourceScreenMode({
  cameraOn,cameraBusy,cameraError,bodySelected,videoReady
 });
 const sourcePickerVisible=!operatorMode&&!calibrationOpen&&!experimentalKind&&showsSourcePicker(sourceMode);
 const gaitPreviewVisible=!!experimentalKind||showsGaitPreviews(sourceMode);
 const screenMode=operatorMode?'operator':calibrationOpen?'setup':sourcePickerVisible?'source':
  gaitPreviewVisible?'live':'preparing';
 const setupHint=inlineSetupHint({
  source:sourceStatus,cameraOn,cameraBusy,cameraError,bodySelected,videoReady,
  frameFresh,performerCount,visibleCount:identityStatus.visible.length,
  identityAmbiguous:identityStatus.ambiguous,
  identityMatchedFrame:identityStatus.observedFrameTime===frameRef.current.time,
  floorCalibrated:floorStatus.calibrated,floorConfirmed:floorStatus.confirmed,cameraMatched,
  experiment:experimentalKind?{
   ready:!!selectedExperimentFrame&&
    (selectedExperimentFrame.kind!=='video'||selectedExperimentFrame.ready),
   name:selectedExperimentFrame?.name??'Belum ada berkas',
   events:selectedExperimentFrame?.kind==='simulator'?selectedExperimentFrame.session.events.length:
    selectedExperimentFrame?.kind==='video'?selectedExperimentFrame.snapshot?.events.length??0:0,
   contacts:selectedExperimentFrame?.kind==='simulator'?
    selectedExperimentFrame.session.events.filter(e=>e.kind==='contact').length:
    selectedExperimentFrame?.kind==='video'?
    selectedExperimentFrame.snapshot?.events.filter(e=>e.kind==='contact').length??0:0
  }:undefined
 });
 // Only interrupt the Stage for an actionable setup problem.
 const showSetupHint=sourceStatus.selection!==null&&!experimentalKind&&
  !(sourceStatus.selection==='phone'&&!phoneActive)&&
  !['pose','identity','performers'].includes(setupHint.id)&&(
   setupHint.severity==='warning'||setupHint.severity==='busy'
  );
 const handleAssistantAction=(action:InlineSetupAction)=>{
  switch(action){
   case 'experiment':{
    if(experimentalKind==='video')document.querySelector<HTMLInputElement>(
     '.fp-experiment-upload input[type=file]')?.click();
    else document.querySelector<HTMLButtonElement>(
     '.fp-experiment-controls button')?.focus({preventScroll:true});
    break;
   }
   case 'source':{
    onNavigateStageWorkspace('track');
    requestAnimationFrame(()=>{
     const trigger=document.querySelector<HTMLElement>('.soma-ux01-source-switch > summary');
     trigger?.focus({preventScroll:true});
     if(trigger?.parentElement instanceof HTMLDetailsElement)trigger.parentElement.open=true;
    });
    break;
   }
   case 'webcam':void chooseSource('webcam');break;
   case 'phone':
    if(sourceStatus.selection==='phone'){
     setCalibrationOpen(false);setInspectorOpen(false);setPhonePanelOpen(true);
    }else void chooseSource('phone');
    break;
   case 'body':
    if(sourceStatus.selection==='phone')selectFlowStep('process',undefined,true);
    else onStartBody();
    break;
   case 'tracking':selectFlowStep('process',undefined,true);break;
   case 'calibrate':openCalibration();break;
   case 'projector':onOpenProjection();break;
  }
 };
 const trackSummary=trackStatus({
  selection:sourceStatus.selection,phase:sourceStatus.phase,message:sourceStatus.message,
  videoLoaded:!!experimentClip,
  videoVisible:selectedExperimentFrame?.kind==='video'&&selectedExperimentFrame.snapshot?
   selectedExperimentFrame.snapshot.visibleCount:null,
  cameraOn,frameFresh,visibleCount:identityStatus.visible.length,performerCount
 });
 const feedback=useTrackFeedbackPulse({
  selection:sourceStatus.selection,phase:sourceStatus.phase,
  cameraOn,bodySelected,frameFresh,performerCount,frameRef,router,
  videoSnapshot:selectedExperimentFrame?.kind==='video'?
   selectedExperimentFrame.snapshot:null,
  videoReady:canPaintVideoFrame(selectedExperimentFrame),
  videoClip:experimentClip,active:!composerOpen&&!operatorMode
 });
 const trackingFeedbackRef=useRef(feedback);
 trackingFeedbackRef.current=feedback;
 const ownership=trackStatusOwnership({
  selection:sourceStatus.selection,phase:sourceStatus.phase,
  cameraOn,cameraBusy,cameraError,phonePanelOpen,experimentalKind,
  sourceMode,feedbackState:feedback.state,composerOpen,operatorMode
 });
 const inputFocusEnabled=!calibrationOpen&&(sourceStatus.selection!==null||composerOpen);
 return <section className={'fp-stage-workspace fp-persistent-layout soma-ia-four-workspaces'+(operatorMode?' fp-operator-mode':'')}
  data-workspace={operatorMode?'perform':composerOpen?(mappingOpen?'map':'compose'):'track'}
  data-stage-source={sourceStatus.selection??'none'}
  data-operator-cue={operatorCueAt(operatorCue).id} data-context="inspector"
  data-inspector-open={inspectorOpen&&!operatorMode} data-source-ready={operatorMode||gaitPreviewVisible}
  data-screen={screenMode} data-source-mode={sourceMode}
  data-tracking-state={feedback.state} data-preview-mode={previewMode} data-focus-preview={focusPreview}
  data-experimental={!!experimentalKind} data-skeleton-visible={skeletonVisible}
  data-flow={flowStep} data-utility={operatorMode?'none':videoLabOpen?'video':rehearsalOpen?'rehearsal':composerOpen?'composer':'none'}
  aria-label="Stage 1 — Motion Projection">
  <StageModuleNav active={operatorMode?'perform':composerOpen?(mappingOpen?'map':'compose'):'track'}
   onNavigate={onNavigateStageWorkspace}
   status={{
    trackReady:feedback.state==='ready'||feedback.state==='synthetic',
    mapReady:tracker.isConfirmed,
    outputLive:dual.floor.mode==='live'||dual.body.mode==='live'
   }}/>
  {!operatorMode&&!composerOpen&&view==='stage'&&<header className="soma-ia-track-head">
   <div className="soma-ia-track-title">
    <h1>Track</h1>
    <span>Pilih sumber · periksa gambar dan kaki</span>
   </div>
  </header>}
  {operatorMode?
   <OperatorStageConsole index={operatorCue} onPrevious={previousCue} onNext={nextCue}
    onExit={onExitOperator} onBlackout={operatorBlackout}
    held={footprint.hold||performBlackout} onHold={()=>updateFootprint({hold:true})}
    onResume={()=>{if(performUnsafeRef.current)return;setPerformBlackout(false);updateFootprint({hold:false});onResumeSoftwarePreview();setPreviewResumeRevision(v=>v+1);}}
    videoRecording={videoRecording} canRecordVideo={canRecordVideo}
    onRecordVideo={onRecordVideo} units={units}
    contacts={floorStatus.contacts} performerCount={performerCount}
    cueGrid={performGrid} activeSlot={activePerformSlot} onApplySlot={applyPerformSlot}
    onUpdateSlot={(index,changes)=>setPerformGrid(grid=>updatePerformCueSlot(grid,index,changes))}
    onSaveCue={savePerformGrid} onResetCues={resetPerformGrid} cueMessage={performMessage}
    scene={floorScene} previewStatus={experimentalKind==='video'?
     (selectedExperimentFrame?.kind==='video'&&selectedExperimentFrame.snapshot?
      Math.min(selectedExperimentFrame.snapshot.visibleCount,performerCount)+'/'+performerCount+' · '+selectedExperimentFrame.snapshot.performance.poseFps.toFixed(1)+' FPS':'MP4 · menunggu pose'):
     experimentalKind==='simulator'?'Simulasi 3D':cameraLabel}
    sourceLabel={SOURCE_CHOICES.find(option=>option.id===sourceStatus.selection)?.label??'Belum dipilih'}
    hardwareStatus={'BODY '+(dual.body.mode==='live'?'LIVE':dual.body.connected?'Siaga':'Offline')+' · FLOOR '+(dual.floor.mode==='live'?'LIVE':dual.floor.connected?'Siaga':'Offline')}
    unreadyReason={performReadiness.state==='attention'||performReadiness.state==='qa-required'?performReadiness.reason:''}
    onRecovery={()=>{
     operatorBlackout();onExitOperator();setView('stage');
     const needsTrack=projectionPreflight.step==='source'||projectionPreflight.step==='tracking';
     setMappingOpen(!needsTrack);setComposerStartQA(!needsTrack);setComposerOpen(!needsTrack);
     setInspectorOpen(needsTrack);
     setFlowStep(needsTrack?'process':'output');
    }}
    canResume={!performUnsafe}
    getTouchDesignerSnapshot={()=>{
     const engine=interactionEngineRef.current;
     const source=engine.activeSource;
     const clip=experimentFrameRef.current;
     const live=source==='camera'||source==='phone';
     const videoOk=source==='video'&&clip?.kind==='video'&&clip.ready&&!!clip.snapshot&&!clip.video?.seeking;
     const simulatorOk=source==='simulator'&&clip?.kind==='simulator';
     const cameraVideo=videoRef.current;
     const landscape=!!cameraVideo&&cameraVideo.videoWidth>cameraVideo.videoHeight;
     const ready=!footprint.hold&&!performBlackout&&(
      live?sourceStatus.phase==='ready'&&cameraOn&&bodySelected&&frameFresh&&landscape:
      videoOk||simulatorOk||source==='touch');
     const floorSpace=source==='simulator'&&clip?.kind==='simulator'?clip.session.floor:
      live&&floorStatus.confirmed?tracker.floor:null;
     const observations:TdFootObservation[]=[];
     if(ready&&live){
      const frame=frameRef.current;
      if(performerCount===1&&frame.pose.length>0)
       observations.push(...poseFootObservations('performer-1',frame.pose,frame.time));
      else if(!identityStatus.ambiguous&&identityStatus.observedFrameTime===frame.time){
       for(const id of ['A','B'] as const){
        const i=identityStatus.poseIndices[id];
        if(i!==null&&frame.poses?.[i])observations.push(...poseFootObservations(id,frame.poses[i],frame.time));
       }
      }
     }else if(ready&&source==='video'&&clip?.kind==='video'&&clip.snapshot&&!clip.snapshot.ambiguous){
      for(const person of clip.snapshot.people.slice(0,2))
       observations.push(...poseFootObservations(person.id,person.landmarks,clip.snapshot.atMs));
     }else if(ready&&source==='simulator'&&clip?.kind==='simulator'){
      const floor=clip.session.floor;
      for(const actor of clip.performers.slice(0,2))for(const foot of ['left','right'] as const){
       const position=actor[foot].positionM;
       observations.push({actorId:actor.id,foot,x:position.xM/floor.widthM,
        y:1-position.yM/floor.depthM,confidence:1,atMs:clip.timeMs,
        coordinateBasis:'simulated',headingRad:actor[foot].headingRad});
      }
     }
     return {source,sessionId:engine.currentSessionId,generation:engine.generation,
      events:engine.canonicalRecent,observations,ready,
      atMs:live||source==='touch'?performance.now():clip?.timeMs??0,
      floor:floorSpace?{widthM:floorSpace.widthM,depthM:floorSpace.depthM,
       calibrated:live&&floorStatus.confirmed}:null};
    }}
    sourceKind={sourceStatus.selection}
    cameraOk={experimentalKind?Boolean(selectedExperimentFrame&&
    (selectedExperimentFrame.kind==='simulator'||canPaintVideoFrame(selectedExperimentFrame))):cameraOn&&bodySelected&&frameFresh}
     identityOk={experimentalKind?Boolean(selectedExperimentFrame&&
    (selectedExperimentFrame.kind==='simulator'||canPaintVideoFrame(selectedExperimentFrame))):performerCount===1?!identityStatus.ambiguous:identityStatus.visible.length>=2&&!identityStatus.ambiguous&&identityStatus.observedFrameTime===frameRef.current.time}
    floorOk={experimentalKind?Boolean(selectedExperimentFrame&&
    (selectedExperimentFrame.kind==='simulator'||canPaintVideoFrame(selectedExperimentFrame))):floorStatus.confirmed&&cameraMatched}
     floorQaOk={dual.floor.qa==='within-provisional-target'}
    bodyQaOk={dual.body.qa==='within-provisional-target'}
    onGoTrack={()=>onNavigateStageWorkspace('track')}
    onGoMap={()=>{
     operatorBlackout();onExitOperator();setView('stage');
     setMappingOpen(true);setComposerStartQA(true);setComposerOpen(true);
    }}/>
   :null}
  {videoLabOpen&&!operatorMode&&view==='stage'&&<VideoMotionLab initialFile={experimentClip}
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
  {mappingOpen&&!operatorMode&&sourceStatus.selection!==null&&sourceStatus.phase==='error'&&<div className="soma-map-input-notice" role="status">
   <span>Input terputus. Periksa sambungan di Track.</span>
   <button type="button" onClick={()=>onNavigateStageWorkspace('track')}>Periksa input</button>
  </div>}
  <div className="fp-stage-layout">
   <div className="fp-stage-main">
    {composerOpen&&!operatorMode&&view==='stage'&&!mappingOpen&&
     <div className="soma-ia-compose-state" role="status">
      <span>{sourceStatus.selection===null?'Pilih sumber di Track':
       experimentalKind==='video'?'MP4 · Preview':experimentalKind==='simulator'?'3D · Preview':
       cameraOn?'Kamera · Preview':'Tracking belum aktif'}</span>
      {(footprint.hold||softwareBlackout)&&<button type="button" onClick={()=>{updateFootprint({hold:false});onResumeSoftwarePreview();setPreviewResumeRevision(v=>v+1);}}>
       Resume preview
      </button>}
     </div>}
    {view==='stage'&&(composerOpen||operatorMode)&&<div className="soma-composer-host" hidden={!composerOpen||operatorMode} aria-hidden={!composerOpen||operatorMode}><SurfaceComposer embedded mapMode={mappingOpen&&!operatorMode} workspaceHidden={!composerOpen&&!operatorMode}
     footprint={footprint} updateFootprint={updateFootprint}
     sharedAssets={sharedAssetRegistry.assets} onImportAssets={sharedAssetRegistry.addFiles}
     onRemoveAsset={sharedAssetRegistry.removeAsset} assetNotice={sharedAssetRegistry.notice}
     experimentSource={experimentalKind} experimentInputCanvas={cameraCanvas} experimentFloorCanvas={floorCanvas} experimentFrameRef={experimentFrameRef}
     experimentReady={selectedExperimentFrame?.kind==='simulator'||canPaintVideoFrame(selectedExperimentFrame)}
     initialOutputQA={composerStartQA} experimentLocked={!!experimentalKind}
     bodyCanvas={bodyCanvas} floorCanvas={cleanFloorOutput}
     outputBodyRaster={performBodyRaster} outputFloorRaster={performFloorRaster}
     composePreviewCanvas={composeFloorOverlay}
     previewResumeRevision={previewResumeRevision} previewBlackout={softwareBlackout}
     frameRef={frameRef} videoRef={videoRef}
     router={router} floorTracker={tracker} projection={projection}
     cameraOn={cameraOn} bodySelected={bodySelected} performerCount={performerCount}
     floorReady={floorStatus.confirmed&&cameraMatched}
     floorEvents={()=>tracker.session?.events??[]}
     motionEvents={()=>interactionEngineRef.current.canonicalRecent}
     motionSession={()=>interactionEngineRef.current.currentSessionId}
     lineSource={sourceStatus.selection==='phone'?'phone':'camera'}
     identitySafe={!identityStatus.ambiguous}
      onOpenMapTrack={()=>onNavigateStageWorkspace('track')}
      onOpenMapCompose={()=>onNavigateStageWorkspace('compose')}
     onClose={()=>{onBlackout();setComposerOpen(false);setMappingOpen(false);setComposerStartQA(false);}}/></div>}
    {operatorMode&&<PerformFinalPreview
     floorRaster={performFloorRaster} bodyRaster={performBodyRaster}
     inputRaster={cameraCanvas}
     sourceLabel={SOURCE_CHOICES.find(item=>item.id===sourceStatus.selection)?.label??'Belum dipilih'}
     sourceReady={experimentalKind?Boolean(selectedExperimentFrame&&
      (selectedExperimentFrame.kind==='simulator'||canPaintVideoFrame(selectedExperimentFrame))):
      cameraOn&&sourceStatus.phase==='ready'}
     mapReady={dual.floor.qa==='within-provisional-target'&&dual.body.qa==='within-provisional-target'}
     skeletonVisible={skeletonVisible} onSkeletonChange={setSkeletonVisible}
     cueView={performGrid.slots[activePerformSlot]?.view??'floor'}
     cueIndex={activePerformSlot}/>}
    <div className="fp-stage-overview" ref={composeLayout.overview} data-dragging={composeLayout.dragging??'none'} style={composerOpen&&!mappingOpen?composeLayout.style:undefined} hidden={view!=='stage'||(composerOpen&&mappingOpen)}>
     <aside className="soma-track-source-panel" data-camera-setup={sourceStatus.selection==='phone'&&phonePanelOpen?'open':'closed'} hidden={composerOpen||operatorMode}
      aria-label="Pilih sumber dan lihat status tracking">
      <div className="soma-track-source-heading"><strong>Sumber</strong></div>
      <details className="soma-ux01-source-switch soma-track-source-select"
       onKeyDown={event=>{if(event.key==='Escape'){
        event.preventDefault();event.stopPropagation();
        event.currentTarget.open=false;
        event.currentTarget.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});
       }}}
       onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))
        event.currentTarget.open=false;}}>
       <summary aria-label="Ganti sumber gerak" title="Ganti sumber input">
        <strong>{SOURCE_CHOICES.find(option=>option.id===sourceStatus.selection)?.label??'Pilih sumber'}</strong>
       </summary>
       <div className="soma-ux01-source-options" role="group" aria-label="Sumber gerak Track">
        {SOURCE_CHOICES.map(option=><button type="button" key={option.id}
         title={option.description}
         disabled={sourceStatus.phase==='connecting'||sourceStatus.selection===option.id}
         aria-pressed={sourceStatus.selection===option.id}
         onClick={async event=>{
          const menu=event.currentTarget.closest('details');
          if(await chooseSource(option.id)){
           menu?.removeAttribute('open');
           menu?.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});
          }
         }}>
         {option.label}
        </button>)}
       </div>
      </details>
      <section className="soma-track-source-status" data-phase={sourceStatus.phase}
       hidden={!ownership.sourceStatusVisible}
       aria-hidden={!ownership.sourceStatusVisible}
       data-kind={ownership.sourceStatusError?'error':trackSummary.kind}
       aria-label="Masalah sumber kamera" role="status" aria-live="polite">
       <div className="soma-track-status-title">
        <span className="soma-track-state-indicator" aria-hidden="true"/>
        <strong>{ownership.sourceStatusError&&sourceStatus.selection==='webcam'?
         'Periksa kamera':trackSummary.label}</strong>
       </div>
       {ownership.sourceStatusError&&
        <p title={cameraError||trackSummary.detail}>
         {cameraError||trackSummary.detail}</p>}
      </section>
      {sourceStatus.selection==='webcam'&&<div className="soma-track-mac-camera" role="group" aria-label="Kamera lain pada Mac">
       <label htmlFor="soma-track-mac-device">Kamera</label>
       <div className="soma-track-mac-device-wrap">
        <select id="soma-track-mac-device"
         aria-label="Pilih webcam, HDMI capture, atau kamera virtual"
         value={cameraDevices.some(device=>device.deviceId===selectedCameraId)?selectedCameraId:''}
         disabled={cameraBusy}
         onChange={event=>void onSelectCameraDevice(event.target.value)}>
         <option value="">Kamera otomatis</option>
         {cameraDevices.filter(device=>device.kind==='videoinput').map((device,i)=>
          <option key={device.deviceId} value={device.deviceId}>{cameraDeviceLabel(device,i)}</option>)}
        </select>
        <ChevronDown size={15} aria-hidden="true"/>
       </div>
       {cameraDevices.length===0&&<small>Izinkan kamera di browser untuk melihat perangkat.</small>}
      </div>}
      {ownership.webcamAction&&<button type="button" className="soma-track-side-action"
       onClick={onStartBody} disabled={ownership.webcamAction==='connecting'||cameraBusy}
       aria-busy={ownership.webcamAction==='connecting'}>
       {ownership.webcamAction==='connecting'&&
        <span className="trk06a-button-spinner" aria-hidden="true"/>}
       {ownership.webcamAction==='retry'?'Coba lagi':
        ownership.webcamAction==='connecting'?'Menghubungkan…':'Aktifkan webcam'}
      </button>}
      {!experimentalKind&&cameraOn&&!cameraBusy&&bodySelected&&<button type="button" className="soma-track-side-action"
       onClick={sourceStatus.selection==='phone'?onPhoneDisconnect:onToggleCamera}>Hentikan kamera</button>}
      {ownership.showBodyAction&&<button type="button" className="soma-track-side-action"
       onClick={onStartBody}>Aktifkan Body</button>}
      {sourceStatus.selection==='phone'&&phoneActive&&<button type="button" className="soma-track-side-action"
       onClick={onRotatePhone} title="Putar isi gambar kamera HP, keluaran tetap horizontal 16:9">
       Putar gambar 90°
      </button>}
      {sourceStatus.selection==='phone'&&phoneActive&&<button type="button" className="soma-track-side-action"
       onClick={onMirrorCamera} title="Cerminkan isi gambar kamera; Map perlu diperiksa ulang">
       Cerminkan gambar
      </button>}
      {sourceStatus.selection==='phone'&&!phonePanelOpen&&<button type="button" className="soma-track-side-action"
       aria-expanded={phonePanelOpen} aria-controls="soma-track-phone-pairing"
       onClick={()=>{setPhonePanelOpen(v=>!v);setCalibrationOpen(false);setInspectorOpen(false);}}>
       {phoneActive?'Lihat sambungan':'Sambungkan HP'}
      </button>}
      {sourceStatus.selection==='phone'&&<section id="soma-track-phone-pairing" className="soma-track-phone-pairing"
       hidden={!phonePanelOpen||operatorMode} aria-hidden={!phonePanelOpen||operatorMode}
       aria-label="Sambungkan Kamera HP">
       <header className="soma-track-phone-heading"><strong>Kamera HP</strong>
        <button type="button" aria-label="Tutup pilihan kamera" onClick={closePhonePanel}>×</button>
       </header>
       <PhoneCameraReceiver onStream={onPhoneStream} onInterrupted={onPhoneInterrupted} onDisconnect={onPhoneDisconnect}/>
      </section>}
      {experimentalKind&&<FootprintsExperimentalSource
       key={experimentalKind} kind={experimentalKind}
       model={experimentPuppet} externalRevision={experimentPuppetRevision}
       performerCount={performerCount}
       clip={experimentClip} onClip={onExperimentClip} onFrame={onExperimentFrame}
       onAdvancedVideo={()=>{onBlackout();setVideoLabOpen(true);}}
       onAdvancedSimulator={()=>{onBlackout();onOpenSimulator();}}/>}
      {identityStatus.ambiguous&&!experimentalKind&&<button type="button" className="soma-track-side-action"
       onClick={()=>router.reset()} title="Setel ulang kunci identitas Performer A/B setelah persilangan">
       Baca ulang kedua orang
      </button>}
      <section className="soma-track-motion-hud" aria-label="Jumlah orang dalam gambar">
       <div className="soma-track-hud-row">
        <span>Performer</span>
        <div className="soma-track-segmented" role="group" aria-label="Jumlah performer">
         {([1,2] as const).map(n=><button key={n} type="button" aria-pressed={performerCount===n}
          onClick={()=>onPerformerCount(n)}>{n}P</button>)}
        </div>
       </div>
      </section>
      <section className="soma-input-check" data-ready={feedback.state==='ready'||feedback.state==='synthetic'} role="status" aria-live="polite">
       <strong>{feedback.state==='ready'?'Input siap':feedback.state==='synthetic'?'Simulasi siap':'Periksa input'}</strong>
       <span>{feedback.state==='ready'?'Gerakkan kaki dan periksa garisnya.':feedback.state==='synthetic'?'Lanjut untuk mengatur bidang.':feedback.hint||feedback.label}</span>
      </section>
     </aside>
     {composerOpen&&showSetupHint&&ownership.showInlineAssistant&&
      <InlineSetupAssistant hint={setupHint} onAction={handleAssistantAction}/>}

     <div className="fp-stage-video">
      <div className="fp-stage-surface-head"><span>{composerOpen?
        (experimentalKind==='video'?'INPUT · VIDEO + POSE A/B':experimentalKind==='simulator'?
         'INPUT · PUPPET 3D + POSE A/B':'INPUT · KAMERA + SKELETON'):
        (experimentalKind==='video'?'Video MP4':experimentalKind==='simulator'?'Simulasi 3D':'Kamera')}</span>
       {experimentalKind!=='simulator'&&
        (composerOpen||sourceStatus.phase==='ready'||(experimentalKind==='video'&&!!experimentClip))&&
        <button type="button" className="fp-full-skeleton-switch"
        aria-pressed={skeletonVisible}
        aria-label={skeletonVisible?'Sembunyikan kerangka tubuh':'Tampilkan kerangka tubuh 33 titik'}
        title="Kerangka tubuh 33 titik · diagnostik, bukan output proyektor"
        onClick={()=>setSkeletonVisible(current=>!current)}>
        Garis tubuh <span aria-hidden="true">{skeletonVisible?'ON':'OFF'}</span>
       </button>}
       {!calibrationOpen&&<button type="button" className="fp-preview-focus-action"
        aria-label={focusPreview==='input'?'Kembali ke Split':'Perbesar INPUT'}
        aria-pressed={focusPreview==='input'}
        title={focusPreview==='input'?'Kembali ke Split · Esc':'Fokus INPUT'}
        onClick={event=>selectPreviewFocus('input',event.currentTarget)}>
        {focusPreview==='input'?<Minimize2 size={14}/>:<Maximize2 size={14}/>}
       </button>}</div>
      <div className="fp-stage-video-content"
       role={inputFocusEnabled?'button':undefined}
       tabIndex={inputFocusEnabled?0:undefined}
       aria-label={inputFocusEnabled?'Perbesar preview INPUT':undefined}
       onClick={event=>{if(inputFocusEnabled)selectPreviewFocus('input',event.currentTarget);}}
       onKeyDown={event=>{
        if(inputFocusEnabled&&(event.key==='Enter'||event.key===' ')){
         event.preventDefault();selectPreviewFocus('input',event.currentTarget);
        }
       }}>
       <canvas ref={cameraCanvas} width={768} height={432}
        onPointerDown={onMainCameraPoint}
        data-calibration-active={calibrationOpen&&!!calibrationOverlay}
        aria-label={experimentalKind?experimentalKind==='video'?'Input video rekaman 2D':'Input puppet 3D virtual':
         calibrationOpen&&calibrationOverlay?'Klik empat sudut kalibrasi lantai pada kamera besar':'Pratinjau video kamera SOMA Body'}/>
       {!composerOpen&&!calibrationOpen&&!experimentalKind&&!sourceStatus.selection&&
        <div className="soma-track-input-placeholder" role="status">
         <strong>Pilih sumber</strong>
        </div>}
       {!composerOpen&&experimentalKind==='video'&&!canPaintVideoFrame(selectedExperimentFrame)&&
        <div className="soma-track-input-placeholder" role="status">
         <strong>{experimentClip?'Menyiapkan video':'Pilih video MP4'}</strong>
        </div>}

       {calibrationOpen&&calibrationOverlay&&<div className="fp-stage-calibration-overlay" aria-hidden="true">
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
       {!experimentalKind&&sourceMode==='switch-body'&&!operatorMode&&composerOpen&&
        <div className="fp-stage-empty fp-source-correction" role="status">
        <Camera size={24} aria-hidden="true"/>
        <strong>Kamera sudah terhubung</strong>
        <p>Aktifkan pelacakan Body untuk membaca gerakan kaki.</p>
        <button type="button" onClick={onStartBody}>
         <Camera size={15} aria-hidden="true"/> Gunakan mode Body</button>
       </div>}
       {!experimentalKind&&sourceMode==='warming'&&!operatorMode&&
        (composerOpen?
         <div className="fp-stage-empty fp-source-warming" role="status">
          <span className="fp-source-spinner" aria-hidden="true"/>
          <strong>Menyiapkan preview kamera</strong>
          <p>Menunggu frame pertama dari perangkat. Periksa sambungan dan izin kamera.</p>
         </div>:
         ownership.showPreviewWarming&&
         <div className="trk06a-preview-warming" role="status">
          <span className="fp-source-spinner" aria-hidden="true"/>
          <span>Menyiapkan gambar</span>
         </div>)}
      </div>
      <div className="fp-stage-surface-foot"
       hidden={!composerOpen&&!operatorMode&&!ownership.showTrackingFeedback}>
       {!composerOpen&&!operatorMode?
        <div className="soma-track-feedback" data-state={feedback.state}
         title="Kaki terlihat dihitung dari landmark pergelangan, tumit dan ujung kaki pada frame aktif; bukan kontak lantai."
         role="status" aria-live="polite" aria-atomic="true"
         aria-label={feedback.label}>
         <span className="soma-track-feedback-indicator" aria-hidden="true"/>
         <strong>{feedback.label}</strong>
         {feedback.hint&&<span className="soma-track-feedback-hint">{feedback.hint}</span>}
         {experimentalKind&&<span className="soma-track-feedback-safety"
          title="MP4 dan simulasi hanya menggerakkan pratinjau software">Output terkunci</span>}
         {feedback.actors.length>0&&<div className="soma-track-actor-list"
          role="group" aria-label="Status aktor dan landmark kaki">
          {feedback.actors.map(actor=><span key={actor.id}
           className="soma-track-actor-chip" data-state={actor.state}
           data-actor={actor.id}
           title={actor.state==='unstable'?'Identitas belum stabil':
            actor.state==='missing'?'Aktor belum terdeteksi':
            actor.feet===2?'Kedua kaki terdeteksi dari landmark 2D':
            'Sebagian landmark telapak tidak terlihat'}>
           <b>{actor.id}</b>
           {actor.state==='unstable'?'?':actor.state==='missing'?'—':actor.feet+'/2'}
          </span>)}
         </div>}
        </div>:
        <>
         <span>{experimentalKind?selectedExperimentFrame?
          selectedExperimentFrame.kind==='video'?'Video 2D':'Puppet virtual':'Menyiapkan sumber':
          frameFresh?'Pose kamera baru':'Menunggu pose valid'}</span>
         <span>{experimentalKind?'OUTPUT FISIK TERKUNCI':performerCount+' performer'}</span>
        </>}
      </div>
     </div>
     {/* BODY/FLOOR canvases remain mounted for shared scene engines.
          Track displays the source video with skeleton; Compose owns art preview. */}
     <div className="fp-stage-side-previews" data-preview-mode={previewMode}
      aria-label="Preview BODY dan FLOOR untuk Compose"
      hidden={!composerOpen||mappingOpen} aria-hidden={!composerOpen||mappingOpen}>
      <div className="fp-stage-preview-toolbar">
       <div className="fp-stage-preview-heading"><span><MonitorPlay size={15} aria-hidden="true"/> PREVIEW</span>
        <small>{experimentalKind?experimentFrameLabel(experimentalKind):previewLabel(previewMode)+' · Preview software'}</small></div>
       {composerOpen&&!mappingOpen&&<div className="cp01-preset-tools" role="group" aria-label="Layout monitor Compose">
        {([['balanced','Seimbang'],['floor','FLOOR besar'],['input','INPUT besar'],['body','BODY besar']] as const).map(([id,label])=>
         <button type="button" key={id} aria-pressed={composeLayout.layout.preset===id}
          title={'Gunakan layout '+label} onClick={()=>composeLayout.preset(id as ComposeLayoutPreset)}>{label}</button>)}
        <button type="button" title="Kembalikan ukuran monitor ke default"
         onClick={()=>composeLayout.preset('balanced')}>Reset layout</button>
        <button type="button" aria-pressed={showComposeEvents}
         title="Tampilkan atau sembunyikan jejak event terverifikasi di atas scene FLOOR"
         onClick={()=>setShowComposeEvents(v=>!v)}>Event {showComposeEvents?'ON':'OFF'}</button>
       </div>}
       <div className="fp-stage-preview-modes" role="group" aria-label="Pilih tampilan preview">
        {STAGE_PREVIEW_MODES.map(item=><button type="button" key={item.id}
         aria-pressed={previewMode===item.id} aria-label={'Tampilkan '+item.description}
         title={item.description} onClick={()=>{
          setPreviewMode(item.id);setFocusPreview(item.id==='split'?'split':item.id);
         }}>
         {item.id==='split'&&<Layers3 size={13} aria-hidden="true"/>}{item.label}</button>)}
       </div>
       {focusPreview!=='split'&&<button type="button" className="fp-preview-restore"
        onClick={()=>{setFocusPreview('split');setPreviewMode('split');restoreFocusRef.current?.focus({preventScroll:true});}}
        aria-label="Kembali ke Split" title="Kembali ke Split · Esc">
        <Minimize2 size={13}/> Split
       </button>}
      </div>
      <div className="fp-stage-surface fp-preview-body">
       <div className="fp-stage-surface-head"><span>{experimentalKind?experimentalKind==='video'?(skeletonVisible?'BODY · SKELETON 33':'BODY · MASK VIDEO 2D'):
 'BODY · RIG VIRTUAL':'BODY · MASK PREVIEW'}</span><small>{experimentalKind?
 experimentalKind==='video'?'Pose AI + optical flow · pratinjau':'Rig 3D virtual':'Lower body'}</small>
        <button type="button" className="fp-preview-focus-action"
         aria-label={focusPreview==='body'?'Kembali ke Split':'Perbesar BODY'}
         aria-pressed={focusPreview==='body'}
         title={focusPreview==='body'?'Kembali ke Split · Esc':'Fokus BODY'}
         onClick={event=>selectPreviewFocus('body',event.currentTarget)}>
         {focusPreview==='body'?<Minimize2 size={14}/>:<Maximize2 size={14}/>}
        </button></div>
       <div className="fp-floor-scene-controls" role="status"><small>Visual V5 · Katalog lama dikosongkan. Tracking FLOOR tetap aktif.</small></div>
       <div className="fp-stage-canvas-area fp-stage-focus-surface" role="button"
        tabIndex={0} aria-label="Fokus preview BODY"
        title="Klik untuk memperbesar BODY"
        onClick={event=>selectPreviewFocus('body',event.currentTarget)}
        onKeyDown={event=>{
         if(event.key==='Enter'||event.key===' '){
          event.preventDefault();selectPreviewFocus('body',event.currentTarget);
         }
        }}>
        <canvas ref={bodyCanvas} width={160} height={90}
         aria-label="Pratinjau mask paha sampai telapak dengan latar hitam"/>
        {!experimentalKind&&totalFrames===0&&!footprint.hold&&
         <span className="fp-stage-canvas-empty">{maskStatus}</span>}
        {footprint.hold&&sourceStatus.selection!==null&&<span className="fp-stage-hold-label">
         HOLD · frame BODY ditahan, tracking tetap berjalan</span>}
       </div>
       <div className="fp-stage-surface-foot"><span>{experimentalKind?
 experimentalKind==='video'?'Landmark video 2D':'Puppet sintetis (bukan mask fisik)':maskStatus}</span>
 <span>{experimentalKind?'Preview eksperimen':'Mask · preview'}</span></div>
      </div>
      <div className="fp-stage-surface fp-preview-floor" data-floor-scene="footprints" data-hydra-visible={false}
       data-procedural={false}
       data-compose-events={composerOpen&&!mappingOpen&&showComposeEvents}>
       <div className="fp-stage-surface-head"><span>FLOOR · TRACKING PREVIEW</span>
        <small className="fp-floor-bus-status" title="Satu bus presence, movement dan contact untuk seluruh input">
         BUS · {floorInteractionStats.actors} aktor · {floorInteractionStats.contacts} kontak valid
        </small>
        <button type="button" className="fp-floor-touch-toggle" aria-pressed={touchDemo}
         title="Simulasikan kaki dengan klik/touch; preview software saja"
         onClick={()=>setTouchDemo(active=>!active)}>Touch Demo {touchDemo?'ON':'OFF'}</button>
        <button type="button" className="fp-preview-focus-action"
         aria-label={focusPreview==='floor'?'Kembali ke Split':'Perbesar FLOOR'}
         aria-pressed={focusPreview==='floor'}
         title={focusPreview==='floor'?'Kembali ke Split · Esc':'Fokus FLOOR'}
         onClick={event=>selectPreviewFocus('floor',event.currentTarget)}>
         {focusPreview==='floor'?<Minimize2 size={14}/>:<Maximize2 size={14}/>}
        </button></div>
       <div className="fp-stage-canvas-area fp-stage-focus-surface"
        data-touch-demo={touchDemo} role={touchDemo?'group':'button'}
        tabIndex={0} aria-label={touchDemo?'Touch Demo · sentuh FLOOR':'Fokus preview FLOOR'}
        title={touchDemo?'Sentuh bidang untuk membuat pijakan simulasi':'Klik untuk memperbesar FLOOR'}
        onPointerDown={event=>floorPointer(event,'down')}
        onPointerMove={event=>floorPointer(event,'move')}
        onPointerUp={event=>floorPointer(event,'up')}
        onPointerCancel={event=>floorPointer(event,'up')}
        onClick={event=>{if(!touchDemo)selectPreviewFocus('floor',event.currentTarget);}}
        onKeyDown={event=>{
         if(event.key==='Enter'||event.key===' '){
          event.preventDefault();
          if(touchDemo){
           const time=performance.now();
           feedTouchFloorInteraction(interactionEngineRef.current,{
            kind:'down',pointerId:1001,x:.5,y:.5,atMs:time});
           feedTouchFloorInteraction(interactionEngineRef.current,{
            kind:'up',pointerId:1001,x:.5,y:.5,atMs:time+1});
          }else selectPreviewFocus('floor',event.currentTarget);
         }
        }}>
        <canvas ref={floorCanvas} className="fp-floor-legacy-canvas" width={1280} height={720}
         aria-label="Pratinjau kontak kaki dan lintasan dari FloorSession V3"/>
        <canvas ref={interactionCanvas} className="fp-floor-interaction-layer"
         width={1280} height={720} aria-hidden="true"/>
        <canvas ref={composeFloorOverlay} className="cp03-composition-overlay"
         width={1280} height={720} aria-label="Layer media komposisi pada preview FLOOR; output software"/>
        {touchDemo&&<span className="fp-floor-touch-hint" aria-hidden="true">
         Sentuh lantai · interaksi sintetis · SOFTWARE ONLY</span>}
        {!experimentalKind&&!floorStatus.confirmed&&!footprint.hold&&<span className="fp-stage-canvas-empty">
         {blockedReason(cameraOn,floorStatus.calibrated,floorStatus.confirmed)}</span>}
        {footprint.hold&&sourceStatus.selection!==null&&<span className="fp-stage-hold-label">
         HOLD · frame FLOOR ditahan, event tetap tercatat</span>}
       </div>
       <div className="fp-stage-surface-foot"><span>{selectedExperimentFrame?
 selectedExperimentFrame.kind==='simulator'?selectedExperimentFrame.session.events.filter(e=>e.kind==='contact').length+' kontak sintetis':
 (selectedExperimentFrame.snapshot?.events.filter(e=>e.kind==='contact').length??0)+' kontak video':
 experimentalKind?'0 kontak':floorStatus.contacts+' kontak'}</span>
        <span>{selectedExperimentFrame?selectedExperimentFrame.kind==='simulator'?
 selectedExperimentFrame.session.events.length:selectedExperimentFrame.snapshot?.events.length??0:
 experimentalKind?0:floorStatus.events} event</span>
        {composerOpen&&experimentalKind==='video'&&
         (selectedExperimentFrame?.kind==='video'?selectedExperimentFrame.snapshot?.events.filter(e=>e.kind==='contact').length??0:0)>0&&
         floorInteractionStats.contacts===0&&<span className="cp03-pending-contact" role="status"
          title="Kontak MP4 mentah memerlukan aktor stabil, confidence cukup, dan waktu frame sesuai sebelum dipakai scene.">
          Menunggu kontak valid
         </span>}</div>
      </div>
     </div>
     {composerOpen&&!mappingOpen&&<>
      <button type="button" className="cp01-divider cp01-divider-vertical"
       role="separator" aria-orientation="vertical" aria-label="Atur lebar monitor FLOOR dan INPUT BODY"
       aria-valuemin={30} aria-valuemax={75} aria-valuenow={Math.round(composeLayout.layout.floor)}
       aria-valuetext={Math.round(composeLayout.layout.floor)+' persen untuk FLOOR'}
       title="Geser untuk mengubah lebar FLOOR · tombol kiri/kanan untuk keyboard"
       onPointerDown={composeLayout.begin('vertical')} onPointerMove={composeLayout.move('vertical')}
       onPointerUp={composeLayout.stop} onPointerCancel={composeLayout.stop}
       onKeyDown={composeLayout.keyboard('vertical')}/>
      <button type="button" className="cp01-divider cp01-divider-horizontal"
       role="separator" aria-orientation="horizontal" aria-label="Atur tinggi monitor INPUT dan BODY"
       aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(composeLayout.layout.input)}
       aria-valuetext={Math.round(composeLayout.layout.input)+' persen untuk INPUT'}
       title="Geser untuk mengubah tinggi INPUT · tombol atas/bawah untuk keyboard"
       onPointerDown={composeLayout.begin('horizontal')} onPointerMove={composeLayout.move('horizontal')}
       onPointerUp={composeLayout.stop} onPointerCancel={composeLayout.stop}
       onKeyDown={composeLayout.keyboard('horizontal')}/>
     </>}
    </div>
    {viewError&&<p className="fp-stage-error" role="alert">{viewError}</p>}
    {view==='archive'&&<div className="fp-stage-archive-view">
     <button type="button" className="fp-flow-back" onClick={()=>{setView('stage');setInspectorOpen(true);setFlowStep('compose');}}>
      ← Kembali ke preview Footprints
     </button>
     <div className="fp-stage-view-note"><Film size={15}/>
      <span>Arsip BODY A/B dan residu FLOOR memakai engine S5.7 yang sama. Video tetap di browser. Kembali ke Live Stage menutup pemutar dan memadamkan output dual-surface.</span></div>
     <ArchivalMappingPanel frameRef={frameRef} cameraOn={cameraOn} experimentLocked={!!experimentalKind}
      performerCount={performerCount} router={router} projection={projection}
      stageMedia={stageSession.media} onStageMedia={stageSession.chooseMedia}
      stageSettings={stageSession.meta.archiveSettings}
      onStageSettings={settings=>stageSession.patch({archiveSettings:settings})}
      stageHoldMs={stageSession.meta.bridgeHoldMs}
      onStageHoldMs={ms=>stageSession.patch({bridgeHoldMs:ms})}/>
    </div>}
   </div>
   {!operatorMode&&inspectorOpen&&<aside id="fp-context-panel"
    className="fp-stage-inspector" data-phone-visible={false}
    data-panel-hidden={!inspectorOpen}
    data-mode={calibrationOpen?'calibration':'inspector'} aria-label={calibrationOpen?'Kalibrasi lantai':'Pengaturan tahap '+flowStep}
    onKeyDown={event=>{
     if(isDismissEscape(event)){
      event.preventDefault();event.stopPropagation();
      if(calibrationOpen)closeCalibration();else closeInspector();
     }
    }}>
    {!operatorMode&&calibrationOpen&&<InlineFloorCalibration
     key={sourceStatus.selection??'none'}
     videoRef={videoRef} tracker={tracker} router={router}
     cameraOn={cameraOn} bodySelected={bodySelected} videoReady={videoReady}
     cameraMatched={cameraMatched} onBlackout={onBlackout}
     onClose={closeCalibration} onOpenQA={onOpenLiveFloor}
     onOverlay={setCalibrationOverlay} onTap={bindCalibrationTap}/>}
    {!operatorMode&&!calibrationOpen&&inspectorOpen&&<FootprintsFlowInspector
     key={flowStep} step={flowStep} onClose={closeInspector}
     cameraOn={cameraOn} cameraBusy={cameraBusy} cameraError={cameraError}
     cameraLabel={cameraLabel}
     floorConfirmed={floorStatus.confirmed} floorCalibrated={floorStatus.calibrated}
     cameraMatched={cameraMatched} floorContacts={floorStatus.contacts}
     floorEvents={floorStatus.events} floorReason={floorStatus.reason}
     performerCount={performerCount} onPerformerCount={count=>{
      stageSession.patch({performers:count});onPerformerCount(count);
     }}
     identityAmbiguous={identityStatus.ambiguous} identities={identityStatus.visible.length}
     maskStatus={experimentalKind?experimentalKind==='video'?'Mask dari landmark video 2D':
      'Rig 3D sintetis; kamera tidak diperlukan':maskStatus}
     footprint={footprint} updateFootprint={updateFootprint}
     bodyReady={totalFrames>0&&frameFresh}
     floorReady={floorStatus.confirmed&&cameraMatched}
     projectionReason={legacyGate.reason}
     onStartBody={()=>{void chooseSource('webcam');}}
     onPhone={()=>{void chooseSource('phone');}}
     onEditFloor={openCalibration}
     onVideo={openVideoInput}
     onSimulation={openSimulatorInput}
     onCalibration={onOpenLiveFloor}
     onRehearsal={()=>{onBlackout();setCalibrationOpen(false);setInspectorOpen(false);setView('stage');setRehearsalOpen(true);}}
     onMapping={showArchive}
     onComposer={()=>{onBlackout();setCalibrationOpen(false);setInspectorOpen(false);setView('stage');setComposerStartQA(false);setComposerOpen(true);}}
     onOutputQA={openProjectorQA}
     onProjector={onOpenProjection}/>}
   </aside>}
  </div>
 </section>;
}
