import {useEffect,useRef,type RefObject} from 'react';
import {drawF3Stage,F3_STAGE_WIDTH,F3_STAGE_HEIGHT} from './F3StageRenderer.ts';
import type {F3StageFrame} from './F3Types.ts';
export function F3StageView({hostRef,frameRef,videoRef,stageActive,onExit}:{
 hostRef:RefObject<HTMLDivElement|null>;frameRef:RefObject<F3StageFrame>;
 videoRef:RefObject<HTMLVideoElement|null>;stageActive:boolean;onExit:()=>void;
}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let raf=0;
  const paint=()=>{
   const c=canvas.current,ctx=c?.getContext('2d',{alpha:false});
   if(ctx)drawF3Stage(ctx,frameRef.current,videoRef.current);
   raf=requestAnimationFrame(paint);
  };
  raf=requestAnimationFrame(paint);return()=>cancelAnimationFrame(raf);
 },[frameRef,videoRef]);
 useEffect(()=>{
  const onFullscreen=()=>{
   if(!document.fullscreenElement)onExit();
  };
  document.addEventListener('fullscreenchange',onFullscreen);
  return()=>document.removeEventListener('fullscreenchange',onFullscreen);
 },[onExit]);
 return <div className="f3-stage-shell" ref={hostRef} data-stage-active={stageActive}>
  <canvas width={F3_STAGE_WIDTH} height={F3_STAGE_HEIGHT}
   aria-label="Stage View F3: empat slot foto di kiri dan video kamera B di kanan" ref={canvas}/>
 </div>;
}
