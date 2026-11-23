import {useEffect,useRef,useState,type RefObject} from 'react';
import {identityQuad,type Quad} from '../../projection/geometry.ts';
import type {CameraFloorCalibration} from '../../footprints/spatial/coordinates.ts';
import type {MotionFrame} from '../../engine/types.ts';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import type {MultiPoseGaitRouter,MultiPoseStatus} from '../../footprints/live/MultiPoseGaitRouter.ts';
import {cameraBinding,cameraBindingKey,type LiveFloorTrackingEngine} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import {normalizeTrajectoryInput} from '../../footprints/lines/v3/SourceFrameNormalizer.ts';
import {paintAuthenticFootprint} from '../../footprints/scenes/authenticFootGeometry.ts';
import type {MapSimState} from './mapStageModel.ts';
import {assistFromTrajectory,projectAssistEvent,syntheticAssistTest,mergeAssistBuffer,
 assistColors,type FootAssistEvent,type AssistTransform} from './mapCalibrationAssist.ts';

type Mode='camera'|'video'|'simulator'|'demo-sim'|'none';
export type MapAssistOptions={
 selected:'floor'|'body';sourceKind:Mode;sourceAvailable:boolean;
 cameraDraft:Quad;outputDraft:Quad;sourceQuad:Quad;
 cameraDirty:boolean;sourceBox:{x:number;y:number;width:number;height:number};
 videoRef?:RefObject<HTMLVideoElement|null>;
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 motionFrameRef?:RefObject<MotionFrame>;
 router?:MultiPoseGaitRouter;
 floorTracker?:LiveFloorTrackingEngine;
 motionSession?:()=>string;
 liveSourceKind:'camera'|'phone';performerCount:1|2;cameraOn:boolean;
 simState:MapSimState;simCameraQuad:Quad;
 videoFloorCalibration?:CameraFloorCalibration|null;
};
const W=640,H=360;
const emptyStatus:MultiPoseStatus={mode:1,visible:[],ambiguous:false,reason:'',
 ghostCount:0,poseIndices:{A:null,B:null},observedFrameTime:null};
const closeTo=(a:number,b:number)=>Math.abs(a-b)<=1e-7;
/** Ephemeral canvases: Map-only QA pixels never enter shared clean FLOOR/Perform. */
export function useMapCalibrationAssist(options:MapAssistOptions){
 const sourceCanvas=useRef<HTMLCanvasElement|null>(null);
 const outputCanvas=useRef<HTMLCanvasElement|null>(null);
 const state=useRef(options);state.current=options;
 const [auto,setAuto]=useState(true);
 const [replay,setReplay]=useState(false);
 const [frozen,setFrozen]=useState(false);
 const [status,setStatus]=useState('Menunggu kaki');
 const control=useRef({auto,replay,frozen});control.current={auto,replay,frozen};
 const buffer=useRef<FootAssistEvent[]>([]);
 const forced=useRef<FootAssistEvent[]>([]);
 const latest=useRef<FootAssistEvent[]>([]);
 const replayFrames=useRef<FootAssistEvent[]>([]);
 const replayStarted=useRef(0);
 const frozenTime=useRef(0);
 const lastKey=useRef('');
 const lastMessage=useRef('');
 const setMessage=(message:string)=>{
  if(lastMessage.current!==message){lastMessage.current=message;setStatus(message);}
 };
 const clear=()=>{
  buffer.current=[];forced.current=[];latest.current=[];replayFrames.current=[];
  setReplay(false);setFrozen(false);setMessage('Jejak bantu dibersihkan');
 };
 const test=()=>{
  const now=performance.now();
  const seen=latest.current.filter(e=>now-e.atMs<650);
  forced.current=seen.length?seen.map((e,i)=>({...e,id:e.id+':test:'+now+':'+i,atMs:now})):
   syntheticAssistTest(now,'synthetic:'+state.current.sourceKind);
  setMessage(seen.length?'Tes tapak dari '+seen.length+' posisi terdeteksi (perkiraan)':
   'SIMULASI · lima titik contoh, belum terdeteksi');
  setReplay(false);
 };
 const toggleReplay=()=>{
  if(!replay){
   replayFrames.current=[...buffer.current,...forced.current];
   if(!replayFrames.current.length){
    setMessage('Belum ada jejak. Tekan Tes tapak dahulu.');return;
   }
   replayStarted.current=performance.now();
   setFrozen(false);
  }
  setReplay(!replay);
 };
 const toggleFreeze=()=>{
  if(!frozen)frozenTime.current=performance.now();
  else if(replay)replayStarted.current+=performance.now()-frozenTime.current;
  setFrozen(!frozen);
 };
 useEffect(()=>{
  let raf=0,last=0;
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-last<45)return;last=now;
   const p=state.current,ctl=control.current;
   const left=sourceCanvas.current,right=outputCanvas.current;
   if(!left||!right)return;
   const a=left.getContext('2d'),b=right.getContext('2d');
   if(!a||!b)return;
   a.setTransform(1,0,0,1,0,0);a.clearRect(0,0,W,H);
   b.setTransform(1,0,0,1,0,0);b.clearRect(0,0,W,H);
   if(p.selected!=='floor')return;
   const frame=p.experimentFrameRef?.current??null;
   const video=p.sourceKind==='video'&&frame?.kind==='video'?frame.video:p.videoRef?.current;
   const aspect=video?.videoWidth&&video.videoHeight?
    video.videoWidth/video.videoHeight:16/9;
   const binding=p.sourceKind==='camera'?cameraBindingKey(cameraBinding(p.videoRef?.current??null)):null;
   let batch:FootAssistEvent[]=[];
   let key=p.sourceKind+':'+(p.sourceKind==='camera'?binding??'disconnected':'');
   if(p.sourceKind==='demo-sim'){
    key='map-demo-sim';
    if(p.simState.active)batch=p.simState.footprints.slice(-24).map(f=>({
     id:f.id,sourceKey:key,frameMs:f.atMs,
     atMs:now-(p.simState.elapsedMs-f.atMs),actorId:f.actorId,foot:f.foot,
     floorUV:{x:f.x,y:f.y},confidence:1,headingRad:f.headingRad,
     origin:'virtual-floor' as const,phase:'virtual' as const
    }));
   }else if(p.sourceKind!=='none'){
    const experiment=p.sourceKind==='video'?'video':p.sourceKind==='simulator'?'simulator':null;
    const input=normalizeTrajectoryInput({
     nowMs:now,demo:false,demoStart:0,
     experimentSource:experiment,experiment:frame,live:p.motionFrameRef?.current??null,
     cameraOn:p.cameraOn,bodySelected:true,performers:p.performerCount,
     status:p.router?.status??emptyStatus,sourceKind:p.liveSourceKind,
     motionSession:p.motionSession?.()??'map'
    });
    key=input.sourceKey+'|'+(binding??'')+'|'+(p.floorTracker?.sessionEpoch??0);
    if(input.seeking)key+='|seeking';
    if(p.sourceKind==='video')key+='|profile:'+JSON.stringify(p.videoFloorCalibration??'uncalibrated');
    if(input.ready&&p.sourceAvailable){
     batch=assistFromTrajectory(input,now,aspect).map(e=>({...e,sourceKey:key,id:key+':'+e.id}));
    }
   }
   if(key!==lastKey.current){
    lastKey.current=key;buffer.current=[];forced.current=[];latest.current=[];
    replayFrames.current=[];control.current.replay=false;setReplay(false);
   }
   if(!ctl.replay&&!ctl.frozen){
    if(batch.length)latest.current=batch;
    if(ctl.auto)buffer.current=mergeAssistBuffer(buffer.current,batch,now);
    else buffer.current=mergeAssistBuffer([],[],now);
    forced.current=forced.current.filter(e=>now-e.atMs<=5000);
   }
   const useTime=ctl.frozen?frozenTime.current:now;
   const display=ctl.replay?replayFrames.current:
    [...(ctl.auto?buffer.current:[]),...forced.current];
   let cutOff=Infinity;
   if(ctl.replay&&display.length){
    const first=Math.min(...display.map(e=>e.atMs));
    cutOff=first+((useTime-replayStarted.current)%5000+5000)%5000;
   }
   const bindingMatches=p.sourceKind==='camera'&&!!binding&&
    p.floorTracker?.boundCamera===binding&&p.floorTracker.isConfirmed&&!p.cameraDirty;
   // An MP4 has its own camera geometry; never inherit the live phone/webcam quad.
   const cameraQuad=p.sourceKind==='demo-sim'?p.simCameraQuad:
    p.sourceKind==='video'?p.videoFloorCalibration?.cameraQuad??identityQuad():
    p.sourceKind==='simulator'?identityQuad():p.cameraDraft;
   const geometry:AssistTransform={cameraQuad,sourceQuad:p.sourceQuad,outputQuad:p.outputDraft};
   let drawn=0,synthetic=false;
   for(const e of display){
    if(e.atMs>cutOff)continue;
    const projected=projectAssistEvent(e,geometry);
    if(!projected)continue;
    const age=ctl.replay?Math.max(0,cutOff-e.atMs):Math.max(0,useTime-e.atMs);
    if(age>5000)continue;
    synthetic ||=e.origin==='synthetic-test';
    const opacity=0.87*Math.max(.18,1-age/5000)*Math.max(.45,e.confidence);
    const predicted=e.phase==='position-estimate';
    const paint=(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number)=>{
     paintAuthenticFootprint(ctx,{x,y,side:e.foot,widthPx:11,lengthPx:25,
      headingRad:angle,color:e.origin==='synthetic-test'?'#e1b85e':assistColors[e.actorId],
      alpha:opacity,phase:predicted?'prediction':undefined});
    };
    if(projected.sourceUV&&p.sourceKind!=='simulator'){
     const box=p.sourceBox;
     paint(a,box.x+projected.sourceUV.x*box.width,
      box.y+projected.sourceUV.y*box.height,e.headingRad);
    }
    const out=projected.outputUV;
    paint(b,out.x*W,out.y*H,e.headingRad);
    drawn++;
   }
   if(!ctl.replay&&!ctl.frozen&&!forced.current.length){
    const msg=p.sourceKind==='none'?'Belum ada sumber · Tes tapak untuk simulasi':
     p.sourceKind==='simulator'||p.sourceKind==='demo-sim'?'Virtual · jejak simulasi':
     !p.sourceAvailable?'Menunggu gambar sumber':
     drawn?bindingMatches?'Lantai terkalibrasi · posisi kaki perkiraan':
      p.cameraDirty?'Draf kalibrasi · posisi kaki perkiraan':
      p.sourceKind==='video'&&p.videoFloorCalibration?
       'MP4 terkalibrasi · posisi kaki perkiraan':
       'Estimasi 2D · posisi kaki perkiraan':
     'Tidak ada kaki terdeteksi';
    setMessage(msg);
   }else if(synthetic)setMessage('SIMULASI · lima titik contoh, bukan deteksi kamera');
  };
  raf=requestAnimationFrame(draw);
  return()=>cancelAnimationFrame(raf);
 },[]);
 return {sourceCanvas,outputCanvas,auto,replay,frozen,status,
  setAuto,toggleReplay,toggleFreeze,clear,test};
}
