import {defaultFloorSpace,validateFloorSpace,type FloorPoint,type FloorSpace} from '../spatial/coordinates.ts';
import {createFloorSession,FootstepEventEngine,type FootSide,type FootstepEvent,type FloorSession} from '../spatial/events.ts';

export const QA_DURATION_MS=900000;
export type QAFaultKind='tracking-loss'|'identity-crossing'|'camera-change'|'hold'|'blackout';
export type QAFault={id:QAFaultKind;startMs:number;endMs:number;name:string;effect:string};
export const QA_FAULTS:readonly QAFault[]=[
 {id:'tracking-loss',startMs:220000,endMs:224000,name:'Tracking terputus',effect:'Kaki keluar dari pelacakan'},
 {id:'identity-crossing',startMs:426000,endMs:432000,name:'Persilangan A/B',effect:'Identitas ambigu; pendaratan ditahan'},
 {id:'camera-change',startMs:609000,endMs:615000,name:'Kamera berganti',effect:'Rekalibrasi diperlukan sebelum kontak baru'},
 {id:'hold',startMs:734000,endMs:739000,name:'Hold',effect:'Gambar proyeksi ditahan, langkah tetap direkam'},
 {id:'blackout',startMs:812000,endMs:818000,name:'Blackout',effect:'Output padam, langkah tetap direkam'}
];
export const QA_PHASES=[
 {atMs:0,name:'Labour'},{atMs:180000,name:'Leisure'},
 {atMs:360000,name:'Active Rest'},{atMs:540000,name:'Crossing'},
 {atMs:720000,name:'Return Pressure'}
] as const;
export type QAScenario={
 schema:'soma.footprints.qa-scenario';version:1;durationMs:number;
 floor:FloorSpace;faultsEnabled:boolean;faults:QAFault[];
 session:FloorSession;skippedSteps:number;source:'simulation';
};
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
export const qaPhaseAt=(timeMs:number)=>QA_PHASES.reduce((p,q)=>timeMs>=q.atMs?q:p,QA_PHASES[0]);
export const qaFaultAt=(timeMs:number,enabled=true):QAFault|null=>
 enabled?QA_FAULTS.find(f=>f.startMs<=timeMs&&timeMs<f.endMs)??null:null;
export const qaOutputTransportAt=(timeMs:number,verified:boolean,enabled=true):'live'|'hold'|'blackout'=>{
 if(!verified)return 'blackout';
 const f=qaFaultAt(timeMs,enabled);
 return f?.id==='hold'?'hold':f?'blackout':'live';
};
export const qaFormatTime=(ms:number)=>{
 const n=Math.max(0,Math.floor(ms/1000));
 return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
};
export function qaBodyPosition(id:'A'|'B',timeMs:number,floor:FloorSpace):FloorPoint{
 const t=clamp(timeMs,0,QA_DURATION_MS),cycle=(t%160000)/160000;
 const zig=cycle<.5?cycle*2:2-cycle*2;
 const x=.09+.82*(id==='A'?zig:1-zig);
 const wander=Math.sin(t/51000+(id==='A'?0:1.7))*.21+
  Math.sin(t/23500+(id==='A'?.5:2.1))*.07;
 return {xM:clamp(x*floor.widthM,.2,floor.widthM-.2),
  yM:clamp(((id==='A'?.37:.63)+wander)*floor.depthM,.2,floor.depthM-.2)};
}
function footPoint(id:'A'|'B',foot:FootSide,timeMs:number,floor:FloorSpace){
 const p=qaBodyPosition(id,timeMs,floor);
 const before=qaBodyPosition(id,Math.max(0,timeMs-160),floor);
 const after=qaBodyPosition(id,Math.min(QA_DURATION_MS,timeMs+160),floor);
 const headingRad=Math.atan2(after.yM-before.yM,after.xM-before.xM);
 const side=foot==='left'?.135:-.135;
 return {positionM:{xM:clamp(p.xM-Math.sin(headingRad)*side,.05,floor.widthM-.05),
  yM:clamp(p.yM+Math.cos(headingRad)*side,.05,floor.depthM-.05)},headingRad};
}

/** 15-minute software rehearsal. These events are simulated, never measured. */
export function createQAScenario(floor:FloorSpace=defaultFloorSpace(),faultsEnabled=true):QAScenario{
 const stage=validateFloorSpace(floor),engine=new FootstepEventEngine(stage,.12);
 const steps:{id:'A'|'B';foot:FootSide;t:number}[]=[];
 for(const id of ['A','B'] as const){
  const strideMs=id==='A'?1010:1130;
  for(let n=0;;n++){
   const t=(id==='A'?120:390)+n*strideMs;
   if(t+270>QA_DURATION_MS)break;
   steps.push({id,foot:n%2?'right':'left',t});
  }
 }
 steps.sort((a,b)=>a.t-b.t||(a.id==='A'?-1:1));
 const events:FootstepEvent[]=[],activated=new Set<QAFaultKind>();
 let skippedSteps=0;
 for(const step of steps){
  const fault=faultsEnabled?QA_FAULTS.find(f=>
   f.id!=='hold'&&f.id!=='blackout'&&step.t+270>f.startMs&&step.t<f.endMs):null;
  if(fault){
   if(!activated.has(fault.id)){
    activated.add(fault.id);
    for(const id of ['A','B'] as const)for(const foot of ['left','right'] as const)
     engine.loseTracking(id,foot);
   }
   skippedSteps++;continue;
  }
  const {positionM,headingRad}=footPoint(step.id,step.foot,step.t+270,stage);
  events.push(...engine.observe({performerId:step.id,foot:step.foot,timestampMs:step.t,
   phase:'swing',positionM,headingRad,source:'simulation',
   positionBasis:'simulated',confidence:1}));
  events.push(...engine.observe({performerId:step.id,foot:step.foot,timestampMs:step.t+270,
   phase:'stance',positionM,headingRad,source:'simulation',
   positionBasis:'simulated',confidence:1}));
 }
 events.sort((a,b)=>a.timestampMs-b.timestampMs||a.id.localeCompare(b.id));
 return {schema:'soma.footprints.qa-scenario',version:1,durationMs:QA_DURATION_MS,
  floor:stage,faultsEnabled,faults:faultsEnabled?QA_FAULTS.map(f=>({...f})):[],
  session:createFloorSession(stage,events),skippedSteps,source:'simulation'};
}
export function qaEventIndexAt(events:readonly FootstepEvent[],timeMs:number):number{
 let low=0,high=events.length;
 while(low<high){const mid=(low+high)>>1;
  if(events[mid].timestampMs<=timeMs)low=mid+1;else high=mid;
 }
 return low;
}
export const qaEventsAt=(scenario:QAScenario,timeMs:number)=>scenario.session.events.slice(
 0,qaEventIndexAt(scenario.session.events,timeMs));
export function qaContactCounts(scenario:QAScenario){
 const result={A:{left:0,right:0},B:{left:0,right:0}};
 for(const e of scenario.session.events)if(e.kind==='contact'&&
  (e.performerId==='A'||e.performerId==='B'))result[e.performerId][e.foot]++;
 return result;
}
