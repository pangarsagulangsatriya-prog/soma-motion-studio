import type {ReplayPerformance} from './replayPerformance.ts';
import './replay-performance-inspector.css';
const ms=(n:number)=>Number.isFinite(n)?n.toFixed(1)+' ms':'—';
const fps=(n:number)=>n>0?n.toFixed(1)+' FPS':'—';
export function ReplayPerformanceInspector({performance:stats}:{
 performance:ReplayPerformance|null;
}){
 const backend=stats?.backend==='worker'?'Worker':stats?.backend==='main'?'CPU utama':'Memuat';
 return <details className="vml-perf" data-performance-profiler="ready">
  <summary>Performance Profiler <span>{backend} · {fps(stats?.poseFps??0)}</span></summary>
  <div className="vml-perf-body">
   <div className="vml-perf-metrics" aria-label="Pengukuran latency SOMA">
    {[
     {name:'Pose AI',value:ms(stats?.poseMs??0)},
     {name:'Analisis event',value:ms(stats?.analysisMs??0)},
     {name:'Render',value:ms(stats?.renderMs??0)},
     {name:'Total pipeline',value:ms(stats?.pipelineMs??0)},
     {name:'Frame dilewati',value:String(stats?.skippedFrames??0)},
     {name:'Pose aktual',value:fps(stats?.poseFps??0)},
     {name:'Update UI',value:fps(stats?.uiFps??0)}
    ].map(item=><span key={item.name}><small>{item.name}</small><b>{item.value}</b></span>)}
   </div>
   {stats?.backend==='main'&&stats.fallbackReason&&
    <p className="vml-perf-fallback" role="status">
     Alasan Worker tidak aktif: {stats.fallbackReason}
    </p>}
   <small>Pengukuran langsung dari browser perangkat ini. Frame yang terlambat dapat dilewati
    agar video tetap lancar. Inferensi Pose memakai worker bila tersedia; CPU utama
    digunakan sebagai fallback.</small>
  </div>
 </details>;
}
