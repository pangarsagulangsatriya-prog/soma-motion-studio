/** Watch video arrival independently from AI inference. A missing body is not a broken camera. */
export class CameraLiveness {
 private lastTime=-1;
 private lastArrival:number|null=null;
 sample(videoTime:number,now:number,visible=true):boolean{
  if(!visible){this.lastArrival=null;this.lastTime=videoTime;return false;}
  if(this.lastArrival===null||videoTime!==this.lastTime){
   this.lastArrival=now;this.lastTime=videoTime;return false;
  }
  return now-this.lastArrival>=8000;
 }
}
