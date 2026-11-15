import {useState} from 'react';
import {Camera,Download,Footprints,Music2,Radio} from 'lucide-react';
import {Modal} from '../../components';
import {download,type Take} from '../../engine/recording';
import {PhotoPanel} from '../../photos/PhotoArchive';
import {cameraAvailable} from '../../photos/store';
import type {PhotoArchive} from '../../photos/usePhotoArchive';
import type {CameraCue} from '../../photos/useCameraCue';
import type {RefObject} from 'react';

export type CaptureTab='photo'|'recordings'|'pattern';
export function CaptureHub({onClose,initialTab='photo',archive,cue,videoRef,cameraBusy,onCamera,onOpenBody,takes,playing,onPlay,
 onRecordAudio,audioRecording,onRecordVideo,videoRecording,patternAvailable,patternCount,onPNG,onSVG,onJSON,onImportJSON,onClearView,onNewSession}:{
 onClose:()=>void;initialTab?:CaptureTab;archive:PhotoArchive;cue:CameraCue;videoRef:RefObject<HTMLVideoElement|null>;
 cameraBusy:boolean;onCamera:()=>void;onOpenBody:()=>void;
 takes:Take[];playing:string|null;onPlay:(take:Take)=>void;onRecordAudio:()=>void;audioRecording:boolean;
 onRecordVideo:()=>void;videoRecording:boolean;patternAvailable:boolean;patternCount:number;
 onPNG:()=>void;onSVG:()=>void;onJSON:()=>void;onImportJSON:(file:File)=>void;onClearView:()=>void;onNewSession:()=>void;
}){
 const [tab,setTab]=useState<CaptureTab>(initialTab);
 return <Modal title="Capture & Sesi" onClose={onClose} wide>
  <div className="v3-capture" aria-label="Pusat penyimpanan SOMA">
   <div className="v3-capture-tabs" role="tablist" aria-label="Jenis hasil">
    {([['photo','Foto',Camera],['recordings','Rekaman',Radio],['pattern','Pola',Footprints]] as const).map(([id,label,Icon])=><button type="button" key={id} role="tab" aria-selected={tab===id} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}
   </div>
   {tab==='photo'&&<section role="tabpanel" aria-label="Capture foto">
    <PhotoPanel cue={cue} archive={archive} cameraBusy={cameraBusy} cameraReady={cameraAvailable(videoRef.current)} onCamera={onCamera} onOpenBody={onOpenBody}/>
   </section>}
   {tab==='recordings'&&<section className="v3-capture-pane" role="tabpanel" aria-label="Rekaman audio dan video">
    <div className="v3-capture-actions">
     <button className="v3-accent" type="button" onClick={onRecordAudio}><Music2 size={17}/>{audioRecording?'Stop rekam audio':'Rekam audio'}</button>
     <button type="button" disabled={!patternAvailable} onClick={onRecordVideo}><Radio size={17}/>{videoRecording?'Stop video Footprints':'Rekam video Footprints'}</button>
    </div>
    <p>Video Footprints akan diunduh setelah perekaman dihentikan. Rekaman audio di bawah tersimpan untuk sesi browser saat ini.</p>
    <div className="v3-recording-list">{takes.length===0?<div className="v3-empty">Belum ada rekaman audio.</div>:takes.map(t=><div className="v3-take" key={t.id}>
     <div><b>{t.name}</b><small>{t.duration.toFixed(1)} dtk · {t.mime}</small></div>
     <button type="button" onClick={()=>onPlay(t)}>{playing===t.id?'Jeda':'Putar'}</button>
     <button type="button" onClick={()=>download(t.blob,'SOMA-AUDIO-'+t.id.slice(0,8)+(t.mime.includes('mp4')?'.m4a':'.webm'))}><Download size={16}/> Unduh</button>
    </div>)}</div>
   </section>}
   {tab==='pattern'&&<section className="v3-capture-pane" role="tabpanel" aria-label="Simpan pola Footprints">
    <div className="v3-pattern-count"><Footprints size={20}/><div><b>Pola gerak Footprints</b><span>{patternAvailable?patternCount+' sampel sesi':'Pilih scene Footprints untuk mengekspor pola.'}</span></div></div>
    <div className="v3-capture-actions">
     <button type="button" disabled={!patternAvailable} className="v3-accent" onClick={onPNG}>Unduh PNG</button>
     <button type="button" disabled={!patternAvailable} onClick={onSVG}>Unduh SVG</button>
     <button type="button" disabled={!patternAvailable} onClick={onJSON}>Unduh JSON</button>
    </div>
    <label className="v3-control-label">Buka sesi Footprints (.json)
     <input type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)onImportJSON(f);e.target.value='';}}/>
    </label>
    <div className="v3-capture-actions v3-secondary-actions">
     <button type="button" disabled={!patternAvailable} onClick={onClearView}>Bersihkan tampilan</button>
     <button type="button" disabled={!patternAvailable} onClick={onNewSession}>Mulai sesi baru</button>
    </div>
    <p>PNG/SVG memuat hasil visual dari sampel sesi. Bersihkan tampilan menjaga data sesi; sesi baru menghapus sampel sementara setelah konfirmasi.</p>
   </section>}
  </div>
 </Modal>;
}
