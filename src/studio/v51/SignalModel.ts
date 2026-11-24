import {defaultUnpackingGraph,compileCuePlan,PORTS,type CueId,type PortType,type NodeGraph} from '../v5/NodeGraphModel.ts';
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
export function validateCue(cue:CueId,graph:NodeGraph=GRAPH){
 const plan=compileCuePlan(graph,cue);
 // Current adapters implement the approved route template only. Reject a missing or changed route rather than pretending the patch is executable.
 const expected=compileCuePlan(GRAPH,cue);
 const endpoint=(e:NodeGraph['edges'][number])=>e.from.nodeId+':'+e.from.port+'>'+e.to.nodeId+':'+e.to.port;
 const actual=new Set(plan.edges.map(endpoint));
 for(const e of expected.edges)if(!actual.has(endpoint(e)))throw Error('Missing required cue route '+endpoint(e));
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
export function signalFresh(s:SignalSample|undefined,now:number){return !!s&&Number.isFinite(s.at)&&now>=s.at&&now-s.at<(s.continuous?650:420);}
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

/** Traverse logical graph, never traverse a collapsed visual group as if it were a feedback loop. */
export function relatedEdges(selected:string,bindings:Bindings):Set<string>{
 const seeds=GRAPH.nodes.filter(n=>viewId(n.id,bindings)===selected).map(n=>n.id);
 const found=new Set<string>();
 for(const direction of ['up','down'] as const){
  const seen=new Set(seeds),queue=[...seeds];
  while(queue.length){const id=queue.shift()!;for(const e of GRAPH.edges){
   const from=direction==='up'?e.to.nodeId:e.from.nodeId;
   const to=direction==='up'?e.from.nodeId:e.to.nodeId;
   if(from!==id)continue;found.add(e.id);if(!seen.has(to)){seen.add(to);queue.push(to);}
  }}
 }
 return found;
}
export function viewportFit(size:{w:number;h:number},bounds:{w:number;h:number}){
 const z=Math.max(.2,Math.min(1.15,(size.w-28)/bounds.w,(size.h-52)/bounds.h));
 return {z,x:(size.w-bounds.w*z)/2,y:(size.h-bounds.h*z)/2};
}
export function viewportCenter(point:{x:number;y:number},size:{w:number;h:number},z:number){
 return {z,x:size.w/2-point.x*z,y:size.h/2-point.y*z};
}
