import {Camera,CameraOff,Circle,Image,MonitorOff,Pause,Play,SlidersHorizontal} from 'lucide-react';
import type {UnifiedUnit} from './unifiedStageStatus.ts';
import type {LegacyOutputStatus} from './unifiedStageStatus.ts';

export function UnifiedStageStatusStrip({units,legacy}:{
 units:UnifiedUnit[];legacy:LegacyOutputStatus;
}){
 const label=legacy.connected?
  'Legacy: '+(legacy.mode==='blackout'?'Blackout diperintahkan':
   legacy.mode==='hold'?'Hold diperintahkan':'Live diperintahkan'):
  legacy.opened?'Legacy: menunggu sambungan':'Legacy: offline';
 return <div className="fp-status-bar" role="group" aria-label="Status terpadu SOMA Stage">
  {units.map(unit=><div key={unit.id} className="fp-status-tile"
   data-level={unit.level} title={unit.detail}>
   <span className="fp-status-led" aria-hidden="true"/>
   <span className="fp-status-content"><b>{unit.title}</b><small>{unit.detail}</small></span>
  </div>)}
  <div className="fp-status-legacy" title="Status software output tunggal, bukan hasil pengukuran cahaya fisik">
   {label}
  </div>
 </div>;
}
export function FootprintsStageTransport({cameraOn,cameraBusy,frameFresh,videoRecording,
 canRecordVideo,held,bodySelected,canPreview,legacy,onCamera,onRecordVideo,onCapture,onHold,onLivePreview,onBlackout,onOutputSettings}:{
 cameraOn:boolean;cameraBusy:boolean;frameFresh:boolean;videoRecording:boolean;
 canRecordVideo:boolean;held:boolean;bodySelected:boolean;canPreview:boolean;legacy:LegacyOutputStatus;
 onCamera:()=>void;onRecordVideo:()=>void;onCapture:()=>void;
 onHold:()=>void;onLivePreview:()=>void;onBlackout:()=>void;onOutputSettings:()=>void;
}){
 return <div className="fp-unified-transport" role="toolbar" aria-label="Transport utama SOMA Footprints">
  <div className="fp-transport-group" role="group" aria-label="Sumber dan rekaman">
   <span className="fp-transport-caption">INPUT / CAPTURE</span>
   <button type="button" onClick={onCamera} disabled={cameraBusy}
    title={cameraOn&&bodySelected?'Hentikan kamera; konfirmasi saat sedang merekam':'Hubungkan sumber kamera Body'}>
    {cameraOn&&bodySelected?<CameraOff size={16}/>:<Camera size={16}/>}
    <span>{cameraBusy?'Menghubungkan…':cameraOn&&bodySelected?'Stop Kamera':
     cameraOn?'Pakai Body':'Kamera'}</span>
   </button>
   <button type="button" className={videoRecording?'fp-transport-recording':''}
    onClick={onRecordVideo} disabled={!videoRecording&&!canRecordVideo}
    aria-pressed={videoRecording} title="Rekam video Footprints memakai engine Studio yang sudah ada">
    <Circle size={15} fill={videoRecording?'currentColor':'none'}/>
    <span>{videoRecording?'Stop REC':'Rekam'}</span>
   </button>
   <button type="button" onClick={onCapture} title="Buka Capture Hub">
    <Image size={16}/><span>Capture</span>
   </button>
  </div>
  <div className="fp-transport-group" role="group" aria-label="Kontrol preview lokal">
   <span className="fp-transport-caption">VISUAL PREVIEW</span>
   <button type="button" disabled={!canPreview||!held}
    aria-pressed={!held&&canPreview&&cameraOn&&frameFresh} onClick={onLivePreview}
    title="Lanjutkan preview BODY/FLOOR ke frame terbaru; tidak menyalakan proyektor">
    <Play size={15}/><span>Live</span>
   </button>
   <button type="button" disabled={!canPreview||!cameraOn||!frameFresh||held}
    aria-pressed={held} onClick={onHold}
    title="Tahan raster BODY/FLOOR di Live Stage; tracking dan event kaki tetap berjalan">
    <Pause size={15}/><span>Hold</span>
   </button>
  </div>
  <div className="fp-transport-group fp-transport-output" role="group" aria-label="Kontrol output panggung">
   <span className="fp-transport-caption">STAGE OUTPUT</span>
   <button type="button" onClick={onOutputSettings} title="Kalibrasi, QA dan Live proyektor berada di panel output">
    <SlidersHorizontal size={15}/><span>Output QA</span>
   </button>
   <button type="button" className="fp-transport-blackout" onClick={onBlackout}
    title="Kirim Blackout ke output lama dan kedua output BODY/FLOOR; matikan perangkat fisik bila darurat">
    <MonitorOff size={16}/><span>BLACKOUT</span>
   </button>
   <small className="fp-transport-output-caption">{legacy.connected?
    'Legacy '+legacy.mode.toUpperCase():'Jendela proyektor belum tersambung'}</small>
  </div>
 </div>;
}
