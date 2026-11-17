import type {FootprintsInputChoice,FootprintsInputPhase,FootprintsInputStatus}
 from './sourceSwitchModel.ts';

export type BeginnerTaskId='select'|'switch'|'recover'|'preview';
export type BeginnerOutcome='success'|'difficulty'|'skipped';
export type BeginnerEventType='source-change'|'connection-error'|'recovery'|
 'fallback'|'source-ready'|'pairing';
export type BeginnerEvent={
 type:BeginnerEventType;atMs:number;
 source:FootprintsInputChoice|null;
 phase:FootprintsInputPhase;
};
export type BeginnerTaskResult={
 task:BeginnerTaskId;outcome:BeginnerOutcome;elapsedMs:number;
 assisted:boolean;note:string;
};
export const BEGINNER_TASKS=[
 {id:'select',title:'Temukan sumber pertama',
  instruction:'Cari menu INPUT. Pilih webcam atau Simulasi 3D, lalu tunjukkan status sumber.',
  check:'Pengguna menemukan menu dan memahami apakah sumber sudah siap.'},
 {id:'switch',title:'Ganti sumber gerak',
  instruction:'Ganti ke sumber lain (misalnya MP4 atau 3D). Lihat perubahan pada preview BODY/FLOOR.',
  check:'Pengguna menemukan cara mengganti sumber dan mengenali sumber yang sedang aktif.'},
 {id:'recover',title:'Tangani gangguan',
  instruction:'Moderator memicu gangguan yang aman, misalnya menolak izin webcam atau memutus pairing HP. Minta pengguna membaca pesan dan mencoba pulih atau beralih ke sumber yang berfungsi.',
  check:'Pengguna memahami pesan error, menemukan tindakan pemulihan, dan tidak menyalakan output fisik.'},
 {id:'preview',title:'Periksa hasil dan batas output',
  instruction:'Minta pengguna menemukan preview BODY/FLOOR serta menjelaskan beda preview lokal dan output proyektor.',
  check:'Pengguna dapat menemukan kedua preview dan tombol Projector/Blackout.'}
] as const satisfies ReadonlyArray<{
 id:BeginnerTaskId;title:string;instruction:string;check:string
}>;

export function isSourceReady(status:Pick<FootprintsInputStatus,'selection'|'phase'>){
 return !!status.selection&&(status.phase==='ready'||status.phase==='experiment');
}
/** Log only source type and state; never raw errors, footage, or device metadata. */
export function classifySourceTransition(
 previous:Pick<FootprintsInputStatus,'selection'|'phase'>,
 next:Pick<FootprintsInputStatus,'selection'|'phase'>,
 atMs:number
):BeginnerEvent[]{
 const now=Math.max(0,Math.round(Number.isFinite(atMs)?atMs:0));
 const result:BeginnerEvent[]=[];
 const record=(type:BeginnerEventType)=>result.push({
  type,atMs:now,source:next.selection,phase:next.phase
 });
 if(previous.selection!==next.selection)record('source-change');
 if(next.phase==='error'&&(previous.phase!=='error'||previous.selection!==next.selection))
  record('connection-error');
 if(previous.phase==='error'&&isSourceReady(next))
  record(previous.selection===next.selection?'recovery':'fallback');
 else if(!isSourceReady(previous)&&isSourceReady(next))record('source-ready');
 if(next.phase==='pairing'&&(previous.phase!=='pairing'||previous.selection!==next.selection))
  record('pairing');
 return result;
}
export function summarizeBeginnerUsability(
 results:BeginnerTaskResult[],events:BeginnerEvent[]
){
 const completed=results.filter(r=>r.outcome==='success');
 const durations=completed.map(r=>r.elapsedMs).sort((a,b)=>a-b);
 const medianMs=durations.length?
  Math.round((durations[Math.floor((durations.length-1)/2)]+
   durations[Math.ceil((durations.length-1)/2)])/2):null;
 return {
  tasksAttempted:results.length,tasksPassed:completed.length,
  tasksWithDifficulty:results.filter(r=>r.outcome==='difficulty').length,
  tasksSkipped:results.filter(r=>r.outcome==='skipped').length,
  assistedTasks:results.filter(r=>r.assisted).length,
  medianSuccessfulTaskMs:medianMs,
  sourceChanges:events.filter(e=>e.type==='source-change').length,
  connectionErrors:events.filter(e=>e.type==='connection-error').length,
  sameSourceRecoveries:events.filter(e=>e.type==='recovery').length,
  alternativeSourceFallbacks:events.filter(e=>e.type==='fallback').length
 };
}
export function beginnerUsabilityReport(input:{
 startedAt:string;endedAt:string;results:BeginnerTaskResult[];
 events:BeginnerEvent[];unfinished:boolean
}){
 return {
  schema:'soma.usability.beginner-observation',version:1,
  startedAt:input.startedAt,endedAt:input.endedAt,
  participant:'anonim',sessionFinished:!input.unfinished,
  scenarios:BEGINNER_TASKS.map(t=>({task:t.id,title:t.title,criterion:t.check})),
  observations:input.results,
  sourceEvents:input.events,
  summary:summarizeBeginnerUsability(input.results,input.events),
  limitations:'Hasil tugas ditandai moderator. Event teknis berasal dari status UI, tidak mengukur keberhasilan pengguna secara otomatis. Tanpa rekaman video, audio, identitas, atau telemetry jaringan.'
 };
}
