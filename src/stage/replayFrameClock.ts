/** Decode callbacks are preferred, with a watchdog for hidden/non-composited video.
 * Both clocks share a cursor; paused frames and duplicate callbacks never enqueue work. */
export function subscribeReplayFrames(
 video:HTMLVideoElement,
 onFrame:(mediaTime:number,presentedFrames:number|null)=>void
):()=>void{
 let active=true,frameHandle=0,rafHandle=0,lastTime=-1,lastDecodedAt=-Infinity;
 const hasFrameCallback=typeof video.requestVideoFrameCallback==='function';
 const emit=(mediaTime:number,presentedFrames:number|null)=>{
  if(!active||video.paused||video.seeking||video.readyState<2||
   !Number.isFinite(mediaTime)||Math.abs(mediaTime-lastTime)<.001)return;
  lastTime=mediaTime;onFrame(mediaTime,presentedFrames);
 };
 const decoded=(now:number,meta:VideoFrameCallbackMetadata)=>{
  if(!active)return;
  lastDecodedAt=now;
  emit(meta.mediaTime,meta.presentedFrames);
  if(active)frameHandle=video.requestVideoFrameCallback(decoded);
 };
 const watchdog=(now:number)=>{
  if(!active)return;
  // display:none and workspace transitions can suppress compositor callbacks
  // while currentTime keeps advancing. One inference is still the engine's limit.
  if(!hasFrameCallback||now-lastDecodedAt>250)emit(video.currentTime,null);
  if(active)rafHandle=requestAnimationFrame(watchdog);
 };
 if(hasFrameCallback)frameHandle=video.requestVideoFrameCallback(decoded);
 rafHandle=requestAnimationFrame(watchdog);
 return()=>{
  active=false;
  if(hasFrameCallback)video.cancelVideoFrameCallback(frameHandle);
  cancelAnimationFrame(rafHandle);
 };
}
