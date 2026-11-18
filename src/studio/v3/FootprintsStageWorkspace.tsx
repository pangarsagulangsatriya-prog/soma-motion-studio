import {useCallback,useEffect,useRef,useState,type RefObject,type PointerEvent} from 'react';
import {moveOperatorCue,operatorCueAt,operatorShortcut} from './OperatorStageModel.ts';
import {OperatorStageConsole} from './OperatorStageConsole.tsx';
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
import {useStageSession} from '../../stage/useStageSession.ts';
import {Camera,Film,Layers3,MonitorPlay,Maximize2,Minimize2} from 'lucide-react';
import {STAGE_PREVIEW_MODES,parseStagePreviewMode,previewLabel,type StagePreviewMode} from './stagePreviewModel.ts';
import {isDismissEscape,shouldOpenInspector,shouldEnterInspectorByArrow} from './interactionPolicy.ts';
import {FootprintsSourceSwitcher} from './FootprintsSourceSwitcher.tsx';
import {FootprintsExperimentalSource} from './FootprintsExperimentalSource.tsx';
import {DirectPuppetSession} from '../../footprints/simulator/puppet-controller.ts';
import {activeExperimentKind,currentExperimentFrame,experimentFrameLabel,type ExperimentalFrame} from './experimentSourceModel.ts';
import {paintExperimentBody,paintExperimentCamera,paintExperimentFloor} from './experimentStagePainter.ts';
import {drawSkeletonBodies} from '../../stage/fullBodySkeleton.ts';
import {ActorMotionStateBuffer} from '../../stage/actorMotionStateBuffer.ts';
import {FootprintsVideoOpticalFlow} from '../../stage/footprintsVideoOpticalFlow.ts';
import {PersistentBodyMaskEngine} from '../../stage/persistentBodyMaskEngine.ts';
import {LiveBodyProjectionBridge} from '../../stage/liveBodyProjectionBridge.ts';
import {PhoneCameraReceiver} from '../../stage/PhoneCameraReceiver.tsx';
import type {FootprintsInputChoice,FootprintsInputStatus} from './sourceSwitchModel.ts';
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
import {FloorInteractionEngine,type FloorInteractionSource} from '../../footprints/scenes/FloorInteractionEngine.ts';
import {SnowfallScene} from '../../footprints/scenes/SnowfallScene.ts';
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

type WorkspaceView='stage'|'archive';
type Props={
 navigationRequest?:StageNavigationRequest|null;
 onActiveToolChange?:(tool:StageNavigationRequest['tool'])=>void;
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
 videoRecording:boolean;canRecordVideo:boolean;
 footprint:FootprintConfig;
 updateFootprint:(value:Partial<FootprintConfig>)=>void;
};
const blockedReason=(cameraOn:boolean,calibrated:boolean,confirmed:boolean)=>
 !cameraOn?'Kamera Body belum aktif.':!calibrated?'Lantai belum dikalibrasi.':
 !confirmed?'Konfirmasi kalibrasi lantai.':'Menunggu event pijakan.';
export function FootprintsStageWorkspace({
 navigationRequest,onActiveToolChange,frameRef,videoRef,tracker,router,projection,audioAnalyser,cameraOn,cameraBusy,cameraError,bodySelected,legacyApproved,
 cameraDevices,selectedCameraId,onSelectCameraDevice,
 sourceStatus,onSwitchSource,experimentPuppet,experimentPuppetRevision,
 performerCount,onPerformerCount,onStartBody,onOpenSimulator,onOpenLiveFloor,onOpenProjection,
 onPhoneStream,onPhoneDisconnect,
 onBlackout,onToggleCamera,onRecordVideo,onCapture,videoRecording,canRecordVideo,
 operatorMode,onExitOperator,footprint,updateFootprint
}:Props){
 const cameraCanvas=useRef<HTMLCanvasElement>(null);
 const bodyCanvas=useRef<HTMLCanvasElement>(null);
 const floorCanvas=useRef<HTMLCanvasElement>(null);
 const snowfallCanvas=useRef<HTMLCanvasElement>(null);
 const proceduralCanvas=useRef<HTMLCanvasElement>(null);
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
 // Changing Jeda/intensity/refill must never recreate the WebGL context,
 // otherwise a stage slider interaction can flash the projection.
 const snowfallConfig=useRef({paused:snowfallPaused,rate:snowfallRate,recovery:snowfallRecovery});
 snowfallConfig.current={paused:snowfallPaused,rate:snowfallRate,recovery:snowfallRecovery};
 cleanFloorOutput.current=floorScene==='footprints'?floorCanvas.current:
  floorScene==='snowfall'?snowfallCanvas.current:proceduralCanvas.current;
 const stageSession=useStageSession();
 const [calibrationOpen,setCalibrationOpen]=useState(false);
 const [phonePanelOpen,setPhonePanelOpen]=useState(false);
 useEffect(()=>{if(sourceStatus.selection!=='phone')setPhonePanelOpen(false);},[sourceStatus.selection]);
 const experimentalKind=activeExperimentKind(sourceStatus.selection);
 const [experimentClip,setExperimentClip]=useState<File|null>(null);
 const [experimentFrame,setExperimentFrame]=useState<ExperimentalFrame|null>(null);
 const experimentFrameRef=useRef<ExperimentalFrame|null>(null);
 experimentFrameRef.current=experimentFrame;
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
 const selectedExperimentFrame=currentExperimentFrame(experimentalKind,experimentFrame);
 const interactionSource:FloorInteractionSource|null=touchDemo?'touch':
  experimentalKind??(sourceStatus.selection==='phone'?'phone':
   sourceStatus.selection==='webcam'?'camera':null);
 useEffect(()=>{
  interactionEngineRef.current.reset(interactionSource);
  touchPointers.current.clear();
  setFloorInteractionStats({actors:0,contacts:0,events:0});
 },[interactionSource,experimentClip]);
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
    lastRead=now;const snap=engine.snapshot;
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
   composerOpen?'composer':view==='archive'?'archival-mapping':'live';
  onActiveToolChange?.(tool);
 },[calibrationOpen,videoLabOpen,rehearsalOpen,composerOpen,view,onActiveToolChange,navigationRequest?.tool]);
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
  setFlowStep('compose');setCalibrationOpen(false);setInspectorOpen(false);
  setView('archive');
 };
 useEffect(()=>{
  if(!operatorMode)return;
  // Archive unmounts when entering Perform; its dual windows are also
  // disarmed by the App-level global Blackout before the mode is changed.
  setCalibrationOpen(false);
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
   if(experimentalKind)return;
   if(now-lastDraw<1000/18)return;
   lastDraw=now;
   const f=frameRef.current,v=videoRef.current;
   const identities=router.status;
   if(!touchDemo&&cameraOn&&bodySelected){
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
     // Diagnostic only: uses latest raw CameraTracker poses, never the
     // physical BODY/FLOOR output, gait event gate or projector approval.
     if(skeletonVisible&&!calibrationOpen&&f.source==='camera'&&f.time>0&&
      now>=f.time&&now-f.time<450){
      drawSkeletonBodies(cam,f.poses??[],
       {x:(camera.width-w)/2,y:(camera.height-h)/2,width:w,height:h});
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
 },[frameRef,videoRef,tracker,router,cameraOn,bodySelected,performerCount,experimentalKind,skeletonVisible,calibrationOpen,touchDemo,sourceStatus.selection]);
 // S0.2/S0.3: AI snapshots update a per-actor motion buffer; software
 // canvases paint at DISPLAY refresh (rAF), not only on AI arrival or 30 FPS.
 // FLOOR continues to render only measured contact events.
 useEffect(()=>{
  if(experimentalKind!=='video')return;
  let raf=0,lastFloorAt=-Infinity,lastVideoAt=-1;
  let source:HTMLVideoElement|null=null;
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
    if(!touchDemo)feedVideoFloorInteractions(interactionEngineRef.current,frame);
    if(source!==current.video||current.video?.seeking||
       (lastVideoAt>=0&&atMs<lastVideoAt-50)){
     buffer.reset();flowTracker.reset();maskTracker.reset();bodyBridge.reset();lastFloorAt=-Infinity;
     if(!touchDemo)interactionEngineRef.current.reset('video');
    }
    source=current.video;
    lastVideoAt=atMs;
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
   else document.querySelector<HTMLButtonElement>('.fp-flow-local-tabs button[aria-current="step"]')
    ?.focus({preventScroll:true});
   setupTrigger.current=null;
  });
 };
 const closeCalibration=()=>{
  setCalibrationOpen(false);setInspectorOpen(true);restoreFlowFocus();
 };
 const closePhonePanel=()=>{
  setPhonePanelOpen(false);
  requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(
   '.fp-source-switch-trigger')?.focus({preventScroll:true}));
 };
 const closeInspector=()=>{setCalibrationOpen(false);setInspectorOpen(false);restoreFlowFocus();};
 useEffect(()=>{
  const request=navigationRequest;
  if(!request||lastNavRequest.current===request.id)return;
  lastNavRequest.current=request.id;
  setCalibrationOpen(false);setVideoLabOpen(false);setRehearsalOpen(false);
  setComposerOpen(false);
  onBlackout();
  switch(request.tool){
   case 'live':setView('stage');setInspectorOpen(true);break;
   case 'setup':setView('stage');setFlowStep('process');setInspectorOpen(true);setCalibrationOpen(true);break;
   case 'archival-mapping':showArchive();break;
   case 'composer':setView('stage');setFlowStep('compose');setComposerOpen(true);break;
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
  setView('stage');setCalibrationOpen(false);setInspectorOpen(choice==='phone');
  setPhonePanelOpen(choice==='phone');
  setVideoLabOpen(false);setRehearsalOpen(false);setComposerOpen(false);
  return true;
 };
 const openProjectorQA=()=>{
  onBlackout();setCalibrationOpen(false);setInspectorOpen(false);
  setView('stage');setComposerStartQA(true);setComposerOpen(true);
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
 const showSetupHint=!experimentalKind&&(
  setupHint.severity==='warning'||setupHint.severity==='busy'||
  (sourceStatus.selection===null&&setupHint.id==='source')
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
    const trigger=document.querySelector<HTMLButtonElement>('.fp-source-switch-trigger');
    trigger?.focus({preventScroll:true});trigger?.click();break;
   }
   case 'webcam':void chooseSource('webcam');break;
   case 'phone':
    if(sourceStatus.selection==='phone'){
     setCalibrationOpen(false);setInspectorOpen(true);setPhonePanelOpen(true);
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
 return <section className={'fp-stage-workspace fp-persistent-layout'+(operatorMode?' fp-operator-mode':'')}
  data-operator-cue={operatorCueAt(operatorCue).id} data-context="inspector"
  data-inspector-open={(inspectorOpen||phonePanelOpen)&&!operatorMode} data-source-ready={operatorMode||gaitPreviewVisible}
  data-screen={screenMode} data-source-mode={sourceMode} data-preview-mode={previewMode} data-focus-preview={focusPreview}
  data-experimental={!!experimentalKind} data-skeleton-visible={skeletonVisible}
  data-flow={flowStep} data-utility={videoLabOpen?'video':rehearsalOpen?'rehearsal':composerOpen?'composer':'none'}
  aria-label="Workspace utama SOMA Footprints">
  {!operatorMode&&<nav className="fp-flow-nav" aria-label="Pengaturan Footprints">
   <div className="fp-flow-nav-left">
    <span className="fp-flow-name">FOOTPRINTS</span>
    <div className="fp-flow-local-tabs" role="group" aria-label="Bagian kerja Footprints">
     {footprintsSteps.map(item=><button type="button" key={item.id}
      aria-current={flowStep===item.id&&inspectorOpen?'step':undefined}
      aria-expanded={flowStep===item.id&&inspectorOpen}
      aria-controls={flowStep===item.id&&inspectorOpen?'fp-context-panel':undefined}
      onClick={event=>selectFlowStep(item.id,event.currentTarget,true)}
      onKeyDown={event=>{
       if(shouldEnterInspectorByArrow(event,flowStep===item.id&&inspectorOpen)){
        event.preventDefault();
        document.querySelector<HTMLElement>('#fp-context-panel .fp-flow-inspector-head button, #fp-context-panel .fp-inline-floor-heading button')
         ?.focus({preventScroll:true});
       }
      }} title={item.hint}>
      {item.title}</button>)}
    </div>
   </div>
   <QuickStageSetup cameraOn={cameraOn} cameraBusy={cameraBusy}
    cameraError={cameraError} bodySelected={bodySelected} videoReady={videoReady}
    frameFresh={frameFresh} cameraMatched={cameraMatched}
    outputConnected={legacy.connected||dual.body.connected||dual.floor.connected}
    performerCount={performerCount}
    visibleCount={identityStatus.visible.length}
    identityAmbiguous={identityStatus.ambiguous}
    identityMatchedFrame={identityStatus.observedFrameTime===frameRef.current.time}
    devices={cameraDevices}
    deviceId={selectedCameraId} videoRef={videoRef}
    tracker={tracker} router={router} onConnectCamera={()=>chooseSource('webcam')}
    onSelectCamera={onSelectCameraDevice} onOpenCalibration={openCalibration}
    projectionPreflight={projectionPreflight} onPrepareProjection={prepareProjection}
    onOpenProjector={openProjectorQA} onBlackout={onBlackout}/>
   <FootprintsSourceSwitcher status={sourceStatus} onChoose={chooseSource}
    onPhoneManager={()=>{setPhonePanelOpen(true);setInspectorOpen(true);setCalibrationOpen(false);}}/>

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
  {composerOpen&&!operatorMode&&view==='stage'&&<SurfaceComposer initialOutputQA={composerStartQA} experimentLocked={!!experimentalKind}
   bodyCanvas={bodyCanvas} floorCanvas={cleanFloorOutput} frameRef={frameRef} videoRef={videoRef}
   router={router} floorTracker={tracker} projection={projection}
   cameraOn={cameraOn} bodySelected={bodySelected} performerCount={performerCount}
   floorReady={floorStatus.confirmed&&cameraMatched}
   floorEvents={()=>tracker.session?.events??[]}
   identitySafe={!identityStatus.ambiguous}
   onClose={()=>{onBlackout();setComposerOpen(false);}}/>}
  <div className="fp-stage-layout">
   <div className="fp-stage-main">
    <div className="fp-stage-overview" hidden={view!=='stage'}>
     {showSetupHint&&<InlineSetupAssistant hint={setupHint} onAction={handleAssistantAction}/>}
     {experimentalKind&&<FootprintsExperimentalSource
      key={experimentalKind} kind={experimentalKind}
      model={experimentPuppet} externalRevision={experimentPuppetRevision}
      clip={experimentClip} onClip={setExperimentClip} onFrame={onExperimentFrame}
      onAdvancedVideo={()=>{onBlackout();setVideoLabOpen(true);}}
      onAdvancedSimulator={()=>{onBlackout();onOpenSimulator();}}/>}

     <div className="fp-stage-video">
      <div className="fp-stage-surface-head"><span>{experimentalKind?
       experimentalKind==='video'?'INPUT · VIDEO':'INPUT · PUPPET 3D':'INPUT · KAMERA'}</span>
       {experimentalKind!=='simulator'&&<button type="button" className="fp-full-skeleton-switch"
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
       role={!calibrationOpen?'button':undefined}
       tabIndex={!calibrationOpen?0:undefined}
       title={!calibrationOpen?'Klik untuk memperbesar INPUT':undefined}
       aria-label={!calibrationOpen?'Fokus preview INPUT':undefined}
       onClick={event=>{if(!calibrationOpen)selectPreviewFocus('input',event.currentTarget);}}
       onKeyDown={event=>{
        if(!calibrationOpen&&(event.key==='Enter'||event.key===' ')){
         event.preventDefault();selectPreviewFocus('input',event.currentTarget);
        }
       }}>
       <canvas ref={cameraCanvas} width={768} height={432}
        onPointerDown={onMainCameraPoint}
        data-calibration-active={calibrationOpen&&!!calibrationOverlay}
        aria-label={experimentalKind?experimentalKind==='video'?'Input video rekaman 2D':'Input puppet 3D virtual':
         calibrationOpen&&calibrationOverlay?'Klik empat sudut kalibrasi lantai pada kamera besar':'Pratinjau video kamera SOMA Body'}/>
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
       {!experimentalKind&&sourceMode==='switch-body'&&!operatorMode&&<div className="fp-stage-empty fp-source-correction" role="status">
        <Camera size={24} aria-hidden="true"/>
        <strong>Kamera sudah terhubung</strong>
        <p>Aktifkan pelacakan Body untuk membaca gerakan kaki.</p>
        <button type="button" onClick={onStartBody}>
         <Camera size={15} aria-hidden="true"/> Gunakan mode Body</button>
       </div>}
       {!experimentalKind&&sourceMode==='warming'&&!operatorMode&&<div className="fp-stage-empty fp-source-warming" role="status">
        <span className="fp-source-spinner" aria-hidden="true"/>
        <strong>Menyiapkan preview kamera</strong>
        <p>Menunggu frame pertama dari perangkat. Periksa sambungan dan izin kamera.</p>
       </div>}
      </div>
      <div className="fp-stage-surface-foot"><span>{experimentalKind?selectedExperimentFrame?
       selectedExperimentFrame.kind==='video'?'Video 2D':'Puppet virtual':'Menyiapkan sumber':
       frameFresh?'Pose kamera baru':'Menunggu pose valid'}</span>
       <span>{experimentalKind?'OUTPUT FISIK TERKUNCI':performerCount+' performer'}</span></div>
     </div>
     <div className="fp-stage-side-previews" data-preview-mode={previewMode}
      aria-label="Preview BODY dan FLOOR dari engine Footprints">
      <div className="fp-stage-preview-toolbar">
       <div className="fp-stage-preview-heading"><span><MonitorPlay size={15} aria-hidden="true"/> PREVIEW</span>
        <small>{experimentalKind?experimentFrameLabel(experimentalKind):previewLabel(previewMode)+' · Preview software'}</small></div>
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
        {footprint.hold&&<span className="fp-stage-hold-label">
         HOLD · frame BODY ditahan, tracking tetap berjalan</span>}
       </div>
       <div className="fp-stage-surface-foot"><span>{experimentalKind?
 experimentalKind==='video'?'Landmark video 2D':'Puppet sintetis (bukan mask fisik)':maskStatus}</span>
 <span>{experimentalKind?'Preview eksperimen':'Mask · preview'}</span></div>
      </div>
      <div className="fp-stage-surface fp-preview-floor" data-floor-scene={floorScene}
       data-procedural={floorScene!=='footprints'&&floorScene!=='snowfall'}>
       <div className="fp-stage-surface-head"><span>{floorScene==='footprints'?'FLOOR · PATH PREVIEW':
        'FLOOR · '+FLOOR_SCENES.find(item=>item.id===floorScene)?.name.toUpperCase()}</span>
        <small className="fp-floor-bus-status" title="Satu bus presence, movement dan contact untuk seluruh input">
         BUS · {floorInteractionStats.actors} sumber gerak · {floorInteractionStats.contacts} kontak
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
        <canvas ref={interactionCanvas} className="fp-floor-interaction-layer"
         width={1280} height={720} aria-hidden="true"/>
        {touchDemo&&<span className="fp-floor-touch-hint" aria-hidden="true">
         Sentuh lantai · interaksi sintetis · SOFTWARE ONLY</span>}
        {floorScene==='footprints'&&!experimentalKind&&!floorStatus.confirmed&&!footprint.hold&&<span className="fp-stage-canvas-empty">
         {blockedReason(cameraOn,floorStatus.calibrated,floorStatus.confirmed)}</span>}
        {footprint.hold&&<span className="fp-stage-hold-label">
         HOLD · frame FLOOR ditahan, event tetap tercatat</span>}
       </div>
       <div className="fp-stage-surface-foot"><span>{selectedExperimentFrame?
 selectedExperimentFrame.kind==='simulator'?selectedExperimentFrame.session.events.filter(e=>e.kind==='contact').length+' kontak sintetis':
 (selectedExperimentFrame.snapshot?.events.filter(e=>e.kind==='contact').length??0)+' kontak video':
 experimentalKind?'0 kontak':floorStatus.contacts+' kontak'}</span>
        <span>{selectedExperimentFrame?selectedExperimentFrame.kind==='simulator'?
 selectedExperimentFrame.session.events.length:selectedExperimentFrame.snapshot?.events.length??0:
 experimentalKind?0:floorStatus.events} event</span></div>
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
     <ArchivalMappingPanel frameRef={frameRef} cameraOn={cameraOn} experimentLocked={!!experimentalKind}
      performerCount={performerCount} router={router} projection={projection}
      stageMedia={stageSession.media} onStageMedia={stageSession.chooseMedia}
      stageSettings={stageSession.meta.archiveSettings}
      onStageSettings={settings=>stageSession.patch({archiveSettings:settings})}
      stageHoldMs={stageSession.meta.bridgeHoldMs}
      onStageHoldMs={ms=>stageSession.patch({bridgeHoldMs:ms})}/>
    </div>}
   </div>
   {((!operatorMode&&inspectorOpen)||sourceStatus.selection==='phone')&&<aside id="fp-context-panel"
    className="fp-stage-inspector" data-phone-visible={phonePanelOpen&&!operatorMode}
    data-panel-hidden={operatorMode||(!inspectorOpen&&!phonePanelOpen)}
    data-mode={calibrationOpen?'calibration':'inspector'} aria-label={calibrationOpen?'Kalibrasi lantai':'Pengaturan tahap '+flowStep}
    onKeyDown={event=>{
     if(isDismissEscape(event)){
      event.preventDefault();event.stopPropagation();
      if(phonePanelOpen)closePhonePanel();else if(calibrationOpen)closeCalibration();else closeInspector();
     }
    }}>
    {sourceStatus.selection==='phone'&&<div className="fp-phone-source-panel"
     hidden={!phonePanelOpen||operatorMode} aria-hidden={!phonePanelOpen||operatorMode}>
      <header className="fp-phone-source-heading">
       <div><small>INPUT / KAMERA HP</small><h2>Hubungkan kamera HP</h2>
        <p>Pairing tetap berjalan ketika panel ditutup.</p></div>
       <button type="button" aria-label="Tutup panel kamera HP"
        onClick={closePhonePanel}>✕</button>
      </header>
      <PhoneCameraReceiver onStream={onPhoneStream} onDisconnect={onPhoneDisconnect}/>
     </div>}
    {!operatorMode&&calibrationOpen&&!phonePanelOpen&&<InlineFloorCalibration
     key={sourceStatus.selection??'none'}
     videoRef={videoRef} tracker={tracker} router={router}
     cameraOn={cameraOn} bodySelected={bodySelected} videoReady={videoReady}
     cameraMatched={cameraMatched} onBlackout={onBlackout}
     onClose={closeCalibration} onOpenQA={onOpenLiveFloor}
     onOverlay={setCalibrationOverlay} onTap={bindCalibrationTap}/>}
    {!operatorMode&&!calibrationOpen&&!phonePanelOpen&&inspectorOpen&&<FootprintsFlowInspector
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
  {!operatorMode&&<FootprintsStageTransport cameraOn={cameraOn} cameraBusy={cameraBusy}
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
