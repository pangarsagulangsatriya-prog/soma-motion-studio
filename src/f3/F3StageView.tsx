import {useEffect,useRef,useState,type RefObject} from 'react';
import {drawF3Stage,F3_STAGE_WIDTH,F3_STAGE_HEIGHT} from './F3StageRenderer.ts';
import type {F3StageFrame} from './F3Types.ts';
export function F3StageView({hostRef,frameRef,videoARef,videoBRef,stageActive,onExit,onDisarm,onManualCapture,canManual}:{
 hostRef:RefObject<HTMLDivElement|null>;frameRef:RefObject<F3StageFrame>;
 videoARef:RefObject<HTMLVideoElement|null>;videoBRef:RefObject<HTMLVideoElement|null>;
 stageActive:boolean;onExit:()=>void;
 onDisarm:()=>void;onManualCapture:()=>void;canManual:boolean;
}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [revealed,setRevealed]=useState(false);
 const revealTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const reveal=()=>{
  setRevealed(true);
  if(revealTimer.current)clearTimeout(revealTimer.current);
  revealTimer.current=setTimeout(()=>setRevealed(false),2300);
 };
 useEffect(()=>{
  if(!stageActive){setRevealed(false);return;}
  const onKey=(e:KeyboardEvent)=>{if(e.key!=='Escape')reveal();};
  document.addEventListener('keydown',onKey);
  return()=>{document.removeEventListener('keydown',onKey);if(revealTimer.current)clearTimeout(revealTimer.current);};
 },[stageActive]);
 useEffect(()=>{
  let raf=0;
  const paint=()=>{
   const c=canvas.current,ctx=c?.getContext('2d',{alpha:false});
   if(ctx)drawF3Stage(ctx,frameRef.current,videoARef.current,videoBRef.current);
   raf=requestAnimationFrame(paint);
  };
  raf=requestAnimationFrame(paint);return()=>cancelAnimationFrame(raf);
 },[frameRef,videoARef,videoBRef]);
 useEffect(()=>{
  const onFullscreen=()=>{
   if(!document.fullscreenElement)onExit();
  };
  document.addEventListener('fullscreenchange',onFullscreen);
  return()=>document.removeEventListener('fullscreenchange',onFullscreen);
 },[onExit]);
 return <div className="f3-stage-shell" ref={hostRef} data-stage-active={stageActive}
  onPointerMove={()=>{if(stageActive)reveal();}}>
  <canvas width={F3_STAGE_WIDTH} height={F3_STAGE_HEIGHT}
   aria-label="Stage View F3: video aktor A sebagai latar, empat foto di kiri dan kamera penonton B di kanan" ref={canvas}/>
  {stageActive&&<div className="f3-stage-local-controls" data-revealed={revealed}
   aria-label="Kontrol operator fullscreen lokal">
   <button type="button" onClick={onDisarm}>Disarm</button>
   <button type="button" onClick={onManualCapture} disabled={!canManual}>Jepret</button>
   <button type="button" onClick={onExit}>Kembali</button>
  </div>}
 </div>;
}
