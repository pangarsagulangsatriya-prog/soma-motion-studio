import {Footprints,Layers3,ScanFace,Sparkles,Type} from 'lucide-react';

export type SceneId='liquid'|'echo'|'cut'|'body'|'footprints';
export const SCENES:{id:SceneId;name:string;short:string;description:string;icon:typeof Sparkles}[]=[
 {id:'liquid',name:'Teks Cair',short:'Teks',description:'Huruf mengikuti gerak',icon:Type},
 {id:'echo',name:'Jejak Berulang',short:'Jejak',description:'Gambar yang kembali',icon:Layers3},
 {id:'cut',name:'Potongan',short:'Potongan',description:'Pecahan ritmis',icon:Sparkles},
 {id:'body',name:'Siluet × Teks',short:'Siluet',description:'Tubuh membuka gambar',icon:ScanFace},
 {id:'footprints',name:'Footprints',short:'Kaki',description:'Tapak dari gerak kaki',icon:Footprints}
];
export function ScenePicker({scene,onSelect,needsBody,waitingBody,cameraBusy,cameraError,onUseBody,onDismissBody}:{
 scene:SceneId;onSelect:(id:SceneId)=>void;needsBody:boolean;waitingBody:boolean;cameraBusy:boolean;cameraError:string;onUseBody:()=>void;onDismissBody:()=>void;
}){
 return <section className="v3-scene-strip" aria-label="Pilih scene visual">
  <div className="v3-scene-scroll" role="group" aria-label="Scene visual">
   {SCENES.map(({id,name,description,icon:Icon})=><button key={id} type="button" className={'v3-scene'+(scene===id?' selected':'')} aria-pressed={scene===id} onClick={()=>onSelect(id)} title={description}><Icon size={17} aria-hidden="true"/><span>{name}</span></button>)}
  </div>
  {needsBody&&<div className="v3-scene-permission" role="status" aria-live="polite">
   <div><strong>{cameraBusy?'Menghubungkan pelacak Tubuh…':'Footprints menunggu kamera Body.'}</strong>
    <span>{cameraError||'Gerak kaki perlu pelacakan Tubuh. Browser mungkin meminta akses kamera.'}</span></div>
   <button type="button" className="v3-accent" disabled={cameraBusy} onClick={onUseBody}>{cameraBusy?'Menghubungkan…':cameraError?'Coba kamera lagi':'Gunakan Body & kamera'}</button>
   <button type="button" disabled={cameraBusy} onClick={onDismissBody}>Nanti</button>
  </div>}
  {waitingBody&&!needsBody&&<div className="v3-scene-reminder" role="status"><span>Footprints belum menerima gerak kaki.</span><button type="button" disabled={cameraBusy} onClick={onUseBody}>{cameraBusy?'Menghubungkan…':'Hubungkan kamera Body'}</button></div>}
 </section>;
}
