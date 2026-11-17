/**
 * Schedule work from actual decoded video frames. The video clock remains
 * autonomous: slow AI jobs can be dropped and never form a replay backlog.
 * When requestVideoFrameCallback is unsupported, use requestAnimationFrame.
 */
export function subscribeReplayFrames(
 video:HTMLVideoElement,
 onFrame:(mediaTime:number,presentedFrames:number|null)=>void
):()=>void{
 let active=true,handle=0;
 const hasFrameCallback=typeof video.requestVideoFrameCallback==='function';
 const tick=(_now:number,meta?:VideoFrameCallbackMetadata)=>{
  if(!active)return;
  if(!video.paused&&!video.seeking&&video.readyState>=2){
   onFrame(meta?.mediaTime??video.currentTime,meta?.presentedFrames??null);
  }
  if(!active)return;
  if(hasFrameCallback)handle=video.requestVideoFrameCallback(tick);
  else handle=requestAnimationFrame(tick);
 };
 if(hasFrameCallback)handle=video.requestVideoFrameCallback(tick);
 else handle=requestAnimationFrame(tick);
 return ()=>{
  active=false;
  if(hasFrameCallback)video.cancelVideoFrameCallback(handle);
  else cancelAnimationFrame(handle);
 };
}
