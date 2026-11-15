import {Footprints,Layers3,ScanFace,Sparkles,Type} from 'lucide-react';

export type SceneId='liquid'|'echo'|'cut'|'body'|'footprints';
export const SCENES:{id:SceneId;name:string;short:string;description:string;icon:typeof Sparkles}[]=[
 {id:'liquid',name:'Teks Cair',short:'Teks',description:'Huruf mengikuti gerak',icon:Type},
 {id:'echo',name:'Jejak Berulang',short:'Jejak',description:'Gambar yang kembali',icon:Layers3},
 {id:'cut',name:'Potongan',short:'Potongan',description:'Pecahan ritmis',icon:Sparkles},
 {id:'body',name:'Siluet × Teks',short:'Siluet',description:'Tubuh membuka gambar',icon:ScanFace},
 {id:'footprints',name:'Footprints',short:'Kaki',description:'Tapak dari gerak kaki',icon:Footprints}
];
export function ScenePicker({scene,onSelect,needsBody,onUseBody,onDismissBody}:{
 scene:SceneId;onSelect:(id:SceneId)=>void;needsBody:boolean;onUseBody:()=>void;onDismissBody:()=>void;
}){
 return <section className="v3-scene-strip" aria-label="Pilih scene visual">
  <div className="v3-scene-scroll" role="group" aria-label="Scene visual">
   {SCENES.map(({id,name,description,icon:Icon})=><button key={id} type="button" className={'v3-scene'+(scene===id?' selected':'')} aria-pressed={scene===id} onClick={()=>onSelect(id)} title={description}><Icon size={17} aria-hidden="true"/><span>{name}</span></button>)}
  </div>
  {needsBody&&<div className="v3-scene-permission" role="status">
   <div><strong>Footprints memakai pelacakan Tubuh.</strong><span>Kamera akan meminta izin. Perubahan sumber dapat mengatur ulang pemetaan gerak.</span></div>
   <button type="button" className="v3-accent" onClick={onUseBody}>Gunakan Body & kamera</button>
   <button type="button" onClick={onDismissBody}>Nanti</button>
  </div>}
 </section>;
}
