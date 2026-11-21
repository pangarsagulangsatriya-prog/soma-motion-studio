import type {FootprintsInputChoice} from './sourceSwitchModel.ts';
import type {DualSurfaceState} from '../../footprints/stage-optics/DualSurfaceTelemetry.ts';

export type SafeProjectionAction=
 'choose-camera'|'inspect-tracking'|'confirm-floor'|'open-output-qa'|'monitor-output';
export type SafeProjectionStep='source'|'tracking'|'floor'|'output'|'ready'|'software-only';
export type SafeProjectionPreflight={
 step:SafeProjectionStep;action:SafeProjectionAction;
 label:string;detail:string;progress:number;total:4;
 physicalReady:boolean;softwareOnly:boolean;fault:boolean;
};
export type SafeProjectionInput={
 source:FootprintsInputChoice|null;
 cameraOn:boolean;cameraBusy:boolean;bodySelected:boolean;frameFresh:boolean;
 identities:number;performers:1|2;identityAmbiguous:boolean;matchedFrame:boolean;
 floorConfirmed:boolean;cameraMatched:boolean;
 hardwareEnabled:boolean;floorOutput:DualSurfaceState;
};
/** One-click navigation points to an existing safe operator action.
 * A successful software preflight NEVER grants optical output authority.
 * The 5-point physical QA + operator confirm still live in the output router. */
export function safeProjectionPreflight(c:SafeProjectionInput):SafeProjectionPreflight{
 const offline=c.source==='video'||c.source==='simulator';
 const sourceReady=!!c.source&&(offline?c.frameFresh:c.cameraOn&&c.bodySelected);
 const identityReady=sourceReady&&(offline||(
  c.frameFresh&&!c.identityAmbiguous&&c.identities>=c.performers&&
  (c.performers===1||c.matchedFrame)));
 const floorReady=identityReady&&(offline||(c.floorConfirmed&&c.cameraMatched));
 const connected=c.floorOutput.connected;
 const qaReady=c.floorOutput.qa==='within-provisional-target';
 const physicalReady=!!(floorReady&&c.hardwareEnabled&&connected&&qaReady&&
  c.floorOutput.mode==='live');
 const progress=[sourceReady,identityReady,floorReady,connected].filter(Boolean).length;
 const result=(step:SafeProjectionStep,action:SafeProjectionAction,
  label:string,detail:string,fault=false):SafeProjectionPreflight=>({
   step,action,label,detail,progress,total:4,physicalReady:false,
   softwareOnly:!c.hardwareEnabled,fault
  });
 if(!sourceReady&&offline)return result('tracking','inspect-tracking','Muat MP4 / 3D',
  'Buka Track dan pastikan frame video atau simulasi sudah tampil.');
 if(!sourceReady)return result('source','choose-camera',
  c.cameraBusy?'Menunggu kamera':'Hubungkan kamera',
  c.cameraBusy?'Permintaan izin kamera sedang berlangsung.':
   'Pilih Webcam/USB, atau kamera HP yang sudah tersambung.');
 if(!identityReady)return result('tracking','inspect-tracking','Periksa tracking',
  c.identityAmbiguous?'Identitas A/B masih ambigu.':
   'Tunggu frame baru dan deteksi performer yang valid.',true);
 if(!floorReady)return result('floor','confirm-floor','Periksa lantai',
  'Konfirmasi empat titik dengan perangkat kamera aktif.',true);
 if(!c.hardwareEnabled)return result('software-only','open-output-qa',
  'Periksa preview output','Build Production ini masih mengunci proyeksi fisik.');
 if(physicalReady)return {
  step:'ready',action:'monitor-output',label:'Output LIVE · pantau',
  detail:'Perintah LIVE dilaporkan oleh software. Tetap periksa cahaya di panggung.',
  progress:4,total:4,physicalReady:true,softwareOnly:false,fault:false
 };
 return result('output','open-output-qa',
  !connected?'Siapkan proyektor':!qaReady?'Selesaikan QA proyektor':'Buka kontrol Perform',
  !connected?'Buka output pada layar kedua lalu lakukan QA fisik lima titik.':
   !qaReady?'Pengukuran lima titik dan persetujuan operator belum lengkap.':
    'Jendela dan QA sudah siap; tekan Perform FLOOR di panel output.',
  !connected||c.floorOutput.mode==='offline');
}
/** No software action may automatically turn on physical light after loss of
 * tracking, renderer heartbeat, stage authorization or artwork source. */
export function shouldLatchProjectionBlackout(input:{
 requested:'blackout'|'test'|'live';connected:boolean;
 stageSafe:boolean;sourceSafe:boolean;
}):boolean{
 return input.requested==='live'&&
  (!input.connected||!input.stageSafe||!input.sourceSafe);
}
