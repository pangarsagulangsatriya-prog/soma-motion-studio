import {Camera,CameraOff,Circle,Image,MonitorOff,SlidersHorizontal} from 'lucide-react';
import {useEffect,useState} from 'react';
import type {UnifiedUnit} from './unifiedStageStatus.ts';
import type {LegacyOutputStatus} from './unifiedStageStatus.ts';
import type {DualSurfaceState} from '../../footprints/stage-optics/DualSurfaceTelemetry.ts';
import {softwareOutputIndicator} from './compactStageStatusModel.ts';

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
export function FootprintsStageTransport({cameraOn,cameraBusy,videoRecording,
 canRecordVideo,bodySelected,legacy,dual,experiment,onCamera,onRecordVideo,onCapture,
 onBlackout,onOutputSettings}:{
 cameraOn:boolean;cameraBusy:boolean;frameFresh:boolean;videoRecording:boolean;
 canRecordVideo:boolean;held:boolean;bodySelected:boolean;canPreview:boolean;
 experiment?:'video'|'simulator'|null;
 legacy:LegacyOutputStatus;dual:{body:DualSurfaceState;floor:DualSurfaceState};
 onCamera:()=>void;onRecordVideo:()=>void;onCapture:()=>void;
 onHold:()=>void;onLivePreview:()=>void;onBlackout:()=>void;onOutputSettings:()=>void;
}){
 const output=softwareOutputIndicator(legacy,dual);
 const [recordSeconds,setRecordSeconds]=useState(0);
 useEffect(()=>{
  if(!videoRecording){setRecordSeconds(0);return;}
  const started=Date.now();
  const interval=window.setInterval(()=>
   setRecordSeconds(Math.floor((Date.now()-started)/1000)),1000);
  return()=>window.clearInterval(interval);
 },[videoRecording]);
 const time=(Math.floor(recordSeconds/60).toString().padStart(2,'0')+':'+
  (recordSeconds%60).toString().padStart(2,'0'));
 return <div className="fp-unified-transport fp-compact-transport"
  data-has-input={cameraOn} data-recording={videoRecording}
  data-output-state={output.state}
  role="toolbar" aria-label="Kontrol Footprints dan keamanan projector">
  <div className="fp-transport-local" role="group" aria-label="Capture dan preview lokal">
   {cameraOn?<>
    <div className="fp-transport-group fp-transport-capture">
         <button type="button" onClick={onCamera} disabled={cameraBusy}
      title={cameraOn&&bodySelected?'Hentikan kamera; konfirmasi saat merekam':'Gunakan mode Body'}>
      {cameraOn&&bodySelected?<CameraOff size={16}/>:<Camera size={16}/>}
      <span>{cameraBusy?'Menghubungkan…':cameraOn&&bodySelected?'Stop kamera':'Pakai Body'}</span>
     </button>
     <button type="button" className={videoRecording?'fp-transport-recording':''}
      onClick={onRecordVideo} disabled={!videoRecording&&!canRecordVideo}
      aria-pressed={videoRecording} title="Rekam video Footprints memakai engine Studio yang ada">
      <Circle size={15} fill={videoRecording?'currentColor':'none'}/>
      <span>{videoRecording?'Stop REC':'Rekam'}</span>
      {videoRecording&&<output className="trk-transport-timer"
       aria-label="Durasi rekaman" aria-live="off">{time}</output>}
     </button>
     <button type="button" onClick={onCapture} title="Buka hasil, pola, dan ekspor di Capture Hub"
      aria-label="Buka hasil rekaman dan pola">
      <Image size={16}/><span>Hasil</span>
     </button>
    </div>
    {/* Live/Hold operate BODY/FLOOR raster, so they belong to Compose.
        Track shows only controls that act on its INPUT camera/session. */}
   </>:<span className="fp-transport-idle">{experiment?
    experiment==='video'?'MP4 · preview software':'Simulasi 3D · preview software':
    'Pilih sumber gerak'}</span>}
  </div>
  <div className="fp-transport-safety" role="group" aria-label="Projector dan Blackout">
   <div className="fp-transport-software" data-level={output.state}
    title={output.detail} aria-label={`Status output software: ${output.label}. ${output.detail}`}>
    <span className="fp-transport-software-led" aria-hidden="true"/>
    <span><small>OUTPUT SOFTWARE</small><strong>{
     output.state==='idle'&&output.label==='Jendela output belum tersambung'?
      'Belum terhubung':output.label
    }</strong></span>
   </div>
   <button type="button" className="fp-transport-projector" onClick={onOutputSettings}
    title="Buka Projector untuk kalibrasi, QA dan Live output fisik">
    <SlidersHorizontal size={16}/><span>Projector</span>
   </button>
   <button type="button" className="fp-transport-blackout" onClick={onBlackout}
    aria-label="BLACKOUT · perintahkan semua output software gelap"
    title="Perintahkan Blackout ke seluruh output software; gunakan pemutus fisik bila darurat">
    <MonitorOff size={17}/><span>BLACKOUT</span>
   </button>
  </div>
 </div>;
}
