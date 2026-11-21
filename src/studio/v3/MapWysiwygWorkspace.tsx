
import {useEffect,useRef,useState,type PointerEvent,type RefObject,type KeyboardEvent} from 'react';
import {Check,Maximize2,Minimize2,Pause,Play,RotateCcw,ScanLine} from 'lucide-react';
import type {Quad,Point} from '../../projection/geometry.ts';
import {identityQuad,transform,homography} from '../../projection/geometry.ts';
import type {LiveFloorTrackingEngine} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import type {StageSurface,StageSurfacePlan} from '../../footprints/stage-optics/DualSurfaceCalibration.ts';
import type {MapSimState,MapStageDimensions} from './mapStageModel.ts';
import {paintAuthenticFootprint} from '../../footprints/scenes/authenticFootGeometry.ts';
import {containedImageRect,initialCameraQuad,pointerInSource,replaceValidCorner,paintMapWarp} from './mapWysiwygModel.ts';
import './map-wysiwyg.css';

type Props={
 selected:StageSurface;
 stageDimensions:MapStageDimensions;
 plan:StageSurfacePlan;
 sourceKind:'camera'|'video'|'simulator'|'demo-sim'|'none';
 hasLiveSource:boolean;
 videoRef?:RefObject<HTMLVideoElement|null>;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
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
 onCommitProjectorQuad:(quad:Quad)=>void;
 onMessage:(message:string)=>void;
};
const W=640,H=360;
const numericPoint=(p:Point)=>({x:p.x*W,y:p.y*H});
const pointsString=(quad:Quad,box:{x:number;y:number;width:number;height:number})=>
 quad.map(p=>String(box.x+p.x*box.width)+','+String(box.y+p.y*box.height)).join(' ');
const validSource=(mode:Props['sourceKind'],video:HTMLVideoElement|null|undefined,exp:HTMLCanvasElement|null|undefined)=>{
 if(mode==='camera'&&video&&video.readyState>=2&&video.videoWidth&&video.videoHeight)
  return {media:video as CanvasImageSource,width:video.videoWidth,height:video.videoHeight};
 if((mode==='video'||mode==='simulator')&&exp&&exp.width&&exp.height)
  return {media:exp as CanvasImageSource,width:exp.width,height:exp.height};
 return null;
};
export function MapWysiwygWorkspace({
 selected,stageDimensions,plan,sourceKind,hasLiveSource,videoRef,experimentInputCanvas,
 floorTracker,floorCanvas,bodyCanvas,liquidCanvas,simState,onStartSim,onStopSim,
 onToggleSimPlay,onCommitCameraQuad,onBeginCameraEdit,onBeginProjectorEdit,
 onCommitProjectorQuad,onMessage
}:Props){
 const [cameraDraft,setCameraDraft]=useState<Quad>(()=>floorTracker?.calibrationData?.cameraQuad??initialCameraQuad());
 const [outputDraft,setOutputDraft]=useState<Quad>(()=>plan.projectorQuad);
 const [cameraDirty,setCameraDirty]=useState(false);
 const [outputDirty,setOutputDirty]=useState(false);
 const [frozen,setFrozen]=useState(false);
 const [projectorEdit,setProjectorEdit]=useState(false);
 const [fullScreen,setFullScreen]=useState(false);
 const [resetArmed,setResetArmed]=useState(false);
 const [sourceBox,setSourceBox]=useState({x:0,y:0,width:W,height:H});
 const [sourceAvailable,setSourceAvailable]=useState(false);
 const [status,setStatus]=useState('');
 const [pointer,setPointer]=useState<{target:'source'|'output';index:number;id:number}|null>(null);
 const sourceCanvas=useRef<HTMLCanvasElement>(null);
 const outputCanvas=useRef<HTMLCanvasElement>(null);
 const wrapper=useRef<HTMLDivElement>(null);
 const activePoint=useRef<number>(0);
 const cameraDraftRef=useRef(cameraDraft);
 const outputDraftRef=useRef(outputDraft);
 cameraDraftRef.current=cameraDraft;outputDraftRef.current=outputDraft;
 useEffect(()=>{
  const q=floorTracker?.calibrationData?.cameraQuad;
  if(q&&!cameraDirty)setCameraDraft(q.map(p=>({...p})) as Quad);
 },[floorTracker?.calibrationData,cameraDirty]);
 useEffect(()=>{if(!outputDirty)setOutputDraft(plan.projectorQuad.map(p=>({...p})) as Quad);},[plan.projectorQuad,outputDirty]);
 useEffect(()=>{setFrozen(false);setCameraDirty(false);setSourceAvailable(false);},[sourceKind]);
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
  let raf=0,last=0,seen=false,oldBox='';
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);if(now-last<46)return;last=now;
   const c=sourceCanvas.current,ctx=c?.getContext('2d');if(!c||!ctx)return;
   if(frozen)return;
   ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0a100d';ctx.fillRect(0,0,W,H);
   const src=validSource(sourceKind,videoRef?.current,experimentInputCanvas?.current);
   if(src){
    const box=containedImageRect(src.width,src.height,W,H);
    if(box){
     try{ctx.drawImage(src.media,box.x,box.y,box.width,box.height);}catch{/* changing input frame */}
     const signature=[box.x,box.y,box.width,box.height].join(':');
     if(signature!==oldBox){oldBox=signature;setSourceBox(box);}
     if(!seen){seen=true;setSourceAvailable(true);}
    }
   }else{
    if(seen){seen=false;setSourceAvailable(false);}
    ctx.fillStyle='#738a79';ctx.font='14px system-ui';ctx.textAlign='center';
    ctx.fillText(sourceKind==='none'||sourceKind==='demo-sim'?'Belum ada sumber kamera':'Menunggu gambar sumber…',W/2,H/2);
   }
  };
  raf=requestAnimationFrame(paint);return()=>cancelAnimationFrame(raf);
 },[sourceKind,videoRef,experimentInputCanvas,frozen]);
 useEffect(()=>{
  let raf=0,last=0;
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);if(now-last<46)return;last=now;
   const c=outputCanvas.current,ctx=c?.getContext('2d');if(!c||!ctx)return;
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);
   ctx.fillStyle='#090e0a';ctx.fillRect(0,0,W,H);
   const src=selected==='body'?bodyCanvas.current:(liquidCanvas?.current?.width?liquidCanvas.current:floorCanvas.current);
   const ready=!!src&&src.width>0&&src.height>0;
   if(ready)paintMapWarp(ctx,src!,plan.sourceQuad,outputDraftRef.current,W,H,8);
   if(!hasLiveSource&&simState.active){
    const matrix=homography(outputDraftRef.current);
    const recent=simState.footprints.slice(-28);
    for(const foot of recent){
     const p=transform(matrix,{x:foot.x,y:foot.y});
     const age=Math.max(0,(simState.elapsedMs-foot.atMs)/1000);
     paintAuthenticFootprint(ctx,{
      x:p.x*W,y:p.y*H,side:foot.foot,
      headingRad:foot.headingRad-Math.PI/2,
      widthPx:10,lengthPx:23,alpha:Math.max(.15,.75-age*.055),
      color:foot.actorId==='B'?'#8ad8e2':'#cbe9a7'
     });
    }
    for(const person of simState.performers){
     const p=transform(matrix,{x:person.x,y:person.y});
     ctx.beginPath();ctx.arc(p.x*W,p.y*H,7,0,2*Math.PI);
     ctx.fillStyle=person.id==='A'?'#cbe9a7':'#8ad8e2';ctx.fill();
    }
   }
   const q=outputDraftRef.current.map(numericPoint);
   ctx.strokeStyle=selected==='body'?'#80cfd8':'#cbe9a7';ctx.lineWidth=1.6;
   ctx.beginPath();q.forEach((p,i)=>{if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();
   ctx.stroke();
  };
  raf=requestAnimationFrame(paint);return()=>cancelAnimationFrame(raf);
 },[selected,plan.sourceQuad,plan.projectorQuad,hasLiveSource,simState,liquidCanvas,floorCanvas,bodyCanvas]);
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
  if(where==='source'&&!sourceAvailable)return;
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
  if(!next){setStatus('Sudut terlalu dekat atau bersilangan.');return;}
  if(where==='source')setCameraDraft(next);
  else setOutputDraft(next);
  setStatus('');
 };
 const stopMove=(e:PointerEvent<SVGSVGElement>,where:'source'|'output')=>{
  if(!pointer||pointer.target!==where||pointer.id!==e.pointerId)return;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  setPointer(null);
  if(where==='output'){
   onCommitProjectorQuad(outputDraftRef.current);setOutputDirty(false);
   onMessage('Posisi proyektor berubah. Uji output fisik perlu diulang.');
  }
 };
 const keyMove=(e:KeyboardEvent<SVGSVGElement>,where:'source'|'output')=>{
  if(e.key>='1'&&e.key<='4'){activePoint.current=Number(e.key)-1;return;}
  if(e.key==='Escape'){
   if(where==='source'){setCameraDraft(floorTracker?.calibrationData?.cameraQuad??initialCameraQuad());setCameraDirty(false);}
   else{setOutputDraft(plan.projectorQuad);setOutputDirty(false);}
   setStatus('Perubahan dibatalkan.');return;
  }
  const deltas:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  const d=deltas[e.key];if(!d)return;e.preventDefault();
  const value=overlayQuad(where),p=value[activePoint.current],step=e.shiftKey ? 0.01 : 0.002;
  const next=replaceValidCorner(value,activePoint.current,{
   x:Math.max(0,Math.min(1,p.x+d[0]*step)),y:Math.max(0,Math.min(1,p.y+d[1]*step))
  });
  if(!next){setStatus('Sudut tidak valid.');return;}
  if(where==='source'){
   if(!cameraDirty)onBeginCameraEdit();
   setCameraDirty(true);setCameraDraft(next);
  }else{
   if(!outputDirty)onBeginProjectorEdit();
   setOutputDirty(true);setOutputDraft(next);
   onCommitProjectorQuad(next);setOutputDirty(false);
  }
 };
 const applyCamera=()=>{
  if(!sourceAvailable||sourceKind!=='camera'){
   setStatus('Kalibrasi kamera memerlukan gambar kamera yang aktif.');return;
  }
  const result=onCommitCameraQuad(cameraDraftRef.current);
  setStatus(result.message);
  if(result.ok){setCameraDirty(false);setFrozen(false);}
 };
 const cancel=()=>{
  if(projectorEdit){setOutputDraft(plan.projectorQuad);setOutputDirty(false);}
  else{setCameraDraft(floorTracker?.calibrationData?.cameraQuad??initialCameraQuad());setCameraDirty(false);}
  setResetArmed(false);setStatus('Kembali ke posisi terakhir yang tersimpan.');
 };
 const reset=()=>{
  if(!resetArmed){setResetArmed(true);return;}
  if(projectorEdit){
   onBeginProjectorEdit();setOutputDraft(identityQuad());onCommitProjectorQuad(identityQuad());setOutputDirty(false);
  }else{
   onBeginCameraEdit();setCameraDraft(initialCameraQuad());setCameraDirty(true);
  }
  setResetArmed(false);setStatus('Titik dikembalikan ke awal. Periksa dan terapkan ulang.');
 };
 const mapOverlay=(where:'source'|'output')=>{
  const box=where==='source'?currentBox:projectorBox,q=overlayQuad(where);
  const canEdit=where==='source'?sourceAvailable&&sourceKind==='camera':projectorEdit;
  return <svg className="soma-map-wysiwyg-overlay" viewBox="0 0 640 360"
   role="group" aria-label={where==='source'?'Empat sudut lantai pada gambar sumber':'Empat sudut proyeksi'}
   tabIndex={canEdit?0:-1}
   onKeyDown={e=>keyMove(e,where)}
   onPointerMove={e=>move(e,where)}
   onPointerUp={e=>stopMove(e,where)}
   onPointerCancel={e=>stopMove(e,where)}>
   <polygon points={pointsString(q,box)} fill={where==='source'?'#b9e4a322':'transparent'}
    stroke={where==='source'?'#cbe9a7':'#80cfd8'} strokeWidth="2"/>
   {canEdit&&q.map((p,i)=>{
    const x=box.x+p.x*box.width,y=box.y+p.y*box.height;
    return <g key={i} className="soma-map-wysiwyg-handle" onPointerDown={e=>startMove(e,where,i)}>
     <circle cx={x} cy={y} r="14" fill="transparent"/>
     <circle cx={x} cy={y} r="9" fill="#d1ecc0" stroke="#132019" strokeWidth="1.5"/>
     <text x={x} y={y+3.5} fontSize="10" textAnchor="middle" fontWeight="700" fill="#122219">{i+1}</text>
    </g>;
   })}
  </svg>;
 };
 const isSourceMode=sourceKind==='camera'||sourceKind==='video'||sourceKind==='simulator';
 const sourceLabel=isSourceMode?(sourceKind==='camera'?'Kamera langsung':sourceKind==='video'?'Video MP4':'Simulasi 3D'):'Belum ada sumber';
 const calibrated=!!floorTracker?.isConfirmed&&!cameraDirty;
 return <section className="soma-map-wysiwyg" ref={wrapper} aria-label="Kalibrasi Map langsung">
  <div className="soma-map-wysiwyg-head">
   <div><strong>Bidang {selected==='floor'?'lantai':'tubuh'}</strong><span>{stageDimensions.widthM} × {stageDimensions.depthM} m</span></div>
   <button type="button" onClick={changeFullscreen} aria-label={fullScreen?'Tutup layar penuh':'Layar penuh Map'}>
    {fullScreen?<Minimize2 size={16}/>:<Maximize2 size={16}/>}
   </button>
  </div>
  <div className="soma-map-wysiwyg-grid">
   <div className="soma-map-wysiwyg-pane">
    <div className="soma-map-wysiwyg-pane-head"><b>{sourceLabel}</b><small>{sourceAvailable?(frozen?'Gambar dibekukan':'Gambar aktif'):'Pratinjau sumber'}</small></div>
    <div className="soma-map-wysiwyg-image">
     <canvas ref={sourceCanvas} width={W} height={H} aria-label="Gambar input kamera atau video"/>
     {sourceAvailable&&mapOverlay('source')}
    </div>
    <div className="soma-map-wysiwyg-controls">
     <button type="button" disabled={!sourceAvailable} onClick={()=>setFrozen(v=>!v)}>{frozen?'Lanjutkan gambar':'Bekukan gambar'}</button>
     <button type="button" disabled={!cameraDirty||sourceKind!=='camera'} onClick={applyCamera}><Check size={14}/> Terapkan bidang</button>
    </div>
    <p className="soma-map-wysiwyg-caption">
     {sourceKind==='camera'?(calibrated?'Bidang kamera tersimpan.':cameraDirty?'Periksa sudut, lalu terapkan.':'Tarik empat sudut mengikuti lantai pada gambar.'):
     'Kalibrasi kamera hanya tersedia untuk input kamera aktif.'}
    </p>
   </div>
   <div className="soma-map-wysiwyg-pane">
    <div className="soma-map-wysiwyg-pane-head"><b>Hasil visual {selected==='floor'?'lantai':'tubuh'}</b><small>{simState.active&&!hasLiveSource?'SIMULASI JEJAK':'Pratinjau Compose'}</small></div>
    <div className="soma-map-wysiwyg-image">
     <canvas ref={outputCanvas} width={W} height={H} aria-label="Hasil visual Compose dengan perspektif proyeksi"/>
     {mapOverlay('output')}
    </div>
    <div className="soma-map-wysiwyg-controls">
     <button type="button" aria-pressed={projectorEdit} onClick={()=>{setProjectorEdit(v=>!v);setResetArmed(false);}}>
      <ScanLine size={14}/> {projectorEdit?'Selesai atur':'Sesuaikan proyektor'}
     </button>
     <button type="button" onClick={cancel} disabled={!cameraDirty&&!outputDirty}>Batalkan</button>
    </div>
    <p className="soma-map-wysiwyg-caption">{projectorEdit?'Tarik sudut hasil; output fisik tetap Blackout sampai uji ulang.':'Visual Compose mengikuti bentuk proyeksi.'}</p>
   </div>
  </div>
  <div className="soma-map-wysiwyg-bottom">
   <div className="soma-map-wysiwyg-actions">
    {!hasLiveSource&&(simState.active?
     <><button type="button" onClick={onToggleSimPlay}>{simState.playing?<Pause size={14}/>:<Play size={14}/>} {simState.playing?'Jeda':'Jalankan'}</button>
     <button type="button" onClick={onStopSim}>Akhiri simulasi</button></>:
     <button type="button" onClick={onStartSim}><Play size={14}/> Coba simulasi</button>)}
    <button type="button" onClick={reset} title="Reset bidang aktif"><RotateCcw size={14}/> {resetArmed?'Konfirmasi reset':'Ulangi sudut'}</button>
   </div>
   <span>{status||'Geser sudut pada gambar. Hasil diperbarui langsung.'}</span>
  </div>
 </section>;
}
