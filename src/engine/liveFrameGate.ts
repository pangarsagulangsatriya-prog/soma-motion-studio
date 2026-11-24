/** One camera timeline. Never publish a late inference after an empty frame
 * or a newer result, and never let a backlog present old motion as live. */
export class LiveFrameGate {
 private lastPublished=-Infinity;
 constructor(readonly maxAgeMs=350){}
 accept(capturedAt:number,now:number):boolean{
  if(!Number.isFinite(capturedAt)||!Number.isFinite(now)||capturedAt<=this.lastPublished||
   capturedAt<0||now<capturedAt||now-capturedAt>this.maxAgeMs)return false;
  this.lastPublished=capturedAt;return true;
 }
 invalidate(now:number):void{
  if(Number.isFinite(now))this.lastPublished=Math.max(this.lastPublished,now);
 }
}
/** Adaptive pacing uses measured pipeline cost, not render FPS. */
export function nextInferenceInterval(pipelineMs:number,worker:boolean):number{
 if(!Number.isFinite(pipelineMs)||pipelineMs<0)return 33;
 return Math.max(33,Math.min(150,pipelineMs*(worker?1.05:1.25)));
}
