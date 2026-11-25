/** PF-UX-01/04 — one honest destination contract for the Perform panel.
 * These labels only describe observable browser/session state. They never grant light. */
import type {PerformOutputRouteMode,PerformPrimaryAction,PerformSurfaceBadge} from './performOutputModel.ts';

export const PERFORM_DESTINATIONS=[
 {id:'soma',label:'SOMA Direct',medium:'Visual · Proyektor',description:'Visual FLOOR/BODY → fullscreen proyektor. LIVE perlu izin build dan QA fisik di Perform.'},
 {id:'resolume',label:'Resolume',medium:'Visual · Clean Feed',description:'Jendela 16:9 → OBS → Syphon/Spout → Resolume. Feed terbuka belum membuktikan penerimaan di Resolume.'},
 {id:'touchdesigner',label:'TouchDesigner',medium:'Data · Kaki A/B',description:'Posisi kaki, kontak, slide, pivot dan cue melalui WebSocket lokal. Visual dan izin proyektor dikelola di TouchDesigner.'}
] as const satisfies ReadonlyArray<{id:PerformOutputRouteMode;label:string;medium:string;description:string}>;
/** All three output destinations are visible and equally selectable in Perform. */
export const PRIMARY_PERFORM_DESTINATIONS=PERFORM_DESTINATIONS;

export type DestinationTone='locked'|'attention'|'idle'|'open'|'live';
export type DestinationPresentation={
 state:string;hint:string;tone:DestinationTone;
 action:string;kind:'info'|'setup'|'open'|'review'|'qa'|'arm'|'live'|'td-panel';
};

export function presentPerformDestination(input:{
 route:PerformOutputRouteMode;
 primary:PerformPrimaryAction;
 sourceReady?:boolean;
 playback?:boolean;
 floor:PerformSurfaceBadge;
 body:PerformSurfaceBadge;
}):DestinationPresentation{
 const {route,primary,floor,body}=input;
 if(route==='touchdesigner')return {
  state:'Koneksi lokal',hint:'Status koneksi ditampilkan pada panel TouchDesigner.',
  tone:'idle',action:'Atur koneksi',kind:'td-panel'
 };
 if(route==='resolume'){
  // A feed can be opened without any source; never call that a usable connection.
  if(input.sourceReady===false)return {
   state:'Sumber belum siap',hint:'Buka Track dan pilih sumber gerak sebelum membuka Feed SOMA.',
   tone:'attention',action:'Buka Track',kind:'setup'
  };
  const open=floor.opened||body.opened;
  const connected=floor.connected||body.connected;
  const streaming=floor.status==='Feed'||body.status==='Feed';
  return open?{
   state:streaming?'Feed SOMA aktif':connected?'Feed Blackout / HOLD':'Menunggu sambungan',
   hint:streaming?'Frame sampai ke jendela SOMA. Hubungkan OBS Syphon/Spout; Resolume belum terverifikasi.':
    'Feed terbuka, tetapi frame belum mengalir. Periksa sumber dan klik Lanjutkan Visual.',
   tone:streaming?'live':'open',
   action:floor.opened?'Lihat / Aktifkan FLOOR':'Buka Feed FLOOR',kind:'review'
  }:{
   state:'Feed belum dibuka',hint:'Buka Clean Feed 16:9 lalu tangkap jendelanya lewat OBS agar tersedia di Resolume.',
   tone:'idle',action:'Buka Feed FLOOR',kind:'open'
  };
 }
 // SOMA Direct respects the exact existing physical-output authorization model.
 switch(primary.kind){
  case 'build-locked':return {state:'Terkunci · build',hint:'Output fisik dinonaktifkan pada build ini.',tone:'locked',action:'Mengapa terkunci?',kind:'info'};
  case 'preview-only':return {state:'Terkunci · latihan',hint:'MP4/3D hanya untuk pratinjau.',tone:'locked',action:'Lihat syarat output',kind:'info'};
  case 'fix-setup':return {state:'Perlu setup',hint:primary.detail,tone:'attention',action:'Perbaiki setup',kind:'setup'};
  case 'open-output':return {state:'Siap dibuka',hint:'Jendela baru dimulai Blackout.',tone:'idle',action:'Buka Output',kind:'open'};
  case 'run-qa':return {state:'Terbuka · Blackout',hint:'Ukur lima target, periksa Blackout dan catat hasil pada bidang aktif.',tone:'open',action:'Uji dan ukur proyektor',kind:'qa'};
  case 'arm-playback':return {state:'Terbuka · Blackout',hint:primary.detail,tone:'open',action:primary.label,kind:'arm'};
  case 'arm-live':return {state:'Terbuka · siap diuji',hint:'Hanya setelah QA dan konfirmasi operator.',tone:'open',action:primary.label,kind:'arm'};
  case 'monitor-live':return {state:input.playback?'Playback aktif':'LIVE',hint:'Gunakan BLACKOUT ketika perlu memadamkan output.',tone:'live',action:input.playback?'Lihat Playback':'Lihat Output LIVE',kind:'live'};
 }
}
export function routeChangeRequiresBlackout(previous:PerformOutputRouteMode,next:PerformOutputRouteMode){
 return previous!==next;
}
/** A local cue never authorizes projected media, except an explicitly active TD data cue bridge. */
export function performCueScope(route:PerformOutputRouteMode):string{
 return route==='touchdesigner'
  ?'Tampilan operator; cue juga dikirim ke TouchDesigner saat data sedang mengalir.'
  :'Cue mengganti tampilan monitor operator saja. Keluaran fisik tetap mengikuti Compose/Map.';
}
