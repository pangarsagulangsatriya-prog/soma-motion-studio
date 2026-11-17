import type {ReadinessItem} from './compactStageStatusModel.ts';

/** Status gives a short, focusable explanation without waiting for native title tooltips. */
export function CompactFootprintsStatus({items,onSource,onProcess}:{
 items:ReadinessItem[];onSource:(trigger:HTMLElement)=>void;
 onProcess:(trigger:HTMLElement)=>void;
}){
 return <div className="fp-compact-status" role="group" aria-label="Status pembacaan Footprints">
  {items.map(item=><button type="button" key={item.id}
   className="fp-compact-status-item" data-level={item.level}
   data-tooltip={item.detail}
   onClick={event=>(item.id==='source'?onSource:onProcess)(event.currentTarget)}
   aria-label={`${item.label}: ${item.value}. ${item.detail}. Buka pengaturan.`}>
   <span className="fp-compact-status-dot" aria-hidden="true"/>
   <span className="fp-compact-status-name">{item.label}</span>
   <strong>{item.value}</strong>
  </button>)}
 </div>;
}
