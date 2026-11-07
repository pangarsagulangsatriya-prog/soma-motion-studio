import {useEffect,useRef} from 'react';
import type {RenderState} from './types';
import {getAsset} from './store';
import {drawArchive} from './render';
export type CanvasMetrics={fps:number;drawMs:number;inputAgeMs:number;frames:number};
export function ArchiveCanvas({stateRef,metricsRef,onMediaError}:{stateRef:React.RefObject<RenderState|null>;metricsRef?:React.RefObject<CanvasMetrics>;onMediaError?:(message:string)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),error=useRef(onMediaError);error.current=onMediaError;
 useEffect(()=>{let raf=0,assetId='',assetRevision=-1,loading=0,url='',media:HTMLImageElement|HTMLVideoElement|null=null,frames=0,last=performance.now(),lastDraw=0;
  const clearMedia=()=>{loading++;if(media instanceof HTMLVideoElement){media.pause();media.removeAttribute('src');media.load();}media=null;if(url)URL.revokeObjectURL(url);url='';};
  const load=async(id:string)=>{clearMedia();const token=loading;try{const asset=await getAsset(id);if(token!==loading)return;if(!asset){error.current?.('Media cue belum tersedia. Impor kembali berkas sumber.');return;}url=URL.createObjectURL(asset.blob);if(asset.kind==='video'){const video=document.createElement('video');video.muted=true;video.playsInline=true;video.loop=false;video.preload='auto';video.src=url;await new Promise<void>((resolve,reject)=>{video.onloadeddata=()=>resolve();video.onerror=()=>reject(new Error('Format video belum dapat diputar.'));});if(token!==loading){video.pause();return;}media=video;}else{const image=new Image();image.src=url;await image.decode();if(token!==loading)return;media=image;}}catch(e){if(token===loading)error.current?.((e as Error).message);}};
  const draw=(now:number)=>{raf=requestAnimationFrame(draw);const c=canvas.current,state=stateRef.current;if(!c||!state)return;const bounds=c.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
   const currentId=state.mediaId??'';if(currentId!==assetId||assetRevision!==(state.mediaRevision??0)){assetId=currentId;assetRevision=state.mediaRevision??0;if(assetId)void load(assetId);else clearMedia();}
   const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(bounds.width*dpr),h=Math.round(bounds.height*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
   if(media instanceof HTMLVideoElement){const target=state.mediaTimeMs/1000;if(Number.isFinite(media.duration)&&Math.abs(media.currentTime-Math.min(target,media.duration))>.35)media.currentTime=Math.min(target,media.duration);const playing=state.stage.phase==='running'&&!state.stage.freeze&&!state.stage.blank;if(playing&&media.paused)void media.play().catch(()=>{});else if(!playing&&!media.paused)media.pause();}
   const ctx=c.getContext('2d')!;const begin=performance.now();ctx.setTransform(dpr,0,0,dpr,0,0);drawArchive(ctx,state,bounds.width,bounds.height,media);frames++;
   if(metricsRef){const m=metricsRef.current;m.frames++;m.drawMs=performance.now()-begin;m.inputAgeMs=Math.max(0,performance.now()-state.snapshot.timestampMs);if(now-last>=1000){m.fps=Math.round(frames*1000/(now-last));frames=0;last=now;}}
   lastDraw=now;
  };raf=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(raf);clearMedia();};
 },[stateRef,metricsRef]);
 return <canvas ref={canvas} className="archive-canvas" aria-label="Komposisi panggung dari teks dan media arsip"/>;
}
