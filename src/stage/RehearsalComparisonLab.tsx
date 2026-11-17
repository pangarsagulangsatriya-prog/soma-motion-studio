import {useEffect,useRef,useState,type RefObject,type ChangeEvent} from 'react';
import {Activity,Download,Play,Square,UploadCloud,X} from 'lucide-react';
import type {MotionFrame} from '../engine/types.ts';
import type {LiveFloorTrackingEngine} from '../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../footprints/live/MultiPoseGaitRouter.ts';
import {cameraBinding,cameraBindingKey} from '../footprints/live/LiveFloorTrackingEngine.ts';
import type {FootstepEvent} from '../footprints/spatial/events.ts';
import type {FloorSpace} from '../footprints/spatial/coordinates.ts';
import type {ReplayPerformer} from './videoGaitAnalysis.ts';
import {fromReplayReport,parseReferenceReport,selectReferenceSegment,contactMetrics,
 referenceContacts,liveContacts,comparisonWindow,safeLiveCapture,validLiveEvent,
 referenceTimeline,liveTimeline,normalizedLivePath,
 type RehearsalReference,type ReplayReport} from './rehearsalComparisonModel.ts';
import {RehearsalPath,RehearsalTimeline,referenceFootPath} from './RehearsalVisuals.tsx';
import './rehearsal-comparison-lab.css';
type Capture={status:'complete'|'interrupted';reason:string;start:number;end:number;
 duration:number;performers:1|2;floor:FloorSpace;events:FootstepEvent[]};
type Recording={start:number;end:number;cursor:number;performers:1|2;
 floor:FloorSpace;events:FootstepEvent[]};
type Props={frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 tracker:LiveFloorTrackingEngine;router:MultiPoseGaitRouter;
 cameraOn:boolean;bodySelected:boolean;performers:1|2;initialReference:ReplayReport|null;
 onClose:()=>void;onStartCamera:()=>void;onCalibrate:()=>void};
const windows=[10,20,30,60] as const;
const bestSegment=(r:RehearsalReference)=>r.segments.filter(s=>s.firstAtMs!==null&&s.lastAtMs!==null)
 .sort((a,b)=>(b.lastAtMs!-b.firstAtMs!)-(a.lastAtMs!-a.firstAtMs!))[0]?.segment??0;
const shown=(value:number|null|undefined,unit='')=>value===null||value===undefined||!Number.isFinite(value)?
 '—':(Number.isInteger(value)?value.toString():value.toFixed(1))+unit;
export function RehearsalComparisonLab({
 frameRef,videoRef,tracker,router,cameraOn,bodySelected,performers,
 initialReference,onClose,onStartCamera,onCalibrate
}:Props){
 const [reference,setReference]=useState<RehearsalReference|null>(null);
 const [segment,setSegment]=useState(0);
 const [person,setPerson]=useState<ReplayPerformer>('A');
 const [seconds,setSeconds]=useState<number>(30);
 const [capture,setCapture]=useState<Capture|null>(null);
 const [recording,setRecording]=useState(false);
 const [capturedCount,setCapturedCount]=useState(0);
 const [ticker,setTicker]=useState(0);
 const [message,setMessage]=useState('Impor JSON QA S6.5.5 atau kirim hasil dari Video Motion Lab.');
 const picker=useRef<HTMLInputElement>(null),run=useRef<Recording|null>(null);
 const apply=(r:RehearsalReference)=>{
  run.current=null;setRecording(false);setReference(r);setSegment(bestSegment(r));
  setCapture(null);setPerson('A');setMessage('Referensi '+r.name+' dimuat.');
 };
 useEffect(()=>{if(!initialReference)return;try{apply(fromReplayReport(initialReference));}
  catch{setMessage('Referensi tidak valid. Unggah JSON QA.');}},[initialReference]);
 const upload=async(e:ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(file.size>8*1024*1024){setMessage('JSON QA maksimal 8 MB.');return;}
  try{apply(parseReferenceReport(JSON.parse(await file.text())));}
  catch(error){setMessage(error instanceof Error?error.message:'JSON gagal diparsing.');}
 };
 const gate=()=>{
  const f=frameRef.current,ids=router.status,key=cameraBindingKey(cameraBinding(videoRef.current));
  return safeLiveCapture({cameraOn,bodySelected,frameSource:f.source,
   frameTracked:f.tracked,frameAgeMs:performance.now()-f.time,
   floorConfirmed:tracker.isConfirmed,cameraMatched:!!key&&key===tracker.boundCamera,
   performerCount:performers,identityAmbiguous:ids.ambiguous,
   visibleIds:ids.visible,frameMatched:ids.observedFrameTime===f.time});
 };
 const selected=reference?selectReferenceSegment(reference,segment):null;
 const windowMs=comparisonWindow(reference,segment,seconds*1000);
 const finish=(status:'complete'|'interrupted',reason:string,now:number)=>{
  const v=run.current;if(!v)return;run.current=null;setRecording(false);
  const end=Math.min(v.end,Math.max(v.start,now));
  setCapture({status,reason,start:v.start,end,duration:end-v.start,
   performers:v.performers,floor:v.floor,events:[...v.events]});
  setMessage(reason);
 };
 const start=()=>{
  const ready=gate();if(!ready.ready){setMessage(ready.reason);return;}
  if(!reference||windowMs<3000){setMessage('Pilih segmen video minimal 3 detik.');return;}
  const data=tracker.session,floor=tracker.floor;
  if(!data||!floor){setMessage('FloorSession belum siap.');return;}
  const now=performance.now();
  run.current={start:now,end:now+windowMs,cursor:data.events.length,
   performers,floor:{...floor},events:[]};
  setCapture(null);setCapturedCount(0);setRecording(true);
  setMessage('Merekam event baru dari FloorSession; event historis dikecualikan.');
 };
 useEffect(()=>{
  const timer=window.setInterval(()=>{
   const now=performance.now();setTicker(Math.floor(now/200));
   const v=run.current;if(!v)return;
   const readiness=gate();if(!readiness.ready){
    finish('interrupted','Kamera/identitas tidak siap: '+readiness.reason,now);return;}
   if(v.performers!==performers){finish('interrupted','Mode performer berubah.',now);return;}
   const data=tracker.session,floor=tracker.floor;
   if(!data||!floor||data.events.length<v.cursor||
    floor.widthM!==v.floor.widthM||floor.depthM!==v.floor.depthM){
    finish('interrupted','FloorSession/kalibrasi berganti.',now);return;}
   for(const e of data.events.slice(v.cursor)){
    if(validLiveEvent(e,v.start,v.end,v.performers))v.events.push(e);
   }
   v.cursor=data.events.length;setCapturedCount(v.events.length);
   if(now>=v.end)finish('complete','Perekaman latihan selesai.',v.end);
  },200);
  return()=>window.clearInterval(timer);
 },[tracker,router,frameRef,videoRef,cameraOn,bodySelected,performers]);
 const readiness=gate();void ticker;
 const full=!!capture&&capture.status==='complete'&&capture.duration>=windowMs-250&&windowMs>0;
 const referenceMetrics=selected&&reference?contactMetrics(
  referenceContacts(reference,segment,person),selected.startMs,windowMs):null;
 const liveMetrics=full?contactMetrics(liveContacts(capture.events,person),capture.start,windowMs):null;
 const refMarks=selected?referenceTimeline(selected.events,selected.startMs,windowMs,person):[];
 const liveMarks=full?liveTimeline(capture.events,capture.start,windowMs,person,capture.performers):[];
 const refPath=selected?referenceFootPath(selected.events,selected.startMs,selected.startMs+windowMs,person):[];
 const livePath=full?normalizedLivePath(capture.events,capture.floor,person):[];
 const elapsed=run.current?Math.max(0,Math.min(windowMs,performance.now()-run.current.start)):0;
