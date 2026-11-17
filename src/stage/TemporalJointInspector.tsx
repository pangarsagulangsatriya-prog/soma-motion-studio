import {useMemo,useState} from 'react';
import {Download} from 'lucide-react';
import type {TemporalFrame,TemporalTracePoint} from './temporalJointIntelligence.ts';
import {TEMPORAL_JOINT_NAMES,temporalTraceCsv} from './temporalJointIntelligence.ts';
import type {VideoActorId} from './videoAutoActorTracker.ts';
import './temporal-joint-inspector.css';

type Metric='smoothX'|'smoothY'|'speed'|'acceleration'|'angleDeg';
const metrics:ReadonlyArray<{key:Metric;name:string;unit:string}>=[
 {key:'smoothX',name:'Posisi X',unit:'gambar'},
 {key:'smoothY',name:'Posisi Y',unit:'gambar'},
 {key:'speed',name:'Kecepatan',unit:'unit gambar/dtk'},
 {key:'acceleration',name:'Percepatan',unit:'unit gambar/dtk²'},
 {key:'angleDeg',name:'Sudut',unit:'°'}
];
function plotTrace(trace:TemporalTracePoint[],metric:Metric){
 const values=trace.map(p=>p[metric]);
 const valid=values.filter((v):v is number=>v!==null&&Number.isFinite(v));
 if(!valid.length)return {segments:[] as string[],min:0,max:1};
 const min=Math.min(...valid),max=Math.max(...valid);
 const span=Math.max(.00001,max-min);
 const first=trace[0].atMs,last=trace[trace.length-1].atMs;
 const range=Math.max(1,last-first);
 const segments:string[]=[];
 let path='';
 trace.forEach((p,i)=>{
  const v=values[i];
  if(v===null||!Number.isFinite(v)){
   if(path)segments.push(path);
   path='';return;
  }
  const x=32+(p.atMs-first)/range*492;
  const y=141-(v-min)/span*117;
  path+=(path?' L ':'M ')+x.toFixed(2)+' '+y.toFixed(2);
 });
 if(path)segments.push(path);
 return {segments,min,max};
}
const round=(v:number|null|undefined,places=3)=>v===null||v===undefined?'—':v.toFixed(places);
const time=(ms:number)=>String((ms/1000).toFixed(2))+' dtk';

export function TemporalJointInspector({getTrace,getWindow,revision,segment}:{
 getTrace:(actor:VideoActorId,joint:number)=>TemporalTracePoint[];
 getWindow:()=>TemporalFrame[];revision:number;segment:number;
}){
 const [actor,setActor]=useState<VideoActorId>('A');
 const [joint,setJoint]=useState(15);
 const [metric,setMetric]=useState<Metric>('speed');
 const [cursor,setCursor]=useState(-1);
 const trace=useMemo(()=>getTrace(actor,joint),[getTrace,actor,joint,revision,segment]);
 const chart=useMemo(()=>plotTrace(trace,metric),[trace,metric]);
 const index=cursor<0?trace.length-1:Math.min(cursor,trace.length-1);
 const current=trace[Math.max(0,index)];
 const hasData=trace.some(point=>point.x!==null);
 const metricName=metrics.find(m=>m.key===metric)!.name;
 const download=(filename:string,mime:string,body:string)=>{
  const url=URL.createObjectURL(new Blob([body],{type:mime}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 const exportSelected=()=>download(
  'SOMA-temporal-'+actor+'-joint-'+joint+'-segment-'+segment+'.csv',
  'text/csv;charset=utf-8',temporalTraceCsv(trace));
 const exportWindow=()=>download(
  'SOMA-temporal-all-joints-segment-'+segment+'.json','application/json',
  JSON.stringify({schema:'soma.temporal-joints',version:1,
   segment,windowFrames:revision,sampleCount:trace.length,
   coordinateBasis:'MediaPipe image normalized (relative z)',
   measurement:'Observed 2D angles; normalized-image velocity/acceleration, not physical meters or forces',
   retainedFrames:getWindow()},null,2));
 return <details className="vml-temporal" data-temporal="ready">
  <summary>Motion Timeline <span>{revision} frame tersimpan · 33 sendi / aktor</span></summary>
  <div className="vml-temporal-body">
   <div className="vml-temporal-selectors">
    <label>Aktor
     <select aria-label="Aktor Motion Timeline" value={actor}
      onChange={e=>{setActor(e.target.value as VideoActorId);setCursor(-1);}}>
      <option value="A">Actor A</option><option value="B">Actor B</option>
     </select>
    </label>
    <label>Sendi
     <select aria-label="Sendi Motion Timeline" value={joint}
      onChange={e=>{setJoint(+e.target.value);setCursor(-1);}}>
      {TEMPORAL_JOINT_NAMES.map((name,i)=>
       <option key={i} value={i}>{i} · {name}</option>)}
     </select>
    </label>
    <label>Grafik
     <select aria-label="Metrik Motion Timeline" value={metric}
      onChange={e=>setMetric(e.target.value as Metric)}>
      {metrics.map(item=><option key={item.key} value={item.key}>{item.name}</option>)}
     </select>
    </label>
   </div>
   <div className="vml-temporal-chart" data-actor={actor}>
    {hasData?<svg viewBox="0 0 544 166" role="img" preserveAspectRatio="none"
      aria-label={metricName+' sendi '+TEMPORAL_JOINT_NAMES[joint]+' aktor '+actor+' terhadap waktu video'}>
      <path d="M32 16 V142 H524" fill="none" className="vml-temporal-axes"/>
      <path d="M32 83 H524" fill="none" className="vml-temporal-grid"/>
      {chart.segments.map((d,i)=><path key={i} d={d} fill="none"
       className="vml-temporal-series" strokeWidth="2.3" strokeLinecap="round"/>)}
      <text x="32" y="158" className="vml-temporal-tick">{time(trace[0].atMs)}</text>
      <text x="524" y="158" className="vml-temporal-tick" textAnchor="end">{time(trace[trace.length-1].atMs)}</text>
      <text x="2" y="24" className="vml-temporal-tick">{round(chart.max,2)}</text>
      <text x="2" y="143" className="vml-temporal-tick">{round(chart.min,2)}</text>
      {current&&<path d={'M'+(32+(current.atMs-trace[0].atMs)/
       Math.max(1,trace[trace.length-1].atMs-trace[0].atMs)*492)+' 12 V142'}
       className="vml-temporal-cursor"/>}
     </svg>:<p>Belum ada sampel valid untuk sendi ini. Jalankan analisis video.</p>}
   </div>
   <div className="vml-temporal-scrub">
    <label htmlFor="vml-temporal-cursor">Waktu: {current?time(current.atMs):'—'}</label>
    <input id="vml-temporal-cursor" type="range" aria-label="Jelajahi sampel waktu gerak"
     min={0} max={Math.max(0,trace.length-1)} step={1}
     disabled={trace.length<2} value={Math.max(0,index)}
     onChange={e=>setCursor(+e.target.value)}/>
    <button type="button" onClick={()=>setCursor(-1)}>Terbaru</button>
   </div>
   <div className="vml-temporal-readout" role="status">
    <span><small>Raw X/Y</small><b>{round(current?.x)} / {round(current?.y)}</b></span>
    <span><small>Smoothed X/Y</small><b>{round(current?.smoothX)} / {round(current?.smoothY)}</b></span>
    <span><small>Velocity X/Y</small><b>{round(current?.vx)} / {round(current?.vy)}</b></span>
    <span><small>Speed 2D</small><b>{round(current?.speed)}</b></span>
    <span><small>Acceleration 2D</small><b>{round(current?.acceleration)}</b></span>
    <span><small>Sudut 2D</small><b>{round(current?.angleDeg,1)}°</b></span>
   </div>
   <div className="vml-temporal-export">
    <button type="button" disabled={!trace.length} onClick={exportSelected}>
     <Download size={14}/> CSV sendi terpilih
    </button>
    <button type="button" disabled={!revision} onClick={exportWindow}>
     <Download size={14}/> JSON semua sendi
    </button>
    <small>Jendela 360 frame analisis terakhir dalam satu segmen video. Saat seek/loop, histori baru dimulai. Titik tertutup menghasilkan jeda, tidak diisi dengan koordinat buatan. Kecepatan, percepatan, dan sudut memakai estimasi gambar 2D.</small>
   </div>
  </div>
 </details>;
}
