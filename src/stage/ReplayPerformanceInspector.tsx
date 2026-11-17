import type {ReplayPerformance,HandDetailMode} from './replayPerformance.ts';
import './replay-performance-inspector.css';
const ms=(n:number)=>Number.isFinite(n)?n.toFixed(1)+' ms':'—';
const fps=(n:number)=>n>0?n.toFixed(1)+' FPS':'—';
export function ReplayPerformanceInspector({performance:stats,mode,onModeChange}:{
 performance:ReplayPerformance|null;
 mode:HandDetailMode;onModeChange:(mode:HandDetailMode)=>void;
}){
 const backend=stats?.backend==='worker'?'Worker':stats?.backend==='main'?'CPU utama':'Memuat';
 return <details className="vml-perf" data-performance-profiler="ready">
  <summary>Performance Profiler <span>{backend} · {fps(stats?.poseFps??0)}</span></summary>
  <div className="vml-perf-body">
   <div className="vml-perf-metrics" aria-label="Pengukuran latency SOMA">
    {[
     {name:'Pose AI',value:ms(stats?.poseMs??0)},
     {name:'Hands AI',value:ms(stats?.handsMs??0)},
     {name:'Analisis event',value:ms(stats?.analysisMs??0)},
     {name:'Render',value:ms(stats?.renderMs??0)},
     {name:'Total pipeline',value:ms(stats?.pipelineMs??0)},
     {name:'Frame dilewati',value:String(stats?.skippedFrames??0)},
     {name:'Pose aktual',value:fps(stats?.poseFps??0)},
     {name:'Hands aktual',value:fps(stats?.handFps??0)},
     {name:'Update UI',value:fps(stats?.uiFps??0)}
    ].map(item=><span key={item.name}><small>{item.name}</small><b>{item.value}</b></span>)}
   </div>
   <label className="vml-perf-hand">Detail jari
    <select aria-label="Frekuensi deteksi tangan" value={mode}
     onChange={e=>onModeChange(e.target.value as HandDetailMode)}>
     <option value="adaptive">Adaptif · otomatis</option>
     <option value="detail">Detail · lebih sering</option>
     <option value="off">Off · tubuh saja</option>
    </select>
   </label>
   <small>Angka saat ini berasal dari pengukuran browser perangkat ini. Frame dilewati mencakup frame
    yang sengaja tidak dianalisis supaya video tetap lancar. Preview tetap berjalan mengikuti video;
    inferensi AI memakai frame terbaru tanpa antrean. Saat Worker gagal, CPU utama digunakan sebagai fallback.</small>
  </div>
 </details>;
}
