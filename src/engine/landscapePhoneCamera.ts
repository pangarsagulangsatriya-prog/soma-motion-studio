/**
 * Phone inputs (USB camera / Continuity Camera / WebRTC) share one 16:9 video
 * surface before entering the existing CameraTracker. CSS-only rotation would
 * leave pose landmarks and calibrated floor coordinates in portrait space.
 */
import {isPortraitStreamDimensions} from './cameraConstraints.ts';
import {PHONE_LINK_GRACE_MS} from '../stage/phoneLinkRecovery.ts';

export const PHONE_LANDSCAPE_WIDTH=1280;
export const PHONE_LANDSCAPE_HEIGHT=720;
export const PHONE_LANDSCAPE_FPS=24;

export type LandscapeRotation=0|90|180|270;
export type LandscapeFramePlan={
 rotation:LandscapeRotation;
 scale:number;
 drawnWidth:number;
 drawnHeight:number;
 offsetX:number;
 offsetY:number;
};

/** Preserve the whole source frame, centered. Portrait sources rotate 90° CW. */
export function landscapeFramePlan(width:number,height:number,
 outputWidth=PHONE_LANDSCAPE_WIDTH,outputHeight=PHONE_LANDSCAPE_HEIGHT,
 overrideRotation:LandscapeRotation|null=null):LandscapeFramePlan{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||
  !Number.isFinite(outputWidth)||!Number.isFinite(outputHeight)||outputWidth<=0||outputHeight<=0)
  throw Error('Ukuran video kamera belum tersedia.');
 const rotation:LandscapeRotation=overrideRotation??(isPortraitStreamDimensions(width,height)?90:0);
 const sideways=rotation===90||rotation===270;
 const orientedWidth=sideways?height:width;
 const orientedHeight=sideways?width:height;
 const scale=Math.min(outputWidth/orientedWidth,outputHeight/orientedHeight);
 const drawnWidth=orientedWidth*scale,drawnHeight=orientedHeight*scale;
 return {rotation,scale,drawnWidth,drawnHeight,
  offsetX:(outputWidth-drawnWidth)/2,offsetY:(outputHeight-drawnHeight)/2};
}

export type LandscapePhoneCamera={stream:MediaStream;stop:()=>void;rotate90:()=>LandscapeRotation;toggleMirror:()=>boolean;};

/**
 * Draw to one real canvas, then feed its video track to SOMA. Closing the
 * session stops both tracks and prevents a hidden phone camera surviving a
 * source switch. On source disconnect, the caller must blackout/recalibrate.
 */
export async function createLandscapePhoneCamera(input:MediaStream,
 onSourceEnded:()=>void,onSourceInterrupted?:()=>void):Promise<LandscapePhoneCamera>{
 const track=input.getVideoTracks()[0];
 if(!track||track.readyState!=='live')throw Error('HP belum mengirim video.');
 if(typeof HTMLCanvasElement==='undefined' ||
  typeof HTMLCanvasElement.prototype.captureStream!=='function')
  throw Error('Browser laptop tidak mendukung output kamera horizontal.');
 const source=document.createElement('video');
 source.muted=true;source.autoplay=true;source.playsInline=true;source.srcObject=input;
 const canvas=document.createElement('canvas');
 canvas.width=PHONE_LANDSCAPE_WIDTH;canvas.height=PHONE_LANDSCAPE_HEIGHT;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx){source.srcObject=null;throw Error('Kanvas kamera tidak tersedia.');}
 let raf=0,stopped=false,output:MediaStream|null=null,mutedTimer:ReturnType<typeof setTimeout>|null=null;
 let overrideRotation:LandscapeRotation|null=null,mirrored=false;
 let frameCallbackId:number|null=null,frameWatchdog:ReturnType<typeof setInterval>|null=null;
 let lastDecodedFrame=performance.now(),interruptionSince:number|null=null;
 const decodedCallbackSupported=typeof source.requestVideoFrameCallback==='function';
 const frameIsFresh=(now:number)=>!decodedCallbackSupported||now-lastDecodedFrame<=2200;
 const checkHealth=()=>{
  if(stopped||document.visibilityState!=='visible')return;
  const now=performance.now();
  const stalled=track.muted||(decodedCallbackSupported&&now-lastDecodedFrame>2800);
  if(!stalled){interruptionSince=null;return;}
  if(interruptionSince===null){
   interruptionSince=now;
   onSourceInterrupted?.();
  }else if(now-interruptionSince>=PHONE_LINK_GRACE_MS){
   onEnded();
  }
 };
 const onEnded=()=>{if(stopped)return;stop();onSourceEnded();};
 const onMute=()=>{if(mutedTimer)clearTimeout(mutedTimer);
  // Mobile browsers often mute a stream briefly while switching app focus.
  mutedTimer=setTimeout(checkHealth,850);};
 const onUnmute=()=>{if(mutedTimer)clearTimeout(mutedTimer);mutedTimer=null;checkHealth();};
 const stop=()=>{
  if(stopped)return;
  stopped=true;cancelAnimationFrame(raf);
  if(frameCallbackId!==null)source.cancelVideoFrameCallback?.(frameCallbackId);
  if(frameWatchdog)clearInterval(frameWatchdog);frameWatchdog=null;
  if(mutedTimer)clearTimeout(mutedTimer);mutedTimer=null;
  track.removeEventListener('ended',onEnded);
  track.removeEventListener('mute',onMute);
  track.removeEventListener('unmute',onUnmute);
  output?.getTracks().forEach(t=>t.stop());output=null;
  source.pause();source.srcObject=null;
  input.getTracks().forEach(t=>t.stop());
 };
 track.addEventListener('ended',onEnded);
 track.addEventListener('mute',onMute);
 track.addEventListener('unmute',onUnmute);
 try{
  await source.play();
  if(stopped||track.readyState!=='live')throw Error('Kamera HP terputus saat menyiapkan video.');
  if(!source.videoWidth||!source.videoHeight)throw Error('Frame kamera HP belum tersedia.');
  // requestVideoFrameCallback confirms newly decoded frames, not merely a live track.
  // In hidden tabs a browser can throttle callbacks: avoid false disconnection there.
  if(decodedCallbackSupported){
   const onDecoded=()=>{lastDecodedFrame=performance.now();interruptionSince=null;
    if(!stopped)frameCallbackId=source.requestVideoFrameCallback(onDecoded);};
   frameCallbackId=source.requestVideoFrameCallback(onDecoded);
  }
  frameWatchdog=setInterval(checkHealth,550);
  let lastPaint=0;
  const paint=(time:number)=>{
   if(stopped)return;
   raf=requestAnimationFrame(paint);
   if(time-lastPaint<1000/PHONE_LANDSCAPE_FPS||source.readyState<2)return;
   lastPaint=time;
   const sw=source.videoWidth,sh=source.videoHeight;
   if(!sw||!sh)return;
   const p=landscapeFramePlan(sw,sh,canvas.width,canvas.height,overrideRotation);
   ctx.fillStyle='#050807';ctx.fillRect(0,0,canvas.width,canvas.height);
   // Never repeat a stale decoded image as though it were a fresh observation.
   // The canvas track stays alive for transient network recovery.
   if(track.muted||!frameIsFresh(time))return;
   ctx.save();ctx.translate(canvas.width/2,canvas.height/2);
   if(p.rotation)ctx.rotate(p.rotation*Math.PI/180);
   if(mirrored)ctx.scale(-1,1);
   ctx.drawImage(source,-sw*p.scale/2,-sh*p.scale/2,sw*p.scale,sh*p.scale);
   ctx.restore();
  };
  // Paint the first frame immediately so downstream video never starts blank.
  const now=performance.now();paint(now+1000/PHONE_LANDSCAPE_FPS);
  output=canvas.captureStream(PHONE_LANDSCAPE_FPS);
  if(!output.getVideoTracks().length)throw Error('Kamera horizontal tidak menghasilkan video.');
  return {stream:output,stop,rotate90:()=>{
   const current=overrideRotation??(isPortraitStreamDimensions(source.videoWidth,source.videoHeight)?90:0);
   overrideRotation=((current+90)%360) as LandscapeRotation;
   return overrideRotation;
  },toggleMirror:()=>{mirrored=!mirrored;return mirrored;}};
 }catch(error){stop();throw error;}
}
