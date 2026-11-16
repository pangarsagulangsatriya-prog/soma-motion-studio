import type {DualSurfaceState} from '../../footprints/stage-optics/DualSurfaceTelemetry.ts';

export type UnifiedLevel='ok'|'warn'|'idle';
export type UnifiedUnit={id:'camera'|'identity'|'calibration'|'body'|'floor';
 title:string;detail:string;level:UnifiedLevel};
export type UnifiedContext={
 camera:{on:boolean;busy:boolean;error:string;frameFresh:boolean;bodySelected:boolean};
 identity:{count:1|2;visibleCount:number;ambiguous:boolean;observedSameFrame:boolean};
 floor:{calibrated:boolean;confirmed:boolean;cameraMatched:boolean;contacts:number};
 bodyMask:{ready:boolean;reason:string};
 dual:{body:DualSurfaceState;floor:DualSurfaceState};
 hardwareEnabled:boolean;
};
const item=(id:UnifiedUnit['id'],title:string,detail:string,level:UnifiedLevel):UnifiedUnit=>({
 id,title,detail,level
});
/** UI indicators describe data/software routing, never measured photon states. */
export function deriveUnifiedStageStatus(c:UnifiedContext):UnifiedUnit[]{
 const camera=c.camera.error?item('camera','Kamera','Gagal: '+c.camera.error,'warn'):
  c.camera.busy?item('camera','Kamera','Menghubungkan','idle'):
  !c.camera.on?item('camera','Kamera','Mati','idle'):
  !c.camera.bodySelected?item('camera','Kamera','Pilih sumber Body','warn'):
  c.camera.frameFresh?item('camera','Kamera','Tracking aktif','ok'):
  item('camera','Kamera','Mencari tubuh / frame','warn');
 const identity=!c.camera.frameFresh?
  item('identity','Performer','Belum terbaca','idle'):
  c.identity.count===1?
   item('identity','Performer','1 performer · kamera','ok'):
   c.identity.ambiguous||!c.identity.observedSameFrame?
    item('identity','Performer A/B','Identitas ambigu','warn'):
    c.identity.visibleCount===2?
     item('identity','Performer A/B','A + B terbaca','ok'):
     item('identity','Performer A/B','Menunggu 2 orang','warn');
 const calibration=!c.floor.calibrated?
  item('calibration','Lantai','Belum dikalibrasi','idle'):
  !c.floor.confirmed?
   item('calibration','Lantai','Belum dikonfirmasi','warn'):
   !c.floor.cameraMatched||!c.camera.frameFresh?
    item('calibration','Lantai','Periksa kamera / tracking','warn'):
    item('calibration','Lantai','Terkalibrasi (estimasi)','ok');
 const output=(surface:'body'|'floor'):UnifiedUnit=>{
  const s=c.dual[surface],id=surface;
  const label=surface==='body'?'BODY Output':'FLOOR Output';
  if(!c.hardwareEnabled)return item(id,label,'Terkunci di Production','idle');
  if(!s.reported)return item(id,label,'Panel output ditutup','idle');
  if(!s.connected)return item(id,label,s.opened?'Jendela belum tersambung':'Output offline',
   s.opened?'warn':'idle');
  if(s.mode==='live')return item(id,label,'LIVE diperintahkan · QA '+(
   s.qa==='within-provisional-target'?'tercatat':'belum lengkap'),'warn');
  if(s.mode==='test')return item(id,label,'TEST terbatas · diawasi','warn');
  return item(id,label,'Blackout diperintahkan','ok');
 };
 return [camera,identity,calibration,output('body'),output('floor')];
}
export type LegacyOutputStatus={
 opened:boolean;connected:boolean;mode:'live'|'hold'|'blackout';
 approved:boolean;
};
export type LegacyTransportGate={canLive:boolean;canHold:boolean;reason:string};
/** No stage toolbar button may auto-open a physical projector. */
export function legacyStageTransportGate(input:{
 cameraOn:boolean;frameFresh:boolean;floorConfirmed:boolean;
 cameraMatched:boolean;dualOpened:boolean;legacy:LegacyOutputStatus;
}):LegacyTransportGate{
 const l=input.legacy;
 if(input.dualOpened)return {canLive:false,canHold:false,
  reason:'Dual BODY/FLOOR sedang dipakai. Atur Live di panel kalibrasi masing-masing.'};
 if(!l.opened||!l.connected)return {canLive:false,canHold:false,
  reason:'Jendela output tunggal belum tersambung.'};
 if(!l.approved)return {canLive:false,canHold:false,
  reason:'Pengukuran / konfirmasi proyektor lama belum lengkap.'};
 if(!input.cameraOn||!input.frameFresh||!input.floorConfirmed||!input.cameraMatched)
  return {canLive:false,canHold:false,reason:'Tracking atau kalibrasi lantai tidak siap.'};
 return {canLive:true,canHold:l.mode==='live'||l.mode==='hold',
  reason:'Output lama dapat dikendalikan; keadaan cahaya fisik tetap harus diamati.'};
}
