/** QA-R1 release gate: automated code passes do not attest real optical output. */
export type QaEvidenceStatus='pending'|'pass'|'fail'|'blocked';
export type QaEvidenceId=
 'automated'|'browser-chrome'|'browser-safari'|'mp4-replay'|'simulator-replay'|
 'live-camera'|'dual-actor-crossing'|'fourteen-scenes'|'source-switch'|
 'profile-restore'|'keyboard-a11y'|'responsive'|'gpu-fallback'|
 'fresh-setup'|'repeat-setup'|'performance'|'body-five-point'|
 'floor-five-point'|'blackout-observed'|'light-spill-observed';
export type QaEvidenceItem={
 id:QaEvidenceId;status:QaEvidenceStatus;operator:string;
 recordedAt:string;device:string;notes:string;artifact:string;
};
export type QaReleaseRecord={
 schema:'soma.qa-release';version:1;commit:string;
 items:QaEvidenceItem[];metrics:{
  freshSetupSeconds:number|null;repeatSetupSeconds:number|null;
  previewFpsP10:number|null;gpuMemoryGrowthMb:number|null;
 };
};
export const QA_REQUIRED_IDS:readonly QaEvidenceId[]=[
 'automated','browser-chrome','browser-safari','mp4-replay','simulator-replay',
 'live-camera','dual-actor-crossing','fourteen-scenes','source-switch',
 'profile-restore','keyboard-a11y','responsive','gpu-fallback',
 'fresh-setup','repeat-setup','performance','body-five-point','floor-five-point',
 'blackout-observed','light-spill-observed'
];
export const QA_PHYSICAL_IDS:readonly QaEvidenceId[]=[
 'body-five-point','floor-five-point','blackout-observed','light-spill-observed'
];
const status=(v:unknown):v is QaEvidenceStatus=>v==='pending'||v==='pass'||v==='fail'||v==='blocked';
const metric=(v:unknown):number|null=>
 typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
export function emptyQaReleaseRecord(commit:string):QaReleaseRecord{
 return {schema:'soma.qa-release',version:1,commit,
  items:QA_REQUIRED_IDS.map(id=>({id,status:'pending',operator:'',
   recordedAt:'',device:'',notes:'',artifact:''})),
  metrics:{freshSetupSeconds:null,repeatSetupSeconds:null,
   previewFpsP10:null,gpuMemoryGrowthMb:null}};
}
export function parseQaReleaseRecord(raw:unknown):QaReleaseRecord{
 if(!raw||typeof raw!=='object')throw Error('Dokumen QA tidak valid.');
 const obj=raw as Partial<QaReleaseRecord>;
 if(obj.schema!=='soma.qa-release'||obj.version!==1||
  typeof obj.commit!=='string'||!obj.commit.trim()||
  !Array.isArray(obj.items))throw Error('Schema atau commit QA tidak cocok.');
 const byId=new Map<QaEvidenceId,QaEvidenceItem>();
 for(const entry of obj.items){
  if(!entry||!QA_REQUIRED_IDS.includes(entry.id)||byId.has(entry.id)||!status(entry.status)||
   !['operator','recordedAt','device','notes','artifact'].every(k=>typeof entry[k as keyof QaEvidenceItem]==='string'))
   throw Error('Bukti QA tidak valid atau duplikat.');
  byId.set(entry.id,{...entry});
 }
 if(byId.size!==QA_REQUIRED_IDS.length)throw Error('Bukti QA belum mencakup seluruh gerbang.');
 return {
  schema:'soma.qa-release',version:1,commit:obj.commit,
  items:QA_REQUIRED_IDS.map(id=>byId.get(id)!),
  metrics:{
   freshSetupSeconds:metric(obj.metrics?.freshSetupSeconds),
   repeatSetupSeconds:metric(obj.metrics?.repeatSetupSeconds),
   previewFpsP10:metric(obj.metrics?.previewFpsP10),
   gpuMemoryGrowthMb:metric(obj.metrics?.gpuMemoryGrowthMb)
  }
 };
}
export function evaluateQaRelease(raw:QaReleaseRecord,expectedCommit:string):{
 eligible:boolean;blocking:string[];automatedPass:boolean;physicalPass:boolean
}{
 const record=parseQaReleaseRecord(raw);
 const blocking:string[]=[];
 if(record.commit!==expectedCommit)blocking.push('Commit berubah; hasil QA lama harus diverifikasi ulang.');
 for(const evidence of record.items){
  if(evidence.status!=='pass'){blocking.push(evidence.id+': '+evidence.status);continue;}
  // Signed, traceable evidence is mandatory for every manual acceptance.
  if(evidence.id!=='automated'&&(!evidence.operator.trim()||
    !evidence.recordedAt.trim()||!evidence.device.trim()||!evidence.artifact.trim()))
   blocking.push(evidence.id+': bukti pemeriksaan belum lengkap.');
  if(QA_PHYSICAL_IDS.includes(evidence.id)&&!evidence.notes.trim())
   blocking.push(evidence.id+': catatan hasil pemeriksaan cahaya belum tercatat.');
 }
 const metrics=record.metrics;
 if(metrics.freshSetupSeconds===null||metrics.freshSetupSeconds>=600)
  blocking.push('Setup awal belum terbukti kurang dari 10 menit.');
 if(metrics.repeatSetupSeconds===null||metrics.repeatSetupSeconds>120)
  blocking.push('Setup berulang belum terbukti maksimal 2 menit.');
 if(metrics.previewFpsP10===null||metrics.previewFpsP10<30)
  blocking.push('Preview P10 belum terbukti mencapai 30 FPS.');
 // GPU memory metric is recorded for observation; no arbitrary failure threshold.
 if(metrics.gpuMemoryGrowthMb===null)blocking.push('Pertumbuhan memori GPU belum diukur.');
 const physicalPass=QA_PHYSICAL_IDS.every(id=>
  record.items.find(v=>v.id===id)?.status==='pass'&&
  !blocking.some(b=>b.startsWith(id+':')));
 return {eligible:blocking.length===0,blocking,
  automatedPass:record.items.find(v=>v.id==='automated')?.status==='pass',
  physicalPass};
}
export function releaseIsProductionReady(record:QaReleaseRecord,commit:string):boolean{
 return evaluateQaRelease(record,commit).eligible;
}
