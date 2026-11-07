import {useEffect,useRef,useState} from 'react';
import type {AudioEngine} from '../engine/audio';
import type {InputKind,MotionFrame,Settings} from '../engine/types';
import {uid} from '../engine/types';
import {download} from '../engine/recording';
import {tillemaProject} from './fixture';
import {readProject,saveProject,validateArchiveProject,getAsset,putAsset,deleteAsset,assetAvailability} from './store';
import {ArchiveMotion} from './motion';
import {ArchiveRules} from './rules';
import {ArchiveVoice} from './voice';
import {StageCues} from './cues';
import {ProjectionChannel} from './projection';
import {emptySnapshot,manualActor,type ArchiveProject,type ArchiveSource,type StageAction,type RenderState,type ActorId,type VoiceTrack,type ManualActor} from './types';
import type {CanvasMetrics} from './ArchiveCanvas';

export type ArchiveBridge={active:boolean;engine:AudioEngine;frameRef:React.RefObject<MotionFrame>;videoRef:React.RefObject<HTMLVideoElement|null>;settings:Settings;cameraOn:boolean;cameraBusy:boolean;cameraStatus:string;audioOn:boolean;muted:boolean;recording:boolean;recordSeconds:number;chooseInput:(input:InputKind)=>Promise<void>;startCamera:()=>Promise<void>;stopCamera:()=>void;enableAudio:()=>Promise<boolean>;panic:()=>void;toggleRecording:()=>Promise<void>;openSessions:()=>void;setMaster:(v:number)=>void;exit:()=>void;pointerStart:(e:React.PointerEvent<HTMLDivElement>)=>void;pointerMove:(e:React.PointerEvent<HTMLDivElement>)=>void;pointerEnd:()=>void};
export function useArchive(bridge:ArchiveBridge){
 const [project,setProject]=useState<ArchiveProject>(()=>{try{return readProject();}catch{return tillemaProject();}}),[message,setMessage]=useState(''),[storageStatus,setStorageStatus]=useState('Tersimpan di browser'),[tab,setTab]=useState<'sources'|'motion'|'rules'|'stage'>('stage'),[selectedSource,setSelectedSource]=useState('TIL-1919-NL-02');
 const [mode,setMode]=useState<'live'|'manual'>('manual'),[manual,setManual]=useState({A:manualActor(),B:{...manualActor(),visible:false,x:.7}}),[clean,setClean]=useState(false),[synth,setSynth]=useState(false),[trackingOn,setTrackingOn]=useState(false),[armed,setArmed]=useState(false),[captureDwell,setCaptureDwell]=useState(false);
 const [availability,setAvailability]=useState<Record<string,boolean>>({}),[assetRevision,setAssetRevision]=useState(0),[pending,setPending]=useState(false),[,refresh]=useState(0);
 const runtime=useRef({bridge,project,mode,manual,trackingOn,armed,captureDwell,synth,assetRevision});runtime.current={bridge,project,mode,manual,trackingOn,armed,captureDwell,synth,assetRevision};
 const session=useRef(uid()).current,motion=useRef(new ArchiveMotion()).current,rules=useRef(new ArchiveRules()).current,voice=useRef(new ArchiveVoice(bridge.engine)).current,cues=useRef(new StageCues()).current,projection=useRef(new ProjectionChannel(session)).current;
 const renderRef=useRef<RenderState|null>(null),canvasMetrics=useRef<CanvasMetrics>({fps:0,drawMs:0,inputAgeMs:0,frames:0}),snapshotRef=useRef(emptySnapshot());
 const control=useRef({restore:false,lastUI:0,lastTracked:performance.now(),lostReleased:false,sequence:0,goPending:false,captureBusy:false,manualTriggers:new Set<string>(),lastSource:'',wasActive:false});
 const diagnostics=useRef({startedAt:new Date().toISOString(),ticks:0,lost:0,cues:0,errors:0,maxVoices:0,samples:[] as {at:number;fps:number;drawMs:number;inputAgeMs:number;voices:number;heapBytes:number|null}[],events:[] as {at:string;action:string}[]});
 const log=(action:string)=>{diagnostics.current.events.push({at:new Date().toISOString(),action});if(diagnostics.current.events.length>400)diagnostics.current.events.shift();};
 const notify=(s:string)=>setMessage(s);
 useEffect(()=>{try{readProject();}catch(e){setMessage(`Proyek tersimpan gagal dibaca: ${(e as Error).message} Template Tillema dibuka; berkas ekspor lama masih dapat diimpor.`);}},[]);
 useEffect(()=>{setStorageStatus('Menyimpan…');const timer=setTimeout(()=>{try{saveProject(project);setStorageStatus('Tersimpan di browser');}catch(e){setStorageStatus('Belum tersimpan');notify((e as Error).message);}},400);return()=>clearTimeout(timer);},[project]);
 useEffect(()=>{let alive=true;assetAvailability(project).then(v=>{if(alive)setAvailability(v);}).catch(e=>notify((e as Error).message));return()=>{alive=false;};},[project.sources,project.tracks,project.cues,assetRevision]);
 useEffect(()=>{bridge.engine.setSynthEnabled(!bridge.active||synth);return()=>{};},[bridge.active,synth,bridge.engine]);
 useEffect(()=>{motion.reset();},[bridge.settings.input,mode,motion]);
 const currentCue=()=>runtime.current.project.cues[cues.state.index]??runtime.current.project.cues[0];
 function resetRuntime(){rules.reset();voice.resetCue();control.current.manualTriggers.clear();control.current.restore=false;control.current.goPending=false;setArmed(false);}
 function ready(index:number){resetRuntime();cues.ready(index,runtime.current.project.cues,performance.now());log(`Siapkan cue ${index+1}`);refresh(v=>v+1);}
 function go(){if(control.current.restore){cues.ready(cues.state.index,runtime.current.project.cues,performance.now());control.current.restore=false;}const fromReady=cues.state.phase==='ready';if(cues.go(performance.now())){if(fromReady){rules.reset();voice.resetCue();control.current.goPending=true;}diagnostics.current.cues++;log(`GO ${currentCue().id}`);}refresh(v=>v+1);}
 function hold(){cues.hold(performance.now());voice.release();control.current.manualTriggers.clear();setArmed(false);log('HOLD');refresh(v=>v+1);}
 function restore(){rules.reset();voice.release();control.current.restore=true;control.current.manualTriggers.clear();cues.hold(performance.now());cues.state.freeze=false;setArmed(false);notify('Teks sumber kembali utuh. GO untuk memainkan pemetaan lagi.');log('Kembalikan teks asli');}
 function trigger(id:string){if(cues.state.phase!=='running'||control.current.restore)go();control.current.manualTriggers.add(id);notify('Pemicu operator diterima.');}
 function action(action:StageAction){if(action==='go')go();else if(action==='next')ready(cues.state.index+1);else if(action==='back')ready(cues.state.index-1);else if(action==='hold')hold();else if(action==='restore')restore();else if(action==='freeze'){cues.state.freeze=!cues.state.freeze;log(cues.state.freeze?'Bekukan visual':'Lepas visual');}else if(action==='blank'){cues.state.blank=!cues.state.blank;log(cues.state.blank?'Layar hitam':'Buka layar');}else{voice.release();bridge.panic();log('Mute darurat');}refresh(v=>v+1);}
 async function loadVoices(){
  const p=runtime.current.project;for(const track of p.tracks){if(voice.statuses.get(track.id)==='ready'||voice.statuses.get(track.id)==='loading')continue;try{const asset=await getAsset(track.assetId);if(!asset)continue;const duration=await voice.load(track,asset);if(duration>0&&Math.abs(duration-track.durationMs)>1)setProject(prev=>{const invalid=prev.segments.filter(s=>s.trackId===track.id&&s.endMs>duration+1).map(s=>s.id);if(invalid.length)notify('Segmen di luar durasi rekaman dilepas. Periksa kembali penanda kata.');return {...prev,tracks:prev.tracks.map(t=>t.id===track.id?{...t,durationMs:duration}:t),segments:prev.segments.filter(s=>!invalid.includes(s.id)),rules:prev.rules.map(r=>({...r,segmentIds:r.segmentIds.filter(id=>!invalid.includes(id))}))};});}catch(e){notify(`Rekaman gagal dibuka: ${(e as Error).message}`);diagnostics.current.errors++;}}
  refresh(v=>v+1);
 }
 async function enableAudio(){if(await runtime.current.bridge.enableAudio()){runtime.current.bridge.engine.setMaster(runtime.current.bridge.settings.master);await loadVoices();}}
 function playReading(cue=currentCue()){
  const tracks=runtime.current.project.tracks.filter(t=>t.sourceId===cue.sourceId&&(cue.language==='both'||t.language===cue.language));const simultaneous=cue.onGo!=='judgment'&&runtime.current.project.rules.some(r=>cue.ruleIds.includes(r.id)&&r.audioAction==='crossfade');let delay=0;let played=false;
  for(const lang of ['nl','id'] as const){const track=tracks.find(t=>t.language===lang);if(track){played=voice.play(track,undefined,{delay,stamp:snapshotRef.current.timestampMs})||played;if(!simultaneous)delay+=voice.duration(track.id)/1000+.12;}}
  if(!played)notify(bridge.engine.muted||!bridge.engine.enabled?'Audio belum aktif. Klik Aktifkan audio.':'Rekaman pembacaan belum tersedia. Impor rekaman untuk sumber cue ini.');
 }
 async function capture(){
  const v=runtime.current.bridge.videoRef.current;if(control.current.captureBusy)return;if(!v||v.readyState<2||!runtime.current.bridge.cameraOn){notify('Foto belum diambil. Aktifkan kamera dan tunggu gambar tersedia.');return;}
  control.current.captureBusy=true;setArmed(false);
  try{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d')!;if(runtime.current.bridge.settings.mirror){ctx.translate(c.width,0);ctx.scale(-1,1);}ctx.drawImage(v,0,0);const blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Foto gagal dibuat.')),'image/jpeg',.9));const asset=await putAsset(blob,`Foto panggung ${new Date().toISOString()}.jpg`,'image',uid());
   const source:ArchiveSource={id:uid(),kind:'image',title:'Foto panggung · '+new Date().toLocaleTimeString('id-ID'),author:'Tangkapan kamera oleh operator',year:String(new Date().getFullYear()),citation:'Kamera sesi SOMA; tangkapan atas tindakan operator / aturan yang disiagakan.',language:'other',originalText:'',workingTranslation:'',provenance:'user-supplied',rights:'Foto pemain; kelola izin pemakaian bersama pemain.',notes:'Pembekuan satu frame; tersimpan di browser ini.',assetId:asset.id,createdAt:asset.createdAt};
   setProject(p=>({...p,sources:[...p.sources,source],cues:p.cues.map((q,i)=>i===cues.state.index?{...q,mediaId:asset.id,layout:'live-photo',mediaAction:'original'}:q)}));setAssetRevision(v=>v+1);notify('Satu foto diambil. Buka Arsip untuk ekspor atau hapus.');log('Satu foto kamera diambil');
  }catch(e){notify((e as Error).message);}finally{control.current.captureBusy=false;}
 }
 useEffect(()=>{
  projection.start();const timer=setInterval(()=>{
   const r=runtime.current,k=control.current,now=performance.now();if(!r.bridge.active){if(k.wasActive){voice.release();cues.hold(now);if(renderRef.current)projection.send({...renderRef.current,stage:{...cues.state,blank:true}});}k.wasActive=false;return;}k.wasActive=true;
   try{
    diagnostics.current.ticks++;voice.heartbeat();r.bridge.engine.setMaster(r.bridge.settings.master);
    const snap=r.mode==='manual'?motion.manual(r.manual.A,r.manual.B,now):motion.process(r.bridge.frameRef.current,r.project.calibration,now,r.bridge.settings.mirror);snapshotRef.current=snap;
    const visible=snap.actors.some(a=>a.visible&&!a.uncertain);if(visible){k.lastTracked=now;k.lostReleased=false;}else if(now-k.lastTracked>r.project.calibration.lostHoldMs+450&&!k.lostReleased){voice.release();diagnostics.current.lost++;k.lostReleased=true;setArmed(false);}
    if(cues.tick(now,r.project.cues)){rules.reset();voice.resetCue();k.restore=false;k.goPending=true;setArmed(false);diagnostics.current.cues++;}
    const cue=r.project.cues[cues.state.index]??r.project.cues[0];
    if(k.goPending){k.goPending=false;if(cue.onGo==='read'||cue.onGo==='judgment')playReading(cue);if(cue.onGo==='capture')void capture();if(cue.onGo==='restore'){k.restore=true;voice.release();}}
    const running=cues.state.phase==='running'&&!cues.state.freeze&&!k.restore;
    if(running&&cues.state.elapsedMs>1400)for(const id of k.manualTriggers){rules.trigger(id,now);k.manualTriggers.delete(id);}
    const activeRules=r.project.rules.filter(rule=>cue.ruleIds.includes(rule.id));
    let effects=renderRef.current?.effects??[];
    if(k.restore||cues.state.phase==='ready'||cues.state.elapsedMs<1400)effects=[];
    else if(running){effects=rules.step(activeRules,snap,now,r.project.calibration.lostHoldMs);voice.tick(cue.onGo==='judgment'?activeRules.map(rule=>({...rule,audioAction:rule.audioAction==='once'?'none':rule.audioAction})):activeRules,effects,r.project.tracks,r.project.segments,snap.timestampMs);}
    if(r.armed&&r.captureDwell&&visible&&snap.actors.filter(a=>a.visible).every(a=>a.stillMs>=2500)&&running)void capture();
    const previous=renderRef.current;const frozen=cues.state.freeze&&previous;
    renderRef.current={sessionId:session,sequence:++k.sequence,cueId:cue.id,cueLabel:cue.label,stage:{...cues.state},timestampMs:now,source:r.project.sources.find(s=>s.id===cue.sourceId)??null,language:cue.language,layout:cue.layout,effects:frozen?previous.effects:effects,snapshot:frozen?previous.snapshot:snap,output:r.project.output,skeleton:cue.skeleton,trackingOn:r.trackingOn,showCitation:cue.showCitation,mediaId:cue.mediaId,mediaRevision:r.assetRevision,mediaAction:cue.mediaAction,mediaTimeMs:cue.mediaStartMs+(frozen?Math.max(0,previous.mediaTimeMs-cue.mediaStartMs):cues.state.elapsedMs)};
    if(projection.opened)projection.send(renderRef.current);
    if(now-k.lastUI>200){refresh(v=>v+1);k.lastUI=now;}
    if(diagnostics.current.ticks%30===0){const memory=(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory;diagnostics.current.maxVoices=Math.max(diagnostics.current.maxVoices,voice.active);diagnostics.current.samples.push({at:now,...canvasMetrics.current,voices:voice.active,heapBytes:memory?.usedJSHeapSize??null});if(diagnostics.current.samples.length>1800)diagnostics.current.samples.shift();}
   }catch(e){diagnostics.current.errors++;notify(`Sesi ditahan: ${(e as Error).message}`);voice.release();cues.hold(now);}
  },33);
  return()=>{clearInterval(timer);voice.dispose();projection.close();};
 },[motion,rules,voice,cues,projection,session]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(!bridge.active||(e.target as HTMLElement).closest('input,select,textarea,[contenteditable=true]')||document.querySelector('dialog[open]')||e.repeat)return;if(e.code==='Escape'){setClean(false);return;}const command=(Object.entries(project.shortcuts) as [StageAction,string][]).find(([,key])=>key===e.code)?.[0];if(command){e.preventDefault();e.stopImmediatePropagation();action(command);}};document.addEventListener('keydown',handler,true);return()=>document.removeEventListener('keydown',handler,true);});
 async function importProject(file?:File){if(!file)return;try{if(file.size>3_000_000)throw new Error('Batas proyek JSON 3 MB.');const p=validateArchiveProject(JSON.parse(await file.text()));resetRuntime();voice.clearRecordings();setProject(p);setAssetRevision(v=>v+1);setSelectedSource(p.sources[0].id);cues.ready(0,p.cues,performance.now());motion.reset();setMode('manual');setManual({A:manualActor(),B:{...manualActor(),visible:false,x:.7}});const available=await assetAvailability(p);setAvailability(available);notify(Object.values(available).some(v=>!v)?'Proyek dimuat. Beberapa media belum tersedia; tautkan kembali berkasnya.':'Proyek dimuat. Kamera, audio, dan rekaman mengikuti sesi yang sedang berjalan.');}catch(e){notify((e as Error).message);}}
 async function importVoice(file:File,language:'nl'|'id',sourceId:string,replaceAssetId?:string){setPending(true);try{
  if(file.size>40*1024*1024)throw new Error('Batas rekaman 40 MB. Gunakan potongan pembacaan lebih pendek.');
  const existing=runtime.current.project.tracks.find(t=>t.sourceId===sourceId&&t.language===language),relink=!!replaceAssetId&&!!existing;
  const asset=await putAsset(file,file.name,'audio',replaceAssetId??uid());
  const track:VoiceTrack={...existing,id:existing?.id??uid(),sourceId,language,assetId:asset.id,reader:existing?.reader??'',recordedAt:existing?.recordedAt??new Date().toISOString().slice(0,10),method:existing?.method??'Pembacaan kontemporer; berkas lokal',gain:existing?.gain??.7,durationMs:relink?existing.durationMs:0};
  if(existing)voice.forget(existing.id);if(bridge.engine.enabled&&!bridge.engine.muted)track.durationMs=await voice.load(track,asset);
  const invalid=runtime.current.project.segments.filter(s=>s.trackId===track.id&&(!relink||track.durationMs>0&&s.endMs>track.durationMs+1)).map(s=>s.id);
  setProject(p=>({...p,tracks:[...p.tracks.filter(t=>t.id!==track.id),track],segments:p.segments.filter(s=>!invalid.includes(s.id)),rules:p.rules.map(r=>({...r,segmentIds:r.segmentIds.filter(id=>!invalid.includes(id))}))}));setAssetRevision(v=>v+1);
  notify(relink?(invalid.length?'Berkas ditautkan. Segmen di luar durasi baru dilepas; periksa penanda kata.':'Berkas ditautkan kembali. Segmen dan pemetaan dipertahankan.'):'Pembacaan diimpor. Tandai timecode kata sebelum memasang loop.');
 }catch(e){notify((e as Error).message);}finally{setPending(false);}}
 async function importMedia(file:File,existing?:ArchiveSource){setPending(true);try{
  const kind=file.type.startsWith('video/')?'video':file.type.startsWith('image/')?'image':null;if(!kind)throw new Error('Pilih berkas gambar atau video.');const asset=await putAsset(file,file.name,kind,existing?.assetId??uid());
  const source:ArchiveSource=existing?{...existing,kind,assetId:asset.id}:{id:uid(),kind,title:file.name,author:'',year:'',citation:'',language:'other',originalText:'',workingTranslation:'',provenance:'user-supplied',rights:'Belum dicatat',notes:'',assetId:asset.id,createdAt:asset.createdAt};setProject(p=>({...p,sources:existing?p.sources.map(s=>s.id===existing.id?source:s):[...p.sources,source]}));setSelectedSource(source.id);setAssetRevision(v=>v+1);notify('Media diimpor. Lengkapi sumber dan hak pemakaiannya.');
 }catch(e){notify((e as Error).message);}finally{setPending(false);}}
 async function exportMedia(source:ArchiveSource){if(!source.assetId)return;const asset=await getAsset(source.assetId);if(asset)download(asset.blob,asset.name);else notify('Berkas media belum tersedia.');}
 async function removeMedia(source:ArchiveSource){if(!source.assetId)return;try{await deleteAsset(source.assetId);setAssetRevision(v=>v+1);notify('Berkas media dihapus dari browser. Metadata sumber tetap tersimpan; berkas dapat ditautkan ulang.');}catch(e){notify((e as Error).message);}}
 function exportDiagnostics(){download(new Blob([JSON.stringify({...diagnostics.current,exportedAt:new Date().toISOString(),limits:{physicalCamera:'belum diuji pada perangkat',projectorHDMI:'belum diuji pada perangkat',hardwareLatency:'tidak diukur; inputAgeMs hanya umur snapshot di browser'},audio:{decodedBytes:voice.decodedBytes,active:voice.active,scheduled:voice.scheduled,maxObserved:voice.maxObserved},projectionConnected:projection.connected},null,2)],{type:'application/json'}),'soma-archive-diagnostik.json');}
 return {project,setProject,message,notify,storageStatus,tab,setTab,selectedSource,setSelectedSource,mode,setMode,manual,setManual,clean,setClean,synth,setSynth,trackingOn,setTrackingOn,armed,setArmed,captureDwell,setCaptureDwell,availability,pending,bridge,cues,voice,motion,projection,renderRef,canvasMetrics,snapshot:snapshotRef.current,ready,go,hold,restore,trigger,action,enableAudio,loadVoices,playReading,capture,importProject,importVoice,importMedia,exportMedia,removeMedia,exportDiagnostics,diagnostics:diagnostics.current,
 exportProject:()=>{try{const valid=validateArchiveProject(project);download(new Blob([JSON.stringify(valid,null,2)],{type:'application/json'}),'soma-archive-project.json');notify('JSON diekspor. Media tetap lokal; simpan salinan berkas pembacaan, foto, dan video.');}catch(e){notify((e as Error).message);}},
 updateManual:(id:ActorId,patch:Partial<ManualActor>)=>setManual(m=>({...m,[id]:{...m[id],...patch}}))
 };
}
export type ArchiveController=ReturnType<typeof useArchive>;
