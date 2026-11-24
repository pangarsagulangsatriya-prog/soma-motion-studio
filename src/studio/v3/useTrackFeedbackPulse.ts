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
 videoSnapshot:ReplayAnalysisSnapshot|null;videoReady:boolean;videoClip:File|null;
 active:boolean;
};
// Track feedback lives on a low-frequency presentation loop. The video and
// projector rendering loops are independent; UI feedback cannot approve output.
export function useTrackFeedbackPulse(input:Input):TrackFeedback{
 const {selection,phase,cameraOn,bodySelected,frameFresh,performerCount,
  frameRef,router,videoSnapshot,videoReady,videoClip,active}=input;
 const key=[selection??'none',phase,performerCount,
  // Preserve identity while playing; reset when a different file or readiness epoch arrives.
  selection==='video'?
   [videoClip?.name??'none',videoClip?.size??0,videoClip?.lastModified??0,
    videoReady?'decoded':'unready'].join(':'):'live'].join('|');
 const sample=()=>{
  const now=performance.now();
  const frame=frameRef.current;
  const live=selection==='webcam'||selection==='phone';
  const validFrame=live&&cameraOn&&bodySelected&&frameFresh&&
   frame.source==='camera'&&frame.time>0&&now>=frame.time&&now-frame.time<450;
  return deriveTrackFeedback({
   selection,phase,cameraOn,frameFresh:live?validFrame:frameFresh,
   performerCount,liveFrame:validFrame?frame:null,
   liveIdentity:live?router.previewStatus:null,
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
  // Replayed MP4 snapshots can arrive on every analyzed frame; keep the
  // readiness accumulator as long as the source/clip epoch is unchanged.
  if(pulseRef.current?.key!==key)pulseRef.current=null;
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
