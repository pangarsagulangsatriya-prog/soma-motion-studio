import {useEffect,useRef,useState} from 'react';
import {Camera,Film,Network,Plus,Monitor,Maximize,Square,Play,Download,Trash2,RefreshCw} from 'lucide-react';
import {CameraHubRegistry,hubFrameIsFresh,type HubCameraRecord} from '../v3/CameraHubRegistry.ts';
import {PhoneCameraReceiver} from '../../stage/PhoneCameraReceiver.tsx';
import {defaultUnpackingGraph,compileCuePlan,type CueId} from './NodeGraphModel.ts';
import {VisualRuntime,emptyLog,appendEvent,saveLog,loadLog,replayUntil,type SessionLog,type VisualEvent} from './VisualRuntime.ts';
import {F3PhotoStore} from '../../f3/F3PhotoStore.ts';
import {F3SessionMachine} from '../../f3/F3SessionMachine.ts';
import {F3FramingController} from '../../f3/F3FramingController.ts';
import {F3MotionFusion} from '../../f3/F3MotionFusion.ts';
import {F3PunchEngine} from '../../f3/F3PunchEngine.ts';
import {drawF3Stage,makeF3StageFrame} from '../../f3/F3StageRenderer.ts';
import './unified-node.css';
type Role='cam1'|'cam2'|'cam3';
type RoleMap=Record<Role,string>;
type Surface='floor'|'canvas';
const cueNames:Record<CueId,string>={F1:'Jejak live',F2:'Video arsip',F3A:'Capture foto',F3B:'Arsip baru'};
const roles:Role[]=['cam1','cam2','cam3'];
const graph=defaultUnpackingGraph();
const layout:Record<string,[number,number]>={cam1:[18,58],cam2:[18,175],cam3:[18,292],archive:[18,409],saved:[18,526],photos:[18,643],pose:[225,58],hand:[225,292],foot:[432,28],trace:[432,145],capture:[432,292],rec:[639,28],replay:[432,526],floorMix:[639,180],canvasMix:[639,409],floor:[846,180],canvas:[846,409]};
const labels:Record<string,string>={cam1:'Performer · video',cam2:'Penonton · video',cam3:'Gestur · video',pose:'33 landmarks',hand:'Pose + hand',foot:'Gait / contact',trace:'Foot + head + shoulder ink',rec:'Local session',replay:'Timed events',capture:'4 foto · consent',floorMix:'Footprint layer',canvasMix:'Media + ink + foto',archive:'MP4 / gambar',saved:'F1 recording',photos:'4 slot',floor:'Preview lantai',canvas:'Preview kanvas'};
const fill=(c:CanvasRenderingContext2D,color='#050807')=>{c.fillStyle=color;c.fillRect(0,0,c.canvas.width,c.canvas.height);};
const fit=(ctx:CanvasRenderingContext2D,img:HTMLVideoElement|HTMLImageElement,alpha=1)=>{const w=img instanceof HTMLVideoElement?img.videoWidth:img.naturalWidth,h=img instanceof HTMLVideoElement?img.videoHeight:img.naturalHeight;if(!w||!h)return;const W=ctx.canvas.width,H=ctx.canvas.height,k=Math.min(W/w,H/h);ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(img,(W-w*k)/2,(H-h*k)/2,w*k,h*k);ctx.restore();};
function FeedThumbnail({registry,id}:{registry:CameraHubRegistry;id:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let timer=0;const paint=()=>{const c=ref.current?.getContext('2d');if(!c)return;fill(c);const f=registry.feed(id);if(f&&f.video.readyState>=2&&hubFrameIsFresh(f.frameAt,performance.now(),1000))fit(c,f.video);};timer=window.setInterval(paint,150);paint();return()=>clearInterval(timer);},[registry,id]);
 return <canvas ref={ref} width={240} height={135} aria-label="Preview kamera lokal"/>;
}
export function UnifiedNodeWorkspace(){
 const registry=useRef(new CameraHubRegistry()).current;
 const [records,setRecords]=useState<HubCameraRecord[]>([]);
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);
 const [bindings,setBindings]=useState<RoleMap>({cam1:'',cam2:'',cam3:''});
 const [cue,setCue]=useState<CueId>('F1'),[running,setRunning]=useState(false);
 const [selected,setSelected]=useState('cam1'),[notice,setNotice]=useState('Tambahkan kamera atau pilih arsip.');
 const [device,setDevice]=useState(''),[zoom,setZoom]=useState(1);
 const [recording,setRecording]=useState(false),[count,setCount]=useState(0),[savedCount,setSavedCount]=useState(0);
 const [consent,setConsent]=useState(false),[armed,setArmed]=useState(false),[photos,setPhotos]=useState(0);
 const [decay,setDecay]=useState(18000),[archive,setArchive]=useState<{url:string;name:string;video:boolean}|null>(null);
 const [blank,setBlank]=useState<Record<Surface,boolean>>({floor:false,canvas:false});
 const [health,setHealth]=useState('Menunggu sumber'),[liveRoles,setLiveRoles]=useState<Role[]>([]);
 const [elapsed,setElapsed]=useState(0),[savedDuration,setSavedDuration]=useState(0);
 const floor=useRef<HTMLCanvasElement>(null),canvas=useRef<HTMLCanvasElement>(null),archiveVideo=useRef<HTMLVideoElement>(null),archiveImage=useRef<HTMLImageElement>(null);
 const ink=useRef<HTMLCanvasElement|null>(null);
 const live=useRef(new VisualRuntime()).current,replay=useRef(new VisualRuntime()).current;
 const photoStore=useRef(new F3PhotoStore()).current,machine=useRef(new F3SessionMachine()).current;
 const framing=useRef(new F3FramingController()).current,punch=useRef(new F3PunchEngine()).current,fusion=useRef(new F3MotionFusion()).current;
 const log=useRef<SessionLog>(emptyLog()),saved=useRef<SessionLog>(emptyLog());
 const clock=useRef({start:0,replayStart:0,index:0,lastGesture:-1,lastGestureTime:-1,lastUi:0,serial:0});
 const images=useRef(new Map<string,HTMLImageElement>());
 const alive=useRef(true),recOn=useRef(false),consentRef=useRef(false),armedRef=useRef(false),captureGen=useRef(0);
 const current=useRef({bindings,cue,running,decay,blank,archive});current.current={bindings,cue,running,decay,blank,archive};
 const plan=compileCuePlan(graph,cue),activeNodes=new Set(plan.nodes.map(n=>n.id)),activeEdges=new Set(plan.edges.map(e=>e.id));
 const refresh=async()=>{try{const all=await navigator.mediaDevices.enumerateDevices();setDevices(all.filter(d=>d.kind==='videoinput'&&d.deviceId));}catch(e){setNotice(String(e));}};
 useEffect(()=>{alive.current=true;const unsub=registry.subscribe(()=>setRecords(registry.snapshot()));void refresh();navigator.mediaDevices?.addEventListener('devicechange',refresh);
  void loadLog().then(l=>{if(alive.current){saved.current=l;setSavedCount(l.events.length);setSavedDuration(l.duration);}}).catch(()=>{if(alive.current)setNotice('Penyimpanan lokal belum tersedia; ekspor JSON sebagai cadangan.');});
  return()=>{alive.current=false;unsub();navigator.mediaDevices?.removeEventListener('devicechange',refresh);registry.dispose();fusion.dispose();photoStore.revokeAll();images.current.clear();};
 },[registry,fusion,photoStore]);
 useEffect(()=>()=>{if(archive)URL.revokeObjectURL(archive.url);},[archive]);
 const fresh=(id:string,now=performance.now())=>{const feed=registry.feed(id),record=registry.get(id);return !!feed&&record?.phase==='live'&&feed.video.readyState>=2&&!feed.video.paused&&hubFrameIsFresh(feed.frameAt,now,950)&&((feed.video.srcObject as MediaStream|null)?.getVideoTracks?.().some(t=>t.readyState==='live')??false);};
 const addDevice=async()=>{try{let chosen=device;if(!chosen&&records.length&&devices.length){setNotice('Pilih perangkat lain dari daftar kamera.');return;}if(!chosen){const s=await navigator.mediaDevices.getUserMedia({video:true,audio:false});chosen=s.getVideoTracks()[0]?.getSettings().deviceId??'';s.getTracks().forEach(t=>t.stop());await refresh();}
  if(!chosen)throw Error('Pilih perangkat kamera.');const old=registry.findDevice(chosen);const id=old?.id??registry.create(chosen,devices.find(d=>d.deviceId===chosen)?.label||'Kamera '+(records.length+1));setSelected(id);
  setBindings(b=>{const role=roles.find(r=>!b[r]);return role&&!Object.values(b).includes(id)?{...b,[role]:id}:b;});
  if(!old||old.phase!=='live')await registry.connect(id);setNotice('Kamera terdaftar. Periksa frame pada node.');
 }catch(e){setNotice(e instanceof Error?e.message:String(e));}};
 const addPhone=()=>{const id=registry.createPhone('Kamera HP '+(records.length+1));setSelected(id);setBindings(b=>{const role=roles.find(r=>!b[r]);return role?{...b,[role]:id}:b;});};
 const stopRecord=()=>{if(!recOn.current)return;recOn.current=false;setRecording(false);log.current.duration=Math.max(log.current.duration,performance.now()-clock.current.start);const snapshot=structuredClone(log.current);saved.current=snapshot;setSavedCount(snapshot.events.length);setSavedDuration(snapshot.duration);void saveLog(snapshot).then(()=>setNotice('Rekaman F1 tersimpan lokal.')).catch(()=>setNotice('Rekaman di memori; IndexedDB gagal. Ekspor JSON.'));};
 const startRecord=()=>{if(current.current.cue!=='F1'||!current.current.running){setNotice('Jalankan F1 terlebih dahulu.');return;}live.clear();log.current=emptyLog();clock.current.start=performance.now();recOn.current=true;setRecording(true);setCount(0);setNotice('Merekam event visual F1.');};
 const disarm=()=>{armedRef.current=false;setArmed(false);machine.disarm();punch.reset();captureGen.current++;};
 const selectCue=(id:CueId)=>{stopRecord();disarm();setRunning(false);setCue(id);setBlank({floor:false,canvas:false});archiveVideo.current?.pause();setElapsed(0);setNotice('Cue '+id+' dipilih. Tekan GO untuk preview.');};
 const go=()=>{if(cue==='F3B'&&(!saved.current.events.length||!archive||photoStore.count<1)){setNotice('F3B memerlukan rekaman F1, arsip, dan minimal satu foto penonton yang disetujui.');return;}if(cue==='F2'&&!archive){setNotice('Pilih arsip video atau gambar.');return;}
  if(cue==='F1'&&!fresh(bindings.cam1)){setNotice('Camera 01 belum mengirim frame segar.');return;}
  if(cue==='F3A'&&(!bindings.cam2||bindings.cam2===bindings.cam3||!fresh(bindings.cam2)||!fresh(bindings.cam3))){setNotice('Hubungkan dua sumber berbeda untuk F3.');return;}
  setBlank({floor:false,canvas:false});setRunning(true);clock.current.replayStart=performance.now();clock.current.index=0;replay.clear();if(cue==='F1'){live.clear();clock.current.start=performance.now();}if(cue==='F2'||cue==='F3B')void archiveVideo.current?.play().catch(()=>setNotice('Video belum bisa diputar.'));setNotice('Preview '+cue+' berjalan. Output fisik belum diotorisasi.');
 };
 const stop=()=>{stopRecord();disarm();setRunning(false);archiveVideo.current?.pause();setNotice('Cue dihentikan.');};
 const blackout=()=>{stop();setBlank({floor:true,canvas:true});};
 const blackoutRef=useRef(blackout);blackoutRef.current=blackout;
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'||(e.code==='KeyB'&&!['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName))){blackoutRef.current();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[machine]);
 const capture=async(eventId:string,preset:'manual'|'straight'='manual')=>{
  const b=current.current.bindings,now=performance.now(),f=registry.feed(b.cam2),aFresh=fresh(b.cam3,now),bFresh=fresh(b.cam2,now);
  if(current.current.cue!=='F3A'||!current.current.running||!consentRef.current||!armedRef.current||!f||b.cam2===b.cam3||!machine.begin(eventId,aFresh,bFresh,photoStore.count<4))return;
  const epoch=captureGen.current;try{await photoStore.capture({video:f.video,crop:framing.crop(f.video.videoWidth,f.video.videoHeight),cameraId:b.cam2,frameId:registry.get(b.cam2)?.frames??0,sourceTimestamp:now,preset,consent:true,eventId,fresh:bFresh,stillValid:()=>alive.current&&captureGen.current===epoch&&consentRef.current&&armedRef.current&&fresh(b.cam2)&&fresh(b.cam3)});
   machine.complete(photoStore.count);machine.readyAgain();setPhotos(photoStore.count);if(photoStore.count>=4)disarm();
  }catch(e){machine.failed();disarm();setNotice(String(e));}
 };
 const arm=async()=>{if(!consentRef.current||!running||cue!=='F3A'||bindings.cam2===bindings.cam3||!fresh(bindings.cam2)||!fresh(bindings.cam3)){setNotice('Butuh consent, dua sumber segar, dan F3A GO.');return;}
  machine.setDevices(true,true);machine.setConsent(true);machine.setVerified(true);if(!machine.arm(true,true))return;armedRef.current=true;setArmed(true);setNotice('Capture manual aktif; memuat detektor gestur…');
  try{await fusion.init();if(alive.current&&armedRef.current)setNotice('Gesture siap. Pukulan atau tombol Foto.');else if(!alive.current)fusion.dispose();}catch(e){setNotice('Gesture tidak tersedia; gunakan capture manual. '+String(e));}
 };
 useEffect(()=>{let raf=0;
  const tick=(now:number)=>{raf=requestAnimationFrame(tick);const s=current.current,cf=floor.current?.getContext('2d'),cc=canvas.current?.getContext('2d');if(!cf||!cc)return;
   const f=registry.feed(s.bindings.cam1),a=registry.feed(s.bindings.cam3),b=registry.feed(s.bindings.cam2);
   const fLive=fresh(s.bindings.cam1,now),aLive=fresh(s.bindings.cam3,now),bLive=fresh(s.bindings.cam2,now);
   if(!s.running){fill(cf);fill(cc);return;}
   if(s.cue==='F1'){
    const at=Math.max(0,now-clock.current.start);
    if(fLive&&f?.frame){live.ingest(f.frame,s.bindings.cam1,f.video.videoWidth/Math.max(1,f.video.videoHeight),at,(e)=>{live.apply(e);if(recOn.current&&!appendEvent(log.current,e)){stopRecord();setNotice('Batas sesi tercapai. Rekaman disimpan.');}});}
    if(!s.blank.floor&&fLive)live.paintFloor(cf,at,s.decay);else fill(cf);
    if(!s.blank.canvas&&fLive)live.paintTrace(cc,at);else fill(cc);
   }else if(s.cue==='F2'){fill(cf);fill(cc);if(!s.blank.canvas){if(s.archive?.video&&archiveVideo.current)fit(cc,archiveVideo.current);else if(archiveImage.current)fit(cc,archiveImage.current);}}
   else if(s.cue==='F3A'){fill(cf);if(!aLive||!bLive){if(armedRef.current)disarm();fill(cc);}else if(!s.blank.canvas&&consentRef.current&&a&&b){
    if(fusion.status==='ready'&&armedRef.current&&now-clock.current.lastGesture>90&&a.video.currentTime!==clock.current.lastGestureTime){clock.current.lastGesture=now;clock.current.lastGestureTime=a.video.currentTime;try{const m=fusion.sample(a.video,++clock.current.serial,now);if(m){framing.step(m,now);if(framing.resizing)punch.pauseResize(now);else{const result=punch.step(m,now,true);if(result.kind==='capture'&&result.eventId)void capture('gesture-'+result.eventId+'-'+captureGen.current,'straight');}}}catch{disarm();setNotice('Detektor gestur berhenti; arm ulang untuk lanjut.');}}
    const stage=makeF3StageFrame({sourceId:s.bindings.cam2,frameId:registry.get(s.bindings.cam2)?.frames??0,timestamp:now,crop:framing.crop(b.video.videoWidth,b.video.videoHeight),slots:photoStore.slots,state:'LIVE'});stage.overlay={...stage.overlay,corners:false,liveIndicator:false};drawF3Stage(cc,stage,a.video,b.video);
   }else fill(cc);}
   else{const at=Math.min(saved.current.duration,now-clock.current.replayStart);clock.current.index=replayUntil(saved.current,clock.current.index,at,e=>replay.apply(e));if(!s.blank.floor)replay.paintFloor(cf,at,s.decay);else fill(cf);if(!s.blank.canvas){replay.paintTrace(cc,at);if(s.archive?.video&&archiveVideo.current)fit(cc,archiveVideo.current,.36);else if(archiveImage.current)fit(cc,archiveImage.current,.36);
    photoStore.slots.forEach((p,i)=>{if(!p)return;let im=images.current.get(p.url);if(!im){im=new Image();im.src=p.url;images.current.set(p.url,im);}if(im.complete&&im.naturalWidth)cc.drawImage(im,32+(i%2)*215,32+Math.floor(i/2)*175,205,165);});}else fill(cc);}
   if(now-clock.current.lastUi>220){clock.current.lastUi=now;setCount(log.current.events.length);setElapsed(s.cue==='F3B'?Math.min(saved.current.duration,now-clock.current.replayStart):now-clock.current.replayStart);setLiveRoles(roles.filter(r=>fresh(s.bindings[r],now)));setHealth(s.cue==='F1'?live.reason:s.cue==='F3A'?(aLive&&bLive?'Dua kamera siap':'Kamera F3 terputus'):'Media / replay');}
  };raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[registry,live,replay,photoStore,framing,punch,fusion]);
 useEffect(()=>{const t=window.setInterval(()=>setLiveRoles(roles.filter(r=>fresh(current.current.bindings[r]))),350);return()=>clearInterval(t);},[registry]);
 const bind=(role:Role,id:string)=>{if(running){setNotice('Hentikan cue sebelum mengganti sumber.');return;}setBindings(b=>({...b,[role]:id}));if(role==='cam1')live.resetTracking();else{disarm();fusion.resetFrames();framing.reset();}};
 const exportLog=()=>{const data=recOn.current?log.current:saved.current;if(!data.events.length){setNotice('Belum ada event.');return;}const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const el=document.createElement('a');el.href=url;el.download='soma-f1-session.json';el.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const full=(surface:Surface)=>{const el=surface==='floor'?floor.current:canvas.current;if(el)void el.requestFullscreen().catch(()=>setNotice('Fullscreen tidak tersedia.'));};
 const selectedSource=records.find(r=>r.id===selected),selectedRole=roles.find(r=>r===selected);
 return <div className="soma-node-v5"><header className="nv-top"><div className="nv-brand"><Network size={22}/><b>SOMA</b><span>NODE CANVAS</span><em>BETA</em></div><div className="nv-actions"><span>{liveRoles.length}/3 role siap</span><button onClick={()=>{blackout();const url=new URL(location.href);url.search='';location.assign(url.toString());}}>Studio lama</button><button className="nv-stop" onClick={blackout}><Square size={14}/> Blackout</button></div></header>
 <div className="nv-toolbar"><div><b>Unpacking / In Passing</b><small>ONE GRAPH · LOCAL PREVIEW</small></div><div className="nv-actions"><button onClick={()=>setZoom(z=>Math.max(.55,z-.1))}>−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(1.5,z+.1))}>+</button><button onClick={()=>setZoom(Math.min(1,Math.max(.55,(window.innerWidth-300)/1030)))}>Fit</button></div></div>
 <main className="nv-main"><section className="nv-work"><div className="nv-sourcebar"><div className="nv-source-title"><Camera size={17}/><b>Camera Inputs</b><span>{records.length} sumber</span></div><select aria-label="Perangkat kamera" value={device} onChange={e=>setDevice(e.target.value)}><option value="">Pilih kamera / beri izin</option>{devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'Kamera '+d.deviceId.slice(0,5)}</option>)}</select><button onClick={()=>void addDevice()}><Plus size={14}/> Camera</button><button onClick={addPhone}><Plus size={14}/> HP QR</button><button aria-label="Perbarui perangkat" onClick={()=>void refresh()}><RefreshCw size={14}/></button></div>
 <div className="nv-sources">{records.length===0&&<span className="nv-muted">Belum ada kamera. Tambahkan perangkat melalui tombol Camera atau HP QR.</span>}{records.map(r=><button className={'nv-source '+(selected===r.id?'selected':'')} key={r.id} onClick={()=>setSelected(r.id)}><FeedThumbnail registry={registry} id={r.id}/><b>{r.name}</b><small>{r.phase==='live'&&hubFrameIsFresh(r.frameAt,performance.now(),950)?'FRAME LIVE':r.phase.toUpperCase()} · {Math.round(r.fps)} fps</small><small>{roles.filter(k=>bindings[k]===r.id).join(' / ')||'Belum dirutekan'}</small></button>)}</div>
 <div className="nv-scroll" aria-label="Unified node graph"><div style={{width:1030*zoom,height:775*zoom}}><div className="nv-graph" style={{transform:'scale('+zoom+')'}}><div className="nv-columns">{['INPUT','DETECT','GENERATE','COMPOSE / STORE','OUTPUT'].map(t=><span key={t}>{t}</span>)}</div>
 <svg className="nv-wires" width="1030" height="775" aria-hidden="true">{graph.edges.map(e=>{const a=layout[e.from.nodeId],b=layout[e.to.nodeId],x=a[0]+170,y=a[1]+46,x2=b[0],y2=b[1]+46,m=(x+x2)/2;return <path key={e.id} d={'M'+x+' '+y+' C'+m+' '+y+' '+m+' '+y2+' '+x2+' '+y2} className={activeEdges.has(e.id)?'route selected-route':'route'}/>;})}</svg>
 {graph.nodes.map(n=>{const [x,y]=layout[n.id],role=roles.find(r=>r===n.id),ready=role?liveRoles.includes(role):n.id==='saved'?savedCount>0:n.id==='photos'?photos>0:n.id==='archive'?!!archive:false;return <button key={n.id} className={'nv-node '+n.kind+(selected===n.id?' chosen':'')+(activeNodes.has(n.id)?' in-cue':'')} style={{left:x,top:y}} onClick={()=>setSelected(n.id)}><span className="nv-node-kind">{n.kind.replaceAll('-',' ')}<i className={ready?'ready':''}/></span><b>{n.label}</b><small>{role?(records.find(r=>r.id===bindings[role])?.name||'Pilih sumber'):labels[n.id]}</small></button>;})}</div></div></div>
 <div className="nv-cues"><span>CUES</span>{(Object.keys(cueNames) as CueId[]).map(id=><button className={id===cue?'current':''} key={id} onClick={()=>selectCue(id)}><b>{id}</b><small>{cueNames[id]}</small></button>)}<button className="nv-go" disabled={running} onClick={go}><Play size={14}/> GO</button><button onClick={stop}>Stop</button></div></section>
 <aside className="nv-right"><section className="nv-monitor"><div><Monitor size={14}/><b>FLOOR</b><small>PREVIEW</small><button aria-label="Fullscreen lantai" onClick={()=>full('floor')}><Maximize size={14}/></button><button onClick={()=>setBlank(v=>({...v,floor:!v.floor}))}>{blank.floor?'Tampilkan':'Black'}</button></div><canvas ref={floor} width={1600} height={900}/></section><section className="nv-monitor"><div><Monitor size={14}/><b>CANVAS</b><small>PREVIEW</small><button aria-label="Fullscreen kanvas" onClick={()=>full('canvas')}><Maximize size={14}/></button><button onClick={()=>setBlank(v=>({...v,canvas:!v.canvas}))}>{blank.canvas?'Tampilkan':'Black'}</button></div><canvas ref={canvas} width={1600} height={900}/></section>
 <section className="nv-inspector"><p>INSPECTOR</p><h3>{selectedSource?.name??graph.nodes.find(n=>n.id===selected)?.label}</h3>
 {selectedRole&&<><label>Camera source<select value={bindings[selectedRole]} onChange={e=>bind(selectedRole,e.target.value)}><option value="">Belum terhubung</option>{records.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><small>Ganti sumber saat cue berhenti.</small></>}
 {selectedSource&&<><p>{selectedSource.message}</p>{roles.map(r=><button key={r} onClick={()=>bind(r,selectedSource.id)}>Route → {r.toUpperCase()}</button>)}{selectedSource.kind==='device'&&<button onClick={()=>void registry.connect(selectedSource.id)}>Sambungkan ulang</button>}<button onClick={()=>{if(running){setNotice('Stop cue terlebih dahulu.');return;}registry.remove(selectedSource.id);setBindings(b=>Object.fromEntries(roles.map(r=>[r,b[r]===selectedSource.id?'':b[r]])) as RoleMap);setSelected('cam1');}}><Trash2 size={14}/> Hapus</button></>}
 {records.filter(r=>r.kind==='phone').map(r=><div key={r.id} hidden={selected!==r.id}><PhoneCameraReceiver initialMode="qr" onStream={stream=>registry.connectPhone(r.id,stream)} onDisconnect={()=>registry.disconnect(r.id)}/></div>)}
 {['foot','floorMix','floor','trace','pose'].includes(selected)&&<><label>Footprint decay · {Math.round(decay/1000)}s<input type="range" min="1000" max="60000" step="1000" value={decay} onChange={e=>setDecay(+e.target.value)}/></label><button onClick={()=>live.resetTracking()}>Reset identitas A/B</button></>}
 {['archive','canvasMix','canvas'].includes(selected)&&<label><Film size={14}/> Pilih media lokal<input type="file" accept="video/*,image/*" onChange={e=>{const f=e.target.files?.[0];if(f){setArchive({url:URL.createObjectURL(f),name:f.name,video:f.type.startsWith('video/')});setNotice(f.name);}}}/>{archive?.name}</label>}
 {['rec','saved','replay'].includes(selected)&&<><button disabled={recording||cue!=='F1'||!running} onClick={startRecord}>REC F1</button><button disabled={!recording} onClick={stopRecord}>Stop & simpan</button><button onClick={exportLog}><Download size={14}/> Ekspor JSON</button><small>{savedCount} event tersimpan · {Math.round(savedDuration/1000)}s</small></>}
 {['capture','hand','photos','cam2','cam3'].includes(selected)&&<><label className="nv-check"><input type="checkbox" checked={consent} onChange={e=>{const v=e.target.checked;consentRef.current=v;setConsent(v);machine.setConsent(v);if(!v){disarm();photoStore.revokeAll();images.current.clear();setPhotos(0);}}}/> Persetujuan penonton</label><button disabled={!consent||armed} onClick={()=>void arm()}>Arm capture</button><button disabled={!armed} onClick={()=>void capture('manual-'+Date.now())}>Foto manual</button><button onClick={()=>{disarm();photoStore.revokeAll();images.current.clear();setPhotos(0);}}>Hapus foto</button><small>{photos}/4 foto · {armed?'ARMED':'DISARMED'}</small></>}
 <p className="nv-note">Garis terang = jalur cue terpilih, bukan jaminan signal LIVE. Kalibrasi dan output fisik masih melalui Studio lama.</p></section>
 <section className="nv-status"><b>{cue} · {running?'RUNNING':'READY'}</b><span>{Math.round(elapsed/1000)}s · {health}</span><span>{recording?'REC · '+count+' events':'REC OFF'}</span><span role="status">{notice}</span></section></aside></main>
 {archive?.video&&<video key={archive.url} ref={archiveVideo} src={archive.url} muted loop playsInline style={{display:'none'}}/>}{archive&&!archive.video&&<img key={archive.url} ref={archiveImage} src={archive.url} alt="" style={{display:'none'}}/>}</div>;
}
