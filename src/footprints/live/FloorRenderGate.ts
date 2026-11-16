/** Repaint only on contact/ghost/calibration changes, or on a 900 ms
 *  heartbeat to keep the existing Projection Output alive.
 *
 *  This is a browser workload optimization, not a change to measured contact
 *  positions. No "FPS improvement" is claimed without a device benchmark.
 */
export class FloorRenderGate{
 private previousKey:string|null=null;
 private lastPaint=-Infinity;
 readonly heartbeatMs=900;
 shouldPaint(key:string,nowMs:number):boolean{
  if(!Number.isFinite(nowMs)||nowMs<0)throw Error('Waktu paint tidak valid.');
  if(this.previousKey!==key||nowMs<this.lastPaint||nowMs-this.lastPaint>=this.heartbeatMs){
   this.previousKey=key;this.lastPaint=nowMs;return true;
  }
  return false;
 }
 reset(){this.previousKey=null;this.lastPaint=-Infinity;}
}
export function floorPaintKey(revision:number,ghostIds:string[],testPattern:boolean,
 widthM:number,depthM:number,showGhosts:boolean):string{
 if(!Number.isSafeInteger(revision)||revision<0)throw Error('Revisi jejak tidak valid.');
 return JSON.stringify([revision,testPattern,widthM,depthM,showGhosts?ghostIds:[]]);
}
