import {useEffect,useRef,useState,type RefObject,type CSSProperties} from 'react';
import {Activity,Camera,Check,Circle,Download,Film,Maximize,Monitor,Network,Play,Plus,RefreshCw,Settings2,Square,Trash2} from 'lucide-react';
import {CameraHubRegistry,hubFrameIsFresh,type HubCameraRecord} from '../v3/CameraHubRegistry.ts';
import {PhoneCameraReceiver} from '../../stage/PhoneCameraReceiver.tsx';
import {VisualRuntime,emptyLog,appendEvent,saveLog,loadLog,validLog,replayUntil,type SessionLog,type VisualEvent} from '../v5/VisualRuntime.ts';
import type {CueId} from '../v5/NodeGraphModel.ts';
import {F3PhotoStore} from '../../f3/F3PhotoStore.ts';
import {F3SessionMachine} from '../../f3/F3SessionMachine.ts';
import {F3FramingController} from '../../f3/F3FramingController.ts';
import {F3MotionFusion} from '../../f3/F3MotionFusion.ts';
import {F3PunchEngine} from '../../f3/F3PunchEngine.ts';
import {drawF3Stage,makeF3StageFrame} from '../../f3/F3StageRenderer.ts';
import {SignalGraph} from './SignalGraph.tsx';
import {ROLES,ROLE_NAMES,CUES,preflight,sourceAssignment,cueUsesSurface,rebaseEvent,validateCue,signalFresh,type Role,type Bindings,type Surface,type Latches,type Signals} from './SignalModel.ts';
import './design-tokens.css';
import './signal-workspace.css';
import {AdaptiveInspector} from '../v53/AdaptiveInspector.tsx';
import {KEY,loadPrefs,captureStep,monitorLabel,type Mode} from '../v53/AdaptiveModel.ts';
import '../v53/adaptive.css';
type Media={url:string;name:string;video:boolean};
const clearLatches=():Latches=>({floor:false,canvas:false});
const black=(c:CanvasRenderingContext2D|null|undefined)=>{if(c){c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.fillStyle='#000';c.fillRect(0,0,c.canvas.width,c.canvas.height);c.restore();}};
const fit=(ctx:CanvasRenderingContext2D,img:HTMLVideoElement|HTMLImageElement,alpha=1)=>{
 const video=img instanceof HTMLVideoElement,w=video?img.videoWidth:img.naturalWidth,h=video?img.videoHeight:img.naturalHeight;
 if(!w||!h||(video&&img.readyState<2))return false;
 const W=ctx.canvas.width,H=ctx.canvas.height,k=Math.min(W/w,H/h);
 try{ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(img,(W-w*k)/2,(H-h*k)/2,w*k,h*k);ctx.restore();return true;}catch{ctx.restore();return false;}
};
const timeText=(ms:number)=>{const s=Math.max(0,Math.floor(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
function FeedThumb({registry,id,allowed}:{registry:CameraHubRegistry;id:string;allowed:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const draw=()=>{const c=ref.current?.getContext('2d');if(!c)return;black(c);if(!allowed||document.hidden)return;const r=ref.current!.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)return;const f=registry.feed(id);if(f&&f.video.readyState>=2&&hubFrameIsFresh(f.frameAt,performance.now(),950))fit(c,f.video);};draw();const t=window.setInterval(draw,150);return()=>clearInterval(t);},[registry,id,allowed]);
 return <><canvas ref={ref} width={240} height={135} aria-label="Preview kamera lokal"/>{!allowed&&<span className="sw-private">Persetujuan diperlukan</span>}</>;
}
function MonitorPanel({name,surface,refCanvas,latched,running,onToggle,onFull,status}:{name:string;surface:Surface;refCanvas:RefObject<HTMLCanvasElement|null>;latched:boolean;running:CueId|null;onToggle:()=>void;onFull:()=>void;status?:string}){
 const active=cueUsesSurface(running,surface);
 return <section className="sw-monitor" data-surface={surface}><header><Monitor size={14}/><b>{name}</b><span className={'sw-monitor-state '+(latched?'blocked':'')}>{status??(latched?'Blackout':active?'Preview':'Standby')}</span><button title={'Fullscreen '+name} aria-label={'Fullscreen '+name} onClick={onFull}><Maximize size={14}/></button><button className={latched?'sw-resume':''} title={latched?'Resume '+name:'Blackout '+name} aria-label={(latched?'Resume ':'Blackout ')+name} aria-pressed={latched} onClick={onToggle}>{latched?'Resume':'Blackout'}</button></header><canvas ref={refCanvas} width={1600} height={900} aria-label={'Preview '+name}/></section>;
}
export function SignalWorkspace({adaptive=false,editor=false}:{adaptive?:boolean;editor?:boolean}={}){
 const [registry]=useState(()=>new CameraHubRegistry());
 const [live]=useState(()=>new VisualRuntime()),[replay]=useState(()=>new VisualRuntime());
 const [photoStore]=useState(()=>new F3PhotoStore()),[machine]=useState(()=>new F3SessionMachine());
 const [framing]=useState(()=>new F3FramingController()),[punch]=useState(()=>new F3PunchEngine()),[fusion]=useState(()=>new F3MotionFusion());
 const [records,setRecords]=useState<HubCameraRecord[]>([]),[devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const [bindings,setBindings]=useState<Bindings>({cam1:'',cam2:'',cam3:''});
 const [next,setNext]=useState<CueId>('F1'),[running,setRunning]=useState<CueId|null>(null);
 const [selected,setSelected]=useState('cam1'),[notice,setNotice]=useState('Hubungkan kamera performer.');
 const [device,setDevice]=useState(''),[adding,setAdding]=useState(false);
 const [recording,setRecording]=useState(false),[saving,setSaving]=useState(false),[count,setCount]=useState(0),[savedCount,setSavedCount]=useState(0),[savedDuration,setSavedDuration]=useState(0);
 const [unsaved,setUnsaved]=useState(false),[consent,setConsent]=useState(false),[verified,setVerified]=useState(false),[armed,setArmed]=useState(false),[photos,setPhotos]=useState(0);
 const [decay,setDecay]=useState(18000),[archive,setArchive]=useState<Media|null>(null),[mediaState,setMediaState]=useState<'idle'|'loading'|'ready'|'error'>('idle');
 const [faults,setFaults]=useState<Latches>(clearLatches);
 const [latches,setLatches]=useState<Latches>(clearLatches),[elapsed,setElapsed]=useState(0),[now,setNow]=useState(0),[signals,setSignals]=useState<Signals>({});
 const [health,setHealth]=useState('Menunggu sumber'),[trackCount,setTrackCount]=useState(0),[markCount,setMarkCount]=useState(0);
 const [reduce,setReduce]=useState(false);
 const [inspectorOpen,setInspectorOpen]=useState(true),[railWidth,setRailWidth]=useState(320);
 const [prefs,setPrefs]=useState(loadPrefs),[panelMode,setPanelMode]=useState<Mode>('closed'),[quick,setQuick]=useState<{x:number;y:number}|null>(null);
 const graphHost=useRef<HTMLElement>(null),openFrom=useRef<HTMLElement|null>(null);
 const [compact,setCompact]=useState(()=>innerWidth<1200);
 useEffect(()=>{const fn=()=>{setCompact(innerWidth<1200);setQuick(null);};window.addEventListener('resize',fn);return()=>window.removeEventListener('resize',fn);},[]);
 useEffect(()=>{if(adaptive)try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}},[adaptive,prefs]);
 const effectiveMode=panelMode==='docked'&&compact?'floating':panelMode;
 const selectNode=(id:string)=>{setSelected(id);setInspectorOpen(true);if(adaptive){if(panelMode==='closed')openFrom.current=document.activeElement as HTMLElement;setPanelMode(prefs.dock&&!compact?'docked':'floating');setQuick(null);}};
 const closePanel=()=>{setPanelMode('closed');setQuick(null);requestAnimationFrame(()=>{if(openFrom.current?.isConnected)openFrom.current.focus();});};
 const toggleDock=()=>{if(compact)return;const dock=effectiveMode!=='docked';setPrefs(p=>({...p,dock}));setPanelMode(dock?'docked':'floating');};
 const openQuick=(id:string,r:DOMRect)=>{if(id!=='foot'){selectNode(id);return;}setSelected(id);const h=graphHost.current?.getBoundingClientRect();if(!h)return;setQuick({x:Math.max(8,Math.min(r.left-h.left,h.width-244)),y:Math.max(8,Math.min(r.bottom-h.top+8,h.height-156))});};
 useEffect(()=>{if(!quick)return;const close=(e:PointerEvent)=>{if(!(e.target as HTMLElement).closest('.adaptive-quick,.sw-node-settings'))setQuick(null);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[quick]);
 const transitionGeneration=useRef(0);
 const photoSignals=useRef(new Set<string>());
 const floor=useRef<HTMLCanvasElement>(null),canvas=useRef<HTMLCanvasElement>(null),archiveVideo=useRef<HTMLVideoElement>(null),archiveImage=useRef<HTMLImageElement>(null);
 const log=useRef<SessionLog>(emptyLog()),saved=useRef<SessionLog>(emptyLog()),unsavedLog=useRef<SessionLog|null>(null);
 const captureGen=useRef(0),alive=useRef(true),recOn=useRef(false),saveBusy=useRef(false),consentRef=useRef(false),verifiedRef=useRef(false),armedRef=useRef(false),addingRef=useRef(false);
 const clock=useRef({start:0,recStart:0,recordOffset:0,replayStart:0,index:0,lastFrame:-1,lastGesture:0,lastGestureTime:-1,serial:0,lastMediaTime:-1});
 const images=useRef(new Map<string,HTMLImageElement>()),delivered=useRef<Signals>({}),seq=useRef(0);
 const state=useRef({bindings,running,latches,decay,archive});state.current={bindings,running,latches,decay,archive};
 const announce=(s:string)=>{if(alive.current)setNotice(s);};
 const deliver=(id:number,at:number,continuous:boolean)=>{delivered.current['edge-'+String(id).padStart(2,'0')]={at,continuous,seq:++seq.current};};
 const fresh=(id:string,t=performance.now())=>{const f=registry.feed(id),r=registry.get(id);return !!f&&r?.phase==='live'&&f.video.readyState>=2&&!f.video.paused&&hubFrameIsFresh(f.frameAt,t,950)&&((f.video.srcObject as MediaStream|null)?.getVideoTracks?.().some(v=>v.readyState==='live')??false);};
 const mediaReady=()=>{const a=state.current.archive;return !!a&&(a.video?!!archiveVideo.current&&archiveVideo.current.readyState>=2&&archiveVideo.current.videoWidth>0:!!archiveImage.current&&archiveImage.current.complete&&archiveImage.current.naturalWidth>0);};
 const readiness=()=>({bindings:state.current.bindings,fresh:{cam1:fresh(state.current.bindings.cam1),cam2:fresh(state.current.bindings.cam2),cam3:fresh(state.current.bindings.cam3)},media:mediaReady(),session:saved.current.events.length>0,photos:photoStore.count,consent:consentRef.current,verified:verifiedRef.current,saving:saveBusy.current,recording:recOn.current});
 const refresh=async()=>{try{const all=await navigator.mediaDevices.enumerateDevices();if(alive.current)setDevices(all.filter(d=>d.kind==='videoinput'&&d.deviceId));}catch(e){announce(String(e));}};
 useEffect(()=>{alive.current=true;let cancelled=false;const unsub=registry.subscribe(()=>setRecords(registry.snapshot()));void refresh();navigator.mediaDevices?.addEventListener('devicechange',refresh);
  void loadLog().then(l=>{if(!cancelled&&alive.current&&!recOn.current&&!saveBusy.current){saved.current=l;setSavedCount(l.events.length);setSavedDuration(l.duration);}}).catch(()=>{if(!cancelled)announce('Penyimpanan lokal belum tersedia.');});
  return()=>{cancelled=true;alive.current=false;unsub();navigator.mediaDevices?.removeEventListener('devicechange',refresh);registry.dispose();fusion.dispose();photoStore.revokeAll();images.current.clear();};
 },[registry,fusion,photoStore]);
 useEffect(()=>()=>{if(archive)URL.revokeObjectURL(archive.url);},[archive]);
 const setBlank=(surface:Surface|'all',value:boolean)=>{
  const old=state.current.latches,updated=surface==='all'?{floor:value,canvas:value}:{...old,[surface]:value};
  state.current.latches=updated;setLatches(updated);setFaults(f=>surface==='all'?{floor:false,canvas:false}:{...f,[surface]:false});
  if(value){const ids=surface==='all'?[17,18]:surface==='floor'?[17]:[18];for(const id of ids)delete delivered.current['edge-'+String(id).padStart(2,'0')];setSignals({...delivered.current});}
  if(value){if(surface!=='canvas')black(floor.current?.getContext('2d'));if(surface!=='floor')black(canvas.current?.getContext('2d'));}
 };
 const latchFault=(surface:Surface|'all',message:string)=>{
  const old=state.current.latches;if(surface==='all'?!old.floor||!old.canvas:!old[surface]){setBlank(surface,true);setFaults(f=>surface==='all'?{floor:true,canvas:true}:{...f,[surface]:true});announce(message);}
 };
 const disarm=()=>{armedRef.current=false;setArmed(false);machine.disarm();punch.reset();captureGen.current++;};
 const resetVerification=()=>{verifiedRef.current=false;setVerified(false);machine.setVerified(false);disarm();};
 const purgePhotos=()=>{disarm();photoStore.revokeAll();images.current.clear();photoSignals.current.clear();setPhotos(0);};
 const changeConsent=(value:boolean)=>{
  consentRef.current=value;setConsent(value);machine.setConsent(value);
  if(!value){resetVerification();purgePhotos();if(state.current.running==='F3A'||state.current.running==='F3B')setBlank('all',true);announce('Persetujuan dicabut. Foto dihapus.');}
 };
 const bind=(role:Role,id:string)=>{
  if(state.current.running){announce('Stop cue sebelum mengubah rute.');return;}
  if(id&&!registry.get(id)){announce('Kamera tidak ditemukan.');return;}
  const old=state.current.bindings;if(old[role]===id)return;
  const result=sourceAssignment(old,role,id);if(!result.ok){announce(result.reason);return;}
  if(old[role]&&id&&!window.confirm('Ganti sumber '+ROLE_NAMES[role]+'?'))return;
  state.current.bindings=result.bindings;setBindings(result.bindings);
  if(role==='cam1')live.resetTracking();
  else{resetVerification();fusion.resetFrames();framing.reset();if(role==='cam2')changeConsent(false);}
  announce(id?ROLE_NAMES[role]+' terhubung ke sumber.':ROLE_NAMES[role]+' belum terhubung.');
 };
 const attachNew=(id:string)=>{
  setSelected(id);const old=state.current.bindings;if(state.current.running||Object.values(old).includes(id))return;
  const role=ROLES.find(r=>!old[r]);if(role){const result=sourceAssignment(old,role,id);if(result.ok){state.current.bindings=result.bindings;setBindings(result.bindings);}}
 };
 const addDevice=async()=>{
  if(addingRef.current)return;addingRef.current=true;setAdding(true);
  try{let chosen=device;
   if(!chosen&&records.length&&devices.length){announce('Pilih perangkat kamera.');return;}
   if(!chosen){const s=await navigator.mediaDevices.getUserMedia({video:true,audio:false});chosen=s.getVideoTracks()[0]?.getSettings().deviceId??'';s.getTracks().forEach(t=>t.stop());if(!alive.current)return;await refresh();}
   if(!alive.current)return;if(!chosen)throw Error('Pilih perangkat kamera.');
   const old=registry.findDevice(chosen),id=old?.id??registry.create(chosen,devices.find(d=>d.deviceId===chosen)?.label||'Kamera '+(records.length+1));attachNew(id);
   if(!old||old.phase!=='live'){announce('Menghubungkan kamera…');await registry.connect(id);}
   if(alive.current)announce(fresh(id)?'Kamera siap.':registry.get(id)?.message||'Periksa sambungan kamera.');
  }catch(e){announce(e instanceof Error?e.message:String(e));}finally{addingRef.current=false;if(alive.current)setAdding(false);}
 };
 const addPhone=()=>{const id=registry.createPhone('Kamera HP '+(records.length+1));attachNew(id);announce('Pasangkan HP melalui QR.');};
 const remove=(id:string)=>{
  if(state.current.running){announce('Stop cue sebelum menghapus sumber.');return;}
  const old=state.current.bindings,updated={...old};for(const r of ROLES)if(updated[r]===id)updated[r]='';
  if(old.cam2===id)changeConsent(false);if(old.cam3===id)resetVerification();
  state.current.bindings=updated;setBindings(updated);registry.remove(id);setSelected('add');announce('Kamera dihapus.');
 };
 const stopRecord=()=>{
  if(!recOn.current)return;
  recOn.current=false;setRecording(false);log.current.duration=Math.max(log.current.duration,performance.now()-clock.current.recStart);
  const snapshot=structuredClone(log.current);
  if(!snapshot.events.length){announce('Belum ada event terekam.');return;}
  saveBusy.current=true;setSaving(true);announce('Menyimpan rekaman…');
  void saveLog(snapshot).then(()=>{saved.current=snapshot;unsavedLog.current=null;if(alive.current){setSavedCount(snapshot.events.length);setSavedDuration(snapshot.duration);setUnsaved(false);announce('Rekaman tersimpan.');}}).catch(()=>{unsavedLog.current=snapshot;if(alive.current){setUnsaved(true);announce('Rekaman belum tersimpan. Ekspor JSON.');}}).finally(()=>{saveBusy.current=false;if(alive.current)setSaving(false);});
 };
 const startRecord=()=>{
  if(recOn.current||saveBusy.current||state.current.running!=='F1'||!fresh(state.current.bindings.cam1)){announce('Jalankan F1 dengan kamera siap.');return;}
  if((saved.current.events.length||unsavedLog.current)&&!window.confirm('Mulai rekaman F1 baru? Rekaman lama tetap tersimpan sampai rekaman baru berhasil disimpan.'))return;
  live.resetTracking();log.current=emptyLog();clock.current.recStart=performance.now();clock.current.recordOffset=clock.current.recStart-clock.current.start;recOn.current=true;setRecording(true);setCount(0);announce('Merekam F1.');
 };
 const importLog=async(file:File|undefined)=>{
  if(!file||state.current.running||recOn.current||saveBusy.current)return;
  if(file.size>64*1024*1024){announce('File sesi terlalu besar (maks. 64 MB).');return;}
  if((saved.current.events.length||unsavedLog.current)&&!window.confirm('Ganti rekaman tersimpan dengan file ini?'))return;
  saveBusy.current=true;setSaving(true);try{const candidate:unknown=JSON.parse(await file.text());if(!validLog(candidate)||!candidate.events.length)throw Error('Format sesi tidak valid.');if(!alive.current||state.current.running)throw Error('Stop cue sebelum mengimpor.');await saveLog(candidate);saved.current=candidate;unsavedLog.current=null;if(alive.current){setSavedCount(candidate.events.length);setSavedDuration(candidate.duration);setUnsaved(false);announce('Sesi berhasil diimpor.');}}catch(e){announce(e instanceof Error?e.message:'Impor gagal.');}finally{saveBusy.current=false;if(alive.current)setSaving(false);}
 };
 const exportLog=()=>{const data=recOn.current?log.current:unsavedLog.current??saved.current;if(!data.events.length){announce('Belum ada rekaman.');return;}const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const el=document.createElement('a');el.href=url;el.download='soma-f1-session.json';el.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const go=()=>{
  if(state.current.running===next)return;
  const blocker=preflight(next,readiness());if(blocker){selectNode(blocker.target);announce(blocker.text);return;}
  try{validateCue(next);}catch(e){announce(String(e));return;}
  const generation=++transitionGeneration.current;
  if(recOn.current)stopRecord();disarm();archiveVideo.current?.pause();delivered.current={};setSignals({});photoSignals.current.clear();
  const t=performance.now();clock.current.replayStart=t;clock.current.index=0;clock.current.lastFrame=-1;clock.current.lastGestureTime=-1;clock.current.lastMediaTime=-1;replay.clear();
  if(next==='F1'){live.clear();clock.current.start=t;}
  state.current.running=next;setRunning(next);setElapsed(0);
  if(next==='F2'||next==='F3B')void archiveVideo.current?.play().catch(()=>{if(transitionGeneration.current===generation&&state.current.running===next)latchFault('canvas','Video belum bisa diputar.');});
  // Preserve manually latched surfaces; selecting or starting a cue cannot relight them.
  announce(next+' berjalan · preview lokal.');
 };
 const stop=()=>{
  transitionGeneration.current++;
  stopRecord();disarm();state.current.running=null;setRunning(null);archiveVideo.current?.pause();delivered.current={};setSignals({});black(floor.current?.getContext('2d'));black(canvas.current?.getContext('2d'));announce('Cue dihentikan.');
 };
 const blackout=()=>{setBlank('all',true);announce('Dua output gelap. Cue dan rekaman tetap berjalan.');};
 const blackRef=useRef(blackout);blackRef.current=blackout;
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'||(e.code==='KeyB'&&!['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)&&!(e.target as HTMLElement)?.isContentEditable)){blackRef.current();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const toggleSurface=(surface:Surface)=>{
  if(!state.current.latches[surface]){setBlank(surface,true);announce(surface==='floor'?'Floor blackout.':'Canvas blackout.');return;}
  const active=state.current.running;if(!active){announce('Jalankan cue sebelum Resume.');return;}
  const b=preflight(active,readiness());if(b){announce(b.text);selectNode(b.target);return;}
  if(!cueUsesSurface(active,surface)){announce('Output ini tidak dipakai pada cue aktif.');return;}
  setBlank(surface,false);announce('Preview '+surface+' dilanjutkan.');
 };
 const verify=()=>{
  const b=state.current.bindings;if(!consentRef.current||!fresh(b.cam2)||!fresh(b.cam3)||b.cam2===b.cam3){announce('Periksa persetujuan dan dua kamera.');return;}
  verifiedRef.current=true;setVerified(true);machine.setVerified(true);announce('Frame penonton terverifikasi oleh operator.');
 };
 const arm=async()=>{
  const b=state.current.bindings;if(state.current.running!=='F3A'||!consentRef.current||!verifiedRef.current||!fresh(b.cam2)||!fresh(b.cam3)||b.cam2===b.cam3){announce('Jalankan F3A setelah kamera dan persetujuan siap.');return;}
  machine.setDevices(true,true);machine.setConsent(true);machine.setVerified(true);if(!machine.arm(true,true))return;
  armedRef.current=true;setArmed(true);const generation=captureGen.current;announce('Capture siap. Memuat detektor gestur…');
  try{await fusion.init();if(alive.current&&armedRef.current&&generation===captureGen.current)announce('Gestur siap.');else if(!alive.current)fusion.dispose();}catch{announce('Gestur belum tersedia. Gunakan Foto manual.');}
 };
 const capture=async(eventId:string,preset:'manual'|'straight'='manual')=>{
  const b=state.current.bindings,t=performance.now(),f=registry.feed(b.cam2),aFresh=fresh(b.cam3,t),bFresh=fresh(b.cam2,t);
  if(state.current.running!=='F3A'||!consentRef.current||!verifiedRef.current||!armedRef.current||!f||b.cam2===b.cam3||!machine.begin(eventId,aFresh,bFresh,photoStore.count<4))return;
  const generation=captureGen.current;
  try{await photoStore.capture({video:f.video,crop:framing.crop(f.video.videoWidth,f.video.videoHeight),cameraId:b.cam2,frameId:registry.get(b.cam2)?.frames??0,sourceTimestamp:t,preset,consent:true,eventId,fresh:bFresh,stillValid:()=>alive.current&&captureGen.current===generation&&state.current.running==='F3A'&&consentRef.current&&verifiedRef.current&&armedRef.current&&state.current.bindings.cam2===b.cam2&&state.current.bindings.cam3===b.cam3&&fresh(b.cam2)&&fresh(b.cam3)});
   machine.complete(photoStore.count);machine.readyAgain();if(alive.current){setPhotos(photoStore.count);deliver(11,performance.now(),false);announce('Foto '+photoStore.count+'/4 tersimpan lokal.');if(photoStore.count>=4)disarm();}
  }catch(e){machine.failed();if(alive.current){disarm();announce(String(e));}}
 };
 const applyLiveEvent=(e:VisualEvent,t:number)=>{
  live.apply(e);const isFoot=e.kind==='foot';deliver(isFoot?6:7,t,false);
  if(recOn.current){if(appendEvent(log.current,rebaseEvent(e,clock.current.recordOffset)))deliver(isFoot?4:5,t,false);else{stopRecord();announce('Batas rekaman tercapai. Menyimpan event.');}}
 };
 useEffect(()=>{
  let raf=0,lastUi=0;
  const tick=(t:number)=>{
   raf=requestAnimationFrame(tick);const s=state.current,cf=floor.current?.getContext('2d'),cc=canvas.current?.getContext('2d');if(!cf||!cc)return;
   const b=s.bindings,f=registry.feed(b.cam1),a=registry.feed(b.cam3),v=registry.feed(b.cam2);
   const fReady=fresh(b.cam1,t),aReady=fresh(b.cam3,t),bReady=fresh(b.cam2,t);
   const active=s.running;
   if(!active){black(cf);black(cc);}
   else if(active==='F1'){
    const at=Math.max(0,t-clock.current.start);
    if(!fReady){latchFault('all','Kamera performer terputus. Output gelap.');black(cf);black(cc);}
    else if(f?.frame){
     if(f.frame.time!==clock.current.lastFrame){clock.current.lastFrame=f.frame.time;deliver(1,t,true);if(f.frame.tracked){deliver(2,t,true);deliver(3,t,true);}live.ingest(f.frame,b.cam1,f.video.videoWidth/Math.max(1,f.video.videoHeight),at,e=>applyLiveEvent(e,t));}
     if(!state.current.latches.floor){live.paintFloor(cf,at,s.decay);deliver(17,t,true);}else black(cf);
     if(!state.current.latches.canvas){live.paintTrace(cc,at);deliver(18,t,true);}else black(cc);
    }else{black(cf);black(cc);}
   }else if(active==='F2'){
    black(cf);black(cc);if(!mediaReady())latchFault('canvas','Arsip terputus. Output gelap.');
    else if(!state.current.latches.canvas){
     const media=s.archive?.video?archiveVideo.current:archiveImage.current;
     if(media&&fit(cc,media)){deliver(18,t,true);if(s.archive?.video&&archiveVideo.current){const m=archiveVideo.current.currentTime;if(m!==clock.current.lastMediaTime){clock.current.lastMediaTime=m;deliver(12,t,true);}}else if(clock.current.lastMediaTime!==0){clock.current.lastMediaTime=0;deliver(12,t,false);}}
    }
   }else if(active==='F3A'){
    black(cf);
    if(!aReady||!bReady){if(armedRef.current||verifiedRef.current)resetVerification();latchFault('canvas','Kamera F3 terputus. Verifikasi ulang.');black(cc);}
    else if(!consentRef.current||!verifiedRef.current||!a||!v){latchFault('canvas','Periksa persetujuan dan frame.');black(cc);}
    else{
     if(fusion.status==='ready'&&armedRef.current&&t-clock.current.lastGesture>90&&a.video.currentTime!==clock.current.lastGestureTime){
      clock.current.lastGesture=t;clock.current.lastGestureTime=a.video.currentTime;try{const m=fusion.sample(a.video,++clock.current.serial,t);if(m){deliver(9,t,true);deliver(10,t,true);framing.step(m,t);if(framing.resizing)punch.pauseResize(t);else{const result=punch.step(m,t,true);if(result.kind==='capture'&&result.eventId)void capture('gesture-'+result.eventId+'-'+captureGen.current,'straight');}}}catch{disarm();announce('Detektor gestur berhenti. Arm ulang.');}
     }
     if(!state.current.latches.canvas){const stage=makeF3StageFrame({sourceId:b.cam2,frameId:registry.get(b.cam2)?.frames??0,timestamp:t,crop:framing.crop(v.video.videoWidth,v.video.videoHeight),slots:photoStore.slots,state:'LIVE'});stage.overlay={...stage.overlay,corners:false,liveIndicator:false};drawF3Stage(cc,stage,a.video,v.video);deliver(8,t,true);deliver(18,t,true);}else black(cc);
    }
   }else{
    if(!consentRef.current||!photoStore.count||!saved.current.events.length||!mediaReady()){latchFault('all','Sumber replay belum lengkap.');black(cf);black(cc);}
    else{
     const at=Math.min(saved.current.duration,t-clock.current.replayStart);const old=clock.current.index;
     clock.current.index=replayUntil(saved.current,old,at,e=>{replay.apply(e);deliver(e.kind==='foot'?14:15,t,false);});
     if(clock.current.index!==old)deliver(13,t,false);
     if(!state.current.latches.floor){replay.paintFloor(cf,at,s.decay);deliver(17,t,true);}else black(cf);
     if(!state.current.latches.canvas){replay.paintTrace(cc,at);const media=s.archive?.video?archiveVideo.current:archiveImage.current;if(media&&fit(cc,media,.36)){if(s.archive?.video&&archiveVideo.current&&archiveVideo.current.currentTime!==clock.current.lastMediaTime){clock.current.lastMediaTime=archiveVideo.current.currentTime;deliver(12,t,true);}else if(!s.archive?.video&&clock.current.lastMediaTime!==0){clock.current.lastMediaTime=0;deliver(12,t,false);}}
      photoStore.slots.forEach((p,i)=>{if(!p)return;let im=images.current.get(p.url);if(!im){im=new Image();im.src=p.url;images.current.set(p.url,im);}if(im.complete&&im.naturalWidth){cc.drawImage(im,32+(i%2)*215,32+Math.floor(i/2)*175,205,165);if(!photoSignals.current.has(p.url)){photoSignals.current.add(p.url);deliver(16,t,false);}}});deliver(18,t,true);
     }else black(cc);
    }
   }
   if(t-lastUi>220){lastUi=t;setNow(t);setSignals({...delivered.current});setCount(log.current.events.length);setElapsed(active?active==='F3B'?Math.min(saved.current.duration,t-clock.current.replayStart):t-clock.current.replayStart:0);setHealth(active==='F1'?live.reason:active==='F3A'?(aReady&&bReady?'Dua kamera siap':'Kamera terputus'):active?'Media / replay':'Standby');setTrackCount(fReady?registry.get(b.cam1)?.detectedBodies??0:0);setMarkCount(active==='F3B'?replay.marks.length:live.marks.length);}
  };
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[registry,live,replay,photoStore,framing,punch,fusion,machine]);
 const readySources=new Set(records.filter(r=>fresh(r.id,now||performance.now())).map(r=>r.id));
 const ready=readiness(),blocker=preflight(next,ready);
 const sourceNeed=next==='F1'?['cam1'] as Role[]:next==='F3A'?['cam2','cam3'] as Role[]:[];
 const sourceReady=sourceNeed.filter(r=>ready.fresh[r]).length;
 const activeEdge=(n:number)=>signalFresh(signals['edge-'+String(n).padStart(2,'0')],now);
 const statuses:Record<string,string>={archive:mediaState==='ready'?'ready':mediaState==='loading'?'connecting':mediaState==='error'?'error':'idle',pose:running==='F1'?(ready.fresh.cam1?(trackCount?'processing':'waiting'):'stale'):'idle',hand:running==='F3A'?(activeEdge(9)?'processing':ready.fresh.cam3?'ready':'stale'):'idle',foot:activeEdge(6)?'processing':running==='F1'?'waiting':'idle',trace:activeEdge(7)?'processing':running==='F1'?'waiting':'idle',capture:armed?'processing':photos?'ready':'idle',session:recording?'processing':saving?'connecting':unsaved?'error':savedCount?'ready':'idle',floor:latches.floor?'blocked':activeEdge(17)?'processing':'idle',canvas:latches.canvas?'blocked':activeEdge(18)?'processing':'idle'};
 const details:Record<string,string>={archive:archive?.name||'Pilih media',pose:trackCount?trackCount+' performer':'Menunggu performer',hand:armed?'Arm aktif':'Standby',foot:markCount+' jejak · '+Math.round(decay/1000)+'s',trace:'Kaki · kepala · bahu',capture:photos+'/4 foto',session:recording?'REC · '+timeText(performance.now()-clock.current.recStart):saving?'Menyimpan…':unsaved?'Belum tersimpan':running==='F3B'?'Replay '+timeText(elapsed):savedCount?timeText(savedDuration)+' tersimpan':'Belum ada rekaman',floor:latches.floor?'Blackout':cueUsesSurface(running,'floor')?'Preview lokal':'Standby',canvas:latches.canvas?'Blackout':running?'Preview lokal':'Standby'};
 const selectedSource=records.find(r=>r.id===selected),selectedRole=ROLES.find(r=>r===selected);
 const inspectTitle=selectedSource?.name??(selectedRole?ROLE_NAMES[selectedRole]:({add:'Tambah kamera',archive:'Archive',pose:'Motion',hand:'Gesture',foot:'Footprint',trace:'Dual Trace',capture:'Photo Capture',session:'Session',floor:'Floor',canvas:'Canvas'} as Record<string,string>)[selected]??'Workspace');
 const full=(surface:Surface)=>{const c=surface==='floor'?floor.current:canvas.current;if(c)void c.requestFullscreen().catch(()=>announce('Fullscreen tidak tersedia.'));};
 const leave=(old=false)=>{if(saveBusy.current){announce('Tunggu rekaman selesai disimpan sebelum berpindah.');return;}if(recOn.current){if(window.confirm('Simpan rekaman dan hentikan cue?'))stop();return;}if(unsavedLog.current&&!window.confirm('Rekaman belum tersimpan. Pindah tanpa mengekspor?'))return;if(running&&!window.confirm('Hentikan cue dan pindah workspace?'))return;blackout();stop();const url=new URL(location.href);url.search='';if(old)url.searchParams.set('workspace','nodes-v5');location.assign(url.toString());};
 const selectMedia=(f:File|undefined)=>{if(!f)return;if(state.current.running==='F2'||state.current.running==='F3B'){announce('Stop cue sebelum mengganti arsip.');return;}setMediaState('loading');setArchive({url:URL.createObjectURL(f),name:f.name,video:f.type.startsWith('video/')});announce('Memuat arsip…');};
 const mediaLoaded=()=>{setMediaState('ready');announce('Arsip siap.');};
 const sourcePicker=<><label>Perangkat<select aria-label="Perangkat kamera" value={device} onChange={e=>setDevice(e.target.value)}><option value="">Pilih kamera / beri izin</option>{devices.map(d=><option value={d.deviceId} key={d.deviceId}>{d.label||'Kamera '+d.deviceId.slice(0,5)}</option>)}</select></label><div className="sw-inspector-actions"><button disabled={adding} onClick={()=>void addDevice()}><Camera size={15}/>{adding?'Menghubungkan…':'Webcam / USB'}</button><button onClick={addPhone}>HP QR</button><button title="Perbarui perangkat" aria-label="Perbarui perangkat" onClick={()=>void refresh()}><RefreshCw size={14}/></button></div></>;
 const step=captureStep({audience:ready.fresh.cam2,gesture:ready.fresh.cam3,distinct:!!bindings.cam2&&bindings.cam2!==bindings.cam3,consent,verified,running:running==='F3A',armed,photos});
 const captureContent=<><div className="adaptive-capture-status"><b>{photos}/4 foto</b><small>{armed?'Armed':'Disarmed'}</small></div>
 {consent&&<label className="sw-check"><input type="checkbox" checked={consent} onChange={e=>changeConsent(e.target.checked)}/> Persetujuan penonton</label>}
 {consent&&ready.fresh.cam2&&<div className="sw-verify"><FeedThumb registry={registry} id={bindings.cam2} allowed={consent}/></div>}
 <div className="sw-photo-slots">{photoStore.slots.map((p,i)=><div key={p?.id??i}>{p&&consent?<img className="soma-enter" src={p.url} alt={'Foto '+(i+1)}/>:<span>{String(i+1).padStart(2,'0')}</span>}</div>)}</div>
 <div className="adaptive-primary">
 {step==='audience'||step==='gesture'||step==='distinct'?<button onClick={()=>selectNode(step==='audience'?'cam2':'cam3')}>{step==='audience'?'Hubungkan kamera penonton':step==='gesture'?'Hubungkan kamera gestur':'Pilih kamera berbeda'}</button>:step==='consent'?<label className="sw-check"><input type="checkbox" checked={consent} onChange={e=>changeConsent(e.target.checked)}/> Persetujuan penonton</label>:step==='verify'?<button onClick={verify}>Verifikasi frame penonton</button>:step==='cue'?<button onClick={()=>{setNext('F3A');announce('F3A dipilih. Tekan GO.');}}>Siapkan F3A</button>:step==='arm'?<button onClick={()=>void arm()}>Arm</button>:step==='capture'?<button onClick={()=>void capture('manual-'+Date.now())}>Capture</button>:<span>4/4 foto selesai</span>}
 {photos>0&&<button onClick={()=>{if(window.confirm('Hapus semua foto?')){purgePhotos();if(state.current.running==='F3B')setBlank('all',true);}}}>Hapus foto</button>}</div></>;
 const inspectorContent=<>
 {selected==='add'||selectedRole?<>{sourcePicker}{selectedRole&&<label>Sumber {ROLE_NAMES[selectedRole]}<select disabled={!!running} value={bindings[selectedRole]} onChange={e=>bind(selectedRole,e.target.value)}><option value="">Belum terhubung</option>{records.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}</>:null}
 {selectedSource&&<><div className="sw-info">{selectedSource.message}</div><label>Assign ke<select aria-label="Assign kamera" value="" disabled={!!running} onChange={e=>{if(e.target.value)bind(e.target.value as Role,selectedSource.id);}}><option value="">Pilih role</option>{ROLES.map(r=><option key={r} value={r}>{ROLE_NAMES[r]}{bindings[r]===selectedSource.id?' · terhubung':''}</option>)}</select></label><div className="sw-inspector-actions">{ROLES.filter(r=>bindings[r]===selectedSource.id).map(r=><button key={r} disabled={!!running} onClick={()=>bind(r,'')}>Lepas {ROLE_NAMES[r]}</button>)}{selectedSource.kind==='device'&&<button onClick={()=>{if(state.current.bindings.cam2===selectedSource.id||state.current.bindings.cam3===selectedSource.id)resetVerification();void registry.connect(selectedSource.id);}}><RefreshCw size={14}/> Retry</button>}<button disabled={!!running} onClick={()=>remove(selectedSource.id)} title="Hapus kamera"><Trash2 size={14}/> Hapus</button></div></>}
 {records.filter(r=>r.kind==='phone').map(r=><div key={r.id} hidden={selected!==r.id}><PhoneCameraReceiver initialMode="qr" onStream={stream=>registry.connectPhone(r.id,stream)} onDisconnect={()=>registry.disconnect(r.id)}/></div>)}
 {(adaptive?selected==='foot':['foot','trace','pose','floor'].includes(selected))&&<><label>Decay <b>{Math.round(decay/1000)}s</b><input aria-label="Decay" type="range" min={1000} max={60000} step={1000} value={decay} onChange={e=>setDecay(+e.target.value)}/></label>{!adaptive&&<><button onClick={()=>live.resetTracking()}>Reset A/B</button><details><summary>Advanced</summary><p>Pose 33 landmarks · estimasi kontak kaki · dua performer.</p><p>{health}</p></details></>}</>}{adaptive&&selected==="pose"&&<><div className="sw-info">{health} · {trackCount} performer</div><button onClick={()=>live.resetTracking()}>Reset A/B</button><details><summary>Advanced</summary><p>Pose 33 landmarks · estimasi kontak kaki.</p></details></>}{adaptive&&selected==="trace"&&<div className="sw-info">{details.trace} · {statuses.trace}</div>}
 {(adaptive?selected==='archive':['archive','canvas'].includes(selected))&&<label><Film size={15}/> Arsip lokal<input type="file" accept="video/*,image/*" onChange={e=>selectMedia(e.target.files?.[0])}/><small>{archive?.name||'Belum ada file'}{mediaState==='loading'?' · Memuat…':mediaState==='error'?' · Gagal dibuka':''}</small></label>}
 {selected==='session'&&<><div className="sw-info">{savedCount} event · {timeText(savedDuration)}{unsaved?' · belum tersimpan':''}</div><div className="sw-inspector-actions"><button disabled={!savedCount&&!unsaved&&!recording} onClick={exportLog}><Download size={14}/> Ekspor JSON</button></div><label>Impor sesi JSON<input type="file" aria-label="Impor sesi JSON" accept=".json,application/json" disabled={!!running||saving} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void importLog(file);}}/></label><small>Rekaman tersedia untuk F3B setelah tersimpan.</small></>}
 {!adaptive&&['capture','hand','cam2','cam3'].includes(selected)&&<><label className="sw-check"><input type="checkbox" checked={consent} onChange={e=>changeConsent(e.target.checked)}/> Persetujuan penonton</label>{consent&&<><div className="sw-verify">{bindings.cam2?<FeedThumb registry={registry} id={bindings.cam2} allowed={consent}/>:<small>Hubungkan kamera penonton.</small>}</div><button disabled={verified||!ready.fresh.cam2||!ready.fresh.cam3} onClick={verify}>{verified?<><Check size={14}/> Frame diperiksa</>:'Verifikasi frame penonton'}</button></>}<div className="sw-inspector-actions"><button disabled={!verified||armed||running!=='F3A'} onClick={()=>void arm()}>Arm</button><button disabled={!armed||photos>=4} onClick={()=>void capture('manual-'+Date.now())}>Foto</button><button onClick={()=>{purgePhotos();if(state.current.running==='F3B')setBlank('all',true);}}>Hapus foto</button></div><div className="sw-photo-slots">{photoStore.slots.map((p,i)=><div key={p?.id??i}>{p&&consent?<img className="soma-enter" src={p.url} alt={'Foto '+(i+1)}/>:<span>{String(i+1).padStart(2,'0')}</span>}</div>)}</div><small>{photos}/4 foto · {armed?'Armed':'Disarmed'}</small></>}
 {adaptive&&selected==='hand'&&<><div className="sw-info">{statuses.hand} · {armed?'Armed':'Disarmed'}</div><button onClick={()=>selectNode('capture')}>Photo Capture</button></>}
 {adaptive&&selected==='capture'&&captureContent}
 {['floor','canvas'].includes(selected)&&<div className="sw-output-note">{adaptive&&<div className="sw-inspector-actions"><button onClick={()=>full(selected as Surface)}>Fullscreen</button><button onClick={()=>toggleSurface(selected as Surface)}>{latches[selected as Surface]?"Resume":"Blackout"}</button></div>}<small>Preview lokal. Kalibrasi proyektor fisik tetap di Legacy Studio.</small><button onClick={()=>leave()}>Buka Legacy Studio</button></div>}
</>;
 
 return <div className={"soma-signal"+(adaptive?" adaptive-workspace":"")} data-reduced-motion={reduce} data-version={editor?"5.4":adaptive?"5.3":"5.2"}>
 <header className="sw-top"><div className="sw-brand"><Network size={21}/><b>SOMA</b><span className="sw-project">/ In Passing</span><small>{editor?"V5.4 BETA":adaptive?"V5.3 BETA":"V5.2 BETA"}</small></div><div className="sw-top-actions"><span className="sw-readiness"><i className={blocker?'pending':'ready'}/>{sourceNeed.length?sourceReady+'/'+sourceNeed.length+' kamera siap':blocker?'Cue belum siap':'Cue siap'}</span>{adaptive&&<button aria-label="Open inspector" title="Pengaturan node" onClick={()=>panelMode==="closed"?selectNode(selected):closePanel()}><Settings2 size={15}/><span className="adaptive-settings-label">Inspector</span></button>}<details className="sw-menu"><summary title="Workspace" aria-label="Workspace settings"><Settings2 size={17}/></summary><div><label><input type="checkbox" checked={reduce} onChange={e=>setReduce(e.target.checked)}/> Kurangi animasi</label><button onClick={()=>{if(running||recording||saving||unsaved){announce("Stop dan simpan sesi sebelum pindah.");return;}const u=new URL(location.href);u.searchParams.set("workspace",adaptive?"nodes-v52":"nodes");location.assign(u.toString());}}>{adaptive?"Signal V5.2":"Adaptive V5.3"}</button>{adaptive&&<button onClick={()=>{if(running||recording||saving||unsaved){announce("Stop dan simpan sesi sebelum pindah.");return;}const u=new URL(location.href);u.searchParams.set("workspace",editor?"nodes-v53":"nodes-v54");location.assign(u.toString());}}>{editor?"Adaptive V5.3":"Graph Editor V5.4"}</button>}<button onClick={()=>leave(true)}>Node Canvas V5</button><button onClick={()=>leave()}>Legacy Studio</button></div></details><button className="sw-blackout" onClick={blackout} aria-label="Blackout semua output"><Square size={15}/> Blackout</button></div></header>
 <main className={"sw-main"+(adaptive&&effectiveMode==="docked"?" has-docked":"")} style={{"--sw-rail-width":(adaptive?prefs.monitor:railWidth)+"px"} as CSSProperties}><section className="sw-work" ref={graphHost}><SignalGraph editor={editor} records={records} bindings={bindings} selected={selected} onSelect={adaptive?(id=>{setSelected(id);setQuick(null);}):selectNode} onOpen={adaptive?selectNode:undefined} onQuick={adaptive?openQuick:undefined} minimap={adaptive?prefs.minimap:undefined} onMinimap={adaptive?()=>setPrefs(p=>({...p,minimap:!p.minimap})):undefined} next={next} running={running} signals={signals} now={now} readySources={readySources} status={statuses} details={details} locked={!!running} onBind={bind} onNotice={announce} preview={id=><FeedThumb registry={registry} id={id} allowed={bindings.cam2!==id||consent}/>} />{adaptive&&quick&&<div className="adaptive-quick" style={{left:quick.x,top:quick.y}}><header><b>Footprint</b><button aria-label="Close quick controls" onClick={()=>setQuick(null)}>×</button></header><label>Decay <b>{Math.round(decay/1000)}s</b><input aria-label="Quick decay" type="range" min={1000} max={60000} step={1000} value={decay} onChange={e=>setDecay(+e.target.value)}/></label><button onClick={()=>selectNode('foot')}>Pengaturan lengkap</button></div>}</section>
 <aside className="sw-rail"><div className="adaptive-monitor-dock"><div className="sw-rail-tools"><label title="Lebar monitor"><span>Monitor</span><input aria-label="Lebar monitor" type="range" min={280} max={440} step={20} value={adaptive?prefs.monitor:railWidth} onChange={e=>adaptive?setPrefs(p=>({...p,monitor:+e.target.value})):setRailWidth(+e.target.value)}/></label></div><div className="sw-monitors"><MonitorPanel name="Floor" surface="floor" refCanvas={floor} latched={latches.floor} running={running} status={adaptive?monitorLabel({latched:latches.floor,fault:faults.floor,running:!!running,used:cueUsesSurface(running,'floor'),delivered:activeEdge(17)}):undefined} onToggle={()=>toggleSurface('floor')} onFull={()=>full('floor')}/><MonitorPanel name="Canvas" surface="canvas" refCanvas={canvas} latched={latches.canvas} running={running} status={adaptive?monitorLabel({latched:latches.canvas,fault:faults.canvas,running:!!running,used:cueUsesSurface(running,'canvas'),delivered:activeEdge(18)}):undefined} onToggle={()=>toggleSurface('canvas')} onFull={()=>full('canvas')}/></div></div>
 {adaptive?<AdaptiveInspector mode={effectiveMode} title={inspectTitle} rect={prefs.rect} graph={graphHost} canDock={!compact} onRect={rect=>setPrefs(p=>({...p,rect}))} onClose={closePanel} onDock={toggleDock}>{inspectorContent}</AdaptiveInspector>:<section className={"sw-inspector"+(inspectorOpen?"":" collapsed")} aria-label="Inspector"><header><button className="sw-inspector-toggle" aria-expanded={inspectorOpen} aria-label={inspectorOpen?"Collapse inspector":"Expand inspector"} onClick={()=>setInspectorOpen(v=>!v)}><span>Inspector</span><b>{inspectTitle}</b><span aria-hidden="true">{inspectorOpen?"−":"+"}</span></button></header><div className="sw-inspector-body" hidden={!inspectorOpen}>{inspectorContent}</div></section>}</aside></main>
 <footer className="sw-transport"><div className="sw-cue-list" aria-label="Cue"><div className="sw-current"><span>Running</span><b>{running??'—'}</b></div>{(Object.keys(CUES) as CueId[]).map(id=><button key={id} className={'sw-cue'+(next===id?' next':'')+(running===id?' running':'')} aria-pressed={next===id} onClick={()=>{setNext(id);if(editor)setQuick(null);}}><b>{id}</b><small>{CUES[id]}</small></button>)}</div>
 <div className="sw-transport-info"><button className={'sw-blocker '+(blocker?'blocked':'')} onClick={()=>{if(blocker)selectNode(blocker.target);}} disabled={!blocker} title={blocker?.text??'Cue siap'}>{blocker?.text??'Cue siap'}</button><span className="sw-notice" role="status" title={notice}>{notice}</span></div>
 <div className="sw-transport-actions"><span className="sw-time">{timeText(elapsed)}</span><button className={'sw-rec'+(recording?' recording':'')} disabled={saving||(!recording&&(running!=='F1'||!ready.fresh.cam1))} aria-label={recording?'Stop recording':'Record F1'} onClick={recording?stopRecord:startRecord}><Circle size={15} fill={recording?'currentColor':'none'}/>{saving?'Saving':recording?'REC':'Record'}</button><button aria-label="Stop cue" disabled={!running} onClick={stop}><Square size={15}/></button><button className="sw-go" disabled={!!blocker||running===next} onClick={go}><Play size={15} fill="currentColor"/> GO</button></div></footer>
 {archive?.video&&<video key={archive.url} ref={archiveVideo} src={archive.url} muted loop playsInline preload="auto" onLoadedData={mediaLoaded} onError={()=>{setMediaState('error');announce('Arsip gagal dibuka.');}} style={{display:'none'}}/>}{archive&&!archive.video&&<img key={archive.url} ref={archiveImage} src={archive.url} alt="" onLoad={mediaLoaded} onError={()=>{setMediaState('error');announce('Arsip gagal dibuka.');}} style={{display:'none'}}/>}
 </div>;
}
