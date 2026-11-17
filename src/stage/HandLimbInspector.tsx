import {useState} from 'react';
import {Download} from 'lucide-react';
import type {HandLimbFrame,LimbDetail} from './videoHandLimbDetail.ts';
import type {VideoActorId} from './videoAutoActorTracker.ts';
import './hand-limb-inspector.css';

const limbNames:Record<LimbDetail['name'],string>={
 'left-arm':'Lengan kiri','right-arm':'Lengan kanan',
 'left-leg':'Kaki kiri','right-leg':'Kaki kanan'
};
const number=(n:number|null|undefined,digits=1)=>
 n===null||n===undefined||!Number.isFinite(n)?'—':n.toFixed(digits);
const save=(name:string,content:string)=>{
 const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=name;link.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1500);
};

/** Uses existing 33-body-landmark temporal motion data. No finger model. */
export function HandLimbInspector({frame,getHistory,segment}:{
 frame:HandLimbFrame|null;getHistory:()=>HandLimbFrame[];segment:number;
}){
 const [actor,setActor]=useState<VideoActorId>('A');
 const selected=frame?.actors.find(a=>a.id===actor);
 const visible=frame?.actors.filter(a=>a.presence==='visible').length??0;
 return <details className="vml-hand-limb" data-hand-limb="pose-only">
  <summary>Arms & Legs <span>{visible}/2 aktor · Pose 33 titik</span></summary>
  <div className="vml-hand-limb-body">
   <div className="vml-hand-limb-toolbar">
    <div role="group" aria-label="Pilih aktor detail lengan dan kaki">
     {(['A','B'] as const).map(id=><button key={id} type="button" aria-pressed={actor===id}
      onClick={()=>setActor(id)}>Actor {id}</button>)}
    </div>
    <button type="button" disabled={!frame}
     onClick={()=>save('SOMA-arm-leg-segment-'+segment+'.json',JSON.stringify({
      schema:'soma.arm-leg',version:1,segment,
      coordinateBasis:'Normalized 2D image; pose-based angles and velocities',
      samples:getHistory().map(sample=>({
       atMs:sample.atMs,actors:sample.actors.map(a=>({
        id:a.id,presence:a.presence,limbs:a.limbs,relations:a.relations
       }))
      }))
     },null,2))}><Download size={14}/> Ekspor JSON</button>
   </div>
   <div className="vml-hand-limb-grid" aria-label={'Lengan dan kaki aktor '+actor}>
    {(selected?.limbs??[]).map(limb=><div className="vml-limb-card"
     data-limb={limb.name} data-presence={limb.presence} key={limb.name}>
     <strong>{limbNames[limb.name]}</strong>
     <span>{limb.presence==='visible'?'Terbaca':limb.presence==='partial'?'Sebagian':'Tidak terlihat'} · {limb.visibleJoints}/{limb.requiredJoints}</span>
     <div><small>Sudut</small><b>{number(limb.angleDeg)}°</b></div>
     <div><small>Kecepatan ujung</small><b>{number(limb.tipSpeed,3)}</b></div>
    </div>)}
   </div>
   <div className="vml-limb-relations">
    {selected?.relations.map(relation=><span key={relation.side}>
     {relation.side==='left'?'Kiri':'Kanan'} · pergelangan–pinggul <b>{number(relation.handToHip2D,3)}</b>
     {' · '}arah lengan/kaki <b>{number(relation.armLegAlignment,2)}</b>
    </span>)}
   </div>
   <small className="vml-hand-limb-note">Lengan dan kaki tetap dianalisis secara independen dari titik tubuh.
    Sudut, kecepatan, dan jarak memakai koordinat gambar 2D.</small>
  </div>
 </details>;
}
