import {insideFloor,type FloorPoint,type FloorSpace} from '../spatial/coordinates.ts';
import type {FootstepEvent} from '../spatial/events.ts';

export type MeasuredContact={
 id:string;eventId:string;performerId:string;foot:'left'|'right';
 estimatedM:FloorPoint;referenceM:FloorPoint;errorCm:number;
 recordedAt:string;method:'tape-marker';note:string;
};
export type PhysicalLatency={
 id:string;recordedAt:string;method:'single-shot-high-speed-video';
 frameDifference:number;videoFps:number;latencyMs:number;note:string;
};
export type StageObservation={
 id:string;recordedAt:string;
 kind:'missed-contact'|'false-contact'|'identity-mismatch'|'occlusion'|'other';
 performerId:string;note:string;
};
export type StageValidationReport={
 schema:'soma.footprints.stage-validation';version:1;
 recordedAt:string;floor:FloorSpace;contactSamples:MeasuredContact[];
 physicalLatencySamples:PhysicalLatency[];observations:StageObservation[];
 context:{cameraSetup:string;projectorSetup:string;lighting:string;remarks:string};
 summary:ReturnType<typeof stageValidationSummary>;
 caveat:string;
};
export function percentile(input:number[],p:number):number|null{
 if(!input.length||!Number.isFinite(p)||p<0||p>100)return null;
 const values=input.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!values.length)return null;
 const index=(values.length-1)*p/100,lo=Math.floor(index),hi=Math.ceil(index);
 return values[lo]+(values[hi]-values[lo])*(index-lo);
}
const round=(v:number)=>Math.round(v*100)/100;
export function stageValidationSummary(contacts:MeasuredContact[],latencies:PhysicalLatency[],observations:StageObservation[]){
 const errors=contacts.map(x=>x.errorCm),timings=latencies.map(x=>x.latencyMs);
 const mean=(xs:number[])=>xs.length?round(xs.reduce((a,b)=>a+b,0)/xs.length):null;
 return {
  matchedContacts:contacts.length,
  errorCm:{mean:mean(errors),median:percentile(errors,50),p95:percentile(errors,95),
   maximum:errors.length?round(Math.max(...errors)):null,
   rmse:errors.length?round(Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length)):null},
  physicalLatencyMs:{samples:latencies.length,median:percentile(timings,50),p95:percentile(timings,95)},
  observations:Object.fromEntries((['missed-contact','false-contact','identity-mismatch','occlusion','other'] as const)
   .map(k=>[k,observations.filter(x=>x.kind===k).length])),
 };
}
const limitNote=(value:string,max:number)=>value.trim().slice(0,max);
/**
 * Only the operator can create physical ground-truth samples. No frame or
 * calibration test is silently treated as a measured floor error.
 */
export class StageValidationRecorder{
 readonly contacts:MeasuredContact[]=[];
 readonly latency:PhysicalLatency[]=[];
 readonly observations:StageObservation[]=[];
 private serial=0;
 readonly floor:FloorSpace;
 constructor(floor:FloorSpace){this.floor=floor;}
 addContact(event:FootstepEvent,referenceM:FloorPoint,note=''):MeasuredContact{
  if(event.kind!=='contact'||event.source!=='camera'||event.positionBasis!=='calibrated-estimate')
   throw Error('Pilih event kontak kamera, bukan langkah simulasi atau bayangan prediksi.');
  if(!insideFloor(this.floor,event.positionM)||!insideFloor(this.floor,referenceM))
   throw Error('Posisi acuan harus berada dalam ukuran lantai yang dikalibrasi.');
  if(this.contacts.some(x=>x.eventId===event.id))throw Error('Event ini sudah mempunyai pasangan titik ukur.');
  if(this.contacts.length>=2000)throw Error('Batas 2.000 sampel pengukuran tercapai.');
  const errorCm=round(Math.hypot(referenceM.xM-event.positionM.xM,referenceM.yM-event.positionM.yM)*100);
  const row={id:'validation-'+(++this.serial),eventId:event.id,performerId:event.performerId,foot:event.foot,
   estimatedM:{...event.positionM},referenceM:{...referenceM},errorCm,
   recordedAt:new Date().toISOString(),method:'tape-marker' as const,note:limitNote(note,240)};
  this.contacts.push(row);return row;
 }
 addPhysicalLatency(frameDifference:number,videoFps:number,note=''):PhysicalLatency{
  if(!Number.isInteger(frameDifference)||frameDifference<0||frameDifference>2000||
   !Number.isFinite(videoFps)||videoFps<24||videoFps>2000)
   throw Error('Isi selisih frame dan FPS video eksternal yang valid.');
  if(this.latency.length>=1000)throw Error('Batas 1.000 pengukuran latensi tercapai.');
  const row={id:'latency-'+(++this.serial),recordedAt:new Date().toISOString(),
   method:'single-shot-high-speed-video' as const,frameDifference,videoFps,
   latencyMs:round(frameDifference/videoFps*1000),note:limitNote(note,240)};
  this.latency.push(row);return row;
 }
 addObservation(kind:StageObservation['kind'],performerId:string,note:string):StageObservation{
  if(!['missed-contact','false-contact','identity-mismatch','occlusion','other'].includes(kind))
   throw Error('Jenis temuan panggung tidak valid.');
  if(!note.trim())throw Error('Isi kejadian yang terlihat di panggung.');
  if(this.observations.length>=1000)throw Error('Batas 1.000 temuan tercapai.');
  const row={id:'observation-'+(++this.serial),recordedAt:new Date().toISOString(),
   kind,performerId:limitNote(performerId,64),note:limitNote(note,400)};
  this.observations.push(row);return row;
 }
 get summary(){return stageValidationSummary(this.contacts,this.latency,this.observations);}
 report(context:StageValidationReport['context']):StageValidationReport{
  return {schema:'soma.footprints.stage-validation',version:1,recordedAt:new Date().toISOString(),
   floor:this.floor,contactSamples:this.contacts.map(x=>({...x})),
   physicalLatencySamples:this.latency.map(x=>({...x})),
   observations:this.observations.map(x=>({...x})),
   context:{cameraSetup:limitNote(context.cameraSetup,200),projectorSetup:limitNote(context.projectorSetup,200),
    lighting:limitNote(context.lighting,200),remarks:limitNote(context.remarks,500)},
   summary:this.summary,
   caveat:'Hasil ini mengandalkan titik acuan dan video yang diukur operator. Telemetri browser tidak mengukur gerak-ke-cahaya proyektor. Tanpa sampel fisik, nilai statistik tetap kosong.'};
 }
 clear(){this.contacts.length=0;this.latency.length=0;this.observations.length=0;this.serial=0;}
}
export type SoftwareMetrics={
 fps:number|null;renderMedianMs:number|null;renderP95Ms:number|null;
 inferenceMedianMs:number|null;inferenceP95Ms:number|null;
 pipelineMedianMs:number|null;pipelineP95Ms:number|null;
 outputFps:number|null;outputP95Ms:number|null;outputConnected:boolean;
 note:'Software/browser metrics, not camera-to-photon latency';
};
export class SoftwarePerformanceWindow{
 private render:number[]=[];private interval:number[]=[];private infer:number[]=[];private pipeline:number[]=[];
 private lastTick:number|null=null;private lastFrameKey:number|null=null;
 private push(dst:number[],v:number){
  if(!Number.isFinite(v)||v<0)return;dst.push(v);
  if(dst.length>180)dst.shift();
 }
 observePaint(startMs:number,endMs:number){
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<startMs)return;
  this.push(this.render,endMs-startMs);
  if(this.lastTick!==null&&startMs>this.lastTick)this.push(this.interval,startMs-this.lastTick);
  this.lastTick=startMs;
 }
 observeCamera(frame:{completedAt:number;inferenceMs:number;pipelineMs:number}|null){
  if(!frame||!Number.isFinite(frame.completedAt)||this.lastFrameKey===frame.completedAt)return;
  this.lastFrameKey=frame.completedAt;
  this.push(this.infer,frame.inferenceMs);this.push(this.pipeline,frame.pipelineMs);
 }
 metrics(output:{fps:number;p95Ms:number}|null):SoftwareMetrics{
  return {fps:this.interval.length?Math.round(10000/((this.interval.reduce((a,b)=>a+b,0)/this.interval.length)||1))/10:null,
   renderMedianMs:percentile(this.render,50),renderP95Ms:percentile(this.render,95),
   inferenceMedianMs:percentile(this.infer,50),inferenceP95Ms:percentile(this.infer,95),
   pipelineMedianMs:percentile(this.pipeline,50),pipelineP95Ms:percentile(this.pipeline,95),
   outputFps:output?.fps??null,outputP95Ms:output?.p95Ms??null,outputConnected:!!output,
   note:'Software/browser metrics, not camera-to-photon latency'};
 }
}
