import type {ReadinessItem} from './compactStageStatusModel.ts';

/** Readiness belongs beside local navigation; no duplicate status panel below. */
export function CompactFootprintsStatus({items,onSource,onProcess}:{
 items:ReadinessItem[];onSource:()=>void;onProcess:()=>void;
}){
 return <div className="fp-compact-status" role="group" aria-label="Status pembacaan Footprints">
  {items.map(item=><button type="button" key={item.id}
   className="fp-compact-status-item"
   data-level={item.level} title={item.detail}
   onClick={item.id==='source'?onSource:onProcess}
   aria-label={`${item.label}: ${item.value}. ${item.detail}. Klik untuk membuka pengaturan.`}>
   <span className="fp-compact-status-dot" aria-hidden="true"/>
   <span className="fp-compact-status-name">{item.label}</span>
   <strong>{item.value}</strong>
  </button>)}
 </div>;
}
