import type {PhoneTransportSample,PhoneLinkMode} from './PhoneDeviceTelemetry.ts';

export type DeviceCase='walk'|'slow-walk'|'pivot'|'slide'|'crossing'|'disconnect';
export type DeviceTrialStatus='incomplete'|'needs-adjustment'|'ready-for-physical-review';
export type DeviceChecklist={
 phoneMounted:boolean;feetAndFloorVisible:boolean;
 externalVideoRecorded:boolean;physicalBlackoutWitnessed:boolean;
};
export type DeviceObservation={
 case:DeviceCase;atMs:number;performer:'performer-1'|'A'|'B'|'both';
 videoFrame:number|null;note:string;
};
export type DeviceSample={
 elapsedMs:number;transport:PhoneTransportSample['state'];source:PhoneLinkMode|null;
 phoneActive:boolean;framesDecoded:number|null;fps:number|null;
 packetsReceived:number|null;packetsLost:number|null;jitterMs:number|null;
 rttMs:number|null;frameWidth:number|null;frameHeight:number|null;
 frameAgeMs:number|null;poseTracked:boolean;identityAmbiguous:boolean;
 observedTwo:boolean;calibrated:boolean;calibrationMatched:boolean;
 cameraContacts:number;inferenceMs:number|null;pipelineMs:number|null;
};
export type DeviceTrial={
 schema:'soma.phone-real-device-trial';version:1;
 createdAt:string;source:PhoneLinkMode;performers:1|2;
 phoneModel:string;browserLabel:string;networkLabel:string;videoReference:string;
 startedAtMs:number;endedAtMs:number|null;
 samples:DeviceSample[];observations:DeviceObservation[];
 checklist:DeviceChecklist;reviewer:string;reviewComplete:boolean;notes:string;
 softwareBlackoutAtMs:number[];disconnectAtMs:number|null;
};
const safe=(value:string,max=180)=>value.trim().slice(0,max);
const finite=(n:number)=>Number.isFinite(n)&&n>=0;
const required=(count:1|2):DeviceCase[]=>
 count===2?['walk','slow-walk','pivot','slide','crossing','disconnect']:
 ['walk','slow-walk','pivot','slide','disconnect'];
const percentile=(a:number[],fraction:number):number|null=>{
 if(!a.length)return null;
 const s=[...a].sort((x,y)=>x-y),rank=(s.length-1)*fraction;
 const lo=Math.floor(rank),hi=Math.ceil(rank);
 return Math.round((s[lo]+(s[hi]-s[lo])*(rank-lo))*10)/10;
};
const proportion=(count:number,total:number)=>total?Math.round(count/total*1000)/1000:null;
export const DEVICE_PROVISIONAL_GATES={
 minDurationMs:60_000,minInboundFrames:600,minFps:18,
 minFreshFraction:0.85,minTrackedFraction:0.75,maxAmbiguousFraction:0.15,
 minContactEvents:6,minConnectedSamples:30,minMovementEvidencePerCase:1
} as const;
/** Start only while the actual receiver is connected and SOMA is using its video. */
export function beginDeviceTrial(input:{
 nowMs:number;source:PhoneLinkMode;performers:1|2;
 phoneActive:boolean;transport:PhoneTransportSample;
 phoneModel:string;browserLabel:string;networkLabel:string;videoReference:string;
}):DeviceTrial{
 if(!finite(input.nowMs)||!['qr','manual'].includes(input.source)||![1,2].includes(input.performers)||
  !input.phoneActive||input.transport.state!=='connected'||
  !input.transport.reported||input.transport.mode!==input.source)
  throw Error('Mulai trial saat video HP sungguhan sudah diterima tracker SOMA.');
 return {schema:'soma.phone-real-device-trial',version:1,
  createdAt:new Date().toISOString(),source:input.source,performers:input.performers,
  phoneModel:safe(input.phoneModel),browserLabel:safe(input.browserLabel),
  networkLabel:safe(input.networkLabel),videoReference:safe(input.videoReference,220),
  startedAtMs:input.nowMs,endedAtMs:null,samples:[],observations:[],
  checklist:{phoneMounted:false,feetAndFloorVisible:false,
   externalVideoRecorded:false,physicalBlackoutWitnessed:false},
  reviewer:'',reviewComplete:false,notes:'',softwareBlackoutAtMs:[],disconnectAtMs:null};
}
/** Passive browser sampling. It must never actuate projectors or begin recording. */
export function appendDeviceSample(trial:DeviceTrial,sample:DeviceSample):DeviceTrial{
 if(trial.endedAtMs!==null)throw Error('Trial sudah ditutup.');
 if(trial.samples.length>=7200)throw Error('Batas 2 jam telemetry tercapai.');
 if(!finite(sample.elapsedMs)||
  (trial.samples.length>0&&sample.elapsedMs<=trial.samples[trial.samples.length-1].elapsedMs))
  throw Error('Sampel harus berurutan menurut waktu.');
 if(!sample.phoneActive&&sample.transport==='connected')
  sample={...sample,transport:'interrupted'};
 const result={...sample};
 const disconnectAt=trial.disconnectAtMs??(
  trial.samples.some(s=>s.transport==='connected')&&
  result.transport!=='connected'?result.elapsedMs:null);
 return {...trial,samples:[...trial.samples,result],disconnectAtMs:disconnectAt};
}
export function recordDeviceObservation(trial:DeviceTrial,observation:DeviceObservation):DeviceTrial{
 if(trial.endedAtMs!==null||trial.observations.length>=100)throw Error('Trial sudah ditutup atau terlalu banyak catatan.');
 if(!required(trial.performers).includes(observation.case)||
  !finite(observation.atMs)||observation.atMs<0||
  (observation.case==='crossing'&&observation.performer!=='both')||
  (trial.performers===1&&observation.performer!=='performer-1'&&observation.performer!=='both')||
  (trial.performers===2&&!['A','B','both'].includes(observation.performer))||
  !observation.note.trim()||observation.note.length>500||
  (observation.videoFrame!==null&&(!Number.isSafeInteger(observation.videoFrame)||observation.videoFrame<0)))
  throw Error('Jenis gerak, catatan, performer, atau frame video tidak valid.');
 return {...trial,observations:[...trial.observations,{...observation,note:safe(observation.note,500)}]};
}
export function withDeviceChecklist(trial:DeviceTrial,values:Partial<DeviceChecklist>):DeviceTrial{
 if(trial.endedAtMs!==null)throw Error('Trial sudah ditutup.');
 return {...trial,checklist:{...trial.checklist,...values}};
}
export function recordSoftwareBlackout(trial:DeviceTrial,elapsedMs:number):DeviceTrial{
 if(trial.endedAtMs!==null||!finite(elapsedMs))return trial;
 return {...trial,softwareBlackoutAtMs:[...trial.softwareBlackoutAtMs.slice(-19),elapsedMs]};
}
export function finishDeviceTrial(trial:DeviceTrial,endedAtMs:number,reviewer:string,notes:string):DeviceTrial{
 if(trial.endedAtMs!==null||!finite(endedAtMs)||endedAtMs<trial.startedAtMs)
  throw Error('Waktu akhir trial tidak valid.');
 return {...trial,endedAtMs,reviewer:safe(reviewer,120),notes:safe(notes,500),
  reviewComplete:!!reviewer.trim()};
}
export function summarizeDeviceTrial(trial:DeviceTrial,nowMs:number){
 const elapsed=trial.endedAtMs??nowMs;
 const durationMs=Math.max(0,elapsed-trial.startedAtMs);
 const active=trial.samples.filter(s=>s.phoneActive&&s.transport==='connected');
 const inbound=active.filter(s=>s.framesDecoded!==null);
 let decoded=0;
 const intervals:number[]=[];
 for(let i=1;i<inbound.length;i++){
  const previous=inbound[i-1],current=inbound[i];
  const diff=(current.framesDecoded??0)-(previous.framesDecoded??0);
  const ms=current.elapsedMs-previous.elapsedMs;
  if(ms>0&&diff>=0){
   decoded+=diff;
   intervals.push(diff*1000/ms);
  }
 }
 const fps=percentile(intervals.length?intervals:active.flatMap(s=>s.fps===null?[]:[s.fps]),.5);
 const validAge=active.filter(s=>s.frameAgeMs!==null);
 const validPose=active.filter(s=>s.calibrated&&s.calibrationMatched);
 const ambiguous=active.filter(s=>s.identityAmbiguous);
 const validRtt=active.flatMap(s=>s.rttMs===null?[]:[s.rttMs]);
 const validJitter=active.flatMap(s=>s.jitterMs===null?[]:[s.jitterMs]);
 const inference=active.flatMap(s=>s.inferenceMs===null?[]:[s.inferenceMs]);
 const pipeline=active.flatMap(s=>s.pipelineMs===null?[]:[s.pipelineMs]);
 const contacts=active.length?
  Math.max(0,active[active.length-1].cameraContacts-active[0].cameraContacts):0;
 const packetSamples=active.filter(s=>s.packetsReceived!==null&&s.packetsLost!==null);
 let packetsReceived=0,packetsLost=0;
 for(let i=1;i<packetSamples.length;i++){
  const recv=(packetSamples[i].packetsReceived??0)-(packetSamples[i-1].packetsReceived??0);
  const lost=(packetSamples[i].packetsLost??0)-(packetSamples[i-1].packetsLost??0);
  if(recv>=0&&lost>=0){packetsReceived+=recv;packetsLost+=lost;}
 }
 const blackoutAfterLoss=trial.disconnectAtMs===null?null:
  trial.softwareBlackoutAtMs.filter(t=>t>=trial.disconnectAtMs!&&t<=trial.disconnectAtMs!+2500).length>0;
 return {durationMs,samples:trial.samples.length,connectedSamples:active.length,
  decodedFrames:decoded,fpsMedian:fps,
  frameFreshFraction:proportion(validAge.filter(s=>s.frameAgeMs!<=450).length,validAge.length),
  trackedFraction:proportion(validPose.filter(s=>s.poseTracked).length,validPose.length),
  ambiguousFraction:proportion(ambiguous.length,active.length),
  twoVisibleFraction:proportion(active.filter(s=>s.observedTwo).length,active.length),
  calibrationValidFraction:proportion(validPose.length,active.length),
  contactDelta:contacts,networkRttP95Ms:percentile(validRtt,.95),
  jitterP95Ms:percentile(validJitter,.95),
  inferenceP95Ms:percentile(inference,.95),pipelineP95Ms:percentile(pipeline,.95),
  packetLossFraction:proportion(packetsLost,packetsReceived+packetsLost),
  disconnectRecorded:trial.disconnectAtMs!==null,softwareBlackoutAfterLoss:blackoutAfterLoss,
  cases:required(trial.performers).map(kind=>({
   kind,count:trial.observations.filter(o=>o.case===kind).length
  }))};
}
/** Provisional browser quality only: does not certify photons, identity truth or precision/recall. */
export function assessDeviceTrial(trial:DeviceTrial|null,nowMs:number){
 const missing:string[]=[],failed:string[]=[];
 if(!trial)return {status:'incomplete' as DeviceTrialStatus,missing:['Belum ada trial HP sungguhan.'],
  failed,summary:null};
 const s=summarizeDeviceTrial(trial,nowMs);
 if(trial.endedAtMs===null||!trial.reviewComplete||!trial.reviewer)
  missing.push('Akhiri trial dan tulis nama pemeriksa.');
 if(!trial.phoneModel||!trial.browserLabel||!trial.networkLabel)
  missing.push('Catat model HP, browser dan jaringan.');
 if(!trial.videoReference||!trial.checklist.externalVideoRecorded)
  missing.push('Bukti video eksternal belum dicatat.');
 if(!trial.checklist.phoneMounted||!trial.checklist.feetAndFloorVisible)
  missing.push('Pemasangan tripod dan kaki terlihat belum dikonfirmasi.');
 if(!trial.checklist.physicalBlackoutWitnessed)
  missing.push('Pemadaman cahaya fisik belum disaksikan dan dicatat.');
 if(s.durationMs<DEVICE_PROVISIONAL_GATES.minDurationMs)
  missing.push('Rekam sekurang-kurangnya 60 detik.');
 if(s.connectedSamples<DEVICE_PROVISIONAL_GATES.minConnectedSamples)
  missing.push('Perlu sekurangnya 30 sampel koneksi WebRTC aktif.');
 if(s.decodedFrames<DEVICE_PROVISIONAL_GATES.minInboundFrames)
  missing.push('Dekode video belum mencapai 600 frame terukur.');
 if(s.fpsMedian===null)missing.push('Frame rate video WebRTC belum terukur.');
 else if(s.fpsMedian<DEVICE_PROVISIONAL_GATES.minFps)
  failed.push('Frame rate video di bawah target sementara 18 FPS.');
 if(s.frameFreshFraction===null)missing.push('Usia frame pose belum terukur.');
 else if(s.frameFreshFraction<DEVICE_PROVISIONAL_GATES.minFreshFraction)
  failed.push('Frame segar kurang dari 85% selama koneksi aktif.');
 if(s.trackedFraction===null)missing.push('Kalibrasi dan tracking belum menghasilkan sampel.');
 else if(s.trackedFraction<DEVICE_PROVISIONAL_GATES.minTrackedFraction)
  failed.push('Tracking pose berhasil kurang dari 75% sampel yang dikalibrasi.');
 if(trial.performers===2&&s.ambiguousFraction!==null&&
  s.ambiguousFraction>DEVICE_PROVISIONAL_GATES.maxAmbiguousFraction)
  failed.push('Identitas A/B ambigu pada lebih dari 15% sampel.');
 if(s.contactDelta<DEVICE_PROVISIONAL_GATES.minContactEvents)
  missing.push('Perlu sekurangnya 6 event kontak kaki selama trial.');
 for(const scenario of s.cases)if(!scenario.count)
  missing.push('Bukti gerak belum dicatat: '+scenario.kind+'.');
 if(!s.disconnectRecorded||!s.softwareBlackoutAfterLoss)
  missing.push('Uji putus koneksi dan permintaan Blackout software belum terverifikasi.');
 const status:DeviceTrialStatus=missing.length?'incomplete':
  failed.length?'needs-adjustment':'ready-for-physical-review';
 return {status,missing,failed,summary:s};
}
export function exportDeviceTrial(trial:DeviceTrial,nowMs:number){
 return JSON.stringify({schema:'soma.phone-real-device-report',version:1,
  source:'measured-browser-stats-plus-manual-witness',generatedAt:new Date().toISOString(),
  trial,assessment:assessDeviceTrial(trial,nowMs),
  disclaimer:'Statistik transport/browser dan pernyataan pemeriksa; bukan bukti otomatis cahaya proyektor, galat posisi fisik atau akurasi pijakan.'},null,2);
}
