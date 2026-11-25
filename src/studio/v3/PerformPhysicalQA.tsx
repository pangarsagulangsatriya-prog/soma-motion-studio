import {useEffect,useState} from 'react';
import {
 assessSurfaceProof,emptySurfaceProof,recordSurfaceSample,SURFACE_TARGETS,
 type StageSurface,type StageSurfacePlan,type SurfaceProof
} from '../../footprints/stage-optics/DualSurfaceCalibration.ts';
import {
 showMeasuredTarget,storeOperatorProof,urgentBlackoutDualSurface
} from '../../footprints/stage-optics/DualSurfaceSessionStore.ts';

export function PerformPhysicalQA({surface,signature,plan,prior,ready,floor,onClose}:{
 surface:StageSurface;signature:string;plan:StageSurfacePlan;prior:SurfaceProof|null;ready:boolean;floor:{widthM:number;depthM:number}|null;onClose:()=>void;
}){
 const [proof,setProof]=useState(()=>prior?.signature===signature?prior:emptySurfaceProof(plan,signature));
 const targets=SURFACE_TARGETS[surface];
 const [target,setTarget]=useState(targets[0].id);
 const point=targets.find(t=>t.id===target)??targets[0];
 const [dx,setDx]=useState(''),[dy,setDy]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>()=>urgentBlackoutDualSurface(surface),[surface]);
 const edit=(next:SurfaceProof)=>setProof({...next,completedAt:null});
 const record=()=>{
  if(!dx.trim()||!dy.trim())return;
  try{
   const updated=recordSurfaceSample(proof,target,Number(dx),Number(dy));
   urgentBlackoutDualSurface(surface);edit(updated);
   setDx('');setDy('');
   setTarget(targets.find(t=>!updated.samples.some(s=>s.id===t.id))?.id??target);
   setNotice('Pengukuran tersimpan dalam draf.');
  }catch(error){setNotice(String(error));}
 };
 const sign=()=>{
  const signed={...proof,completedAt:new Date().toISOString()};
  const result=assessSurfaceProof(plan,signature,signed);
  if(result.status!=='within-provisional-target'){
   setNotice(result.missing.join(' ')||`RMSE ${result.rmseCm} cm, P95 ${result.p95Cm} cm. Sesuaikan bidang lalu ukur ulang.`);return;
  }
  if(storeOperatorProof(surface,signed))onClose();
  else setNotice('Binding berubah. Mulai ulang pengukuran.');
 };
 return <section className="soma-physical-qa" aria-label="Pengukuran fisik proyektor">
  <h3>QA fisik {surface.toUpperCase()}</h3>
  <p>Dengan operator di tempat, ukur selisih pusat cahaya terhadap tanda lantai atau acuan tubuh. Target uji padam setelah 15 detik.</p>
  {!ready&&<p role="status">Tracking atau binding berubah. Pulihkan sumber. Jika konfigurasi berubah, buka pengukuran baru.</p>}
  <label>Titik uji <select value={target} onChange={e=>{
   urgentBlackoutDualSurface(surface);setTarget(e.target.value);setDx('');setDy('');
  }}>{targets.map(t=><option key={t.id} value={t.id}>{t.id} · {t.label}</option>)}</select></label>
  {surface==='floor'&&floor&&<p>Tanda {target} pada X {(point.uv.x*floor.widthM).toFixed(2)} m dan Y {((1-point.uv.y)*floor.depthM).toFixed(2)} m. Ukur dari sudut kiri depan pada peta, dengan +Y ke belakang panggung.</p>}
  <button type="button" disabled={!ready} onClick={()=>setNotice(showMeasuredTarget(surface,target,signature)?
   'Target uji diperintahkan. Periksa cahaya.':'Sumber atau binding belum siap.')}>Tampilkan target uji</button>
  <button type="button" onClick={()=>urgentBlackoutDualSurface(surface)}>Padamkan target</button>
  <label>ΔX (cm) <input type="number" step="any" value={dx} onChange={e=>setDx(e.target.value)}/></label>
  <label>ΔY (cm) <input type="number" step="any" value={dy} onChange={e=>setDy(e.target.value)}/></label>
  <button type="button" disabled={!ready||!dx.trim()||!dy.trim()} onClick={record}>Catat pengukuran</button>
  <ul>{proof.samples.map(s=><li key={s.id}>{s.id} · ΔX {s.dxCm} cm · ΔY {s.dyCm} cm</li>)}</ul>
  <label>Pemeriksa <input value={proof.reviewer} onChange={e=>edit({...proof,reviewer:e.target.value})}/></label>
  {([['fixedOptics','Optik tetap'],['blackoutObserved','Blackout terlihat padam'],
   ['noUnsafeSpill','Cahaya di luar bidang sudah diperiksa']] as const).map(([key,label])=>
   <label key={key}><input type="checkbox" checked={proof.checklist[key]}
    onChange={e=>edit({...proof,checklist:{...proof.checklist,[key]:e.target.checked}})}/>{label}</label>)}
  <button type="button" disabled={!ready} onClick={sign}>Tandatangani hasil ukur</button>
  <button type="button" onClick={onClose}>Tutup pengukuran</button>
  <p role="status">{notice}</p>
 </section>;
}
