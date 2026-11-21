/** PF-R1/PF-R2 — Pure Perform readiness, dual-surface badge & single dynamic CTA model.
 * Never authorizes physical light on its own; strictly reflects DualSurfaceSessionStore + preflight truth. */
import type {StageSurface} from '../../footprints/stage-optics/DualSurfaceCalibration.ts';
import type {SurfaceDeviceState} from '../../footprints/stage-optics/DualSurfaceSessionStore.ts';

export type PerformSurfaceBadge={
 surface:StageSurface;
 label:'FLOOR'|'BODY';
 status:'Offline'|'Blackout'|'Test'|'LIVE'|'Feed';
 tone:'off'|'blackout'|'test'|'live'|'feed';
 connected:boolean;
 opened:boolean;
};

export type PerformGlobalStatus={
 label:'Belum siap'|'Preview siap'|'Output siap'|'LIVE';
 tone:'warn'|'preview'|'ready'|'live';
};

export type PerformOutputRouteMode='soma'|'resolume'|'touchdesigner';

export function buildResolumeFeedUrl(
 origin:string,
 sessionId:string,
 surface:StageSurface
):string{
 const base=origin.replace(/\/+$/,'');
 return `${base}/?bodyProjection=${encodeURIComponent(sessionId)}&stageSurface=${encodeURIComponent(surface)}&feed=resolume`;
}

export type PerformPrimaryAction={
 kind:'build-locked'|'preview-only'|'fix-setup'|'open-output'|'run-qa'|'arm-live'|'monitor-live';
 label:string;
 detail:string;
 surface:StageSurface;
};

export type PerformOutputSummaryInput={
 hardwareEnabled:boolean;
 source:'webcam'|'phone'|'video'|'simulator'|null;
 cameraOk:boolean;
 identityOk:boolean;
 floorOk:boolean;
 floorDevice:SurfaceDeviceState;
 bodyDevice:SurfaceDeviceState;
 floorQaOk:boolean;
 bodyQaOk:boolean;
 operatorConfirm:boolean;
};

export function deriveSurfaceBadge(surface:StageSurface,device:SurfaceDeviceState):PerformSurfaceBadge{
 const label=surface==='floor'?'FLOOR':'BODY';
 if(!device.connected){
  return {surface,label,status:'Offline',tone:'off',connected:false,opened:device.opened};
 }
 if(device.mode==='live'){
  return {surface,label,status:'LIVE',tone:'live',connected:true,opened:true};
 }
 if(device.mode==='feed'){
  return {surface,label,status:'Feed',tone:'feed',connected:true,opened:true};
 }
 if(device.mode==='test'){
  return {surface,label,status:'Test',tone:'test',connected:true,opened:true};
 }
 return {surface,label,status:'Blackout',tone:'blackout',connected:true,opened:true};
}

export function evaluatePerformOutputSummary(input:PerformOutputSummaryInput):{
 globalStatus:PerformGlobalStatus;
 floorBadge:PerformSurfaceBadge;
 bodyBadge:PerformSurfaceBadge;
 primaryAction:PerformPrimaryAction;
 canOpenOutput:boolean;
}{
 const floorBadge=deriveSurfaceBadge('floor',input.floorDevice);
 const bodyBadge=deriveSurfaceBadge('body',input.bodyDevice);
 const softwareOnly=input.source==='video'||input.source==='simulator';
 const anyConnected=floorBadge.connected||bodyBadge.connected;
 const anyLive=floorBadge.tone==='live'||bodyBadge.tone==='live';
 const floorReadyForLive=floorBadge.connected&&input.floorQaOk;
 const bodyReadyForLive=bodyBadge.connected&&input.bodyQaOk;
 const anyReadyForLive=floorReadyForLive||bodyReadyForLive;
 const targetSurface:StageSurface=floorReadyForLive||!bodyBadge.connected?'floor':'body';

 // Report the actual missing input first. A build flag never makes an
 // unplugged camera or an uncalibrated floor usable.
 if(!input.cameraOk||!input.identityOk||!input.floorOk){
  const detail=!input.cameraOk
   ?input.source==='phone'
    ?'Kamera HP belum mengirim pose valid. Buka Track, sambungkan HP dan periksa framing.'
    :input.source==='video'
     ?'Video MP4 belum menghasilkan frame valid. Putar video di Track.'
     :input.source==='simulator'
      ?'Simulasi 3D belum menghasilkan frame. Buka Track dan jalankan gerak.'
      :'Sumber belum menghasilkan pose valid. Buka Track dan aktifkan kamera.'
   :!input.identityOk
    ?'Identitas performer A/B belum stabil. Periksa dua tubuh di Track.'
    :'Kalibrasi lantai atau kecocokan kamera belum valid. Periksa Track dan Map.';
  return {
   globalStatus:{label:'Belum siap',tone:'warn'},
   floorBadge,bodyBadge,canOpenOutput:input.hardwareEnabled,
   primaryAction:{kind:'fix-setup',label:'Perbaiki Setup',detail,surface:'floor'}
  };
 }

 if(!input.hardwareEnabled){
  return {
   globalStatus:{label:'Preview siap',tone:'preview'},
   floorBadge,bodyBadge,canOpenOutput:false,
   primaryAction:{
    kind:'build-locked',
    label:'Preview Lokal · Output Build Terkunci',
    detail:'Build ini belum mengizinkan proyektor fisik. Gunakan preview Compose; periksa rilis GitHub Pages.',
    surface:'floor'
   }
  };
 }

 if(!anyConnected){
  return {
   globalStatus:{label:'Preview siap',tone:'preview'},
   floorBadge,bodyBadge,canOpenOutput:true,
   primaryAction:{
    kind:'open-output',
    label:'Buka Output Proyektor',
    detail:'Membuka jendela output bersih (mulai Blackout). Pindahkan ke proyektor lalu tekan F.',
    surface:'floor'
   }
  };
 }

 if(anyLive){
  return {
   globalStatus:{label:'LIVE',tone:'live'},
   floorBadge,bodyBadge,canOpenOutput:true,
   primaryAction:{
    kind:'monitor-live',
    label:'Lihat Output · LIVE',
    detail:'Output proyektor aktif. Tekan BLACKOUT (B / Esc) kapan saja untuk memadamkan.',
    surface:floorBadge.tone==='live'?'floor':'body'
   }
  };
 }

 if(!anyReadyForLive){
  return {
   globalStatus:{label:'Output siap',tone:'ready'},
   floorBadge,bodyBadge,canOpenOutput:true,
   primaryAction:{
    kind:'run-qa',
    label:'Uji Proyektor & QA Map',
    detail:'Jendela output terkoneksi (Blackout). Lengkapi pola uji dan QA 5 titik di Map sebelum LIVE.',
    surface:targetSurface
   }
  };
 }

 return {
  globalStatus:{label:'Output siap',tone:'ready'},
  floorBadge,bodyBadge,canOpenOutput:true,
  primaryAction:{
   kind:'arm-live',
   label:input.operatorConfirm?'Aktifkan LIVE':'Konfirmasi & Aktifkan LIVE',
   detail:'Semua gate software & QA 5 titik lulus. Klik untuk menyalakan proyektor secara eksplisit.',
   surface:targetSurface
  }
 };
}
