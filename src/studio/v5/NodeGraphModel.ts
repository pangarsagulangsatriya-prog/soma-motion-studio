/**
 * SOMA V5 — typed graph *planning* kernel.
 *
 * This module validates connections and derives cue-specific paths. It does not
 * start camera streams, perform inference, record pixels, or authorize light.
 * Existing hardware and output safety gates remain authoritative.
 */
export type PortType='video'|'pose'|'gesture'|'footsteps'|'stroke'|'photo'|'media'|'session'|'frame';
export type NodeKind='camera'|'media'|'saved-session'|'photo-bank'|'motion'|'gesture'|
 'footprint'|'trace'|'capture'|'recorder'|'replay'|'floor-mix'|'canvas-mix'|'floor-output'|'canvas-output';
export type CueId='F1'|'F2'|'F3A'|'F3B';
export type GraphNode={id:string;kind:NodeKind;label:string};
export type GraphEndpoint={nodeId:string;port:string};
export type GraphEdge={id:string;from:GraphEndpoint;to:GraphEndpoint};
export type NodeGraph={schema:'soma.node-graph';version:1;nodes:GraphNode[];edges:GraphEdge[]};
export type PortContract={inputs:Record<string,PortType>;outputs:Record<string,PortType>};

export const PORTS:Record<NodeKind,PortContract>={
 camera:{inputs:{},outputs:{video:'video'}},
 media:{inputs:{},outputs:{media:'media'}},
 'saved-session':{inputs:{},outputs:{session:'session'}},
 'photo-bank':{inputs:{},outputs:{photo:'photo'}},
 motion:{inputs:{video:'video'},outputs:{pose:'pose'}},
 gesture:{inputs:{video:'video'},outputs:{gesture:'gesture'}},
 footprint:{inputs:{pose:'pose'},outputs:{footsteps:'footsteps'}},
 trace:{inputs:{pose:'pose'},outputs:{stroke:'stroke'}},
 capture:{inputs:{video:'video',gesture:'gesture'},outputs:{photo:'photo'}},
 recorder:{inputs:{footsteps:'footsteps',stroke:'stroke'},outputs:{}},
 replay:{inputs:{session:'session'},outputs:{footsteps:'footsteps',stroke:'stroke'}},
 'floor-mix':{inputs:{live:'footsteps',replay:'footsteps'},outputs:{frame:'frame'}},
 'canvas-mix':{inputs:{liveStroke:'stroke',replayStroke:'stroke',livePhoto:'photo',savedPhoto:'photo',archive:'media'},outputs:{frame:'frame'}},
 'floor-output':{inputs:{frame:'frame'},outputs:{}},
 'canvas-output':{inputs:{frame:'frame'},outputs:{}}
};

const graphNodes:[string,NodeKind,string][]=[
 ['cam1','camera','Camera 01 · Performer'],['cam2','camera','Camera 02 · Audience'],['cam3','camera','Camera 03 · Gesture'],
 ['archive','media','Archive Media'],['saved','saved-session','Saved F1 Session'],['photos','photo-bank','Photo Bank'],
 ['pose','motion','Motion Detector'],['hand','gesture','Gesture Detector'],
 ['foot','footprint','Footprint Generator'],['trace','trace','Dual Trace'],
 ['capture','capture','Capture 4 Foto'],['rec','recorder','Session Recorder'],['replay','replay','Trace Replay'],
 ['floorMix','floor-mix','Floor Composite'],['canvasMix','canvas-mix','Canvas Composite'],
 ['floor','floor-output','Floor Output'],['canvas','canvas-output','Canvas Output']
];
const graphLinks:[string,string,string,string][]=[
 ['cam1','video','pose','video'],['pose','pose','foot','pose'],['pose','pose','trace','pose'],
 ['foot','footsteps','rec','footsteps'],['trace','stroke','rec','stroke'],
 ['foot','footsteps','floorMix','live'],['trace','stroke','canvasMix','liveStroke'],
 ['cam2','video','capture','video'],['cam3','video','hand','video'],['hand','gesture','capture','gesture'],
 ['capture','photo','canvasMix','livePhoto'],['archive','media','canvasMix','archive'],
 ['saved','session','replay','session'],['replay','footsteps','floorMix','replay'],
 ['replay','stroke','canvasMix','replayStroke'],['photos','photo','canvasMix','savedPhoto'],
 ['floorMix','frame','floor','frame'],['canvasMix','frame','canvas','frame']
];

/** A reproducible stage patch. Physical source IDs are assigned at runtime. */
export function defaultUnpackingGraph():NodeGraph{
 return {schema:'soma.node-graph',version:1,
  nodes:graphNodes.map(([id,kind,label])=>({id,kind,label})),
  edges:graphLinks.map(([from,port,to,targetPort],i)=>({
   id:'edge-'+String(i+1).padStart(2,'0'),from:{nodeId:from,port},to:{nodeId:to,port:targetPort}
  }))
 };
}

/** Returns detailed contract errors. No network or DOM is needed to validate. */
export function graphErrors(graph:NodeGraph):string[]{
 const errors:string[]=[];
 if(graph.schema!=='soma.node-graph'||graph.version!==1)return ['Unsupported graph schema'];
 const byId=new Map<string,GraphNode>();
 for(const node of graph.nodes){
  if(!node.id||byId.has(node.id))errors.push('Duplicate or blank node ID: '+node.id);
  if(!(node.kind in PORTS))errors.push('Unknown node kind: '+String(node.kind));
  byId.set(node.id,node);
 }
 const seenEdges=new Set<string>(),seenTargets=new Set<string>();
 const adjacency=new Map<string,string[]>(graph.nodes.map(node=>[node.id,[]]));
 for(const edge of graph.edges){
  if(!edge.id||seenEdges.has(edge.id))errors.push('Duplicate or blank edge ID: '+edge.id);
  seenEdges.add(edge.id);
  const a=byId.get(edge.from.nodeId),b=byId.get(edge.to.nodeId);
  if(!a||!b){errors.push('Edge '+edge.id+' references missing node');continue;}
  const fromType=PORTS[a.kind]?.outputs[edge.from.port];
  const toType=PORTS[b.kind]?.inputs[edge.to.port];
  if(!fromType||!toType||fromType!==toType){
   errors.push('Edge '+edge.id+' incompatible ports: '+(fromType??'?')+' -> '+(toType??'?'));
   continue;
  }
  const target=edge.to.nodeId+':'+edge.to.port;
  if(seenTargets.has(target))errors.push('Multiple writers for single input '+target);
  seenTargets.add(target);
  adjacency.get(a.id)?.push(b.id);
 }
 const visited=new Set<string>(),stack=new Set<string>();
 function dfs(id:string):void{
  if(stack.has(id)){errors.push('Cycle detected at '+id);return;}
  if(visited.has(id))return;
  stack.add(id);
  for(const next of adjacency.get(id)??[])dfs(next);
  stack.delete(id);visited.add(id);
 }
 for(const id of adjacency.keys())dfs(id);
 return [...new Set(errors)];
}

const CUE_NODES:Record<CueId,readonly string[]>={
 F1:['cam1','pose','foot','trace','rec','floorMix','canvasMix','floor','canvas'],
 F2:['archive','canvasMix','canvas'],
 F3A:['cam2','cam3','hand','capture','canvasMix','canvas'],
 F3B:['archive','saved','photos','replay','floorMix','canvasMix','floor','canvas']
};
const CUE_SOURCES:Record<CueId,readonly string[]>={
 F1:['cam1'],F2:['archive'],F3A:['cam2','cam3'],F3B:['archive','saved','photos']
};
export type CuePlan={cue:CueId;nodes:GraphNode[];edges:GraphEdge[];
 requiredSources:string[];outputs:string[]};
/**
 * Compile a cue from ONE persistent graph. Port routing alone never sends
 * the equivalent of LIVE, arming, or projector authorization.
 */
export function compileCuePlan(graph:NodeGraph,cue:CueId):CuePlan{
 const errors=graphErrors(graph);if(errors.length)throw Error('Invalid graph: '+errors.join('; '));
 const enabled=new Set(CUE_NODES[cue]);
 const nodes=graph.nodes.filter(node=>enabled.has(node.id));
 const found=new Set(nodes.map(n=>n.id));
 const missing=CUE_NODES[cue].filter(id=>!found.has(id));
 if(missing.length)throw Error('Cue '+cue+' missing required nodes: '+missing.join(', '));
 return {cue,nodes,edges:graph.edges.filter(e=>found.has(e.from.nodeId)&&found.has(e.to.nodeId)),
  requiredSources:[...CUE_SOURCES[cue]],
  outputs:nodes.filter(n=>n.kind==='floor-output'||n.kind==='canvas-output').map(n=>n.id)
 };
}
export type SourceHealth='ready'|'connecting'|'stale'|'offline'|'unsupported';
/** Readiness for *software input* only. Physical stage approval is separate. */
export function assessCueInputs(plan:CuePlan,health:Readonly<Record<string,SourceHealth>>){
 const missing=plan.requiredSources.filter(id=>health[id]!=='ready');
 return {status:missing.length?'blocked' as const:'ready' as const,missing,
  reason:missing.length?'Sumber belum siap: '+missing.join(', '):'Sumber siap untuk preview'};
}
