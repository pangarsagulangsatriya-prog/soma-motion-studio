import type {RefObject} from 'react';
import type {Projection} from '../../projection/useProjection.ts';
import {ProjectionLink} from '../../projection/channel.ts';
import type {BodyMask} from '../../studio/bodyField.ts';
import {drawSurfaceTestPattern} from './SurfaceTestPattern.ts';
import {STAGE_BLACKOUT_EVENT} from './StageBlackout.ts';
import {claimDualOutputStatus,reportDualOutputStatus} from './DualSurfaceTelemetry.ts';
import {stageHardwareAvailable} from './StageHardwareGate.ts';
import {dualPhysicalOutputAllowed,type PreviewView} from './projectorWysiwygModel.ts';
import {shouldLatchProjectionBlackout} from '../../studio/v3/safeProjectionPreflight.ts';
import {defaultStageSurfacePlan,stageSurfaceSignature,stageSurfaceState,
 assessSurfaceProof,outputSurfaceDecision,cleanFeedSurfaceState,
 type StageSurface,type StageSurfacePlan,type SurfaceProof,type StageOutputContext}
 from './DualSurfaceCalibration.ts';

const viteEnv=(import.meta as ImportMeta&{env?:{DEV?:boolean;VITE_SOMA_STAGE_OUTPUTS?:string}}).env;
export const STAGE_HARDWARE_ENABLED=stageHardwareAvailable(
 Boolean(viteEnv?.DEV),
 viteEnv?.VITE_SOMA_STAGE_OUTPUTS
);

export const DUAL_SURFACE_IDS=['body','floor'] as const;
export type RequestedMode='blackout'|'test'|'live';

export type StageRouteInput={
 mode:'simulation'|'live';frameAtMs:number;computedAtMs:number;
 cameraSafe:boolean;bodyMediaReady:boolean;bridgeSafe:boolean;
 mask:BodyMask|null;cameraKey:string|null;floorKey:string|null;
};

export type SurfaceDeviceState={
 connected:boolean;opened:boolean;viewport:StageOutputContext['viewport'];
 mode:string;reason:string;
};

export type DualSurfaceSessionState={
 plans:Record<StageSurface,StageSurfacePlan>;
 proofs:Record<StageSurface,SurfaceProof|null>;
 requested:Record<StageSurface,RequestedMode>;
 armed:Record<StageSurface,boolean>;
 epoch:Record<StageSurface,number>;
 target:Record<StageSurface,string>;
 selected:StageSurface;
 message:string;
 operatorConfirm:boolean;
 previewView:PreviewView;
 devices:Record<StageSurface,SurfaceDeviceState>;
};

type RuntimeSources={
 frameRef:RefObject<StageRouteInput|null>|null;
 bodyCanvas:RefObject<HTMLCanvasElement|null>|null;
 floorCanvas:RefObject<HTMLCanvasElement|null>|null;
 legacyProjection:Projection|null;
 experimentLocked:boolean;
};

type Listener=()=>void;

const initialDevices=():Record<StageSurface,SurfaceDeviceState>=>({
 body:{connected:false,opened:false,viewport:null,mode:'blackout',reason:'Output belum dibuka.'},
 floor:{connected:false,opened:false,viewport:null,mode:'blackout',reason:'Output belum dibuka.'}
});

const initialState=():DualSurfaceSessionState=>({
 plans:{body:defaultStageSurfacePlan('body'),floor:defaultStageSurfacePlan('floor')},
 proofs:{body:null,floor:null},
 requested:{body:'blackout',floor:'blackout'},
 armed:{body:false,floor:false},
 epoch:{body:0,floor:0},
 target:{body:'B1',floor:'F1'},
 selected:'floor',
 message:'Kedua output terkunci di Blackout.',
 operatorConfirm:false,
 previewView:'draft',
 devices:initialDevices()
});

let state:DualSurfaceSessionState=initialState();
let ports:Record<StageSurface,ProjectionLink>|null=null;
let telemetryOwner='';
let testCanvases:Record<StageSurface,HTMLCanvasElement>|null=null;
let pumpTimer:number|null=null;
let lastUI=0;
let blackoutBound=false;
export type SurfaceOutputMode='soma'|'resolume';
const outputMode:Record<StageSurface,SurfaceOutputMode>={body:'soma',floor:'soma'};
const feedEnabled:Record<StageSurface,boolean>={body:false,floor:false};
/** Capture feed uses composed pixels, separate from QA-gated physical projection. */
export const canStreamCleanFeed=(input:{
 requested:boolean;connected:boolean;sourceFresh:boolean;
 cameraSafe:boolean;visualReady:boolean;canvasReady:boolean;
})=>input.requested&&input.connected&&input.sourceFresh&&
 input.cameraSafe&&input.visualReady&&input.canvasReady;
const listeners=new Set<Listener>();

const sources:RuntimeSources={
 frameRef:null,bodyCanvas:null,floorCanvas:null,
 legacyProjection:null,experimentLocked:false
};

function emit(){
 for(const fn of listeners)fn();
}

function ensurePorts():Record<StageSurface,ProjectionLink>{
 if(!ports){
  ports={body:new ProjectionLink(),floor:new ProjectionLink()};
  telemetryOwner=ports.body.id+':'+ports.floor.id;
  claimDualOutputStatus(telemetryOwner);
  DUAL_SURFACE_IDS.forEach(id=>ports![id].start());
 }
 if(!testCanvases&&typeof document!=='undefined'){
  const make=(w:number,h:number)=>{
   const c=document.createElement('canvas');c.width=w;c.height=h;return c;
  };
  testCanvases={body:make(160,90),floor:make(640,360)};
 }
 if(!blackoutBound&&typeof window!=='undefined'){
  blackoutBound=true;
  window.addEventListener(STAGE_BLACKOUT_EVENT,()=>{
   blackoutAllDualSurfaces();
  });
 }
 return ports;
}

export function getDualSurfacePorts():Record<StageSurface,ProjectionLink>{
 return ensurePorts();
}

export function getDualSurfaceTestCanvases():Record<StageSurface,HTMLCanvasElement>|null{
 ensurePorts();
 return testCanvases;
}

export function getDualSurfaceState():DualSurfaceSessionState{
 return state;
}

export function subscribeDualSurface(fn:Listener):()=>void{
 listeners.add(fn);
 return()=>{listeners.delete(fn);};
}

export function patchDualSurfaceState(patch:Partial<DualSurfaceSessionState>){
 state={...state,...patch};
 emit();
}

export function hasActiveDualSurfacePorts():boolean{
 if(!ports)return false;
 return DUAL_SURFACE_IDS.some(id=>ports![id].opened||ports![id].connected);
}

export function urgentBlackoutDualSurface(id:StageSurface){
 feedEnabled[id]=false;
 const links=ensurePorts();
 state={
  ...state,
  requested:{...state.requested,[id]:'blackout'},
  armed:{...state.armed,[id]:false}
 };
 const now=performance.now();
 links[id].send(stageSurfaceState(state.plans[id],'blackout',false),now,true);
 const stage=sources.frameRef?.current??null;
 reportDualOutputStatus(telemetryOwner,{
  surface:id,reported:true,opened:links[id].opened,connected:links[id].connected,
  mode:'blackout',
  qa:assessSurfaceProof(state.plans[id],
   stageSurfaceSignature(state.plans[id],{
    cameraBinding:stage?.cameraKey??null,
    floorContext:stage?.floorKey??null,
    windowSession:state.epoch[id]>0?links[id].id+':'+state.epoch[id]:'',
    viewport:links[id].outputInfo?{
     width:links[id].outputInfo.viewportWidth,
     height:links[id].outputInfo.viewportHeight,
     dpr:links[id].outputInfo.dpr
    }:null
   }),state.proofs[id]).status,
  sampledAtMs:now,reason:'Blackout manual diperintahkan; periksa cahaya panggung.'
 });
 emit();
}

export function blackoutAllDualSurfaces(customMessage?:string){
 if(!ports)return;
 DUAL_SURFACE_IDS.forEach(urgentBlackoutDualSurface);
 state={
  ...state,
  requested:{body:'blackout',floor:'blackout'},
  armed:{body:false,floor:false},
  message:customMessage??'Dua output diperintah Blackout. Periksa cahaya proyektor secara fisik.'
 };
 emit();
}

export type OpenOutputResult={
 ok:boolean;
 alreadyOpen:boolean;
 popupBlocked:boolean;
 message:string;
};

export function getDualSurfaceFeedUrl(id:StageSurface,feedMode:'soma'|'resolume'='resolume'):string{
 const links=ensurePorts();
 return links[id].buildOutputUrl(id,feedMode);
}

/** Single shared output-window open/focus action used by both Map and Perform.
 * Always opens in explicit BLACKOUT; never duplicates an already open window. */
export function openDualSurfaceOutputWindow(id:StageSurface,feedMode:'soma'|'resolume'='soma'):OpenOutputResult{
 const surfaceLabel=id==='floor'?'FLOOR':'BODY';
 if(!STAGE_HARDWARE_ENABLED&&feedMode==='soma'){
  const msg='Output fisik dinonaktifkan pada build ini. Gunakan preview lokal atau mode Feed ke Resolume.';
  patchDualSurfaceState({message:msg});
  return {ok:false,alreadyOpen:false,popupBlocked:false,message:msg};
 }
 const links=ensurePorts();
 
if(links[id].opened&&outputMode[id]!==feedMode){
  urgentBlackoutDualSurface(id);
  links[id].closeOutput(); // Reopen with correct feed URL
 }
 if(links[id].opened){
  links[id].focusOutput();
  if(feedMode==='resolume')feedEnabled[id]=true; // Explicit user action
  const msg=feedMode==='resolume'
   ?`Clean Feed ${surfaceLabel} diaktifkan; lanjutkan visual jika masih HOLD.`
   :`Output ${surfaceLabel} sudah terbuka (${links[id].connected?'terkoneksi':'menunggu koneksi'}). Pindahkan ke layar proyektor lalu tekan F.`;
  patchDualSurfaceState({message:msg});
  return {ok:true,alreadyOpen:true,popupBlocked:false,message:msg};
 }
 const ok=links[id].open(id,feedMode);
 if(!ok){
  const msg=links[id].error||'Pop-up diblokir browser. Izinkan pop-up lalu klik Buka lagi.';
  patchDualSurfaceState({message:msg});
  return {ok:false,alreadyOpen:false,popupBlocked:true,message:msg};
 }
 outputMode[id]=feedMode;
 state={
  ...state,
  requested:{...state.requested,[id]:'blackout'},
  armed:{...state.armed,[id]:false},
  epoch:{...state.epoch,[id]:state.epoch[id]+1},
  message:feedMode==='resolume'
   ?`Feed Resolume ${surfaceLabel} dibuka (16:9 Clean Blackout). Tangkap jendela ini di Resolume Arena atau OBS/Spout/Syphon.`
   :`Output ${surfaceLabel} dibuka (Blackout). Pindahkan ke layar proyektor lalu tekan F.`
 };
 urgentBlackoutDualSurface(id);
 feedEnabled[id]=feedMode==='resolume';
 return {ok:true,alreadyOpen:false,popupBlocked:false,message:state.message};
}

export function closeDualSurfaceOutputWindow(id:StageSurface){
 const links=ensurePorts();
 urgentBlackoutDualSurface(id);
 links[id].closeOutput();
 outputMode[id]='soma';
 const surfaceLabel=id==='floor'?'FLOOR':'BODY';
 patchDualSurfaceState({message:`Output ${surfaceLabel} ditutup.`});
}

/** Explicit LIVE authorization from Perform; enforces every single hardware/safety/QA gate fail-closed. */
export function armDualSurfaceLiveFromPerform(id:StageSurface):{ok:boolean;message:string}{
 const surfaceLabel=id==='floor'?'FLOOR':'BODY';
 if(!STAGE_HARDWARE_ENABLED){
  return {ok:false,message:'Output fisik dinonaktifkan pada build ini.'};
 }
 
 const links=ensurePorts();
 const link=links[id];
 if(!link.connected){
  urgentBlackoutDualSurface(id);
  return {ok:false,message:`Output ${surfaceLabel} belum terkoneksi. Klik Buka Output terlebih dahulu.`};
 }
 const stage=sources.frameRef?.current??null;
 const now=performance.now();
 const fresh=!!stage&&(stage.mode==='live'||stage.mode==='simulation')&&stage.frameAtMs>0&&
  stage.computedAtMs>0&&now-stage.frameAtMs>=0&&now-stage.frameAtMs<450&&
  now-stage.computedAtMs>=0&&now-stage.computedAtMs<300;
 if(!stage||!stage.cameraSafe||!fresh){
  urgentBlackoutDualSurface(id);
  return {ok:false,message:'Sumber kamera live belum valid atau frame kedaluwarsa. Output tetap Blackout.'};
 }
 const output=link.outputInfo;
 const viewport=output?{width:output.viewportWidth,height:output.viewportHeight,dpr:output.dpr}:null;
 const key=stageSurfaceSignature(state.plans[id],{
  cameraBinding:stage.cameraKey??null,
  floorContext:stage.floorKey??null,
  windowSession:state.epoch[id]>0?link.id+':'+state.epoch[id]:'',
  viewport
 });
 const qa=assessSurfaceProof(state.plans[id],key,state.proofs[id]);
 if(qa.status!=='within-provisional-target'){
  urgentBlackoutDualSurface(id);
  return {ok:false,message:`QA fisik 5 titik ${surfaceLabel} belum lulus atau perlu diulang di Map.`};
 }
 state={
  ...state,
  operatorConfirm:true,
  requested:{...state.requested,[id]:'live'},
  armed:{...state.armed,[id]:true},
  message:`Output ${surfaceLabel} diperintah LIVE. Pantau cahaya di panggung; tekan B / Esc untuk Blackout.`
 };
 emit();
 return {ok:true,message:state.message};
}

function sendTick(now:number){
 if(!ports)return;
 const stage=sources.frameRef?.current??null;
 let changed=false;
 const nextDevices={...state.devices};
 for(const id of DUAL_SURFACE_IDS){
  const link=ports[id],plan=state.plans[id],output=link.outputInfo;
  const viewport=link.connected&&output?{
   width:output.viewportWidth,height:output.viewportHeight,dpr:output.dpr}:null;
  const key=stageSurfaceSignature(plan,{
   cameraBinding:stage?.cameraKey??null,floorContext:stage?.floorKey??null,
   windowSession:state.epoch[id]>0?link.id+':'+state.epoch[id]:'',
   viewport
  });
  const fresh=!!stage&&(stage.mode==='live'||stage.mode==='simulation')&&stage.frameAtMs>0&&
   stage.computedAtMs>0&&now-stage.frameAtMs>=0&&now-stage.frameAtMs<450&&
   now-stage.computedAtMs>=0&&now-stage.computedAtMs<300;
  const safe=dualPhysicalOutputAllowed(
   STAGE_HARDWARE_ENABLED,sources.experimentLocked,state.operatorConfirm
  )&&!!stage&&stage.cameraSafe&&fresh;
  const sourceSafe=id==='body'?!!stage?.bodyMediaReady:!!stage?.bridgeSafe;
  if(shouldLatchProjectionBlackout({
   requested:state.requested[id],connected:link.connected,
   stageSafe:safe,sourceSafe
  })){
   state={
    ...state,
    requested:{...state.requested,[id]:'blackout'},
    armed:{...state.armed,[id]:false},
    message:'LIVE '+id+' terputus. BLACKOUT terkunci; periksa sumber dan tekan Perform ulang.'
   };
   changed=true;
  }
  const decision=outputSurfaceDecision({
   plan,signature:key,proof:state.proofs[id],requested:state.requested[id],
   connected:link.connected,cameraSafe:safe,sourceFresh:fresh,
   bridgeSafe:sourceSafe,operatorArmed:state.armed[id]
  });
  
let canvas:HTMLCanvasElement|null=null;
  let mode:'blackout'|'test'|'live'|'feed'=decision.mode;
  let reason=decision.reason;
  if(outputMode[id]==='resolume'){
   const raster=(id==='body'?sources.bodyCanvas:sources.floorCanvas)?.current??null;
   const ready=canStreamCleanFeed({
    requested:feedEnabled[id],connected:link.connected,sourceFresh:fresh,
    cameraSafe:!!stage?.cameraSafe,visualReady:sourceSafe,
    canvasReady:!!raster&&raster.width>=16&&raster.height>=16
   });
   if(ready){
    canvas=raster;mode='feed';
    reason='Clean Feed aktif: frame Compose dikirim ke jendela.';
   }else{
    mode='blackout';
    reason=!feedEnabled[id]?'Clean Feed Blackout. Klik Buka Feed lagi untuk melanjutkan.':
     !link.connected?'Jendela Clean Feed belum terhubung.':
     'Visual sumber belum siap atau sedang HOLD. Klik Lanjutkan Visual.';
   }
  }else if(decision.mode==='live'){
   canvas=(id==='body'?sources.bodyCanvas:sources.floorCanvas)?.current??null;
  }
  if(outputMode[id]!=='resolume'&&decision.mode==='test'&&testCanvases){
   canvas=testCanvases[id];
   const ok=drawSurfaceTestPattern(canvas,id,
    state.target[id]||(id==='body'?'B1':'F1'),
    stage?.mask??null,stage?.mode==='simulation');
   if(!ok)canvas=null;
  }
  if(canvas&&canvas.width>=16&&canvas.height>=16){
   link.sendArtwork(mode==='feed'?cleanFeedSurfaceState(plan):stageSurfaceState(plan,mode,true),canvas,now);
  }else link.send(stageSurfaceState(plan,'blackout',false),now);

  if(now-lastUI>240){
   const reportedMode=mode==='feed'&&link.receivedFrames<1?'blackout':mode;
   const reportedReason=mode==='feed'&&link.receivedFrames<1?
    'Feed terhubung, menunggu frame pertama diterima jendela.':reason;
   reportDualOutputStatus(telemetryOwner,{
    surface:id,reported:true,opened:link.opened,connected:link.connected,
    mode:canvas&&link.connected?reportedMode:'blackout',
    qa:decision.assessment.status,
    sampledAtMs:now,reason:reportedReason
   });
   const next:SurfaceDeviceState={
    connected:link.connected,opened:link.opened,viewport,
    mode:canvas&&link.connected?reportedMode:'blackout',
    reason:reportedReason
   };
   const prior=state.devices[id];
   if(prior.connected!==next.connected||prior.opened!==next.opened||
    prior.mode!==next.mode||prior.reason!==next.reason||
    JSON.stringify(prior.viewport)!==JSON.stringify(next.viewport)){
    nextDevices[id]=next;
    changed=true;
   }
  }
 }
 if(now-lastUI>240)lastUI=now;
 if(changed){
  state={...state,devices:nextDevices};
  emit();
 }
}

export function syncDualSurfaceRuntime(next:{
 frameRef:RefObject<StageRouteInput|null>;
 bodyCanvas:RefObject<HTMLCanvasElement|null>;
 floorCanvas:RefObject<HTMLCanvasElement|null>;
 legacyProjection:Projection;
 experimentLocked:boolean;
}){
 const prevLocked=sources.experimentLocked;
 sources.frameRef=next.frameRef;
 sources.bodyCanvas=next.bodyCanvas;
 sources.floorCanvas=next.floorCanvas;
 sources.legacyProjection=next.legacyProjection;
 sources.experimentLocked=next.experimentLocked;
 if(next.experimentLocked!==prevLocked&&ports){
  blackoutAllDualSurfaces();
  patchDualSurfaceState({operatorConfirm:false});
 }
 ensurePorts();
 if(pumpTimer===null&&typeof window!=='undefined'){
  pumpTimer=window.setInterval(()=>sendTick(performance.now()),1000/30);
 }
}

export function resetDualSurfaceSessionForTest(){
 if(pumpTimer!==null&&typeof window!=='undefined'){
  clearInterval(pumpTimer);pumpTimer=null;
 }
 if(ports){
  DUAL_SURFACE_IDS.forEach(id=>ports![id].dispose());
  ports=null;
 }
 testCanvases=null;
 outputMode.body='soma';outputMode.floor='soma';
 feedEnabled.body=false;feedEnabled.floor=false;
 state=initialState();
 emit();
}
