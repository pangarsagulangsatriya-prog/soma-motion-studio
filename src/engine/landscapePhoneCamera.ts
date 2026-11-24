/**
 * Phone inputs (USB camera / Continuity Camera / WebRTC) share one 16:9 video
 * surface before entering the existing CameraTracker. CSS-only rotation would
 * leave pose landmarks and calibrated floor coordinates in portrait space.
 */
import {CameraLiveness} from './cameraLiveness.ts';
import {isPortraitStreamDimensions} from './cameraConstraints.ts';
import {waitForDecodedVideo} from './decodedVideo.ts';

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
 onSourceEnded:()=>void):Promise<LandscapePhoneCamera>{
 const track=input.getVideoTracks()[0];
 if(!track||track.readyState!=='live')throw Error('HP belum mengirim video.');
 if(typeof HTMLCanvasElement==='undefined' ||
  typeof HTMLCanvasElement.prototype.captureStream!=='function')
  throw Error('Browser laptop tidak mendukung output kamera horizontal.');
 const source=document.createElement('video');
 source.muted=true;source.autoplay=true;source.playsInline=true;source.srcObject=input;
 // Keep the decoder attached and paintable even when the Track panel is hidden.
 source.setAttribute('aria-hidden','true');source.style.cssText='position:fixed;left:-10px;top:0;width:2px;height:2px;pointer-events:none;opacity:0';document.body.appendChild(source);
 const canvas=document.createElement('canvas');
 canvas.width=PHONE_LANDSCAPE_WIDTH;canvas.height=PHONE_LANDSCAPE_HEIGHT;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx){source.srcObject=null;source.remove();throw Error('Kanvas kamera tidak tersedia.');}
 let raf=0,stopped=false,output:MediaStream|null=null,mutedTimer:ReturnType<typeof setTimeout>|null=null;
 let overrideRotation:LandscapeRotation|null=null,mirrored=false;
 let frameCallbackId:number|null=null,frameWatchdog:ReturnType<typeof setInterval>|null=null;
 let decodedSerial=0;
 const decodedWatch=new CameraLiveness(3200);
 const onVisibility=()=>{decodedWatch.sample(decodedSerial,performance.now(),false);};
 const onEnded=()=>{if(stopped)return;stop();onSourceEnded();};
 const onMute=()=>{if(mutedTimer)clearTimeout(mutedTimer);
  mutedTimer=setTimeout(()=>{if(track.muted&&document.visibilityState==='visible')onEnded();},3200);};
 const onUnmute=()=>{if(mutedTimer)clearTimeout(mutedTimer);mutedTimer=null;};
 const stop=()=>{
  if(stopped)return;
  stopped=true;cancelAnimationFrame(raf);
  if(frameCallbackId!==null)source.cancelVideoFrameCallback?.(frameCallbackId);
  if(frameWatchdog)clearInterval(frameWatchdog);frameWatchdog=null;
  if(mutedTimer)clearTimeout(mutedTimer);mutedTimer=null;
  document.removeEventListener('visibilitychange',onVisibility);
  track.removeEventListener('ended',onEnded);
  track.removeEventListener('mute',onMute);
  track.removeEventListener('unmute',onUnmute);
  output?.getTracks().forEach(t=>t.stop());output=null;
  source.pause();source.srcObject=null;source.remove();
  input.getTracks().forEach(t=>t.stop());
 };
 document.addEventListener('visibilitychange',onVisibility);
 track.addEventListener('ended',onEnded);
 track.addEventListener('mute',onMute);
 track.addEventListener('unmute',onUnmute);
 try{
  await waitForDecodedVideo(source,()=>!stopped&&track.readyState==='live');
  if(stopped||track.readyState!=='live')throw Error('Kamera HP terputus saat menyiapkan video.');
  if(!source.videoWidth||!source.videoHeight)throw Error('Frame kamera HP belum tersedia.');
  // requestVideoFrameCallback confirms newly decoded frames, not merely a live track.
  // In hidden tabs a browser can throttle callbacks: avoid false disconnection there.
  if(typeof source.requestVideoFrameCallback==='function'){
   const onDecoded=()=>{decodedSerial++;
    if(!stopped)frameCallbackId=source.requestVideoFrameCallback(onDecoded);};
   frameCallbackId=source.requestVideoFrameCallback(onDecoded);
  }
  // Start a fresh grace window after a background tab becomes visible.
  // Browsers without decoded-frame callbacks use media time as a fallback.
  frameWatchdog=setInterval(()=>{
   if(stopped)return;
   const progress=typeof source.requestVideoFrameCallback==='function'?decodedSerial:source.currentTime;
   if(decodedWatch.sample(progress,performance.now(),document.visibilityState==='visible'))onEnded();
  },550);
  let lastPaint=0,lastSourceTime=-1,lastDrawnSerial=-1;
  const manualCapture=()=>output?.getVideoTracks()[0] as (MediaStreamTrack&{requestFrame?:()=>void})|undefined;
  const paint=(time:number)=>{
   if(stopped)return;
   raf=requestAnimationFrame(paint);
   const hasDecodedCallback=typeof source.requestVideoFrameCallback==='function';
   if(time-lastPaint<1000/PHONE_LANDSCAPE_FPS||source.readyState<2||
     (hasDecodedCallback?decodedSerial===lastDrawnSerial:source.currentTime===lastSourceTime))return;
   lastPaint=time;
   const sw=source.videoWidth,sh=source.videoHeight;
   if(!sw||!sh)return;
   const p=landscapeFramePlan(sw,sh,canvas.width,canvas.height,overrideRotation);
   ctx.fillStyle='#050807';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.save();ctx.translate(canvas.width/2,canvas.height/2);
   if(p.rotation)ctx.rotate(p.rotation*Math.PI/180);
   if(mirrored)ctx.scale(-1,1);
   ctx.drawImage(source,-sw*p.scale/2,-sh*p.scale/2,sw*p.scale,sh*p.scale);
   ctx.restore();lastSourceTime=source.currentTime;lastDrawnSerial=decodedSerial;manualCapture()?.requestFrame?.();
  };
  // Paint the first frame immediately so downstream video never starts blank.
  output=canvas.captureStream(PHONE_LANDSCAPE_FPS);
  const now=performance.now();paint(now+1000/PHONE_LANDSCAPE_FPS);
  if(!output.getVideoTracks().length)throw Error('Kamera horizontal tidak menghasilkan video.');
  return {stream:output,stop,rotate90:()=>{
   const current=overrideRotation??(isPortraitStreamDimensions(source.videoWidth,source.videoHeight)?90:0);
   overrideRotation=((current+90)%360) as LandscapeRotation;
   return overrideRotation;
  },toggleMirror:()=>{mirrored=!mirrored;return mirrored;}};
 }catch(error){stop();throw error;}
}
