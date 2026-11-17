/** Video playback clock always wins over delayed AI inference. */
export function replayResultTooLate(analyzedAtMs:number,videoAtMs:number,maxDelayMs=320){
 if(!Number.isFinite(analyzedAtMs)||!Number.isFinite(videoAtMs))return true;
 return videoAtMs-analyzedAtMs>maxDelayMs||analyzedAtMs-videoAtMs>160;
}
/** CPU fallback samples less often; decoded video continues at source cadence. */
export function replayPoseCapFPS(requested:number,backend:'worker'|'main'|'pending',poseMs:number){
 const fps=Math.max(1,Math.min(30,Number.isFinite(requested)?requested:18));
 if(backend!=='main')return fps;
 return Math.min(fps,poseMs>70?8:poseMs>42?12:15);
}
