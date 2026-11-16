import {insideFloor,validateFloorSpace,type FloorSpace,type FloorPoint} from '../spatial/coordinates.ts';
import {validateFloorSession,type FootstepEvent,type FootSide} from '../spatial/events.ts';
import type {CalibrationQASummary} from './CalibrationQA.ts';

export type MovementCase='normal-walk'|'slow-low-step'|'pivot'|'slide'|'crossing';
export type PhysicalContact={
 id:string;performerId:string;foot:FootSide;videoFrame:number;referenceM:FloorPoint;
 matchedEventId:string|null;movement:MovementCase;note:string;
 method:'annotated-side-video-and-tape';
};
export type SequenceEvidence={
 kind:MovementCase;videoFrame:number;performerId:string;note:string;
 method:'annotated-video';
};
export type PhotonEvidence={
 id:string;physicalContactId:string;frameDifference:number;latencyMs:number;
 method:'same-shot-foot-and-light';
};
export type PhysicalChecklist={
 floorMarkersMeasured:boolean;fixedCameraAndProjector:boolean;
 footAndProjectionInSameVideo:boolean;blackoutAndReconnectionChecked:boolean;
};
export type CameraContactSnapshot=Pick<FootstepEvent,'id'|'performerId'|'foot'|'timestampMs'|'positionM'|'confidence'>;
export type PhysicalTrial={
 schema:'soma.footprints.physical-trial';version:1;
 capturedAt:string;contextKey:string;floor:FloorSpace;performerCount:1|2;
 videoReference:string;durationSeconds:number;videoFps:number;
 contacts:CameraContactSnapshot[];
 physicalContacts:PhysicalContact[];sequences:SequenceEvidence[];
 photons:PhotonEvidence[];checklist:PhysicalChecklist;
 reviewComplete:boolean;reviewer:string;reviewNote:string;
};
export type PhysicalGates={
 minTrueContactsPerPerformer:number;minLatencySamples:number;
 minPrecision:number;minRecall:number;maxContactErrorP95Cm:number;
 maxPhotonLatencyP95Ms:number;maxFalseContactsPerMinute:number;
};
export const PROVISIONAL_PHYSICAL_GATES:PhysicalGates={
 minTrueContactsPerPerformer:12,minLatencySamples:5,
 minPrecision:.9,minRecall:.9,maxContactErrorP95Cm:15,
 maxPhotonLatencyP95Ms:180,maxFalseContactsPerMinute:1
};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const round=(v:number)=>Math.round(v*100)/100;
const percentile=(values:number[],fraction:number):number|null=>{
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),index=(sorted.length-1)*fraction;
 return round(sorted[Math.floor(index)]+(sorted[Math.ceil(index)]-sorted[Math.floor(index)])*(index-Math.floor(index)));
};
const expectedPerformers=(count:1|2)=>count===1?['performer-1']:['A','B'];
const safeNote=(v:string,max=240)=>v.trim().slice(0,max);
const validFrame=(trial:PhysicalTrial,frame:number)=>
 Number.isSafeInteger(frame)&&frame>=0&&frame<=Math.ceil(trial.durationSeconds*trial.videoFps);
export const requiredMovementCases=(performerCount:1|2):MovementCase[]=>
 performerCount===1?['normal-walk','slow-low-step','pivot','slide']:
 ['normal-walk','slow-low-step','pivot','slide','crossing'];

export function capturePhysicalTrial(
 floorInput:FloorSpace,rawEvents:FootstepEvent[],performerCount:1|2,
 contextKey:string,videoReference:string,durationSeconds:number,videoFps:number
):PhysicalTrial{
 const floor=validateFloorSpace(floorInput);
 if(![1,2].includes(performerCount)||!contextKey||!videoReference.trim()||
  !finite(durationSeconds)||durationSeconds<5||durationSeconds>3600||
  !finite(videoFps)||videoFps<24||videoFps>1000)
  throw Error('Isi video, durasi, FPS dan kalibrasi sebelum membekukan sesi fisik.');
 const session=validateFloorSession({schema:'soma.footprints.floor-session',version:3,floor,events:rawEvents});
 const contacts=session.events.filter(e=>e.kind==='contact'&&e.source==='camera'&&
  e.positionBasis==='calibrated-estimate'&&expectedPerformers(performerCount).includes(e.performerId));
 if(contacts.length>10000)throw Error('Uji fisik dibatasi sampai 10.000 jejak kamera.');
 return {schema:'soma.footprints.physical-trial',version:1,
  capturedAt:new Date().toISOString(),contextKey,floor,performerCount,
  videoReference:safeNote(videoReference,200),durationSeconds,videoFps,
  contacts:contacts.map(e=>({id:e.id,performerId:e.performerId,foot:e.foot,
   timestampMs:e.timestampMs,positionM:{...e.positionM},confidence:e.confidence})),
  physicalContacts:[],sequences:[],photons:[],
  checklist:{floorMarkersMeasured:false,fixedCameraAndProjector:false,
   footAndProjectionInSameVideo:false,blackoutAndReconnectionChecked:false},
  reviewComplete:false,reviewer:'',reviewNote:''};
}
export function annotatePhysicalContact(trial:PhysicalTrial,value:{
 performerId:string;foot:FootSide;videoFrame:number;referenceM:FloorPoint;
 matchedEventId:string|null;movement:MovementCase;note?:string;
}):PhysicalTrial{
 if(trial.reviewComplete)throw Error('Buka ulang review sebelum menambah anotasi.');
 if(trial.physicalContacts.length>=10000)throw Error('Batas anotasi fisik tercapai.');
 if(!expectedPerformers(trial.performerCount).includes(value.performerId)||
  !['left','right'].includes(value.foot)||!requiredMovementCases(trial.performerCount).includes(value.movement)||
  !validFrame(trial,value.videoFrame)||!insideFloor(trial.floor,value.referenceM))
  throw Error('Performer, waktu video atau koordinat pijakan tidak valid.');
 if(value.matchedEventId!==null){
  const event=trial.contacts.find(e=>e.id===value.matchedEventId);
  if(!event||event.foot!==value.foot||event.performerId!==value.performerId)
   throw Error('Pasangan event harus milik kaki dan performer yang sama.');
  if(trial.physicalContacts.some(e=>e.matchedEventId===value.matchedEventId))
   throw Error('Satu event kamera tidak boleh dipakai untuk dua pijakan nyata.');
 }
 return {...trial,physicalContacts:[...trial.physicalContacts,{
  id:'physical-'+(trial.physicalContacts.length+1),performerId:value.performerId,
  foot:value.foot,videoFrame:value.videoFrame,referenceM:{...value.referenceM},
  matchedEventId:value.matchedEventId,movement:value.movement,
  note:safeNote(value.note??''),method:'annotated-side-video-and-tape'
 }]};
}
export function addMovementEvidence(trial:PhysicalTrial,
 kind:MovementCase,videoFrame:number,performerId:string,note:string):PhysicalTrial{
 if(trial.reviewComplete)throw Error('Buka ulang review sebelum menambah anotasi.');
 if(!requiredMovementCases(trial.performerCount).includes(kind)||!validFrame(trial,videoFrame)||
  !(expectedPerformers(trial.performerCount).includes(performerId)||(kind==='crossing'&&performerId==='both'))||
  !note.trim())throw Error('Catat jenis gerak, frame video, performer dan kejadian yang terlihat.');
 if(trial.sequences.length>=1000)throw Error('Batas anotasi peristiwa tercapai.');
 return {...trial,sequences:[...trial.sequences,{kind,videoFrame,performerId,
  note:safeNote(note),method:'annotated-video'}]};
}
export function addPhotonEvidence(trial:PhysicalTrial,physicalContactId:string,frameDifference:number):PhysicalTrial{
 if(trial.reviewComplete)throw Error('Buka ulang review sebelum menambah pengukuran.');
 if(!trial.physicalContacts.some(c=>c.id===physicalContactId&&c.matchedEventId)||
  trial.photons.some(c=>c.physicalContactId===physicalContactId)||
  !Number.isSafeInteger(frameDifference)||frameDifference<0||
  frameDifference>Math.ceil(trial.videoFps*10))
  throw Error('Pilih satu kontak berpasangan dan selisih frame cahaya yang valid.');
 return {...trial,photons:[...trial.photons,{id:'photon-'+(trial.photons.length+1),
  physicalContactId,frameDifference,latencyMs:round(frameDifference*1000/trial.videoFps),
  method:'same-shot-foot-and-light'}]};
}
export function markPhysicalReview(trial:PhysicalTrial,reviewComplete:boolean,reviewer:string,note:string):PhysicalTrial{
 if(reviewComplete&&!reviewer.trim())throw Error('Isi pemeriksa rekaman sebelum menutup review.');
 return {...trial,reviewComplete,reviewer:safeNote(reviewer,120),reviewNote:safeNote(note,500)};
}
export function summarizePhysicalTrial(trial:PhysicalTrial){
 const matched=new Set(trial.physicalContacts.map(c=>c.matchedEventId).filter((id):id is string=>!!id));
 const tp=matched.size,fp=trial.contacts.length-tp,fn=trial.physicalContacts.length-tp;
 const err=trial.physicalContacts.flatMap(c=>{
  if(!c.matchedEventId)return [];
  const event=trial.contacts.find(e=>e.id===c.matchedEventId);
  return event?[round(Math.hypot(event.positionM.xM-c.referenceM.xM,
   event.positionM.yM-c.referenceM.yM)*100)]:[];
 });
 const photon=trial.photons.map(x=>x.latencyMs);
 return {cameraContacts:trial.contacts.length,physicalContacts:trial.physicalContacts.length,
  matched:tp,falseContacts:fp,missedContacts:fn,
  precision:tp+fp>0?round(tp/(tp+fp)):null,
  recall:tp+fn>0?round(tp/(tp+fn)):null,
  falseContactsPerMinute:round(fp/trial.durationSeconds*60),
  errorCm:{samples:err.length,mean:err.length?round(err.reduce((a,b)=>a+b,0)/err.length):null,
   p95:percentile(err,.95),maximum:err.length?Math.max(...err):null},
  lightMs:{samples:photon.length,p95:percentile(photon,.95),median:percentile(photon,.5)},
  perPerformer:expectedPerformers(trial.performerCount).map(id=>({
   id,truth:trial.physicalContacts.filter(x=>x.performerId===id).length,
   matched:trial.physicalContacts.filter(x=>x.performerId===id&&x.matchedEventId!==null).length,
   camera:trial.contacts.filter(x=>x.performerId===id).length
  })),
  cases:requiredMovementCases(trial.performerCount).map(kind=>({
   kind,records:trial.sequences.filter(x=>x.kind===kind).length
  }))};
}
export function assessPhysicalAcceptance(trial:PhysicalTrial|null,contextKey:string,
 calibrationQA:CalibrationQASummary|null,
 gates:PhysicalGates=PROVISIONAL_PHYSICAL_GATES){
 const missing:string[]=[],failed:string[]=[];
 if(!trial)return {status:'incomplete' as const,missing:['Belum ada snapshot sesi lantai.'],
  failed,summary:null};
 const sum=summarizePhysicalTrial(trial);
 if(!contextKey||trial.contextKey!==contextKey)
  missing.push('Kalibrasi atau perangkat berbeda dari snapshot; rekam sesi ulang.');
 if(!trial.reviewComplete||!trial.reviewer.trim())
  missing.push('Pemeriksa belum menyelesaikan audit seluruh event dan pijakan video.');
 if(!Object.values(trial.checklist).every(Boolean))
  missing.push('Empat pemeriksaan alat, marker, video dan Blackout belum lengkap.');
 for(const p of sum.perPerformer)
  if(p.truth<gates.minTrueContactsPerPerformer)
   missing.push('Performer '+p.id+' memerlukan ≥'+gates.minTrueContactsPerPerformer+' pijakan beranotasi.');
 for(const c of sum.cases)if(c.records<1)
  missing.push('Belum ada rekaman kasus gerak '+c.kind+'.');
 if(sum.lightMs.samples<gates.minLatencySamples)
  missing.push('Ukur ≥'+gates.minLatencySamples+' selisih frame kaki–cahaya dengan video eksternal.');
 if(calibrationQA?.status!=='within-provisional-target')
  missing.push('QA lima titik kamera–proyektor harus lengkap dan berada dalam ambang kerja.');
 if(sum.precision!==null&&sum.precision<gates.minPrecision)
  failed.push('Precision kontak '+sum.precision+' di bawah '+gates.minPrecision+'.');
 if(sum.recall!==null&&sum.recall<gates.minRecall)
  failed.push('Recall kontak '+sum.recall+' di bawah '+gates.minRecall+'.');
 if(sum.falseContactsPerMinute>gates.maxFalseContactsPerMinute)
  failed.push('Kontak palsu per menit '+sum.falseContactsPerMinute+' melebihi '+gates.maxFalseContactsPerMinute+'.');
 if(sum.errorCm.p95!==null&&sum.errorCm.p95>gates.maxContactErrorP95Cm)
  failed.push('Galat posisi P95 '+sum.errorCm.p95+' cm melebihi '+gates.maxContactErrorP95Cm+' cm.');
 if(sum.lightMs.p95!==null&&sum.lightMs.p95>gates.maxPhotonLatencyP95Ms)
  failed.push('Latensi fisik P95 '+sum.lightMs.p95+' ms melebihi '+gates.maxPhotonLatencyP95Ms+' ms.');
 const status=missing.length?'incomplete':failed.length?'needs-adjustment':'meets-provisional-gates';
 return {status,missing,failed,summary:sum};
}
export function exportPhysicalAcceptance(trial:PhysicalTrial,contextKey:string,
 calibrationQA:CalibrationQASummary|null){
 return {schema:'soma.footprints.physical-acceptance',version:1,
  exportedAt:new Date().toISOString(),trial,
  gates:PROVISIONAL_PHYSICAL_GATES,
  calibrationQA,assessment:assessPhysicalAcceptance(trial,contextKey,calibrationQA),
  caveat:'Penerimaan ini mengikuti anotasi manual operator, pengukuran pita ukur dan video fisik. Status memenuhi ambang kerja belum menyatakan sertifikasi atau izin rilis Production; verifikasi independen dan review PR tetap diperlukan.'};
}
