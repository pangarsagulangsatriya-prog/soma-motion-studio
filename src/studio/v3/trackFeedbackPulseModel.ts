import type {TrackFeedback} from './trackFeedbackModel.ts';

export type TrackFeedbackPulse={
 key:string;
 output:TrackFeedback;
 readySince:number|null;
 lastFrameTime:number|null;
 distinctFrames:number;
};
/** Only confirmed, repeatedly observed frames may present a green "ready" state.
 * Loss of tracking, stale frames, source changes and ambiguous A/B invalidate
 * readiness immediately. No contact or projector permission is inferred.
 */
export const TRACK_READY_SETTLE_MS=320;
const holding=(next:TrackFeedback):TrackFeedback=>({
 ...next,state:'uncertain',label:'Memeriksa kaki',hint:null,visibleFeet:0,
 actors:next.actors.map(actor=>({
  ...actor,state:'unstable' as const,feet:0 as const
 }))
});
export function stepTrackFeedbackPulse(input:{
 previous:TrackFeedbackPulse|null;
 observed:TrackFeedback;
 key:string;
 now:number;
 frameTime:number|null;
 requireNewFrames:boolean;
}):TrackFeedbackPulse{
 const {previous,observed,key,now,frameTime,requireNewFrames}=input;
 const same=previous?.key===key;
 if(observed.state!=='ready'){
  return {key,output:observed,readySince:null,
   lastFrameTime:frameTime,distinctFrames:0};
 }
 if(same&&previous?.output.state==='ready'){
  return {...previous,output:observed,lastFrameTime:frameTime};
 }
 const since=same&&previous?.readySince!==null&&previous?.readySince!==undefined?
  previous.readySince:now;
 const advanced=frameTime!==null&&
  (!same||previous?.lastFrameTime!==frameTime);
 const frames=(same?previous?.distinctFrames??0:0)+Number(advanced);
 const stable=now>=since&&now-since>=TRACK_READY_SETTLE_MS&&
  (!requireNewFrames||frames>=2);
 return {key,output:stable?observed:holding(observed),readySince:since,
  lastFrameTime:frameTime,distinctFrames:frames};
}
export function trackFeedbackSignature(value:TrackFeedback):string{
 return JSON.stringify([value.state,value.label,value.hint,value.visibleFeet,
  value.expectedFeet,value.actors.map(a=>[a.id,a.state,a.feet])]);
}
