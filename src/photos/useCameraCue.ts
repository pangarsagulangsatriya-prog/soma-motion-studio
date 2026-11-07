import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import type {MotionFrame,Settings} from '../engine/types';
import {CameraFraming,cameraCrop,type FrameState} from './framing';
import {CameraVoice,recognitionConstructor,voiceLabels,type VoiceStatus} from './voice';
import {cameraAvailable} from './store';
import {nextPhotoSlot} from './gesture';
import type {PhotoArchive} from './usePhotoArchive';

export function useCameraCue({archive,frameRef,settingsRef,videoRef,active,notify,onOpen}:{archive:PhotoArchive;frameRef:RefObject<MotionFrame>;settingsRef:RefObject<Settings>;videoRef:RefObject<HTMLVideoElement|null>;active:boolean;notify:(message:string)=>void;onOpen:()=>void}){
 const framing=useRef(new CameraFraming());const [frame,setFrame]=useState<FrameState>(framing.current.state);
 const [voice,setVoice]=useState<{status:VoiceStatus;message:string}>({status:recognitionConstructor()?'off':'unsupported',message:recognitionConstructor()?voiceLabels.off:voiceLabels.unsupported});
 const [listening,setListening]=useState(false);const controller=useRef<CameraVoice|null>(null),capturing=useRef(false),mounted=useRef(true);
 const latest=useRef({archive,active,notify,onOpen});latest.current={archive,active,notify,onOpen};
 const close=useCallback(()=>{framing.current.close();setFrame({...framing.current.state});},[]);
 const open=useCallback(()=>{
  const a=latest.current;if(!a.active||document.hidden||capturing.current||a.archive.busy)return;
  if(framing.current.state.open)return;
  if(!a.archive.loaded){a.notify('Arsip sedang dimuat. Coba sebentar lagi.');return;}
  if(!cameraAvailable(videoRef.current)){a.notify('Nyalakan kamera utama sebelum membuka bingkai.');return;}
  if(settingsRef.current.input!=='hands'){a.notify('Pilih Hands untuk mengatur bingkai dan memukul.');return;}
  if(nextPhotoSlot(a.archive.photos,a.archive.replacement)===null){a.notify('Arsip penuh · 4/4. Pilih Ganti sebelum memanggil kamera.');return;}
  a.archive.changeEnabled(false);setFrame({...framing.current.open()});a.onOpen();a.notify('Kamera. Rentangkan atau dekatkan dua telapak untuk mengatur bingkai.');
 },[videoRef,settingsRef]);
 const shoot=useCallback(async()=>{
  const a=latest.current,v=videoRef.current;
  if(capturing.current||!a.active||!v||a.archive.busy)return;
  const crop=cameraCrop(v.videoWidth,v.videoHeight,framing.current.state.size);
  capturing.current=true;close();try{await a.archive.capture(crop);}finally{capturing.current=false;}
 },[close,videoRef]);
 const setVoiceEnabled=useCallback((value:boolean)=>{
  if(!value){controller.current?.stop();setListening(false);return;}
  if(!latest.current.active)return;
  latest.current.archive.changeEnabled(false);
  controller.current?.stop();
  const c=new CameraVoice(recognitionConstructor(),command=>{if(command==='cancel')close();else open();},(status,message)=>{if(mounted.current){setVoice({status,message});setListening(status==='starting'||status==='listening'||status==='retrying');}});
  controller.current=c;c.start();
 },[open,close]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.stop();};},[]);
 useEffect(()=>{if(!active){close();controller.current?.stop();setListening(false);}},[active,close]);
 useEffect(()=>{const hidden=()=>{if(document.hidden){close();controller.current?.stop();setListening(false);}};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[close]);
 const lastUI=useRef(0);
 // Read each detection inside App's main motion callback, before another sample can replace it.
 const processFrame=useCallback((motion:MotionFrame)=>{
  if(!framing.current.state.open)return;const now=performance.now();
  const a=latest.current;
  if(!a.active||document.hidden||settingsRef.current.input!=='hands'||!cameraAvailable(videoRef.current)||nextPhotoSlot(a.archive.photos,a.archive.replacement)===null){close();return;}
  const next=framing.current.step(motion,now,!a.archive.busy&&!capturing.current);
  if(next.fired){void shoot();return;}
  if(now-lastUI.current>32){lastUI.current=now;setFrame({...next});}
 },[close,shoot,settingsRef,videoRef]);
 useEffect(()=>{const timer=setInterval(()=>{if(framing.current.state.open&&performance.now()-frameRef.current.time>=300)processFrame(frameRef.current);},150);return()=>clearInterval(timer);},[frameRef,processFrame]);
 return {frame,voice,listening,open,close,shoot,processFrame,setVoiceEnabled,videoRef,settingsRef};
}
export type CameraCue=ReturnType<typeof useCameraCue>;
