import {useMemo,useState} from 'react';
import {Download} from 'lucide-react';
import type {MotionSemanticEvent,MotionSemanticKind,MotionSemanticStatus} from './motionSemantics.ts';
import {SEMANTIC_KINDS,motionSemanticsCsv,semanticEventCounts} from './motionSemantics.ts';
import './motion-semantics-inspector.css';

const names:Record<MotionSemanticKind,string>={
 contact:'Contact',swing:'Swing',pivot:'Pivot',reach:'Reach',
 bend:'Bend',turn:'Turn',hold:'Hold'
};
const sideName:Record<MotionSemanticEvent['side'],string>={
 left:'kiri',right:'kanan',body:'tubuh',
 'left-arm':'lengan kiri','right-arm':'lengan kanan',
 'left-leg':'kaki kiri','right-leg':'kaki kanan'
};
const time=(ms:number)=>(ms/1000).toFixed(2)+' dtk';
const metric=(event:MotionSemanticEvent)=>
 event.kind==='contact'||event.kind==='swing'||event.kind==='pivot'?
 'Fase gait · '+Math.round(event.confidence*100)+'%':
 event.value.toFixed(event.kind==='bend'||event.kind==='turn'?1:3)+
 ' '+event.unit+' · '+Math.round(event.confidence*100)+'%';
function exportCsv(events:MotionSemanticEvent[],segment:number){
 const url=URL.createObjectURL(new Blob([motionSemanticsCsv(events)],{
  type:'text/csv;charset=utf-8'
 }));
 const link=document.createElement('a');link.href=url;
 link.download='SOMA-motion-semantics-segment-'+segment+'.csv';link.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function MotionSemanticsInspector({events,statuses,segment,durationMs}:{
 events:MotionSemanticEvent[];statuses:MotionSemanticStatus[];
 segment:number;durationMs:number;
}){
 const [actor,setActor]=useState<'all'|'A'|'B'>('all');
 const [kind,setKind]=useState<MotionSemanticKind|'all'>('all');
 const filtered=useMemo(()=>events.filter(e=>
  (actor==='all'||e.actor===actor)&&(kind==='all'||e.kind===kind)
 ),[actor,kind,events]);
 const counts=useMemo(()=>semanticEventCounts(events),[events]);
 const current=statuses.filter(s=>s.active&&(actor==='all'||s.actor===actor));
 return <details className="vml-semantics" data-motion-semantics="ready">
  <summary>Motion Semantics <span>{events.length} event · 7 jenis</span></summary>
  <div className="vml-semantic-body">
   <div className="vml-semantic-controls">
    <label>Aktor<select aria-label="Aktor Motion Semantics" value={actor}
     onChange={e=>setActor(e.target.value as 'all'|'A'|'B')}>
     <option value="all">A + B</option><option value="A">Actor A</option>
     <option value="B">Actor B</option>
    </select></label>
    <label>Gerak<select aria-label="Jenis Motion Semantics" value={kind}
     onChange={e=>setKind(e.target.value as MotionSemanticKind|'all')}>
     <option value="all">Semua event</option>
     {SEMANTIC_KINDS.map(item=><option value={item} key={item}>{names[item]}</option>)}
    </select></label>
    <button type="button" disabled={!filtered.length}
     onClick={()=>exportCsv(filtered,segment)}><Download size={14}/> CSV</button>
   </div>
   <div className="vml-semantic-counts" aria-label="Jumlah setiap jenis event">
    {SEMANTIC_KINDS.map(item=><span key={item} data-kind={item}>
     {names[item]} <b>{counts[item]}</b>
    </span>)}
   </div>
   {!!current.length&&<div className="vml-semantic-active" role="status"
    aria-label="Gerak aktif pada frame sekarang">
    {current.map(s=><span key={s.actor+':'+s.kind+':'+s.side}>
     {s.actor} · {names[s.kind]} {sideName[s.side]} aktif
    </span>)}
   </div>}
   <div className="vml-semantic-timeline" aria-label="Penanda waktu event pada video">
    {filtered.slice(-90).map(event=><span key={event.id}
     className="vml-semantic-tick" data-kind={event.kind}
     data-actor={event.actor} title={event.actor+' '+names[event.kind]+' '+time(event.atMs)}
     style={{left:Math.max(0,Math.min(100,durationMs>0?
      event.atMs/durationMs*100:0))+'%'}}/>)}
   </div>
   <div className="vml-semantic-list" aria-label="Riwayat event semantik">
    {filtered.length?filtered.slice(-12).reverse().map(event=>
     <div key={event.id} className="vml-semantic-event"
      data-kind={event.kind} data-actor={event.actor}>
      <time>{time(event.atMs)}</time>
      <strong>{event.actor} · {names[event.kind]}</strong>
      <span>{sideName[event.side]}</span>
      <small>{metric(event)}</small>
      {event.durationMs>0&&<small>{event.durationMs} ms</small>}
     </div>):<p>Belum ada perubahan gerak yang melewati ambang pengukuran.</p>}
   </div>
   <small className="vml-semantic-note">
    Event muncul saat ambang gerak terlampaui. Pengukuran memakai koordinat video
    2D; Contact mengikuti estimasi fase kaki, belum mengukur tekanan lantai.
    Seek atau loop memulai segmen baru.
   </small>
  </div>
 </details>;
}
