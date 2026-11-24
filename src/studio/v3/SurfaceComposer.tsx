import {useEffect,useRef,useState} from 'react';
import {Maximize2,Minimize2} from 'lucide-react';
import {FootMotionAudioPanel} from './FootMotionAudioPanel.tsx';
import type {ChangeEvent,PointerEvent,RefObject,KeyboardEvent} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import type {Projection} from '../../projection/useProjection.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {LiveFloorTrackingEngine} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import {cameraBinding,cameraBindingKey} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import {buildLowerBodyMask,LOWER_BODY_MASK_DEFAULTS} from '../../footprints/stage-optics/LowerBodyMaskEngine.ts';
import {DualSurfaceRoutingPanel,type StageRouteInput} from '../../footprints/stage-optics/DualSurfaceRoutingPanel.tsx';
import {getDualSurfaceState,hasActiveDualSurfacePorts,syncDualSurfaceRuntime} from '../../footprints/stage-optics/DualSurfaceSessionStore.ts';
import {SOFTWARE_PREVIEW_BLACKOUT_EVENT} from './stagePreviewCommands.ts';
import './SurfaceComposer.css';
import {canRenderComposeSurface} from './composePreviewGate.ts';
import {ComposerEventTimeline,type TimelineMode} from './ComposerEventTimeline.tsx';
import {collectTimelineEvents,emptyTimelineCapture,timelineAt,timelineStep,timelineFootprintVisibility,type TimelineCapture} from './composerEventTimelineModel.ts';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import './ux-r3-compose.css';
import {useCompositionHistory} from './useCompositionHistory.ts';
import {V5_COMPOSER_KEY,stripRetiredVisualLayers,resetOldVisualStorage} from './resetVisualMigration.ts';
import {MappingStudioFootprintControls} from './MappingStudioFootprintControls.tsx';
import {LegPreviewInspector,LEG_PREVIEW_TUNING_DEFAULT,validateLegPreviewTuning,type LegPreviewTuning} from './LegPreviewInspector.tsx';
import {composeExperimentStatus,type ComposeExperimentSource} from './composeExperimentRaster.ts';
import {composerLayerOrder,composerSourceKind,COMPOSE_SOURCE_CHOICES,COMPOSE_STAGE_FLOOR,COMPOSE_STAGE_INPUT,COMPOSE_STAGE_BODY} from './composeLayerPlan.ts';
import type {FootprintConfig} from '../../footprints/StudioFootprints.tsx';
import {sharedAssetChoices,SHARED_TRACK_MP4_ID,type SharedAsset} from './sharedAssetModel.ts';
import {normalizedCanvasPoint,pickTopmostObject,nudgeLayer} from './composerObjectSelection.ts';
import {composerLiquidTrackEvents,composerLiquidDemoEvents,COMPOSER_LIQUID_PHASES,
 type ComposerLiquidPhase,type ComposerLiquidMode} from './composerLiquidAdapter.ts';
import type {PixiLiquidImprintCompositor} from '../../footprints/materials/PixiLiquidImprintCompositor.ts';
import {paintAuthenticFootprint} from '../../footprints/scenes/authenticFootGeometry.ts';
import {
 COMPOSE_STEER_MACROS,COMPOSE_VISUAL_STYLES,DEFAULT_COMPOSE_STEERING,
 deriveComposeProvenance,footprintSpriteDimensions,getComposeVisualStyle,
 sanitizeSteeringState,type ComposeSteeringState,type ComposeVisualStyleId
} from '../../footprints/materials/composeVisualStyles.ts';
import {
 COMPOSE_VIEW_TABS,LOWER_BODY_SIM_ACTIONS,
 buildSimulatedLowerBodyFrame,defaultLowerBodyState,extractLiveLowerBodyPose,
 loadSavedLowerBodyPresets,saveCustomLowerBodyPreset,
 type ComposeMonitorView,type LowerBodyComposerState,type LowerBodySimAction,type SavedLowerBodyPreset
} from './composeLowerBodyModel.ts';
import {renderLowerBodyStageMonitor} from './composeLowerBodyRenderer.ts';
import {composeInspectorVisible} from './composeLowerBodyModel.ts';
import {paintComposeSkeletonMonitor,type ComposeSkeletonBackdrop} from './composeSkeletonMonitor.ts';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import {LowerBodyQuickInspector} from './LowerBodyQuickInspector.tsx';
import {FootLineTrailEngine} from '../../footprints/lines/FootLineTrailEngine.ts';
import {FootprintBrushEngine} from '../../footprints/lines/FootprintBrushEngine.ts';
import {footSamplesFromExperiment,footSamplesFromLive} from '../../footprints/lines/FootLineSampleAdapter.ts';
import {ComposeFloorPosePreview,useComposeFloorPoseFallback} from './ComposeFloorPosePreview.ts';
import {DEFAULT_FULLSCREEN_DIAGNOSTICS,type FullscreenDiagnostics}
 from '../../footprints/lines/FullscreenInputDiagnostics.ts';
import {DEFAULT_LINE_TRAILS_OPTIONS,type LineTrailsOptions} from '../../footprints/lines/LineTrailCanvasRenderer.ts';
import {LineTrailsBetaStage,LineTrailsBetaPanel} from './LineTrailsBeta.tsx';
import {LineTrailsV3Stage,LineTrailsV3Panel} from './LineTrailsV3.tsx';
import type {VideoFloorProfile} from './VideoSpatialCalibration.tsx';
import {DualFootTrajectoryEngine} from '../../footprints/lines/v3/DualFootTrajectoryEngine.ts';
import {PainterlyImpressionEngine} from '../../footprints/lines/v3/PainterlyImpressionEngine.ts';
import {DEFAULT_PAINTERLY_SETTINGS,type PainterlySettings} from '../../footprints/lines/v3/PainterlyCanvasRenderer.ts';
import {DEFAULT_V3_SETTINGS,type V3Settings} from '../../footprints/lines/v3/TrajectoryRenderer.ts';
import './line-trails-beta.css';

type Surface='FLOOR'|'BODY A'|'BODY B';
type Mask='silhouette'|'polygon'|'none';
type Layer={id:string;name:string;mediaId:string;visible:boolean;opacity:number;scale:number;x:number;y:number;rotation:number;blend:GlobalCompositeOperation;mask:Mask;feather:number;points:[number,number][]};
type Composition=Record<Surface,Layer[]>;
type Snapshot={version:1;composition:Composition;selected:Surface;footprint?:FootprintConfig};
const surfaces:Surface[]=['FLOOR','BODY A','BODY B'];
const key=V5_COMPOSER_KEY;
const makeLayer=(mediaId='',name='Layer'):Layer=>({id:crypto.randomUUID(),name,mediaId,visible:true,opacity:100,scale:100,x:0,y:0,rotation:0,blend:'source-over',mask:'none',feather:0,points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]]});
const initial=():Composition=>({FLOOR:[makeLayer('', 'Floor path')],'BODY A':[makeLayer('', 'Body A archive')],'BODY B':[makeLayer('', 'Body B archive')]});
const validFootprint=(v:unknown):v is FootprintConfig=>{
 if(!v||typeof v!=='object')return false;
 const x=v as Partial<FootprintConfig>;
 return (['Tapak','Campuran','Garis','Titik'] as unknown[]).includes(x.style)
  &&typeof x.size==='number'&&Number.isFinite(x.size)&&x.size>=12&&x.size<=90
  &&typeof x.life==='number'&&Number.isFinite(x.life)&&x.life>=1&&x.life<=60
  &&typeof x.delay==='number'&&Number.isFinite(x.delay)&&x.delay>=0&&x.delay<=2
  &&typeof x.showLive==='boolean'&&typeof x.showTrail==='boolean'
  &&typeof x.hold==='boolean'&&typeof x.gaitAnalysis==='boolean'
  &&typeof x.palette==='number'&&Number.isInteger(x.palette)&&x.palette>=0&&x.palette<100
  &&!!x.colors&&(['background','left','right'] as const).every(k=>/^#[0-9a-f]{6}$/i.test(x.colors?.[k]??''));
};
const valid=(v:unknown):v is Snapshot=>{
 if(!v||typeof v!=='object')return false;const x=v as Snapshot;
 return x.version===1&&surfaces.includes(x.selected)
  &&(x.footprint===undefined||validFootprint(x.footprint))
  &&surfaces.every(s=>Array.isArray(x.composition?.[s])&&x.composition[s].length<=24
   &&x.composition[s].every(l=>l&&typeof l.id==='string'&&typeof l.name==='string'
   &&typeof l.mediaId==='string'&&typeof l.opacity==='number'&&typeof l.scale==='number'
   &&Array.isArray(l.points)));
};
type Props={
 footprint?:FootprintConfig;
 sharedAssets:readonly SharedAsset[];
 onImportAssets:(files:File[])=>readonly SharedAsset[];
 onRemoveAsset:(id:string)=>boolean;
 assetNotice:string;
 updateFootprint?:(patch:Partial<FootprintConfig>)=>void;
 bodyCanvas:RefObject<HTMLCanvasElement|null>;floorCanvas:RefObject<HTMLCanvasElement|null>;
 /** Shared output rasters survive the Compose / Map -> Perform transition. */
 outputBodyRaster?:RefObject<HTMLCanvasElement|null>;
 outputFloorRaster?:RefObject<HTMLCanvasElement|null>;
 experimentSource?:ComposeExperimentSource;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 videoFloorProfile?:VideoFloorProfile|null;
 experimentFloorCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentReady?:boolean;
 /** Software-only composited FLOOR overlay in the shared three-monitor shell. */
 composePreviewCanvas?:RefObject<HTMLCanvasElement|null>;
 previewResumeRevision?:number;previewBlackout?:boolean;
 frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 router:MultiPoseGaitRouter;floorTracker:LiveFloorTrackingEngine;projection:Projection;
 cameraOn:boolean;bodySelected:boolean;performerCount:1|2;floorReady:boolean;
 floorEvents:()=>{id:string;kind:string;performerId:string;timestampMs:number}[];
 motionEvents?:()=>readonly FootMotionEventV2[];
 motionSession?:()=>string;
 audioWorkspaceActive?:boolean;audioSourceReady?:boolean;onTakeAudio?:()=>boolean;
 lineSource?:'camera'|'phone';
 identitySafe:boolean;previewIdentitySafe?:boolean;previewIdentityReason?:string;onResetPreviewIdentity?:()=>void;onClose:()=>void;initialOutputQA?:boolean;experimentLocked?:boolean;
 embedded?:boolean;mapMode?:boolean;workspaceHidden?:boolean;
 onOpenMapTrack?:()=>void;
 onOpenMapWorkspace?:()=>void;
 onOpenMapCompose?:()=>void;
 onComposeRasterChange?:(ready:boolean)=>void;
 onMapOutputSaved?:(surface:'floor'|'body')=>void;
 onMapOutputInvalidated?:(surface?:'floor'|'body')=>void;
 mapOutputSaved?:{floor:boolean;body:boolean};
};
export function SurfaceComposer({footprint,updateFootprint,sharedAssets,onImportAssets,onRemoveAsset,assetNotice,frameRef,videoRef,router,floorTracker,projection,floorCanvas,cameraOn,bodySelected,bodyCanvas,outputBodyRaster,outputFloorRaster,experimentSource=null,experimentInputCanvas,experimentFrameRef,videoFloorProfile=null,experimentFloorCanvas,experimentReady=false,performerCount,floorReady,floorEvents,identitySafe,previewIdentitySafe=identitySafe,previewIdentityReason,onResetPreviewIdentity,onClose,experimentLocked=false,embedded=false,mapMode=false,workspaceHidden=false,composePreviewCanvas,motionEvents,motionSession,audioWorkspaceActive=false,audioSourceReady=false,onTakeAudio,lineSource='camera',previewResumeRevision=0,previewBlackout=false,onOpenMapTrack,onOpenMapWorkspace,onOpenMapCompose,onComposeRasterChange,onMapOutputSaved,onMapOutputInvalidated,mapOutputSaved={floor:false,body:false}}:Props){
 const rasterReadyCallback=useRef(onComposeRasterChange);rasterReadyCallback.current=onComposeRasterChange;
 const lastRasterReady=useRef<boolean|null>(null);
 const experimentSourceRef=useRef(experimentSource);experimentSourceRef.current=experimentSource;
 const experimentReadyRef=useRef(experimentReady);experimentReadyRef.current=experimentReady;
 const workspaceHiddenRef=useRef(workspaceHidden);workspaceHiddenRef.current=workspaceHidden;
 const mapModeRef=useRef(mapMode);mapModeRef.current=mapMode;
 const [selected,setSelected]=useState<Surface>('FLOOR');
 const [monitorView,setMonitorView]=useState<ComposeMonitorView>('FLOOR');
 const [lineTrails,setLineTrails]=useState(false);
 const lineTrailsRef=useRef(lineTrails);lineTrailsRef.current=lineTrails;
 const [lineOptions,setLineOptions]=useState<LineTrailsOptions>(DEFAULT_LINE_TRAILS_OPTIONS);
 const [lineVersion,setLineVersion]=useState<'v2'|'v3'>('v3');
 const [v3Options,setV3Options]=useState<V3Settings>(DEFAULT_V3_SETTINGS);
 const [painterlyOptions,setPainterlyOptions]=useState<PainterlySettings>(DEFAULT_PAINTERLY_SETTINGS);
 const [brushResetRevision,setBrushResetRevision]=useState(0);
 const [v3Diagnostics,setV3Diagnostics]=useState('Menunggu observasi pertama');
 const [lineDemo,setLineDemo]=useState(false);
 const [lineFullscreenDiagnostics,setLineFullscreenDiagnostics]=useState<FullscreenDiagnostics>(DEFAULT_FULLSCREEN_DIAGNOSTICS);
 const [lineActor,setLineActor]=useState<'A'|'B'>('A');
 const [lineStatus,setLineStatus]=useState('Menunggu kaki');
 const videoFrame=experimentFrameRef?.current;
 const videoFloorReady=experimentSource==='video'&&videoFrame?.kind==='video'&&
  videoFloorProfile!==null&&videoFloorProfile.clip===videoFrame.clip&&
  videoFloorProfile.width===videoFrame.video?.videoWidth&&
  videoFloorProfile.height===videoFrame.video?.videoHeight;
 const activeVideoFloor=videoFloorReady&&videoFloorProfile?videoFloorProfile.calibration:null;
 const [,setLineBrushCount]=useState(0);
 const floorPosePreview=useRef(new ComposeFloorPosePreview());
 const [floorPosePreviewActive,setFloorPosePreviewActive]=useState(false);
 const floorPosePreviewActiveRef=useRef(false);
 const lineEngine=useRef(new FootLineTrailEngine());
 const lineV3Engine=useRef(new DualFootTrajectoryEngine());
 const painterlyEngine=useRef(new PainterlyImpressionEngine());
 const inkExportRef=useRef<()=>string|null>(()=>null);
 const motionTraceRef=useRef<()=>string|null>(()=>null);
 const inkArchiveRef=useRef<{save:()=>string|null;load:(data:string)=>Promise<void>}>({save:()=>null,load:async()=>{}});
 const brushEngine=useRef(new FootprintBrushEngine());
 const lineFullscreenRef=useRef<HTMLDivElement|null>(null);
 const monitorFullscreenRef=useRef<HTMLElement|null>(null);
 const [monitorFullscreen,setMonitorFullscreen]=useState(false);
 const [fullscreenNotice,setFullscreenNotice]=useState('');
 useEffect(()=>{
  const sync=()=>setMonitorFullscreen(document.fullscreenElement===monitorFullscreenRef.current||document.fullscreenElement===lineFullscreenRef.current);
  document.addEventListener('fullscreenchange',sync);
  return()=>document.removeEventListener('fullscreenchange',sync);
 },[]);
 // Local Beta fullscreen has no on-screen controls; Esc must always return to Compose.
 useEffect(()=>{
  const onKey=(event:globalThis.KeyboardEvent)=>{
   if(document.fullscreenElement!==lineFullscreenRef.current)return;
   if(event.key==='Escape'){
    void document.exitFullscreen().catch(()=>{});
    return;
   }
   if(event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;
   if(event.key.toLowerCase()==='v'){
    event.preventDefault();
    setLineFullscreenDiagnostics(p=>({...p,camera:!p.camera}));
   }else if(event.key.toLowerCase()==='k'){
    event.preventDefault();
    setLineFullscreenDiagnostics(p=>({...p,skeleton:!p.skeleton}));
   }
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[]);
 const toggleMonitorFullscreen=()=>{
  const monitor=lineTrails?lineFullscreenRef.current:monitorFullscreenRef.current;
  if(!monitor)return;
  setFullscreenNotice('');
  const promise=document.fullscreenElement===monitor
   ?document.exitFullscreen()
   :monitor.requestFullscreen?.();
  if(!promise){
   setFullscreenNotice('Fullscreen tidak didukung pada browser ini.');
   return;
  }
  void promise.catch(()=>setFullscreenNotice('Fullscreen diblokir browser. Periksa izin tampilan layar.'));
 };
 const monitorViewRef=useRef(monitorView);monitorViewRef.current=monitorView;
 const [lowerBody,setLowerBody]=useState<LowerBodyComposerState>(()=>defaultLowerBodyState());
 const lowerBodyRef=useRef(lowerBody);lowerBodyRef.current=lowerBody;
 const [savedLowerBodyPresets,setSavedLowerBodyPresets]=useState<SavedLowerBodyPreset[]>(()=>
  loadSavedLowerBodyPresets(typeof localStorage!=='undefined'?localStorage:undefined)
 );
 const [simAction,setSimAction]=useState<LowerBodySimAction>('idle');
 const simActionRef=useRef(simAction);simActionRef.current=simAction;
 const [previewArrangement,setPreviewArrangement]=useState<'surface'|'split'|'input'>('surface');
 useEffect(()=>{setPreviewArrangement('surface');},[experimentSource]);
 const previewArrangementRef=useRef(previewArrangement);previewArrangementRef.current=previewArrangement;
 // A black SKELETON monitor never activates the physical blackout/output.
 const [skeletonBackdrop,setSkeletonBackdrop]=useState<ComposeSkeletonBackdrop>('black');
 const skeletonBackdropRef=useRef(skeletonBackdrop);skeletonBackdropRef.current=skeletonBackdrop;
 const [skeletonInputId,setSkeletonInputId]=useState('track');
 const skeletonInputIdRef=useRef(skeletonInputId);skeletonInputIdRef.current=skeletonInputId;
 useEffect(()=>{setSkeletonBackdrop('black');setSkeletonInputId('track');},[experimentSource]);
 const selectMonitorView=(view:ComposeMonitorView)=>{
  if(view!=='FLOOR')setLineTrails(false);
  setMonitorView(view);
  if(view==='FLOOR'){
   setSelected('FLOOR');setSelectedLayer(0);setInspectorTab('scene');setPreviewArrangement('surface');
  }else if(view==='LEG A'){
   setSelected('BODY A');setSelectedLayer(0);setInspectorTab('scene');setPreviewArrangement('surface');
  }else if(view==='LEG B'){
   setSelected('BODY B');setSelectedLayer(0);setInspectorTab('scene');setPreviewArrangement('surface');
  }else if(view==='SPLIT'){
   setSelected('BODY A');setSelectedLayer(0);setInspectorTab('scene');setPreviewArrangement('split');
  }else{
   setSelected('BODY A');setSelectedLayer(0);setInspectorTab('scene');setPreviewArrangement('surface');
  }
 };
 const splitScratch=useRef<{body:HTMLCanvasElement;floor:HTMLCanvasElement}|null>(null);
 const history=useCompositionHistory<Composition>(()=>{
  try{
   const current=JSON.parse(localStorage.getItem(key)||'null');
   const legacy=JSON.parse(localStorage.getItem('soma-s64-composer-v1')||'null');
   const snapshot=valid(current)?current:valid(legacy)?legacy:null;
   if(!snapshot)return initial();
   const cleaned=stripRetiredVisualLayers(snapshot.composition) as Composition;
   for(const surface of surfaces)if(!cleaned[surface]?.length)
    cleaned[surface]=initial()[surface];
   return cleaned;
  }catch{return initial();}
 });
 const composition=history.value,setComposition=history.set;
 useEffect(()=>{try{resetOldVisualStorage(localStorage);}catch{}},[]);
 const [inspectorTab,setInspectorTab]=useState<'scene'|'layer'|'object'>('scene');
 // CP-25: compact editing defaults to Quick. Advanced retains the full existing inspector.
 const [composeUiMode,setComposeUiMode]=useState<'quick'|'advanced'>('quick');
 const [dragLayer,setDragLayer]=useState<number|null>(null);
 const [dropLayer,setDropLayer]=useState<number|null>(null);
 const [resetArmed,setResetArmed]=useState(false);
 const [saveStatus,setSaveStatus]=useState('Tersimpan lokal');
 const [loadingMedia,setLoadingMedia]=useState(0);
 const media=sharedAssets;
 const [selectedLayer,setSelectedLayer]=useState(0);
 const [editMask,setEditMask]=useState(false);
 const [outputOpen,setOutputOpen]=useState(false);
 const [bodyStatus,setBodyStatus]=useState('Menunggu frame tubuh.');
 const [hint,setHint]=useState('');
 // Software preview starts enabled in Compose. Physical output still requires the existing routing/QA panel.
 const [blackout,setBlackout]=useState(previewBlackout);
 const [previewLive,setPreviewLive]=useState(true);
 // Liquid Imprint defaults to Track events so real/simulated steps drive the floor;
 // Demo mode stays one click away for single-phase inspection.
 const [liquidEnabled,setLiquidEnabled]=useState(true);
 const [liquidMode,setLiquidMode]=useState<ComposerLiquidMode>('track');
 const [liquidPhase,setLiquidPhase]=useState<ComposerLiquidPhase>('contact');
 const [steering,setSteering]=useState<ComposeSteeringState>(DEFAULT_COMPOSE_STEERING);
 const [liquidStatus,setLiquidStatus]=useState('Renderer visual memuat…');
 const liquidCanvas=useRef<HTMLCanvasElement>(null);
 const liquidRenderer=useRef<PixiLiquidImprintCompositor|null>(null);
 const liquidEnabledRef=useRef(liquidEnabled);liquidEnabledRef.current=liquidEnabled&&!lineTrails;
 const liquidModeRef=useRef(liquidMode);liquidModeRef.current=liquidMode;
 const liquidPhaseRef=useRef(liquidPhase);liquidPhaseRef.current=liquidPhase;
 const steeringRef=useRef(steering);steeringRef.current=steering;
 const footprintRef=useRef(footprint);footprintRef.current=footprint;
 const liquidDemoStart=useRef(0);
 const liquidPaintErrorRef=useRef('');
 const updateSteering=(patch:Partial<ComposeSteeringState>)=>
  setSteering(prev=>sanitizeSteeringState({...prev,...patch}));
 const selectVisualStyle=(styleId:ComposeVisualStyleId)=>{
  const meta=getComposeVisualStyle(styleId);
  setSteering(prev=>sanitizeSteeringState({...prev,styleId,...meta.defaults}));
 };
 useEffect(()=>{liquidDemoStart.current=performance.now();},[liquidMode,liquidPhase]);
 useEffect(()=>{
  if(!liquidEnabled)return;
  const surface=liquidCanvas.current;
  if(!surface)return;
  let canceled=false;
  // React StrictMode replays mount effects. Defer creation one browser frame
  // so the canceled first mount cannot initialize/destroy the shared canvas.
  const start=requestAnimationFrame(()=>{
   if(canceled)return;
   void import('../../footprints/materials/PixiLiquidImprintCompositor.ts')
    .then(({PixiLiquidImprintCompositor})=>{
     if(canceled)return null;
     return PixiLiquidImprintCompositor.create(surface);
    })
    .then(renderer=>{
     if(!renderer)return;
     if(canceled){renderer.destroy();return;}
     liquidRenderer.current=renderer;
     setLiquidStatus('Liquid Imprint · PixiJS v8 siap');
    })
    .catch(err=>{if(!canceled)setLiquidStatus('Liquid Imprint gagal: '+String(err));});
  });
  return()=>{
   canceled=true;cancelAnimationFrame(start);
   const active=liquidRenderer.current;
   liquidRenderer.current=null;
   active?.destroy();
  };
 },[mapMode,liquidEnabled]);
 useEffect(()=>{
  const onGlobalBlackout=()=>setBlackout(true);
  window.addEventListener(SOFTWARE_PREVIEW_BLACKOUT_EVENT,onGlobalBlackout);
  return()=>window.removeEventListener(SOFTWARE_PREVIEW_BLACKOUT_EVENT,onGlobalBlackout);
 },[]);
 useEffect(()=>{if(previewBlackout)setBlackout(true);},[previewBlackout]);
 useEffect(()=>{if(previewResumeRevision>0&&!previewBlackout){setBlackout(false);setPreviewLive(true);}},[previewResumeRevision,previewBlackout]);
 const activeMotionSession=useRef<string|null>(null);
 const surfaceBuffers=useRef(new Map<string,HTMLCanvasElement>());
 const previewLayerAlpha=useRef(new Map<string,number>());
 const ownBodyOutput=useRef<HTMLCanvasElement>(null);
 const ownFloorOutput=useRef<HTMLCanvasElement>(null);
 const bodyOutput=outputBodyRaster??ownBodyOutput;
 const floorOutput=outputFloorRaster??ownFloorOutput;
 const lineOutputRaster=useRef<HTMLCanvasElement|null>(null);
 useEffect(()=>{lineOutputRaster.current=document.createElement('canvas');return()=>{lineOutputRaster.current=null;};},[]);
 const stageRoute=useRef<StageRouteInput|null>(null);
 const maskCache=useRef<{at:number;A:HTMLCanvasElement|null;B:HTMLCanvasElement|null;safe:boolean;reason:string;union:ReturnType<typeof buildLowerBodyMask>['mask']|null}>({at:-1,A:null,B:null,safe:false,reason:'Tracking belum siap.',union:null});
 const maskScratch=useRef<{A:HTMLCanvasElement;B:HTMLCanvasElement}|null>(null);
 const [legTuning,setLegTuning]=useState<LegPreviewTuning>(LEG_PREVIEW_TUNING_DEFAULT);
 const legTuningRef=useRef(legTuning);legTuningRef.current=legTuning;
 const previewMaskCache=useRef<{
  at:number;A:HTMLCanvasElement|null;B:HTMLCanvasElement|null;safe:boolean
 }>({at:-1,A:null,B:null,safe:false});
 const previewMaskScratch=useRef<{A:HTMLCanvasElement;B:HTMLCanvasElement}|null>(null);
 const updateLegTuning=(patch:Partial<LegPreviewTuning>)=>{
  setLegTuning(prev=>validateLegPreviewTuning({...prev,...patch}));
  previewMaskCache.current.at=-1;
 };
 const outputReadyRef=useRef({body:false,floor:false});
 
 const motionEventsRef=useRef(motionEvents);motionEventsRef.current=motionEvents;
 const [timelineCapture,setTimelineCapture]=useState<TimelineCapture>(()=>emptyTimelineCapture());
 const timelineCaptureRef=useRef(timelineCapture);timelineCaptureRef.current=timelineCapture;
 const [timelineMode,setTimelineMode]=useState<TimelineMode>('live');
 const timelineModeRef=useRef(timelineMode);timelineModeRef.current=timelineMode;
 const [timelinePlaying,setTimelinePlaying]=useState(false);
 const [timelinePosition,setTimelinePosition]=useState(0);
 const [timelineSpeed,setTimelineSpeed]=useState(1);
 const timelinePositionRef=useRef(timelinePosition);timelinePositionRef.current=timelinePosition;
 const playbackRef=useRef({playing:timelinePlaying,speed:timelineSpeed});
 playbackRef.current={playing:timelinePlaying,speed:timelineSpeed};
 useEffect(()=>{
  if(timelineMode!=='replay'||!timelinePlaying)return;
  let last=performance.now();
  const timer=window.setInterval(()=>{
   const now=performance.now(),elapsed=Math.min(250,now-last);last=now;
   const result=timelineStep(timelinePositionRef.current,elapsed,
    Math.max(1000,timelineCaptureRef.current.events.at(-1)?.atMs??0),playbackRef.current.speed);
   timelinePositionRef.current=result.positionMs;
   setTimelinePosition(result.positionMs);
   if(!result.playing)setTimelinePlaying(false);
  },50);
  return()=>window.clearInterval(timer);
 },[timelineMode,timelinePlaying]);
 const motionSessionRef=useRef(motionSession);motionSessionRef.current=motionSession;
 
 const canvas=useRef<HTMLCanvasElement>(null);
 const frameRefLive=useRef(frameRef);frameRefLive.current=frameRef;
 const videoRefLive=useRef(videoRef);videoRefLive.current=videoRef;
 const routerRef=useRef(router);routerRef.current=router;
 const floorRef=useRef(floorTracker);floorRef.current=floorTracker;
 const cameraOnRef=useRef(cameraOn);cameraOnRef.current=cameraOn;
 const lineSourceRef=useRef(lineSource);lineSourceRef.current=lineSource;
 const bodySelectedRef=useRef(bodySelected);bodySelectedRef.current=bodySelected;
 const performerRef=useRef(performerCount);performerRef.current=performerCount;
 const floorReadyRef=useRef(floorReady);floorReadyRef.current=floorReady;
 const identitySafeRef=useRef(identitySafe);identitySafeRef.current=identitySafe;
 const blackoutRef=useRef(blackout);blackoutRef.current=blackout;
 const previewLiveRef=useRef(previewLive);previewLiveRef.current=previewLive;
 
 const mediaEls=useRef(new Map<string,HTMLImageElement|HTMLVideoElement>());
 const popup=useRef<Window|null>(null);
 const selectedRef=useRef(selected),compositionRef=useRef(composition);
 selectedRef.current=selected;compositionRef.current=composition;
 const layers=composition[selected],layer=layers[selectedLayer]||layers[0];
 const patch=(p:Partial<Layer>)=>setComposition(c=>({...c,[selected]:c[selected].map((l,i)=>i===selectedLayer?{...l,...p}:l)}));
 useEffect(()=>{
  try{
   localStorage.setItem(key,JSON.stringify({version:1,selected,composition}));
   setSaveStatus('Tersimpan lokal');
  }catch{setSaveStatus('Penyimpanan gagal');}
 },[composition,selected]);
 const performUndo=()=>{if(history.undo()){setResetArmed(false);setSaveStatus('Perubahan dibatalkan');}};
 const performRedo=()=>{if(history.redo()){setResetArmed(false);setSaveStatus('Perubahan dikembalikan');}};
 const resetComposition=()=>{
  if(!resetArmed){setResetArmed(true);return;}
  setComposition(initial());setSelected('FLOOR');setSelectedLayer(0);
  setEditMask(false);setResetArmed(false);setInspectorTab('scene');
  setHint('Komposisi direset. Gunakan Undo untuk mengembalikan layer sebelumnya.');
 };
 const onComposerKeys=(event:KeyboardEvent<HTMLDivElement>)=>{
  const target=event.target as HTMLElement;
  const editing=!!target.closest('input,textarea,select,[contenteditable="true"]');
  const buttonFocused=!!target.closest('button,summary');
  if(event.key==='Escape'&&resetArmed){setResetArmed(false);event.stopPropagation();return;}
  if(editing||event.altKey)return;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){
   event.preventDefault();
   if(event.shiftKey)performRedo();else performUndo();
  }else if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='y'){
   event.preventDefault();performRedo();
  }else if(inspectorTab==='object'&&previewArrangement==='surface'&&!buttonFocused&&
   ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&layer){
   const next=nudgeLayer(layer,event.key,event.shiftKey);
   if(next){event.preventDefault();patch(next);}
  }else if((event.key==='Delete'||event.key==='Backspace')&&!buttonFocused&&layers.length>1){
   event.preventDefault();
   setComposition(state=>({...state,[selected]:state[selected].filter((_,i)=>i!==selectedLayer)}));
   setSelectedLayer(i=>Math.max(0,i-1));
  }
 };
 const onInspectorPointerDown=(event:PointerEvent<HTMLElement>)=>{
  if((event.target as HTMLElement).closest('input[type="range"]'))history.beginGroup();
 };
 const onInspectorPointerEnd=()=>history.endGroup();
 const onInspectorKeyDown=(event:KeyboardEvent<HTMLElement>)=>{
  if((event.target as HTMLElement).closest('input[type="range"]')&&
   ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))
   history.beginGroup();
 };
 const onInspectorKeyUp=()=>history.endGroup();
 useEffect(()=>{return()=>{for(const item of mediaEls.current.values()){
  if(item instanceof HTMLVideoElement){item.pause();item.removeAttribute('src');item.load();}
 }mediaEls.current.clear();};},[]);
 useEffect(()=>{
  const imported=new Set(media.filter(item=>item.origin==='import').map(item=>item.id));
  for(const [id,item] of mediaEls.current){
   if(imported.has(id))continue;
   if(item instanceof HTMLVideoElement){item.pause();item.removeAttribute('src');item.load();}
   mediaEls.current.delete(id);
  }
  for(const m of media){
   // A Track MP4 lives in Track's decoder and input canvas. Never create another player.
   if(m.origin==='track'||!m.url||mediaEls.current.has(m.id))continue;
   setLoadingMedia(n=>n+1);
   const done=()=>setLoadingMedia(n=>Math.max(0,n-1));
   if(m.kind==='image'){
    const img=new Image();
    img.onload=done;img.onerror=()=>{done();setHint('Gagal membaca '+m.name);};
    mediaEls.current.set(m.id,img);img.src=m.url;
   }else{
    const video=document.createElement('video');
    video.onloadeddata=done;video.onerror=()=>{done();setHint('Gagal membaca '+m.name);};
    video.src=m.url;video.loop=true;video.muted=true;video.playsInline=true;
    mediaEls.current.set(m.id,video);
    void video.play().catch(()=>{});
   }
  }
 },[media]);
 const upload=(e:ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(e.target.files||[]);
  onImportAssets(files);e.target.value='';
 };
 const maskImage=(data:Uint8Array,width:number,height:number,canvas:HTMLCanvasElement)=>{
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const img=ctx.createImageData(width,height);
  for(let i=0;i<data.length;i++){const k=i*4;img.data[k]=255;img.data[k+1]=255;img.data[k+2]=255;img.data[k+3]=data[i];}
  ctx.putImageData(img,0,0);
 };
 const updateMasks=(now:number)=>{
  const frame=frameRefLive.current.current,ids=routerRef.current.status,count=performerRef.current;
  const validClock=frame?.source==='camera'&&frame.tracked&&frame.time>0&&now-frame.time>=0&&now-frame.time<350;
  const key=cameraBindingKey(cameraBinding(videoRefLive.current.current));
  const bindingSafe=!!key&&key===floorRef.current.boundCamera;
  const idsSafe=count===1||(!ids.ambiguous&&ids.mode===2&&ids.visible.includes('A')&&ids.visible.includes('B')&&ids.observedFrameTime===frame.time&&ids.poseIndices.A!==null&&ids.poseIndices.B!==null&&ids.poseIndices.A!==ids.poseIndices.B);
  const safe=!!(cameraOnRef.current&&bodySelectedRef.current&&floorReadyRef.current&&bindingSafe&&validClock&&identitySafeRef.current&&idsSafe);
  if(!safe){
   previewMaskCache.current={at:-1,A:null,B:null,safe:false};
   maskCache.current={at:-1,A:null,B:null,safe:false,reason:!cameraOnRef.current?'Kamera mati':!floorReadyRef.current||!bindingSafe?'Kalibrasi kamera/lantai belum cocok':!validClock?'Frame kedaluwarsa':'Identitas A/B ambigu',union:null};
   return;
  }
  // Identical source frame: reuse safe per-pose masks while preserving identity routing.
  if(maskCache.current.at===frame.time&&maskCache.current.safe)return;
  const result=buildLowerBodyMask(frame,{...LOWER_BODY_MASK_DEFAULTS,performers:count,requireSegmentation:true},now,'camera');
  if(result.status!=='ready'){
   previewMaskCache.current={at:-1,A:null,B:null,safe:false};
   maskCache.current={at:-1,A:null,B:null,safe:false,reason:result.reason,union:null};
   return;
  }
  if(!maskScratch.current)maskScratch.current={A:document.createElement('canvas'),B:document.createElement('canvas')};
  const indexA=count===1?0:ids.poseIndices.A;
  const indexB=count===2?ids.poseIndices.B:null;
  const a=indexA===null?null:result.perPoseMasks[indexA];
  const b=indexB===null?null:result.perPoseMasks[indexB];
  if(!a||(count===2&&!b)){
   maskCache.current={at:-1,A:null,B:null,safe:false,reason:'Mask A/B belum terpisah.',union:null};return;
  }
  maskImage(a.data,a.width,a.height,maskScratch.current.A);
  if(b)maskImage(b.data,b.width,b.height,maskScratch.current.B);
  maskCache.current={at:frame.time,A:maskScratch.current.A,B:b?maskScratch.current.B:null,safe:true,reason:'Mask performer terpisah dan identitas cocok.',union:result.mask};
  // The editable LEG mask is a SECOND preview-only raster. Physical output retains
  // its original strictly gated segmentation mask, independent of operator tuning.
  const tuning=legTuningRef.current;
  const previewResult=buildLowerBodyMask(frame,{
   ...LOWER_BODY_MASK_DEFAULTS,performers:count,requireSegmentation:true,
   torsoExtension:0,thighStartRatio:tuning.thighStartRatio,
   includePelvis:tuning.includePelvis,featherPx:tuning.featherPx,
   minimumVisibility:tuning.minimumVisibility
  },now,'camera');
  if(previewResult.status!=='ready'){
   previewMaskCache.current={at:-1,A:null,B:null,safe:false};return;
  }
  const pa=indexA===null?null:previewResult.perPoseMasks[indexA];
  const pb=indexB===null?null:previewResult.perPoseMasks[indexB];
  if(!pa||(count===2&&!pb)){
   previewMaskCache.current={at:-1,A:null,B:null,safe:false};return;
  }
  if(!previewMaskScratch.current)previewMaskScratch.current={
   A:document.createElement('canvas'),B:document.createElement('canvas')
  };
  maskImage(pa.data,pa.width,pa.height,previewMaskScratch.current.A);
  if(pb)maskImage(pb.data,pb.width,pb.height,previewMaskScratch.current.B);
  previewMaskCache.current={at:frame.time,A:previewMaskScratch.current.A,
   B:pb?previewMaskScratch.current.B:null,safe:true};
 };
 const readyMedia=(s:Surface)=>{
  return compositionRef.current[s].some(l=>{
   if(!l.visible||!l.mediaId)return false;
   const item=mediaEls.current.get(l.mediaId);
   return !!item&&(item instanceof HTMLImageElement?item.complete&&item.naturalWidth>0:item.readyState>=2);
  });
 };
 const render=(ctx:CanvasRenderingContext2D,s:Surface,w:number,h:number,clear=true,physical=false,overlayOnly=false)=>{
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  if(clear){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);}
  if(blackoutRef.current||!previewLiveRef.current)return;
  const body=s!=='FLOOR',experiment=!!experimentSourceRef.current;
  const selectedMask=experiment?previewMaskCache.current:physical?maskCache.current:previewMaskCache.current;
  const currentMask=s==='BODY A'?selectedMask.A:s==='BODY B'?selectedMask.B:null;
  if(!experiment&&!canRenderComposeSurface({surface:s,physical,floorReady:floorReadyRef.current,
   bodyMaskSafe:selectedMask.safe,bodyMaskPresent:!!currentMask}))return;
  const demoFloor=!physical&&!overlayOnly&&s==='FLOOR'&&liquidEnabledRef.current&&liquidModeRef.current==='demo';
  if(demoFloor){
   ctx.save();ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=1;
   for(let i=1;i<8;i++){const x=(w/8)*i;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
   for(let j=1;j<6;j++){const y=(h/6)*j;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
   ctx.restore();
  }
  const now=performance.now();
  for(const {layer,kind} of composerLayerOrder(compositionRef.current[s]||[],s,physical,experiment)){
   if(overlayOnly&&kind!=='media')continue;
   if(demoFloor&&kind==='floor')continue;
   const el=kind==='media'?mediaEls.current.get(layer.mediaId):
    kind==='floor'?(timelineModeRef.current==='replay'&&!physical?null:experiment?experimentFloorCanvas?.current??null:floorCanvas.current):
    kind==='input'?(experiment?experimentInputCanvas?.current??null:null):
    kind==='body'?bodyCanvas.current:null;
   if(!el)continue;
   if(el instanceof HTMLImageElement&&(!el.complete||!el.naturalWidth))continue;
   if(el instanceof HTMLVideoElement&&(el.readyState<2||!el.videoWidth))continue;
   if(el instanceof HTMLCanvasElement&&(!el.width||!el.height))continue;
   const key=s+':'+layer.id;
   let off=surfaceBuffers.current.get(key);
   if(!off){off=document.createElement('canvas');surfaceBuffers.current.set(key,off);}
   if(off.width!==w)off.width=w;if(off.height!==h)off.height=h;
   const g=off.getContext('2d');if(!g)continue;
   g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(0,0,w,h);
   g.save();g.translate(w*(.5+layer.x/100),h*(.5+layer.y/100));
   g.rotate(layer.rotation*Math.PI/180);g.scale(layer.scale/100,layer.scale/100);
   try{g.drawImage(el,-w/2,-h/2,w,h);}catch{g.restore();continue;}
   g.restore();
   const clipNeeded=body||layer.mask==='polygon';
   if(clipNeeded){
    let clip:HTMLCanvasElement|null=null;
    if(layer.mask==='polygon'&&layer.points.length>=3){
     clip=document.createElement('canvas');clip.width=w;clip.height=h;
     const c=clip.getContext('2d');
     if(c){c.fillStyle='#fff';c.beginPath();
      layer.points.forEach(([x,y],i)=>i?c.lineTo(x*w,y*h):c.moveTo(x*w,y*h));
      c.closePath();c.fill();
      if(layer.feather>0){
       const blurred=document.createElement('canvas');blurred.width=w;blurred.height=h;
       const blur=blurred.getContext('2d');
       if(blur){blur.filter='blur('+Math.min(35,Math.max(0,layer.feather))+'px)';blur.drawImage(clip,0,0);clip=blurred;}
      }
     }
    }
    if(clip){g.globalCompositeOperation='destination-in';g.drawImage(clip,0,0,w,h);}
    if(body&&currentMask){g.globalCompositeOperation='destination-in';g.drawImage(currentMask,0,0,w,h);}
    g.globalCompositeOperation='source-over';
   }
   if(!physical&&!overlayOnly&&s===selectedRef.current)previewLayerAlpha.current.set(key,1);
   ctx.save();ctx.globalAlpha=Math.min(1,Math.max(0,layer.opacity/100));
   ctx.globalCompositeOperation=layer.blend;
   ctx.drawImage(off,0,0);
   ctx.restore();
  }
 };
 useEffect(()=>{
  syncDualSurfaceRuntime({
   frameRef:stageRoute,bodyCanvas:bodyOutput,floorCanvas:floorOutput,
   legacyProjection:projection,experimentLocked
  });
 },[projection,experimentLocked,mapMode,workspaceHidden]);
 useEffect(()=>{
  let raf=0,last=0,lastText='';
  const tick=(now:number)=>{
   raf=requestAnimationFrame(tick);
   if(workspaceHiddenRef.current&&!hasActiveDualSurfacePorts())return;
   if(now-last<1000/30)return;
   last=now;updateMasks(now);
   const body=bodyOutput.current,floor=floorOutput.current;
    // The renderer shared by Compose and SOMA Direct follows the Map output resolution.
    const outputPlans=getDualSurfaceState().plans;
    for(const [surface,raster] of [['body',body],['floor',floor]] as const){
     if(!raster)continue;
     const high=outputPlans[surface].resolution==='1080p';
     const width=high?1920:1280,height=high?1080:720;
     if(raster.width!==width)raster.width=width;
     if(raster.height!==height)raster.height=height;
    }
    if(body){const ctx=body.getContext('2d');if(ctx){
    render(ctx,'BODY A',body.width,body.height,true,true);
    if(performerRef.current===2)render(ctx,'BODY B',body.width,body.height,false,true);
   }}
   if(floor){const ctx=floor.getContext('2d');if(ctx){
    render(ctx,'FLOOR',floor.width,floor.height,true,true);
    const line=lineOutputRaster.current;
    if(lineTrailsRef.current&&line&&line.width>0&&line.height>0&&
      previewLiveRef.current&&!blackoutRef.current){
     ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
     ctx.drawImage(line,0,0,floor.width,floor.height);ctx.restore();
    }
   }}
   // Render Liquid Imprint for FLOOR preview and composite verified Track imprints
   // onto floorOutput when live camera floor routing is active.
   let liquidFrame=false;
   const renderLiquid=liquidEnabledRef.current&&!blackoutRef.current&&
    previewLiveRef.current&&liquidRenderer.current&&
    (mapModeRef.current||workspaceHiddenRef.current||selectedRef.current==='FLOOR');
   if(renderLiquid&&liquidRenderer.current){
    const demo=liquidModeRef.current==='demo'&&!mapModeRef.current&&!workspaceHiddenRef.current;
    const artTime=demo?now:timelineModeRef.current==='replay'
     ?timelinePositionRef.current:now;
    const fp=footprintRef.current;
    const lifeMs=Math.min(60000,Math.max(1000,(fp?.life??9)*1000));
    const dims=footprintSpriteDimensions(fp?.size??32);
    const st=steeringRef.current;
    const events=demo?
     composerLiquidDemoEvents(liquidPhaseRef.current,now,liquidDemoStart.current):
     composerLiquidTrackEvents(timelineCaptureRef.current,artTime,
      timelineModeRef.current==='replay'?'replay':'live',lifeMs);
    try{
     liquidRenderer.current.render(events,artTime,{
      styleId:st.styleId,flow:st.flow,turbulence:st.turbulence,
      glow:st.glow,hueShift:st.hueShift,pulseRate:st.pulseRate,
      widthPx:dims.widthPx,lengthPx:dims.lengthPx,lifeMs
     });
     liquidFrame=true;
    }catch(err){
     liquidFrame=false;
     const message='Visual lantai gagal merender: '+String(err);
     if(liquidPaintErrorRef.current!==message){
      liquidPaintErrorRef.current=message;
      setLiquidStatus(message);
     }
    }
   }
   if(floor&&liquidFrame&&liquidCanvas.current&&
     (experimentSourceRef.current?experimentReadyRef.current:floorReadyRef.current)&&liquidModeRef.current==='track'){
    const ctx=floor.getContext('2d');
    if(ctx){
     ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
     ctx.drawImage(liquidCanvas.current,0,0,floor.width,floor.height);
     ctx.restore();
    }
   }
   // CP-03: paint imported composition layers over the live FLOOR monitor.
   // The source scene remains visible underneath transparent pixels.
   const previewOverlay=composePreviewCanvas?.current;
   if(previewOverlay){
    const ctx=previewOverlay.getContext('2d');
    if(ctx){
     ctx.setTransform(1,0,0,1,0,0);
     ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
     ctx.clearRect(0,0,previewOverlay.width,previewOverlay.height);
     if(readyMedia('FLOOR')&&!blackoutRef.current&&previewLiveRef.current)
      render(ctx,'FLOOR',previewOverlay.width,previewOverlay.height,false,false,true);
     if(liquidFrame&&liquidCanvas.current)
      ctx.drawImage(liquidCanvas.current,0,0,previewOverlay.width,previewOverlay.height);
    }
   }
   const preview=canvas.current;
   if(preview){
    preview.dataset.mat03Active=liquidFrame?'drawn':liquidRenderer.current?'gated':'loading';
    preview.dataset.mat03Selected=selectedRef.current;
    preview.dataset.mat03Enabled=String(liquidEnabledRef.current);
    preview.dataset.mat03PreviewLive=String(previewLiveRef.current);
    preview.dataset.mat03Blackout=String(blackoutRef.current);
   }
   if(preview){const ctx=preview.getContext('2d');if(ctx){
    const activeView=monitorViewRef.current;
    if(previewArrangementRef.current==='input'&&experimentSource){
     ctx.setTransform(1,0,0,1,0,0);
     ctx.fillStyle='#000';ctx.fillRect(0,0,preview.width,preview.height);
     const input=experimentInputCanvas?.current;
     if(input&&input.width&&input.height)ctx.drawImage(input,0,0,preview.width,preview.height);
    }else if(activeView==='SKELETON'){
     // This is a measured diagnostic. The old simulated orthographic renderer
     // must never show invented skeletons under this tab.
     const importedId=skeletonInputIdRef.current;
     const external=importedId==='track'?null:mediaEls.current.get(importedId)??null;
     const experiment=experimentFrameRef?.current??null;
     const source:HTMLVideoElement|HTMLImageElement|HTMLCanvasElement|null=
      external??(importedId!=='track'?null:
       experimentSourceRef.current==='video'
        ?(experiment?.kind==='video'&&experiment.ready&&!experiment.video?.seeking
          ?experiment.video:null)
       :experimentSourceRef.current==='simulator'
        ?experimentInputCanvas?.current??null
       :cameraOnRef.current&&bodySelectedRef.current
        ?videoRefLive.current.current:null);
     paintComposeSkeletonMonitor(ctx,preview.width,preview.height,{
      backdrop:skeletonBackdropRef.current,
      input:!blackoutRef.current&&previewLiveRef.current?source:null,
      inputFromTrack:importedId==='track',
      experimentFrame:experimentSourceRef.current?experiment:null,
      liveFrame:frameRefLive.current.current,
      identity:routerRef.current.previewStatus,
      performers:performerRef.current,
      cameraActive:cameraOnRef.current&&bodySelectedRef.current,
      nowMs:now
     });
    }else if(activeView!=='FLOOR'){
     const livePoseA=cameraOnRef.current&&bodySelectedRef.current?extractLiveLowerBodyPose(frameRefLive.current.current?.pose,'A'):null;
     const simPerformers:1|2=activeView==='SPLIT'||activeView==='LEG B'||performerRef.current===2?2:2;
     const simFrame=buildSimulatedLowerBodyFrame(now,simActionRef.current,simPerformers);
     const frame=livePoseA
      ?{
        performers:performerRef.current===2&&simFrame.performers[1]?[livePoseA,simFrame.performers[1]]:[livePoseA],
        crossing:!identitySafeRef.current,
        ambiguous:!identitySafeRef.current,
        source:'live' as const,
        actionLabel:'LIVE TRACKING · LOWER BODY'
       }
      :simFrame;
     const lb=lowerBodyRef.current;
     renderLowerBodyStageMonitor(ctx,preview.width,preview.height,{
      view:activeView,
      state:lb,
      frame,
      mediaA:lb.styleA.mediaId?mediaEls.current.get(lb.styleA.mediaId)??null:null,
      mediaB:lb.styleB.mediaId?mediaEls.current.get(lb.styleB.mediaId)??null:null,
      blackout:blackoutRef.current||!previewLiveRef.current
     });
    }else if(previewArrangementRef.current==='split'){
     if(!splitScratch.current)splitScratch.current={body:document.createElement('canvas'),floor:document.createElement('canvas')};
     const pair=splitScratch.current;
     for(const c of [pair.body,pair.floor]){if(c.width!==640)c.width=640;if(c.height!==540)c.height=540;}
     const bc=pair.body.getContext('2d'),fc=pair.floor.getContext('2d');
     if(bc){render(bc,'BODY A',640,540,true,false);if(performerRef.current===2)render(bc,'BODY B',640,540,false,false);}
     if(fc)render(fc,'FLOOR',640,540,true,false);
     ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,preview.width,preview.height);
     ctx.drawImage(pair.body,0,0,preview.width/2,preview.height);
     ctx.drawImage(pair.floor,preview.width/2,0,preview.width/2,preview.height);
     ctx.fillStyle='#c8dbc9';ctx.font='13px sans-serif';ctx.fillText('BODY A/B',16,24);ctx.fillText('FLOOR',preview.width/2+16,24);
    }else render(ctx,selectedRef.current,preview.width,preview.height);
   }}
   if(preview&&liquidFrame&&liquidCanvas.current&&
    previewArrangementRef.current==='surface'&&monitorViewRef.current==='FLOOR'&&selectedRef.current==='FLOOR'){
    const g=preview.getContext('2d');
    if(g){g.save();g.globalCompositeOperation='source-over';
     g.globalAlpha=1;g.drawImage(liquidCanvas.current,0,0,preview.width,preview.height);
     g.restore();}
   }
   // A 1P camera can track feet without verified floor contact.
   // Draw observed image-space soles only into the SOFTWARE Stage Monitor.
   // Physical FLOOR output and Map/Perform authorization remain unchanged.
   const floorPreviewVisible=useComposeFloorPoseFallback({
    softwareMonitor:!!preview&&monitorViewRef.current==='FLOOR'&&
     selectedRef.current==='FLOOR'&&previewArrangementRef.current==='surface',
    lineTrails:lineTrailsRef.current,liquidEnabled:liquidEnabledRef.current,
    liquidMode:liquidModeRef.current,timelineMode:timelineModeRef.current,
    previewLive:previewLiveRef.current,blackout:blackoutRef.current,
    verifiedImprints:liquidFrame?(liquidRenderer.current?.stats.activeImprints??0):0
   });
   if(floorPreviewVisible){
    const frame=frameRefLive.current.current;
    const experiment=experimentFrameRef?.current??null;
    const experimentType=experimentSourceRef.current;
    const session=motionSessionRef.current?.()??'live-camera';
    const sourceKey=experimentType==='video'&&experiment?.kind==='video'
     ?'video:'+experiment.name+':'+(experiment.snapshot?.segment??0)
     :experimentType==='simulator'?'simulator':lineSourceRef.current+':'+session;
    const samples=experimentType
     ?(experiment&&experiment.kind===experimentType?
      footSamplesFromExperiment(experiment,'compose-floor-preview',0,'A'):[])
     :cameraOnRef.current&&bodySelectedRef.current&&frame.tracked&&
       frame.source==='camera'&&frame.time>0&&now>=frame.time&&now-frame.time<450
      ?footSamplesFromLive(frame,routerRef.current.previewStatus,performerRef.current,
         lineSourceRef.current,session,0,'A'):[];
    floorPosePreview.current.ingest(samples,now,sourceKey);
    const ctx=preview?.getContext('2d');
    const painted=!!preview&&!!ctx&&floorPosePreview.current.paint(
     ctx,now,preview.width,preview.height);
    if(painted!==floorPosePreviewActiveRef.current){
     floorPosePreviewActiveRef.current=painted;
     setFloorPosePreviewActive(painted);
    }
   }else if(floorPosePreviewActiveRef.current){
    floorPosePreviewActiveRef.current=false;
    setFloorPosePreviewActive(false);
   }
   if(preview&&timelineModeRef.current==='replay'&&selectedRef.current==='FLOOR'&&
    previewArrangementRef.current==='surface'&&!blackoutRef.current&&previewLiveRef.current&&!liquidFrame){
    const g=preview.getContext('2d');
    if(g){
     const fp=footprintRef.current;
     const dims=footprintSpriteDimensions(fp?.size??32);
     const marks=timelineFootprintVisibility(timelineCaptureRef.current,timelinePositionRef.current,
      (fp?.life??8)*1000);
     g.save();g.globalCompositeOperation='screen';
     for(const mark of marks){
      paintAuthenticFootprint(g,{
       x:mark.x*preview.width,y:mark.y*preview.height,
       side:mark.foot,headingRad:Math.PI/2-(mark.headingDeg*Math.PI/180),
       widthPx:dims.widthPx*.58,lengthPx:dims.lengthPx*.58,
       alpha:mark.opacity*.9,color:fp?.colors?.[mark.foot]??'#dce7df'
      });
     }
     g.restore();
    }
   }
   const masks=maskCache.current;
    const live=previewLiveRef.current&&!blackoutRef.current;
    const experiment=experimentSourceRef.current;
    const experimentFrame=experimentFrameRef?.current??null;
    const experimentSafe=!!(experiment&&experimentReadyRef.current&&live);
    // A clip or virtual rig has a stable QA binding across playback frames.
    // The binding changes when the file, resolution or performer count changes.
    const experimentKey=experiment==='video'&&experimentFrame?.kind==='video'
     ?'mp4:'+experimentFrame.name+':'+(experimentFrame.video?.videoWidth??0)+'x'+(experimentFrame.video?.videoHeight??0)
     :experiment==='simulator'?'puppet:2d:'+performerRef.current:null;
    const cameraKey=experiment?experimentKey:floorRef.current.boundCamera;
    const floorKey=experiment?(experimentKey?JSON.stringify([experimentKey,performerRef.current]):null):
     floorReadyRef.current?JSON.stringify([floorRef.current.calibrationData,cameraKey,performerRef.current]):null;
    const bodyMedia=experiment?experimentSafe:
     masks.safe&&readyMedia('BODY A')&&(performerRef.current===1||readyMedia('BODY B'));
    const defaultFloor=floorCanvas.current;
    const floorMedia=experiment?experimentSafe:
     floorReadyRef.current&&(readyMedia('FLOOR')||!!(defaultFloor&&defaultFloor.width>=16&&defaultFloor.height>=16));
    const cameraSafe=experiment?experimentSafe:live&&masks.safe&&!!cameraKey;
    outputReadyRef.current={body:cameraSafe&&bodyMedia,floor:cameraSafe&&floorMedia};
    const stageVisualReady=outputReadyRef.current.body||outputReadyRef.current.floor;
    if(lastRasterReady.current!==stageVisualReady){
     lastRasterReady.current=stageVisualReady;
     rasterReadyCallback.current?.(stageVisualReady);
    }
    stageRoute.current={
     mode:experiment?'simulation':'live',
     frameAtMs:cameraSafe?(experiment?now:masks.at):0,computedAtMs:now,
     cameraSafe,bodyMediaReady:outputReadyRef.current.body,
     bridgeSafe:outputReadyRef.current.floor,mask:!experiment&&cameraSafe?masks.union:null,
     cameraKey:cameraSafe?cameraKey:null,floorKey:cameraSafe?floorKey:null
    };
   const status=(!live?'Preview blackout':masks.reason)+
    (masks.safe?' · '+(performerRef.current===2?'BODY A/B':'BODY A')+' siap':'');
   if(status!==lastText){lastText=status;setBodyStatus(status);}
  };raf=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(raf);stageRoute.current=null;};
 },[]);
 // Keep Track events exclusively for the Event Timeline after RESET-00.
 useEffect(()=>{
  if(!previewLive||blackout||!motionEvents)return;
  let id=0;
  const consume=()=>{
   const events=motionEventsRef.current?.()??[];
   const session=motionSessionRef.current?.()??'unknown';
   if(activeMotionSession.current!==session){
    activeMotionSession.current=session;
    setTimelineMode('live');setTimelinePlaying(false);setTimelinePosition(0);
    setTimelineCapture(emptyTimelineCapture(session));
   }else if(timelineModeRef.current==='live'&&events.length){
    setTimelineCapture(previous=>collectTimelineEvents(previous,events,session,performance.now()));
   }
   id=window.setTimeout(consume,85);
  };
  consume();return()=>clearTimeout(id);
 },[previewLive,blackout,!!motionEvents]);
 const points=(e:PointerEvent<HTMLCanvasElement>)=>{
  if(monitorFullscreen)return; // Presentation mode must not select or edit objects.
  const rect=e.currentTarget.getBoundingClientRect();
  if(editMask&&layer){
   const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
   const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));
   const pts=layer.points.slice();
   const index=pts.findIndex(p=>Math.hypot((p[0]-x)*rect.width,(p[1]-y)*rect.height)<24);
   if(index<0){if(pts.length>=16)return;pts.push([x,y]);}else pts[index]=[x,y];
   patch({points:pts,mask:'polygon'});return;
  }
  if(previewArrangement!=='surface'){
   setHint('Pilih tampilan FLOOR atau BODY untuk memilih objek langsung.');return;
  }
  const coordinate=normalizedCanvasPoint(e.clientX,e.clientY,rect,e.currentTarget);
  if(!coordinate)return;
  const picked=pickTopmostObject(layers,id=>{
   const key=selected+':'+id,source=surfaceBuffers.current.get(key);
   if(!source)return 0;
   const envelope=previewLayerAlpha.current.get(key)??0;
   if(envelope<=0)return 0;
   try{
    const g=source.getContext('2d',{willReadFrequently:true});
    if(!g)return 0;
    const x=Math.min(source.width-1,Math.floor(coordinate.x*source.width/e.currentTarget.width));
    const y=Math.min(source.height-1,Math.floor(coordinate.y*source.height/e.currentTarget.height));
    return g.getImageData(x,y,1,1).data[3]*envelope;
   }catch{return 0;}
  });
  if(picked){
   setSelectedLayer(picked.layerIndex);setInspectorTab('object');
   setHint('Objek dipilih: '+layers[picked.layerIndex].name);
  }else setHint('Tidak ada objek terdeteksi pada titik ini.');
 };
 const openPreview=()=>{const win=window.open('','soma-s64-preview','width=960,height=540');if(!win){setHint('Izinkan popup untuk membuka preview.');return;}popup.current=win;win.document.body.style.cssText='margin:0;background:black';const c=win.document.createElement('canvas');c.width=1280;c.height=720;c.style.cssText='width:100vw;height:100vh;object-fit:contain';win.document.body.replaceChildren(c);setOutputOpen(true);};
 useEffect(()=>{if(!outputOpen)return;let raf=0;const tick=()=>{const win=popup.current;if(!win||win.closed){setOutputOpen(false);return;}const c=win.document.querySelector('canvas');const ctx=c?.getContext('2d');if(ctx&&c)render(ctx,selectedRef.current,c.width,c.height);raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[outputOpen,blackout,previewLive,floorReady,cameraOn,performerCount,identitySafe]);
 // Continue processing during Map, with UI safely hidden.
 const mapLineStage=lineTrails&&lineVersion==='v3'?<div style={{position:'absolute',width:1,height:1,opacity:0,pointerEvents:'none',overflow:'hidden'}} aria-hidden="true">
  <LineTrailsV3Stage outputRaster={lineOutputRaster}
   fullscreenRef={lineFullscreenRef} frameRef={frameRef} videoRef={videoRef}
   experimentInputCanvas={experimentInputCanvas} experimentFrameRef={experimentFrameRef}
   fullscreenDiagnostics={lineFullscreenDiagnostics}
   router={router} engine={lineV3Engine.current} settings={v3Options}
   cameraFloorCalibration={!experimentSource&&floorReady&&floorTracker.isConfirmed?floorTracker.calibrationData:null}
    videoFloorCalibration={activeVideoFloor}
   impressions={painterlyEngine.current} painterly={painterlyOptions}
   brushResetRevision={brushResetRevision}
   motionEvents={motionEvents}
   blackout={blackout||previewBlackout} previewLive={previewLive}
   cameraOn={cameraOn} bodySelected={bodySelected} performerCount={performerCount}
   experimentSource={experimentSource} sourceKind={lineSource} demo={lineDemo}
   onStatus={setLineStatus} onDiagnostics={setV3Diagnostics} motionSession={motionSession}/>
 </div>:null;
 if(mapMode)return <section className="map-r1-workspace" role="region" aria-label="Map — kalibrasi dan QA output">
  {mapLineStage}
  <canvas ref={bodyOutput} width={1280} height={720} hidden aria-label="Map BODY output raster"/>
  <canvas ref={floorOutput} width={1280} height={720} hidden aria-label="Map FLOOR output raster"/>
  <canvas ref={liquidCanvas} id="mat03-pixi-preview" width={960} height={540} hidden aria-label="MAT-03 Liquid Imprint PixiJS raster"/>
  <DualSurfaceRoutingPanel frameRef={stageRoute} bodyCanvas={bodyOutput}
   floorCanvas={floorOutput} legacyProjection={projection} experimentLocked={experimentLocked}
   liquidCanvas={liquidCanvas} experimentInputCanvas={experimentInputCanvas}
   experimentFrameRef={experimentFrameRef} motionSession={motionSession} liveSourceKind={lineSource}
   videoFloorCalibration={activeVideoFloor}
   videoRef={videoRef} motionFrameRef={frameRef} floorTracker={floorTracker} router={router}
   motionEvents={motionEvents} cameraOn={cameraOn} floorReady={floorReady}
   performerCount={performerCount} identitySafe={identitySafe}
   experimentSource={experimentSource}
   onOpenTrack={onOpenMapTrack} onOpenCompose={onOpenMapCompose}
   onMapOutputSaved={onMapOutputSaved} onMapOutputInvalidated={onMapOutputInvalidated}
   mapOutputSaved={mapOutputSaved}/>
 </section>;
 return <div id="soma-compose-focus" className={'s64-root msv4-root'+(embedded?' s64-embedded':'')} data-mask-edit={editMask}
  data-compose-ui-mode={composeUiMode==='quick'&&monitorView==='FLOOR'&&!lineTrails?'quick':'advanced'}
  role="region" tabIndex={0} aria-label="Compose Workspace — media dan layer" onKeyDown={onComposerKeys}>
  <div className="s64-heading">
   <div className="cpux-heading-label">
    <h2>Compose</h2>
    <span>{lineTrails?'Floor · Line Trails Beta':monitorView==='FLOOR'?'Floor · Liquid Imprint':monitorView==='SKELETON'?'Skeleton · 33 titik':'Kaki · '+monitorView} · {experimentSource?composeExperimentStatus(experimentSource,experimentReady,selected):(floorReady?'Preview sumber terkalibrasi':'Preview software')}</span>
    <span className="soma-ia-source-status" role="status">
     {experimentSource==='simulator'?'Lantai virtual':
      experimentSource==='video'?(activeVideoFloor?'MP4 · lantai terkalibrasi (estimasi)':'MP4 · estimasi 2D'):
      floorReady?'Kamera · lantai terkalibrasi (estimasi)':'Kamera · estimasi 2D'}
     {onOpenMapWorkspace&&experimentSource!=='simulator'&&
      <button type="button" onClick={onOpenMapWorkspace}>Kalibrasi bidang di Map</button>}
    </span>
   </div>
   <div className="s64-safety">
    <label className="cpux-preview-toggle"><input type="checkbox" checked={!blackout}
     disabled={previewBlackout} onChange={e=>setBlackout(!e.target.checked)}/> Preview</label>
    <span className="cpux-preview-status" role="status">{blackout||previewBlackout?'Padam':'Aktif'}</span>
    <details className="soma-ia-display-options"><summary>Preview</summary>
     <label><input type="checkbox" checked={previewLive}
      onChange={e=>setPreviewLive(e.target.checked)}/> Gerak real-time</label>
     <button type="button" onClick={openPreview}>Jendela preview</button>
     <button type="button" onClick={()=>setBlackout(true)}>Padam preview</button>
    </details>
   </div>
   <details className="cp04-command-menu">
    <summary aria-label="Opsi komposisi" title="Undo, redo, reset">Opsi</summary>
    <div className="cp04-command-bar" role="group" aria-label="Riwayat komposisi">
     {loadingMedia>0&&<span role="status">Memuat {loadingMedia} media…</span>}
     {saveStatus==='Penyimpanan gagal'&&<span role="alert">{saveStatus}</span>}
     <button type="button" disabled={!history.canUndo} onClick={performUndo} aria-label="Batalkan perubahan">Undo</button>
     <button type="button" disabled={!history.canRedo} onClick={performRedo} aria-label="Ulangi perubahan">Redo</button>
     <button type="button" className={resetArmed?'cp04-reset-confirm':'cp04-reset'}
      onClick={resetComposition} aria-label={resetArmed?'Konfirmasi reset komposisi':'Reset komposisi'}>
      {resetArmed?'Konfirmasi reset':'Reset'}
     </button>
     {resetArmed&&<button type="button" onClick={()=>setResetArmed(false)}>Batal</button>}
    </div>
   </details>
  </div>
  <div className="s64-layout" data-inspector-tab={inspectorTab}
   data-compose-view={monitorView}
   data-line-trails-active={lineTrails}
   data-compose-dock={composeInspectorVisible(monitorView,skeletonBackdrop)?'inspect':'wide'}>
   <aside className="s64-column cp02-library">
    <details className="soma-ia-media"><summary>Media <span>{media.length}</span></summary><label className="s64-upload">+ Import image / video<input type="file" multiple accept="image/*,video/*" onChange={upload}/></label><div className="s64-media-list">{media.map(m=><div className="cp06-asset" key={m.id}>
 <button type="button" title={'Gunakan '+m.name+' pada layer aktif'}
  onClick={()=>{patch({mediaId:m.id,name:m.name});setInspectorTab('layer');setPreviewArrangement('surface');}}>
  {m.kind==='image'&&m.url?<img src={m.url} alt=""/>:
   <span>{m.origin==='track'?'TRACK MP4':'VIDEO'}</span>}
  <span>{m.name}</span></button>
 {m.origin==='import'&&<button type="button" className="cp06-remove"
  aria-label={'Lepas aset '+m.name} onClick={()=>onRemoveAsset(m.id)}>×</button>}
 </div>)}</div>
 {media.some(m=>m.origin==='track')&&<small>MP4 Track dipakai langsung dari decoder Track. Tidak perlu unggah ulang.</small>}
 {assetNotice&&<small role="status">{assetNotice}</small>}
 </details></aside>
   <section id="soma-compose-monitor" ref={monitorFullscreenRef} className="s64-center cp02-editor">
    <div className="cp-compose-monitor-heading cpux-monitor-title" role="heading" aria-level={3}>
      <strong>Stage Monitor</strong>
      {(()=>{
       const prov=deriveComposeProvenance({liquidMode,experimentSource,cameraOn,floorReady});
       return <span className="cpux-provenance-tag" data-kind={prov.kind} title={prov.detail}>{prov.label}</span>;
      })()}
    </div>
    <div className="uxr3-compose-preview-bar">
     <div className="lb-view-tabs" role="group" aria-label="Pilih bidang preview">
      {COMPOSE_VIEW_TABS.map(tab=><button key={tab.id} type="button"
       hidden={composeUiMode==='quick'&&monitorView==='FLOOR'&&tab.id!=='FLOOR'&&tab.id!=='SPLIT'}
       title={tab.title}
       aria-pressed={monitorView===tab.id}
       onClick={()=>selectMonitorView(tab.id)}>{composeUiMode==='quick'&&tab.id==='FLOOR'?'LANTAI':tab.label}</button>)}
     </div>
     <button type="button" className="lt-beta-trigger" aria-pressed={lineTrails}
      onClick={()=>{if(!lineTrails){selectMonitorView('FLOOR');setLineDemo(false);}setLineTrails(v=>!v);}}
      title="Garis dari kaki kiri dan kanan · eksperimental">
      Garis <span>BETA</span>
     </button>
     {monitorView==='SKELETON'&&<div className="cp-compose-skeleton-controls" aria-label="Tampilan skeleton">
      <div role="group" aria-label="Latar skeleton" className="cp-compose-skeleton-modes">
       <button type="button" aria-pressed={skeletonBackdrop==='black'}
        onClick={()=>setSkeletonBackdrop('black')} title="Skeleton dengan latar hitam">Hitam</button>
       <button type="button" aria-pressed={skeletonBackdrop==='input'}
        onClick={()=>setSkeletonBackdrop('input')} title="Tampilkan video atau gambar input">Input</button>
      </div>
      {skeletonBackdrop==='input'&&media.some(m=>m.origin==='import')&&
       <select className="cp-compose-skeleton-input" aria-label="Sumber gambar untuk Skeleton"
        title="Media impor belum memiliki hasil deteksi skeleton"
        value={skeletonInputId} onChange={event=>setSkeletonInputId(event.target.value)}>
        <option value="track">Input Track</option>
        {media.filter(m=>m.origin==='import').map(m=>
         <option key={m.id} value={m.id}>{m.name}</option>)}
       </select>}
      {skeletonBackdrop==='input'&&skeletonInputId!=='track'&&
       <small className="cp-compose-skeleton-info" title="Gambar ini belum diproses oleh tracking">Belum dilacak</small>}
     </div>}
     <button type="button" className="cp-compose-fullscreen-button"
      aria-label={monitorFullscreen?'Keluar fullscreen Stage Monitor':'Fullscreen Stage Monitor'}
      aria-pressed={monitorFullscreen}
      title={monitorFullscreen?'Kembali ke Compose (Esc)':'Perbesar Stage Monitor ke layar penuh'}
      onClick={toggleMonitorFullscreen}>
      {monitorFullscreen?<Minimize2 size={16} aria-hidden="true"/>:<Maximize2 size={16} aria-hidden="true"/>}
      <span>{monitorFullscreen?'Keluar':'Layar penuh'}</span>
     </button>
     {fullscreenNotice&&<small className="cp-compose-fullscreen-notice" role="status">{fullscreenNotice}</small>}
    </div>
    {lineTrails&&lineVersion==='v3'&&<LineTrailsV3Stage
     outputRaster={lineOutputRaster}
     fullscreenRef={lineFullscreenRef} frameRef={frameRef} videoRef={videoRef}
     experimentInputCanvas={experimentInputCanvas} experimentFrameRef={experimentFrameRef}
     fullscreenDiagnostics={lineFullscreenDiagnostics}
     router={router} engine={lineV3Engine.current} settings={v3Options}
     cameraFloorCalibration={!experimentSource&&floorReady&&floorTracker.isConfirmed?floorTracker.calibrationData:null}
    videoFloorCalibration={activeVideoFloor}
      impressions={painterlyEngine.current} painterly={painterlyOptions}
      brushResetRevision={brushResetRevision}
      onRegisterExportInk={fn=>{inkExportRef.current=fn;}}
      onRegisterMotionTrace={fn=>{motionTraceRef.current=fn;}}
      onRegisterInkArchive={api=>{inkArchiveRef.current=api;}}
      motionEvents={motionEvents}
     blackout={blackout||previewBlackout} previewLive={previewLive}
     cameraOn={cameraOn} bodySelected={bodySelected}
     performerCount={performerCount} experimentSource={experimentSource}
     sourceKind={lineSource} demo={lineDemo}
     onStatus={setLineStatus} onDiagnostics={setV3Diagnostics} motionSession={motionSession}/>}
    {lineTrails&&lineVersion==='v2'&&<LineTrailsBetaStage
     fullscreenRef={lineFullscreenRef} frameRef={frameRef} videoRef={videoRef}
     experimentInputCanvas={experimentInputCanvas} experimentFrameRef={experimentFrameRef}
     fullscreenDiagnostics={lineFullscreenDiagnostics}
     router={router} engine={lineEngine.current} brushEngine={brushEngine.current}
     settings={lineOptions} motionEvents={motionEvents}
     blackout={blackout||previewBlackout} previewLive={previewLive}
     cameraOn={cameraOn} bodySelected={bodySelected}
     performerCount={performerCount} experimentSource={experimentSource}
     sourceKind={lineSource} selectedActor={lineActor} demo={lineDemo}
     onStatus={setLineStatus} onBrushCount={setLineBrushCount} motionSession={motionSession}/>}
    {!lineTrails&&<div className="s64-stage"><canvas width={960} height={540} ref={canvas} onPointerDown={points} aria-label="Visual preview composer — klik objek untuk membuka Inspector"/>
 {inspectorTab==='object'&&layer&&previewArrangement==='surface'&&monitorView==='FLOOR'&&
  <div className="cp07-stage-selected" aria-hidden="true">
   <span>SELECTED · {layer.name}</span>
  </div>}
  {editMask&&layer?.mask==='polygon'&&<svg viewBox="0 0 960 540" preserveAspectRatio="none">{layer.points.map(([x,y],i)=><circle key={i} cx={x*960} cy={y*540} r="9" fill="#84dacb"/>)}<polygon points={layer.points.map(p=>p[0]*960+','+p[1]*540).join(' ')} fill="#84dacb" fillOpacity=".1" stroke="#84dacb" strokeDasharray="6 5"/></svg>}</div>}
   {monitorView!=='FLOOR'&&monitorView!=='SKELETON'&&<div className="lb-event-test-bar" role="group" aria-label="Simulasi gerak lower body">
    <span className="lb-event-test-label">EVENT TEST</span>
    {LOWER_BODY_SIM_ACTIONS.map(act=><button key={act.id} type="button"
     aria-pressed={act.id!=='reset'&&simAction===act.id}
     onClick={()=>setSimAction(act.id==='reset'?'idle':act.id)}>
     {act.label}
    </button>)}
   </div>}
   <div className="s64-bar">
    {lineTrails&&<span role="status">{lineStatus}</span>}
    {!lineTrails&&monitorView==='FLOOR'&&liquidMode==='track'&&floorPosePreviewActive&&
     <span role="status">Jejak 2D aktif · Kalibrasi Map diperlukan untuk proyektor</span>}
    {!lineTrails&&monitorView==='FLOOR'&&liquidMode==='track'&&!floorPosePreviewActive&&timelineCapture.events.length===0&&
     <span role="status">Belum ada jejak dari Track</span>}
    {monitorView!=='FLOOR'&&monitorView!=='SKELETON'&&<span>{cameraOn&&bodySelected?bodyStatus:'Simulasi aktif · uji mask paha, warna, tekstur, atau crossing'}</span>}
    {monitorView==='FLOOR'&&inspectorTab==='object'&&
     <button type="button" onClick={()=>{setEditMask(!editMask);setInspectorTab('object');}}>
      {editMask?'Selesai edit mask':'Edit mask'}</button>}
   </div>
   <details className="cpux-timeline-drawer">
    <summary>Timeline <span>{timelineCapture.events.length>0?
     timelineCapture.events.length+' event':'Belum ada event'}</span></summary>
    <ComposerEventTimeline capture={timelineCapture} positionMs={timelinePosition}
    onSeek={ms=>{timelinePositionRef.current=ms;setTimelinePosition(ms);}}
    mode={timelineMode} onModeChange={mode=>{
     setTimelineMode(mode);
     if(mode==='replay'){setSelected('FLOOR');setPreviewArrangement('surface');}
    }} playing={timelinePlaying} onPlayingChange={setTimelinePlaying}
    speed={timelineSpeed} onSpeedChange={setTimelineSpeed}
    onClear={()=>{setTimelineCapture(emptyTimelineCapture(motionSessionRef.current?.()??'unknown'));
     setTimelineMode('live');setTimelinePlaying(false);setTimelinePosition(0);}}/>
   
   </details>
   <details className="soma-ia-layers"><summary>Layer <span>{layers.length}</span></summary>{layers.map((l,i)=><div className={'s64-layer '+(i===selectedLayer?'active':'')} key={l.id}
  draggable={layers.length>1} data-dragging={dragLayer===i} data-drop-target={dropLayer===i&&dragLayer!==i}
  onDragStart={event=>{setDragLayer(i);setDropLayer(null);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(i));}}
  onDragOver={event=>{if(dragLayer===null)return;event.preventDefault();event.dataTransfer.dropEffect='move';setDropLayer(i);}}
  onDrop={event=>{event.preventDefault();if(dragLayer!==null&&dragLayer!==i){
   setComposition(state=>{const order=[...state[selected]];const [moving]=order.splice(dragLayer,1);order.splice(i,0,moving);return {...state,[selected]:order};});
   setSelectedLayer(i);setSaveStatus('Urutan layer diubah');
  }setDragLayer(null);setDropLayer(null);}}
  onDragEnd={()=>{setDragLayer(null);setDropLayer(null);}}><button onClick={()=>{setSelectedLayer(i);setInspectorTab('object');}} aria-pressed={i===selectedLayer}>{i+1}. {l.name}</button><button onClick={()=>setComposition(c=>({...c,[selected]:c[selected].map((x,j)=>j===i?{...x,visible:!x.visible}:x)}))}>{l.visible?'Visible':'Hidden'}</button><button disabled={i===0} onClick={()=>setComposition(c=>{const a=[...c[selected]];[a[i-1],a[i]]=[a[i],a[i-1]];return {...c,[selected]:a};})}>↑</button><button disabled={i===layers.length-1} onClick={()=>setComposition(c=>{const a=[...c[selected]];[a[i],a[i+1]]=[a[i+1],a[i]];return {...c,[selected]:a};})}>↓</button></div>)}<button onClick={()=>{setComposition(c=>({...c,[selected]:[...c[selected],makeLayer()]}));setSelectedLayer(layers.length);}}>+ Layer</button>
  <div className="cp05-source-actions" role="group" aria-label="Tambahkan sumber komposisi">
   {([{id:COMPOSE_STAGE_INPUT,label:'+ MP4 / INPUT'},
     {id:COMPOSE_STAGE_FLOOR,label:'+ FLOOR / Track'}] as const).map(source=>
    <button key={source.id} type="button" onClick={()=>{
     const added=makeLayer(source.id,COMPOSE_SOURCE_CHOICES.find(x=>x.id===source.id)?.label??'Source');

     const at=source.id===COMPOSE_STAGE_INPUT?0:layers.length;
     setComposition(c=>{const next=[...c[selected]];next.splice(at,0,added);return {...c,[selected]:next};});
     setSelectedLayer(at);setInspectorTab('layer');
    }}>{source.label}</button>)}
  </div><button disabled={layers.length<=1} onClick={()=>{setComposition(c=>({...c,[selected]:c[selected].filter((_,i)=>i!==selectedLayer)}));setSelectedLayer(0);}}>Hapus layer</button></details></section>
   <aside className="s64-column cp02-inspector" id="soma-compose-leg-inspector"
   hidden={!composeInspectorVisible(monitorView,skeletonBackdrop)}
  onPointerDownCapture={onInspectorPointerDown} onPointerUpCapture={onInspectorPointerEnd}
  onPointerCancelCapture={onInspectorPointerEnd} onKeyDownCapture={onInspectorKeyDown}
  onKeyUpCapture={onInspectorKeyUp} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))history.endGroup();}}>
  {!experimentSource&&cameraOn&&performerCount===2&&!previewIdentitySafe&&<div className="lt-beta-status" role="status"><span>{previewIdentityReason||'Identitas A/B belum stabil'}</span> <button type="button" onClick={onResetPreviewIdentity} disabled={!onResetPreviewIdentity}>Baca ulang A/B</button></div>}
  <FootMotionAudioPanel visible={monitorView==='FLOOR'} allowed={audioWorkspaceActive&&!workspaceHidden&&!mapMode&&!blackout&&!previewBlackout&&previewLive&&!footprint?.hold&&monitorView==='FLOOR'&&(lineTrails||liquidEnabled)} sourceReady={audioSourceReady&&previewIdentitySafe&&timelineMode==='live'&&(lineTrails?!lineDemo:liquidMode==='track')} trace={lineTrails} events={motionEvents} session={motionSession} onTakeAudio={onTakeAudio}/>
  {!lineTrails&&monitorView==='FLOOR'&&<div className="cp25-inspector-switch">
   <div className="cp25-inspector-header">
    <div><strong>Visual</strong><span>{getComposeVisualStyle(steering.styleId).name}</span></div>
    <label className="cp25-visual-toggle"><input type="checkbox" checked={liquidEnabled}
     onChange={e=>setLiquidEnabled(e.target.checked)} aria-label="Aktifkan visual lantai"/>Aktif</label>
   </div>
   <div className="cp25-mode-tabs" role="group" aria-label="Mode pengaturan visual">
    <button type="button" aria-pressed={composeUiMode==='quick'}
     onClick={()=>{setComposeUiMode('quick');setInspectorTab('scene');}}>Sederhana</button>
    <button type="button" aria-pressed={composeUiMode==='advanced'}
     onClick={()=>setComposeUiMode('advanced')}>Lanjutan</button>
   </div>
  </div>}
  {lineTrails&&lineVersion==='v3'?<LineTrailsV3Panel
   settings={v3Options} onChange={setV3Options} engine={lineV3Engine.current}
   painterly={painterlyOptions} onPainterlyChange={setPainterlyOptions}
   impressions={painterlyEngine.current}
   onClear={()=>{lineV3Engine.current.reset();painterlyEngine.current.reset();setBrushResetRevision(n=>n+1);setLineStatus('Gambar dibersihkan');}}
   onExportPNG={()=>{
    const png=inkExportRef.current();
    if(!png){setLineStatus('Belum ada lukisan untuk disimpan');return;}
    const a=document.createElement('a');a.href=png;a.download='soma-sumi-v34-lukisan.png';
    document.body.appendChild(a);a.click();a.remove();
   }}
   onExportTrace={()=>{
    const json=motionTraceRef.current();
    if(!json){setLineStatus('Belum ada data gerak V2.4 untuk diekspor');return;}
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;
    a.download='soma-v24-trace-aktor-A-B.json';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    setLineStatus('Data posisi A/B disimpan di perangkat');
   }}
   onSaveSession={()=>{
    const json=inkArchiveRef.current.save();
    if(!json){setLineStatus('Lukisan belum tersedia');return;}
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='soma-sumi-v34-sesi.json';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
   }}
   onLoadSession={()=>{
    const picker=document.createElement('input');picker.type='file';
    picker.accept='.json,application/json';
    picker.onchange=()=>{const file=picker.files?.[0];if(!file)return;
     if(file.size>16_000_000){setLineStatus('Arsip Sumi terlalu besar');return;}
     void file.text().then(data=>inkArchiveRef.current.load(data))
      .then(()=>setLineStatus('Arsip lukisan dimuat'))
      .catch(error=>setLineStatus('Gagal membaca arsip: '+(error instanceof Error?error.message:'format salah')));
    };
    picker.click();
   }}
   demo={lineDemo}
   onDemo={()=>{lineV3Engine.current.reset();painterlyEngine.current.reset();
    if(painterlyOptions.painterlyEngine!=='sumi-v34'&&
     painterlyOptions.painterlyEngine!=='path-first-v35')setBrushResetRevision(n=>n+1);
    setLineDemo(v=>!v);}}
   status={lineStatus} diagnostics={v3Diagnostics} performerCount={performerCount}
   fullscreenDiagnostics={lineFullscreenDiagnostics}
   onFullscreenDiagnostics={setLineFullscreenDiagnostics}
   onUseV2={()=>{lineV3Engine.current.reset();painterlyEngine.current.reset();setLineVersion('v2');setLineDemo(false);}}
  />:lineTrails&&lineVersion==='v2'?<>
   <button type="button" className="lt-v3-return" onClick={()=>{
    lineEngine.current.clear();brushEngine.current.clear();setLineVersion('v3');setLineDemo(false);
   }}>Kembali ke Garis V3</button>
   <LineTrailsBetaPanel
   settings={lineOptions} onChange={setLineOptions}
   fullscreenDiagnostics={lineFullscreenDiagnostics} onFullscreenDiagnostics={setLineFullscreenDiagnostics}
   engine={lineEngine.current} brushEngine={brushEngine.current}
   onClear={()=>{lineEngine.current.clear();brushEngine.current.clear();setLineBrushCount(0);setLineStatus('Gambar dibersihkan');}} demo={lineDemo}
   onDemo={()=>{lineEngine.current.disconnect();brushEngine.current.disconnect();setLineDemo(v=>!v);}}
   status={lineStatus} performerCount={performerCount}
   selectedActor={lineActor} onActor={actor=>{lineEngine.current.disconnect();brushEngine.current.disconnect();setLineActor(actor);}}
  /></>:<>
  <h3>{monitorView==='FLOOR'?getComposeVisualStyle(steering.styleId).name:monitorView==='SKELETON'?'Skeleton 33 titik':'Visual Kaki · '+monitorView}</h3>
  {monitorView==='SKELETON'&&<p className="cp-compose-detection-note">Skeleton mengikuti Track. Pengaturan di bawah memengaruhi visual LEG A/B dan SPLIT.</p>}
  {monitorView!=='FLOOR'&&<LowerBodyQuickInspector
   view={monitorView==='SKELETON'?'SPLIT':monitorView}
   state={lowerBody}
   onChange={setLowerBody}
   savedPresets={savedLowerBodyPresets}
   onSavePreset={name=>setSavedLowerBodyPresets(prev=>saveCustomLowerBodyPreset(prev,name,lowerBody,typeof localStorage!=='undefined'?localStorage:undefined))}
   onApplySaved={preset=>setLowerBody(preset.state)}
   sharedAssets={media}/>}
  {monitorView==='FLOOR'&&<>
   {layer&&inspectorTab!=='scene'&&<div className="cp07-selection-bar" role="status">
    <strong>{layer.name}</strong><small>Objek {selectedLayer+1} / {layers.length} · {selected}</small>
   </div>}
   <div className="cp04-inspector-tabs" role="group" aria-label="Jenis pengaturan">
    {(['scene','layer','object'] as const).map(tab=><button type="button" key={tab}
     aria-pressed={inspectorTab===tab} onClick={()=>setInspectorTab(tab)}>
     {tab==='scene'?'Material':tab==='layer'?'Layer':'Objek'}</button>)}
   </div>
  </>}
  {monitorView!=='FLOOR'&&monitorView!=='SKELETON'&&<details className="lb-advanced-drawer">
   <summary>Advanced · Mask kalibrasi &amp; layer teknis</summary>
   <LegPreviewInspector value={legTuning}
    onChange={updateLegTuning} trackingReady={cameraOn&&bodySelected&&identitySafe&&floorReady}/>
   <div className="cp04-inspector-tabs" role="group" aria-label="Pengaturan lanjutan">
    {(['layer','object'] as const).map(tab=><button type="button" key={tab}
     aria-pressed={inspectorTab===tab} onClick={()=>setInspectorTab(tab)}>
     {tab==='layer'?'Layer':'Objek'}</button>)}
   </div>
  </details>}
  {inspectorTab==='scene'&&selected==='FLOOR'&&
   <section className="mat03-compose-controls" aria-label="Pustaka gaya dan kontrol live visual lantai">
    <label className="mat03-active-label"><span>Visual Lantai Aktif</span>
     <input type="checkbox" aria-label="Tampilkan visual lantai di Stage Monitor" checked={liquidEnabled}
      onChange={event=>setLiquidEnabled(event.target.checked)}/>
    </label>
    {liquidEnabled&&<>
     <div role="group" aria-label="Sumber event visual lantai">
      <button type="button" aria-pressed={liquidMode==='track'}
       onClick={()=>setLiquidMode('track')}>Track (Aktif)</button>
      <button type="button" aria-pressed={liquidMode==='demo'}
       onClick={()=>setLiquidMode('demo')}>Demo (Uji)</button>
     </div>
     {liquidMode==='demo'&&
      <div role="group" aria-label="Fase uji jejak sintetik">
       {COMPOSER_LIQUID_PHASES.map(phase=><button type="button" key={phase}
        aria-pressed={liquidPhase===phase} onClick={()=>setLiquidPhase(phase)}>
        {phase[0].toUpperCase()+phase.slice(1)}</button>)}
      </div>}

     <div className="cpux-style-library">
      <div className="cpux-sculpt-head">
       <strong>Gaya visual</strong>
       <span>{getComposeVisualStyle(steering.styleId).tag}</span>
      </div>
      <div className="cpux-style-grid" role="group" aria-label="Pilih gaya animasi visual lantai">
       {COMPOSE_VISUAL_STYLES.map((item,index)=><button type="button" key={item.id}
        className={'cpux-style-card'+(index>=4?' cp25-extra-style':'')}
        aria-pressed={steering.styleId===item.id}
        title={item.description}
        onClick={()=>selectVisualStyle(item.id)}>
        <span className="cpux-style-swatch" style={{background:item.swatch}} aria-hidden="true"/>
        <b>{item.name}</b>
        <small>{item.tag}</small>
       </button>)}
       <button type="button" className="cp25-more-styles" onClick={()=>setComposeUiMode('advanced')}>Semua gaya</button>
      </div>
     </div>

     <div className="cpux-steer-section">
      <div className="cpux-sculpt-head">
       <strong>Live Steer Pad</strong>
       <span>Flow {Math.round(steering.flow*100)}% · Turb {Math.round(steering.turbulence*100)}%</span>
      </div>
      <div className="cpux-xy-pad" role="slider" tabIndex={0}
       aria-label="Live Steer XY Pad: seret horizontal untuk Flow, vertikal untuk Turbulence"
       aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(steering.flow*100)}
       onPointerDown={e=>{
        e.currentTarget.setPointerCapture(e.pointerId);
        const r=e.currentTarget.getBoundingClientRect();
        updateSteering({
         flow:(e.clientX-r.left)/r.width,
         turbulence:1-(e.clientY-r.top)/r.height
        });
       }}
       onPointerMove={e=>{
        if(!e.currentTarget.hasPointerCapture(e.pointerId))return;
        const r=e.currentTarget.getBoundingClientRect();
        updateSteering({
         flow:(e.clientX-r.left)/r.width,
         turbulence:1-(e.clientY-r.top)/r.height
        });
       }}
       onKeyDown={e=>{
        const d=e.shiftKey?.12:.04;
        if(e.key==='ArrowRight'){e.preventDefault();updateSteering({flow:steering.flow+d});}
        else if(e.key==='ArrowLeft'){e.preventDefault();updateSteering({flow:steering.flow-d});}
        else if(e.key==='ArrowUp'){e.preventDefault();updateSteering({turbulence:steering.turbulence+d});}
        else if(e.key==='ArrowDown'){e.preventDefault();updateSteering({turbulence:steering.turbulence-d});}
       }}>
       <span className="cpux-xy-axis-y" aria-hidden="true">TURB</span>
       <span className="cpux-xy-axis-x" aria-hidden="true">FLOW</span>
       <span className="cpux-xy-crosshair-v" style={{left:(steering.flow*100)+'%'}} aria-hidden="true"/>
       <span className="cpux-xy-crosshair-h" style={{top:((1-steering.turbulence)*100)+'%'}} aria-hidden="true"/>
       <span className="cpux-xy-puck" style={{left:(steering.flow*100)+'%',top:((1-steering.turbulence)*100)+'%'}} aria-hidden="true"/>
      </div>
      <div className="cpux-macro-row" role="group" aria-label="Preset modulasi cepat">
       {COMPOSE_STEER_MACROS.map(m=><button type="button" key={m.id}
        onClick={()=>updateSteering(m.patch)}>{m.label}</button>)}
      </div>
      <label>Glow · {Math.round(steering.glow*100)}%
       <input aria-label="Intensitas Glow" type="range" min="0" max="1" step=".04"
        value={steering.glow} onChange={e=>updateSteering({glow:Number(e.target.value)})}/>
      </label>
      <label>Warna (Hue) · {Math.round(steering.hueShift*360)}°
       <input aria-label="Pergeseran warna Hue" type="range" min="-.5" max=".5" step=".02"
        value={steering.hueShift} onChange={e=>updateSteering({hueShift:Number(e.target.value)})}/>
      </label>
      <label>Pulse · {Math.round(steering.pulseRate*100)}%
       <input aria-label="Kecepatan denyut Pulse" type="range" min="0" max="1" step=".04"
        value={steering.pulseRate} onChange={e=>updateSteering({pulseRate:Number(e.target.value)})}/>
      </label>
     </div>

     <small role="status" className="mat03-engine-status" title={liquidStatus}>
      {liquidStatus.includes('gagal')?liquidStatus:''}</small>
     {liquidMode==='track'&&timelineCapture.events.length===0&&
      <small role="status">Belum ada kontak dari Track — pilih Demo (Uji) untuk menyetir gaya secara langsung.</small>}
    </>}
    {footprint&&updateFootprint&&<div className="cpux-footprint-sculpt">
     <div className="cpux-sculpt-head"><strong>Bentuk Jejak</strong><span>{footprint.style}</span></div>
     <div className="cpux-style-group" role="group" aria-label="Gaya jejak lantai">
      {(['Tapak','Campuran','Garis','Titik'] as const).map(style=><button type="button" key={style}
       aria-pressed={footprint.style===style} onClick={()=>updateFootprint({style})}>{style}</button>)}
     </div>
     <label>Ukuran · {footprint.size} px
      <input type="range" min="12" max="90" step="2" value={footprint.size}
       aria-label="Ukuran jejak lantai"
       onChange={e=>updateFootprint({size:Number(e.target.value)})}/>
     </label>
     <label>{composeUiMode==='quick'?'Ketahanan':'Durasi jejak'} · {footprint.life} dtk
      <input type="range" min="1" max="60" step="1" value={footprint.life}
       aria-label="Durasi jejak lantai"
       onChange={e=>updateFootprint({life:Number(e.target.value)})}/>
     </label>
    </div>}
    {liquidEnabled&&<div className="cp25-quick-intensity">
     <label>Intensitas · {Math.round(steering.glow*100)}%
      <input type="range" min="0" max="1" step=".04"
       aria-label="Intensitas visual lantai" value={steering.glow}
       onChange={e=>updateSteering({glow:Number(e.target.value)})}/>
     </label>
    </div>}
   </section>}
  {inspectorTab!=='scene'&&<div className="cp04-current-layer" role="status">
   <strong>{selected} / {layer?.name??'Tidak ada layer'}</strong>
   <span>{COMPOSE_SOURCE_CHOICES.find(o=>o.id===layer?.mediaId)?.label??media.find(m=>m.id===layer?.mediaId)?.name??(composerSourceKind(layer??{mediaId:'',name:''},selected)==='floor'?'Footprints / FLOOR':'Belum ada media')}</span>
  </div>}
 {inspectorTab==='object'&&<details className="uxr3-advanced" open>
  <summary>Object · transform &amp; mask</summary>
  <label>Object name<input type="text" maxLength={90} value={layer?.name??''}
   onChange={e=>patch({name:e.target.value})}/></label>
  <label>Blend<select value={layer?.blend??'source-over'}
   onChange={e=>patch({blend:e.target.value as GlobalCompositeOperation})}>
   <option value="source-over">Normal</option><option value="screen">Screen</option>
   <option value="multiply">Multiply</option><option value="lighter">Add</option>
  </select></label>
  <button type="button" onClick={()=>patch({x:0,y:0,scale:100,rotation:0})}>Reset transform</button>
  <p className="cp07-object-help">Pilih objek pada Stage Monitor atau Layer.</p><label>Mask<select value={layer?.mask} onChange={e=>patch({mask:e.target.value as Mask})}><option value="none">None</option><option value="silhouette">Body silhouette</option><option value="polygon">Polygon</option></select></label><label>Opacity <input type="range" min="0" max="100" value={layer?.opacity??100} onChange={e=>patch({opacity:+e.target.value})}/>{layer?.opacity}%</label><label>Scale <input type="range" min="20" max="300" value={layer?.scale??100} onChange={e=>patch({scale:+e.target.value})}/>{layer?.scale}%</label>{(['x','y','rotation','feather'] as const).map(k=><label key={k}>{k}<input type="number" value={layer?.[k]??0} onChange={e=>patch({[k]:+e.target.value})}/></label>)}</details>} {inspectorTab==='layer'&&<><label>Layer source<select aria-label="Pilih sumber layer"
  value={layer?.mediaId??''} onChange={e=>patch({mediaId:e.target.value,
   name:COMPOSE_SOURCE_CHOICES.find(x=>x.id===e.target.value)?.label??
    media.find(x=>x.id===e.target.value)?.name??layer?.name??'Layer'})}>
   <option value="">No source / empty</option>
   {COMPOSE_SOURCE_CHOICES.filter(source=>source.id!==SHARED_TRACK_MP4_ID||!media.some(m=>m.id===SHARED_TRACK_MP4_ID)).map(source=>
    <option key={source.id} value={source.id}>{source.label}</option>)}
   
   {sharedAssetChoices(media).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
  </select></label>
  <label>Opacity · {layer?.opacity??100}%
   <input type="range" min="0" max="100" value={layer?.opacity??100}
    onChange={e=>patch({opacity:Number(e.target.value)})}/></label>
  <label>Blend<select value={layer?.blend} onChange={e=>patch({blend:e.target.value as GlobalCompositeOperation})}><option value="source-over">Normal</option><option value="screen">Screen</option><option value="multiply">Multiply</option><option value="lighter">Add</option></select></label></>}
 {hint&&inspectorTab!=='scene'&&<p className="cp04-hint" role="status">{hint}</p>}</>}
 </aside>
  </div>
  <div className="s64-runtime" aria-hidden="true">
   <canvas ref={bodyOutput} width={1280} height={720} hidden aria-label="BODY compositor raster"/>
   <canvas ref={floorOutput} width={1280} height={720} hidden aria-label="FLOOR compositor raster"/>
    <canvas ref={liquidCanvas} id="mat03-pixi-preview" width={960} height={540} hidden
     aria-label="MAT-03 Liquid Imprint PixiJS preview only"/>
  </div>
 </div>;
}
