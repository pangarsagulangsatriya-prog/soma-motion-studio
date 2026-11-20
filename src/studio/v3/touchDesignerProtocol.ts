/** SOMA → TouchDesigner data-only protocol. Never grants permission to illuminate a projector. */
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import type {FloorInteractionSource} from '../../footprints/scenes/FloorInteractionEngine.ts';

export const TD_BRIDGE_SCHEMA='soma.td-bridge' as const;
export const TD_BRIDGE_VERSION=1 as const;
export const TD_BRIDGE_INTERVAL_MS=50;
export const TD_BRIDGE_MAX_BYTES=16_384;
export type TdSource=FloorInteractionSource;
export type TdFoot={x:number;y:number;status:'contact'|'slide'|'pivot'|'release'|'movement'|null;headingRad:number|null;coordinateBasis:FootMotionEventV2['coordinateBasis'];confidence:number;atMs:number};
export type TdActor={id:string;tracking:'visible'|'uncertain';confidence:number|null;feet:{left:TdFoot|null;right:TdFoot|null}};
export type TdState={schema:typeof TD_BRIDGE_SCHEMA;version:1;type:'state';sessionId:string;generation:number;seq:number;
 source:TdSource;mode:'live'|'rehearsal';atMs:number;coordinateSpace:'floor-uv'|'image-uv'|'simulated-floor-uv';
 floor:{widthM:number;depthM:number;calibrated:boolean}|null;actors:TdActor[];};
export type TdEnvelope={schema:typeof TD_BRIDGE_SCHEMA;version:1;type:'event';sessionId:string;generation:number;seq:number;event:FootMotionEventV2;test?:boolean};
export type TdControl={schema:typeof TD_BRIDGE_SCHEMA;version:1;type:'control';sessionId:string;generation:number;seq:number;
 action:'reset'|'blackout'|'stop'|'cue';cue?:{index:number;label:string}};
export type TdHeartbeat={schema:typeof TD_BRIDGE_SCHEMA;version:1;type:'heartbeat';sessionId:string;generation:number;seq:number;atMs:number};
export type TdHello={schema:typeof TD_BRIDGE_SCHEMA;version:1;type:'hello';sessionId:string;nonce:string;token:string};
export type TdPacket=TdState|TdEnvelope|TdControl|TdHeartbeat|TdHello;
export type TdFootObservation={actorId:string;foot:'left'|'right';x:number;y:number;confidence:number;atMs:number;
 coordinateBasis:'image-2d'|'simulated';headingRad?:number};
export type TdSnapshot={source:TdSource|null;sessionId:string;generation:number;events:readonly FootMotionEventV2[];
 ready:boolean;atMs:number;floor:{widthM:number;depthM:number;calibrated:boolean}|null;
 observations?:readonly TdFootObservation[]};
/** Use landmark feet from the existing engine, never infer physical floor contact. */
export function poseFootObservations(
  actorId:string,landmarks:readonly {x:number;y:number;visibility?:number}[],atMs:number
):TdFootObservation[]{
 const result:TdFootObservation[]=[];
 for(const [side,heelIndex,toeIndex,ankleIndex] of [
  ['left',29,31,27],['right',30,32,28]
 ] as const){
  const heel=landmarks[heelIndex],toe=landmarks[toeIndex],ankle=landmarks[ankleIndex];
  const valid=(p:typeof heel)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
   p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??1)>=.45;
  const points=valid(heel)&&valid(toe)?[heel,toe]:valid(ankle)?[ankle]:[];
  if(points.length===0)continue;
  const confidence=Math.min(...points.map(p=>p.visibility??1));
  result.push({actorId,foot:side,
   x:points.reduce((a,p)=>a+p.x,0)/points.length,
   y:points.reduce((a,p)=>a+p.y,0)/points.length,
   confidence,atMs,coordinateBasis:'image-2d'});
 }
 return result;
}

export function normalizeTdEndpoint(input:string):string|null{
 try{
  const url=new URL(input.trim().includes('://')?input.trim():'ws://'+input.trim());
  if(url.protocol!=='ws:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||
   !url.port||Number(url.port)<1024||Number(url.port)>65535||url.username||url.password||url.search||url.hash||
   url.pathname!=='/')return null;
  return url.href;
 }catch{return null;}
}
export function tdCoordinateSpace(source:TdSource,calibrated:boolean):TdState['coordinateSpace']{
 return source==='simulator'||source==='touch'?'simulated-floor-uv':
  (source==='camera'||source==='phone')&&calibrated?'floor-uv':'image-uv';
}
const fresh=(atMs:number,now:number)=>Number.isFinite(atMs)&&atMs<=now+70&&now-atMs>=0&&now-atMs<=800;
/** Per-foot coordinates only come from foot-labelled events; body presence never becomes a foot. */
export function buildTdState(snapshot:TdSnapshot,seq:number):TdState|null{
 const {source,sessionId,generation,atMs,floor}=snapshot;
 if(!source||!snapshot.ready||!sessionId)return null;
 const actors=new Map<string,TdActor>();
 for(const point of snapshot.observations??[]){
  if(!fresh(point.atMs,atMs)||point.actorId.startsWith('unassigned-')||
   !Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>1||
   point.y<0||point.y>1||point.confidence<0||point.confidence>1)continue;
  const actor:TdActor=actors.get(point.actorId)??{id:point.actorId,tracking:'visible',confidence:null,feet:{left:null,right:null}};
  actor.feet[point.foot]={x:point.x,y:point.y,status:'movement',headingRad:point.headingRad??null,
   coordinateBasis:point.coordinateBasis,confidence:point.confidence,atMs:point.atMs};
  actor.confidence=Math.max(actor.confidence??0,point.confidence);
  actors.set(point.actorId,actor);
 }
 for(const e of snapshot.events){
  if(e.source!==source||!fresh(e.atMs,atMs)||e.actorId.startsWith('unassigned-')||
    !['left','right'].includes(e.foot)||e.x<0||e.x>1||e.y<0||e.y>1)continue;
  const id=e.actorId;
  const actor:TdActor=actors.get(id)??{id,tracking:'visible',confidence:null,feet:{left:null,right:null}};
  const foot=e.foot as 'left'|'right';
  const kind=e.kind==='lift'?'release':e.kind;
  if(actor.feet[foot]&&actor.feet[foot].atMs>e.atMs+70)continue;
  actor.feet[foot]={x:e.x,y:e.y,status:kind==='contact'||kind==='slide'||kind==='pivot'||kind==='release'||kind==='movement'?kind:null,
   headingRad:e.headingRad??null,coordinateBasis:e.coordinateBasis,confidence:e.confidence,atMs:e.atMs};
  actor.confidence=Math.max(actor.confidence??0,e.confidence);
  actors.set(id,actor);
 }
 // Latest landmarks/feet may be missing: send an empty set, never freeze old coordinates.
 return {schema:TD_BRIDGE_SCHEMA,version:1,type:'state',sessionId,generation,seq,
  source,mode:source==='video'||source==='simulator'||source==='touch'?'rehearsal':'live',atMs,
  coordinateSpace:tdCoordinateSpace(source,!!floor?.calibrated),floor,
  actors:[...actors.values()].slice(0,2)};
}
export function eligibleTdTrigger(event:FootMotionEventV2):boolean{
 return !event.actorId.startsWith('unassigned-')&&event.foot!=='unknown'&&
  ['contact','slide','pivot','release'].includes(event.kind)&&
  event.coordinateBasis!=='presence-only'&&
  (event.kind!=='contact'||event.verified);
}
export function tdNewEvents(snapshot:TdSnapshot,sent:Set<string>):FootMotionEventV2[]{
 return snapshot.events.filter(e=>e.sessionId===snapshot.sessionId&&e.generation===snapshot.generation&&
  e.source===snapshot.source&&eligibleTdTrigger(e)&&!sent.has(e.eventId)&&
  e.atMs<=snapshot.atMs+70&&snapshot.atMs-e.atMs<=1500).slice(-32);
}
