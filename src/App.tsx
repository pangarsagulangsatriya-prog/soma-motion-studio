import {StudioFootprints,footprintDefaults,type FootprintConfig,type FootprintsHandle} from './footprints/StudioFootprints';
import {FootprintsPanel} from './footprints/FootprintsPanel';
import {PuppetSimulator} from './footprints/simulator/PuppetSimulator';
import {DirectPuppetSession} from './footprints/simulator/puppet-controller.ts';
import {defaultFloorSpace} from './footprints/spatial/coordinates.ts';
import {createLandscapePhoneCamera,type LandscapePhoneCamera} from './engine/landscapePhoneCamera.ts';
import {normalizeCameraDevices} from './engine/universalCamera.ts';
import {preserveCurrentSource} from './studio/v3/sourceE2EGuard.ts';
import {LiveFloorWorkspace} from './footprints/live/LiveFloorWorkspace';
import {requestStageBlackout} from './footprints/stage-optics/StageBlackout';
import {requestSoftwarePreviewBlackout} from './studio/v3/stagePreviewCommands.ts';
import {LiveFloorTrackingEngine,cameraBinding,cameraBindingKey} from './footprints/live/LiveFloorTrackingEngine';
import {MultiPoseGaitRouter} from './footprints/live/MultiPoseGaitRouter';
import {floorCalibrationSignature} from './projection/floorBridge';
import {useProjection} from './projection/useProjection';
import {useStageSession} from './stage/useStageSession.ts';
import {ProjectionWorkspace} from './projection/ProjectionWorkspace';
import {useCameraCue} from './photos/useCameraCue';
import {CameraFrame} from './photos/CameraFrame';
import {usePhotoArchive} from './photos/usePhotoArchive';
import {PhotoWall,PhotoPanel} from './photos/PhotoArchive';
import {cameraAvailable} from './photos/store';
import {GlobalNav} from './studio/v3/GlobalNav';
import type {StageNavigationRequest,StageNavigationTool} from './studio/v3/stageNavigation.ts';
import type {SceneId} from './studio/v3/ScenePicker';
import {FootprintsStageWorkspace} from './studio/v3/FootprintsStageWorkspace';
import {deriveFootprintsInputStatus,type FootprintsInputChoice} from './studio/v3/sourceSwitchModel';
import {defaultFootprintsWorkspace} from './studio/v3/footprintsUX';
import {StudioTransport} from './studio/v3/StudioTransport';
import {SceneInspector} from './studio/v3/SceneInspector';
import {CaptureHub,type CaptureTab} from './studio/v3/CaptureHub';
import {keyboardIsInControl,stoppingVideoRequiresConfirmation} from './studio/v3/interaction';
import './studio/v3/studio-v3.css';
import {LIVE_MODES,switchLiveMode} from './studio/liveVisual';
import {hydraDefaults} from './studio/hydraConfig';
import {useState,useRef,useEffect,useCallback} from 'react';
import {BookOpen,AudioLines,Camera,CameraOff,Volume2,VolumeX,Maximize2,Minimize2,MousePointer2,SlidersHorizontal,ScanLine,ArrowUpRight,ArrowRight,Plus,Download,Upload,Save,FolderOpen,HelpCircle,RotateCcw,Trash2,ShieldCheck,Check,ChevronDown,Radio,Square,Play,Pause,MoveHorizontal,X,Settings2,Activity,Command,Hand, Circle, Sparkles, Layers, Eye, EyeOff, PersonStanding, ScanFace, PanelRightOpen, PanelRightClose, Monitor, ChevronRight} from 'lucide-react';
import {defaults,defaultMappings,defaultVisualMappings,defaultEvents,characterPatch,uid,emptyFrame,FEATURES,TARGETS,INPUTS,CHARACTERS,VISUALS,type Settings,type Mode,type MotionFrame,type Mapping,type Feature,type Target,type Instrument,type HitKind,type InputKind,type VisualParams} from './engine/types';
import {MappingEngine,VisualMappingEngine,HoldTrigger,validatePreset} from './engine/mapping';
import {AudioEngine} from './engine/audio';
import {CameraTracker} from './engine/tracking';
import {Recorder,MotionLog,download,type Take} from './engine/recording';
import {clamp} from './engine/motion';
import {MODES,Range,Modal,AudioMonitor,IdleArt} from './components';
import {VisualStage} from './VisualStage';
import {StudioControls,type ControlTab} from './StudioControls';
import {MappingEditor} from './MappingEditor';
import {useArchive} from './archive/useArchive';
import {ArchiveWorkspace} from './archive/ArchiveWorkspace';
// Final Compose stylesheet: load after nested legacy CP01–CP04 styles.
import './studio/v3/mapping-studio-v4.css';

type Preset={id:string;name:string;settings:Settings};
const KEY='soma-presets-v1';
const clock=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`;
const noteName=(hz:number)=>{const n=Math.round(69+12*Math.log2(hz/440));return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((n%12)+12)%12]+(Math.floor(n/12)-1);};
const STARTERS=[
 {name:'Air / Jejak',description:'Nada jernih. Goresan dari ujung jari.',settings:{...defaults(),visual:{...defaults().visual,style:'trail'}}},
 {name:'Raw / Serat',description:'Gesekan kering. Serat mengikuti tangan.',settings:{...defaults(),...characterPatch('raw')}},
 {name:'Metal / Butiran',description:'Distorsi rendah. Sapuan melempar butiran.',settings:{...defaults(),...characterPatch('metal'),visual:{...defaults().visual,style:'particles'}}},
 {name:'Metallic / Bidang',description:'Denting logam. Bidang dari arah kepala.',settings:{...defaults(),...characterPatch('metallic'),input:'face',mappings:defaultMappings('theremin','face'),visual:{...defaults().visual,style:'planes',mappings:defaultVisualMappings('face')}}},
 {name:'Dark / Tubuh',description:'Dengung rendah. Ruang dari gerak tubuh.',settings:{...defaults(),...characterPatch('dark'),mode:'drone',input:'body',mappings:defaultMappings('drone','body'),eventMap:defaultEvents('drone'),visual:{...defaults().visual,style:'planes',mappings:defaultVisualMappings('body')}}},
 {name:'Pulse / Kit',description:'Kick, snare, dan clap dari sapuan.',settings:{...defaults(),mode:'percussion',mappings:defaultMappings('percussion','hands'),eventMap:defaultEvents('percussion'),visual:{...defaults().visual,style:'particles'}}}
].map(p=>({...p,settings:{...p.settings,hydra:{...hydraDefaults(),enabled:false}}})) as {name:string;description:string;settings:Settings}[];
export default function App(){
 const stageSession=useStageSession();
 const [archiveActive,setArchiveActive]=useState(false);
 const [projectionActive,setProjectionActive]=useState(false);
 const [footprintsActive,setFootprintsActive]=useState(defaultFootprintsWorkspace);
 const [footprintsOperator,setFootprintsOperator]=useState(false);
 const [softwareBlackout,setSoftwareBlackout]=useState(false);
 const [stageNavigation,setStageNavigation]=useState<StageNavigationRequest|null>(null);
 const [selectedStageTool,setSelectedStageTool]=useState<StageNavigationTool>('tracking');
 const [simulatorOpen,setSimulatorOpen]=useState(false);
 const experimentPuppetRef=useRef<DirectPuppetSession|null>(null);
 if(!experimentPuppetRef.current)experimentPuppetRef.current=new DirectPuppetSession(defaultFloorSpace(8,6));
 const [experimentPuppetRevision,setExperimentPuppetRevision]=useState(0);
 const [simulatorApproval,setSimulatorApproval]=useState<string|null>(null);
 const [simulatorTestPattern,setSimulatorTestPattern]=useState(false);
 const [simulatorQaTransport,setSimulatorQaTransport]=useState<'live'|'hold'|'blackout'|null>(null);
 const [liveFloorOpen,setLiveFloorOpen]=useState(false);
 const [liveFloorApproval,setLiveFloorApproval]=useState<string|null>(null);
 const [liveFloorTestPattern,setLiveFloorTestPattern]=useState(false);
 const [liveFloorCount,setLiveFloorCount]=useState<1|2>(1);
 const [liveFloorGhosts,setLiveFloorGhosts]=useState(false);
 const [liveFloorRevision,setLiveFloorRevision]=useState(0);
 const [captureOpen,setCaptureOpen]=useState(false),[captureTab,setCaptureTab]=useState<CaptureTab>('photo');
 const [advancedOpen,setAdvancedOpen]=useState(false),[,setBodyPromptDismissed]=useState(false);
 const [inspectorOpen,setInspectorOpen]=useState(()=>typeof window==='undefined'||window.innerWidth>=1360);
 const [footprintRecording,setFootprintRecording]=useState(false);
 const [footprintConfig,setFootprintConfig]=useState<FootprintConfig>(()=>{try{const v=JSON.parse(localStorage.getItem('soma-footprint-visual-v1')||'null');const d=footprintDefaults();return v&&typeof v==='object'?{...d,...v,hold:false,colors:{...d.colors,...v.colors}}:d;}catch{return footprintDefaults();}});
 const footprintRef=useRef<FootprintsHandle|null>(null),footprintCanvasRef=useRef<HTMLCanvasElement|null>(null);
 const simulatorArtworkRef=useRef<HTMLCanvasElement|null>(null);
 const liveFloorArtworkRef=useRef<HTMLCanvasElement|null>(null);
 const liveFloorEngine=useRef(new LiveFloorTrackingEngine()).current;
 const multiPoseRouter=useRef(new MultiPoseGaitRouter(liveFloorEngine)).current;
 const updateFootprint=(patch:Partial<FootprintConfig>)=>setFootprintConfig(c=>({...c,...patch}));
 useEffect(()=>{try{localStorage.setItem('soma-footprint-visual-v1',JSON.stringify({...footprintConfig,hold:false}));}catch{}},[footprintConfig]);
 const [settings,setSettings]=useState<Settings>(()=>{try{const saved=localStorage.getItem('soma-studio-session-v3');return saved?validatePreset(JSON.parse(saved)):defaults();}catch{return defaults();}});
 useEffect(()=>{const timer=setTimeout(()=>{try{localStorage.setItem('soma-studio-session-v3',JSON.stringify({version:2,settings}));}catch{}},300);return()=>clearTimeout(timer);},[settings]);const sr=useRef(settings);sr.current=settings;
 const [source,setSource]=useState<'camera'|'mouse'>(settings.input==='mouse'?'mouse':'camera');const sourceRef=useRef(source);sourceRef.current=source;
 const [cameraOn,setCameraOn]=useState(false),[cameraBusy,setCameraBusy]=useState(false),[status,setStatus]=useState('Kamera belum aktif'),[cameraError,setCameraError]=useState('');
 const [audioOn,setAudioOn]=useState(false),[muted,setMuted]=useState(false),[frame,setFrame]=useState(emptyFrame),[level,setLevel]=useState(0);
 const [tab,setTab]=useState<ControlTab>('visual'),[modal,setModal]=useState<null|'help'|'settings'|'mapping'|'visual-mapping'|'presets'|'sessions'|'save'|'status'|'photos'>(null);
 const [clean,setClean]=useState(false),[notice,setNotice]=useState(''),[presets,setPresets]=useState<Preset[]>([]),[presetName,setPresetName]=useState(''),[activePreset,setActivePreset]=useState('Clean / Serat');
 const [takes,setTakes]=useState<Take[]>([]),[recording,setRecording]=useState(false),[recordSeconds,setRecordSeconds]=useState(0),[playing,setPlaying]=useState<string|null>(null);
 const [logging,setLogging]=useState(false),[logCount,setLogCount]=useState(0),[calibration,setCalibration]=useState<number|null>(null),[deviceId,setDeviceId]=useState(()=>{
  try{return localStorage.getItem('soma-quick-camera-v1')??'';}catch{return '';}
 }),[devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const [mousePinch,setMousePinch]=useState(0),[mouseOpen,setMouseOpen]=useState(true);
 const video=useRef<HTMLVideoElement>(null),stage=useRef<HTMLDivElement>(null),importRef=useRef<HTMLInputElement>(null),playback=useRef<HTMLAudioElement|null>(null);
 const frameRef=useRef<MotionFrame>(emptyFrame()),engine=useRef(new AudioEngine()).current,mapper=useRef(new MappingEngine()).current,tracker=useRef(new CameraTracker()).current,recorder=useRef(new Recorder()).current,motionLog=useRef(new MotionLog()).current;
 const activeCameraMode=useRef<'laptop'|'phone'>('laptop');
 const phoneLandscapeRef=useRef<LandscapePhoneCamera|null>(null);
 const [footprintsChoice,setFootprintsChoice]=useState<FootprintsInputChoice|null>(null);
 const [sourceSwitchBusy,setSourceSwitchBusy]=useState(false);
 const [sourceSwitchError,setSourceSwitchError]=useState('');
 const requestedFootprintsChoice=useRef<FootprintsInputChoice|null>(null);
 const sourceChangeLock=useRef(false);
 const cameraOperation=useRef(0);
 const lastUI=useRef(0),cal=useRef<{end:number;xs:number[];ys:number[]}|null>(null),mouse=useRef({down:false,x:.5,y:.5,prevX:.5,prevY:.5,last:0,speed:0,acceleration:0,pinch:0,open:true,shift:false,keyPinch:false,lastHit:0,armed:true});
 const [controlsOpen,setControlsOpen]=useState(false),[hudVisible,setHudVisible]=useState(true),[isFullscreen,setIsFullscreen]=useState(false),[trackingLatched,setTrackingLatched]=useState(false),[triggerProgress,setTriggerProgress]=useState(0);
 const visualMapper=useRef(new VisualMappingEngine()).current,holdTrigger=useRef(new HoldTrigger()).current;
 const visualParams=useRef<VisualParams>({size:.4,spread:.5,rotation:0,energy:.25,tension:.25,density:.5}),trackingVisible=useRef(true),trackingLatchRef=useRef(false),metrics=useRef({fps:0,particles:0}),hasPlayed=useRef(false),hudTimer=useRef<ReturnType<typeof setTimeout>|null>(null),dockHover=useRef(false),panelOpenRef=useRef(false);
 panelOpenRef.current=controlsOpen;trackingVisible.current=settings.layers.tracking==='detected'||settings.layers.tracking==='trigger'&&trackingLatched;
 const notify=useCallback((message:string)=>setNotice(message),[]);
 const photoArchive=usePhotoArchive({frameRef,settingsRef:sr,videoRef:video,active:!archiveActive,muted,notify});
 const cameraCue=useCameraCue({archive:photoArchive,frameRef,settingsRef:sr,videoRef:video,active:!archiveActive,notify,onOpen:()=>{setModal(null);setControlsOpen(false);setProjectionActive(false);}});
 const projection=useProjection({active:projectionActive,frameRef,videoRef:video,input:settings.input,
  sourceChoice:footprintsChoice,notify,artworkActive:footprintsActive,artworkRef:footprintCanvasRef,
  simulatorActive:simulatorOpen,simulatorApproval,simulatorTestPattern,simulatorQaTransport,simulatorArtworkRef,
   liveFloorActive:liveFloorOpen,liveFloorConfirmed:liveFloorEngine.isConfirmed,
   liveFloorBoundCamera:liveFloorEngine.boundCamera,liveFloorApproval,liveFloorTestPattern,liveFloorArtworkRef});
 const simulatorFloorVerified=simulatorApproval!==null&&simulatorApproval===floorCalibrationSignature(projection.config);
 const liveFloorCameraMatched=liveFloorEngine.isConfirmed&&liveFloorEngine.boundCamera===cameraBindingKey(cameraBinding(video.current));
 const liveFloorVerified=liveFloorCameraMatched&&liveFloorApproval!==null&&liveFloorApproval===floorCalibrationSignature(projection.config);
 void liveFloorRevision;
 useEffect(()=>{tracker.setProjection(projection.running);return()=>tracker.setProjection(false);},[tracker,projection.running]);
 const photoGestureEnabled=useRef(false);photoGestureEnabled.current=photoArchive.enabled||cameraCue.frame.open;
 const update=useCallback((patch:Partial<Settings>)=>{const next={...sr.current,...patch};sr.current=next;setSettings(next);},[]);
 const stopCamera=useCallback(()=>{cameraOperation.current++;activeCameraMode.current='laptop';tracker.stop(video.current??undefined);phoneLandscapeRef.current?.stop();phoneLandscapeRef.current=null;setCameraOn(false);setCameraBusy(false);setStatus('Kamera belum aktif');const f=emptyFrame();f.time=performance.now();frameRef.current=f;setFrame(f);engine.update(mapper.process(f,sr.current),sr.current,false,false);},[tracker,engine,mapper]);
 // Camera recognition belongs to macOS; never assume a USB cable equals video.
 useEffect(()=>{
  const media=navigator.mediaDevices;
  if(!media?.enumerateDevices)return;
  let alive=true,previouslyVisible=false;
  const refresh=async()=>{
   try{
    const found=normalizeCameraDevices(await media.enumerateDevices());
    if(!alive)return;
    setDevices(found);
    const present=!!deviceId&&found.some(x=>x.deviceId===deviceId);
    if(previouslyVisible&&!present&&cameraOn&&!cameraBusy&&
     requestedFootprintsChoice.current==='webcam'&&activeCameraMode.current==='laptop'){
     requestStageBlackout(()=>projection.setTransport('blackout'));
     liveFloorEngine.revoke('Kamera Mac terputus; ulangi kalibrasi Map.');
     multiPoseRouter.reset();setLiveFloorApproval(null);
     stopCamera();setCameraError('Kamera terputus. Sambungkan kembali, lalu periksa Map.');
    }
    previouslyVisible=present;
   }catch{
    // Browser may not expose device metadata before camera permission.
   }
  };
  void refresh();
  media.addEventListener?.('devicechange',refresh);
  return()=>{alive=false;media.removeEventListener?.('devicechange',refresh);};
 },[deviceId,cameraOn,cameraBusy,stopCamera,projection.setTransport,liveFloorEngine,multiPoseRouter]);
 const processFrame=useCallback((f:MotionFrame)=>{
  frameRef.current=f;cameraCue.processFrame(f);const s=sr.current,p=mapper.process(f,s);visualParams.current=visualMapper.process(f,s);engine.update(p,s,f.features.open>.5,f.tracked,f.features.armRaise);
  if(f.tracked)hasPlayed.current=true;
  const hold=holdTrigger.update(!photoGestureEnabled.current&&s.layers.tracking==='trigger'&&s.layers.gestureTrigger&&['hands','mouse'].includes(s.input)&&f.tracked&&f.features.open>.5,f.time);
  if(hold.fired){trackingLatchRef.current=!trackingLatchRef.current;setTrackingLatched(trackingLatchRef.current);trackingVisible.current=trackingLatchRef.current;notify(trackingLatchRef.current?'Garis tracking tampil.':'Garis tracking tersembunyi.');}
  if(f.tracked&&s.output!=='visual')f.events.forEach(e=>{const sound=s.eventMap[e];if(sound!=='off')engine.percussion(sound,Math.max(f.features.speed,p.amplitude),s.maxVoices);});
  motionLog.add(f);
  if(cal.current){if(f.tracked){cal.current.xs.push(f.features.x);cal.current.ys.push(f.features.y);}const left=cal.current.end-performance.now();setCalibration(Math.max(0,Math.ceil(left/1000)));if(left<=0){const c=cal.current;cal.current=null;setCalibration(null);const minX=Math.min(...c.xs),maxX=Math.max(...c.xs),minY=Math.min(...c.ys),maxY=Math.max(...c.ys);if(c.xs.length<20||maxX-minX<.12||maxY-minY<.12)notify('Jangkauan belum cukup. Coba lagi sambil bergerak ke kiri, kanan, atas, dan bawah.');else{update({calibration:{minX,maxX,minY,maxY}});notify('Jangkauan gerak tersimpan.');}}}
  if(f.time-lastUI.current>100){lastUI.current=f.time;setFrame({...f});setTriggerProgress(hold.progress);setLogCount(motionLog.rows.length);if(motionLog.full){setLogging(false);notify('Log mencapai batas 18.000 sampel. Silakan ekspor datanya.');motionLog.full=false;}}
 },[engine,mapper,visualMapper,holdTrigger,motionLog,notify,update,cameraCue.processFrame]);
 async function startCamera(overrideDeviceId?:string){
  const op=++cameraOperation.current;
  requestedFootprintsChoice.current='webcam';setFootprintsChoice('webcam');
  setSourceSwitchError('');
  activeCameraMode.current='laptop';
  if(sr.current.input==='mouse')update({input:'hands',mappings:defaultMappings(sr.current.mode,'hands'),visual:{...sr.current.visual,mappings:defaultVisualMappings('hands')}});mouse.current.down=false;setSource('camera');sourceRef.current='camera';setCameraBusy(true);setCameraOn(true);setCameraError('');
  await tracker.start(video.current!,()=>sr.current,
   frame=>{
    if(op===cameraOperation.current&&requestedFootprintsChoice.current==='webcam')
     processFrame(frame);
   },message=>{
   if(op!==cameraOperation.current)return;
   setStatus(message);if(message.endsWith('siap'))setCameraBusy(false);
  },message=>{
   if(op!==cameraOperation.current)return;
   requestStageBlackout(()=>projection.setTransport('blackout'));
   liveFloorEngine.revoke('Kamera Mac gagal; ulangi kalibrasi Map.');
   multiPoseRouter.reset();setLiveFloorApproval(null);
   setCameraOn(false);setCameraBusy(false);setStatus('Kamera belum siap');
   setCameraError(message);notify(message);
   const f=emptyFrame();f.time=performance.now();processFrame(f);
  },(overrideDeviceId??deviceId)||undefined);
  if(navigator.mediaDevices)try{setDevices(normalizeCameraDevices(await navigator.mediaDevices.enumerateDevices()));}catch{}
 }
 async function startPhoneCamera(stream:MediaStream){
  if(requestedFootprintsChoice.current!=='phone')return;
  if(!stream.active||!stream.getVideoTracks().length){
   notify('HP belum mengirim video. Periksa kabel atau sambungan QR.');return;
  }
  requestStageBlackout(()=>projection.setTransport('blackout'));
  liveFloorEngine.revoke('Sumber kamera HP berubah; kalibrasi harus diulang.');
  multiPoseRouter.reset();setLiveFloorApproval(null);
  stopCamera();
  const op=++cameraOperation.current;
  const next={
   input:'body' as InputKind,
   mappings:defaultMappings(sr.current.mode,'body'),
   visual:{...sr.current.visual,mappings:defaultVisualMappings('body')}
  };
  update(next);clearInputFrame('body');
  activeCameraMode.current='phone';
  setFootprintsChoice('phone');setSourceSwitchError('');
  setSource('camera');sourceRef.current='camera';setCameraBusy(true);
  setCameraOn(false);setCameraError('');
  try{
   // Normalization changes actual video pixels, not just CSS; all pose/Map
   // coordinates and FLOOR/BODY outputs see the same horizontal 16:9 frame.
   const landscape=await createLandscapePhoneCamera(stream,()=>{
    if(op===cameraOperation.current)stopPhoneCamera();
   });
   if(op!==cameraOperation.current||requestedFootprintsChoice.current!=='phone'){
    landscape.stop();return;
   }
   phoneLandscapeRef.current=landscape;
   setCameraOn(true);
   await tracker.start(video.current!,()=>sr.current,
    frame=>{
     if(op===cameraOperation.current&&requestedFootprintsChoice.current==='phone')
      processFrame(frame);
    },
    message=>{if(op!==cameraOperation.current)return;
     setStatus(message);if(message.endsWith('siap'))setCameraBusy(false);},
    message=>{if(op!==cameraOperation.current)return;
     setCameraOn(false);setCameraBusy(false);setCameraError(message);notify(message);},
    undefined,landscape.stream);
   if(!tracker.running)throw Error('Pelacak SOMA gagal memulai kamera HP.');
  }catch(error){
   if(op!==cameraOperation.current)return;
   const message=error instanceof Error?error.message:'Video HP gagal dibuka.';
   stopPhoneCamera();setCameraError(message);notify(message);
   throw error;
  }
 }
 function mirrorPhoneCamera(){
  if(activeCameraMode.current!=='phone'||!phoneLandscapeRef.current)return;
  requestStageBlackout(()=>projection.setTransport('blackout'));
  liveFloorEngine.revoke('Cermin kamera berubah; ulangi kalibrasi Map.');
  multiPoseRouter.reset();setLiveFloorApproval(null);
  const mirrored=phoneLandscapeRef.current.toggleMirror();
  notify(mirrored?'Gambar dicerminkan. Kalibrasi Map perlu diperiksa ulang.':
   'Cermin gambar dimatikan. Kalibrasi Map perlu diperiksa ulang.');
 }
 function rotatePhoneCamera(){
  if(activeCameraMode.current!=='phone'||!phoneLandscapeRef.current)return;
  requestStageBlackout(()=>projection.setTransport('blackout'));
  liveFloorEngine.revoke('Orientasi kamera berubah; ulangi kalibrasi Map.');
  multiPoseRouter.reset();setLiveFloorApproval(null);
  const angle=phoneLandscapeRef.current.rotate90();
  notify(`Gambar HP diputar ${angle}°. Periksa kaki dan kalibrasi ulang Map.`);
 }
 function stopPhoneCamera(){
  if(activeCameraMode.current!=='phone')return;
  requestStageBlackout(()=>projection.setTransport('blackout'));
  liveFloorEngine.revoke('Kamera HP terputus; ulangi kalibrasi.');
  multiPoseRouter.reset();setLiveFloorApproval(null);stopCamera();
  if(requestedFootprintsChoice.current==='phone')
   setSourceSwitchError('Koneksi kamera HP terputus. Buka pairing untuk mencoba lagi.');
 }
 async function enableAudio(){if(sr.current.output==='visual'&&!archiveActive){notify('Pilih keluaran Suara atau Keduanya untuk mengaktifkan audio.');return false;}try{await engine.init();setAudioOn(true);setMuted(false);return true;}catch{notify('Audio belum bisa aktif. Klik Aktifkan audio lagi atau coba browser lain.');return false;}}
 async function toggleAudio(){if(audioOn&&!muted)panic();else await enableAudio();}
 function panic(){engine.mute();setMuted(true);playback.current?.pause();setPlaying(null);notify('Semua suara dihentikan. Klik Lanjutkan audio untuk bermain lagi.');}
 function clearInputFrame(input:InputKind){const f=emptyFrame(input==='mouse'?'mouse':'camera');f.time=performance.now();frameRef.current=f;setFrame(f);engine.update(mapper.process(f,sr.current),sr.current,false,false);hasPlayed.current=false;holdTrigger.reset();trackingLatchRef.current=false;setTrackingLatched(false);setTriggerProgress(0);mapper.reset();visualMapper.reset();}
 async function chooseInput(input:InputKind){
  if(cameraBusy||input===sr.current.input)return;
  if(activeCameraMode.current==='phone'){
   stageSession.patch({source:'laptop'});stopPhoneCamera();
  }
  const wasCamera=cameraOn;mouse.current.down=false;
  update({input,calibration:null,mappings:defaultMappings(sr.current.mode,input),visual:{...sr.current.visual,mappings:defaultVisualMappings(input)}});clearInputFrame(input);
  if(input==='mouse'){stopCamera();setSource('mouse');sourceRef.current='mouse';setStatus('Mouse siap · tahan dan geser');}
  else{setSource('camera');sourceRef.current='camera';if(wasCamera)await startCamera();else setStatus('Kamera belum aktif');}
 }
 async function openBodyCamera(){
  try{
   if(sr.current.input!=='body'){
    const wasCamera=cameraOn;
    await chooseInput('body');
    if(!wasCamera)await startCamera();
   }else if(!cameraOn)await startCamera();
   if(!tracker.running){notify('Kamera belum siap. Periksa izin dan pilih Mulai kamera.');return;}
   cameraCue.open();
  }catch(e){notify('Gagal membuka kamera tubuh: '+(e instanceof Error?e.message:'coba lagi.'));}
 }
 /** V3.1: use the existing CameraTracker; changing devices invalidates
  * floor/projection approval before restarting the capture stream. */
 async function selectFootprintsCameraDevice(nextId:string):Promise<void>{
  if(nextId===deviceId&&cameraOn)return;
  if(footprintRecording&&!window.confirm(
   'Rekaman berjalan. Simpan rekaman dan ganti kamera?'))return;
  requestStageBlackout(()=>projection.setTransport('blackout'));
  if(footprintRecording)footprintRef.current?.toggleVideo();
  liveFloorEngine.revoke('Kamera diganti; periksa dan konfirmasi ulang kalibrasi.');
  multiPoseRouter.reset();setLiveFloorApproval(null);
  const restart=requestedFootprintsChoice.current==='webcam';
  if(restart)stopCamera();
  setDeviceId(nextId);
  try{localStorage.setItem('soma-quick-camera-v1',nextId);}catch{}
  if(restart){
   setCameraError('');
   await startCamera(nextId);
  }
  notify('Kamera dipilih. Profil lantai perlu diverifikasi untuk perangkat ini.');
 }
 /** S6.8.5: Source Switcher is the only operator transaction for camera/experiment changes.
  * All sources share the persistent Stage Workspace; experimental hardware output stays locked. */
 async function switchFootprintsSource(next:FootprintsInputChoice):Promise<boolean>{
  if(sourceChangeLock.current)return false;
  if(preserveCurrentSource({current:requestedFootprintsChoice.current,next,cameraOn,cameraBusy}))return true;
  if(footprintRecording&&!window.confirm(
   'Rekaman Footprints masih berjalan. Simpan rekaman dan ganti sumber?'))return false;
  sourceChangeLock.current=true;setSourceSwitchBusy(true);setSourceSwitchError('');
  try{
   requestStageBlackout(()=>projection.setTransport('blackout'));
   if(footprintRecording)footprintRef.current?.toggleVideo();
   requestedFootprintsChoice.current=next;
   setSimulatorOpen(false);setSimulatorQaTransport(null);
   liveFloorEngine.revoke('Sumber gerak diganti; periksa ulang kalibrasi.');
   multiPoseRouter.reset();setLiveFloorApproval(null);
   updateFootprint({hold:false});
   stopCamera();
   clearInputFrame('body');setCameraError('');
   setFootprintsChoice(next);
   stageSession.patch({source:next==='phone'?'phone':
    next==='simulator'?'simulation':'laptop'});
   if(next==='webcam'){
    if(sr.current.input!=='body')update({
     input:'body',
     mappings:defaultMappings(sr.current.mode,'body'),
     visual:{...sr.current.visual,mappings:defaultVisualMappings('body')}
    });
    void startCamera();
   }
   return true;
  }catch(error){
   const message=error instanceof Error?error.message:String(error);
   setSourceSwitchError('Gagal mengganti sumber: '+message);
   notify('Sumber belum terhubung: '+message);
   return false;
  }finally{
   sourceChangeLock.current=false;setSourceSwitchBusy(false);
  }
 }
 function changeLiveFloorCount(count:1|2){
  if(count===liveFloorCount)return;
  projection.setTransport('blackout');setLiveFloorApproval(null);
  liveFloorEngine.resetSession();multiPoseRouter.setMode(count);setLiveFloorCount(count);
  setLiveFloorRevision(v=>v+1);
 }
 function openLiveFloor(){
  setClean(false);setCaptureOpen(false);setAdvancedOpen(false);setSimulatorOpen(false);
  setSimulatorApproval(null);setSimulatorTestPattern(false);setFootprintsActive(true);
  updateFootprint({gaitAnalysis:true});
  if(sr.current.output==='sound')update({output:'both'});
  projection.setTransport('blackout');setLiveFloorOpen(true);
 }
 function selectScene(scene:SceneId){
  setFootprintsOperator(false);
  if(scene==='footprints'){
   const alreadyActive=footprintsActive;
   setFootprintsActive(true);setBodyPromptDismissed(false);setTab('visual');
   if(sr.current.output==='sound')update({output:'both'});
   if(!alreadyActive)notify(sr.current.input!=='body'||!cameraOn?'Footprints dipilih. Hubungkan kamera Body agar gerak kaki terbaca.':'Footprints aktif. Gerakkan kaki di depan kamera.');
   return;
  }
  if(stoppingVideoRequiresConfirmation(footprintRecording,'footprints',scene)&&!window.confirm('Video Footprints masih direkam. Mengganti scene akan menghentikan video dan mengunduhnya. Lanjutkan?'))return;
  setFootprintsActive(false);setBodyPromptDismissed(false);update(switchLiveMode(sr.current,scene));
 }
 async function acceptFootprintsBody(){
  setBodyPromptDismissed(false);
  try{if(sr.current.input!=='body')await chooseInput('body');if(!tracker.running)await startCamera();if(tracker.running)notify('Body siap. Gerakkan kaki dalam jangkauan kamera.');}
  catch(e){notify('Body belum terhubung: '+(e instanceof Error?e.message:'coba mulai kamera lagi.'));}
 }
 function openFootprintOutput(){projection.setTransport('live');projection.openOutput();}
 function testMode(){setFootprintsActive(false);void chooseInput('mouse');}
 function switchMode(mode:Mode){mouse.current.down=false;mapper.reset();update({mode,mappings:defaultMappings(mode,sr.current.input),eventMap:defaultEvents(mode)});}
 function toggleTracking(){const layer=sr.current.layers;if(layer.tracking==='trigger'){trackingLatchRef.current=!trackingLatchRef.current;setTrackingLatched(trackingLatchRef.current);trackingVisible.current=trackingLatchRef.current;}else update({layers:{...layer,tracking:layer.tracking==='off'?'detected':'off'}});}
 async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('Fullscreen belum tersedia di browser ini. Tampilan Clean tetap bisa dipakai.');}}
 function revealHUD(){setHudVisible(true);if(hudTimer.current)clearTimeout(hudTimer.current);hudTimer.current=setTimeout(()=>{if(!panelOpenRef.current&&!dockHover.current&&!(document.activeElement?.matches(':focus-visible')&&document.activeElement?.closest('.clean-dock,.live-visual-bar')))setHudVisible(false);},3000);}
 useEffect(()=>{if(clean)revealHUD();return()=>{if(hudTimer.current)clearTimeout(hudTimer.current);};},[clean,controlsOpen]);
 useEffect(()=>{const changed=()=>setIsFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
 function startCalibration(){if(!cameraOn&&!mouse.current.down&&source==='camera'){notify('Nyalakan kamera atau pilih mode mouse untuk kalibrasi.');return;}update({calibration:null});cal.current={end:performance.now()+6000,xs:[],ys:[]};setCalibration(6);notify('Selama 6 detik, gerakkan tangan ke seluruh jangkauan yang ingin dimainkan.');}
 async function toggleRecording(){
  if(recorder.active){recorder.stop();setRecording(false);return;}
  if(sr.current.output==='visual'&&!archiveActive){notify('Rekaman menangkap audio. Pilih keluaran Suara atau Keduanya terlebih dahulu.');return;}if(!audioOn||muted){const ok=await enableAudio();if(!ok)return;}
  try{recorder.start(engine.recordDestination!.stream,t=>{setTakes(a=>[t,...a]);setRecording(false);notify('Rekaman siap. Buka Sesi untuk memutar atau mengunduh.');},notify);setRecording(true);setRecordSeconds(0);}catch(e){notify((e as Error).message);}
 }
 function toggleLog(){if(motionLog.enabled){motionLog.enabled=false;setLogging(false);}else{motionLog.start();setLogging(true);setLogCount(0);}}
 function exportPreset(){download(new Blob([JSON.stringify({version:2,name:activePreset,settings:sr.current},null,2)],{type:'application/json'}),'soma-preset.json');}
 function savePreset(){const name=presetName.trim();if(!name){notify('Beri nama preset terlebih dahulu.');return;}const next=[{id:uid(),name,settings:structuredClone(sr.current)},...presets].slice(0,40);try{localStorage.setItem(KEY,JSON.stringify(next));setPresets(next);setActivePreset(name);setModal('presets');setPresetName('');notify('Preset tersimpan di browser ini.');}catch{notify('Penyimpanan browser penuh atau tidak tersedia. Gunakan Ekspor preset.');}}
 async function applyPreset(p:Preset){
  const wasCamera=cameraOn,previousInput=sr.current.input,next=structuredClone(p.settings);mapper.reset();visualMapper.reset();sr.current=next;setSettings(next);setActivePreset(p.name);setModal(null);
  if(previousInput!==next.input){mouse.current.down=false;clearInputFrame(next.input);if(next.input==='mouse'){stopCamera();setSource('mouse');sourceRef.current='mouse';setStatus('Mouse siap · tahan dan geser');}else{setSource('camera');sourceRef.current='camera';if(wasCamera)await startCamera();}}
  notify('Preset dimuat. Sesi tetap berjalan.');
 }
 async function importPreset(file?:File){if(!file)return;try{if(file.size>100000)throw new Error('Ukuran file preset terlalu besar.');const data=JSON.parse(await file.text());const s=validatePreset(data);await applyPreset({id:'import',name:typeof data.name==='string'?data.name.slice(0,40):'Preset impor',settings:s});}catch(e){notify((e as Error).message);}if(importRef.current)importRef.current.value='';}
 function changeMapping(id:string,patch:Partial<Mapping>){update({mappings:sr.current.mappings.map(m=>m.id===id?{...m,...patch}:m)});}
 function playTake(t:Take){if(playing===t.id){playback.current?.pause();setPlaying(null);return;}playback.current?.pause();engine.mute();setMuted(true);const a=new Audio(t.url);a.volume=.6;playback.current=a;a.onended=()=>setPlaying(null);a.play().then(()=>setPlaying(t.id)).catch(()=>notify('Rekaman belum bisa diputar. Unduh audionya untuk membuka di pemutar lain.'));}
 function reset(){stopCamera();mapper.reset();sr.current=defaults();setSettings(sr.current);setActivePreset('Clean / Serat');engine.mute();setMuted(true);cal.current=null;setCalibration(null);setSource('camera');sourceRef.current='camera';clearInputFrame('hands');setModal(null);notify('Instrumen kembali ke pengaturan awal. Preset dan rekaman tetap tersedia.');}
 useEffect(()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(data))setPresets(data.slice(0,40).flatMap(p=>{try{return [{id:String(p.id),name:String(p.name).slice(0,40),settings:validatePreset({version:1,settings:p.settings})}];}catch{return [];}}));}catch{}return()=>{phoneLandscapeRef.current?.stop();tracker.dispose(video.current??undefined);recorder.stop();void engine.dispose();playback.current?.pause();};},[tracker,engine,recorder]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),6500);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>{if(!recording)return;const t=setInterval(()=>setRecordSeconds(s=>s+1),1000);return()=>clearInterval(t);},[recording]);
 useEffect(()=>{mouse.current.pinch=mousePinch;mouse.current.open=mouseOpen;},[mousePinch,mouseOpen]);
 useEffect(()=>{let raf=0,last=0;const tick=(t:number)=>{if(sourceRef.current==='mouse'&&t-last>32){const m=mouse.current,dt=last?Math.min((t-last)/1000,.15):.033;last=t;const f=emptyFrame('mouse');f.time=t;f.tracked=m.down;f.quality=m.down?1:0;f.handCount=m.down?1:0;f.fps=0;
  const speed=clamp(Math.hypot(m.x-m.prevX,m.y-m.prevY)/dt/2.5);m.prevX=m.x;m.prevY=m.y;
  f.features={...f.features,x:m.x,y:m.y,rotation:m.x,open:m.open&&!m.shift?1:0,pinch:m.keyPinch?1:m.pinch,speed,acceleration:clamp(Math.abs(speed-m.speed)/dt/12),stillness:1-clamp(speed*6),lean:m.x,armRaise:m.y,bend:1-m.y,squat:1-m.y,spread:m.x,leftX:1-m.x,leftY:m.y};m.speed=speed;
  const c=sr.current.calibration;if(c){f.features.x=clamp((m.x-c.minX)/(c.maxX-c.minX));f.features.y=clamp((m.y-c.minY)/(c.maxY-c.minY));}
  f.gesture=!m.down?'Tahan & geser untuk bermain':!f.features.open?'Genggam':f.features.pinch>.7?'Jepit jari':'Telapak terbuka';
  if(speed<.3/sr.current.sensitivity)m.armed=true;if(speed>.62/sr.current.sensitivity&&m.armed&&t-m.lastHit>sr.current.cooldown){f.events=[m.x<.5?'kick':'snare'];m.lastHit=t;m.armed=false;}
  processFrame(f);
 }else if(sourceRef.current==='camera'&&!tracker.running&&cal.current&&t>cal.current.end){cal.current=null;setCalibration(null);notify('Kalibrasi terhenti. Nyalakan kamera dan coba lagi.');}raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[processFrame,tracker,notify]);
 useEffect(()=>{const handle=(e:KeyboardEvent)=>{
  if(projectionActive){return;}
  if(archiveActive){if(e.type==='keydown'&&!e.repeat&&!(e.target as HTMLElement).closest('input,select,textarea,button,a,summary,[role=tab],[contenteditable=true]')&&!document.querySelector('dialog[open]')){if(e.code==='KeyC')archive.setClean(v=>!v);if(e.code==='KeyF')void toggleFullscreen();if(e.code==='KeyT')archive.setTrackingOn(v=>!v);}return;}
  if(e.code==='Tab'){revealHUD();return;}
   const target=e.target as HTMLElement,insideControl=!!target.closest('input,select,textarea,button,a,summary,[role=tab],[role=menuitem],[contenteditable=true]');
   if(keyboardIsInControl(target.tagName,target.isContentEditable,insideControl)||e.ctrlKey||e.metaKey||e.altKey)return;
   // Perform owns B/Esc/Space/arrow shortcuts; legacy instrument keys must not steal them.
   if(footprintsActive&&footprintsOperator&&!clean)return;
  mouse.current.shift=e.shiftKey;if(e.code==='KeyP')mouse.current.keyPinch=e.type==='keydown';
  if(e.type==='keydown'&&!e.repeat){if(e.code==='Space'){e.preventDefault();panic();return;}
   if(e.code==='Escape'&&controlsOpen){setControlsOpen(false);return;}if(document.querySelector('dialog[open]'))return;if(e.code==='Escape'&&cameraCue.frame.open){cameraCue.close();return;}
   if(e.code==='KeyC'){setClean(v=>!v);setControlsOpen(false);}if(e.code==='KeyF')void toggleFullscreen();if(e.code==='KeyT')toggleTracking();if(!e.ctrlKey&&!e.metaKey&&!e.altKey){const i=Number(e.key)-1;if(Number.isInteger(i)&&i>=0&&i<LIVE_MODES.length){setFootprintsActive(false);update(switchLiveMode(sr.current,LIVE_MODES[i][0]));revealHUD();}if(e.code==='Digit5'){selectScene('footprints');revealHUD();}if(e.code==='KeyR'){if(footprintsActive)footprintRef.current?.clearView();else {const h={...hydraDefaults(),...sr.current.hydra};update({hydra:{...h,reset:h.reset+1}});}revealHUD();}}if(e.key==='?')setModal('help');}
 };const blur=()=>{mouse.current.down=false;mouse.current.shift=false;mouse.current.keyPinch=false;if(!archiveActive&&!projection.opened){engine.mute();setMuted(true);}};const visibility=()=>{if(document.hidden){blur();if(archiveActive){archive.hold();engine.mute();setMuted(true);}}};document.addEventListener('keydown',handle);document.addEventListener('keyup',handle);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);return()=>{document.removeEventListener('keydown',handle);document.removeEventListener('keyup',handle);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);};});
 function pointer(e:React.PointerEvent<HTMLDivElement>){const r=e.currentTarget.getBoundingClientRect();mouse.current.x=clamp((e.clientX-r.left)/r.width);mouse.current.y=clamp(1-(e.clientY-r.top)/r.height);}
 const current=MODES.find(m=>m.id===settings.mode)!;const sounding=audioOn&&!muted&&level>.002;const hz=engine.params.frequency;const db=level>.0001?`${Math.max(-96,20*Math.log10(level)).toFixed(0)}`:'−∞';

 const statusLabel=frame.tracked?'Gerak terdeteksi':cameraBusy?'Memuat pelacak':source==='mouse'?'Mouse siap':cameraOn?hasPlayed.current?'Tracking hilang':'Menunggu gerak':status==='Kamera belum siap'?'Kamera belum siap':'Kamera belum aktif';
 const selectedPreset=settings.hydra?.preset;
 const currentScene:SceneId=footprintsActive?'footprints':selectedPreset==='echo'||selectedPreset==='cut'||selectedPreset==='body'?selectedPreset:'liquid';
 const archive=useArchive({pointerStart:e=>{pointer(e);mouse.current.down=true;e.currentTarget.setPointerCapture(e.pointerId);},pointerMove:pointer,pointerEnd:()=>{mouse.current.down=false;},active:archiveActive,engine,frameRef,videoRef:video,settings,cameraOn,cameraBusy,cameraStatus:cameraError||status,audioOn,muted,recording,recordSeconds,chooseInput,startCamera,stopCamera,enableAudio,panic,toggleRecording,openSessions:()=>{archive.setClean(false);setModal('sessions');},setMaster:master=>update({master}),exit:()=>{archive.hold();setArchiveActive(false);archive.setClean(false);}});
 return <div className={`app soma-v2 soma-v3 ${archiveActive?'archive-mode':''} ${projectionActive?'projection-mode':''} ${clean&&!archiveActive?'clean-view':''} ${footprintsOperator&&footprintsActive?'soma-operator-mode':''} ${controlsOpen?'controls-open':''} ${hudVisible?'hud-visible':''}`} onPointerMove={()=>{if(clean)revealHUD();}} onTouchStart={()=>{if(clean)revealHUD();}}>
  <div className="workspace">
   {!clean&&<GlobalNav workspace={archiveActive?'archive':projectionActive?'projection':'studio'} scene={currentScene}
    perform={footprintsOperator}
    onFootprints={()=>{requestStageBlackout(()=>projection.setTransport('blackout'));
     setFootprintsOperator(false);setArchiveActive(false);setProjectionActive(false);
     setClean(false);selectScene('footprints');
     setSelectedStageTool('composer');
     setStageNavigation(prev=>({id:(prev?.id??0)+1,tool:'composer'}));}}
    onInstrument={scene=>{requestStageBlackout(()=>projection.setTransport('blackout'));
     setFootprintsOperator(false);setArchiveActive(false);setProjectionActive(false);
     setClean(false);selectScene(scene);setTab('visual');setInspectorOpen(true);}}
    onArchive={()=>{requestStageBlackout(()=>projection.setTransport('blackout'));
     setFootprintsOperator(false);setModal(null);setClean(false);
     setProjectionActive(false);setArchiveActive(true);}}
    onProjection={()=>{requestStageBlackout(()=>projection.setTransport('blackout'));
     setFootprintsOperator(false);setModal(null);setClean(false);cameraCue.close();setProjectionActive(true);}}
    onSoundLab={()=>{
     requestStageBlackout(()=>projection.setTransport('blackout'));
     setArchiveActive(false);setProjectionActive(false);setClean(false);
     setFootprintsOperator(false);selectScene('liquid');
     setTab('sound');setInspectorOpen(true);setControlsOpen(true);
    }}
    onHydraLab={()=>{
     requestStageBlackout(()=>projection.setTransport('blackout'));
     setArchiveActive(false);setProjectionActive(false);setClean(false);
     setFootprintsOperator(false);selectScene('liquid');
     setTab('visual');setInspectorOpen(true);setControlsOpen(true);
    }}
    onCaptureLab={()=>{
     requestStageBlackout(()=>projection.setTransport('blackout'));
     setArchiveActive(false);setProjectionActive(false);setClean(false);
     setFootprintsOperator(false);selectScene('liquid');
     setCaptureTab('photo');setCaptureOpen(true);
    }}
    onStageTool={(tool:StageNavigationTool)=>{
     requestStageBlackout(()=>projection.setTransport('blackout'));
     setFootprintsOperator(false);setArchiveActive(false);setProjectionActive(false);
     setClean(false);selectScene('footprints');setSelectedStageTool(tool);
     setStageNavigation(last=>({id:(last?.id??0)+1,tool}));
    }}
    selectedTool={selectedStageTool}
    sourceSelection={footprintsChoice} sourceBusy={sourceSwitchBusy}
    onSelectSource={choice=>{
     // Route new sources into Track for upload, pairing and pose diagnostics.
     setFootprintsOperator(false);setArchiveActive(false);setProjectionActive(false);
     setClean(false);selectScene('footprints');setSelectedStageTool('tracking');
     setStageNavigation(last=>({id:(last?.id??0)+1,tool:'tracking'}));
     void switchFootprintsSource(choice);
    }}
    sourceLabel={footprintsChoice==='video'?'Video MP4':footprintsChoice==='simulator'?'Simulasi 3D':footprintsChoice==='phone'?'Kamera HP':footprintsChoice==='webcam'?'Kamera lain':'Pilih sumber'}
    trackingLabel={sourceSwitchBusy?'Memuat':cameraOn?'Kamera aktif':footprintsChoice==='video'?'MP4 siap dimuat':footprintsChoice==='simulator'?'Simulasi':'Belum terhubung'}
    outputLabel={footprintsChoice==='video'||footprintsChoice==='simulator'?'Output terkunci':projection.status.connected?'QA diperlukan':'Output terkunci'}
    onPreset={()=>setModal('presets')}
    onPerform={()=>{
     requestStageBlackout(()=>projection.setTransport('blackout'));
     setArchiveActive(false);setProjectionActive(false);setClean(false);
     selectScene('footprints');
     if(!footprintsOperator)setFootprintsOperator(true);
    }} onBlackout={()=>{
     requestStageBlackout(()=>projection.setTransport('blackout'));
     requestSoftwarePreviewBlackout();
     setSoftwareBlackout(true);
     updateFootprint({hold:true});
    }} onHelp={()=>setModal('help')}
    preset={activePreset}/>}
   <main>

    {footprintsActive&&!clean&&<FootprintsStageWorkspace
     navigationRequest={stageNavigation} onActiveToolChange={setSelectedStageTool}
     onNavigateStageWorkspace={workspace=>{
      // Only Stage Studio owns these local destinations; internal tab switches preserve active mapping and projector links.
      if(!footprintsActive||archiveActive||projectionActive)
       requestStageBlackout(()=>projection.setTransport('blackout'));
      setArchiveActive(false);setProjectionActive(false);setClean(false);selectScene('footprints');
      if(workspace==='perform'){setFootprintsOperator(true);return;}
      setFootprintsOperator(false);
      const tool=workspace==='track'?'tracking':workspace==='map'?'mapping':'composer';
      setSelectedStageTool(tool);
      setStageNavigation(last=>({id:(last?.id??0)+1,tool}));
     }}
     frameRef={frameRef} videoRef={video} tracker={liveFloorEngine}
     router={multiPoseRouter} projection={projection} audioAnalyser={audioOn?engine.analyser:null}
     cameraOn={cameraOn} cameraBusy={cameraBusy} cameraError={cameraError}
     bodySelected={settings.input==='body'} legacyApproved={liveFloorVerified}
     phoneActive={activeCameraMode.current==='phone'&&cameraOn&&!cameraBusy}
     sourceStatus={deriveFootprintsInputStatus({
      selection:footprintsChoice,cameraOn,cameraBusy,cameraError,
      phoneActive:activeCameraMode.current==='phone'&&cameraOn&&!cameraBusy,
      switchBusy:sourceSwitchBusy,switchError:sourceSwitchError
     })}
     experimentPuppet={experimentPuppetRef.current} experimentPuppetRevision={experimentPuppetRevision}
     onSwitchSource={switchFootprintsSource}
     cameraDevices={devices} selectedCameraId={deviceId}
     onSelectCameraDevice={selectFootprintsCameraDevice}
     performerCount={liveFloorCount} onPerformerCount={changeLiveFloorCount}
     onStartBody={()=>{void switchFootprintsSource('webcam');}}
     onPhoneStream={startPhoneCamera} onPhoneDisconnect={stopPhoneCamera}
     onRotatePhone={rotatePhoneCamera} onMirrorCamera={mirrorPhoneCamera}
     onEnterOperator={()=>{
      requestStageBlackout(()=>projection.setTransport('blackout'));
      setFootprintsOperator(true);setClean(false);
     }}
     onOpenSimulator={()=>{projection.setTransport('blackout');setLiveFloorOpen(false);
      setClean(false);setCaptureOpen(false);setAdvancedOpen(false);setSimulatorOpen(true);}}
     onOpenLiveFloor={openLiveFloor}
     onOpenProjection={()=>{
      requestStageBlackout(()=>projection.setTransport('blackout'));
      setFootprintsOperator(false);setModal(null);setClean(false);
      cameraCue.close();setProjectionActive(true);
     }}
     operatorMode={footprintsOperator}
     softwareBlackout={softwareBlackout} onResumeSoftwarePreview={()=>setSoftwareBlackout(false)}
     onExitOperator={()=>{
      setFootprintsOperator(false);setSelectedStageTool('composer');
      setStageNavigation(last=>({id:(last?.id??0)+1,tool:'composer'}));
     }}
     onBlackout={()=>requestStageBlackout(()=>projection.setTransport('blackout'))}
     onToggleCamera={()=>{
      if(cameraOn&&settings.input==='body'){
       if(footprintRecording){
        if(!window.confirm('Hentikan kamera sekaligus simpan video Footprints?'))return;
        footprintRef.current?.toggleVideo();
       }
       requestStageBlackout(()=>projection.setTransport('blackout'));
       if(activeCameraMode.current==='phone')stageSession.patch({source:'laptop'});
       liveFloorEngine.revoke('Kamera dihentikan; periksa kalibrasi sebelum melanjutkan.');
       multiPoseRouter.reset();setLiveFloorApproval(null);
       updateFootprint({hold:false});stopCamera();
      }else void acceptFootprintsBody();
     }}
     onRecordVideo={()=>{
      if(footprintRecording||(cameraOn&&settings.input==='body'))
       footprintRef.current?.toggleVideo();
     }}
     onCapture={()=>{setCaptureTab('pattern');setCaptureOpen(true);}}
     videoRecording={footprintRecording}
     canRecordVideo={cameraOn&&settings.input==='body'}
     footprint={footprintConfig} updateFootprint={updateFootprint}/>}
    {footprintsActive&&settings.output==='sound'&&<div className="v3-output-hint" role="status"><span>Visual Footprints disembunyikan karena keluaran hanya Suara.</span><button type="button" onClick={()=>update({output:'both'})}>Tampilkan pola</button></div>}
    <div className={'instrument-grid'+(footprintsActive&&!clean?' v3-hidden-engine':'')}
     aria-hidden={footprintsActive&&!clean}>
     <section className="motion-panel panel"><div className="panel-top"><div className="panel-title"><ScanLine size={14}/> RUANG GERAK <span className="tag">{INPUTS[settings.input].toUpperCase()}</span></div><div className="stage-tools"><button className={settings.layers.camera?'tool active':'tool'} aria-label="Tampilkan gambar kamera" aria-pressed={settings.layers.camera} title="Gambar kamera" onClick={()=>update({layers:{...settings.layers,camera:!settings.layers.camera}})}>{settings.layers.camera?<Eye size={16}/>:<EyeOff size={16}/>}</button><button className={trackingVisible.current?'tool active':'tool'} aria-label="Garis tracking" aria-pressed={trackingVisible.current} title="Garis tracking · T" onClick={toggleTracking}><ScanLine size={16}/></button><button className="tool" onClick={()=>setClean(true)} aria-label="Buka tampilan Clean" title="Clean · C"><Maximize2 size={16}/></button></div></div>
      <div ref={stage} style={{backgroundColor:settings.layers.background}} className={`stage ${source==='mouse'?'mouse-stage':''} ${frame.tracked?'tracked':''}`} tabIndex={source==='mouse'?0:-1} aria-label="Bidang gerak. Dalam mode mouse, tahan dan geser untuk memainkan suara. Gunakan tombol panah saat bidang terfokus untuk memainkan nada." onPointerDown={e=>{if(source!=='mouse'||(e.target as HTMLElement).closest('button'))return;pointer(e);mouse.current.prevX=mouse.current.x;mouse.current.prevY=mouse.current.y;mouse.current.down=true;e.currentTarget.setPointerCapture(e.pointerId);if(!audioOn&&sr.current.output!=='visual')void enableAudio();}} onPointerMove={e=>{if(source==='mouse')pointer(e);}} onPointerUp={()=>{mouse.current.down=false;}} onPointerCancel={()=>{mouse.current.down=false;}} onKeyDown={e=>{if(source!=='mouse'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();mouse.current.down=true;mouse.current.x=clamp(mouse.current.x+(e.key==='ArrowRight'?.025:e.key==='ArrowLeft'?-.025:0));mouse.current.y=clamp(mouse.current.y+(e.key==='ArrowUp'?.025:e.key==='ArrowDown'?-.025:0));if(!audioOn&&sr.current.output!=='visual')void enableAudio();}} onKeyUp={e=>{if(e.key.startsWith('Arrow'))mouse.current.down=false;}}>
       <video ref={video} autoPlay playsInline muted className={`${cameraOn&&settings.layers.camera?'visible':''} ${settings.mirror?'mirrored':''}`}/><div className="stage-grid"/><div className="stage-corner tl"/><div className="stage-corner tr"/><div className="stage-corner bl"/><div className="stage-corner br"/>
       <div className="stage-topline"><span className={`camera-badge ${cameraOn||source==='mouse'?'live':''}`}><i/>{footprintsActive?'FOOTPRINTS · BODY':source==='mouse'?'MOUSE INPUT':cameraBusy?'LOADING':cameraOn?'CAMERA LIVE':'CAMERA OFF'}</span><span className="coordinate-label">X / Y / Z</span></div>
       {!cameraOn&&!frame.tracked&&!hasPlayed.current&&!(footprintsActive&&(footprintRef.current?.count()??0)>0)&&<div className="empty-stage"><IdleArt/><h2>{source==='mouse'?'Mulai dengan satu gerakan.':settings.input==='face'?'Hadapkan wajahmu.':settings.input==='body'?'Masuk ke dalam bingkai.':'Angkat tanganmu.'}</h2><p>{source==='mouse'?'Tahan dan geser. Bunyi dan garis akan mengikuti.':settings.input==='face'?'Buka mulut dan miringkan kepala di depan kamera.':settings.input==='body'?'Tampilkan bahu dan pinggul di dalam bingkai.':'Buka telapak di depan kamera, lalu gerakkan perlahan.'}</p>{source==='camera'&&<div className="empty-actions"><button className="primary-button" onClick={()=>void startCamera()}><Camera size={16}/> Mulai kamera</button><button className="text-button" onClick={testMode}>Coba dengan mouse <ArrowUpRight size={15}/></button></div>}{source==='mouse'&&<span className="mouse-helper">ATAS · NADA NAIK <span/> KANAN · VOLUME NAIK</span>}</div>}
       {cameraOn&&!frame.tracked&&<div className="tracking-prompt"><span className={cameraBusy?'loader':'tracking-cross'}>{!cameraBusy&&<Hand size={26}/>}</span><p>{cameraBusy?status:settings.input==='body'?'Mundur hingga tubuh masuk bingkai.':settings.input==='face'?'Hadapkan wajah ke kamera.':'Tunjukkan telapak tangan ke kamera.'}</p></div>}
       {!footprintsActive&&<VisualStage frameRef={frameRef} settingsRef={sr} paramsRef={visualParams} videoRef={video} trackingRef={trackingVisible} metricsRef={metrics}/>}
       <StudioFootprints ref={footprintRef} active={footprintsActive} forceGaitForLiveFloor={footprintsActive} frameRef={frameRef} videoRef={video} settingsRef={sr} trackingRef={trackingVisible} canvasRef={footprintCanvasRef} config={footprintConfig} onNotice={notify} onRecording={setFootprintRecording} audioStream={audioOn&&!muted?engine.recordDestination?.stream:null}
         onGaitSample={(mark,side,aspect)=>{if(!footprintsActive||liveFloorCount!==1)return;
          const emitted=liveFloorEngine.ingest(mark,side,aspect,cameraBinding(video.current),
           'performer-1',frameRef.current.telemetry?.capturedAt??null);
          multiPoseRouter.acceptSingle(mark,side,emitted);}}
         onPoseFrame={(f,clock,aspect)=>{if(!footprintsActive||liveFloorCount!==2)return;
          multiPoseRouter.observe(f,clock,aspect,cameraBinding(video.current));}}/>
       <PhotoWall archive={photoArchive} clean={clean}/>
       <CameraFrame cue={cameraCue}/>
       {(cameraCue.listening||cameraCue.voice.status==='error')&&<button className={`camera-voice-indicator ${cameraCue.voice.status}`} onClick={()=>setModal('photos')} aria-label={cameraCue.voice.message}>{cameraCue.voice.status==='listening'?'● MIC · “kamera”':cameraCue.voice.status==='error'?'MIC · periksa suara':'MIC · menyambungkan…'}</button>}
       {photoArchive.enabled&&<div className="photo-gesture-status">{photoArchive.message}{photoArchive.progress>0&&<progress value={photoArchive.progress} max={1} aria-label="Tahan telapak untuk potret"/>}</div>}
       {frame.tracked&&<div className="gesture-pill"><i/>{frame.gesture}<span>{source==='mouse'?'SIMULASI':`${frame.handCount?frame.handCount+' TANGAN':settings.input==='face'?'1 WAJAH':'1 TUBUH'}`}</span></div>}
       {cameraOn&&frame.tracked&&!frame.framing&&<div className="framing-warning">Mundur sedikit. Beberapa sendi keluar bingkai.</div>}
       {calibration!==null&&<div className="calibration-overlay"><b>{calibration}</b><span>Jangkau kiri, kanan, atas, dan bawah.</span></div>}
       <div className="stage-axis axis-y">PITCH <ArrowRight size={11}/></div><div className="stage-axis axis-x">VOLUME <ArrowRight size={11}/></div><span className="stage-footnote">{source==='mouse'?'SIMULASI / INPUT MANUAL':cameraOn?'VIDEO TETAP DI PERANGKAT INI':'640 × 480 / WEBCAM'}</span>
      </div>
      <StudioTransport input={settings.input} onSource={input=>{
       if(input!==settings.input&&footprintRecording&&input!=='body'){
        if(!window.confirm('Rekaman video Footprints sedang berjalan. Mengganti sumber akan menghentikan video dan mengunduhnya. Lanjutkan?'))return;
        footprintRef.current?.toggleVideo();
       }
       if(input!=='body'&&footprintsActive)setBodyPromptDismissed(false);
       void chooseInput(input);
      }}
       cameraOn={cameraOn} cameraBusy={cameraBusy} cameraError={cameraError} tracking={frame.tracked} hadTracking={hasPlayed.current} status={statusLabel}
       onCamera={()=>{
       if(cameraOn){
        if(footprintRecording){
         if(!window.confirm('Hentikan kamera sekaligus simpan video Footprints?'))return;
         footprintRef.current?.toggleVideo();
        }
        stopCamera();
       }else void startCamera();
      }} output={settings.output}
      onOutputChange={output=>{
       if(footprintsActive&&output==='sound'&&footprintRecording){
        if(!window.confirm('Keluaran Suara saja akan menghentikan rekaman video Footprints dan mengunduhnya. Lanjutkan?'))return;
        footprintRef.current?.toggleVideo();
       }
       update({output});
       if(footprintsActive&&output==='sound')notify('Hanya Suara aktif. Pola disembunyikan. Pilih Keduanya untuk melihat Footprints.');
      }}
       audioOn={audioOn} muted={muted} onAudio={()=>void toggleAudio()} soundMode={settings.mode} onSoundMode={switchMode}
       audioRecording={recording} videoRecording={footprintRecording} onRecordAudio={()=>void toggleRecording()}
       onRecordVideo={()=>footprintRef.current?.toggleVideo()} videoAvailable={footprintsActive&&cameraOn&&settings.input==='body'}
       onCapture={()=>{setCaptureTab(footprintsActive?'pattern':'photo');setCaptureOpen(true);}}
       hold={footprintsActive?footprintConfig.hold:!!settings.hydra?.hold}
       onHold={()=>{if(footprintsActive)updateFootprint({hold:!footprintConfig.hold});else update({hydra:{...hydraDefaults(),...sr.current.hydra,hold:!(sr.current.hydra?.hold??false)}});}}
       onAdvanced={()=>setInspectorOpen(v=>!v)} onStatusClick={()=>setModal('status')}
       projectorOpen={projection.opened} projectorConnected={projection.status.connected} projectorMode={projection.transport}
       onProjectorOpen={()=>{projection.setTransport('live');projection.openOutput();}}
       onProjectorLive={()=>projection.setTransport('live')} onProjectorHold={()=>projection.setTransport('hold')}
       onProjectorBlackout={()=>projection.setTransport('blackout')}
       onProjectionSettings={()=>{setClean(false);setProjectionActive(true);}}/>
     </section>
     {inspectorOpen&&<button type="button" className="v3-inspector-backdrop" aria-label="Tutup pengaturan visual" onClick={()=>setInspectorOpen(false)}/>}
     <aside className={'sound-panel panel controls-panel '+(inspectorOpen?'v3-inspector-open':'v3-inspector-closed')} aria-label="Atur scene">
      <SceneInspector scene={currentScene} settings={settings} update={update} footprint={footprintConfig} updateFootprint={updateFootprint} onAdvanced={()=>setAdvancedOpen(true)} onClose={()=>setInspectorOpen(false)} onOpenSimulator={()=>{projection.setTransport('blackout');setLiveFloorOpen(false);setClean(false);setSimulatorOpen(true);}} onOpenLiveFloor={openLiveFloor}/>
     </aside>
    </div>
    <footer className="footer"><span><ShieldCheck size={13}/> Kamera diproses di perangkatmu. Video tidak diunggah.</span><span><a href="https://hydra.ojack.xyz/" target="_blank" rel="noreferrer">HYDRA</a> · <a href={import.meta.env.BASE_URL+"HYDRA-LICENSE.txt"} target="_blank">AGPL-3.0</a> · <a href="https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/archive/refs/heads/main.zip" download>KODE SUMBER</a></span></footer>
   </main>
  </div>
  {clean&&<><div className="clean-status"><button onClick={()=>setModal('status')}><span className={`status-dot ${frame.tracked?'live':''}`}/>{statusLabel}<ChevronRight size={12}/></button>{(recording||footprintRecording)&&<span className="clean-rec"><i/>{footprintRecording?'REC VIDEO':clock(recordSeconds)+' REC AUDIO'}</span>}</div><div className="clean-label"><span>SOMA</span><small>{INPUTS[settings.input]} / {footprintsActive?'Footprints':settings.output==='sound'?CHARACTERS[settings.character].label:(settings.hydra?.enabled??true)?'Hydra':VISUALS[settings.visual.style].label}</small></div><div className={`clean-dock ${hudVisible||controlsOpen?'shown':''}`} onPointerEnter={()=>{dockHover.current=true;setHudVisible(true);}} onPointerLeave={()=>{dockHover.current=false;revealHUD();}} onFocus={revealHUD} onBlur={revealHUD}><button aria-label="Kembali ke Studio" onClick={()=>{setClean(false);setControlsOpen(false);}}><Monitor size={17}/><span>Studio</span><kbd>C</kbd></button><i className="dock-divider"/><button aria-label="Tracking" className={trackingVisible.current?'selected':''} aria-pressed={trackingVisible.current} onClick={toggleTracking}><ScanLine size={17}/><span>Tracking</span></button><button aria-label={footprintsActive?'Tampilkan atau sembunyikan Footprints':'Visual generatif'} className={(footprintsActive?settings.output!=='sound':settings.visual.enabled)?'selected':''} aria-pressed={footprintsActive?settings.output!=='sound':settings.visual.enabled} onClick={()=>footprintsActive?update({output:settings.output==='sound'?'both':'sound'}):update({visual:{...settings.visual,enabled:!settings.visual.enabled}})}><Sparkles size={17}/><span>{footprintsActive?'Pola kaki':'Visual'}</span></button><button aria-label={footprintsActive?(footprintRecording?'Stop video Footprints':'Rekam video Footprints'):(recording?'Stop rekam audio':'Rekam audio')} disabled={footprintsActive&&(!cameraOn||settings.input!=='body')&&!footprintRecording} title={footprintsActive&&(!cameraOn||settings.input!=='body')?'Aktifkan kamera Body untuk merekam video':undefined} onClick={()=>footprintsActive?footprintRef.current?.toggleVideo():void toggleRecording()} className={(footprintsActive?footprintRecording:recording)?'recording':''}>{(footprintsActive?footprintRecording:recording)?<Square size={15}/>:<Circle size={15}/>}<span>{(footprintsActive?footprintRecording:recording)?'Stop':'Rekam'}</span></button><i className="dock-divider"/><button aria-label="Pengaturan" aria-expanded={controlsOpen} onClick={()=>{setControlsOpen(v=>!v);revealHUD();}} className={controlsOpen?'selected':''}>{controlsOpen?<PanelRightClose size={17}/>:<PanelRightOpen size={17}/>}<span>Pengaturan</span></button><button onClick={()=>void toggleFullscreen()} aria-label={isFullscreen?'Keluar fullscreen':'Fullscreen'}>{isFullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button><button aria-label={audioOn&&!muted?'Mute audio':'Aktifkan audio'} className="dock-mute" onClick={()=>audioOn&&!muted?panic():void enableAudio()}><VolumeX size={17}/><span>{audioOn&&!muted?'Mute':'Audio'}</span></button></div>{triggerProgress>0&&<div className="trigger-progress"><span>Tahan telapak</span><progress value={triggerProgress} max={1}/></div>}</>}
  {notice&&<div className="toast" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Tutup pemberitahuan"><X size={16}/></button></div>}
  <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e=>void importPreset(e.target.files?.[0])}/>
  {liveFloorOpen&&<LiveFloorWorkspace tracker={liveFloorEngine} router={multiPoseRouter}
    performerCount={liveFloorCount} showPredictions={liveFloorGhosts}
    onShowPredictions={setLiveFloorGhosts}
    onPerformerCount={changeLiveFloorCount}
    onResetIdentity={()=>{
     projection.setTransport('blackout');setLiveFloorApproval(null);
     liveFloorEngine.resetSession();multiPoseRouter.reset();setLiveFloorRevision(v=>v+1);
    }}
    videoRef={video} frameRef={frameRef}
   projectorArtworkRef={liveFloorArtworkRef} projection={projection} cameraOn={cameraOn} cameraBusy={cameraBusy}
   onStartBody={()=>void acceptFootprintsBody()}
   projectorVerified={liveFloorVerified} testPattern={liveFloorTestPattern}
   onCalibrationDirty={()=>{liveFloorEngine.revoke('Periksa ulang empat titik kamera.');multiPoseRouter.reset();setLiveFloorApproval(null);
    projection.setTransport('blackout');setLiveFloorRevision(v=>v+1);}}
   onCameraConfirmed={()=>{projection.setTransport('blackout');multiPoseRouter.reset();setLiveFloorApproval(null);setLiveFloorRevision(v=>v+1);}}
   onProjectorVerify={value=>{
    projection.setTransport('blackout');setLiveFloorTestPattern(false);
    if(value&&liveFloorCameraMatched)setLiveFloorApproval(floorCalibrationSignature(projection.config));
    else setLiveFloorApproval(null);
   }}
   onTestPattern={value=>{projection.setTransport('blackout');setLiveFloorApproval(null);setLiveFloorTestPattern(value);}}
   onOpenOutput={()=>{projection.setTransport('blackout');projection.openOutput();}}
   onCalibrateProjector={()=>{projection.setTransport('blackout');setLiveFloorApproval(null);setLiveFloorTestPattern(false);
    setLiveFloorOpen(false);setProjectionActive(true);
    notify('Projection → Kalibrasi: cocokkan empat sudut lantai fisik, terapkan, lalu kembali ke Live Floor.');
   }}
   onLive={()=>{if(!liveFloorVerified&&!liveFloorTestPattern)return;projection.setPattern(false);projection.setTransport('live');}}
   onHold={()=>{if(liveFloorVerified||liveFloorTestPattern)projection.setTransport('hold');}}
   onBlackout={()=>projection.setTransport('blackout')}
   onClose={()=>{projection.setTransport('blackout');multiPoseRouter.reset();setLiveFloorApproval(null);setLiveFloorTestPattern(false);setLiveFloorOpen(false);}}/>}
  {simulatorOpen&&<PuppetSimulator projection={projection} projectorArtworkRef={simulatorArtworkRef}
    sharedSession={footprintsChoice==='simulator'?experimentPuppetRef.current:undefined}
    onSessionChange={()=>setExperimentPuppetRevision(value=>value+1)}
    experimentLocked={footprintsChoice==='simulator'}
    onQATransportChange={value=>setSimulatorQaTransport(footprintsChoice==='simulator'?null:value)}
    verified={simulatorFloorVerified} testPattern={simulatorTestPattern}
    onVerify={value=>{
     projection.setTransport('blackout');
     setSimulatorTestPattern(false);
     if(value)setSimulatorApproval(floorCalibrationSignature(projection.config));
     else setSimulatorApproval(null);
    }}
    onTestPattern={value=>{
     projection.setTransport('blackout');
     setSimulatorApproval(null);
     setSimulatorTestPattern(value);
    }}
    onOpenOutput={()=>{projection.setTransport('blackout');projection.openOutput();}}
    onCalibrate={()=>{projection.setTransport('blackout');setSimulatorApproval(null);setSimulatorTestPattern(false);setSimulatorQaTransport(null);setSimulatorOpen(false);
     setClean(false);setProjectionActive(true);
     notify('Projection → Kalibrasi: tandai empat sudut lantai, terapkan, lalu kembali ke Footprints.');
    }}
    onLive={()=>{if(!simulatorFloorVerified&&!simulatorTestPattern)return;projection.setPattern(false);projection.setTransport('live');}}
    onHold={()=>{if(simulatorFloorVerified||simulatorTestPattern)projection.setTransport('hold');}}
    onBlackout={()=>projection.setTransport('blackout')}
    onClose={()=>{projection.setTransport('blackout');setSimulatorApproval(null);setSimulatorTestPattern(false);setSimulatorQaTransport(null);setSimulatorOpen(false);}}/>}
  {captureOpen&&<CaptureHub onClose={()=>setCaptureOpen(false)} initialTab={captureTab}
    archive={photoArchive} cue={cameraCue} videoRef={video} cameraBusy={cameraBusy}
    onCamera={()=>void startCamera()} onOpenBody={()=>{setCaptureOpen(false);void openBodyCamera();}}
    takes={takes} playing={playing} onPlay={playTake}
    onRecordAudio={()=>void toggleRecording()} audioRecording={recording}
    onRecordVideo={()=>footprintRef.current?.toggleVideo()} videoRecording={footprintRecording}
    patternAvailable={footprintsActive} videoAvailable={footprintsActive&&cameraOn&&settings.input==='body'}
    getPatternCount={()=>footprintRef.current?.count()??0}
    onPNG={()=>void footprintRef.current?.exportPNG()} onSVG={()=>footprintRef.current?.exportSVG()}
    onJSON={()=>footprintRef.current?.exportJSON()} onImportJSON={file=>{selectScene('footprints');void footprintRef.current?.importJSON(file);}}
    onClearView={()=>footprintRef.current?.clearView()}
    onNewSession={()=>{if(window.confirm('Mulai sesi baru? Sampel Footprints sementara akan dihapus. Simpan pola sebelum melanjutkan.'))footprintRef.current?.newSession();}}/>}
  {advancedOpen&&<Modal title="Pengaturan lanjutan SOMA" onClose={()=>setAdvancedOpen(false)} wide>
   <div className="v3-advanced"><StudioControls footprintsActive={footprintsActive} footprintControls={<FootprintsPanel config={footprintConfig} update={updateFootprint} onOpenOutput={openFootprintOutput} onOpenCalibration={()=>{setClean(false);setProjectionActive(true);}} onCapture={()=>void footprintRef.current?.exportPNG()} onClear={()=>footprintRef.current?.clearView()} onNewSession={()=>{if(window.confirm('Mulai sesi baru dan hapus pola sebelumnya?'))footprintRef.current?.newSession();}} onExportSVG={()=>footprintRef.current?.exportSVG()} onExportJSON={()=>footprintRef.current?.exportJSON()} onImportJSON={file=>void footprintRef.current?.importJSON(file)} onRecord={()=>footprintRef.current?.toggleVideo()} isRecording={footprintRecording}/>} photoControls={<button className="outline-button photo-launcher" onClick={()=>setModal('photos')}><Camera size={15}/>Arsip foto<span>{photoArchive.photos.filter(Boolean).length}/4</span></button>} settings={settings} update={update} tab={tab} setTab={setTab} openModal={key=>{setAdvancedOpen(false);setModal(key);}} audioOn={audioOn} muted={muted} toggleAudio={()=>void toggleAudio()} clean={clean} onClose={()=>setControlsOpen(false)} trackingLatched={trackingLatched} toggleTracking={toggleTracking}/></div>
  </Modal>}
  {modal==='help'&&<Modal title="Satu gerak. Dua keluaran." onClose={()=>setModal(null)}><div className="help-steps"><div><b>01</b><section><h3>Pilih sumber gerak</h3><p>Hands untuk telapak dan jari, Body untuk sendi tubuh, Face untuk mulut dan arah kepala. Mouse memberi input simulasi melalui tahan dan geser.</p></section></div><div><b>02</b><section><h3>Aktifkan keluaran</h3><p>Klik Aktifkan audio, lalu mulai kamera. Pilih Suara, Visual, atau Keduanya. Naikkan tangan untuk menaikkan nada. Mute tetap membiarkan visual berjalan.</p></section></div><div><b>03</b><section><h3>Buka ruang performa</h3><p>Clean menyembunyikan panel. Gerakkan pointer atau sentuh layar untuk membuka bilah kontrol. Pengaturan dapat dibuka di atas kanvas selama sesi berjalan.</p></section></div></div><div className="shortcut-grid"><span><kbd>C</kbd> Studio / Clean</span><span><kbd>F</kbd> Fullscreen</span><span><kbd>T</kbd> Garis tracking</span><span><kbd>Space</kbd> Mute</span><span><kbd>Shift</kbd> Mouse: genggam</span><span><kbd>P</kbd> Mouse: jepit</span><span><kbd>1–4</kbd> Ganti visual langsung</span><span><kbd>R</kbd> Bersihkan jejak</span></div><h3>Hydra: gambar menjadi instrumen</h3><p>Tab Visual membuka empat campuran Hydra. Edit teks, unggah foto, lalu aktifkan sumber Kamera atau Siluet. Kecepatan menambah distorsi, jepitan mengubah campuran foto, dan jarak tangan mengatur pengulangan. Pilih Menumpuk untuk menyimpan sapuan tangan. Tombol 1–4 mengganti mode langsung; R membersihkan jejak dan feedback. Rangka tetap mengikuti titik yang terdeteksi di atas gambar. Editor patch menerima rangkaian fungsi visual Hydra dan kontrol motion.</p><h3>Huruf dan jejak hidup</h3><p>Pilih Huruf elastis, Huruf pecah, Arus huruf, atau Foto dalam kata dari bilah langsung. Gerak kata lama tetap tersedia. Pulihkan teks menyusun huruf kembali; Tahan jejak membekukan goresan dan gema tanpa menghentikan sesi. Panel Visual mengatur warna menurut kecepatan, tangan, atau umur jejak, serta durasi peralihan mode.</p><h3>Kamera, garis, dan visual</h3><p>Atur setiap lapisan melalui tab Lapisan. Menyembunyikan gambar kamera tetap mempertahankan deteksi. Mode Pemicu dapat memakai tahan telapak 1,2 detik; lepaskan sebelum memicu lagi.</p><h3>Potret lewat gestur</h3><p>Buka Arsip foto, aktifkan kamera Hands, lalu Aktifkan suara “kamera”. Ucapkan kamera untuk membuka kotak di tengah. Jauhkan dua telapak untuk memperbesar; dekatkan untuk memperkecil. Kepalkan satu tangan, tahan sebentar, lalu pukul pendek ke bawah untuk menjepret. Foto masuk ke arsip kiri; teks, visual, dan suara terus berjalan. Ucapkan batal atau tekan Escape untuk menutup kotak. Perintah suara dapat memerlukan internet dan layanan pengenal suara browser. Pilihan telapak + jepitan tetap tersedia dalam panel.</p><h3>Preset & rekaman</h3><p>Preset menyimpan sumber, karakter suara, visual, dan pemetaan. Izin kamera serta status rekaman tetap mengikuti sesi. Rekaman menyimpan audio sintesis; unduh dari Sesi sebelum menutup tab.</p><p className="fine-print">Face membaca bentuk dan gerakan wajah. Uji kamera langsung di perangkatmu sebelum memakai SOMA untuk pertunjukan. Video tetap diproses di browser.</p><div className="modal-actions"><a className="outline-button" href={import.meta.env.BASE_URL+"soma-manual.html"} target="_blank" rel="noreferrer">Panduan pengguna lengkap</a><a className="outline-button" href="https://github.com/pangarsagulangsatriya-prog/soma-motion-studio/archive/refs/heads/main.zip" download><Download size={15}/> Kode aplikasi</a><a className="quiet-button" href={import.meta.env.BASE_URL+"SOMA-DESIGN.md"} download>Rancangan v2</a><a className="quiet-button" href={import.meta.env.BASE_URL+"SOMA-README.md"} download>Petunjuk instalasi</a></div></Modal>}
  {modal==='photos'&&<Modal title="Arsip foto · empat bingkai" onClose={()=>setModal(null)}><PhotoPanel cue={cameraCue} archive={photoArchive} cameraBusy={cameraBusy} cameraReady={cameraAvailable(video.current)} onCamera={()=>void startCamera()} onOpenBody={()=>void openBodyCamera()}/></Modal>}
  {modal==='status'&&<Modal title={statusLabel} onClose={()=>setModal(null)}><div className="status-details"><p><b>Sumber</b><span>{INPUTS[settings.input]}{settings.input==='mouse'?' · simulasi':' · kamera'}</span></p><p><b>Kamera</b><span>{cameraBusy?status:cameraOn?'Aktif':cameraError||status}</span></p><p><b>Tracking</b><span>{frame.tracked?frame.gesture:hasPlayed.current?'Terputus. Kembali ke dalam bingkai.':'Menunggu gerak.'}</span></p><p><b>Audio</b><span>{settings.output==='visual'?'Keluaran visual saja':muted?'Mute':audioOn?'Aktif':'Belum aktif'}</span></p><p><b>Visual</b><span>{settings.visual.enabled&&settings.output!=='sound'?(settings.hydra?.enabled??true)?'Hydra':VISUALS[settings.visual.style].label:'Nonaktif'}</span></p><p><b>Laju tampilan</b><span>{metrics.current.fps} FPS</span></p></div><div className="modal-actions"><button className="primary-button" disabled={cameraBusy} onClick={()=>{setModal(null);void startCamera();}}><Camera size={15}/> Mulai kamera</button><button className="outline-button" onClick={()=>{setModal(null);testMode();}}>Coba Mouse</button></div></Modal>}
  {modal==='save'&&<Modal title="Simpan preset." onClose={()=>setModal(null)}><p>Simpan sumber gerak, suara, visual, lapisan, dan pemetaan di browser ini.</p><label className="field">Nama preset<input value={presetName} onChange={e=>setPresetName(e.target.value)} maxLength={40} placeholder="Misalnya: Napas / Tekstur rendah" autoFocus onKeyDown={e=>{if(e.key==='Enter')savePreset();}}/></label><button className="primary-button modal-primary" onClick={savePreset}><Save size={16}/> Simpan preset</button></Modal>}
  {modal==='presets'&&<Modal title="Koleksi preset." onClose={()=>setModal(null)}><div className="section-label">TITIK AWAL</div><div className="preset-list">{STARTERS.map(p=><button key={p.name} onClick={()=>void applyPreset({id:p.name,name:p.name,settings:p.settings})}><AudioLines size={21}/><span><b>{p.name}</b><small>{p.description}</small></span><ArrowUpRight size={17}/></button>)}</div><div className="section-label saved-label">PRESET SAYA <span>{presets.length} TERSIMPAN</span></div>{!presets.length&&<p className="empty-list">Preset yang kamu simpan akan muncul di sini.</p>}{presets.map(p=><div className="saved-preset" key={p.id}><button onClick={()=>void applyPreset(p)}><b>{p.name}</b><span>{MODES.find(m=>m.id===p.settings.mode)?.name}</span></button><button className="tool" aria-label={`Hapus preset ${p.name}`} onClick={()=>{try{const next=presets.filter(a=>a.id!==p.id);localStorage.setItem(KEY,JSON.stringify(next));setPresets(next);}catch{notify('Preset belum bisa dihapus.');}}}><Trash2 size={15}/></button></div>)}<div className="modal-actions"><button className="outline-button" onClick={()=>setModal('save')}><Plus size={15}/> Simpan baru</button><button className="quiet-button" onClick={exportPreset}><Download size={15}/> Ekspor</button><button className="quiet-button" onClick={()=>importRef.current?.click()}><Upload size={15}/> Impor</button></div></Modal>}
  {modal==='sessions'&&<Modal title="Jejak gerak, jejak bunyi." onClose={()=>setModal(null)}><p>Putar kembali sesi latihanmu. Unduh rekaman sebelum menutup atau memuat ulang tab ini.</p><div className="section-label">REKAMAN AUDIO <span>{takes.length} SESI</span></div>{!takes.length&&<div className="empty-recordings"><Radio size={35}/><h3>Belum ada rekaman.</h3><p>Tekan Rekam audio, lalu mainkan instrumen.</p></div>}{takes.map(t=><div className="take" key={t.id}><button className="take-play" aria-label={`${playing===t.id?'Jeda':'Putar'} ${t.name}`} onClick={()=>playTake(t)}>{playing===t.id?<Pause size={17}/>:<Play size={17}/>}</button><div><b>{t.name}</b><span>{clock(t.duration)} · {(t.blob.size/1024).toFixed(0)} KB · {t.mime.includes('mp4')?'M4A':t.mime.includes('ogg')?'OGG':'WEBM'}</span></div><button className="tool" aria-label={`Unduh ${t.name}`} onClick={()=>download(t.blob,`soma-${t.created.replaceAll(':','-')}.${t.mime.includes('mp4')?'m4a':t.mime.includes('ogg')?'ogg':'webm'}`)}><Download size={17}/></button><button className="tool" aria-label={`Hapus ${t.name}`} onClick={()=>{if(playing===t.id){playback.current?.pause();setPlaying(null);}URL.revokeObjectURL(t.url);setTakes(a=>a.filter(x=>x.id!==t.id));}}><Trash2 size={16}/></button></div>)}<div className="motion-log-section"><div className="section-label">DATA GERAK <span>{logCount.toLocaleString('id-ID')} SAMPEL</span></div><p>Log terpisah dari rekaman audio. Data memuat waktu, gestur, dan parameter gerak, hingga 18.000 sampel.</p><div className="modal-actions"><button className={`outline-button ${logging?'chosen':''}`} onClick={toggleLog}><Activity size={15}/>{logging?'Stop log':'Mulai log baru'}</button><button className="quiet-button" disabled={!logCount} onClick={()=>motionLog.export('json')}><Download size={15}/> JSON</button><button className="quiet-button" disabled={!logCount} onClick={()=>motionLog.export('csv')}><Download size={15}/> CSV</button></div></div></Modal>}
  {modal==='settings'&&<Modal title="Atur respons instrumen." onClose={()=>setModal(null)} wide><div className="settings-grid"><section><h3>Suara & envelope</h3><label className="field">Sumber suara<select value={settings.instrument} onChange={e=>update({instrument:e.target.value as Instrument})}>{[['sine','Sine'],['triangle','Triangle'],['sawtooth','Sawtooth'],['square','Square'],['fm','FM synthesis'],['white','White noise'],['pink','Pink noise']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><Range label="Attack" value={settings.attack} min={.005} max={2} step={.005} display={`${settings.attack.toFixed(2)} s`} onChange={v=>update({attack:v})}/><Range label="Decay" value={settings.decay} min={.01} max={2} display={`${settings.decay.toFixed(2)} s`} onChange={v=>update({decay:v})}/><Range label="Sustain" value={settings.sustain} onChange={v=>update({sustain:v})}/><Range label="Release" value={settings.release} min={.03} max={3} display={`${settings.release.toFixed(2)} s`} onChange={v=>update({release:v})}/><Range label="Resonance" value={settings.resonance} min={.1} max={15} step={.1} display={settings.resonance.toFixed(1)} onChange={v=>update({resonance:v})}/><Range label="FM ratio" value={settings.modRate} min={.1} max={8} step={.01} display={`${settings.modRate.toFixed(2)}×`} onChange={v=>update({modRate:v})}/><Range label="FM depth" value={settings.modulation} min={0} max={600} step={1} display={`${settings.modulation} Hz`} onChange={v=>update({modulation:v})}/></section><section><h3>Ruang & tracking</h3><Range label="Sensitivitas gerak" value={settings.sensitivity} min={.3} max={2.5} display={`${settings.sensitivity.toFixed(1)}×`} onChange={v=>update({sensitivity:v})}/><Range label="Smoothing" value={settings.smoothing} max={.5} display={`${Math.round(settings.smoothing*1000)} ms`} onChange={v=>update({smoothing:v})}/><Range label="Reverb dasar" value={settings.macros.space*.85} max={.85} onChange={v=>update({reverb:v,macros:{...settings.macros,space:v/.85}})}/><Range label="Delay feedback" value={settings.delay} max={.65} onChange={v=>update({delay:v})}/><p className="fine-print">Pemetaan aktif mengambil alih parameter yang sama. Nonaktifkan pemetaan reverb untuk memakai nilai dasar ini.</p><Range label="Dead zone gerak" value={settings.deadZone} min={0} max={.05} step={.0005} display={`${(settings.deadZone*100).toFixed(2)}%`} onChange={v=>update({deadZone:v})}/><Range label="Jeda antar perkusi" value={settings.cooldown} min={100} max={1500} step={10} display={`${settings.cooldown} ms`} onChange={v=>update({cooldown:v})}/><Range label="Maksimum voices" value={settings.maxVoices} min={1} max={12} step={1} display={String(settings.maxVoices)} onChange={v=>update({maxVoices:v})}/><label className="field">Kamera<select value={deviceId} onChange={e=>{setDeviceId(e.target.value);stopCamera();}}><option value="">Kamera default</option>{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`Kamera ${i+1}`}</option>)}</select></label><label className="check-field"><input type="checkbox" checked={settings.mirror} onChange={e=>update({mirror:e.target.checked,calibration:null})}/> Cerminkan tampilan kamera</label><label className="check-field"><input type="checkbox" checked={settings.swapHands} onChange={e=>update({swapHands:e.target.checked})}/> Tukar label tangan kiri / kanan</label><div className="modal-actions"><button className="outline-button small" onClick={()=>{setModal(null);startCalibration();}}><ScanLine size={14}/> Kalibrasi jangkauan</button>{settings.calibration&&<button className="quiet-button small" onClick={()=>update({calibration:null})}>Hapus kalibrasi</button>}</div></section></div><div className="settings-bottom"><span>Limiter keluaran aktif. Tracking hilang → suara memudar.</span><button className="quiet-button" onClick={reset}><RotateCcw size={14}/> Reset instrumen</button></div></Modal>}
  {(modal==='mapping'||modal==='visual-mapping')&&<Modal title={modal==='mapping'?'Gerak mengatur bunyi.':'Gerak membentuk gambar.'} onClose={()=>setModal(null)} wide><MappingEditor settings={settings} update={update} kind={modal==='mapping'?'sound':'visual'}/></Modal>}

  <ArchiveWorkspace a={archive}/>
  <ProjectionWorkspace active={projectionActive} p={projection} videoRef={video} frameRef={frameRef} input={settings.input} cameraOn={cameraOn} cameraBusy={cameraBusy} cameraStatus={cameraError||status} deviceId={deviceId} devices={devices} onDevice={id=>{setDeviceId(id);stopCamera();notify('Kamera diganti. Klik Mulai kamera Body dan periksa ulang kalibrasi.');}} onBody={()=>void(async()=>{const wasBody=sr.current.input==='body';await chooseInput('body');if(wasBody||!tracker.running)await startCamera();})()} onStop={stopCamera} onResolution={size=>void tracker.setCaptureSize(size).then(()=>notify('Resolusi kamera diperbarui. Periksa framing dan kalibrasi.')).catch(()=>notify('Kamera tidak menerima resolusi ini. Resolusi aktual mengikuti perangkat.'))} onExit={()=>setProjectionActive(false)} recording={recording} onRecord={()=>void toggleRecording()} onMute={panic}/>

 </div>;
}
