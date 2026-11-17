import type {FootstepEvent} from '../footprints/spatial/events.ts';
import type {FloorSpace} from '../footprints/spatial/coordinates.ts';
import type {ReplayPerformer} from './videoGaitAnalysis.ts';
import type {buildReplayEventExport} from './videoReplayExport.ts';

export type ReplayReport=ReturnType<typeof buildReplayEventExport>;
export type ReplaySegment=ReplayReport['segments'][number];
export type ReferenceEvent=ReplayReport['events'][number];
export type RehearsalReference={name:string;source:ReplayReport['source'];segments:ReplaySegment[];
 events:ReferenceEvent[];flags:ReplayReport['flags'];warnings:string[];};
export type TimedContact={timeMs:number;foot:'left'|'right';confidence:number};
export type RehearsalMetrics={
 count:number;cadence:number|null;medianIntervalMs:number|null;pauseCount:number;
 pauseDurationMs:number;left:number;right:number;intervalsMs:number[];
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const object=(value:unknown):Record<string,unknown>|null=>
 value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const string=(value:unknown,max=200):value is string=>
 typeof value==='string'&&value.length<=max;
export function parseReferenceReport(input:unknown):RehearsalReference{
 const raw=object(input);if(!raw||raw.schema!=='soma.video-replay-qa'||raw.version!==1)
  throw Error('Unggah JSON Event QA dari Video Motion Lab S6.5.5.');
 const source=object(raw.source),flags=object(raw.flags);
 if(!source||source.kind!=='local-video'||!string(source.filename)||!finite(source.durationSeconds)||
   source.durationSeconds<=0||source.durationSeconds>36000||
   !finite(source.bytes)||source.bytes<0||!flags||flags.coordinateBasis!=='video-2d-estimate'||
   flags.physicalProjectionAuthorized!==false||flags.physicalFloorCalibrated!==false)
  throw Error('Metadata sumber dan basis koordinat replay tidak valid.');
 const dims=object(source.dimensionsPx);
 if(!dims||!finite(dims.width)||!finite(dims.height)||dims.width<1||dims.height<1||
  !Array.isArray(raw.segments)||raw.segments.length>128||!Array.isArray(raw.events)||
  raw.events.length>20000)throw Error('Segmen atau event replay tidak valid/terlalu besar.');
 const segments:ReplaySegment[]=[];
 const ids=new Set<number>();
 for(const item of raw.segments){
  const seg=object(item);
  if(!seg||!Number.isSafeInteger(seg.segment)||Number(seg.segment)<0||ids.has(Number(seg.segment))||
   !finite(seg.sampledFrames)||seg.sampledFrames<0||!string(seg.endReason,300)||
   !(seg.firstAtMs===null||finite(seg.firstAtMs))||
   !(seg.lastAtMs===null||finite(seg.lastAtMs)))throw Error('Segmen replay rusak.');
  const first=seg.firstAtMs as number|null,last=seg.lastAtMs as number|null;
  if(first!==null&&last!==null&&(first<0||last<first||last>source.durationSeconds*1000+500))
   throw Error('Waktu segmen tidak konsisten.');
  ids.add(Number(seg.segment));
  segments.push({
   segment:Number(seg.segment),firstAtMs:first,lastAtMs:last,
   sampledFrames:seg.sampledFrames as number,
   eventCount:finite(seg.eventCount)?Math.max(0,seg.eventCount):0,
   endReason:seg.endReason as string,
   truncatedEvents:finite(seg.truncatedEvents)?Math.max(0,seg.truncatedEvents):0,
   identityQA:seg.identityQA as ReplaySegment['identityQA']
  });
 }
 const uniq=new Set<string>();
 const events:ReferenceEvent[]=[];
 for(const item of raw.events){
  const ev=object(item);
  if(!ev||!Number.isSafeInteger(ev.segment)||!ids.has(Number(ev.segment))||
   !string(ev.id,128)||!ev.id||!finite(ev.atMs)||ev.atMs<0||
   !['A','B'].includes(String(ev.performer))||
   !['left','right'].includes(String(ev.foot))||
   !['contact','swing','slide','pivot'].includes(String(ev.kind))||
   !finite(ev.confidence)||ev.confidence<0||ev.confidence>1||
   !finite(ev.x)||!finite(ev.y)||ev.x<0||ev.x>1||ev.y<0||ev.y>1||
   !finite(ev.headingRad)||ev.coordinateBasis!=='video-2d-estimate')
    throw Error('Event replay rusak atau berada di luar koordinat 2D.');
  const key=ev.segment+':'+ev.id;
  if(uniq.has(key))continue;uniq.add(key);
  const seg=segments.find(s=>s.segment===ev.segment)!;
  if(ev.atMs>source.durationSeconds*1000+500||
    (seg.firstAtMs!==null&&ev.atMs<seg.firstAtMs-500)||
    (seg.lastAtMs!==null&&ev.atMs>seg.lastAtMs+500))
    throw Error('Timestamp event berada di luar segmen.');
  events.push({
   segment:ev.segment as number,kind:ev.kind as ReferenceEvent['kind'],
   id:ev.id as string,atMs:ev.atMs as number,
   performer:ev.performer as ReplayPerformer,foot:ev.foot as 'left'|'right',
   confidence:ev.confidence as number,x:ev.x as number,y:ev.y as number,
   headingRad:ev.headingRad as number,
   coordinateBasis:'video-2d-estimate',endReason:string(ev.endReason,300)?
    ev.endReason as string:seg.endReason
  });
 }
 const warnings:string[]=[];
 if(flags.archiveOverflow)warnings.push('Beberapa segmen lama sudah keluar dari memori.');
 if(flags.eventHistoryOverflow||segments.some(s=>s.truncatedEvents>0))
  warnings.push('Sebagian histori event terpotong oleh batas memori.');
 if(segments.some(s=>s.identityQA?.ambiguousFrames>0||s.identityQA?.droppedFrames>0))
  warnings.push('Ada frame yang ditahan karena identitas atau kualitas pose.');
 return {
  name:source.filename as string,
  source:source as unknown as ReplayReport['source'],
  segments:segments.sort((a,b)=>a.segment-b.segment),
  events:events.sort((a,b)=>a.segment-b.segment||a.atMs-b.atMs),
  flags:flags as unknown as ReplayReport['flags'],warnings
 };
}
export function fromReplayReport(report:ReplayReport):RehearsalReference{
 return parseReferenceReport(report);
}
export function selectReferenceSegment(ref:RehearsalReference,segment:number){
 const span=ref.segments.find(s=>s.segment===segment);
 if(!span||span.firstAtMs===null||span.lastAtMs===null)return null;
 return {startMs:span.firstAtMs,endMs:span.lastAtMs,durationMs:span.lastAtMs-span.firstAtMs,
  events:ref.events.filter(e=>e.segment===segment)};
}
export function contactMetrics(contacts:TimedContact[],startMs:number,windowMs:number):RehearsalMetrics{
 const safeWindow=Number.isFinite(windowMs)&&windowMs>0?windowMs:0;
 const sorted=contacts.filter(x=>Number.isFinite(x.timeMs)&&x.timeMs>=startMs&&
  x.timeMs<=startMs+safeWindow&&x.confidence>=.55&&
  (x.foot==='left'||x.foot==='right')).sort((a,b)=>a.timeMs-b.timeMs);
 const times=sorted.map(x=>x.timeMs);
 const intervalsMs=times.slice(1).map((x,i)=>x-times[i]).filter(x=>x>0);
 const positive=[...intervalsMs].sort((a,b)=>a-b);
 const mid=Math.floor(positive.length/2);
 const medianIntervalMs=positive.length?(positive.length%2?positive[mid]:(positive[mid-1]+positive[mid])/2):null;
 const pauses=intervalsMs.filter(x=>x>=2000);
 return {
  count:times.length,cadence:safeWindow>=1000&&times.length>=2?times.length/(safeWindow/60000):null,
  medianIntervalMs,pauseCount:pauses.length,
  pauseDurationMs:pauses.reduce((sum,n)=>sum+n,0),
  left:sorted.filter(x=>x.foot==='left').length,
  right:sorted.filter(x=>x.foot==='right').length,
  intervalsMs
 };
}
export function referenceContacts(ref:RehearsalReference,segment:number,
 performer:ReplayPerformer):TimedContact[]{
 return ref.events.filter(e=>e.segment===segment&&e.performer===performer&&e.kind==='contact')
  .map(e=>({timeMs:e.atMs,foot:e.foot,confidence:e.confidence}));
}
export function liveContacts(events:FootstepEvent[],performer:ReplayPerformer):TimedContact[]{
 return events.filter(e=>e.kind==='contact'&&e.source==='camera'&&
   e.positionBasis==='calibrated-estimate'&&
   (performer==='A'?(e.performerId==='A'||e.performerId==='performer-1'):e.performerId==='B'))
  .map(e=>({timeMs:e.timestampMs,foot:e.foot,confidence:e.confidence}));
}
export function validLiveEvent(event:FootstepEvent,startMs:number,endMs:number,performers:1|2):boolean{
 if(!event||event.source!=='camera'||event.positionBasis!=='calibrated-estimate'||
   !Number.isFinite(event.timestampMs)||event.timestampMs<startMs||event.timestampMs>endMs||
   !['contact','move','release','swing'].includes(event.kind)||
   !Number.isFinite(event.confidence)||event.confidence<.55||
   !Number.isFinite(event.positionM?.xM)||!Number.isFinite(event.positionM?.yM))
  return false;
 if(performers===2)return event.performerId==='A'||event.performerId==='B';
 return event.performerId==='performer-1'||event.performerId==='A';
}
export function comparisonWindow(ref:RehearsalReference|null,segment:number,
 requestMs:number):number{
 if(!ref||!Number.isFinite(requestMs)||requestMs<=0)return 0;
 const span=selectReferenceSegment(ref,segment);
 return span?clamp(Math.min(requestMs,span.durationMs),0,120000):0;
}
export function safeLiveCapture(conditions:{
 cameraOn:boolean;bodySelected:boolean;frameSource:string;
 frameTracked:boolean;frameAgeMs:number;floorConfirmed:boolean;cameraMatched:boolean;
 performerCount:1|2;identityAmbiguous:boolean;visibleIds:string[];frameMatched:boolean;
}):{ready:boolean;reason:string}{
 const c=conditions;
 if(!c.cameraOn||!c.bodySelected)return {ready:false,reason:'Aktifkan kamera Body di Live Stage.'};
 if(!c.floorConfirmed||!c.cameraMatched)return {ready:false,reason:'Konfirmasi kalibrasi kamera–lantai yang cocok.'};
 if(c.frameSource!=='camera'||!c.frameTracked||!Number.isFinite(c.frameAgeMs)||
  c.frameAgeMs<0||c.frameAgeMs>450)return {ready:false,reason:'Frame kamera belum terbaca atau sudah terlambat.'};
 if(c.performerCount===2&&(c.identityAmbiguous||!c.frameMatched||
   !c.visibleIds.includes('A')||!c.visibleIds.includes('B')))
  return {ready:false,reason:'Identitas A/B belum stabil; berdiri terpisah dalam bingkai.'};
 return {ready:true,reason:'Kamera dan lantai siap direkam.'};
}
export function referenceTimeline(events:ReferenceEvent[],originMs:number,
 durationMs:number,performer:ReplayPerformer){
 return events.filter(e=>e.performer===performer&&e.atMs>=originMs&&e.atMs<=originMs+durationMs)
  .map(e=>({atPct:100*(e.atMs-originMs)/durationMs,kind:e.kind,foot:e.foot}));
}
export function liveTimeline(events:FootstepEvent[],originMs:number,durationMs:number,
 performer:ReplayPerformer,performers:1|2){
 return events.filter(e=>validLiveEvent(e,originMs,originMs+durationMs,performers)&&
  (performer==='A'?(e.performerId==='A'||e.performerId==='performer-1'):e.performerId==='B'))
  .map(e=>({atPct:100*(e.timestampMs-originMs)/durationMs,kind:e.kind,foot:e.foot}));
}
export function normalizedLivePath(events:FootstepEvent[],floor:FloorSpace|null,
 performer:ReplayPerformer):Array<{x:number;y:number}>{
 if(!floor||floor.widthM<=0||floor.depthM<=0)return [];
 return events.filter(e=>e.kind==='contact'&&
  (performer==='A'?(e.performerId==='A'||e.performerId==='performer-1'):e.performerId==='B'))
  .map(e=>({x:clamp(e.positionM.xM/floor.widthM,0,1),
   y:clamp(1-e.positionM.yM/floor.depthM,0,1)}));
}
