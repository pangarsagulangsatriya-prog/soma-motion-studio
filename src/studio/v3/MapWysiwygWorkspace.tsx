
import {useEffect,useRef,useState,type PointerEvent,type RefObject,type KeyboardEvent} from 'react';
import {Check,Maximize2,Minimize2,Pause,Play,RotateCcw,ScanLine} from 'lucide-react';
import type {Quad,Point} from '../../projection/geometry.ts';
import type {MotionFrame} from '../../engine/types.ts';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import {useMapCalibrationAssist} from './useMapCalibrationAssist.ts';
import {identityQuad,transform,homography} from '../../projection/geometry.ts';
import {cameraBinding,cameraBindingKey,type LiveFloorTrackingEngine} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import {CameraLiveness} from '../../engine/cameraLiveness.ts';
import type {CameraFloorCalibration} from '../../footprints/spatial/coordinates.ts';
import type {StageSurface,StageSurfacePlan} from '../../footprints/stage-optics/DualSurfaceCalibration.ts';
import type {MapSimState,MapStageDimensions} from './mapStageModel.ts';
import {paintAuthenticFootprint} from '../../footprints/scenes/authenticFootGeometry.ts';
import {containedImageRect,initialCameraQuad,pointerInSource,replaceValidCorner,paintMapWarp} from './mapWysiwygModel.ts';
import './map-wysiwyg.css';
import './map-calibration-assist.css';

type Props={
 selected:StageSurface;
 stageDimensions:MapStageDimensions;
 plan:StageSurfacePlan;
 sourceKind:'camera'|'video'|'simulator'|'demo-sim'|'none';
 hasLiveSource:boolean;
 videoRef?:RefObject<HTMLVideoElement|null>;
 motionFrameRef?:RefObject<MotionFrame>;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 videoFloorCalibration?:CameraFloorCalibration|null;
 router?:MultiPoseGaitRouter;
 motionSession?:()=>string;
 liveSourceKind?:'camera'|'phone';
 performerCount?:1|2;
 cameraOn?:boolean;
 floorTracker?:LiveFloorTrackingEngine;
 floorCanvas:RefObject<HTMLCanvasElement|null>;
 bodyCanvas:RefObject<HTMLCanvasElement|null>;
 liquidCanvas?:RefObject<HTMLCanvasElement|null>;
 simState:MapSimState;
 onStartSim:()=>void;
 onStopSim:()=>void;
 onToggleSimPlay:()=>void;
 onCommitCameraQuad:(quad:Quad)=>{ok:boolean;message:string};
 onBeginCameraEdit:()=>void;
 onBeginProjectorEdit:()=>void;
 onCommitProjectorQuad:(quad:Quad)=>{ok:boolean;message:string};
 onEditLockChange:(locked:boolean)=>void;
 onMessage:(message:string)=>void;
 onOpenTrack:()=>void;
 onOpenCompose:()=>void;
 mapOutputSaved?:boolean;
 allowLegacyCameraEditing?:boolean;
 onSourceLost:()=>void;
 externalNotice?:string;
};
const W=640,H=360;
const SIM_CAMERA_QUAD:Quad=[{x:.18,y:.2},{x:.82,y:.2},{x:.98,y:.92},{x:.02,y:.92}];
const drawSimulatedSource=(ctx:CanvasRenderingContext2D,sim:MapSimState)=>{
 const matrix=homography(SIM_CAMERA_QUAD);
 const project=(u:number,v:number)=>transform(matrix,{x:u,y:v});
 ctx.fillStyle='#16221a';ctx.fillRect(0,0,W,H);
 const quad=SIM_CAMERA_QUAD.map(numericPoint);
 ctx.beginPath();quad.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
 ctx.fillStyle='#273c2a';ctx.fill();ctx.strokeStyle='#80a184';ctx.lineWidth=1.5;ctx.stroke();
 ctx.strokeStyle='#46614b';ctx.lineWidth=.9;
 for(let i=1;i<8;i++){
  const t=i/8;const a=project(t,0),b=project(t,1),c=project(0,t),d=project(1,t);
  ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H);ctx.stroke();
  ctx.beginPath();ctx.moveTo(c.x*W,c.y*H);ctx.lineTo(d.x*W,d.y*H);ctx.stroke();
 }
 for(const foot of sim.footprints.slice(-32)){
  const p=project(foot.x,foot.y);const age=Math.max(0,(sim.elapsedMs-foot.atMs)/1000);
  paintAuthenticFootprint(ctx,{x:p.x*W,y:p.y*H,side:foot.foot,
   headingRad:foot.headingRad-Math.PI/2,widthPx:9,lengthPx:21,
   alpha:Math.max(.15,.8-age*.055),color:foot.actorId==='B'?'#8ad8e2':'#cbe9a7'});
 }
 for(const performer of sim.performers){
  const p=project(performer.x,performer.y),x=p.x*W,y=p.y*H;
  ctx.fillStyle=performer.id==='A'?'#cbe9a7':'#8ad8e2';
  ctx.beginPath();ctx.ellipse(x,y-18,7,19,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x,y-36,6,0,Math.PI*2);ctx.fill();
  ctx.textAlign='center';ctx.font='bold 10px system-ui';ctx.fillText(performer.id,x,y-48);
 }
};
const numericPoint=(p:Point)=>({x:p.x*W,y:p.y*H});
const pointsString=(quad:Quad,box:{x:number;y:number;width:number;height:number})=>
 quad.map(p=>String(box.x+p.x*box.width)+','+String(box.y+p.y*box.height)).join(' ');
const validSource=(mode:Props['sourceKind'],video:HTMLVideoElement|null|undefined,exp:HTMLCanvasElement|null|undefined)=>{
 if(mode==='camera'&&video&&video.readyState>=2&&video.videoWidth&&video.videoHeight){
  const stream=video.srcObject;
  if(stream instanceof MediaStream){
   const tracks=stream.getVideoTracks();
   if(!tracks.length||tracks.every(track=>track.readyState==='ended'))return null;
  }
  return {media:video as CanvasImageSource,width:video.videoWidth,height:video.videoHeight};
 }
 if((mode==='video'||mode==='simulator')&&exp&&exp.width&&exp.height)
  return {media:exp as CanvasImageSource,width:exp.width,height:exp.height};
 return null;
};
export function MapWysiwygWorkspace({
 selected,stageDimensions,plan,sourceKind,hasLiveSource,videoRef,motionFrameRef,experimentInputCanvas,
 experimentFrameRef,videoFloorCalibration=null,router,motionSession,liveSourceKind='camera',performerCount=2,cameraOn=false,
 floorTracker,floorCanvas,bodyCanvas,liquidCanvas,simState,onStartSim,onStopSim,
 onToggleSimPlay,onCommitCameraQuad,onBeginCameraEdit,onBeginProjectorEdit,
 onCommitProjectorQuad,onEditLockChange,onMessage,onOpenTrack,onOpenCompose,onSourceLost,externalNotice='',
 mapOutputSaved=false,allowLegacyCameraEditing=false
}:Props){
 const [cameraDraft,setCameraDraft]=useState<Quad>(()=>floorTracker?.calibrationData?.cameraQuad??initialCameraQuad());
 const [outputDraft,setOutputDraft]=useState<Quad>(()=>plan.projectorQuad);
 const [cameraDirty,setCameraDirty]=useState(false);
 const [outputDirty,setOutputDirty]=useState(false);
 const [frozen,setFrozen]=useState(false);
 const frozenRef=useRef(frozen);frozenRef.current=frozen;
 const [projectorEdit,setProjectorEdit]=useState(false);
 const [mapView,setMapView]=useState<'room'|'camera'|'projector'>('room');
 useEffect(()=>{onEditLockChange(projectorEdit||outputDirty||cameraDirty);return()=>onEditLockChange(false);},[projectorEdit,outputDirty,cameraDirty,onEditLockChange]);
 const [fullScreen,setFullScreen]=useState(false);
 const [resetArmed,setResetArmed]=useState(false);
 const [sourceBox,setSourceBox]=useState({x:0,y:0,width:W,height:H});
 const [sourceAvailable,setSourceAvailable]=useState(false);
 const [sourceInterrupted,setSourceInterrupted]=useState(false);
 const [invalidWhere,setInvalidWhere]=useState<'source'|'output'|null>(null);
 const [savedWhere,setSavedWhere]=useState<'source'|'output'|null>(null);
 const [focusedCorner,setFocusedCorner]=useState(0);
 const invalidTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const savedTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const everHadCamera=useRef(false);
 const sourceLoss=useRef(onSourceLost);sourceLoss.current=onSourceLost;
 const lossHandled=useRef(false);
 const simRef=useRef(simState);
 simRef.current=simState;
 const [status,setStatus]=useState('');
 const [pointer,setPointer]=useState<{target:'source'|'output';index:number;id:number}|null>(null);
 const sourceCanvas=useRef<HTMLCanvasElement>(null);
 const outputCanvas=useRef<HTMLCanvasElement>(null);
 const wrapper=useRef<HTMLDivElement>(null);
 const activePoint=useRef<number>(0);
 const cameraDraftRef=useRef(cameraDraft);
 const outputDraftRef=useRef(outputDraft);
 cameraDraftRef.current=cameraDraft;outputDraftRef.current=outputDraft;
 const assist=useMapCalibrationAssist({selected,sourceKind,sourceAvailable,
  cameraDraft,outputDraft,sourceQuad:plan.sourceQuad,cameraDirty,sourceBox,
  videoRef,experimentFrameRef,motionFrameRef,router,floorTracker,
  motionSession,liveSourceKind,performerCount,cameraOn,simState,simCameraQuad:SIM_CAMERA_QUAD,
  videoFloorCalibration,stageDimensions});
 useEffect(()=>{
  const q=sourceKind==='video'?videoFloorCalibration?.cameraQuad:floorTracker?.calibrationData?.cameraQuad;
  if(!cameraDirty)setCameraDraft(q?q.map(p=>({...p})) as Quad:initialCameraQuad());
 },[sourceKind,videoFloorCalibration,floorTracker?.calibrationData,cameraDirty]);
 useEffect(()=>{if(!outputDirty)setOutputDraft(plan.projectorQuad.map(p=>({...p})) as Quad);},[plan.projectorQuad,outputDirty]);
 useEffect(()=>{
  setFrozen(false);setCameraDirty(false);setPointer(null);setSourceAvailable(false);
  if(sourceKind==='camera')return;
  if(everHadCamera.current&&!lossHandled.current){
   lossHandled.current=true;sourceLoss.current();
  }
  everHadCamera.current=false;setSourceInterrupted(false);
 },[sourceKind]);
 useEffect(()=>()=>{if(invalidTimer.current)clearTimeout(invalidTimer.current);
  if(savedTimer.current)clearTimeout(savedTimer.current);},[]);
 const flagInvalid=(where:'source'|'output')=>{
  setInvalidWhere(where);
  if(invalidTimer.current)clearTimeout(invalidTimer.current);
  invalidTimer.current=setTimeout(()=>setInvalidWhere(null),190);
 };
 const flashSaved=(where:'source'|'output')=>{
  setSavedWhere(where);
  if(savedTimer.current)clearTimeout(savedTimer.current);
  savedTimer.current=setTimeout(()=>setSavedWhere(null),230);
 };
 useEffect(()=>{
  const sync=()=>setFullScreen(document.fullscreenElement===wrapper.current);
  document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync);
 },[]);
 const changeFullscreen=()=>{
  const el=wrapper.current;if(!el)return;
  const op=document.fullscreenElement===el?document.exitFullscreen():el.requestFullscreen?.();
  void op?.catch(()=>setStatus('Browser menolak layar penuh.'));
 };
 useEffect(()=>{
  let raf=0,last=0,seen=false,oldBox='',bindingKey:string|null=null;
  let liveness=new CameraLiveness(2000);
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);if(now-last<46)return;last=now;
   const c=sourceCanvas.current,ctx=c?.getContext('2d');if(!c||!ctx)return;
   const video=videoRef?.current;
   let src=validSource(sourceKind,video,experimentInputCanvas?.current);
   if(sourceKind==='camera'){
    const nextBinding=cameraBindingKey(cameraBinding(video??null));
    if(bindingKey!==nextBinding){
     const replaced=!!bindingKey;
     bindingKey=nextBinding;liveness=new CameraLiveness(2000);
     if(replaced){
      frozenRef.current=false;setFrozen(false);setCameraDirty(false);setPointer(null);
      if(!lossHandled.current){lossHandled.current=true;sourceLoss.current();}
     }
    }
    if(!nextBinding||!video||liveness.sample(video.currentTime,now,!document.hidden))src=null;
   }
   if(frozenRef.current&&src&&seen)return; // still run frame liveness while preview is frozen
   ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0a100d';ctx.fillRect(0,0,W,H);
   if(sourceKind==='demo-sim'){
    drawSimulatedSource(ctx,simRef.current);return;
   }
   if(src){
    const box=containedImageRect(src.width,src.height,W,H);
    if(box){
     try{ctx.drawImage(src.media,box.x,box.y,box.width,box.height);}catch{return; /* changing input frame is not a valid source */}
     const signature=[box.x,box.y,box.width,box.height].join(':');
     if(signature!==oldBox){oldBox=signature;setSourceBox(box);}
     if(!seen){seen=true;setSourceAvailable(true);}
     if(sourceKind==='camera'){everHadCamera.current=true;lossHandled.current=false;setSourceInterrupted(false);}
    }
   }else{
    if(seen){
     seen=false;setSourceAvailable(false);
     if(sourceKind==='camera'&&everHadCamera.current&&!lossHandled.current){
      lossHandled.current=true;setSourceInterrupted(true);
      frozenRef.current=false;setFrozen(false);setCameraDirty(false);setPointer(null);
      setStatus('Sumber terputus. Periksa sambungan di Track.');
      sourceLoss.current();
     }
    }
    ctx.fillStyle='#738a79';ctx.font='14px system-ui';ctx.textAlign='center';
    ctx.fillText(sourceKind==='none'?'Belum ada sumber kamera':'Menunggu gambar sumber…',W/2,H/2);
   }
  };
  raf=requestAnimationFrame(paint);return()=>cancelAnimationFrame(raf);
 },[sourceKind,videoRef,experimentInputCanvas]);
 useEffect(()=>{
  let raf=0,last=0;
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);if(now-last<46)return;last=now;
   const c=outputCanvas.current,ctx=c?.getContext('2d');if(!c||!ctx)return;
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);
   ctx.fillStyle='#090e0a';ctx.fillRect(0,0,W,H);
   const src=selected==='body'?bodyCanvas.current:floorCanvas.current;
   const ready=!!src&&src.width>0&&src.height>0;
   if(ready&&hasLiveSource){
    ctx.save();ctx.globalAlpha=plan.brightness;
    paintMapWarp(ctx,src!,plan.sourceQuad,outputDraftRef.current,W,H,8);
    ctx.restore();
   }
   // Map Calibration Assist owns observed foot overlays on separate local canvases.
   // Projector and Compose raster paths remain untouched.
   // Virtual Map footprints are rendered once, by the diagnostic assist canvas.
   const q=outputDraftRef.current.map(numericPoint);
   ctx.strokeStyle=selected==='body'?'#80cfd8':'#cbe9a7';ctx.lineWidth=1.6;
   ctx.beginPath();q.forEach((p,i)=>{if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();
   ctx.stroke();
  };
  raf=requestAnimationFrame(paint);return()=>cancelAnimationFrame(raf);
 },[selected,plan.sourceQuad,plan.brightness,hasLiveSource,floorCanvas,bodyCanvas]);
 const currentBox=sourceBox;
 const projectorBox={x:0,y:0,width:W,height:H};
 const overlayQuad=(where:'source'|'output')=>where==='source'?cameraDraft:outputDraft;
 const pointerToPoint=(e:PointerEvent<SVGSVGElement>,where:'source'|'output')=>{
  const rect=e.currentTarget.getBoundingClientRect();
  if(!(rect.width>0&&rect.height>0))return null;
  const x=(e.clientX-rect.left)/rect.width*W,y=(e.clientY-rect.top)/rect.height*H;
  return pointerInSource(x,y,where==='source'?currentBox:projectorBox);
 };
 const startMove=(e:PointerEvent<SVGGElement>,where:'source'|'output',index:number)=>{
  if(where==='source'&&(!allowLegacyCameraEditing||!sourceAvailable))return;
  e.preventDefault();e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
  setPointer({target:where,index,id:e.pointerId});activePoint.current=index;
  if(where==='source'){
   if(!cameraDirty)onBeginCameraEdit();setCameraDirty(true);
  }else{if(!outputDirty)onBeginProjectorEdit();setOutputDirty(true);}
  setResetArmed(false);setStatus('');
 };
 const move=(e:PointerEvent<SVGSVGElement>,where:'source'|'output')=>{
  if(!pointer||pointer.target!==where||pointer.id!==e.pointerId)return;
  const p=pointerToPoint(e,where);
  if(!p)return;
  const next=replaceValidCorner(overlayQuad(where),pointer.index,p);
  if(!next){flagInvalid(where);setStatus('Sudut tidak valid. Posisi terakhir dipertahankan.');return;}
  if(where==='source')setCameraDraft(next);
  else setOutputDraft(next);
  setStatus('Pratinjau perubahan · belum tersimpan');
 };
 const stopMove=(e:PointerEvent<SVGSVGElement>,where:'source'|'output')=>{
  if(!pointer||pointer.target!==where||pointer.id!==e.pointerId)return;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  setPointer(null);
  if(where==='output'){
   setStatus('Pratinjau berubah. Simpan bidang output untuk memakai posisi baru.');
  }
 };
 const keyMove=(e:KeyboardEvent<SVGSVGElement>,where:'source'|'output')=>{
  if(e.key>='1'&&e.key<='4'){activePoint.current=Number(e.key)-1;setFocusedCorner(activePoint.current);return;}
  if(e.key==='Escape'){
   if(where==='source'){
    const previous=floorTracker?.calibrationData?.cameraQuad;
    setCameraDraft(previous??initialCameraQuad());setCameraDirty(false);
    setStatus('Draf kamera dibatalkan. Periksa binding sebelum mengaktifkan pelacakan.');
   }else{
    setOutputDraft(plan.projectorQuad);setOutputDirty(false);
    setStatus('Posisi proyektor dikembalikan.');
   }
   return;
  }
  const deltas:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  const d=deltas[e.key];if(!d)return;e.preventDefault();
  const value=overlayQuad(where),p=value[activePoint.current],step=e.shiftKey ? 0.01 : 0.002;
  const next=replaceValidCorner(value,activePoint.current,{
   x:Math.max(0,Math.min(1,p.x+d[0]*step)),y:Math.max(0,Math.min(1,p.y+d[1]*step))
  });
  if(!next){flagInvalid(where);setStatus('Sudut tidak valid. Posisi terakhir dipertahankan.');return;}
  if(where==='source'){
   if(!cameraDirty)onBeginCameraEdit();
   setCameraDirty(true);setCameraDraft(next);
  }else{
   if(!outputDirty)onBeginProjectorEdit();
   setOutputDirty(true);setOutputDraft(next);
   setStatus('Pratinjau berubah. Simpan bidang output untuk memakai posisi baru.');
  }
 };
 const applyCamera=()=>{
  if(!sourceAvailable||sourceKind!=='camera'){
   setStatus('Kalibrasi kamera memerlukan gambar kamera yang aktif.');return;
  }
  const result=onCommitCameraQuad(cameraDraftRef.current);
  setStatus(result.message);
  if(result.ok){setCameraDirty(false);setFrozen(false);flashSaved('source');}
 };
 const cancel=()=>{
  if(projectorEdit){setOutputDraft(plan.projectorQuad);setOutputDirty(false);}
  else{
   const previous=floorTracker?.calibrationData?.cameraQuad;
   setCameraDraft(previous??initialCameraQuad());setCameraDirty(false);
   setStatus('Draf kamera dibatalkan. Periksa binding sebelum mengaktifkan pelacakan.');
  }
  setResetArmed(false);
  if(projectorEdit)setStatus('Posisi proyektor dikembalikan ke yang tersimpan.');
 };
 const reset=()=>{
  if(!resetArmed){setResetArmed(true);return;}
  if(projectorEdit){
   onBeginProjectorEdit();setOutputDraft(identityQuad());setOutputDirty(true);
  }else{
   onBeginCameraEdit();setCameraDraft(initialCameraQuad());setCameraDirty(true);
  }
  setResetArmed(false);setStatus('Titik dikembalikan ke awal. Periksa dan terapkan ulang.');
 };
 const mapOverlay=(where:'source'|'output')=>{
  const box=where==='source'?currentBox:projectorBox,q=where==='source'&&sourceKind==='demo-sim'?SIM_CAMERA_QUAD:overlayQuad(where);
  const canEdit=where==='source'?allowLegacyCameraEditing&&sourceAvailable&&sourceKind==='camera':projectorEdit;
  return <svg className="soma-map-wysiwyg-overlay" viewBox="0 0 640 360"
   role="group" aria-label={where==='source'?'Empat sudut lantai pada gambar sumber':'Empat sudut proyeksi'}
   data-invalid={invalidWhere===where} data-dragging={pointer?.target===where}
   data-saved={savedWhere===where}
   tabIndex={canEdit?0:-1}
   onKeyDown={e=>{if(canEdit)keyMove(e,where);}}
   onPointerMove={e=>move(e,where)}
   onPointerUp={e=>stopMove(e,where)}
   onPointerCancel={e=>stopMove(e,where)}>
   <polygon points={pointsString(q,box)} fill={where==='source'?'#b9e4a322':'transparent'}
    stroke={where==='source'?'#cbe9a7':'#80cfd8'} strokeWidth="2"/>
   {canEdit&&q.map((p,i)=>{
    const x=box.x+p.x*box.width,y=box.y+p.y*box.height;
    return <g key={i} className="soma-map-wysiwyg-handle"
      data-active={pointer?.target===where&&pointer.index===i} data-focused={focusedCorner===i}
      onPointerDown={e=>{setFocusedCorner(i);startMove(e,where,i);}}>
     <circle cx={x} cy={y} r="16" fill="transparent"/>
     <circle cx={x} cy={y} r="9" fill="#d1ecc0" stroke="#132019" strokeWidth="1.5"/>
     <text x={x} y={y+3.5} fontSize="10" textAnchor="middle" fontWeight="700" fill="#122219">{i+1}</text>
    </g>;
   })}
  </svg>;
 };
 const isSourceMode=sourceKind==='camera'||sourceKind==='video'||sourceKind==='simulator';
 const sourceLabel=sourceKind==='demo-sim'?'Panggung simulasi':isSourceMode?(sourceKind==='camera'?'Kamera langsung':sourceKind==='video'?'Video MP4':'Simulasi 3D'):'Sumber';
 const calibrated=(sourceKind==='video'?!!videoFloorCalibration:
  sourceKind==='camera'&&!!floorTracker?.isConfirmed)&&!cameraDirty;
 const simulating=sourceKind==='demo-sim'&&simState.active;
 const visibleSource=sourceAvailable||simulating;
 const waitingForSource=sourceKind!=='none'&&!simulating&&!sourceAvailable;
 const idleMessage=sourceInterrupted?'Sumber terputus. Periksa sambungan di Track.':
  simulating?'SIMULASI · Dua performer dan jejak kaki aktif.':
  !visibleSource?'Output fisik terkunci.':
  outputDirty?'Bidang output belum disimpan.':
  mapOutputSaved?'Bidang output tersimpan · QA proyektor perlu diperiksa.':
  'Buka Proyektor untuk mengatur bidang output.';
 const externalStatus=(sourceInterrupted||/tidak valid|gagal|diblokir/i.test(externalNotice))?externalNotice:'';
 const resultText=sourceInterrupted?'Sumber terputus. Periksa Track.':
  waitingForSource?'Menunggu gambar sumber':
  'Hasil muncul setelah simulasi atau input aktif';
 const view=selected==='body'&&mapView==='room'?'projector':mapView;
 const syntheticTest=!visibleSource&&assist.status.startsWith('SIMULASI');
 const roomEmpty=view==='room'&&!visibleSource&&!syntheticTest;
 const startSimulation=()=>{onStartSim();setMapView(selected==='floor'?'room':'projector');};
 const chooseView=(next:'room'|'camera'|'projector')=>{
  // A dirty draft must stay visible until explicitly saved or cancelled.
  if(((outputDirty||projectorEdit)&&next!=='projector')||(cameraDirty&&next!=='camera')){
   setStatus('Simpan atau batalkan perubahan sudut terlebih dahulu.');return;
  }
  setMapView(next);
 };
 const startProjectorEdit=()=>{
  if(!visibleSource||cameraDirty)return;
  setMapView('projector');setProjectorEdit(true);setResetArmed(false);
 };
 const finishProjectorEdit=()=>{
  if(outputDirty){
   const result=onCommitProjectorQuad(outputDraftRef.current);
   setStatus(result.message);
   if(!result.ok)return;
   setOutputDirty(false);flashSaved('output');
   onMessage(result.message);
  }
  setProjectorEdit(false);setResetArmed(false);setMapView(selected==='floor'?'room':'projector');
 };
 const stopEditing=()=>{
  cancel();setProjectorEdit(false);setResetArmed(false);
  setMapView(selected==='floor'?'room':'projector');
 };
 return <section className="soma-map-wysiwyg soma-map-v7" ref={wrapper} aria-label="Kalibrasi Map langsung">
  <div className="soma-map-wysiwyg-head soma-map-v7-toolbar">
   <div className="soma-map-v7-tabs" role="group" aria-label="Tampilan Map">
    {selected==='floor'&&<button type="button" aria-pressed={view==='room'} onClick={()=>chooseView('room')}>Ruang</button>}
    <button type="button" aria-pressed={view==='camera'} onClick={()=>chooseView('camera')}>Kamera</button>
    <button type="button" aria-pressed={view==='projector'} onClick={()=>chooseView('projector')}>Proyektor</button>
   </div>
   <div className="soma-map-v7-tools">
    {!roomEmpty&&!visibleSource&&!waitingForSource&&!sourceInterrupted&&<button type="button" onClick={startSimulation}><Play size={14}/> Coba simulasi</button>}
    {simulating&&<><button type="button" onClick={onToggleSimPlay}>{simState.playing?<Pause size={14}/>:<Play size={14}/>} {simState.playing?'Jeda':'Lanjutkan'}</button>
     <button type="button" onClick={onStopSim} disabled={projectorEdit||outputDirty||cameraDirty}>Hentikan</button></>}
    {!roomEmpty&&<button type="button" onClick={onOpenTrack} disabled={projectorEdit||outputDirty||cameraDirty}>{sourceInterrupted?'Periksa Track':visibleSource?'Ganti sumber':'Pilih kamera di Track'}</button>}
    <button type="button" onClick={changeFullscreen} aria-label={fullScreen?'Tutup layar penuh':'Layar penuh Map'}>
     {fullScreen?<Minimize2 size={16}/>:<Maximize2 size={16}/>}
    </button>
   </div>
  </div>
  <div className="soma-map-wysiwyg-grid soma-map-v7-grid" data-view={view}>
   <div className="soma-map-wysiwyg-pane soma-map-v7-room" hidden={view!=='room'}>
    <div className="soma-map-v6-stage-view"><canvas ref={assist.stageCanvas} width={W} height={H} aria-label="Denah lantai berskala meter dan estimasi posisi tapak"/>
     {roomEmpty&&<div className="soma-map-v71-empty" role="group" aria-label="Sumber gerak">
      <strong>{sourceInterrupted?'Sumber terputus':waitingForSource?'Menunggu sumber':'Belum ada sumber'}</strong>
      <button type="button" onClick={onOpenTrack} disabled={projectorEdit||outputDirty||cameraDirty}>{sourceInterrupted?'Periksa Track':'Pilih kamera di Track'}</button>
      {!waitingForSource&&!sourceInterrupted&&<button type="button" className="soma-map-v71-secondary" onClick={startSimulation}><Play size={13}/> Coba simulasi</button>}
     </div>}
    </div>
    <p className="soma-map-wysiwyg-caption">{syntheticTest?'Tes virtual · lima titik contoh.':simulating?'Simulasi A/B · grid 1 meter':calibrated?'Estimasi posisi · grid 1 meter':'Grid 1 meter · belum diverifikasi secara fisik'}</p>
   </div>
   <div className="soma-map-wysiwyg-pane soma-map-v6-source soma-map-v7-camera" hidden={view!=='camera'}>
    <div className="soma-map-wysiwyg-pane-head"><b>{sourceLabel}</b><small data-live={visibleSource}>{simulating?'SIMULASI':sourceInterrupted?'TERPUTUS':sourceAvailable?(frozen?'DIBEKUKAN':'INPUT AKTIF'):'Belum ada sumber'}</small></div>
    <div className="soma-map-wysiwyg-image">
     <canvas ref={sourceCanvas} width={W} height={H} aria-label="Gambar input kamera atau video"/>
     <canvas className="soma-map-assist-overlay" ref={assist.sourceCanvas} width={W} height={H} aria-hidden="true"/>
     {visibleSource&&mapOverlay('source')}
     {!visibleSource&&<div className="soma-map-v3-empty" role="status">
      <strong>{sourceInterrupted?'Sumber terputus':waitingForSource?'Menunggu gambar':'Belum ada sumber'}</strong>
      <span>Hubungkan kamera di Track atau gunakan simulasi di toolbar.</span>
     </div>}
    </div>
    {sourceAvailable&&<div className="soma-map-wysiwyg-controls">
     <button type="button" onClick={()=>setFrozen(v=>!v)}>{frozen?'Lanjutkan gambar':'Bekukan gambar'}</button>
     {allowLegacyCameraEditing&&sourceKind==='camera'&&<button type="button" onClick={applyCamera}><Check size={14}/> {cameraDirty?'Terapkan bidang':calibrated?'Konfirmasi ulang bidang':'Simpan bidang kamera'}</button>}
     {cameraDirty&&<button type="button" onClick={cancel}>Batalkan</button>}
    </div>}
    <p className="soma-map-wysiwyg-caption">{simulating?'Sumber virtual · kalibrasi fisik tidak berlaku.':calibrated?'Bidang sumber terkalibrasi (estimasi).':'Bidang sumber · estimasi 2D.'}</p>
   </div>
   <aside className="soma-map-v7-inspector" aria-label="Pengaturan Map">
    <div className="soma-map-v6-section-head"><div><b>{view==='room'?'Kalibrasi':view==='camera'?'Kalibrasi kamera':'Kalibrasi output'}</b></div></div>
    <div className="soma-map-v7-actions">
     {view==='room'&&<>
      <div className="soma-map-v71-state"><span>Kamera</span><span data-ready={calibrated||simulating}>{simulating?'Virtual':calibrated?'Tersimpan':sourceAvailable?'Belum dikalibrasi':'Belum terhubung'}</span></div>
      <div className="soma-map-v71-state"><span>Proyektor</span><span data-ready={mapOutputSaved&&!outputDirty}>{outputDirty?'Draf':mapOutputSaved?'Tersimpan':'Belum disimpan'}</span></div>
     </>}
     {view==='camera'&&<><p>{simulating?'Simulasi memakai koordinat virtual.':calibrated?'Kalibrasi kamera tersimpan.':'Kalibrasikan kamera terhadap lantai fisik.'}</p>
      <button type="button" onClick={onOpenTrack} disabled={cameraDirty||outputDirty}><span>Ubah bidang kamera di Track</span><span aria-hidden="true">›</span></button></>}
     {view==='projector'&&<p>{projectorEdit?'Geser empat titik pada kanvas. Simpan setelah selesai.':visibleSource?'Pilih Sesuaikan proyektor untuk mengedit bidang.':'Pilih sumber atau mulai simulasi untuk mengedit bidang.'}</p>}
    </div>
    {selected==='floor'&&<div className="soma-map-assist-controls" role="group" aria-label="Bantuan kalibrasi tapak">
     <button type="button" onClick={assist.test}>Tes tapak</button>
     <details className="soma-map-assist-more">
      <summary>Opsi lanjutan</summary>
      <div className="soma-map-assist-more-panel">
       <button type="button" aria-pressed={assist.auto} onClick={()=>assist.setAuto(v=>!v)}>Jejak otomatis {assist.auto?'aktif':'mati'}</button>
       <button type="button" aria-pressed={assist.replay} onClick={assist.toggleReplay}>{assist.replay?'Stop replay':'Replay 5 detik'}</button>
       <button type="button" aria-pressed={assist.frozen} onClick={assist.toggleFreeze}>{assist.frozen?'Lanjut jejak':'Bekukan jejak'}</button>
       <button type="button" onClick={assist.clear}>Bersihkan</button>
      </div>
     </details>
     <span className="soma-map-assist-status" role="status" aria-live="polite" data-idle={!visibleSource&&!syntheticTest&&assist.status.startsWith('Belum ada sumber')}>{assist.status}</span>
    </div>}
    <p className="soma-map-v7-physical"><span aria-hidden="true">●</span> Uji fisik di Perform</p>
   </aside>
   <div className="soma-map-wysiwyg-pane soma-map-v7-output">
    <div className="soma-map-wysiwyg-pane-head"><b>{view==='projector'?'Bidang proyektor':'Preview output'}</b><small data-live={visibleSource}>{syntheticTest?'TES VIRTUAL':simulating?'VIRTUAL':visibleSource?'DRAF 16:9':''}</small></div>
    <div className="soma-map-wysiwyg-image">
     <canvas ref={outputCanvas} width={W} height={H} aria-label="Hasil visual Compose dengan perspektif proyeksi"/>
     <canvas className="soma-map-assist-overlay" ref={assist.outputCanvas} width={W} height={H} aria-hidden="true"/>
     {visibleSource&&mapOverlay('output')}
     {!visibleSource&&!syntheticTest&&<div className="soma-map-v3-result-empty" role="status">
      <span>{sourceInterrupted||waitingForSource?resultText:'Belum ada sinyal'}</span>
      {!sourceInterrupted&&!waitingForSource&&<button type="button" className="soma-map-v3-link" onClick={onOpenCompose}>Buka Compose</button>}
     </div>}
    </div>
    {(visibleSource||projectorEdit)&&<div className="soma-map-wysiwyg-controls">
     <button type="button" disabled={!visibleSource||cameraDirty} aria-pressed={projectorEdit} onClick={projectorEdit?finishProjectorEdit:startProjectorEdit}><ScanLine size={14}/> {projectorEdit?'Simpan bidang':'Sesuaikan proyektor'}</button>
     {projectorEdit&&<button type="button" onClick={stopEditing}>Batalkan</button>}
    </div>}
    {view==='projector'&&<p className="soma-map-wysiwyg-caption">{projectorEdit?'Geser titik 1–4, lalu simpan. QA fisik perlu diulang.':'Preview software · uji fisik di Perform.'}</p>}
   </div>
  </div>
  <div className="soma-map-wysiwyg-bottom" aria-label="Kontrol akhir Map">
   <div className="soma-map-v4-status">
    <span className="soma-map-v4-status-dot" aria-hidden="true"/>
    <span role="status" aria-live="polite" title={status||externalStatus||idleMessage}>{status||externalStatus||idleMessage}</span>
   </div>
   <div className="soma-map-v4-actions">
    {((projectorEdit&&view==='projector')||(allowLegacyCameraEditing&&sourceKind==='camera'&&sourceAvailable&&view==='camera'))&&
     <button type="button" className="soma-map-v4-reset" onClick={reset} title="Atur ulang empat sudut"><RotateCcw size={14}/> {resetArmed?'Konfirmasi reset':'Ulangi sudut'}</button>}
   </div>
  </div>
 </section>;
}
