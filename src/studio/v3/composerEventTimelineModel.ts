/** CP-09: bounded, deterministic event capture/replay for Compose software preview.
 * Arrival timestamps are session-relative; MP4 absolute seek is intentionally not inferred
 * from detector timestamps (which may be wall-clock / performance timestamps).
 */
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import {applyFootprintEvent,emptyFootprintState,footprintOpacity,type FootprintState} from './footprintEventStore.ts';
export type TimelineKind='contact'|'slide'|'pivot'|'release'|'movement'|'presence'|'lift';
export type TimelineEvent={id:string;atMs:number;kind:TimelineKind;actorId:string;foot:'left'|'right'|'unknown';x:number;y:number;verified:boolean;event:FootMotionEventV2};
export type TimelineCapture={session:string;originAtMs:number;events:TimelineEvent[]};
export const MAX_TIMELINE_EVENTS=800;
export const MAX_TIMELINE_MS=10*60*1000;
export function emptyTimelineCapture(session='unknown'):TimelineCapture{return {session,originAtMs:-1,events:[]};}
export function collectTimelineEvents(previous:TimelineCapture,input:readonly FootMotionEventV2[],session:string,nowMs:number):TimelineCapture{
 let next=previous.session===session?previous:emptyTimelineCapture(session);
 const seen=new Set(next.events.map(e=>e.id));let appended=false;
 for(const e of input){
  if(seen.has(e.eventId)||!Number.isFinite(e.x)||!Number.isFinite(e.y))continue;
  if(e.kind==='contact'&&!e.verified)continue;
  if(!Number.isFinite(nowMs))continue;
  if(next.originAtMs<0)next={...next,originAtMs:nowMs};
  const atMs=Math.max(0,Math.min(MAX_TIMELINE_MS,nowMs-next.originAtMs));
  const newItem:TimelineEvent={id:e.eventId,atMs,kind:e.kind,actorId:e.actorId,
   foot:e.foot,x:e.x,y:e.y,verified:e.verified,event:e};
  if(!appended){next={...next,events:[...next.events]};appended=true;}
  next.events.push(newItem);seen.add(e.eventId);
 }
 if(next.events.length>MAX_TIMELINE_EVENTS)next={...next,events:next.events.slice(-MAX_TIMELINE_EVENTS)};
 return next;
}
export const timelineDuration=(capture:TimelineCapture)=>Math.max(1000,capture.events.at(-1)?.atMs??0);
export function timelineAt(capture:TimelineCapture,positionMs:number){
 const cursor=Math.max(0,Number.isFinite(positionMs)?positionMs:0);
 return capture.events.filter(e=>e.atMs<=cursor);
}
export function timelineStep(positionMs:number,elapsedMs:number,durationMs:number,speed=1,loop=false):{positionMs:number;playing:boolean}{
 const duration=Math.max(0,durationMs);
 if(duration===0)return {positionMs:0,playing:false};
 const next=Math.max(0,positionMs)+Math.max(0,elapsedMs)*Math.max(.1,Math.min(4,speed));
 if(next>=duration)return loop?{positionMs:next%duration,playing:true}:{positionMs:duration,playing:false};
 return {positionMs:next,playing:true};
}
export function reconstructTimelineFootprints(capture:TimelineCapture,positionMs:number):FootprintState{
 let state=emptyFootprintState();const recent=timelineAt(capture,positionMs);
 for(const item of recent){
  const event=item.event;
  if(item.foot==='unknown'||!['contact','slide','pivot','release'].includes(item.kind))continue;
  if(event.actorId!=='A'&&event.actorId!=='B'&&event.actorId!=='performer-1'&&event.actorId!=='performer-2')continue;
  const performerId=(event.actorId==='B'||event.actorId==='performer-2')?'B':'A';
  state=applyFootprintEvent(state,{id:item.id,kind:item.kind as 'contact'|'slide'|'pivot'|'release',
   performerId,foot:item.foot,atMs:item.atMs,x:item.x,y:item.y,headingDeg:0,confidence:event.confidence,
   trackingState:event.verified||item.kind!=='contact'?'tracked':'estimated'});
 }
 return state;
}
export function timelineFootprintVisibility(capture:TimelineCapture,positionMs:number,lifeMs:number){
 const state=reconstructTimelineFootprints(capture,positionMs);
 return state.imprints.map(stamp=>({...stamp,opacity:footprintOpacity(stamp,positionMs,{holdMs:0,decayMs:Math.max(1,lifeMs)})}))
  .filter(item=>item.opacity>0);
}
