import type {GaitSample,GaitMotion,GaitPhase} from '../footprints/gait-analysis/index.ts';
export type ReplayPerformer='A'|'B';
export type ReplayFoot='left'|'right';
export type ReplayEventKind='swing'|'contact'|'slide'|'pivot';
export type ReplayGaitEvent={
 id:string;atMs:number;performer:ReplayPerformer;foot:ReplayFoot;
 kind:ReplayEventKind;confidence:number;x:number;y:number;headingRad:number;
 basis:'video-2d-estimate';
};
export type ReplayGaitState={phase:GaitPhase;motion:GaitMotion;confidence:number};
export const emptyReplayState=():ReplayGaitState=>({phase:'unknown',motion:'unknown',confidence:0});
export function replayEventsForSample(sample:GaitSample,previous:ReplayGaitState,
 performer:ReplayPerformer,foot:ReplayFoot,segment:number):ReplayGaitEvent[]{
 const kinds:ReplayEventKind[]=[];
 if(sample.confidence<.55||!Number.isFinite(sample.t))return [];
 if(sample.stamp)kinds.push('contact');
 if(sample.phase==='swing'&&previous.phase!=='swing')kinds.push('swing');
 if(sample.motionKind==='slide'&&previous.motion!=='slide')kinds.push('slide');
 if(sample.motionKind==='pivot'&&previous.motion!=='pivot')kinds.push('pivot');
 return kinds.map(kind=>({
  id:'video:'+segment+':'+performer+':'+foot+':'+Math.round(sample.t)+':'+kind,
  atMs:Math.max(0,Math.round(sample.t)),performer,foot,kind,
  confidence:Math.max(0,Math.min(1,sample.confidence)),
  x:sample.x,y:sample.y,headingRad:sample.heading,
  basis:'video-2d-estimate' as const
 }));
}
/** Seek, loop and abrupt codec drops invalidate temporal gait continuity. */
export function replayDiscontinuity(previousMs:number,nextMs:number,maxGapMs=350){
 return previousMs>=0&&(!Number.isFinite(nextMs)||nextMs<previousMs-4||nextMs-previousMs>maxGapMs);
}
export function replayEventCounts(events:ReplayGaitEvent[]){
 const result={contact:0,swing:0,slide:0,pivot:0};
 for(const event of events)result[event.kind]++;
 return result;
}
