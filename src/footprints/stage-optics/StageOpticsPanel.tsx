import {useMemo,useState,type RefObject} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import {LowerBodyMaskPanel} from './LowerBodyMaskPanel.tsx';
import {ArchivalMappingPanel} from './ArchivalMappingPanel.tsx';
import {useStageSession} from '../../stage/useStageSession.ts';
import type {Projection} from '../../projection/useProjection.ts';
import type {MultiPoseGaitRouter} from '../live/MultiPoseGaitRouter.ts';
import {Download,Eye,RotateCcw,Ruler} from 'lucide-react';
import {download} from '../../engine/recording.ts';
import {defaultFloorSpace} from '../spatial/coordinates.ts';
import {assessStageOpticsPlan,defaultStageOpticsPlan,stageOpticsPlanExport,
 type Point3,type StageOpticsPlan} from './StageOpticsPlan.ts';
import './stage-optics.css';

type DeviceId=keyof StageOpticsPlan['devices'];
const DEVICE_LABELS:Record<DeviceId,string>={
 camera:'Kamera tracking',body:'Proyektor tubuh A/B',
 floorProjector:'Proyektor pad lantai',bodyB:'Proyektor tubuh B'
};
const dims=[{label:'8 × 6 m',w:8,d:6},{label:'6 × 4 m',w:6,d:4},{label:'10 × 7 m',w:10,d:7}];
const round=(n:number)=>Number.isFinite(n)?n.toFixed(2):'—';
const cx=(z:{xM:number;widthM:number})=>z.xM+z.widthM/2;
const cy=(z:{yM:number;depthM:number})=>z.yM+z.depthM/2;
function StageTopView({plan}:{plan:StageOpticsPlan}){
 const {floor,zones,devices}=plan;
 const scale=Math.min(470/floor.widthM,345/floor.depthM),w=scale*floor.widthM,h=scale*floor.depthM;
 const l=(700-w)/2,t=36;
 const pt=(x:number,y:number)=>({x:l+x*scale,y:t+(floor.depthM-y)*scale});
 const box=(z:typeof zones.A)=>({x:l+z.xM*scale,y:t+(floor.depthM-z.yM-z.depthM)*scale,
  width:z.widthM*scale,height:z.depthM*scale});
 const a=pt(cx(zones.A),cy(zones.A)),b=pt(cx(zones.B),cy(zones.B));
 const f=pt(floor.widthM/2,floor.depthM/2);
 const body=pt(devices.body.xM,devices.body.yM);
 const bodyB=pt(devices.bodyB.xM,devices.bodyB.yM);
 const camera=pt(devices.camera.xM,devices.camera.yM);
 const pad=pt(devices.floorProjector.xM,devices.floorProjector.yM);
 return <svg viewBox="0 0 700 715" role="img" aria-label="Denah panggung, dua zona berjalan dan posisi kamera serta proyektor">
  <rect width="700" height="715" rx="9" fill="#0c1613"/>
  <rect x={l} y={t} width={w} height={h} rx="3" stroke="#91ab9c" strokeWidth="1.5" fill="#15231b"/>
  {Array.from({length:Math.floor(floor.widthM)+1},(_,i)=>
   <line key={'x'+i} x1={l+i*scale} x2={l+i*scale} y1={t} y2={t+h}
    stroke="#40574a" strokeWidth=".6" strokeDasharray="4 7"/>)}
  {Array.from({length:Math.floor(floor.depthM)+1},(_,i)=>
   <line key={'y'+i} y1={t+i*scale} y2={t+i*scale} x1={l} x2={l+w}
    stroke="#40574a" strokeWidth=".6" strokeDasharray="4 7"/>)}
  {(['A','B'] as const).map(id=>{
   const q=box(zones[id]);
   return <rect key={id} {...q} rx="8" fill={id==='A'?'#aecab4':'#d4c8a8'}
    fillOpacity=".10" stroke={id==='A'?'#b0d4b6':'#e6d4ae'}
    strokeDasharray="8 6" strokeWidth="1.4"/>;
  })}
  <rect {...box(zones.crossing)} fill="#e6d6a8" fillOpacity=".10"
   stroke="#d7c19a" strokeDasharray="3 5" rx="6"/>
  <text x={l+w/2} y={t+17} textAnchor="middle" fill="#d6e1d3" fontSize="14">UPSTAGE</text>
  <text x={l+w/2} y={t+h-10} textAnchor="middle" fill="#d6e1d3" fontSize="14">DOWNSTAGE</text>
  <path d={plan.layout==='two-projector'?
   `M${body.x} ${body.y}L${a.x} ${a.y} M${body.x} ${body.y}L${b.x} ${b.y}`:
   `M${body.x} ${body.y}L${a.x} ${a.y}`}
   stroke="#d1b997" strokeWidth="2" strokeDasharray="7 6"/>
  {plan.layout==='three-projector'&&<path d={`M${bodyB.x} ${bodyB.y}L${b.x} ${b.y}`}
   stroke="#d1b997" strokeWidth="2" strokeDasharray="7 6"/>}
  <path d={`M${pad.x} ${pad.y}L${f.x} ${f.y}`}
   stroke="#a3c2d5" strokeWidth="2" strokeDasharray="5 4"/>
  <path d={`M${camera.x} ${camera.y}L${a.x} ${a.y}
   M${camera.x} ${camera.y}L${b.x} ${b.y}`}
   stroke="#a4e1c2" strokeWidth="1.4" strokeDasharray="6 6"/>
  {([{p:a,id:'A'},{p:b,id:'B'}]).map(({p,id})=>
   <g key={id}><ellipse cx={p.x} cy={p.y+13} rx="24" ry="10" fill="#e5e8c9" fillOpacity=".18"/>
    <circle cx={p.x} cy={p.y} r="18" fill="#e4e8d9"/>
    <text x={p.x} y={p.y+5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#283527">{id}</text></g>)}
  {([{p:camera,id:'CAM',fill:'#98e3b7'}, {p:body,id:'PB',fill:'#ebc99d'},
    {p:pad,id:'PF',fill:'#a7cbe4'},
    ...(plan.layout==='three-projector'?[{p:bodyB,id:'PB2',fill:'#ebc99d'}]:[])]).map(({p,id,fill})=>
   <g key={id}><rect x={p.x-23} y={p.y-14} width="46" height="28" rx="5" fill={fill}/>
    <text x={p.x} y={p.y+5} fill="#17241e" textAnchor="middle"
     fontSize="12" fontWeight="700">{id}</text></g>)}
  <text x="350" y="693" textAnchor="middle" fill="#a5bcad" fontSize="13">
   Sistem koordinat: titik nol di downstage-left · ukuran meter
  </text>
 </svg>;
}
function StageElevation({plan}:{plan:StageOpticsPlan}){
 const cutoff=300-plan.body.visibleTopM*132;
 return <svg viewBox="0 0 700 390" role="img" aria-label="Potongan samping: dua tubuh parsial di atas pad lantai">
  <rect width="700" height="390" rx="9" fill="#080c0a"/>
  <line x1="35" y1="302" x2="665" y2="302" stroke="#a3a9a0" strokeWidth="2"/>
  {([225,470]).map((x,i)=><g key={x}>
   <path d={`M${x-24} 302 L${x-18} 226 L${x-22} 155
    L${x+21} 155 L${x+16} 228 L${x+27} 302`}
    fill="none" stroke="#d5dfd2" strokeWidth="19" strokeLinejoin="round"
    opacity=".65"/>
   <rect x={x-26} y={cutoff} width="52" height={Math.max(0,301-cutoff)}
    fill="#c0d0c1" fillOpacity=".09"/>
   <ellipse cx={x} cy="303" rx="49" ry="9" fill="#e8f1ea" fillOpacity=".4"/>
   <text x={x} y="355" fill="#e2e7df" fontSize="16" textAnchor="middle">
    Performer {i===0?'A':'B'}
   </text></g>)}
  <line x1="55" y1={cutoff} x2="645" y2={cutoff} stroke="#ded1a2" strokeDasharray="7 6"/>
  <text x="350" y={Math.max(20,cutoff-10)} fill="#e4d6a4" textAnchor="middle" fontSize="13">
   Batas cahaya rencana: {plan.body.visibleTopM.toFixed(2)} m
  </text>
  <text x="350" y="375" textAnchor="middle" fontSize="12" fill="#bbc3b7">
   Gambaran target visual, belum hasil tracking atau pemetaan 3D
  </text>
 </svg>;
}
export function StageOpticsPanel({floorWidthM,floorDepthM,frameRef,cameraOn,performerCount,identityAmbiguous,router,projection}:{
 floorWidthM?:number;floorDepthM?:number;frameRef:RefObject<MotionFrame>;
 cameraOn:boolean;performerCount:1|2;identityAmbiguous:boolean;router:MultiPoseGaitRouter;projection:Projection
}){
 const session=useStageSession();
 const [plan,setPlan]=useState(()=>defaultStageOpticsPlan(defaultFloorSpace(floorWidthM??8,floorDepthM??6)));
 const [view,setView]=useState<'top'|'elevation'>('top');
 const [maskOpen,setMaskOpen]=useState(false);
 const [archiveOpen,setArchiveOpen]=useState(false);
 const [device,setSelectedDevice]=useState<DeviceId>('camera');
 const [message,setMessage]=useState('Desain optik sementara. Tidak mengaktifkan output atau mengubah kalibrasi Stage.');
 const estimate=useMemo(()=>{try{return assessStageOpticsPlan(plan);}catch{return null;}},[plan]);
 const updateDevicePosition=(key:DeviceId,axis:keyof Point3,value:number)=>{
  setPlan(p=>({...p,devices:{...p.devices,[key]:{...p.devices[key],[axis]:value}}}));
 };
 const setRatio=(key:keyof StageOpticsPlan['equipment'],input:string)=>{
  const value=input.trim()===''?null:Number(input);
  setPlan(p=>({...p,equipment:{...p.equipment,[key]:value}}));
 };
 const exportPlan=()=>{
  try{
   const report=stageOpticsPlanExport(plan);
   download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),
    'SOMA-S5-7-0-stage-optics-plan.json');
   setMessage('Rancangan optik JSON disimpan; belum dihubungkan ke hardware.');
  }catch(e){setMessage(e instanceof Error?e.message:'Rancangan tidak valid.');}
 };
 return <section className="stage-optics" aria-label="S5.7.0 Stage Optics & Spatial Design">
  <div className="live-floor-heading"><Ruler size={15}/> 00 / STAGE OPTICS DESIGN</div>
  <p>Periksa bidang cahaya tubuh dan pad sebelum menghidupkan proyektor. Perangkat masih berupa posisi rencana. Dua tubuh terlihat dari pinggang hingga kaki; wajah dan latar belakang tetap gelap.</p>
  <div className="stage-optics-layout">
   <div className="stage-optics-map">
    <div className="stage-optics-switch">
     <button type="button" aria-pressed={view==='top'} onClick={()=>setView('top')}>Denah atas</button>
     <button type="button" aria-pressed={view==='elevation'} onClick={()=>setView('elevation')}>Potongan tubuh</button>
    </div>
    {view==='top'?<StageTopView plan={plan}/>:<StageElevation plan={plan}/>}
    <div className="stage-optics-legend">
     <span>CAM · tracking</span><span>PB · arsip tubuh</span><span>PF · pad lantai</span>
    </div>
   </div>
   <div className="stage-optics-controls">
    <label>Ukuran lantai
     <select value={dims.find(d=>d.w===plan.floor.widthM&&d.d===plan.floor.depthM)?.label??''}
      onChange={e=>{
       const d=dims.find(x=>x.label===e.target.value);if(!d)return;
       setPlan(defaultStageOpticsPlan(defaultFloorSpace(d.w,d.d)));
       setMessage('Ukuran diubah. Zona dan posisi perangkat diatur ulang sebagai perkiraan.');
      }}>{dims.map(d=><option key={d.label}>{d.label}</option>)}</select>
    </label>
    <label>Konfigurasi perangkat
     <select value={plan.layout} onChange={e=>setPlan(p=>({...p,layout:e.target.value as StageOpticsPlan['layout']}))}>
      <option value="two-projector">2 proyektor · 1 tubuh bersama + 1 lantai</option>
      <option value="three-projector">3 proyektor · 2 tubuh + 1 lantai</option>
     </select>
    </label>
    <label>Batas atas cahaya tubuh · {round(plan.body.visibleTopM)} meter
     <input type="range" min=".8" max="1.6" step=".01" value={plan.body.visibleTopM}
      onChange={e=>setPlan(p=>({...p,body:{...p.body,visibleTopM:Number(e.target.value)}}))}/>
    </label>
    <label>Feather tepi · {Math.round(plan.body.edgeFeatherM*100)} cm
     <input type="range" min="0" max=".18" step=".01" value={plan.body.edgeFeatherM}
      onChange={e=>setPlan(p=>({...p,body:{...p.body,edgeFeatherM:Number(e.target.value)}}))}/>
    </label>
    <label>Pilih perangkat untuk mengubah koordinat
     <select value={device} onChange={e=>setSelectedDevice(e.target.value as DeviceId)}>
      {(Object.keys(DEVICE_LABELS) as DeviceId[]).filter(id=>id!=='bodyB'||plan.layout==='three-projector').map(id=>
       <option key={id} value={id}>{DEVICE_LABELS[id]}</option>)}
     </select>
    </label>
    <div className="stage-optics-xyz">
     {(['xM','yM','zM'] as const).map(axis=>
      <label key={axis}>{axis[0].toUpperCase()} (m)
       <input type="number" step=".1" value={plan.devices[device][axis]}
        onChange={e=>updateDevicePosition(device,axis,Number(e.target.value))}/>
      </label>)}
    </div>
    <details>
     <summary>Spesifikasi lensa & kamera (opsional)</summary>
     <p>Isi data dari perangkat nyata. Kosongkan bila belum diketahui.</p>
     <div className="stage-optics-xyz">
      {([
       ['bodyThrowRatioMin','Body TR min'],['bodyThrowRatioMax','Body TR max'],
       ['floorThrowRatioMin','Floor TR min'],['floorThrowRatioMax','Floor TR max'],
       ['cameraHorizontalFovDeg','Camera FOV °']
      ] as const).map(([key,label])=><label key={key}>{label}
       <input type="number" min="0" step=".01"
        value={plan.equipment[key]??''}
        onChange={e=>setRatio(key,e.target.value)}/></label>)}
     </div>
    </details>
    <div className="stage-optics-actions">
     <button type="button" onClick={exportPlan} disabled={!estimate}><Download size={14}/> Ekspor JSON</button>
     <button type="button" onClick={()=>{
      setPlan(defaultStageOpticsPlan(plan.floor));setMessage('Perangkat dikembalikan ke posisi awal.');
     }}><RotateCcw size={14}/> Reset denah</button>
    </div>
   </div>
  </div>
  <div className="stage-optics-estimates">
   <b><Eye size={14}/> Hasil hitung tata ruang — estimasi, belum terukur</b>
   {estimate?<>
    <div><span>Body: TR kasar</span><strong>{round(estimate.body.throwRatioEstimate)}</strong></div>
    {estimate.bodyB&&<div><span>Body B: TR kasar</span><strong>{round(estimate.bodyB.throwRatioEstimate)}</strong></div>}
    <div><span>Floor: TR kasar</span><strong>{round(estimate.floor.throwRatioEstimate)}</strong></div>
    <div><span>Camera: FOV horizontal minimal kasar</span><strong>{round(estimate.minimumCameraHorizontalFovDeg)}°</strong></div>
    <ul>{estimate.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
    <small>Nilai TR menggunakan jarak 3D dibagi lebar proyeksi sebagai saringan awal; gunakan kalkulator lensa pabrikan dan ukuran perangkat untuk rigging. Belum ada output dua proyektor langsung, pengukuran cahaya, atau tracking tubuh dari panel ini.</small>
   </>:<p>Koordinat tidak valid. Periksa angka XYZ dan rentang lensa.</p>}
  </div>
  <p className="stage-optics-note" role="status">{message}</p>
  <details className="stage-optics-mask-drawer" open={maskOpen}
   onToggle={e=>setMaskOpen(e.currentTarget.open)}>
   <summary>01 / Lower-Body Mask Engine <span>Mask dua pose · simulasi dan kamera SOMA</span></summary>
   {maskOpen&&<LowerBodyMaskPanel frameRef={frameRef} cameraOn={cameraOn}
    performerCount={performerCount} identityAmbiguous={identityAmbiguous}/>}
  </details>
  <details className="stage-optics-mask-drawer" open={archiveOpen}
   onToggle={e=>setArchiveOpen(e.currentTarget.open)}>
   <summary>02 / Archival Video Mapping <span>Arsip video A/B dalam mask pinggang–kaki</span></summary>
   {archiveOpen&&<ArchivalMappingPanel frameRef={frameRef} cameraOn={cameraOn}
    performerCount={performerCount} router={router} projection={projection}
    stageMedia={session.media} onStageMedia={session.chooseMedia}
    stageSettings={session.meta.archiveSettings}
    onStageSettings={settings=>session.patch({archiveSettings:settings})}
    stageHoldMs={session.meta.bridgeHoldMs}
    onStageHoldMs={ms=>session.patch({bridgeHoldMs:ms})}/>}
  </details>
 </section>;
}
