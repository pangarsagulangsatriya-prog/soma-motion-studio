import {useEffect,useRef,useState,type RefObject} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {ReplayAnalysisSnapshot} from '../../stage/VideoPoseGaitEngine.ts';
import type {FootprintsInputChoice,FootprintsInputPhase} from './sourceSwitchModel.ts';
import {deriveTrackFeedback,type TrackFeedback} from './trackFeedbackModel.ts';
import {stepTrackFeedbackPulse,trackFeedbackSignature,
 type TrackFeedbackPulse} from './trackFeedbackPulseModel.ts';

type Input={
 selection:FootprintsInputChoice|null;phase:FootprintsInputPhase;
 cameraOn:boolean;bodySelected:boolean;frameFresh:boolean;
 performerCount:1|2;frameRef:RefObject<MotionFrame>;
 router:MultiPoseGaitRouter;
 videoSnapshot:ReplayAnalysisSnapshot|null;videoReady:boolean;
 active:boolean;
};
// Track feedback lives on a low-frequency presentation loop. The video and
// projector rendering loops are independent; UI feedback cannot approve output.
export function useTrackFeedbackPulse(input:Input):TrackFeedback{
 const {selection,phase,cameraOn,bodySelected,frameFresh,performerCount,
  frameRef,router,videoSnapshot,videoReady,active}=input;
 const key=[selection??'none',phase,performerCount,
  // MP4 replay snapshots change after uploads/seeks; never retain stale ready.
  selection==='video'?String(videoSnapshot?.atMs??'none'):'live'].join('|');
 const sample=()=>{
  const now=performance.now();
  const frame=frameRef.current;
  const live=selection==='webcam'||selection==='phone';
  const validFrame=live&&cameraOn&&bodySelected&&frameFresh&&
   frame.source==='camera'&&frame.time>0&&now>=frame.time&&now-frame.time<450;
  return deriveTrackFeedback({
   selection,phase,cameraOn,frameFresh:live?validFrame:frameFresh,
   performerCount,liveFrame:validFrame?frame:null,
   liveIdentity:live?router.status:null,
   videoSnapshot,videoReady
  });
 };
 const pulseRef=useRef<TrackFeedbackPulse|null>(null);
 const [shown,setShown]=useState<TrackFeedback>(()=>sample());
 const keyRef=useRef(key);
 // A source switch must invalidate old labels even before the first timer tick.
 const displayed=keyRef.current===key?shown:
  deriveTrackFeedback({
   selection,phase,cameraOn,frameFresh:false,performerCount,
   liveFrame:null,liveIdentity:null,videoSnapshot:null,videoReady:false
  });
 useEffect(()=>{
  keyRef.current=key;
  pulseRef.current=null;
  const tick=()=>{
   const raw=sample();
   const live=selection==='webcam'||selection==='phone';
   const frameTime=live?frameRef.current.time:
    selection==='video'?videoSnapshot?.atMs??null:null;
   const next=stepTrackFeedbackPulse({
    previous:pulseRef.current,observed:raw,key,
    now:performance.now(),frameTime,requireNewFrames:live
   });
   pulseRef.current=next;
   setShown(prev=>trackFeedbackSignature(prev)===trackFeedbackSignature(next.output)?
    prev:next.output);
  };
  tick();
  if(!active)return;
  const interval=window.setInterval(tick,160);
  return()=>window.clearInterval(interval);
 // The refs provide current frame and identity values; tick samples fresh data.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,active,cameraOn,bodySelected,frameFresh,frameRef,router,
  videoSnapshot,videoReady]);
 return displayed;
}
