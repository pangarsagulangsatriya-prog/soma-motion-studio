import {useEffect,useState,type RefObject} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import {cameraBinding,cameraBindingKey,type LiveFloorTrackingEngine} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import {runtimeDiagnostics,type RuntimeDiagnostics} from './runtimeDiagnostics.ts';
import './runtime-diagnostics.css';
type Props={frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 tracker:LiveFloorTrackingEngine;router:MultiPoseGaitRouter;
 ready:boolean;performers:1|2;paintFpsRef:RefObject<number|null>};
const metric=(n:number|null,unit='')=>n===null?'—':Math.round(n)+unit;
export function RuntimeDiagnosticsPanel(p:Props){
 const [open,setOpen]=useState(false);
 const [data,setData]=useState<RuntimeDiagnostics|null>(null);
 useEffect(()=>{
  if(!open){setData(null);return;}
  const tick=()=>{const binding=cameraBinding(p.videoRef.current);
   setData(runtimeDiagnostics({frame:p.frameRef.current,identity:p.router.previewStatus,
    floor:p.tracker.status,cameraMatched:!!binding&&p.tracker.boundCamera===cameraBindingKey(binding),
    now:performance.now(),cameraReady:p.ready,performers:p.performers,paintFps:p.paintFpsRef.current}));};
  tick();const timer=window.setInterval(tick,500);return()=>window.clearInterval(timer);
 },[open,p.ready,p.performers,p.frameRef,p.videoRef,p.router,p.tracker,p.paintFpsRef]);
 return <details className="soma-runtime-diagnostics" onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary>Diagnostik runtime</summary>
  {open&&data&&<div className="soma-runtime-content">
   <p className="soma-runtime-reason">{data.blocker}</p>
   <dl>
    <dt>Pose mentah / ID</dt><dd>{data.detected} / {data.assigned}</dd>
    <dt>Telapak / gait valid</dt><dd>{data.validFeet}/{data.expectedFeet} · {data.gaitFeet}/{data.expectedFeet}</dd>
    <dt>Backend</dt><dd>{data.backend??'—'}</dd>
    <dt>Pose FPS (avg)</dt><dd>{metric(data.poseFps)}</dd>
    <dt>Track loop FPS</dt><dd>{metric(data.paintFps)}</dd>
    <dt>Inferensi / pipeline</dt><dd>{metric(data.inferenceMs,' ms')} / {metric(data.pipelineMs,' ms')}</dd>
    <dt>Usia frame</dt><dd>{metric(data.frameAgeMs,' ms')}</dd>
    <dt>Skip terhitung</dt><dd>{metric(data.skippedFrames)}</dd>
    <dt>Kontak sesi Map</dt><dd>{data.contacts}</dd>
   </dl>
   {data.actors.map(a=><div className="soma-runtime-actor" key={a.id}>
    <strong>{a.id} · {a.state}</strong>
    {a.feet.map(f=><span key={f.side}>{f.side} {f.state} {metric(f.confidence===null?null:f.confidence*100,'%')}</span>)}
   </div>)}
   <small>Confidence landmark, bukan akurasi terukur. Waktu browser, bukan latency proyektor.</small>
  </div>}
 </details>;
}
