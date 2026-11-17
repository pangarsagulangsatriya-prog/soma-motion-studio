import type {ReplayAnalysisSnapshot} from './VideoPoseGaitEngine.ts';
import type {ReplayIdentityQA} from './videoReplayIdentityQA.ts';
import type {ReplayGaitEvent} from './videoGaitAnalysis.ts';
import {replayEventCounts} from './videoGaitAnalysis.ts';

export type ReplayArchiveSegment={
 segment:number;firstAtMs:number|null;lastAtMs:number|null;sampledFrames:number;
 endReason:string;events:ReplayGaitEvent[];identityQA:ReplayIdentityQA;
};
export type ReplayExportInput={
 file:{name:string;bytes:number;mime:string;lastModified:number};
 video:{durationSeconds:number;width:number;height:number};
 snapshot:ReplayAnalysisSnapshot;archives:ReplayArchiveSegment[];
 requestedAt:string;
};
const validTime=(value:number)=>Number.isFinite(value)&&value>=0?Math.round(value):0;
export function buildReplayEventExport(input:ReplayExportInput){
 const {file,video,snapshot,archives,requestedAt}=input;
 const current:ReplayArchiveSegment={
  segment:snapshot.segment,firstAtMs:snapshot.sampledFrames>0?
   Math.max(0,snapshot.atMs):null,
  lastAtMs:snapshot.sampledFrames>0?Math.max(0,snapshot.atMs):null,
  sampledFrames:snapshot.sampledFrames,endReason:'current-active-segment',
  events:snapshot.events.map(e=>({...e})),
  identityQA:snapshot.qa??{
   state:'waiting',reason:'Belum ada pemeriksaan QA.',
   streak:0,requiredFrames:3,visible:[],confidence:0,separation:null,
   droppedFrames:0,ambiguousFrames:0,stableFrames:0,
   resetCount:0,lastResetReason:'Unknown',lastResetAtMs:null
  }
 };
 const segments=[...archives,current].sort((a,b)=>a.segment-b.segment);
 const events=segments.flatMap(s=>s.events.map(e=>({
  segment:s.segment,kind:e.kind,id:e.id,atMs:validTime(e.atMs),
  performer:e.performer,foot:e.foot,confidence:e.confidence,
  x:e.x,y:e.y,headingRad:e.headingRad,
  coordinateBasis:e.basis,endReason:s.endReason
 }))).sort((a,b)=>a.segment-b.segment||a.atMs-b.atMs||a.id.localeCompare(b.id));
 const unique=new Set<string>();const cleaned=events.filter(e=>{
  const key=e.segment+':'+e.id;if(unique.has(key))return false;unique.add(key);return true;
 });
 return {
  schema:'soma.video-replay-qa',version:1 as const,
  exportedAt:requestedAt,
  source:{kind:'local-video',filename:file.name,bytes:file.bytes,mime:file.mime,
   lastModified:file.lastModified,durationSeconds:video.durationSeconds,
   dimensionsPx:{width:video.width,height:video.height}},
  flags:{coordinateBasis:'video-2d-estimate',physicalFloorCalibrated:false,
   physicalProjectionAuthorized:false,fullFrameCoverageGuaranteed:false,
   identityAmbiguityMaySuppressEvents:true},
  summary:{segments:segments.length,sampledFrames:segments.reduce((s,x)=>s+x.sampledFrames,0),
   events:cleaned.length,counts:replayEventCounts(cleaned.map(e=>({
    ...e,basis:'video-2d-estimate' as const
   })))},
  segments:segments.map(s=>({
   segment:s.segment,firstAtMs:s.firstAtMs,lastAtMs:s.lastAtMs,
   sampledFrames:s.sampledFrames,eventCount:s.events.length,endReason:s.endReason,
   identityQA:s.identityQA
  })),
  events:cleaned,
  note:'Visual 2D estimates; no ground-reaction force, foot pressure, true metric floor position, or guaranteed frame-complete coverage. Separate segments are never joined through seeks, loops, or reset.'
 };
}
const quoted=(value:string)=>'"'+value.replace(/"/g,'""')+'"';
export function replayEventsCsv(report:ReturnType<typeof buildReplayEventExport>):string{
 const headings=['segment','event_id','video_time_ms','video_time_s','performer','foot',
  'event_kind','confidence','image_x','image_y','heading_rad','coordinate_basis','segment_end_reason'];
 const rows=report.events.map(e=>[
  e.segment,e.id,e.atMs,(e.atMs/1000).toFixed(3),e.performer,e.foot,e.kind,
  e.confidence.toFixed(4),e.x.toFixed(6),e.y.toFixed(6),
  e.headingRad.toFixed(6),e.coordinateBasis,e.endReason
 ].map(v=>quoted(String(v))).join(','));
 return [headings.join(','),...rows].join('\r\n')+'\r\n';
}
