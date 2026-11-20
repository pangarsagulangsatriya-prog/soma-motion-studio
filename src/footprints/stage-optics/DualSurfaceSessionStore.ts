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
 assessSurfaceProof,outputSurfaceDecision,
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
  const fresh=!!stage&&stage.mode==='live'&&stage.frameAtMs>0&&
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
  if(decision.mode==='live')canvas=(id==='body'?sources.bodyCanvas:sources.floorCanvas)?.current??null;
  if(decision.mode==='test'&&testCanvases){
   canvas=testCanvases[id];
   const ok=drawSurfaceTestPattern(canvas,id,
    id==='body'?'B1':state.epoch[id]>=0?state.target[id]:'F1',
    stage?.mask??null);
   if(!ok)canvas=null;
  }
  if(canvas&&canvas.width>=16&&canvas.height>=16){
   link.sendArtwork(stageSurfaceState(plan,decision.mode,true),canvas,now);
  }else link.send(stageSurfaceState(plan,'blackout',false),now);
  if(now-lastUI>240){
   reportDualOutputStatus(telemetryOwner,{
    surface:id,reported:true,opened:link.opened,connected:link.connected,
    mode:canvas&&link.connected?decision.mode:'blackout',
    qa:decision.assessment.status,
    sampledAtMs:now,reason:canvas?decision.reason:'Sumber visual atau output tidak siap.'
   });
   const next:SurfaceDeviceState={
    connected:link.connected,opened:link.opened,viewport,
    mode:canvas?decision.mode:'blackout',
    reason:canvas?decision.reason:'Sumber visual/test tidak siap atau output terputus.'
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
 if(next.experimentLocked&&!prevLocked&&ports){
  blackoutAllDualSurfaces();
  patchDualSurfaceState({operatorConfirm:false});
 }
 ensurePorts();
 if(pumpTimer===null&&typeof window!=='undefined'){
  pumpTimer=window.setInterval(()=>sendTick(performance.now()),75);
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
 state=initialState();
 emit();
}
