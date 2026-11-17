import {useState} from 'react';
import {Download} from 'lucide-react';
import type {HandLimbFrame,LimbDetail} from './videoHandLimbDetail.ts';
import {handLimbStatusLabel} from './videoHandLimbDetail.ts';
import type {VideoActorId} from './videoAutoActorTracker.ts';
import './hand-limb-inspector.css';

const limbNames:Record<LimbDetail['name'],string>={
 'left-arm':'Lengan kiri','right-arm':'Lengan kanan',
 'left-leg':'Kaki kiri','right-leg':'Kaki kanan'
};
const fingerNames={thumb:'Ibu jari',index:'Telunjuk',
 middle:'Jari tengah',ring:'Jari manis',pinky:'Kelingking'};
const number=(n:number|null|undefined,digits=1)=>
 n===null||n===undefined||!Number.isFinite(n)?'—':n.toFixed(digits);
const save=(name:string,content:string)=>{
 const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1500);
};
export function HandLimbInspector({frame,modelStatus,modelReason,getHistory,segment}:{
 frame:HandLimbFrame|null;
 modelStatus:'loading'|'ready'|'unavailable';modelReason:string;
 getHistory:()=>HandLimbFrame[];segment:number;
}){
 const [actor,setActor]=useState<VideoActorId>('A');
 const selected=frame?.actors.find(a=>a.id===actor);
 const available=frame?.actors.filter(a=>a.presence==='visible').length??0;
 const hands=selected?.hands??[];
 return <details className="vml-hand-limb" data-hand-limb="ready">
  <summary>Hands & Limbs <span>{available}/2 aktor · {modelStatus==='ready'?'Tangan aktif':
   modelStatus==='unavailable'?'Pose saja':'Memuat'}</span></summary>
  <div className="vml-hand-limb-body">
   <div className="vml-hand-limb-toolbar">
    <div role="group" aria-label="Pilih aktor detail tangan dan kaki">
     {(['A','B'] as const).map(id=><button key={id} type="button" aria-pressed={actor===id}
      onClick={()=>setActor(id)}>Actor {id}</button>)}
    </div>
    <button type="button" disabled={!frame}
     onClick={()=>save('SOMA-hand-limb-segment-'+segment+'.json',JSON.stringify({
      schema:'soma.hand-limb',version:1,segment,
      coordinateBasis:'Normalized 2D image; angle projections, not physical measurements',
      samples:getHistory()
     },null,2))}><Download size={14}/> Ekspor JSON</button>
   </div>
   <div className="vml-hand-limb-grid" aria-label={'Status anggota tubuh aktor '+actor}>
    {(selected?.limbs??[]).map(limb=><div className="vml-limb-card"
     data-limb={limb.name} data-presence={limb.presence} key={limb.name}>
     <strong>{limbNames[limb.name]}</strong>
     <span>{limb.presence==='visible'?'Terbaca':limb.presence==='partial'?'Sebagian':'Tidak terlihat'} · {limb.visibleJoints}/{limb.requiredJoints}</span>
     <div><small>Sudut</small><b>{number(limb.angleDeg)}°</b></div>
     <div><small>Kecepatan ujung</small><b>{number(limb.tipSpeed,3)}</b></div>
    </div>)}
   </div>
   <div className="vml-hand-limb-hands" aria-label={'Detail jari aktor '+actor}>
    {hands.map(hand=><div className="vml-hand-card" key={hand.side}
     data-side={hand.side} data-presence={hand.presence}>
     <div className="vml-hand-card-head">
      <strong>Tangan {hand.side==='left'?'kiri':'kanan'}</strong>
      <span>{handLimbStatusLabel(hand.presence)} · {hand.landmarks.length}/21</span>
     </div>
     <div className="vml-hand-fingers">
      {hand.fingers.length?hand.fingers.map(f=><span key={f.name}>
       <small>{fingerNames[f.name]}</small>
       <b>{number(f.bendDeg)}°</b>
      </span>):<small>Detail jari belum terbaca.</small>}
     </div>
     <div className="vml-hand-metrics">
      <span>Pinch relatif <b>{number(hand.pinchRatio,2)}</b></span>
      <span>Wrist speed <b>{number(hand.wristSpeed,3)}</b></span>
     </div>
    </div>)}
   </div>
   <div className="vml-limb-relations">
    {selected?.relations.map(relation=><span key={relation.side}>
     {relation.side==='left'?'Kiri':'Kanan'} · tangan–pinggul <b>{number(relation.handToHip2D,3)}</b>
     {' · '}arah tangan/kaki <b>{number(relation.armLegAlignment,2)}</b>
    </span>)}
   </div>
   <small className="vml-hand-limb-note">
    {modelStatus==='unavailable'?modelReason+' · Lengan dan kaki tetap dianalisis.':
     '21 titik per tangan dipindai terpisah. Label “Sampel terakhir” menandai data lama, tidak dihitung sebagai observasi baru.'}
    {' '}Kecepatan, sudut, gerak jari, dan jarak memakai koordinat gambar 2D.
   </small>
  </div>
 </details>;
}
