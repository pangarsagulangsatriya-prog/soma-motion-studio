import {Camera,ChevronRight,Clapperboard,Film,Monitor,Play,
 ShieldAlert,SlidersHorizontal,Video,X} from 'lucide-react';
import type {FootprintConfig,FootprintStyle} from '../../footprints/StudioFootprints.tsx';
import type {FootprintsStep} from './footprintsFlow.ts';
import {palettes} from '../../footprints/pattern.ts';
import './footprints-flow.css';

type Props={
 step:FootprintsStep;onClose:()=>void;
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;cameraLabel:string;
 floorConfirmed:boolean;floorCalibrated:boolean;cameraMatched:boolean;
 floorContacts:number;floorEvents:number;floorReason:string;
 performerCount:1|2;onPerformerCount:(count:1|2)=>void;
 identityAmbiguous:boolean;identities:number;maskStatus:string;
 footprint:FootprintConfig;updateFootprint:(patch:Partial<FootprintConfig>)=>void;
 bodyReady:boolean;floorReady:boolean;projectionReason:string;
 onStartBody:()=>void;onPhone:()=>void;onEditFloor:()=>void;onVideo:()=>void;onSimulation:()=>void;
 onCalibration:()=>void;onRehearsal:()=>void;onMapping:()=>void;onComposer:()=>void;
 onProjector:()=>void;onOutputQA:()=>void;
};
const headings={
 input:['Input','Dari mana geraknya?'],
 process:['Process','Baca gerak kaki'],
 compose:['Compose','Atur bentuk & arsip'],
 output:['Output','Hubungkan ke Projector']
} as const;

export function FootprintsFlowInspector({
 step,onClose,cameraOn,cameraBusy,cameraError,cameraLabel,
 floorConfirmed,floorCalibrated,cameraMatched,floorContacts,floorEvents,floorReason,
 performerCount,onPerformerCount,identityAmbiguous,identities,maskStatus,
 footprint,updateFootprint,bodyReady,floorReady,projectionReason,
 onStartBody,onPhone,onEditFloor,onVideo,onSimulation,onCalibration,onRehearsal,
 onMapping,onComposer,onProjector,onOutputQA
}:Props){
 const [name,title]=headings[step];
 return <div className="fp-flow-inspector">
  <header className="fp-flow-inspector-head">
   <div><small>FOOTPRINTS / {name.toUpperCase()}</small>
    <h2 id="fp-flow-inspector-title" tabIndex={-1}>{title}</h2></div>
   <button type="button" onClick={onClose} title="Tutup panel (Esc)" aria-label="Tutup pengaturan"><X size={17}/></button>
  </header>
  <div className="fp-flow-inspector-body">
   {step==='input'&&<>
    <p className="fp-flow-note">Gunakan menu INPUT di atas untuk memilih sumber live. MP4 dan Simulasi 3D tetap berada di Lab.</p>
    <button type="button" className="fp-flow-primary" onClick={onStartBody} disabled={cameraBusy}>
     <Camera size={17}/>{cameraBusy?'Menghubungkan…':cameraOn?'Kamera aktif · periksa':'Hubungkan webcam'}</button>
    <button type="button" onClick={onPhone}><Camera size={16}/>
     Hubungkan kamera HP <ChevronRight size={15}/></button>
    <div className="fp-flow-divider"/>
    <p className="fp-flow-label">SUMBER UNTUK EKSPERIMEN</p>
    <button type="button" onClick={onVideo}><Film size={17}/> Gunakan rekaman MP4</button>
    <button type="button" onClick={onSimulation}><Play size={17}/> Simulasi 3D tanpa kamera</button>
    <p className="fp-flow-note">MP4 dan simulasi berjalan di lingkungan eksperimen. Hasilnya tidak otomatis mengaktifkan proyektor fisik.</p>
    <div className="fp-flow-readout"><span>Kamera</span><strong>{cameraLabel}</strong></div>
    {cameraError&&<p role="alert" className="fp-flow-warning">{cameraError}</p>}
   </>}
   {step==='process'&&<>
    <p className="fp-flow-note">Periksa identitas, kontak kaki, dan bidang lantai sebelum mengirim hasil ke komposisi.</p>
    <p className="fp-flow-label">JUMLAH PERFORMER</p>
    <div className="fp-flow-choices">
     {([1,2] as const).map(value=><button type="button" key={value}
      aria-pressed={performerCount===value} onClick={()=>onPerformerCount(value)}>
      {value} performer</button>)}
    </div>
    <div className="fp-flow-readout"><span>Identitas</span><strong>{
     identityAmbiguous?'Ambigu / tahan':identities===performerCount?'Terbaca':'Belum lengkap'
    }</strong></div>
    <div className="fp-flow-readout"><span>Kalibrasi lantai</span><strong>{
     floorConfirmed&&cameraMatched?'Terkonfirmasi':floorCalibrated?'Perlu pemeriksaan':'Belum ada'
    }</strong></div>
    <button type="button" className="fp-flow-primary" onClick={onEditFloor}>
     <SlidersHorizontal size={16}/> Tandai 4 titik lantai</button>
    <button type="button" onClick={onCalibration}><SlidersHorizontal size={16}/>
     Calibration & QA lanjutan</button>
    <details className="fp-flow-advanced">
     <summary>Event & diagnostik</summary>
     <div className="fp-flow-readout"><span>Contact</span><strong>{floorContacts}</strong></div>
     <div className="fp-flow-readout"><span>Event</span><strong>{floorEvents}</strong></div>
     <p className="fp-flow-note">{floorReason}</p>
     <button type="button" onClick={onRehearsal}><Video size={15}/> Uji dengan Rehearsal Lab</button>
    </details>
   </>}
   {step==='compose'&&<>
    <p className="fp-flow-note">Tentukan respons terhadap pijakan, lalu pilih arsip yang akan ditempatkan pada tubuh atau lantai.</p>
    <p className="fp-flow-label">BENTUK JEJAK</p>
    <div className="fp-flow-choices">
     {(['Campuran','Tapak','Garis','Titik'] as FootprintStyle[]).map(style=>
      <button type="button" key={style} aria-pressed={footprint.style===style}
       onClick={()=>updateFootprint({style})}>{style}</button>)}
    </div>
    <button type="button" className="fp-flow-primary" onClick={onComposer}>
     <Clapperboard size={17}/> Surface Composer <ChevronRight size={15}/></button>
    <button type="button" onClick={onMapping}><Film size={16}/> Arsip BODY / FLOOR</button>
    <details className="fp-flow-advanced">
     <summary>Ukuran, durasi & warna</summary>
     <label>Ukuran jejak · {footprint.size}px
      <input type="range" min="12" max="90" value={footprint.size}
       onChange={e=>updateFootprint({size:Number(e.target.value)})}/></label>
     <label>Umur jejak · {footprint.life} detik
      <input type="range" min="1" max="60" value={footprint.life}
       onChange={e=>updateFootprint({life:Number(e.target.value)})}/></label>
     <label>Palet
      <select value={footprint.palette} onChange={e=>{
       const idx=Number(e.target.value),palette=palettes[idx]??palettes[0];
       updateFootprint({palette:idx,colors:{
        background:palette[1],left:palette[2],right:palette[3]
       }});
      }}>{palettes.map((p,i)=><option value={i} key={p[0]}>{p[0]}</option>)}</select>
     </label>
    </details>
    <div className="fp-flow-readout"><span>BODY mask</span><strong>{maskStatus}</strong></div>
   </>}
   {step==='output'&&<>
    <p className="fp-flow-note">Periksa sinyal BODY dan FLOOR sebelum membuka sistem output proyektor.</p>
    <div className="fp-flow-readout"><span>BODY</span><strong>{bodyReady?'Siap':'Belum siap'}</strong></div>
    <div className="fp-flow-readout"><span>FLOOR</span><strong>{floorReady?'Siap':'Belum siap'}</strong></div>
    <p className="fp-flow-note">{projectionReason}</p>
    <button type="button" className="fp-flow-primary" onClick={onOutputQA}>
     <Monitor size={17}/> WYSIWYG BODY/FLOOR & Output QA <ChevronRight size={15}/></button>
    <button type="button" onClick={onProjector}>
     <Monitor size={17}/> Projection Studio (legacy)</button>
    <button type="button" onClick={onCalibration}>
     <SlidersHorizontal size={16}/> Kalibrasi & pemeriksaan output</button>
    <p className="fp-flow-warning"><ShieldAlert size={15}/>
     Output fisik tetap memerlukan QA dan persetujuan. Blackout software tidak menggantikan pemutus daya proyektor.</p>
   </>}
  </div>
 </div>;
}
