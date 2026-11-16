/** Parent-tab postMessage → output-window acknowledgement diagnostic.
 * An ACK confirms the bitmap reached the output canvas handling code.
 * It is NOT the time that the physical projector emitted light.
 */
export class ArtworkTransferWindow{
 private pending=new Map<number,number>();
 private samples:number[]=[];
 readonly maxSamples=180;
 markSent(sequence:number,atMs:number){
  if(!Number.isSafeInteger(sequence)||sequence<0||!Number.isFinite(atMs))return;
  this.pending.set(sequence,atMs);
  if(this.pending.size>8){
   const oldest=this.pending.keys().next().value;
   if(oldest!==undefined)this.pending.delete(oldest);
  }
 }
 markAck(sequence:number,atMs:number){
  const start=this.pending.get(sequence);
  if(start===undefined)return;
  this.pending.delete(sequence);
  const delta=atMs-start;
  if(!Number.isFinite(delta)||delta<0||delta>10000)return;
  this.samples.push(delta);
  if(this.samples.length>this.maxSamples)this.samples.shift();
 }
 markFailed(sequence:number){this.pending.delete(sequence);}
 reset(){this.pending.clear();this.samples=[];}
 get metrics(){
  const values=[...this.samples].sort((a,b)=>a-b);
  const percentile=(p:number)=>{
   if(!values.length)return null;
   const index=(values.length-1)*p/100;
   const lo=Math.floor(index),hi=Math.ceil(index);
   return values[lo]+(values[hi]-values[lo])*(index-lo);
  };
  return {bitmapAckMedianMs:percentile(50),bitmapAckP95Ms:percentile(95),
   samples:values.length,note:'Output-window bitmap acknowledgement; NOT projector-photon latency' as const};
 }
}
