import {insideFloor,floorToUV} from '../spatial/coordinates.ts';
import {validateFloorSession,type FootstepEvent} from '../spatial/events.ts';
import {floorRasterPoint} from './floorCanvas.ts';
import {floorArtworkProjectionConfig} from '../../projection/floorBridge.ts';
import {projectionMatrix,projectionDefaults} from '../../projection/model.ts';
import {homography,transform,type Quad} from '../../projection/geometry.ts';
import {shouldTransmitArtwork} from '../../projection/channel.ts';
import {QA_DURATION_MS,QA_FAULTS,qaContactCounts,qaOutputTransportAt,type QAScenario} from './QAScenario.ts';

export type QACheck={id:string;name:string;pass:boolean;detail:string};
export type QAReport={
 schema:'soma.footprints.simulation-qa';version:1;mode:'software-synthetic';
 durationMs:number;performers:2;floor:{widthM:number;depthM:number};
 eventCount:number;contactCount:number;skippedSteps:number;
 contactsByPerformer:ReturnType<typeof qaContactCounts>;
 checks:QACheck[];passed:number;total:number;ok:boolean;
 physicalAccuracyCm:null;physicalLatencyMs:null;
 note:string;
};
const skew:Quad=[{x:.07,y:.11},{x:.9,y:.06},{x:.95,y:.87},{x:.12,y:.92}];
const eq=(a:number,b:number,tol=1e-6)=>Math.abs(a-b)<=tol;
export function runSimulationQA(scenario:QAScenario):QAReport{
 const checks:QACheck[]=[];
 const check=(id:string,name:string,pass:boolean,detail:string)=>checks.push({id,name,pass,detail});
 const events=scenario.session.events;
 let schema=true;
 try{validateFloorSession(scenario.session);}catch{schema=false;}
 check('session-v3','Kontrak FloorSession V3',schema,
  'Validasi source, jenis event, koordinat, ID unik dan urutan waktu');
 check('full-duration','Skenario dua performer selama 15 menit',
  scenario.durationMs===QA_DURATION_MS&&events.length>1000&&events.at(-1)!.timestampMs>QA_DURATION_MS-3000,
  '900 detik gerakan sintetis; akhir event harus mendekati 15 menit');
 const counts=qaContactCounts(scenario);
 check('four-feet','Kaki A/B kiri-kanan independen',
  counts.A.left>100&&counts.A.right>100&&counts.B.left>100&&counts.B.right>100,
  JSON.stringify(counts));
 check('no-duplicates','Satu kontak per siklus pijakan',
  noDuplicateContacts(events),'Kontak pada kaki yang sama harus didahului swing/release');
 check('floor-bounds','Seluruh langkah berada pada bidang lantai',
  events.every(e=>insideFloor(scenario.floor,e.positionM)),
  'Tidak ada langkah di luar satuan meter dan batas lantai');
 const protectedFaults=QA_FAULTS.filter(x=>x.id==='tracking-loss'||x.id==='identity-crossing'||x.id==='camera-change');
 const gapOk=!scenario.faultsEnabled||protectedFaults.every(f=>
  !events.some(e=>e.kind==='contact'&&e.timestampMs>=f.startMs&&e.timestampMs<f.endMs));
 const recoveryOk=!scenario.faultsEnabled||protectedFaults.every(f=>
  ['A','B'].every(id=>events.some(e=>e.kind==='contact'&&e.performerId===id&&
   e.timestampMs>=f.endMs&&e.timestampMs<f.endMs+5000)));
 check('fault-quarantine','Tracking/identitas/kamera terputus tidak mencetak kontak',gapOk,
  'Kontak dalam rentang fault 03:40, 07:06 dan 10:09 ditahan');
 check('recovery','Kontak berlanjut setelah tiap fault',recoveryOk,
  'A/B kembali hanya setelah siklus swing → stance baru');
 const config=projectionDefaults();config.quad=skew;config.mirror=true;
 config.placement.rotation=28;config.placement.x=.15;config.registration.enabled=true;
 const final=floorArtworkProjectionConfig(config),matrix=projectionMatrix(final,{
  mask:{width:1,height:1,data:new Uint8Array(1)},aspect:16/9,time:0
 });
 const target=homography(skew);
 const samples=events.filter((e,i)=>e.kind==='contact'&&i%17===0);
 const aligned=samples.every(e=>{
  const uv=floorToUV(scenario.floor,e.positionM),pixel=floorRasterPoint(scenario.floor,e.positionM);
  const actual=transform(matrix,uv),expected=transform(target,uv);
  return eq(actual.x,expected.x)&&eq(actual.y,expected.y)&&
   eq(pixel.x,uv.x*1280)&&eq(pixel.y,uv.y*720);
 });
 check('single-warp','Floor → raster → kalibrasi proyektor sekali',aligned&&
  final.mirror===false&&final.registration.enabled===false&&
  final.placement.rotation===0,
  'Hasil transformasi cocok dengan satu homografi sudut proyektor');
 const outputGate=[{t:10000,expected:'live'},{t:735000,expected:'hold'},
  {t:813000,expected:'blackout'},{t:610000,expected:'blackout'}] as const;
 const outputOk=outputGate.every(x=>{
  const state=qaOutputTransportAt(x.t,true,scenario.faultsEnabled);
  if(!scenario.faultsEnabled)return state==='live';
  return state===x.expected&&shouldTransmitArtwork({
   transport:state,blank:state==='blackout',pattern:false
  })===(state==='live');
 })&&qaOutputTransportAt(10000,false,scenario.faultsEnabled)==='blackout';
 check('transport-gate','Live/Hold/Blackout dan izin kalibrasi',outputOk,
  'Hold/Blackout menolak frame baru, konfirmasi lantai wajib untuk Live');
 check('simulation-only','Jejak sintetis tidak disamakan dengan bukti fisik',
  events.every(e=>e.source==='simulation'&&e.positionBasis==='simulated'&&e.kind!=='prediction'),
  'Tidak ada kontak kamera, hasil ukur fisik, maupun jejak bayangan yang disimpan');
 const passed=checks.filter(c=>c.pass).length,contacts=events.filter(e=>e.kind==='contact').length;
 return {schema:'soma.footprints.simulation-qa',version:1,mode:'software-synthetic',
  durationMs:scenario.durationMs,performers:2,
  floor:{widthM:scenario.floor.widthM,depthM:scenario.floor.depthM},
  eventCount:events.length,contactCount:contacts,skippedSteps:scenario.skippedSteps,
  contactsByPerformer:counts,checks,passed,total:checks.length,ok:passed===checks.length,
  physicalAccuracyCm:null,physicalLatencyMs:null,
  note:'PASS hanya berarti invariant software lulus pada data sintetis. Webcam, identitas dua tubuh nyata, akurasi lantai, dan latensi cahaya proyektor tetap membutuhkan pengujian fisik.'};
}
function noDuplicateContacts(events:FootstepEvent[]){
 const landed=new Map<string,boolean>();
 for(const e of events){
  const key=e.performerId+':'+e.foot;
  if(e.kind==='contact'){
   if(landed.get(key)===true)return false;
   landed.set(key,true);
  }
  if(e.kind==='release'||e.kind==='swing')landed.set(key,false);
 }
 return true;
}
