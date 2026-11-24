import {defaultUnpackingGraph,compileCuePlan,PORTS,type CueId,type PortType} from '../v5/NodeGraphModel.ts';
import type {VisualEvent} from '../v5/VisualRuntime.ts';
export const ROLES=['cam1','cam2','cam3'] as const;
export type Role=typeof ROLES[number];
export type Bindings=Record<Role,string>;
export type Surface='floor'|'canvas';
export type Latches=Record<Surface,boolean>;
export const ROLE_NAMES:Record<Role,string>={cam1:'Performer',cam2:'Penonton',cam3:'Gestur'};
export const CUES:Record<CueId,string>={F1:'Jejak',F2:'Arsip',F3A:'Foto',F3B:'Replay'};
export const GRAPH=defaultUnpackingGraph();
export const EDGE_IDS=Object.fromEntries(GRAPH.edges.map(e=>[e.from.nodeId+':'+e.from.port+'>'+e.to.nodeId+':'+e.to.port,e.id]));
export type Readiness={fresh:Record<Role,boolean>;bindings:Bindings;media:boolean;session:boolean;photos:number;consent:boolean;verified:boolean;saving:boolean;recording:boolean};
export type Blocker={text:string;target:string};
export function preflight(cue:CueId,r:Readiness):Blocker|null{
 if(cue==='F1'&&!r.fresh.cam1)return {text:'Hubungkan kamera performer.',target:'cam1'};
 if(cue==='F2'&&!r.media)return {text:'Pilih arsip yang siap diputar.',target:'archive'};
 if(cue==='F3A'){
  if(!r.fresh.cam2)return {text:'Hubungkan kamera penonton.',target:'cam2'};
  if(!r.fresh.cam3)return {text:'Hubungkan kamera gestur.',target:'cam3'};
  if(r.bindings.cam2===r.bindings.cam3)return {text:'Gunakan dua kamera berbeda.',target:'capture'};
  if(!r.consent)return {text:'Persetujuan penonton diperlukan.',target:'capture'};
  if(!r.verified)return {text:'Periksa frame kamera penonton.',target:'capture'};
 }
 if(cue==='F3B'){
  if(r.recording||r.saving)return {text:'Selesaikan penyimpanan rekaman F1.',target:'session'};
  if(!r.session)return {text:'Rekam F1 terlebih dahulu.',target:'session'};
  if(!r.media)return {text:'Pilih arsip yang siap diputar.',target:'archive'};
  if(!r.consent||!r.photos)return {text:'Siapkan foto penonton yang disetujui.',target:'capture'};
 }
 return null;
}
export function sourceAssignment(bindings:Bindings,role:Role,id:string){
 const next={...bindings,[role]:id};
 if(next.cam2&&next.cam2===next.cam3)return {ok:false as const,reason:'Gunakan dua kamera berbeda untuk penonton dan gestur.'};
 return {ok:true as const,bindings:next};
}
export function cueUsesSurface(cue:CueId|null,surface:Surface){return cue!==null&&(surface==='canvas'||cue==='F1'||cue==='F3B');}
export function rebaseEvent(event:VisualEvent,offset:number):VisualEvent{
 const at=Math.max(0,event.at-offset);
 return event.kind==='foot'?{...event,at,mark:{...event.mark,t:Math.max(0,event.mark.t-offset)}}:{...event,at};
}
export function validateCue(cue:CueId){
 const plan=compileCuePlan(GRAPH,cue);
 for(const n of plan.nodes){
  for(const port of Object.keys(PORTS[n.kind].inputs)){
   // Mixer layer inputs are optional individually; selected paths still need at least one inbound.
   if(n.kind==='floor-mix'||n.kind==='canvas-mix')continue;
   if(!plan.edges.some(e=>e.to.nodeId===n.id&&e.to.port===port))throw Error('Missing required cue port '+n.id+':'+port);
  }
 }
 return plan;
}
export type SignalSample={at:number;continuous:boolean;seq:number};
export type Signals=Record<string,SignalSample>;
export function signalFresh(s:SignalSample|undefined,now:number){return !!s&&now-s.at<(s.continuous?650:420);}
export function portFamily(type:PortType){return type==='video'||type==='media'?'video':type==='pose'||type==='gesture'?'pose':type==='session'?'session':'visual';}
export function viewId(id:string,bindings:Bindings){
 if(ROLES.includes(id as Role))return bindings[id as Role]?'source:'+bindings[id as Role]:id;
 if(['saved','rec','replay'].includes(id))return 'session';
 if(['capture','photos'].includes(id))return 'capture';
 if(['floor','floorMix'].includes(id))return 'floor';
 if(['canvas','canvasMix'].includes(id))return 'canvas';
 return id;
}
export function portInfo(nodeId:string,port:string,direction:'inputs'|'outputs'){
 const node=GRAPH.nodes.find(n=>n.id===nodeId);
 return node?PORTS[node.kind][direction][port]:undefined;
}
