import type {DuetV2Frame} from './duetV2Worker.ts';

export type DuetV2Benchmark={
 resolution:384|512;frames:number;twoDetected:number;
 twoTracked:number;twoPose33:number;uncertainFrames:number;
 detectorP50Ms:number;detectorP95Ms:number;
 crop33P50Ms:number;totalP95Ms:number;
 trace:Array<{
  index:number;timeMs:number;detected:number;tracked:number;pose33:number;
  uncertain:boolean;detectorMs:number;crop33Ms:number;totalMs:number;
  boxes:DuetV2Frame['people'];actorStates:DuetV2Frame['identity']['actors'];
 }>;
};
const percentile=(values:number[],pct:number)=>{
 if(!values.length)return 0;
 const sorted=[...values].sort((a,b)=>a-b);
 return sorted[Math.max(0,Math.min(sorted.length-1,Math.ceil(pct*sorted.length)-1))];
};
export function summarizeDuetBenchmark(resolution:384|512,
 frames:readonly DuetV2Frame[]):DuetV2Benchmark{
 const samples=frames.map((frame,index)=>({
  index,timeMs:frame.timeMs,detected:frame.identity.detectedCount,
  tracked:frame.identity.observedCount,pose33:frame.details.length,
  uncertain:frame.identity.ambiguous,
  detectorMs:frame.timings.detectorMs,crop33Ms:frame.timings.crop33Ms,
  totalMs:frame.timings.totalMs,boxes:frame.people,actorStates:frame.identity.actors
 }));
 return {resolution,frames:frames.length,
  twoDetected:samples.filter(s=>s.detected>=2).length,
  twoTracked:samples.filter(s=>s.tracked>=2).length,
  twoPose33:samples.filter(s=>s.pose33>=2).length,
  uncertainFrames:samples.filter(s=>s.uncertain).length,
  detectorP50Ms:percentile(samples.map(s=>s.detectorMs),.5),
  detectorP95Ms:percentile(samples.map(s=>s.detectorMs),.95),
  crop33P50Ms:percentile(samples.map(s=>s.crop33Ms),.5),
  totalP95Ms:percentile(samples.map(s=>s.totalMs),.95),
  trace:samples
 };
}
export function chooseDuetResolution(results:DuetV2Benchmark[]):{
 resolution:384|512|null;reason:string
}{
 const a=results.find(r=>r.resolution===384);
 const b=results.find(r=>r.resolution===512);
 if(!a||!b||a.frames!==b.frames||!a.frames)
  return {resolution:null,reason:'Kedua ukuran belum diuji pada jumlah frame yang sama.'};
 const difference=(b.twoDetected-a.twoDetected)/a.frames;
 if(difference>=.06&&b.detectorP95Ms<=450)
  return {resolution:512,reason:'512 mendeteksi sedikitnya 6% lebih banyak frame berisi dua tubuh; latency masih masuk batas eksperimen.'};
 if(a.twoDetected/a.frames>=.95)
  return {resolution:384,reason:'384 telah mencapai cakupan target pada video uji; pilih biaya lebih rendah.'};
 const winner=b.twoDetected>a.twoDetected?b:a;
 return {resolution:winner.resolution,reason:'Cakupan dua tubuh masih di bawah target: gunakan opsi dengan deteksi tertinggi untuk investigasi lanjut, belum layak produksi.'};
}
export function duetBenchmarkCsv(results:DuetV2Benchmark[]){
 const header='resolution,frame,time_ms,detected,tracked,pose33,uncertain,detector_ms,crop33_ms,total_ms';
 return [header,...results.flatMap(result=>result.trace.map(frame=>[
  result.resolution,frame.index,frame.timeMs,frame.detected,frame.tracked,
  frame.pose33,frame.uncertain,frame.detectorMs,frame.crop33Ms,frame.totalMs
 ].join(',')))].join('\n')+'\n';
}
