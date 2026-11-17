export type InferenceBackend='worker'|'main'|'pending';
export type HandDetailMode='adaptive'|'detail'|'off';
export type ReplayPerformance={
 backend:InferenceBackend;fallbackReason?:string;poseMs:number;handsMs:number;analysisMs:number;
 renderMs:number;pipelineMs:number;skippedFrames:number;processedFrames:number;
 presentedFrames:number;poseFps:number;handFps:number;uiFps:number;
 handIntervalMs:number;lastFrameAtMs:number;
};
const lerp=(old:number,sample:number)=>old<=0?sample:old*.73+sample*.27;
const sane=(value:number)=>Number.isFinite(value)&&value>=0?value:0;
export class ReplayPerformanceMeter{
 private data:ReplayPerformance={
  backend:'pending',poseMs:0,handsMs:0,analysisMs:0,renderMs:0,pipelineMs:0,
  skippedFrames:0,processedFrames:0,presentedFrames:0,poseFps:0,
  handFps:0,uiFps:0,handIntervalMs:0,lastFrameAtMs:0
 };
 private lastPoseAt=-1;private lastHandsAt=-1;private lastUiAt=-1;
 reset(){
  const {backend,fallbackReason}=this.data;
  this.data={backend,fallbackReason,poseMs:0,handsMs:0,
   analysisMs:0,renderMs:0,pipelineMs:0,skippedFrames:0,processedFrames:0,
   presentedFrames:0,poseFps:0,handFps:0,uiFps:0,handIntervalMs:0,lastFrameAtMs:0};
  this.lastPoseAt=-1;this.lastHandsAt=-1;this.lastUiAt=-1;
 }
 setBackend(backend:InferenceBackend,reason?:string){
  this.data.backend=backend;
  // Never silently bury the reason the faster worker backend is unavailable.
  this.data.fallbackReason=backend==='worker'?undefined:reason??this.data.fallbackReason;
 }
 get snapshot():ReplayPerformance{return {...this.data};}
 observePresented(frame:number){
  if(!Number.isFinite(frame)||frame<0)return;
  const old=this.data.presentedFrames;
  if(old>0&&frame>old)this.data.skippedFrames+=Math.max(0,frame-old-1);
  if(frame>old)this.data.presentedFrames=frame;
 }
 observeBusy(){this.data.skippedFrames++;}
 observeInference(nowMs:number,poseMs:number,handsMs:number,
  processingMs:number,pipelineMs:number,didHands:boolean,intervalMs:number){
  const d=this.data;d.poseMs=lerp(d.poseMs,sane(poseMs));
  if(didHands)d.handsMs=lerp(d.handsMs,sane(handsMs));
  d.analysisMs=lerp(d.analysisMs,sane(processingMs));
  d.pipelineMs=lerp(d.pipelineMs,sane(pipelineMs));
  d.processedFrames++;d.lastFrameAtMs=nowMs;d.handIntervalMs=intervalMs;
  if(this.lastPoseAt>=0&&nowMs>this.lastPoseAt)
   d.poseFps=lerp(d.poseFps,1000/(nowMs-this.lastPoseAt));
  this.lastPoseAt=nowMs;
  if(didHands){
   if(this.lastHandsAt>=0&&nowMs>this.lastHandsAt)
    d.handFps=lerp(d.handFps,1000/(nowMs-this.lastHandsAt));
   this.lastHandsAt=nowMs;
  }
 }
 observeRender(ms:number){this.data.renderMs=lerp(this.data.renderMs,sane(ms));}
 observeUi(nowMs:number){
  if(this.lastUiAt>=0&&nowMs>this.lastUiAt)
   this.data.uiFps=lerp(this.data.uiFps,1000/(nowMs-this.lastUiAt));
  this.lastUiAt=nowMs;
 }
}
export class AdaptiveHandScheduler{
 private lastScanMs=-Infinity;
 mode:HandDetailMode='adaptive';
 reset(){this.lastScanMs=-Infinity;}
 setMode(mode:HandDetailMode){this.mode=mode;this.reset();}
 choose(atMs:number,wristSpeed:number,poseCostMs:number){
  if(this.mode==='off')return {run:false,intervalMs:0};
  const intense=this.mode==='detail'||wristSpeed>.12;
  // Balanced at ~3–4 Hz, bursts up to ~7 Hz. Back off on expensive CPU.
  const base=intense?145:320;
  const intervalMs=poseCostMs>65?Math.round(base*1.75):
   poseCostMs>38?Math.round(base*1.35):base;
  if(!Number.isFinite(atMs)||atMs-this.lastScanMs<intervalMs)
   return {run:false,intervalMs};
  this.lastScanMs=atMs;
  return {run:true,intervalMs};
 }
}
export function adaptivePoseSmoothingAlpha(dtSeconds:number,rawSpeed:number){
 if(!Number.isFinite(dtSeconds)||dtSeconds<=0)return 1;
 // Stable joints get a longer smoothing window; fast joints respond quickly.
 const speed=Math.max(0,Number.isFinite(rawSpeed)?rawSpeed:0);
 const tauMs=42+128/(1+speed*13);
 return Math.max(0,Math.min(1,1-Math.exp(-dtSeconds*1000/tauMs)));
}
