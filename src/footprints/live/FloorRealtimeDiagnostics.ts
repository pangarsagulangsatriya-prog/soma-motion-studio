import {percentile} from '../validation/StageValidationRecorder.ts';

export type FloorUpdateKind='events'|'session'|'calibration'|'approval'|'revoke';
export type FloorUpdate={
 kind:FloorUpdateKind;revision:number;emittedAtMs:number;
 /** CameraTracker's video-frame submission timestamp on performance clock.
  * This is NOT exposure time and does NOT include projector light latency. */
 cameraFrameSubmittedAtMs:number|null;
 eventCount:number;contactCount:number;
};
export type FloorRealtimeTimings={
 eventToRasterP50Ms:number|null;eventToRasterP95Ms:number|null;
 frameSubmitToRasterP50Ms:number|null;frameSubmitToRasterP95Ms:number|null;
 inputSamples:number;paintSamples:number;
 note:'Browser frame-submission/raster diagnostics; not physical camera-to-photon latency';
};
type Pending={eventAt:number;cameraAt:number|null};
/** Bounded software-only measurements: stage-clock events never enter this calculation. */
export class FloorRealtimeTimingWindow{
 private queue:Pending[]=[];
 private eventToPaint:number[]=[];
 private frameToPaint:number[]=[];
 private totalInputs=0;
 readonly maxSamples=180;
 private append(v:number[],value:number){
  if(!Number.isFinite(value)||value<0||value>10000)return;
  v.push(value);if(v.length>this.maxSamples)v.shift();
 }
 observe(update:FloorUpdate){
  if(update.kind!=='events'||update.eventCount===0)return;
  this.totalInputs++;
  const at=update.emittedAtMs,camera=update.cameraFrameSubmittedAtMs;
  if(!Number.isFinite(at))return;
  this.queue.push({eventAt:at,cameraAt:camera!==null&&Number.isFinite(camera)&&camera<=at?
   camera:null});
  if(this.queue.length>this.maxSamples)this.queue.shift();
 }
 painted(atMs:number){
  if(!Number.isFinite(atMs))return;
  const pending=this.queue;this.queue=[];
  for(const v of pending){
   this.append(this.eventToPaint,atMs-v.eventAt);
   if(v.cameraAt!==null)this.append(this.frameToPaint,atMs-v.cameraAt);
  }
 }
 dropPending(){this.queue=[];}
 clear(){this.dropPending();this.eventToPaint=[];this.frameToPaint=[];this.totalInputs=0;}
 get metrics():FloorRealtimeTimings{
  return {eventToRasterP50Ms:percentile(this.eventToPaint,50),
   eventToRasterP95Ms:percentile(this.eventToPaint,95),
   frameSubmitToRasterP50Ms:percentile(this.frameToPaint,50),
   frameSubmitToRasterP95Ms:percentile(this.frameToPaint,95),
   inputSamples:this.totalInputs,paintSamples:this.eventToPaint.length,
   note:'Browser frame-submission/raster diagnostics; not physical camera-to-photon latency'};
 }
}
