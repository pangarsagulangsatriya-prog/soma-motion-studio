import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent,type RefObject} from 'react';
import {Pause,Play,Users} from 'lucide-react';
import type {MotionFrame} from '../../engine/types.ts';
import type {Quad} from '../../projection/geometry.ts';
import type {LiveFloorTrackingEngine} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import {paintAuthenticFootprint} from '../../footprints/scenes/authenticFootGeometry.ts';
import {ProjectorWysiwygPreview} from '../../footprints/stage-optics/ProjectorWysiwygPreview.tsx';
import type {PreviewView} from '../../footprints/stage-optics/projectorWysiwygModel.ts';
import type {StageSurface,StageSurfacePlan,SurfaceAssessment} from '../../footprints/stage-optics/DualSurfaceCalibration.ts';
import {moveMapCorner,type MapCornerIndex} from './mapCornerModel.ts';
import {
 screenToStageFloor,snapQuadPoint,stageFloorToScreen,
 type MapSimPerformer,type MapSimState,type MapStageDimensions
} from './mapStageModel.ts';

export type MapMonitorView='stage'|'camera'|'output'|'split';
export type CalibrationGuidePattern='grid'|'crosshair'|'diagonal'|'off';

type Props={
 view:MapMonitorView;
 onChangeView:(view:MapMonitorView)=>void;
 selected:StageSurface;
 plan:StageSurfacePlan;
 editingCorners:boolean;
 activeCorner:MapCornerIndex;
 onSelectCorner:(idx:MapCornerIndex)=>void;
 snapEnabled:boolean;
 stageDimensions:MapStageDimensions;
 hasLiveSource:boolean;
 sourceKind:'camera'|'video'|'simulator'|'demo-sim'|'none';
 simState:MapSimState;
 onStartSim:()=>void;
 onStopSim:()=>void;
 onToggleSimPlay:()=>void;
 onMoveSimPerformer:(actorId:'A'|'B',pos:{x:number;y:number})=>void;
 onCommitProjectorQuad:(quad:Quad)=>void;
 onOpenCameraCalibration?:()=>void;
 previewView:PreviewView;
 onChangePreviewView:(view:PreviewView)=>void;
 softwareMode:string;
 connected:boolean;
 qa:SurfaceAssessment;
 viewport:{width:number;height:number;dpr:number}|null;
 bodyCanvas:RefObject<HTMLCanvasElement|null>;
 floorCanvas:RefObject<HTMLCanvasElement|null>;
 liquidCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
 videoRef?:RefObject<HTMLVideoElement|null>;
 frameRef?:RefObject<MotionFrame>;
 floorTracker?:LiveFloorTrackingEngine;
 motionEvents?:()=>readonly FootMotionEventV2[];
 testCanvases:RefObject<Record<StageSurface,HTMLCanvasElement>|null>;
 performerCount:1|2;
 identitySafe:boolean;
};

const W=960,H=540;
const CORNER_LABELS=['Kiri Atas','Kanan Atas','Kanan Bawah','Kiri Bawah'] as const;

function drawStudioPerformer(
 ctx:CanvasRenderingContext2D,
 p:MapSimPerformer,
 highlightBodyMask:boolean,
 w:number,h:number,
 dims:MapStageDimensions
){
 const base=stageFloorToScreen(p.x,p.y,w,h,dims);
 const s=base.scale;
 const isB=p.id==='B';
 const accent=isB?'#80cfd8':'#cbe9a7';
 const bodyFill=isB?'rgba(128, 207, 216, 0.20)':'rgba(203, 233, 167, 0.20)';
 const bodyStroke=isB?'rgba(143, 218, 226, 0.85)':'rgba(212, 238, 178, 0.88)';

 const legSwing=Math.sin(p.phaseRad)*6*s;
 const headingCos=Math.cos(p.headingRad);
 const headingSin=Math.sin(p.headingRad);
 const footSpread=10*s;

 ctx.save();
 ctx.fillStyle='rgba(0,0,0,0.5)';
 ctx.beginPath();
 ctx.ellipse(base.x,base.y+3*s,20*s,8*s,0,0,Math.PI*2);
 ctx.fill();

 ctx.strokeStyle=accent;
 ctx.globalAlpha=0.7;
 ctx.lineWidth=1.8;
 ctx.beginPath();
 ctx.moveTo(base.x,base.y);
 ctx.lineTo(base.x+headingCos*26*s,base.y+headingSin*12*s);
 ctx.stroke();
 ctx.globalAlpha=1;

 const leftFootX=base.x-footSpread+headingCos*legSwing;
 const leftFootY=base.y+headingSin*legSwing*0.4;
 const rightFootX=base.x+footSpread-headingCos*legSwing;
 const rightFootY=base.y-headingSin*legSwing*0.4;
 const hipY=base.y-54*s;
 const shoulderY=base.y-102*s;
 const headY=base.y-120*s;

 if(highlightBodyMask){
  const grad=ctx.createLinearGradient(base.x,hipY+6*s,base.x,base.y+4*s);
  grad.addColorStop(0,isB?'rgba(128,207,216,0.46)':'rgba(203,233,167,0.46)');
  grad.addColorStop(1,isB?'rgba(128,207,216,0.12)':'rgba(203,233,167,0.12)');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(base.x-15*s,hipY+6*s);
  ctx.lineTo(base.x+15*s,hipY+6*s);
  ctx.lineTo(rightFootX+7*s,rightFootY+2*s);
  ctx.lineTo(leftFootX-7*s,leftFootY+2*s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle=accent;
  ctx.lineWidth=1.4;
  ctx.setLineDash([4,4]);
  ctx.stroke();
  ctx.setLineDash([]);
 }

 ctx.fillStyle=bodyFill;
 ctx.strokeStyle=bodyStroke;
 ctx.lineWidth=1.6;
 ctx.beginPath();
 ctx.moveTo(base.x-11*s,hipY);ctx.lineTo(base.x-2*s,hipY);
 ctx.lineTo(leftFootX+4*s,leftFootY);ctx.lineTo(leftFootX-5*s,leftFootY);
 ctx.closePath();ctx.fill();ctx.stroke();

 ctx.beginPath();
 ctx.moveTo(base.x+2*s,hipY);ctx.lineTo(base.x+11*s,hipY);
 ctx.lineTo(rightFootX+5*s,rightFootY);ctx.lineTo(rightFootX-4*s,rightFootY);
 ctx.closePath();ctx.fill();ctx.stroke();

 ctx.beginPath();
 ctx.moveTo(base.x-14*s,shoulderY);ctx.lineTo(base.x+14*s,shoulderY);
 ctx.lineTo(base.x+10*s,hipY);ctx.lineTo(base.x-10*s,hipY);
 ctx.closePath();ctx.fill();ctx.stroke();

 ctx.beginPath();
 ctx.arc(base.x,headY,9.5*s,0,Math.PI*2);
 ctx.fill();ctx.stroke();

 ctx.font=`600 ${Math.round(11*Math.max(0.85,s))}px system-ui, -apple-system, sans-serif`;
 ctx.textAlign='center';
 ctx.fillStyle=accent;
 ctx.fillText(`Performer ${p.id}`,base.x,headY-15*s);
 ctx.restore();
}

function drawQuadWarpedPreview(
 ctx:CanvasRenderingContext2D,
 source:HTMLCanvasElement|null,
 quad:Quad,
 w:number,h:number,
 dims:MapStageDimensions,
 alpha=0.84
){
 if(!source||source.width<=0||source.height<=0)return;
 const p=quad.map(pt=>stageFloorToScreen(pt.x,pt.y,w,h,dims));
 const minX=Math.min(p[0].x,p[1].x,p[2].x,p[3].x);
 const maxX=Math.max(p[0].x,p[1].x,p[2].x,p[3].x);
 const minY=Math.min(p[0].y,p[1].y,p[2].y,p[3].y);
 const maxY=Math.max(p[0].y,p[1].y,p[2].y,p[3].y);
 if(maxX-minX<4||maxY-minY<4)return;
 ctx.save();
 ctx.beginPath();
 ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.lineTo(p[2].x,p[2].y);ctx.lineTo(p[3].x,p[3].y);
 ctx.closePath();
 ctx.clip();
 ctx.globalAlpha=alpha;
 ctx.drawImage(source,minX,minY,maxX-minX,maxY-minY);
 ctx.restore();
}

export function MapStageMonitor({
 view,onChangeView,selected,plan,editingCorners,activeCorner,onSelectCorner,snapEnabled,
 stageDimensions,hasLiveSource,sourceKind,simState,onStartSim,onStopSim,onToggleSimPlay,
 onMoveSimPerformer,onCommitProjectorQuad,onOpenCameraCalibration,
 previewView,onChangePreviewView,softwareMode,connected,qa,viewport,
 bodyCanvas,floorCanvas,liquidCanvas,experimentInputCanvas,videoRef,
 frameRef,floorTracker,motionEvents,testCanvases,performerCount,identitySafe
}:Props){
 const stageCanvasRef=useRef<HTMLCanvasElement>(null);
 const camCanvasRef=useRef<HTMLCanvasElement>(null);
 const svgRef=useRef<SVGSVGElement>(null);
 const [draftQuad,setDraftQuad]=useState<Quad>(plan.projectorQuad);
 const [draggingCorner,setDraggingCorner]=useState<MapCornerIndex|null>(null);
 const [hoveredCorner,setHoveredCorner]=useState<MapCornerIndex|null>(null);
 const [draggingPerformer,setDraggingPerformer]=useState<'A'|'B'|null>(null);
 const [snapGuides,setSnapGuides]=useState<{x:number|null;y:number|null}>({x:null,y:null});
 const [pattern,setPattern]=useState<CalibrationGuidePattern>('grid');
 const [showPoseOverlay,setShowPoseOverlay]=useState(true);
 const [quadError,setQuadError]=useState('');
 const draftRef=useRef(draftQuad);draftRef.current=draftQuad;

 useEffect(()=>{
  if(draggingCorner===null)setDraftQuad(plan.projectorQuad.map(p=>({...p})) as Quad);
 },[plan.projectorQuad,draggingCorner]);

 // Render calibration stage canvas (~24 fps)
 useEffect(()=>{
  if(view!=='stage'&&view!=='split')return;
  const canvas=stageCanvasRef.current;
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  let raf=0;
  let lastPaint=0;

  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);
   if(now-lastPaint<38)return;
   lastPaint=now;

   ctx.setTransform(1,0,0,1,0,0);
   // Track-exact deep pitch obsidian stage interior (#050806)
   ctx.fillStyle='#050806';
   ctx.fillRect(0,0,W,H);

   const ul=stageFloorToScreen(0,0,W,H,stageDimensions);
   const ur=stageFloorToScreen(1,0,W,H,stageDimensions);
   const dr=stageFloorToScreen(1,1,W,H,stageDimensions);
   const dl=stageFloorToScreen(0,1,W,H,stageDimensions);

   // Subtle upstage wall reference when calibrating BODY
   if(selected==='body'){
    const wallTop=Math.max(24,ul.y-92);
    ctx.save();
    ctx.fillStyle='rgba(128, 207, 216, 0.06)';
    ctx.strokeStyle='rgba(128, 207, 216, 0.36)';
    ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(ul.x,wallTop);ctx.lineTo(ur.x,wallTop);ctx.lineTo(ur.x,ur.y);ctx.lineTo(ul.x,ul.y);
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.font='600 10px ui-monospace, monospace';
    ctx.fillStyle='#8fdce4';
    ctx.textAlign='center';
    ctx.fillText('BIDANG TUBUH · 1 OUTPUT BODY (A + B)',W/2,wallTop+15);
    ctx.restore();
   }

   // Physical room floor reference frame (exact stageDimensions ratio)
   ctx.save();
   ctx.fillStyle='#0a120d';
   ctx.beginPath();
   ctx.moveTo(ul.x,ul.y);ctx.lineTo(ur.x,ur.y);ctx.lineTo(dr.x,dr.y);ctx.lineTo(dl.x,dl.y);
   ctx.closePath();
   ctx.fill();
   ctx.strokeStyle='rgba(110, 146, 120, 0.34)';
   ctx.lineWidth=1.2;
   ctx.stroke();

   // Exact physical meter grid (1m major + 0.5m minor subdivisions)
   const cols=Math.max(1,Math.round(stageDimensions.widthM));
   const rows=Math.max(1,Math.round(stageDimensions.depthM));
   const subCols=cols*2;
   const subRows=rows*2;

   ctx.strokeStyle='rgba(124, 162, 134, 0.08)';
   ctx.lineWidth=1;
   for(let i=1;i<subCols;i++){
    if(i%2===0)continue;
    const u=i/subCols;
    const a=stageFloorToScreen(u,0,W,H,stageDimensions);
    const b=stageFloorToScreen(u,1,W,H,stageDimensions);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   }
   for(let j=1;j<subRows;j++){
    if(j%2===0)continue;
    const v=j/subRows;
    const a=stageFloorToScreen(0,v,W,H,stageDimensions);
    const b=stageFloorToScreen(1,v,W,H,stageDimensions);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   }

   ctx.strokeStyle='rgba(156, 196, 166, 0.19)';
   ctx.lineWidth=1.1;
   for(let i=1;i<cols;i++){
    const u=i/cols;
    const a=stageFloorToScreen(u,0,W,H,stageDimensions);
    const b=stageFloorToScreen(u,1,W,H,stageDimensions);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   }
   for(let j=1;j<rows;j++){
    const v=j/rows;
    const a=stageFloorToScreen(0,v,W,H,stageDimensions);
    const b=stageFloorToScreen(1,v,W,H,stageDimensions);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   }

   // Stage center mark & physical ruler markings
   const leftMid=stageFloorToScreen(0,0.5,W,H,stageDimensions);
   ctx.font='600 11px ui-monospace, monospace';
   ctx.fillStyle='rgba(164, 190, 170, 0.78)';
   ctx.textAlign='center';
   ctx.fillText(`Lebar ${stageDimensions.widthM.toFixed(1)} m`,W/2,dl.y+22);
   ctx.textAlign='right';
   ctx.fillText(`Dalam ${stageDimensions.depthM.toFixed(1)} m`,Math.max(90,leftMid.x-14),leftMid.y+4);
   ctx.textAlign='center';
   ctx.fillStyle='rgba(136, 164, 144, 0.55)';
   ctx.font='600 10px ui-monospace, monospace';
   ctx.fillText('DEPAN / UPSTAGE',W/2,ul.y-10);
   ctx.restore();

   // Calibrated Projector Quad region + live Compose raster + calibration alignment pattern
   const q=draftRef.current;
   const qPts=q.map(p=>stageFloorToScreen(p.x,p.y,W,H,stageDimensions));
   const strokeColor=selected==='floor'?'#cbe9a7':'#80cfd8';

   ctx.save();
   ctx.beginPath();
   ctx.moveTo(qPts[0].x,qPts[0].y);ctx.lineTo(qPts[1].x,qPts[1].y);
   ctx.lineTo(qPts[2].x,qPts[2].y);ctx.lineTo(qPts[3].x,qPts[3].y);
   ctx.closePath();
   ctx.fillStyle=selected==='floor'?'rgba(203, 233, 167, 0.055)':'rgba(128, 207, 216, 0.06)';
   ctx.fill();

   // Mirror actual Compose visual raster inside the calibrated projection boundary
   if(selected==='floor'){
    const src=liquidCanvas?.current&&liquidCanvas.current.width>0?liquidCanvas.current:floorCanvas.current;
    drawQuadWarpedPreview(ctx,src,q,W,H,stageDimensions,hasLiveSource?0.85:0.4);
   }else{
    drawQuadWarpedPreview(ctx,bodyCanvas.current,q,W,H,stageDimensions,hasLiveSource?0.8:0.35);
   }

   // Internal bilinear calibration guide pattern inside the active projector quad
   const bilerp=(u:number,v:number)=>{
    const topX=q[0].x+(q[1].x-q[0].x)*u;
    const topY=q[0].y+(q[1].y-q[0].y)*u;
    const botX=q[3].x+(q[2].x-q[3].x)*u;
    const botY=q[3].y+(q[2].y-q[3].y)*u;
    return stageFloorToScreen(topX+(botX-topX)*v,topY+(botY-topY)*v,W,H,stageDimensions);
   };

   if(pattern==='grid'){
    ctx.strokeStyle=selected==='floor'?'rgba(203, 233, 167, 0.24)':'rgba(128, 207, 216, 0.24)';
    ctx.lineWidth=1;
    for(const t of [0.25,0.5,0.75]){
     const a=bilerp(t,0),b=bilerp(t,1);
     ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
     const c=bilerp(0,t),d=bilerp(1,t);
     ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();
    }
   }else if(pattern==='crosshair'){
    ctx.strokeStyle=selected==='floor'?'rgba(203, 233, 167, 0.42)':'rgba(128, 207, 216, 0.42)';
    ctx.lineWidth=1.2;
    const hA=bilerp(0,0.5),hB=bilerp(1,0.5),vA=bilerp(0.5,0),vB=bilerp(0.5,1);
    ctx.beginPath();ctx.moveTo(hA.x,hA.y);ctx.lineTo(hB.x,hB.y);ctx.moveTo(vA.x,vA.y);ctx.lineTo(vB.x,vB.y);ctx.stroke();
    const mid=bilerp(0.5,0.5);
    ctx.beginPath();ctx.arc(mid.x,mid.y,26,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(mid.x,mid.y,56,0,Math.PI*2);ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
   }else if(pattern==='diagonal'){
    ctx.strokeStyle=selected==='floor'?'rgba(203, 233, 167, 0.38)':'rgba(128, 207, 216, 0.38)';
    ctx.lineWidth=1.2;
    ctx.setLineDash([6,5]);
    ctx.beginPath();
    ctx.moveTo(qPts[0].x,qPts[0].y);ctx.lineTo(qPts[2].x,qPts[2].y);
    ctx.moveTo(qPts[1].x,qPts[1].y);ctx.lineTo(qPts[3].x,qPts[3].y);
    ctx.stroke();
    ctx.setLineDash([]);
   }

   // Quad centroid calibration crosshair
   const center=bilerp(0.5,0.5);
   ctx.strokeStyle=strokeColor;
   ctx.globalAlpha=0.72;
   ctx.lineWidth=1.4;
   ctx.beginPath();
   ctx.arc(center.x,center.y,7,0,Math.PI*2);
   ctx.moveTo(center.x-13,center.y);ctx.lineTo(center.x+13,center.y);
   ctx.moveTo(center.x,center.y-13);ctx.lineTo(center.x,center.y+13);
   ctx.stroke();
   ctx.globalAlpha=1;

   // Outer calibrated quad perimeter
   ctx.strokeStyle=strokeColor;
   ctx.lineWidth=editingCorners?2:1.5;
   ctx.setLineDash(editingCorners?[]:[7,5]);
   ctx.beginPath();
   ctx.moveTo(qPts[0].x,qPts[0].y);ctx.lineTo(qPts[1].x,qPts[1].y);
   ctx.lineTo(qPts[2].x,qPts[2].y);ctx.lineTo(qPts[3].x,qPts[3].y);
   ctx.closePath();
   ctx.stroke();
   ctx.setLineDash([]);
   ctx.restore();

   // Optional Performer & Footprint overlay ONLY when live Track source OR explicit Simulation is active
   const liveEvents=motionEvents?.()??[];
   if(hasLiveSource&&liveEvents.length>0){
    const recent=liveEvents.slice(-14);
    for(const ev of recent){
     const pt=stageFloorToScreen(ev.x,ev.y,W,H,stageDimensions);
     const isB=ev.actorId==='B';
     paintAuthenticFootprint(ctx,{
      x:pt.x,y:pt.y,side:ev.foot==='right'?'right':'left',
      headingRad:(ev.headingRad??0)-Math.PI/2,
      widthPx:10.5*pt.scale,lengthPx:24*pt.scale,
      alpha:Math.max(0.35,Math.min(0.85,ev.confidence??0.72)),
      color:isB?'#8ad8e2':'#cbe9a7'
     });
    }
    const latestByActor=new Map<'A'|'B',FootMotionEventV2>();
    for(const ev of recent){
     if(ev.actorId==='A'||ev.actorId==='B')latestByActor.set(ev.actorId,ev);
    }
    const liveActors:MapSimPerformer[]=[];
    for(const [id,ev] of latestByActor.entries()){
     if(id==='B'&&performerCount<2)continue;
     liveActors.push({id,x:ev.x,y:ev.y,headingRad:ev.headingRad??0,phaseRad:now*0.004,stride:0.1});
    }
    liveActors.sort((a,b)=>a.y-b.y);
    for(const p of liveActors)drawStudioPerformer(ctx,p,selected==='body',W,H,stageDimensions);
   }else if(!hasLiveSource&&simState.active){
    for(const fp of simState.footprints){
     const pt=stageFloorToScreen(fp.x,fp.y,W,H,stageDimensions);
     const age=Math.max(0,(simState.elapsedMs-fp.atMs)/1000);
     const alpha=Math.max(0.18,Math.min(0.85,1-age*0.08));
     const isB=fp.actorId==='B';
     paintAuthenticFootprint(ctx,{
      x:pt.x,y:pt.y,side:fp.foot,
      headingRad:fp.headingRad-Math.PI/2,
      widthPx:10*pt.scale,lengthPx:23*pt.scale,
      alpha,color:isB?'#8ad8e2':'#cbe9a7'
     });
    }
    const sorted=[...simState.performers].sort((a,b)=>a.y-b.y);
    for(const p of sorted)drawStudioPerformer(ctx,p,selected==='body',W,H,stageDimensions);
   }

   if(!identitySafe&&hasLiveSource){
    ctx.save();
    ctx.fillStyle='rgba(76, 39, 37, 0.90)';
    ctx.strokeStyle='#d49282';
    ctx.lineWidth=1.2;
    ctx.fillRect(W/2-185,16,370,30);
    ctx.strokeRect(W/2-185,16,370,30);
    ctx.font='600 11px system-ui, sans-serif';
    ctx.fillStyle='#ffece6';
    ctx.textAlign='center';
    ctx.fillText('Identitas A/B ambigu — mask tubuh ditahan aman',W/2,35);
    ctx.restore();
   }
  };

  raf=requestAnimationFrame(paint);
  return()=>cancelAnimationFrame(raf);
 },[
  view,selected,editingCorners,pattern,stageDimensions,hasLiveSource,simState,
  bodyCanvas,floorCanvas,liquidCanvas,motionEvents,performerCount,identitySafe
 ]);

 // Render Camera Feed view (~20 fps)
 useEffect(()=>{
  if(view!=='camera')return;
  const canvas=camCanvasRef.current;
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  let raf=0;
  let lastPaint=0;

  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);
   if(now-lastPaint<50)return;
   lastPaint=now;
   ctx.fillStyle='#050806';
   ctx.fillRect(0,0,W,H);

   const vid=videoRef?.current;
   const exp=experimentInputCanvas?.current;
   let painted=false;
   if(sourceKind==='camera'&&vid&&vid.readyState>=2&&vid.videoWidth>0){
    ctx.drawImage(vid,0,0,W,H);
    painted=true;
   }else if((sourceKind==='video'||sourceKind==='simulator')&&exp&&exp.width>0&&exp.height>0){
    ctx.drawImage(exp,0,0,W,H);
    painted=true;
   }

   if(!painted){
    ctx.strokeStyle='rgba(128, 160, 138, 0.16)';
    ctx.strokeRect(48,48,W-96,H-96);
    ctx.font='600 13px system-ui, sans-serif';
    ctx.fillStyle='#9eb3a1';
    ctx.textAlign='center';
    ctx.fillText('Feed kamera / video belum aktif di Track.',W/2,H/2-6);
    ctx.font='400 11px system-ui, sans-serif';
    ctx.fillStyle='#79917e';
    ctx.fillText('Aktifkan sumber di Track untuk melihat titik kaki dan kalibrasi kamera → lantai.',W/2,H/2+16);
    return;
   }

   const cal=floorTracker?.calibrationData;
   if(cal&&cal.cameraQuad.length===4){
    ctx.save();
    ctx.strokeStyle='#cbe9a7';
    ctx.lineWidth=2;
    ctx.beginPath();
    cal.cameraQuad.forEach((pt,idx)=>{
     const px=pt.x*W,py=pt.y*H;
     if(idx===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    });
    ctx.closePath();
    ctx.fillStyle='rgba(203, 233, 167, 0.08)';
    ctx.fill();ctx.stroke();
    ctx.restore();
   }

   if(showPoseOverlay&&frameRef?.current?.pose?.length){
    const lms=frameRef.current.pose;
    const footIndices=[27,28,29,30,31,32];
    ctx.save();
    for(const idx of footIndices){
     const lm=lms[idx];
     if(!lm||(lm.visibility??1)<0.35)continue;
     ctx.fillStyle=idx%2===1?'#cbe9a7':'#8ad8e2';
     ctx.beginPath();
     ctx.arc(lm.x*W,lm.y*H,5.5,0,Math.PI*2);
     ctx.fill();
     ctx.strokeStyle='#050806';
     ctx.lineWidth=1.5;
     ctx.stroke();
    }
    ctx.restore();
   }
  };
  raf=requestAnimationFrame(paint);
  return()=>cancelAnimationFrame(raf);
 },[view,sourceKind,videoRef,experimentInputCanvas,floorTracker,frameRef,showPoseOverlay]);

 const commitQuadSafe=(next:Quad)=>{
  try{
   onCommitProjectorQuad(next);
   setDraftQuad(next);
   setQuadError('');
  }catch(err){
   setDraftQuad(plan.projectorQuad);
   setQuadError(err instanceof Error?err.message:'Sudut bersilangan atau tidak valid.');
  }
 };

 const pointerToFloorUV=(e:PointerEvent<SVGSVGElement>)=>{
  const rect=e.currentTarget.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return null;
  const px=(e.clientX-rect.left)/rect.width*W;
  const py=(e.clientY-rect.top)/rect.height*H;
  return screenToStageFloor(px,py,W,H,stageDimensions);
 };

 const onSvgPointerMove=(e:PointerEvent<SVGSVGElement>)=>{
  if(draggingCorner!==null){
   const uv=pointerToFloorUV(e);
   if(!uv)return;
   const snapped=snapQuadPoint(uv,snapEnabled);
   setSnapGuides({
    x:snapEnabled&&snapped.x!==uv.x?snapped.x:null,
    y:snapEnabled&&snapped.y!==uv.y?snapped.y:null
   });
   const next=moveMapCorner(draftRef.current,draggingCorner,snapped);
   draftRef.current=next;
   setDraftQuad(next);
  }else if(draggingPerformer){
   const uv=pointerToFloorUV(e);
   if(uv)onMoveSimPerformer(draggingPerformer,uv);
  }
 };

 const onSvgPointerUp=(e:PointerEvent<SVGSVGElement>)=>{
  if(draggingCorner!==null){
   const uv=pointerToFloorUV(e);
   const next=uv?moveMapCorner(draftRef.current,draggingCorner,snapQuadPoint(uv,snapEnabled)):draftRef.current;
   setDraggingCorner(null);
   setSnapGuides({x:null,y:null});
   commitQuadSafe(next);
  }
  if(draggingPerformer)setDraggingPerformer(null);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };

 const onSvgKeyDown=(e:KeyboardEvent<SVGSVGElement>)=>{
  if(!editingCorners)return;
  if(e.key==='Escape'){
   e.preventDefault();
   setDraggingCorner(null);
   setSnapGuides({x:null,y:null});
   setDraftQuad(plan.projectorQuad);
   setQuadError('');
   return;
  }
  if(e.key>='1'&&e.key<='4'){
   e.preventDefault();
   onSelectCorner((Number(e.key)-1) as MapCornerIndex);
   return;
  }
  const step=e.shiftKey?0.015:0.002;
  let dx=0,dy=0;
  if(e.key==='ArrowLeft')dx=-step;
  else if(e.key==='ArrowRight')dx=step;
  else if(e.key==='ArrowUp')dy=-step;
  else if(e.key==='ArrowDown')dy=step;
  else return;
  e.preventDefault();
  const p=draftRef.current[activeCorner];
  const next=moveMapCorner(draftRef.current,activeCorner,snapQuadPoint({x:p.x+dx,y:p.y+dy},false));
  draftRef.current=next;
  commitQuadSafe(next);
 };

 const screenQuad=draftQuad.map(p=>stageFloorToScreen(p.x,p.y,W,H,stageDimensions));
 const activePt=draftQuad[activeCorner];
 const activeScreen=screenQuad[activeCorner];
 const meterX=(activePt.x*stageDimensions.widthM).toFixed(2);
 const meterY=(activePt.y*stageDimensions.depthM).toFixed(2);
 const accentHex=selected==='floor'?'#cbe9a7':'#80cfd8';

 const renderStagePane=()=>(
  <div className="map-r2-viewport" data-editing={editingCorners||undefined}>
   <canvas ref={stageCanvasRef} width={W} height={H} className="map-r2-canvas"
    aria-label="Kanvas kalibrasi panggung Map"/>
   <svg ref={svgRef} className="map-r2-overlay" viewBox={`0 0 ${W} ${H}`}
    tabIndex={editingCorners?0:-1}
    role="img"
    aria-label={editingCorners?'Handle 4 sudut kalibrasi. Seret sudut 1 hingga 4 atau gunakan panah keyboard.':'Pratinjau kalibrasi panggung Map'}
    onKeyDown={onSvgKeyDown}
    onPointerMove={onSvgPointerMove}
    onPointerUp={onSvgPointerUp}
    onPointerCancel={e=>{
     setDraggingCorner(null);setDraggingPerformer(null);setSnapGuides({x:null,y:null});
     setDraftQuad(plan.projectorQuad);
     if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    }}>

    {/* Live magnetic snap alignment guides while dragging */}
    {snapGuides.x!==null&&(()=>{
     const a=stageFloorToScreen(snapGuides.x,0,W,H,stageDimensions);
     const b=stageFloorToScreen(snapGuides.x,1,W,H,stageDimensions);
     return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbe9a7" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.72" pointerEvents="none"/>;
    })()}
    {snapGuides.y!==null&&(()=>{
     const a=stageFloorToScreen(0,snapGuides.y,W,H,stageDimensions);
     const b=stageFloorToScreen(1,snapGuides.y,W,H,stageDimensions);
     return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbe9a7" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.72" pointerEvents="none"/>;
    })()}

    {/* Optional draggable performers when simulation is active and corners are locked */}
    {!hasLiveSource&&simState.active&&!editingCorners&&simState.performers.map(p=>{
     const pt=stageFloorToScreen(p.x,p.y,W,H,stageDimensions);
     return <circle key={p.id} cx={pt.x} cy={pt.y-42*pt.scale} r={32*pt.scale}
      fill="transparent" style={{cursor:'grab',touchAction:'none'}}
      aria-label={`Geser Performer ${p.id} di panggung`}
      onPointerDown={e=>{
       e.stopPropagation();e.preventDefault();
       e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
       setDraggingPerformer(p.id);
      }}/>;
    })}

    {/* Interactive 4-corner calibration handles directly over perspective room */}
    {editingCorners&&<>
     {/* Highlight adjacent edges of hovered or active corner */}
     {(()=>{
      const hi=hoveredCorner??activeCorner;
      const prevIdx=(hi+3)%4,nextIdx=(hi+1)%4;
      return <g stroke={accentHex} strokeWidth="2.8" opacity="0.78" pointerEvents="none">
       <line x1={screenQuad[prevIdx].x} y1={screenQuad[prevIdx].y} x2={screenQuad[hi].x} y2={screenQuad[hi].y}/>
       <line x1={screenQuad[hi].x} y1={screenQuad[hi].y} x2={screenQuad[nextIdx].x} y2={screenQuad[nextIdx].y}/>
      </g>;
     })()}

     {screenQuad.map((pt,idx)=>{
      const isAct=activeCorner===idx;
      const isDrag=draggingCorner===idx;
      const isHov=hoveredCorner===idx;
      return <g key={idx} transform={`translate(${pt.x},${pt.y})`}>
       {(isAct||isHov)&&<circle r={isDrag?24:20} fill="none" stroke={accentHex} strokeWidth={isDrag?2.2:1.6} strokeDasharray="4 4" opacity={isAct?0.95:0.55} pointerEvents="none"/>}
       <circle r={isDrag?15:13.5}
        fill={isDrag?'#2f5b3f':isAct?'#22412e':'#101c15'}
        stroke={isAct||isHov?'#eefad3':'#9fc0a6'}
        strokeWidth={isAct?2.8:2}
        style={{cursor:isDrag?'grabbing':'grab',touchAction:'none'}}
        onPointerEnter={()=>setHoveredCorner(idx as MapCornerIndex)}
        onPointerLeave={()=>setHoveredCorner(prev=>prev===idx?null:prev)}
        onPointerDown={e=>{
         e.stopPropagation();e.preventDefault();
         e.currentTarget.ownerSVGElement?.focus({preventScroll:true});
         e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
         draftRef.current=draftQuad;
         onSelectCorner(idx as MapCornerIndex);
         setDraggingCorner(idx as MapCornerIndex);
        }}/>
       <text textAnchor="middle" dominantBaseline="middle" fill="#f3fbf0" fontSize="12" fontWeight="700" pointerEvents="none">{idx+1}</text>
      </g>;
     })}

     {/* Single contextual precision readout (meter + UV) cleanly clear of labels and edges */}
     {(()=>{
      const tipText=`${activeCorner+1} ${CORNER_LABELS[activeCorner]} · ${meterX}m, ${meterY}m (${Math.round(activePt.x*100)}%,${Math.round(activePt.y*100)}%)`;
      const boxW=Math.max(256,Math.ceil(tipText.length*6.9)+24);
      const preferRight=activeCorner===1||activeCorner===2;
      const rawX=preferRight?activeScreen.x-boxW+18:activeScreen.x-18;
      const boxX=Math.min(W-boxW-12,Math.max(12,rawX));
      const boxY=Math.max(10,activeScreen.y-46);
      return <g transform={`translate(${boxX},${boxY})`} pointerEvents="none">
       <rect x="0" y="0" width={boxW} height="24" rx="5" fill="rgba(12, 20, 15, 0.96)" stroke="rgba(166, 204, 150, 0.56)" strokeWidth="1"/>
       <text x="11" y="16" fill="#e8f3e3" fontSize="10.5" fontFamily="ui-monospace, monospace">
        {tipText}
       </text>
      </g>;
     })()}
    </>}
   </svg>

   {quadError&&<div className="map-r2-inline-alert" role="alert">{quadError}</div>}
  </div>
 );

 const renderOutputPane=()=>(
  <div className="map-r2-output-pane">
   <div className="map-r2-output-head">
    <span>Hasil Proyektor · {selected==='body'?'Tubuh (BODY)':'Lantai (FLOOR)'}</span>
    <div className="map-r2-seg-mini" role="group" aria-label="Mode sinyal proyektor">
     <button type="button" aria-pressed={previewView==='draft'} onClick={()=>onChangePreviewView('draft')}>Draf lokal</button>
     <button type="button" aria-pressed={previewView==='sent'} onClick={()=>onChangePreviewView('sent')}>Sinyal dikirim</button>
    </div>
   </div>
   <ProjectorWysiwygPreview surface={selected} plan={plan} view={previewView}
    softwareMode={softwareMode} connected={connected} qa={qa}
    liveCanvas={selected==='body'?bodyCanvas:floorCanvas}
    testCanvases={testCanvases} viewport={viewport}/>
  </div>
 );

 return <div className="map-r2-monitor" aria-label="Stage Map Monitor">
  {/* Track-matching monitor header bar */}
  <div className="map-r2-monitor-head">
   <div className="map-r2-monitor-title">
    <strong>Kalibrasi {selected==='floor'?'Lantai':'Tubuh (A+B)'}</strong>
    <span>{stageDimensions.widthM}×{stageDimensions.depthM} m</span>
    {simState.active&&!hasLiveSource&&<span className="map-r2-sim-tag">SIMULASI</span>}
   </div>
   <div className="map-r2-monitor-tools">
    {(view==='stage'||view==='split')&&
     <div className="map-r2-seg-mini" role="group" aria-label="Pola bantu kalibrasi">
      {([['grid','Grid'],['crosshair','Cross'],['diagonal','Diag'],['off','Off']] as const).map(([id,lbl])=>
       <button type="button" key={id} aria-pressed={pattern===id} onClick={()=>setPattern(id)}>{lbl}</button>)}
     </div>}
    {!hasLiveSource&&(
     simState.active
      ?<>
        <button type="button" className="map-r2-sim-btn" onClick={onToggleSimPlay}>
         {simState.playing?<><Pause size={11}/> Jeda</>:<><Play size={11}/> Jalan</>}
        </button>
        <button type="button" className="map-r2-sim-btn" onClick={onStopSim}>Tutup simulasi</button>
       </>
      :<button type="button" className="map-r2-sim-btn map-r2-cta-sim" onClick={onStartSim}
        title="Opsional: tampilkan 2 performer virtual untuk menguji hasil kalibrasi">
        <Users size={11}/> Gunakan simulasi
       </button>
    )}
   </div>
  </div>

  {view==='stage'&&renderStagePane()}
  {view==='camera'&&<div className="map-r2-viewport">
   <canvas ref={camCanvasRef} width={W} height={H} className="map-r2-canvas" aria-label="Tampilan feed kamera Map"/>
   <div className="map-r2-cam-bar">
    <label className="map-r2-pose-toggle">
     <input type="checkbox" checked={showPoseOverlay} onChange={e=>setShowPoseOverlay(e.target.checked)}/> Overlay titik kaki
    </label>
    {onOpenCameraCalibration&&<button type="button" className="map-r2-sim-btn" onClick={onOpenCameraCalibration}>
     Kalibrasi kamera di Track
    </button>}
   </div>
  </div>}
  {view==='output'&&renderOutputPane()}
  {view==='split'&&<div className="map-r2-split">
   {renderStagePane()}
   {renderOutputPane()}
  </div>}

  <div className="map-r2-view-bar">
   <div className="map-r2-view-switch" role="group" aria-label="Mode tampilan Stage Map Monitor">
    {([
     ['stage','Panggung'],
     ['camera','Kamera'],
     ['output','Hasil Proyektor'],
     ['split','Split']
    ] as const).map(([id,label])=><button type="button" key={id} aria-pressed={view===id}
     onClick={()=>onChangeView(id)}>{label}</button>)}
   </div>
   <span className="map-r2-parity-note">
    {connected?'Transformasi sama dengan jendela output':'Pratinjau perkiraan software · uji fisik diperlukan'}
   </span>
  </div>
 </div>;
}
