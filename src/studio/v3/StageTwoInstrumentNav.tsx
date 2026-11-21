import {STAGE_TWO_ITEMS,isStageTwoLab,type StageTwoLabId} from './labsCatalog.ts';

/** Stage 2's local instrument selector. All controls operate the existing legacy engines. */
export function StageTwoInstrumentNav({active,onSelect}:{
 active:StageTwoLabId;onSelect:(id:StageTwoLabId)=>void;
}){
 return <section className="soma-stage2-instruments" aria-label="Instrumen Stage 2">
  <div className="soma-stage2-instruments-head">
   <div>
    <span className="soma-stage2-eyebrow">STAGE 2 / INSTRUMEN</span>
    <h1>Visual, teks &amp; suara</h1>
   </div>
   <span className="soma-stage2-instruments-counter">{STAGE_TWO_ITEMS.length} instrumen</span>
  </div>
  <nav className="soma-stage2-instrument-tabs" aria-label="Pilih instrumen Stage 2">
   {STAGE_TWO_ITEMS.map(item=><button type="button" key={item.id}
    aria-current={active===item.id?'page':undefined}
    className="soma-stage2-instrument-tab"
    onClick={()=>{if(active!==item.id&&isStageTwoLab(item.id))onSelect(item.id);}}>
    {item.title}
   </button>)}
  </nav>
 </section>;
}
