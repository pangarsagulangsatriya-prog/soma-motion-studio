import type {CameraFloorCalibration} from '../../footprints/spatial/coordinates.ts';
import {useEffect,useRef,useState,type RefObject} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import type {FullscreenDiagnostics} from '../../footprints/lines/FullscreenInputDiagnostics.ts';
import {paintFullscreenInputDiagnostics} from '../../footprints/lines/FullscreenInputDiagnostics.ts';
import {resolveFullscreenInput} from '../../footprints/lines/FullscreenInputSource.ts';
import {normalizeTrajectoryInput} from '../../footprints/lines/v3/SourceFrameNormalizer.ts';
import {DualFootTrajectoryEngine} from '../../footprints/lines/v3/DualFootTrajectoryEngine.ts';
import type {V3Settings} from '../../footprints/lines/v3/TrajectoryRenderer.ts';
import {PainterlyImpressionEngine} from '../../footprints/lines/v3/PainterlyImpressionEngine.ts';
import {paintPainterlyCanvas,type PainterlySettings} from '../../footprints/lines/v3/PainterlyCanvasRenderer.ts';
import {adaptFootBrushFrame,type PoseAdapterState} from '../../footprints/lines/v3/FootBrushPoseAdapter.ts';
import {FootContactGestureEngine} from '../../footprints/lines/v3/FootContactGestureEngine.ts';
import {buildFootBrushDabs} from '../../footprints/lines/v3/FootBrushGeometryBuilder.ts';
import {FootBrushDepositStore} from '../../footprints/lines/v3/FootBrushStrokeRenderer.ts';
import {ObservedMotionInkEngine} from '../../footprints/lines/v3/ObservedMotionInkEngine.ts';
import {buildSumiStrokeGeometry} from '../../footprints/lines/v3/SumiStrokeGeometryBuilder.ts';
import {PersistentInkStore} from '../../footprints/lines/v3/PersistentInkStore.ts';
import {resolveActorColor} from '../../footprints/lines/v3/ActorPaletteResolver.ts';
import {PainterlyPreviewTransform} from '../../footprints/lines/v3/PainterlyPreviewTransform.ts';
import {PathObservationRouter,type ActorPathObservation} from '../../footprints/lines/v3/PathObservationRouter.ts';
import {ActorPathTracker} from '../../footprints/lines/v3/ActorPathTracker.ts';
import {PersistentPathStore} from '../../footprints/lines/v3/PersistentPathStore.ts';
import {dualTracePoseFrames} from '../../footprints/dual-trace/DualTracePoseFrameBus.ts';
import {upperGestureAnchors} from '../../footprints/dual-trace/UpperGestureAnchorAdapter.ts';
import {UpperGestureStrokeTracker} from '../../footprints/dual-trace/UpperGestureStrokeTracker.ts';
import {UpperGestureInkRenderer} from '../../footprints/dual-trace/UpperGestureInkRenderer.ts';
import {DualTraceCanvasHost} from './DualTraceCanvasHost.tsx';
import {DualTraceControls} from './DualTraceControls.tsx';
import './dual-trace.css';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import './line-trails-v3.css';

/** Technical markers are drawn only on the Compose Stage Monitor.
 * Fullscreen projector feed stays clean and the Map homography is untouched. */
function paintPathPrecisionOverlay(ctx:CanvasRenderingContext2D,
 samples:readonly {actorId:string;foot:'left'|'right';x:number;y:number;confidence:number}[],
 observations:readonly ActorPathObservation[],view:{scale:number;tx:number;ty:number}|undefined){
 ctx.save();
 if(view)ctx.setTransform(view.scale,0,0,view.scale,view.tx,view.ty);
 ctx.font='13px monospace';ctx.lineWidth=2;
 for(const s of samples){
  if(s.confidence<.55)continue;
  const actor=s.actorId==='B'||s.actorId==='performer-2'?'B':'A';
  ctx.strokeStyle=actor==='A'?'#E44F32':'#242424';
  ctx.beginPath();ctx.arc(s.x*1600,s.y*900,6,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=ctx.strokeStyle;ctx.fillText(s.foot==='left'?'L':'R',s.x*1600+9,s.y*900-8);
 }
 for(const o of observations){
  ctx.strokeStyle=o.actorId==='A'?'#E44F32':'#242424';
  ctx.lineWidth=2.5;ctx.beginPath();
  ctx.moveTo(o.point.x-8,o.point.y);ctx.lineTo(o.point.x+8,o.point.y);
  ctx.moveTo(o.point.x,o.point.y-8);ctx.lineTo(o.point.x,o.point.y+8);ctx.stroke();
  const label=o.actorId+' · '+(o.motionBasis??'estimasi')+
   (o.supportFoot?' '+o.supportFoot:'')+' · 2D';
  ctx.fillStyle='#F5F5F2';ctx.fillRect(o.point.x+11,o.point.y-25,
   Math.min(360,label.length*8+10),22);
  ctx.fillStyle=ctx.strokeStyle;ctx.fillText(label,o.point.x+15,o.point.y-10);
 }
 ctx.restore();
}

type StageProps={
 fullscreenRef:RefObject<HTMLDivElement|null>;
 frameRef:RefObject<MotionFrame>;
 videoRef:RefObject<HTMLVideoElement|null>;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 router:MultiPoseGaitRouter;engine:DualFootTrajectoryEngine;settings:V3Settings;
 cameraFloorCalibration?:CameraFloorCalibration|null;
 videoFloorCalibration?:CameraFloorCalibration|null;
 outputRaster?:RefObject<HTMLCanvasElement|null>;
 impressions:PainterlyImpressionEngine;painterly:PainterlySettings;brushResetRevision?:number;
 motionEvents?:()=>readonly FootMotionEventV2[];
 fullscreenDiagnostics:FullscreenDiagnostics;blackout:boolean;previewLive:boolean;
 cameraOn:boolean;bodySelected:boolean;performerCount:1|2;
 experimentSource:'video'|'simulator'|null;sourceKind:'camera'|'phone';
 demo:boolean;motionSession?:()=>string;
 onStatus:(text:string)=>void;
 onDiagnostics?:(text:string)=>void;
 onRegisterExportInk?:(fn:()=>string|null)=>void;
 onRegisterInkArchive?:(api:{save:()=>string|null;load:(data:string)=>Promise<void>})=>void;
};

export function LineTrailsV3Stage(props:StageProps){
 const canvas=useRef<HTMLCanvasElement|null>(null);
 const upperCanvas=useRef<HTMLCanvasElement|null>(null);
 const footPane=useRef<HTMLDivElement|null>(null);
 const upperPane=useRef<HTMLDivElement|null>(null);
 const clearTriggers=useRef({foot:0,upper:0});
 const available=useRef(false);
 const [hasUpper,setHasUpper]=useState(false);
 const args=useRef(props);args.current=props;
 const demoStart=useRef(0);
 useEffect(()=>{demoStart.current=performance.now();},[props.demo]);
 useEffect(()=>{
  let raf=0,lastDraw=0,lastStatus='',lastStatusAt=0,lastSource='';
  let lastFrameMs=-1,lastPaused=false,lastSeeking=false,lastStale=false,lastGoodAt=0;
  let lastDiag=0;
  const gestures=new FootContactGestureEngine();
  const brushStore=new FootBrushDepositStore();
  const sumiMotion=new ObservedMotionInkEngine();
  const sumiStore=new PersistentInkStore();
  const pathRouter=new PathObservationRouter();
  const pathTracker=new ActorPathTracker();
  const pathStore=new PersistentPathStore();
  const upperTracker=new UpperGestureStrokeTracker();
  const upperInk=new UpperGestureInkRenderer();
  let lastFootClear=0,lastUpperClear=0,upperMode=false;
  const upperReady=(ready:boolean)=>{
   if(available.current!==ready){available.current=ready;setHasUpper(ready);}
  };
  const brushUpper=()=>{
   const q=args.current.painterly;
   return {headEnabled:q.dualHeadEnabled??true,
    shoulderEnabled:q.dualShoulderEnabled??true,
    headWidth:q.dualHeadWidth??8,shoulderWidth:q.dualShoulderWidth??16,
    headOpacity:q.dualHeadOpacity??.75,shoulderOpacity:q.dualShoulderOpacity??.9,
    colors:{A:args.current.settings.actorColors.A,B:args.current.settings.actorColors.B}};
  };
  const cutUpper=(reason:string)=>{
   for(const event of upperTracker.cutAll(reason))
    upperInk.ingest(event,brushUpper());
  };
  let lastPathObservations:ActorPathObservation[]=[];
  const pathStyle=(actor:'A'|'B')=>{
   const options=args.current.painterly;
   return {color:args.current.settings.actorColors[actor],
    weightPx:options.pathWeightPx??26,
    material:options.pathMaterial??'path-sumi',
    accents:options.pathAccents??'subtle'} as const;
  };
  const cutPath=(reason:string)=>{
   for(const event of pathTracker.cutAll(reason))
    pathStore.ingest(event,pathStyle(event.actorId));
   pathRouter.reset();lastPathObservations=[];
  };
  const viewFit=new PainterlyPreviewTransform();
  args.current.onRegisterExportInk?.(()=>
   ['path-first-v35','dual-trace-v1'].includes(args.current.painterly.painterlyEngine??'')?
    pathStore.exportPNG():sumiStore.exportPNG());
  args.current.onRegisterInkArchive?.({save:()=>
   ['path-first-v35','dual-trace-v1'].includes(args.current.painterly.painterlyEngine??'')?
    pathStore.exportSessionJSON():sumiStore.exportSessionJSON(),
   load:async data=>{
    sumiMotion.cutMotionSegment('import');cutPath('import');
    if(['path-first-v35','dual-trace-v1'].includes(args.current.painterly.painterlyEngine??''))
     await pathStore.importSessionJSON(data);
    else await sumiStore.importSessionJSON(data);
    viewFit.reset();
   }});
  let brushAdapter:PoseAdapterState={lastFrameMs:-1,epoch:0,sourceKey:''};
  let brushSource='';
  let brushMode=false;
  let sumiMode=false;
  let pathMode=false;
  let lastPathOff=false;
  let lastBrushResetRevision=args.current.brushResetRevision??0;
  const clearBrush=()=>{brushStore.reset();gestures.reset();
   brushAdapter={lastFrameMs:-1,epoch:brushAdapter.epoch+1,sourceKey:''};};
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);
   if(now-lastDraw<1000/45)return;
   lastDraw=now;
   const p=args.current;
   const c=canvas.current,ctx=c?.getContext('2d');
   if(!ctx)return;
   const input=normalizeTrajectoryInput({
    nowMs:now,demo:p.demo,demoStart:demoStart.current,
    experimentSource:p.experimentSource,experiment:p.experimentFrameRef?.current??null,
    live:p.frameRef.current,cameraOn:p.cameraOn,bodySelected:p.bodySelected,
    performers:p.performerCount,status:p.router.status,sourceKind:p.sourceKind,
    motionSession:p.motionSession?.()??'track'
   });
   let message=input.status;
   if(clearTriggers.current.foot!==lastFootClear){
    lastFootClear=clearTriggers.current.foot;
    p.engine.reset('manual-reset');p.impressions.reset();
    if(p.painterly.painterlyEngine!=='dual-trace-v1')clearBrush();
    cutPath('clear-foot');pathStore.clearPainting();viewFit.reset();
   }
   if(clearTriggers.current.upper!==lastUpperClear){
    lastUpperClear=clearTriggers.current.upper;
    cutUpper('clear-gesture');upperInk.clear();
   }
   const resetRevision=p.brushResetRevision??0;
   if(resetRevision!==lastBrushResetRevision){
    clearBrush();sumiMotion.cutMotionSegment('user-clear');
    sumiStore.clearPainting();cutPath('user-clear');pathStore.clearPainting();
    cutUpper('clear-both');upperInk.clear();
    viewFit.reset();lastBrushResetRevision=resetRevision;
   }
   const nextBrushMode=p.painterly.enabled&&p.painterly.painterlyEngine==='foot-brush-v33';
   const nextSumiMode=p.painterly.enabled&&p.painterly.painterlyEngine==='sumi-v34';
   const nextDualMode=p.painterly.enabled&&p.painterly.painterlyEngine==='dual-trace-v1';
   const nextPathMode=p.painterly.enabled&&
    (p.painterly.painterlyEngine==='path-first-v35'||nextDualMode);
   if(nextDualMode!==upperMode){
    cutUpper('renderer-switch');upperMode=nextDualMode;
    if(!upperMode)upperReady(false);
   }
   if(nextPathMode!==pathMode){cutPath('renderer-switch');pathMode=nextPathMode;}
   if(nextSumiMode!==sumiMode){sumiMotion.cutMotionSegment('renderer-switch');sumiMode=nextSumiMode;}
   if(nextBrushMode!==brushMode){clearBrush();brushMode=nextBrushMode;}
   if(input.sourceKey!==brushSource){clearBrush();sumiMotion.cutMotionSegment('source-switch');
    cutPath('source-switch');cutUpper('source-switch');upperReady(false);
    brushSource=input.sourceKey;}
   if(input.sourceKey!==lastSource){
    lastSource=input.sourceKey;lastFrameMs=-1;lastPaused=false;lastSeeking=false;lastStale=false;lastGoodAt=now;
    p.engine.ensureSource(input.sourceKey);
    p.impressions.ensureSource(input.sourceKey);
   }
   const off=p.blackout||!p.previewLive;
   if(off&&!lastPathOff){cutPath('preview-off');cutUpper('preview-off');}
   lastPathOff=off;
   if(off){
    p.engine.cutAll('manual-reset');
    // Any later frame must start a fresh stroke; retained pigment stays until cleared.
    gestures.reset();sumiMotion.cutMotionSegment('preview-off');
    message='Preview padam';
   }else{
    if(input.seeking){
     if(!lastSeeking){p.engine.reset('seek');p.impressions.reset();clearBrush();
       sumiMotion.cutMotionSegment('seek');cutPath('seek');cutUpper('seek');}
     lastSeeking=true;
     message='MP4 · memindahkan posisi video';
    }else{
     lastSeeking=false;
     if(!input.ready){
      const waiting=input.status.includes('tertunda')||input.status.includes('menunggu')||
       input.status.includes('belum');
      // Pose inference in MP4 is asynchronous. Do not cut all four feet
      // immediately because a single decoded frame overtook its pose result.
      // A later valid frame will still cut a >390ms gap in the tracking engine.
      const graceMs=input.source==='video'?1000:500;
      if(waiting&&!lastStale&&now-lastGoodAt>graceMs){
       p.engine.cutAll('stale-frame');gestures.reset();sumiMotion.cutMotionSegment('stale');
        cutPath('stale');cutUpper('stale');upperReady(false);lastStale=true;
      }
     }else if(input.frameMs!==lastFrameMs){
      p.engine.ingestFrame(input.samples,input.frameMs,now);
      p.impressions.ingestFrame(input.samples,input.frameMs,input.source);
      if(nextBrushMode||nextSumiMode||nextPathMode){
       const batch=adaptFootBrushFrame(input.samples,input.sourceKey,
        input.frameMs,brushAdapter);
       brushAdapter=batch.state;
       if(batch.cut){gestures.reset();sumiMotion.cutMotionSegment('frame-cut');cutPath('frame-cut');cutUpper('frame-cut');}
       if(nextDualMode&&!input.paused){
        const poseFrames=dualTracePoseFrames(input,{
         experiment:p.experimentFrameRef?.current??null,
         live:p.frameRef.current,performers:p.performerCount,status:p.router.status
        }).filter(frame=>p.settings.actors[frame.actorId]);
        const upperSettings=brushUpper();
        const anchors=poseFrames.flatMap(frame=>upperGestureAnchors(frame,
         p.painterly.dualGain??1.35,
         {head:upperSettings.headEnabled,shoulder:upperSettings.shoulderEnabled}
        )).filter(a=>!upperInk.isReplayCovered(a));
        upperReady(anchors.length>0);
        for(const event of upperTracker.ingest(anchors,input.frameMs,
         p.painterly.dualSmoothing??.42))upperInk.ingest(event,upperSettings);
       }
       if(nextPathMode&&!input.paused){
        const mp4Video=p.experimentFrameRef?.current?.kind==='video'?
         p.experimentFrameRef.current.video:null;
        const activeVideo=input.source==='video'?mp4Video:p.videoRef.current;
        const activeCalibration=input.source==='video'?p.videoFloorCalibration:
         input.source==='camera'||input.source==='phone'?p.cameraFloorCalibration:null;
        const spatial=activeCalibration&&activeVideo?.videoWidth&&activeVideo?.videoHeight?
         {calibration:activeCalibration,
          videoAspect:activeVideo.videoWidth/activeVideo.videoHeight,
          calibrationId:input.source+':'+JSON.stringify(activeCalibration)}:undefined;
         const observations=pathRouter.ingest(batch.poses,input.supportHints,spatial).filter(o=>!pathStore.isReplayCovered(o));
         lastPathObservations=observations;
        const pathEvents=pathTracker.ingest(observations,input.frameMs);
        for(const event of pathEvents){
         if(!p.settings.actors[event.actorId])continue;
         pathStore.ingest(event,pathStyle(event.actorId));
        }
       }
       if(nextSumiMode&&!input.paused){
        const events=sumiMotion.ingest(batch.poses);
        for(const event of events){
         const weight=p.painterly.sumiWeightPx??56;
         const expression=p.painterly.sumiExpression??'bold';
         const geometry=buildSumiStrokeGeometry(event,{weightPx:weight,expression});
         if(!geometry)continue;
         let hash=2166136261;
         const key=event.id+':'+sumiStore.paintingSessionId;
         for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
         const color=resolveActorColor(event.actorId,event.foot,
          p.settings.actorColors,p.settings.footOverrides,'#F5F5F2');
         const actor=event.actorId==='B'||event.actorId==='performer-2'?'B':'A';
         if(!p.settings.actors[actor]||!p.settings.footVisible[actor][event.foot])continue;
         sumiStore.appendOnce(event,geometry,{color,weightPx:weight,expression,
          material:p.painterly.sumiMaterial??'sumi',seed:hash>>>0});
        }
       }
       if(nextBrushMode)for(const event of gestures.ingest(batch.poses)){
        if(event.kind!=='imprint'&&event.kind!=='drag'&&event.kind!=='pivot')continue;
        const dabs=buildFootBrushDabs(event.from??event.pose,event.pose,
         event.kind,{pivot:event.pivot});
        brushStore.append(dabs,event.id);
       }
      }
      if(input.source!=='demo'&&p.motionEvents)
       p.impressions.ingestContacts(p.motionEvents(),input.source,input.frameMs);
      lastFrameMs=input.frameMs;lastGoodAt=now;
      lastStale=false;
     }
     if(input.paused){
      if(!lastPaused)cutUpper('pause');
      message='MP4 dijeda · jejak dipertahankan';
     }
     if(lastPaused&&!input.paused)lastStale=false;
     lastPaused=input.paused;
    }
   }
   const fullscreen=document.fullscreenElement===p.fullscreenRef.current;
   const view=nextPathMode?viewFit.update(pathStore.getBounds(),!nextDualMode&&!!p.painterly.previewFit):
    nextSumiMode?viewFit.update(sumiStore.getBounds(),!!p.painterly.previewFit):undefined;
   const footSettings=nextDualMode?
    {...p.painterly,painterlyEngine:'path-first-v35' as const}:p.painterly;
   paintPainterlyCanvas(ctx,p.engine,p.impressions,p.settings,footSettings,
    input.presentationMs,off,fullscreen,brushStore,sumiStore,view,pathStore);
   // Clean Compose raster feeds Map and Perform without debug markers.
   const shared=p.outputRaster?.current;
   if(shared&&c){
    if(shared.width!==c.width)shared.width=c.width;
    if(shared.height!==c.height)shared.height=c.height;
    const out=shared.getContext('2d');
    if(out){out.setTransform(1,0,0,1,0,0);out.clearRect(0,0,shared.width,shared.height);
     if(!off)out.drawImage(c,0,0);}
   }
   if(nextDualMode){
    const uc=upperCanvas.current?.getContext('2d');
    if(uc)upperInk.paint(uc,brushUpper(),off);
   }
   if(nextPathMode&&p.painterly.pathDiagnostics&&!off&&!fullscreen)
    paintPathPrecisionOverlay(ctx,input.samples,lastPathObservations,view);
   if(!off&&fullscreen&&(p.fullscreenDiagnostics.camera||p.fullscreenDiagnostics.skeleton)){
    // Diagnostics live only on explicit V/K; V3 fullscreen default is clean.
    paintFullscreenInputDiagnostics(ctx,p.fullscreenDiagnostics,resolveFullscreenInput({
     frameRef:p.frameRef,videoRef:p.videoRef,
     experimentInputCanvas:p.experimentInputCanvas,experimentFrameRef:p.experimentFrameRef,
     experimentSource:p.experimentSource,cameraOn:p.cameraOn,
     performerCount:p.performerCount,router:p.router,selectedActor:'A',demo:p.demo
    },now));
   }
   if(message!==lastStatus&&now-lastStatusAt>150){
    lastStatus=message;lastStatusAt=now;p.onStatus(message);
   }
   if(now-lastDiag>480){
    lastDiag=now;
    const recent=p.engine.diagnostics.slice(-4);
    const reasons=recent.filter(x=>!x.accepted).map(x=>x.id+': '+x.reason);
    const cutSummary=p.engine.diagnostics.filter(x=>!x.accepted)
     .reduce<Record<string,number>>((sum,x)=>{const key=x.reason??'invalid';
      sum[key]=(sum[key]??0)+1;return sum;},{});
    const lag=input.source==='video'&&input.frameMs>=0?
     Math.round(input.presentationMs-input.frameMs):null;
    p.onDiagnostics?.([
     'Sumber: '+input.source+' · '+(input.ready?'frame siap':'frame belum siap'),
     'Frame: '+Math.max(0,input.frameMs).toFixed(0)+' ms',
     ...(lag===null?[]:['Selisih media/pose: '+lag+' ms']),
     'Jalur: '+p.engine.activeCount+' kaki · '+p.engine.sampleCount+' titik',
      ...(nextDualMode?['Upper: '+upperInk.activeCount+' kanal · '+upperInk.committedCount+' sapuan']:[]),
      ...(nextPathMode?['Path A/B: '+pathStore.activeCount+' aktif · '+pathStore.depositCount+' commit',
       'Ruang: '+((input.source==='video'?p.videoFloorCalibration:p.cameraFloorCalibration)?'lantai terkalibrasi (estimasi)':'image-2d / ruang perkiraan'),
       '2D: '+lastPathObservations.map(o=>o.actorId+':'+o.motionBasis).join(','),
       'Cut: '+JSON.stringify(pathTracker.cutDiagnostics)]:[]),
     'Cap: '+p.impressions.count+' ('+p.impressions.estimatedCount+' estimasi)',
     'Cut: '+JSON.stringify(cutSummary),
     ...(reasons.length?reasons:['Basis: '+(input.source==='video'?'image-2d':input.source)])
    ].join(' | '));
   }
  };
  raf=requestAnimationFrame(paint);
  return()=>{cancelAnimationFrame(raf);args.current.engine.cutAll('manual-reset');sumiMotion.cutMotionSegment('unmount');cutPath('unmount');cutUpper('unmount');
    args.current.onRegisterExportInk?.(()=>null);args.current.onRegisterInkArchive?.({save:()=>null,load:async()=>{}});};
 },[]);
 const dualEnabled=props.painterly.enabled&&
  props.painterly.painterlyEngine==='dual-trace-v1';
 const exportUpper=()=>{
  const png=upperCanvas.current?.toDataURL('image/png');
  if(!png)return;
  const link=document.createElement('a');link.href=png;
  link.download='soma-dual-trace-upper.png';link.click();
 };
 return <DualTraceCanvasHost enabled={dualEnabled}
  footRef={canvas} upperRef={upperCanvas} fullscreenRef={props.fullscreenRef}
  footPaneRef={footPane} upperPaneRef={upperPane}
  hasUpper={hasUpper}
  sourceIsFootOnly={props.demo||props.experimentSource==='simulator'}
  onClearFoot={()=>{clearTriggers.current.foot++;}}
  onClearUpper={()=>{clearTriggers.current.upper++;}}
  onClearBoth={()=>{clearTriggers.current.foot++;clearTriggers.current.upper++;}}
  onExportUpper={exportUpper}/>;
}

type PanelProps={
 settings:V3Settings;onChange:(next:V3Settings)=>void;
 painterly:PainterlySettings;onPainterlyChange:(next:PainterlySettings)=>void;
 impressions:PainterlyImpressionEngine;
 engine:DualFootTrajectoryEngine;onClear:()=>void;onExportPNG?:()=>void;
 onSaveSession?:()=>void;onLoadSession?:()=>void;demo:boolean;onDemo:()=>void;
 status:string;diagnostics:string;performerCount:1|2;
 onUseV2:()=>void;fullscreenDiagnostics:FullscreenDiagnostics;
 onFullscreenDiagnostics:(next:FullscreenDiagnostics)=>void;
};
export function LineTrailsV3Panel({settings,onChange,painterly,onPainterlyChange,
 impressions,engine,onClear,onExportPNG,onSaveSession,onLoadSession,demo,onDemo,status,diagnostics,
 performerCount,onUseV2,fullscreenDiagnostics,onFullscreenDiagnostics}:PanelProps){
 const actorColor=(actor:'A'|'B',value:string)=>onChange({
  ...settings,actorColors:{...settings.actorColors,[actor]:value}
 });
 const actorVisible=(actor:'A'|'B',value:boolean)=>onChange({
  ...settings,actors:{...settings.actors,[actor]:value}
 });
 const footVisible=(actor:'A'|'B',foot:'left'|'right',value:boolean)=>onChange({
  ...settings,footVisible:{...settings.footVisible,
   [actor]:{...settings.footVisible[actor],[foot]:value}}
 });
 const footOverride=(actor:'A'|'B',foot:'left'|'right',value:string|undefined)=>{
  const previous={...(settings.footOverrides[actor]??{})};
  if(value)previous[foot]=value;else delete previous[foot];
  const next={...settings.footOverrides};
  if(Object.keys(previous).length)next[actor]=previous;else delete next[actor];
  onChange({...settings,footOverrides:next});
 };
 const activeActors=performerCount===2?(['A','B'] as const):(['A'] as const);
 const material=(value:PainterlySettings['material'])=>onPainterlyChange({...painterly,material:value});
 const sumi=painterly.painterlyEngine==='sumi-v34';
 const pathMode=painterly.painterlyEngine==='path-first-v35';
 const dualMode=painterly.painterlyEngine==='dual-trace-v1';
 const inkMode=sumi||pathMode;
 const change=(patch:Partial<PainterlySettings>)=>onPainterlyChange({...painterly,...patch});
 if(dualMode)return <DualTraceControls painterly={painterly}
  onPainterlyChange={onPainterlyChange} settings={settings}
  onSettingsChange={onChange} onClear={onClear} onDemo={onDemo}
  demo={demo} status={status} onExportFoot={()=>onExportPNG?.()}
  onExit={()=>change({painterlyEngine:'path-first-v35'})}/>;
 return <section className="lt-beta-controls lt-v3-controls lt-painterly-controls" aria-label="Kontrol Garis V3">
  <header><strong>Garis · Painterly</strong><span>{pathMode?'V3.5 PATH':sumi?'V3.4 SUMI':painterly.painterlyEngine==='foot-brush-v33'?'V3.3 BETA':'V3.2 BETA'}</span></header>
  <div className="lt-painterly-material" role="group" aria-label="Engine lukisan">
   <button type="button" aria-pressed={false}
    onClick={()=>{
     onChange({...settings,actorColors:{A:'#E84B32',B:'#202226'}});
     change({painterlyEngine:'dual-trace-v1',pathWeightPx:22,
      footprintLifeMs:6000,footprintKeep:false,showSoles:true,showTrails:true,
      trailKeep:true,dualGain:1.35,dualHeadEnabled:true,
      dualShoulderEnabled:true,dualHeadWidth:8,dualShoulderWidth:16,
      dualHeadOpacity:.75,dualShoulderOpacity:.9,dualSmoothing:.42,
      previewFit:false});
    }}>Dual Trace · BETA</button>
   <button type="button" aria-pressed={pathMode} onClick={()=>change({
     painterlyEngine:'path-first-v35',pathWeightPx:painterly.pathWeightPx??26,
     pathMaterial:painterly.pathMaterial??'path-sumi',pathAccents:painterly.pathAccents??'subtle',
     footprintLifeMs:6000,footprintKeep:false,trailKeep:true,
     showTrails:true,showSoles:true
    })}>Path Sumi V3.5</button>
    <button type="button" aria-pressed={sumi} onClick={()=>change({
    painterlyEngine:'sumi-v34',sumiMaterial:'sumi',sumiWeightPx:painterly.sumiWeightPx??56,
    sumiExpression:'bold',footprintLifeMs:6000,footprintKeep:false,trailKeep:true,
    showTrails:true,showSoles:true
   })}>Sumi V3.4</button>
   <button type="button" aria-pressed={painterly.painterlyEngine==='foot-brush-v33'}
    onClick={()=>change({painterlyEngine:'foot-brush-v33',footprintLifeMs:8000,trailLifeMs:4000,
     footprintKeep:false,trailKeep:false})}>Kuas V3.3</button>
   <button type="button" aria-pressed={!inkMode&&painterly.painterlyEngine!=='foot-brush-v33'}
    onClick={()=>change({painterlyEngine:'legacy-v32',material:'ink',footprintLifeMs:8000,
     trailLifeMs:4000,footprintKeep:false,trailKeep:false})}>V3.2</button>
  </div>
  <p className="lt-beta-status" role="status"><i data-live={status.includes('terbaca')||demo}/>{status}</p>
  <div className="lt-painterly-material" role="group" aria-label="Material lukisan">
   {pathMode?([{id:'path-sumi',label:'Sumi'},{id:'dry-ink',label:'Kering'},
       {id:'pigment-mass',label:'Pekat'}] as const).map(m=>
       <button key={m.id} type="button" aria-pressed={(painterly.pathMaterial??'path-sumi')===m.id}
        onClick={()=>change({pathMaterial:m.id})}>{m.label}</button>):
     sumi?([{id:'sumi',label:'Sumi'},{id:'dry-brush',label:'Kuas Kering'},
      {id:'dense-pigment',label:'Pigmen Pekat'}] as const).map(m=>
      <button key={m.id} type="button" aria-pressed={(painterly.sumiMaterial??'sumi')===m.id}
       onClick={()=>change({sumiMaterial:m.id})}>{m.label}</button>):
     ([{id:'ink',label:'Tinta'},{id:'charcoal',label:'Arang'},
       {id:'pigment',label:'Pigmen'}] as const).map(m=>
      <button key={m.id} type="button" aria-pressed={painterly.material===m.id}
       onClick={()=>material(m.id)}>{m.label}</button>)}
  </div>
  <div className="lt-painterly-layers">
   <div className="lt-painterly-layer">
    <label><input aria-label="Tampilkan tapak kaki" type="checkbox"
     checked={painterly.showSoles} onChange={e=>change({showSoles:e.target.checked})}/>
     <strong>Tapak kaki</strong></label>
    <label className="lt-painterly-stay"><input type="checkbox"
     aria-label="Tapak tetap" checked={painterly.footprintKeep}
     onChange={e=>change({footprintKeep:e.target.checked})}/>Tetap</label>
    <label className="lt-painterly-duration">Hilang <output>{painterly.footprintKeep?'Tetap':Math.round(painterly.footprintLifeMs/1000)+' dtk'}</output>
     <input type="range" min="1" max="30" step="1"
      aria-label="Durasi tapak kaki" disabled={painterly.footprintKeep||!painterly.showSoles}
      value={Math.round(painterly.footprintLifeMs/1000)}
      onChange={e=>change({footprintLifeMs:Number(e.target.value)*1000})}/>
    </label>
   </div>
   <div className="lt-painterly-layer">
    <label><input aria-label="Tampilkan garis lintasan" type="checkbox"
     checked={painterly.showTrails} onChange={e=>change({showTrails:e.target.checked})}/>
     <strong>{pathMode?'Jalur tinta':sumi?'Sapuan tinta':'Garis lintasan'}</strong></label>
    <label className="lt-painterly-stay"><input type="checkbox"
     aria-label="Garis tetap" checked={inkMode?true:painterly.trailKeep}
     disabled={inkMode}
     onChange={e=>change({trailKeep:e.target.checked})}/>Tetap</label>
    <label className="lt-painterly-duration">{inkMode?'Tinta menetap':'Hilang'} <output>{inkMode||painterly.trailKeep?'Tetap':Math.round(painterly.trailLifeMs/1000)+' dtk'}</output>
     <input type="range" min="1" max="30" step="1"
      aria-label="Durasi garis lintasan" disabled={inkMode||painterly.trailKeep||!painterly.showTrails}
      value={Math.round(painterly.trailLifeMs/1000)}
      onChange={e=>change({trailLifeMs:Number(e.target.value)*1000})}/>
    </label>
   </div>
  </div>
  {activeActors.map(actor=><div key={actor} className="lt-v31-actor">
   <label htmlFor={'v31-actor-color-'+actor}><strong>Aktor {actor}</strong>
    <small>{actor==='A'?'Merah':'Hitam arang'} · dua kaki</small></label>
   <input type="color" id={'v31-actor-color-'+actor}
    aria-label={'Warna Aktor '+actor} value={settings.actorColors[actor]}
    onChange={e=>actorColor(actor,e.target.value)}/>
   <input type="checkbox" checked={settings.actors[actor]}
    aria-label={'Tampilkan Aktor '+actor}
    onChange={e=>actorVisible(actor,e.target.checked)}/>
  </div>)}
  <details className="lt-painterly-characters"><summary>Karakter garis</summary>
  <div className="lt-v31-character" role="group" aria-label="Karakter garis">
   {([{value:'precision',label:'Presisi'},
      {value:'fluid',label:'Luwes'},
      {value:'paint',label:'Lukis'}] as const).map(mode=>
    <button key={mode.value} type="button"
     aria-pressed={settings.styleMode===mode.value}
     onClick={()=>onChange({...settings,styleMode:mode.value})}>{mode.label}</button>)}
  </div>
  </details>
  {pathMode?<><label className="lt-beta-width">Bobot jalur <output>{painterly.pathWeightPx??26} px</output>
      <input type="range" min={8} max={64} step={2}
       aria-label="Bobot jalur Sumi" value={painterly.pathWeightPx??26}
       onChange={e=>change({pathWeightPx:Number(e.target.value)})}/>
     </label>
     <div className="lt-v31-character" role="group" aria-label="Aksen tinta">
      {([{id:'off',label:'Mati'},{id:'subtle',label:'Halus'},
         {id:'expressive',label:'Ekspresif'}] as const).map(x=>
       <button key={x.id} type="button"
        aria-pressed={(painterly.pathAccents??'subtle')===x.id}
        onClick={()=>change({pathAccents:x.id})}>{x.label}</button>)}
     </div>
     <label className="lt-painterly-stay"><input type="checkbox" aria-label="Komposisi preview"
       checked={!!painterly.previewFit}
       onChange={e=>change({previewFit:e.target.checked})}/>Komposisi preview</label>
     <label className="lt-painterly-stay"><input type="checkbox"
      aria-label="Periksa presisi jalur" checked={!!painterly.pathDiagnostics}
      onChange={e=>change({pathDiagnostics:e.target.checked})}/>
      Periksa presisi · hanya Stage Monitor</label>
    </>:sumi?<><label className="lt-beta-width">Bobot kuas <output>{painterly.sumiWeightPx??56} px</output>
   <input type="range" min={8} max={96} step={2}
    aria-label="Bobot kuas Sumi" value={painterly.sumiWeightPx??56}
    onChange={e=>change({sumiWeightPx:Number(e.target.value)})}/>
   </label>
   <label className="lt-painterly-stay"><input type="checkbox" aria-label="Komposisi preview" checked={!!painterly.previewFit}
     onChange={e=>change({previewFit:e.target.checked})}/>Komposisi preview (tidak mengubah Map)</label>
   <div className="lt-v31-character" role="group" aria-label="Ekspresi kuas">
    {([{id:'bold',label:'Tebal'},{id:'natural',label:'Natural'}] as const).map(x=>
     <button key={x.id} type="button"
      aria-pressed={(painterly.sumiExpression??'bold')===x.id}
      onClick={()=>change({sumiExpression:x.id})}>{x.label}</button>)}
   </div></>:<label className="lt-beta-width">Ketebalan <output>{settings.width} px</output>
   <input type="range" min={1} max={12} step={1}
    aria-label="Ketebalan lintasan" value={settings.width}
    onChange={e=>onChange({...settings,width:Number(e.target.value)})}/>
  </label>}
  <div className="lt-beta-actions">
   <button type="button" onClick={onClear}>{inkMode?'Bersihkan Lukisan':'Bersihkan'}</button>
   {inkMode&&<button type="button" onClick={onExportPNG} aria-label="Simpan lukisan PNG">Simpan PNG</button>}
   {inkMode&&<details className="lt-painterly-characters"><summary>Arsip lukisan</summary>
    <button type="button" onClick={onSaveSession}>Simpan sesi JSON</button>
    <button type="button" onClick={onLoadSession}>Pulihkan sesi JSON</button>
   </details>}
   <button type="button" className="lt-beta-demo" aria-pressed={demo} onClick={onDemo}>
    {demo?'Hentikan Demo':'Coba Demo'}
   </button>
  </div>
  <small className="lt-beta-count">{engine.sampleCount} titik · {engine.allStrokes.length} segmen ·
   · {impressions.count} cap ({impressions.estimatedCount} estimasi) · Posisi 2D</small>
  <details className="lt-v31-foot-details">
   <summary>Detail kaki</summary>
   <p>Warna kedua kaki mengikuti aktor, kecuali saat warna khusus diaktifkan.</p>
   {activeActors.map(actor=><div key={actor} className="lt-v31-foot-group">
    <strong>Aktor {actor}</strong>
    {(['left','right'] as const).map(foot=>{
     const override=settings.footOverrides[actor]?.[foot];
     return <div className="lt-v31-foot-row" key={foot}>
      <span>{foot==='left'?'Kiri':'Kanan'}</span>
      <label><input type="checkbox" checked={Boolean(override)}
       aria-label={'Warna khusus '+actor+' '+foot}
       onChange={e=>footOverride(actor,foot,
        e.target.checked?settings.actorColors[actor]:undefined)}/> Khusus</label>
      <input type="color" aria-label={'Warna '+actor+' '+foot}
       value={override??settings.actorColors[actor]} disabled={!override}
       onChange={e=>footOverride(actor,foot,e.target.value)}/>
      <input type="checkbox" aria-label={'Tampilkan '+actor+' '+foot}
       checked={settings.footVisible[actor][foot]}
       onChange={e=>footVisible(actor,foot,e.target.checked)}/>
     </div>;
    })}
   </div>)}
  </details>
  <details className="lt-v3-debug">
   <summary>Periksa jalur</summary>
   <label><input type="checkbox" checked={settings.debug}
    onChange={e=>onChange({...settings,debug:e.target.checked})}/> Titik mentah dan hasil filter</label>
   <p>{diagnostics}</p>
   <small>Jejak pendek tetap tersimpan di engine. Luwes/Lukis hanya merapikan visual;
    Presisi menampilkan seluruh segmen valid.</small>
  </details>
  <details className="lt-v3-advanced">
   <summary>Pengaturan lanjutan</summary>
   <label><input type="checkbox"
    aria-label="Aktifkan Kuas V3.3 eksperimental"
    checked={painterly.painterlyEngine==='foot-brush-v33'}
    onChange={e=>change({painterlyEngine:e.target.checked?'foot-brush-v33':'legacy-v32'})}/>
    Kuas V3.3 (eksperimental · fallback V3.2 tersedia)</label>
   <label><input type="checkbox" checked={painterly.enabled}
    onChange={e=>change({enabled:e.target.checked})}/> Painterly aktif (matikan untuk Lintasan klasik)</label>
   <label>Ukuran tapak <output>{painterly.sizePx} px</output>
    <input type="range" min="30" max="110" step="2" aria-label="Ukuran tapak"
     value={painterly.sizePx} onChange={e=>change({sizePx:Number(e.target.value)})}/>
   </label>
   <div className="lt-v3-three" role="group" aria-label="Latar garis">
    <button type="button" aria-pressed={settings.background==='#F5F5F2'}
     onClick={()=>onChange({...settings,background:'#F5F5F2'})}>Terang</button>
    <button type="button" aria-pressed={settings.background==='#111512'}
     onClick={()=>onChange({...settings,background:'#111512'})}>Gelap</button>
   </div>
   <label><input type="checkbox" checked={fullscreenDiagnostics.camera}
    onChange={e=>onFullscreenDiagnostics({...fullscreenDiagnostics,camera:e.target.checked})}/>
    Overlay video (V)</label>
   <label><input type="checkbox" checked={fullscreenDiagnostics.skeleton}
    onChange={e=>onFullscreenDiagnostics({...fullscreenDiagnostics,skeleton:e.target.checked})}/>
    Overlay skeleton (K)</label>
   <button type="button" onClick={onUseV2}>Pakai engine V2 (rollback)</button>
  </details>
 </section>;
}
