import {useCallback,useEffect,useLayoutEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';
import {operatorCueAt,operatorShortcut} from './OperatorStageModel.ts';
import {OperatorStageConsole} from './OperatorStageConsole.tsx';
import {PERFORM_CUE_STORAGE_KEY,defaultPerformCueGrid,normalizePerformCueGrid,updatePerformCueSlot,evaluatePerformReadiness,type PerformCueGrid} from './performCueModel.ts';
import {InlineSetupAssistant} from './InlineSetupAssistant.tsx';
import {QuickStageSetup} from './QuickStageSetup.tsx';
import {safeProjectionPreflight} from './safeProjectionPreflight.ts';
import {startSetupBench} from './safeProjectionBench.ts';
import {inlineSetupHint,type InlineSetupAction} from './inlineSetupModel.ts';
import {InlineFloorCalibration} from './InlineFloorCalibration.tsx';
import {VideoMotionLab} from '../../stage/VideoMotionLab.tsx';
import {RehearsalComparisonLab} from '../../stage/RehearsalComparisonLab.tsx';
import type {ReplayReport} from '../../stage/rehearsalComparisonModel.ts';
import {SurfaceComposer} from './SurfaceComposer.tsx';
import {useComposeMonitorLayout,type ComposeLayoutPreset} from './useComposeMonitorLayout.ts';
import {StageModuleNav,type StageModuleWorkspace} from './StageModuleNav.tsx';
import {useStageSession} from '../../stage/useStageSession.ts';
import {Camera,Film,Layers3,MonitorPlay,Maximize2,Minimize2} from 'lucide-react';
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
import {liveSkeletonPresentation} from './trackFeedbackModel.ts';
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
import {SnowfallScene} from '../../footprints/scenes/SnowfallScene.ts';
import {PersistentHydraFootprintRuntime} from '../../footprints/scenes/PersistentHydraFootprintRuntime.ts';
import {ARTISTIC_FOOTPRINT_STYLES} from '../../footprints/scenes/ArtisticFootprintRuntime.ts';
import {HYDRA_FOOTPRINT_STYLES,normalizeHydraFootprintSettings,type HydraFootprintSettings,type HydraFootprintStatus} from '../../footprints/scenes/hydraFootprintModel.ts';
import {SnowfallRenderer} from '../../footprints/scenes/SnowfallRenderer.ts';
import {ProceduralSceneRuntime,type ProceduralParams} from '../../footprints/scenes/ProceduralSceneRuntime.ts';
import {FLOOR_SCENES,FLOOR_SCENE_PRESETS,loadFloorPresets,saveFloorPreset,
 isFloorSceneId,type FloorSceneId,type FloorScenePreset} from '../../footprints/scenes/sceneRegistry.ts';
import {FloorAudioReactive,type FloorAudioSource} from '../../footprints/scenes/FloorAudioReactive.ts';
import {FloorSceneAdvancedControls,type FloorAdvancedParams} from './FloorSceneAdvancedControls.tsx';
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
import {FootprintsStageTransport} from './UnifiedStageConsole.tsx';
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
import './vis-r1-hydra.css';
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
 onPhoneDisconnect:()=>void;onEnterOperator:()=>void;
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
 onPhoneStream,onPhoneDisconnect,
 onBlackout,onToggleCamera,onRecordVideo,onCapture,videoRecording,canRecordVideo,
 operatorMode,onExitOperator,softwareBlackout,onResumeSoftwarePreview,footprint,updateFootprint
}:Props){
 const composeLayout=useComposeMonitorLayout();
 const cameraCanvas=useRef<HTMLCanvasElement>(null);
 const composeFloorOverlay=useRef<HTMLCanvasElement>(null);
 const [showComposeEvents,setShowComposeEvents]=useState(true);
 const bodyCanvas=useRef<HTMLCanvasElement>(null);
 const floorCanvas=useRef<HTMLCanvasElement>(null);
 const snowfallCanvas=useRef<HTMLCanvasElement>(null);
 const proceduralCanvas=useRef<HTMLCanvasElement>(null);
 const hydraFloorCanvas=useRef<HTMLCanvasElement>(null);
 const archiveHydraCanvas=useRef<HTMLCanvasElement|null>(null);
 const archiveHydraReady=useRef(false);
 const hydraRuntime=useRef<PersistentHydraFootprintRuntime>(new PersistentHydraFootprintRuntime());
 const [hydraSettings,setHydraSettings]=useState<HydraFootprintSettings>(()=>{
  try{return normalizeHydraFootprintSettings(JSON.parse(localStorage.getItem('soma-floor-hydra-v1')??'null'));}
  catch{return normalizeHydraFootprintSettings(null);}
 });
 const [hydraStatus,setHydraStatus]=useState<HydraFootprintStatus>('off');
 const [hydraReason,setHydraReason]=useState('');
 const updateHydra=(patch:Partial<HydraFootprintSettings>)=>setHydraSettings(v=>normalizeHydraFootprintSettings({...v,...patch}));
 const cleanFloorOutput=useRef<HTMLCanvasElement|null>(null);
 const interactionCanvas=useRef<HTMLCanvasElement>(null);
 const interactionEngineRef=useRef(new FloorInteractionEngine());
 const touchPointers=useRef(new Set<number>());
 const [touchDemo,setTouchDemo]=useState(false);
 const [floorInteractionStats,setFloorInteractionStats]=useState({actors:0,contacts:0,events:0});
 const [snowfallScene]=useState(()=>new SnowfallScene());
 const [floorScene,setFloorScene]=useState<'footprints'|FloorSceneId>(()=>{
  try{
   const saved=localStorage.getItem('soma-floor-scene-v1');
   return isFloorSceneId(saved)?saved:'footprints';
  }catch{return 'footprints';}
 });
 useEffect(()=>{setHydraSettings(prev=>prev.catalogScene===floorScene?prev:normalizeHydraFootprintSettings({...prev,catalogScene:floorScene}));},[floorScene]);
 const [snowfallCount,setSnowfallCount]=useState(0);
 const [snowfallPaused,setSnowfallPaused]=useState(false);
 const [snowfallRate,setSnowfallRate]=useState(.55);
 const [snowfallRecovery,setSnowfallRecovery]=useState(75);
 const [snowfallRendererMode,setSnowfallRendererMode]=useState<'webgl2'|'2d'|'unavailable'>('unavailable');
 const [proceduralRuntime]=useState(()=>new ProceduralSceneRuntime());
 const [sceneIntensity,setSceneIntensity]=useState(.6);
 const [sceneRadius,setSceneRadius]=useState(.5);
 const [scenePersistence,setScenePersistence]=useState(.65);
 const [sceneQuality,setSceneQuality]=useState<'low'|'medium'|'high'>('medium');
 const [sceneAudioMix,setSceneAudioMix]=useState(.35);
 const [sceneCount,setSceneCount]=useState(0);
 const [userPresets,setUserPresets]=useState<FloorScenePreset[]>(()=>{
  try{return loadFloorPresets(localStorage);}catch{return [];}
 });
 const [sceneAudioSource,setSceneAudioSource]=useState<FloorAudioSource>('off');
 const [sceneAudioError,setSceneAudioError]=useState('');
 const [sceneAudioLevel,setSceneAudioLevel]=useState(0);
 const audioMeter=useRef(new FloorAudioReactive());
 const proceduralConfig=useRef<ProceduralParams>({
  intensity:sceneIntensity,radius:sceneRadius,persistence:scenePersistence,
  quality:sceneQuality,audioMix:sceneAudioMix,audioLevel:0,paused:snowfallPaused
 });
 proceduralConfig.current={intensity:sceneIntensity,radius:sceneRadius,
  persistence:scenePersistence,quality:sceneQuality,audioMix:sceneAudioMix,
  audioLevel:sceneAudioLevel,paused:snowfallPaused};
 const sceneAudioSourceRef=useRef(sceneAudioSource);
 sceneAudioSourceRef.current=sceneAudioSource;
 const analyserRef=useRef(audioAnalyser??null);
 analyserRef.current=audioAnalyser??null;
 const audioLevelLive=useRef(0);
 const audioRequest=useRef(0);
 const hydraSettingsRef=useRef(hydraSettings);hydraSettingsRef.current=hydraSettings;
 useEffect(()=>{
  try{localStorage.setItem('soma-floor-hydra-v1',JSON.stringify(hydraSettings));}catch{}
  const runtime=hydraRuntime.current;
  runtime.configure(hydraSettings);
  if(hydraSettings.enabled&&hydraFloorCanvas.current){
   void runtime.initialize(hydraFloorCanvas.current,hydraSettings).then(()=>{
    setHydraStatus(runtime.status);setHydraReason(runtime.reason);
   });
  }else if(!hydraSettings.enabled)setHydraStatus('off');
 },[hydraSettings]);
 useEffect(()=>()=>{
  hydraRuntime.current.dispose();
  // React StrictMode replays effects in development: the next setup needs a fresh shell.
  hydraRuntime.current=new PersistentHydraFootprintRuntime();
 },[]);
 useEffect(()=>{hydraRuntime.current.resetFeedback();},[floorScene]);

 // Changing Jeda/intensity/refill must never recreate the WebGL context,
 // otherwise a stage slider interaction can flash the projection.
 const snowfallConfig=useRef({paused:snowfallPaused,rate:snowfallRate,recovery:snowfallRecovery});
 snowfallConfig.current={paused:snowfallPaused,rate:snowfallRate,recovery:snowfallRecovery};
 cleanFloorOutput.current=floorScene==='footprints'?floorCanvas.current:
  floorScene==='snowfall'?snowfallCanvas.current:proceduralCanvas.current;
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
   if(hydraSettingsRef.current.enabled&&hydraRuntime.current.status==='ready'&&!previewHoldRef.current){
    if(archiveHydraReady.current&&archiveHydraCanvas.current){
     hydraRuntime.current.configure({...hydraSettingsRef.current,artwork:'off',catalogVisual:false});
     hydraRuntime.current.tick(archiveHydraCanvas.current,engine.canonicalRecent,engine.generation,now);
    }else{
     hydraRuntime.current.configure(hydraSettingsRef.current);
     hydraRuntime.current.tick(cleanFloorOutput.current,engine.canonicalRecent,engine.generation,now);
    }
   }
   const canvas=interactionCanvas.current;
   if(canvas&&!previewHoldRef.current)
    paintFloorInteractionOverlay(canvas,engine,time,Math.max(1200,footprint.life*1000));
   if(now-lastRead>=500){
    lastRead=now;const runtime=hydraRuntime.current;
    setHydraStatus(v=>v===(hydraSettingsRef.current.enabled?runtime.status:'off')?v:hydraSettingsRef.current.enabled?runtime.status:'off');
    setHydraReason(v=>v===runtime.reason?v:runtime.reason);
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
 // F1 paints a separate, clean FLOOR surface from the same F0 bus.
 // A source generation reset clears previous snow contacts on MP4 seek.
 useEffect(()=>{
  if(floorScene!=='snowfall'||!snowfallCanvas.current)return;
  const renderer=new SnowfallRenderer(snowfallCanvas.current);
  setSnowfallRendererMode(renderer.mode);
  let raf=0,last=0,lastRead=0;
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-last<1000/30)return;
   last=now;
   const scene=snowfallScene,bus=interactionEngineRef.current,cfg=snowfallConfig.current;
   const freeze=cfg.paused||previewHoldRef.current;
   if(scene.paused!==freeze)scene.setPaused(freeze);
   scene.consume(bus.recent,bus.generation,!freeze);
   const reactiveRate=Math.min(1,cfg.rate+
    audioLevelLive.current*proceduralConfig.current.audioMix*.5);
   scene.step(now,{snowfall:reactiveRate,recoverySeconds:cfg.recovery,paused:freeze});
   renderer.render(scene,scene.visualTimeMs,{snowfall:reactiveRate,recoverySeconds:cfg.recovery,paused:freeze});
   cleanFloorOutput.current=snowfallCanvas.current;
   if(now-lastRead>180){
    lastRead=now;setSnowfallCount(old=>old===scene.count?old:scene.count);
   }
  };
  raf=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(raf);renderer.dispose();};
 },[floorScene,snowfallScene]);
 useEffect(()=>{
  try{localStorage.setItem('soma-floor-scene-v1',floorScene);}catch{}
 },[floorScene]);
 // Shared audio envelope; optional mic only after explicit browser permission.
 useEffect(()=>{
  let raf=0,lastRead=0;
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-lastRead<100)return;
   lastRead=now;
   const level=audioMeter.current.sample(
    sceneAudioSourceRef.current,analyserRef.current);
   audioLevelLive.current=level;
   setSceneAudioLevel(prev=>Math.abs(prev-level)<.025?prev:level);
  };
  raf=requestAnimationFrame(draw);
  return()=>{
   cancelAnimationFrame(raf);audioRequest.current++;
   void audioMeter.current.disable();
  };
 },[]);
 const selectAudioInput=async(next:FloorAudioSource)=>{
  const request=++audioRequest.current;
  setSceneAudioError('');
  if(next==='microphone'){
   try{
    await audioMeter.current.enableMicrophone();
    if(request!==audioRequest.current){await audioMeter.current.disable();return;}
    setSceneAudioSource('microphone');
   }catch(error){
    if(request!==audioRequest.current)return;
    setSceneAudioSource('off');
    setSceneAudioError(error instanceof Error?error.message:'Akses mikrofon gagal.');
   }
  }else{
   setSceneAudioSource(next);
   await audioMeter.current.disable();
  }
 };
 // All 12 non-Snowfall scenes share a single continuously mounted canvas,
 // so input tracking and physical projector connections never restart.
 useEffect(()=>{
  if(floorScene==='footprints'||floorScene==='snowfall'||!proceduralCanvas.current)return;
  const canvas=proceduralCanvas.current;
  const bus=interactionEngineRef.current;
  // Switching scenes discards old events synchronously in selectFloorScene.
  // Do not skip again in this effect: an immediate first step can arrive
  // between React commit and effect and must remain eligible to trigger.
  proceduralRuntime.setScene(floorScene,bus.generation);
  let raf=0,last=0,lastRead=0;
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-last<1000/30)return;
   last=now;
   const bus=interactionEngineRef.current,cfg=proceduralConfig.current;
   const paused=cfg.paused||previewHoldRef.current;
   proceduralRuntime.ingest(bus.recent,bus.generation,!paused);
   proceduralRuntime.step(now,{...cfg,paused,
    audioLevel:audioLevelLive.current});
   if(!paused)proceduralRuntime.paint(canvas,{...cfg,
    audioLevel:audioLevelLive.current,paused});
   cleanFloorOutput.current=canvas;
   if(now-lastRead>180){
    lastRead=now;
    setSceneCount(old=>old===proceduralRuntime.contactCount?old:
     proceduralRuntime.contactCount);
   }
  };
  raf=requestAnimationFrame(draw);
  return()=>cancelAnimationFrame(raf);
 },[floorScene,proceduralRuntime]);
 const selectFloorScene=(next:'footprints'|FloorSceneId)=>{
  if(next==='footprints'&&sceneAudioSourceRef.current==='microphone'){
   audioRequest.current++;
   setSceneAudioSource('off');
   void audioMeter.current.disable();
  }
  const bus=interactionEngineRef.current,scene=snowfallScene;
  scene.reset(bus.generation);
  scene.consume(bus.recent,bus.generation,false);
  proceduralRuntime.setScene(next==='footprints'?'spring-garden':next,bus.generation);
  proceduralRuntime.skipExisting(bus.recent,bus.generation);
  setSnowfallCount(0);setSceneCount(0);setSnowfallPaused(false);setFloorScene(next);
  cleanFloorOutput.current=next==='footprints'?floorCanvas.current:
   next==='snowfall'?snowfallCanvas.current:proceduralCanvas.current;
 };
 const resetSnowfall=()=>{
  const scene=snowfallScene,bus=interactionEngineRef.current;
  scene.reset(bus.generation);scene.consume(bus.recent,bus.generation,false);
  scene.setPaused(snowfallPaused||previewHoldRef.current);
  proceduralRuntime.reset(bus.generation);
  proceduralRuntime.skipExisting(bus.recent,bus.generation);
  setSnowfallCount(0);setSceneCount(0);
 };
 const applyFloorPreset=(preset:FloorScenePreset)=>{
  selectFloorScene(preset.sceneId);
  setSceneIntensity(preset.intensity);setSceneRadius(preset.radius);
  setScenePersistence(preset.persistence);setSceneQuality(preset.quality);
  setSceneAudioMix(preset.audioMix);
  setSnowfallRate(preset.intensity);
  setSnowfallRecovery(Math.round(12+(1-preset.persistence)*228));
 };
 const saveScenePreset=(name:string)=>{
  if(floorScene==='footprints')return;
  try{
   const next=saveFloorPreset(localStorage,{
    schema:'soma.floor-scene-preset',version:1,
    name:name.trim().slice(0,64),sceneId:floorScene,
    intensity:floorScene==='snowfall'?snowfallRate:sceneIntensity,
    radius:sceneRadius,
    persistence:floorScene==='snowfall'?1-(snowfallRecovery-12)/228:scenePersistence,
    audioMix:sceneAudioMix,quality:sceneQuality
   });
   setUserPresets(next);
  }catch(error){setSceneAudioError(error instanceof Error?error.message:'Preset gagal disimpan.');}
 };
 const deleteScenePreset=(name:string)=>{
  try{
   const next=userPresets.filter(p=>p.name!==name);
   localStorage.setItem('soma-floor-scene-presets-v1',JSON.stringify(next));
   setUserPresets(next);
  }catch{setSceneAudioError('Tidak dapat menghapus preset lokal.');}
 };
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
 const [performBlackout,setPerformBlackout]=useState(true);
 const applyPerformSlot=(index:number)=>{
  const slot=performGrid.slots[index];if(!slot)return;
  // Cue loads scene/layout only, never hardware light permissions.
  selectFloorScene(slot.scene);
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
  // Archive unmounts when entering Perform; its dual windows are also
  // disarmed by the App-level global Blackout before the mode is changed.
  setCalibrationOpen(false);
  setComposerOpen(false);setMappingOpen(false);
  setView('stage');setOperatorCue(0);setActivePerformSlot(0);setPerformBlackout(true);
  updateFootprint({hold:true});
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
   const fresh=cameraSourceReady&&bodySelected&&f.source==='camera'&&f.tracked&&
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
  const surface=floorScene==='snowfall'?snowfallCanvas.current:
   floorScene==='footprints'?floorCanvas.current:proceduralCanvas.current;
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
  cameraOk:cameraOn&&bodySelected&&frameFresh&&!cameraBusy,
  identityOk:performerCount===1?!identityStatus.ambiguous:
   identityStatus.visible.length===2&&!identityStatus.ambiguous&&
   identityStatus.observedFrameTime===frameRef.current.time,
  floorOk:floorStatus.confirmed&&cameraMatched,
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
  source:sourceStatus.selection,cameraOn,cameraBusy,bodySelected,frameFresh,
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
  onBlackout();
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
  data-flow={flowStep} data-utility={videoLabOpen?'video':rehearsalOpen?'rehearsal':composerOpen?'composer':'none'}
  aria-label="Stage 1 — Motion Projection">
  <StageModuleNav active={operatorMode?'perform':composerOpen?(mappingOpen?'map':'compose'):'track'}
   onNavigate={onNavigateStageWorkspace}/>
  {!operatorMode&&!composerOpen&&view==='stage'&&<header className="soma-ia-track-head">
   <div className="soma-ia-track-title"><h1>Track</h1></div>
  </header>}
  {operatorMode?
   <OperatorStageConsole index={operatorCue} onPrevious={previousCue} onNext={nextCue}
    onExit={onExitOperator} onBlackout={operatorBlackout}
    held={footprint.hold||performBlackout} onHold={()=>updateFootprint({hold:true})}
    onResume={()=>{if(performUnsafeRef.current)return;setPerformBlackout(false);updateFootprint({hold:false});}}
    videoRecording={videoRecording} canRecordVideo={canRecordVideo}
    onRecordVideo={onRecordVideo} units={units}
    contacts={floorStatus.contacts} performerCount={performerCount}
    cueGrid={performGrid} activeSlot={activePerformSlot} onApplySlot={applyPerformSlot}
    onUpdateSlot={(index,changes)=>setPerformGrid(grid=>updatePerformCueSlot(grid,index,changes))}
    onSaveCue={savePerformGrid} onResetCues={resetPerformGrid} cueMessage={performMessage}
    scene={floorScene} previewStatus={experimentalKind==='video'?
     (selectedExperimentFrame?.kind==='video'&&selectedExperimentFrame.snapshot?
      selectedExperimentFrame.snapshot.visibleCount+'/2 · '+selectedExperimentFrame.snapshot.performance.poseFps.toFixed(1)+' FPS':'MP4 · menunggu pose'):
     experimentalKind==='simulator'?'Simulasi 3D':cameraLabel}
    sourceLabel={sourceStatus.selection??'Belum dipilih'}
    hardwareStatus={dual.body.mode.toUpperCase()+' BODY · '+dual.floor.mode.toUpperCase()+' FLOOR'}
    unreadyReason={performReadiness.state==='attention'||performReadiness.state==='qa-required'?performReadiness.reason:''}
    onRecovery={()=>{
     operatorBlackout();onExitOperator();setView('stage');
     const needsTrack=projectionPreflight.step==='source'||projectionPreflight.step==='tracking';
     setMappingOpen(!needsTrack);setComposerStartQA(!needsTrack);setComposerOpen(!needsTrack);
     setInspectorOpen(needsTrack);
     setFlowStep(needsTrack?'process':'output');
    }}
    canResume={!performUnsafe}/>
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
    {composerOpen&&!operatorMode&&view==='stage'&&<SurfaceComposer embedded sceneId={floorScene} mapMode={mappingOpen} onSceneChange={selectFloorScene}
     initialOutputQA={composerStartQA} experimentLocked={!!experimentalKind}
     bodyCanvas={bodyCanvas} floorCanvas={cleanFloorOutput} visualFloorCanvas={hydraFloorCanvas}
     composePreviewCanvas={composeFloorOverlay}
     previewFloorEnabled={hydraSettings.enabled&&hydraStatus==='ready'}
     hydraSettings={hydraSettings} onHydraSettingsChange={updateHydra} hydraStatus={hydraStatus}
     previewResumeRevision={previewResumeRevision} previewBlackout={softwareBlackout}
     archiveHydraCanvas={archiveHydraCanvas}
     onArchiveHydraChange={enabled=>{archiveHydraReady.current=enabled;
      if(enabled)setHydraSettings(v=>v.enabled?v:normalizeHydraFootprintSettings({...v,enabled:true}));}}
     frameRef={frameRef} videoRef={videoRef}
     router={router} floorTracker={tracker} projection={projection}
     cameraOn={cameraOn} bodySelected={bodySelected} performerCount={performerCount}
     floorReady={floorStatus.confirmed&&cameraMatched}
     floorEvents={()=>tracker.session?.events??[]}
     motionEvents={()=>interactionEngineRef.current.canonicalRecent}
     motionSession={()=>interactionEngineRef.current.currentSessionId}
     identitySafe={!identityStatus.ambiguous}
     onClose={()=>{archiveHydraReady.current=false;onBlackout();setComposerOpen(false);setMappingOpen(false);setComposerStartQA(false);}}/>}
    <div className="fp-stage-overview" ref={composeLayout.overview} data-dragging={composeLayout.dragging??'none'} style={composerOpen&&!mappingOpen?composeLayout.style:undefined} hidden={view!=='stage'||(composerOpen&&mappingOpen)}>
     <aside className="soma-track-source-panel" hidden={composerOpen||operatorMode}
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
      {ownership.webcamAction&&<button type="button" className="soma-track-side-action"
       onClick={onStartBody} disabled={ownership.webcamAction==='connecting'||cameraBusy}
       aria-busy={ownership.webcamAction==='connecting'}>
       {ownership.webcamAction==='connecting'&&
        <span className="trk06a-button-spinner" aria-hidden="true"/>}
       {ownership.webcamAction==='retry'?'Coba lagi':
        ownership.webcamAction==='connecting'?'Menghubungkan…':'Aktifkan webcam'}
      </button>}
      {ownership.showBodyAction&&<button type="button" className="soma-track-side-action"
       onClick={onStartBody}>Aktifkan Body</button>}
      {sourceStatus.selection==='phone'&&!phonePanelOpen&&<button type="button" className="soma-track-side-action"
       aria-expanded={phonePanelOpen} aria-controls="soma-track-phone-pairing"
       onClick={()=>{setPhonePanelOpen(v=>!v);setCalibrationOpen(false);setInspectorOpen(false);}}>
       {phoneActive?'Lihat koneksi HP':'Hubungkan HP'}
      </button>}
      {sourceStatus.selection==='phone'&&<section id="soma-track-phone-pairing" className="soma-track-phone-pairing"
       hidden={!phonePanelOpen||operatorMode} aria-hidden={!phonePanelOpen||operatorMode}
       aria-label="Pairing kamera HP">
       <header className="soma-track-phone-heading"><strong>Pairing kamera</strong>
        <button type="button" aria-label="Tutup pairing kamera HP" onClick={closePhonePanel}>×</button>
       </header>
       <PhoneCameraReceiver onStream={onPhoneStream} onDisconnect={onPhoneDisconnect}/>
      </section>}
      {experimentalKind&&<FootprintsExperimentalSource
       key={experimentalKind} kind={experimentalKind}
       model={experimentPuppet} externalRevision={experimentPuppetRevision}
       clip={experimentClip} onClip={onExperimentClip} onFrame={onExperimentFrame}
       onAdvancedVideo={()=>{onBlackout();setVideoLabOpen(true);}}
       onAdvancedSimulator={()=>{onBlackout();onOpenSimulator();}}/>}
      <div className="soma-track-source-utilities">
       {sourceStatus.selection!==null&&!experimentalKind&&cameraOn&&<QuickStageSetup cameraOn={cameraOn} cameraBusy={cameraBusy}
     cameraError={cameraError} bodySelected={bodySelected} videoReady={videoReady}
     frameFresh={frameFresh} cameraMatched={cameraMatched}
     outputConnected={legacy.connected||dual.body.connected||dual.floor.connected}
     performerCount={performerCount}
     visibleCount={identityStatus.visible.length}
     identityAmbiguous={identityStatus.ambiguous}
     identityMatchedFrame={identityStatus.observedFrameTime===frameRef.current.time}
     devices={cameraDevices} deviceId={selectedCameraId} videoRef={videoRef}
     tracker={tracker} router={router} onConnectCamera={()=>chooseSource('webcam')}
     onSelectCamera={onSelectCameraDevice} onOpenCalibration={openCalibration}
     projectionPreflight={projectionPreflight} onPrepareProjection={prepareProjection}
     onOpenProjector={openProjectorQA} onBlackout={onBlackout}
     inspectorOpen={inspectorOpen} onExpand={()=>{
      setInspectorOpen(false);setCalibrationOpen(false);
     }}/>}
       <button type="button" className="soma-ia-advanced-button" aria-expanded={inspectorOpen}
        onClick={event=>{setPhonePanelOpen(false);
         setupTrigger.current=event.currentTarget;
         if(experimentalKind==='video'){setVideoLabOpen(true);setInspectorOpen(false);}
         else {setFlowStep('process');setInspectorOpen(v=>!v);}}}>
        Pengaturan
       </button>
      </div>
     </aside>
     {showSetupHint&&ownership.showInlineAssistant&&
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
        Skeleton <span aria-hidden="true">{skeletonVisible?'ON':'OFF'}</span>
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
      <div className="fp-stage-surface fp-preview-floor" data-floor-scene={floorScene} data-hydra-visible={hydraSettings.enabled&&hydraStatus==="ready"}
       data-procedural={floorScene!=='footprints'&&floorScene!=='snowfall'}
       data-compose-events={composerOpen&&!mappingOpen&&showComposeEvents}>
       <div className="fp-stage-surface-head"><span>{floorScene==='footprints'?'FLOOR · PATH PREVIEW':
        'FLOOR · '+FLOOR_SCENES.find(item=>item.id===floorScene)?.name.toUpperCase()}</span>
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
       <div className="fp-floor-scene-controls" role="group" aria-label="Scene dan pengaturan FLOOR">
        <label>SCENE <select aria-label="Pilih scene FLOOR" value={floorScene}
         onChange={e=>selectFloorScene(e.target.value as 'footprints'|FloorSceneId)}>
         <option value="footprints">Footprints · Legacy</option>
         {FLOOR_SCENES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        {floorScene==='snowfall'&&<>
         <span className="fp-snowfall-counter" role="status">
          {snowfallCount} jejak · {snowfallRendererMode==='webgl2'?'GPU WebGL2':
           snowfallRendererMode==='2d'?'2D fallback':'GPU tidak tersedia'}</span>
         <button type="button" className="fp-snowfall-pause" aria-pressed={snowfallPaused}
          onClick={()=>setSnowfallPaused(p=>!p)}>{snowfallPaused?'Lanjut':'Jeda'}</button>
         <button type="button" onClick={resetSnowfall}>Reset salju</button>
         <details className="fp-snowfall-options">
          <summary>Atur</summary>
          <div>
           <label>Turun salju · {Math.round(snowfallRate*100)}%
            <input aria-label="Intensitas snowfall" type="range" min="0" max="1" step=".05"
             value={snowfallRate} onChange={e=>setSnowfallRate(Number(e.target.value))}/>
           </label>
           <label>Tutup jejak · {snowfallRecovery} dtk
            <input aria-label="Durasi pemulihan salju" type="range" min="12" max="240" step="1"
             value={snowfallRecovery} onChange={e=>setSnowfallRecovery(Number(e.target.value))}/>
           </label>
          </div>
         </details>
        </>}
        {floorScene!=='snowfall'&&floorScene!=='footprints'&&<>
         <span className="fp-snowfall-counter" role="status">{sceneCount} kontak · Procedural 2D</span>
         <button type="button" className="fp-snowfall-pause" aria-pressed={snowfallPaused}
          onClick={()=>setSnowfallPaused(p=>!p)}>{snowfallPaused?'Lanjut':'Jeda'}</button>
         <button type="button" onClick={resetSnowfall}>Reset scene</button>
        </>}
        <details className="fp-hydra-controls">
         <summary aria-label="Pengaturan Hydra FLOOR">HYDRA · {hydraSettings.enabled?hydraStatus.toUpperCase():'OFF'}</summary>
         <div className="fp-hydra-panel">
          <strong>GENERATIVE / FLOOR</strong>
          <label><input type="checkbox" checked={hydraSettings.enabled}
           onChange={e=>updateHydra({enabled:e.target.checked})}/> Aktifkan Hydra untuk preview</label>
          <label><input type="checkbox" checked={hydraSettings.catalogVisual}
           onChange={e=>updateHydra({catalogVisual:e.target.checked})}/> Artistic scene profiles (14 scenes)</label>
          <small>Active catalog: {floorScene} · 14 distinct contact-bound motifs. Hardware output unchanged.</small>
          <label>Flagship artwork<select aria-label="Pilih artwork Footprints" value={hydraSettings.artwork}
           onChange={e=>updateHydra({enabled:e.target.value!=='off'||hydraSettings.enabled,
            artwork:e.target.value as HydraFootprintSettings['artwork']})}>
           <option value="off">Use selected scene's catalog profile</option>
           {ARTISTIC_FOOTPRINT_STYLES.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          {(hydraSettings.artwork!=='off'||hydraSettings.catalogVisual)&&<>
           <label>Representation<select aria-label="Artistic atau literal" value={hydraSettings.artworkTreatment}
            onChange={e=>updateHydra({artworkTreatment:e.target.value as HydraFootprintSettings['artworkTreatment']})}>
            <option value="artistic">Artistic</option><option value="literal">Literal footprint</option>
           </select></label>
           <label>Footprint / Path<select aria-label="Tampilkan jejak dan lintasan" value={hydraSettings.artworkView}
            onChange={e=>updateHydra({artworkView:e.target.value as HydraFootprintSettings['artworkView']})}>
            <option value="both">Footprints + Paths</option><option value="footprints">Footprints only</option><option value="paths">Paths only</option>
           </select></label>
          </>}
          <label>Hydra shader<select value={hydraSettings.style}
           onChange={e=>updateHydra({style:e.target.value as HydraFootprintSettings['style']})}>
           {HYDRA_FOOTPRINT_STYLES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          {(['mix','distortion','feedback','motion'] as const).map(field=><label key={field}>
           {field.toUpperCase()} · {Math.round(hydraSettings[field]*100)}%
           <input type="range" min="0" max={field==='feedback'?.65:field==='distortion'?.4:1}
            step=".01" value={hydraSettings[field]}
            onChange={e=>updateHydra({[field]:Number(e.target.value)})}/>
          </label>)}
          <small>{hydraReason?'GPU fallback: '+hydraReason:'Preview artistik. Output fisik tetap mengikuti QA Map.'}</small>
          {hydraStatus==='fallback'&&<button type="button" onClick={()=>updateHydra({enabled:false})}>Gunakan renderer asli</button>}
         </div>
        </details>
        {floorScene!=='footprints'&&<FloorSceneAdvancedControls
         params={{intensity:sceneIntensity,radius:sceneRadius,
          persistence:scenePersistence,quality:sceneQuality,audioMix:sceneAudioMix}}
         onParams={(next:Partial<FloorAdvancedParams>)=>{
          if(next.intensity!==undefined)setSceneIntensity(next.intensity);
          if(next.radius!==undefined)setSceneRadius(next.radius);
          if(next.persistence!==undefined)setScenePersistence(next.persistence);
          if(next.quality!==undefined)setSceneQuality(next.quality);
          if(next.audioMix!==undefined)setSceneAudioMix(next.audioMix);
         }}
         presets={userPresets} onApplyPreset={applyFloorPreset}
         onSavePreset={saveScenePreset} onDeletePreset={deleteScenePreset}
         audioSource={sceneAudioSource} audioLevel={sceneAudioLevel}
         audioError={sceneAudioError} onAudioSource={next=>{void selectAudioInput(next);}}
        />}
       </div>
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
        <canvas ref={snowfallCanvas} className="fp-floor-snowfall-canvas" width={1280} height={720}
         aria-label="Pratinjau Snowfall, salju menutup jejak kaki perlahan"/>
        <canvas ref={proceduralCanvas} className="fp-floor-procedural-canvas" width={1280} height={720}
         aria-label="Pratinjau procedural FLOOR yang dipilih"/>
        <canvas ref={hydraFloorCanvas} className="fp-floor-hydra-canvas" width={640} height={360}
         aria-label="Hydra generatif FLOOR · software preview"/>
        <canvas ref={interactionCanvas} className="fp-floor-interaction-layer"
         width={1280} height={720} aria-hidden="true"/>
        <canvas ref={composeFloorOverlay} className="cp03-composition-overlay"
         width={1280} height={720} aria-label="Layer media komposisi pada preview FLOOR; output software"/>
        {touchDemo&&<span className="fp-floor-touch-hint" aria-hidden="true">
         Sentuh lantai · interaksi sintetis · SOFTWARE ONLY</span>}
        {floorScene==='footprints'&&!experimentalKind&&!floorStatus.confirmed&&!footprint.hold&&<span className="fp-stage-canvas-empty">
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
  {!operatorMode&&!composerOpen&&view==='stage'&&<FootprintsStageTransport cameraOn={cameraOn} cameraBusy={cameraBusy}
   experiment={experimentalKind}
   frameFresh={frameFresh} videoRecording={videoRecording} canRecordVideo={canRecordVideo}
   bodySelected={bodySelected}
   held={footprint.hold} legacy={legacy} dual={dual} canPreview={view==='stage'}
   onCamera={onToggleCamera} onRecordVideo={onRecordVideo} onCapture={onCapture}
   onHold={()=>updateFootprint({hold:true})}
   onLivePreview={()=>updateFootprint({hold:false})} onBlackout={onBlackout}
   onOutputSettings={prepareProjection}/>}
 </section>;
}
