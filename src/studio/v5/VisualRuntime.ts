import type {MotionFrame} from '../../engine/types.ts';
import {GaitAnalyzer} from '../../footprints/gait-analysis/index.ts';
import {TwoPersonIdentityTracker} from '../../footprints/live/TwoPersonIdentityTracker.ts';
import {upperGestureAnchors} from '../../footprints/dual-trace/UpperGestureAnchorAdapter.ts';
import {UpperGestureStrokeTracker,type UpperGestureEvent} from '../../footprints/dual-trace/UpperGestureStrokeTracker.ts';
import {ActorPathTracker,type PathEvent} from '../../footprints/lines/v3/ActorPathTracker.ts';
import {DualTraceV2Renderer} from '../../footprints/dual-trace/DualTraceV2Renderer.ts';
import {PainterlyImpressionEngine,lifetimeOpacity} from '../../footprints/lines/v3/PainterlyImpressionEngine.ts';
import {paintAuthenticFootprint} from '../../footprints/scenes/authenticFootGeometry.ts';
export type FootMark={actor:'A'|'B';side:'left'|'right';x:number;y:number;heading:number;t:number};
export type VisualEvent={at:number;kind:'foot';mark:FootMark}|{at:number;kind:'upper';event:UpperGestureEvent}|{at:number;kind:'path';event:PathEvent};
export type SessionLog={schema:'soma.visual-session';version:1;duration:number;events:VisualEvent[]};
const MAX_EVENTS=60000;
const DB='soma-v5-visual-session';
export function emptyLog():SessionLog{return {schema:'soma.visual-session',version:1,duration:0,events:[]};}
export function appendEvent(log:SessionLog,event:VisualEvent):boolean{
 if(log.events.length>=MAX_EVENTS||!Number.isFinite(event.at)||event.at<0||event.at<(log.events.at(-1)?.at??0))return false;
 log.events.push(event);log.duration=Math.max(log.duration,event.at);return true;
}
export function validLog(v:unknown):v is SessionLog{
 if(!v||typeof v!=='object')return false;const x=v as SessionLog;
 return x.schema==='soma.visual-session'&&x.version===1&&Number.isFinite(x.duration)&&x.duration>=0&&Array.isArray(x.events)&&x.events.length<=MAX_EVENTS&&x.events.every((e,i)=>{
  if(!e||!Number.isFinite(e.at)||e.at<0||e.at>x.duration||(i>0&&e.at<x.events[i-1].at))return false;
  if(e.kind==='foot'){const m=e.mark;return !!m&&['A','B'].includes(m.actor)&&['left','right'].includes(m.side)&&[m.x,m.y,m.heading,m.t].every(Number.isFinite)&&m.x>=0&&m.x<=1&&m.y>=0&&m.y<=1;}
  if(e.kind!=='upper'&&e.kind!=='path')return false;const p=e.event;
  return !!p&&['A','B'].includes(p.actorId)&&['START','ADD','TURN','STOP','CUT'].includes(p.kind)&&typeof p.strokeId==='string'&&typeof p.sourceKey==='string'&&typeof p.clipStableId==='string'&&Number.isFinite(p.timeMs)&&Number.isFinite(p.epoch)&&Number.isFinite(p.confidence)&&!!p.point&&[p.point.x,p.point.y].every(Number.isFinite)&&(e.kind==='path'||['head','shoulder'].includes(e.event.channel));
 });
}
function db():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore('sessions');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
export async function saveLog(log:SessionLog){const d=await db();try{await new Promise<void>((resolve,reject)=>{const t=d.transaction('sessions','readwrite');t.objectStore('sessions').put(log,'latest');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}finally{d.close();}}
export async function loadLog():Promise<SessionLog>{const d=await db();try{return await new Promise((resolve,reject)=>{const q=d.transaction('sessions','readonly').objectStore('sessions').get('latest');q.onsuccess=()=>resolve(validLog(q.result)?q.result:emptyLog());q.onerror=()=>reject(q.error);});}finally{d.close();}}
export const replayUntil=(log:SessionLog,from:number,at:number,apply:(event:VisualEvent)=>void)=>{let i=from;while(i<log.events.length&&log.events[i].at<=at)apply(log.events[i++]);return i;};
const PALETTE={A:'#E84B32',B:'#202226'};
const tracePalette={A:{path:'#E84B32',footprint:'#E84B32',upper:'#E84B32'},B:{path:'#202226',footprint:'#202226',upper:'#202226'}};
const visible={A:{left:true,right:true},B:{left:true,right:true}};
export class VisualRuntime{
 readonly identity=new TwoPersonIdentityTracker();
 private gaits={A:new GaitAnalyzer(),B:new GaitAnalyzer()};
 private upper=new UpperGestureStrokeTracker();
 private path=new ActorPathTracker();
 private trace:DualTraceV2Renderer|null=null;
 private impressions=new PainterlyImpressionEngine();
 marks:FootMark[]=[];last=-1;source='';reason='Menunggu frame';epoch=0;
 clear(){this.trace?.clearBoth();this.trace=null;this.impressions.reset();this.marks=[];this.resetTracking();}
 resetTracking(){this.identity.reset();this.gaits.A.reset();this.gaits.B.reset();this.upper.cutAll('reset');this.path.cutAll('reset');this.trace?.cutAll();this.last=-1;this.epoch++;}
 apply(e:VisualEvent){if(e.kind==='foot'){this.marks.push(e.mark);if(this.marks.length>10000)this.marks.shift();return;}
  this.trace??=new DualTraceV2Renderer();if(e.kind==='upper')this.trace.ingestUpper(e.event,10,18);else this.trace.ingestPath(e.event,27,'rough-sumi',true);}
 ingest(frame:MotionFrame,source:string,aspect:number,at:number,emit:(e:VisualEvent)=>void){
  if(source!==this.source){this.source=source;this.resetTracking();}
  if(frame.time===this.last)return;this.last=frame.time;
  const actors=this.identity.observe(frame.tracked?(frame.poses?.length?frame.poses:[frame.pose]):[],frame.time);
  this.reason=actors.reason;
  const anchors=actors.assignments.flatMap(a=>upperGestureAnchors({actorId:a.id,source:'camera',sourceKey:source,epoch:this.epoch,timeMs:frame.time,identityConfidence:a.confidence,landmarks:a.pose,coordinateBasis:'image-2d'}));
  for(const a of actors.assignments){for(const side of [0,1] as const){
   const s=this.gaits[a.id].observe({...frame,pose:a.pose},side,frame.time,aspect);
   if(s?.stamp&&s.confidence>=.55)emit({at,kind:'foot',mark:{actor:a.id,side:side?'right':'left',x:s.x,y:s.y,heading:s.heading+Math.PI/2,t:at}});
  }}
  for(const a of actors.lost)this.gaits[a].reset();
  if(actors.ambiguous){for(const e of this.upper.cutAll('identity'))emit({at,kind:'upper',event:e});this.trace?.cutAll();return;}
  for(const e of this.upper.ingest(anchors,frame.time))emit({at,kind:'upper',event:e});
 }
 paintFloor(ctx:CanvasRenderingContext2D,at:number,life:number){
  const w=ctx.canvas.width,h=ctx.canvas.height;ctx.fillStyle='#090d10';ctx.fillRect(0,0,w,h);
  for(const m of this.marks){const alpha=lifetimeOpacity(m.t,at,life,false);if(alpha>0)paintAuthenticFootprint(ctx,{x:m.x*w,y:m.y*h,side:m.side,headingRad:m.heading,widthPx:w*.015,lengthPx:w*.04,alpha,color:m.actor==='A'?'#e95350':'#7da8e8'});}
 }
 paintTrace(ctx:CanvasRenderingContext2D,at:number){
  this.trace??=new DualTraceV2Renderer();
  this.trace.paint(ctx,{palette:tracePalette,impressions:this.impressions,timeMs:at,footprintLifeMs:10000,footprintKeep:false,footVisible:visible,headEnabled:true,shoulderEnabled:true,headOpacity:.8,shoulderOpacity:.95,upperOpacity:1,footprintOpacity:0,pathOpacity:.95});
 }
}
