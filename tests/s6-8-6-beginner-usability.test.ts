import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BEGINNER_TASKS,isSourceReady,classifySourceTransition,observeBeginnerSource,
 summarizeBeginnerUsability,beginnerUsabilityReport,type BeginnerTaskResult}
 from '../src/studio/v3/beginnerUsabilityModel.ts';

test('S6.8.6 four tasks cover initial setup, switching, failure, preview',()=>{
 assert.deepEqual(BEGINNER_TASKS.map(t=>t.id),[
  'select','switch','recover','preview'
 ]);
 assert.equal(new Set(BEGINNER_TASKS.map(t=>t.id)).size,4);
});

test('S6.8.6 camera pairing is not ready until stream connected',()=>{
 assert.equal(isSourceReady({selection:'phone',phase:'pairing'}),false);
 assert.equal(isSourceReady({selection:'phone',phase:'ready'}),true);
 assert.equal(isSourceReady({selection:'simulator',phase:'experiment'}),true);
 assert.equal(isSourceReady({selection:'webcam',phase:'error'}),false);
 assert.equal(isSourceReady({selection:null,phase:'idle'}),false);
});

test('S6.8.6 source changes never count as task successes automatically',()=>{
 const transitions=classifySourceTransition(
  {selection:null,phase:'idle'},
  {selection:'phone',phase:'pairing'},850
 );
 assert.deepEqual(transitions.map(x=>x.type),['source-change','pairing']);
 assert.equal(transitions.every(x=>x.atMs===850),true);
 assert.equal(transitions.some(x=>x.type==='source-ready'),false);
});

test('S6.8.6 record errors, same-source recovery, and safe fallback separately',()=>{
 const err=classifySourceTransition(
  {selection:'webcam',phase:'connecting'},
  {selection:'webcam',phase:'error'},1200
 );
 assert.deepEqual(err.map(x=>x.type),['connection-error']);
 const retry=classifySourceTransition(
  {selection:'webcam',phase:'error'},
  {selection:'webcam',phase:'ready'},3100
 );
 assert.deepEqual(retry.map(x=>x.type),['recovery']);
 const fallback=classifySourceTransition(
  {selection:'webcam',phase:'error'},
  {selection:'simulator',phase:'experiment'},5400
 );
 assert.deepEqual(fallback.map(x=>x.type),['source-change','fallback']);
 assert.equal(fallback.every(x=>x.source==='simulator'),true);
 assert.equal(classifySourceTransition(
  {selection:'webcam',phase:'error'},
  {selection:'webcam',phase:'connecting'},3600
 ).length,0);
});

test('S6.8.6 preserve unresolved error across connecting until fallback is ready',()=>{
 const start={previous:{selection:'webcam' as const,phase:'connecting' as const},
  pendingErrorSource:null};
 const failure=observeBeginnerSource(start,{selection:'webcam',phase:'error'},100);
 assert.equal(failure.state.pendingErrorSource,'webcam');
 const switching=observeBeginnerSource(failure.state,
  {selection:'simulator',phase:'connecting'},200);
 assert.equal(switching.state.pendingErrorSource,'webcam');
 assert.equal(switching.events.some(e=>e.type==='fallback'),false);
 const ready=observeBeginnerSource(switching.state,
  {selection:'simulator',phase:'experiment'},500);
 assert.deepEqual(ready.events.map(e=>e.type),['fallback']);
 assert.equal(ready.state.pendingErrorSource,null);
 const retried=observeBeginnerSource(failure.state,
  {selection:'webcam',phase:'connecting'},250);
 const recovered=observeBeginnerSource(retried.state,
  {selection:'webcam',phase:'ready'},750);
 assert.deepEqual(recovered.events.map(e=>e.type),['recovery']);
});

test('S6.8.6 local export only includes enumerated status, time, and observer observations',()=>{
 const tasks:BeginnerTaskResult[]=[
  {task:'select',outcome:'success',elapsedMs:1000,assisted:false,note:''},
  {task:'switch',outcome:'difficulty',elapsedMs:5000,assisted:true,note:'Menu kurang jelas'},
  {task:'recover',outcome:'success',elapsedMs:3000,assisted:false,note:''}
 ];
 const events=classifySourceTransition(
  {selection:'webcam',phase:'error'},
  {selection:'simulator',phase:'experiment'},5300);
 const summary=summarizeBeginnerUsability(tasks,events);
 assert.equal(summary.tasksAttempted,3);
 assert.equal(summary.tasksPassed,2);
 assert.equal(summary.tasksWithDifficulty,1);
 assert.equal(summary.assistedTasks,1);
 assert.equal(summary.medianSuccessfulTaskMs,2000);
 assert.equal(summary.alternativeSourceFallbacks,1);
 const output=beginnerUsabilityReport({
  startedAt:'2026-11-17T00:00:00Z',endedAt:'2026-11-17T00:15:00Z',
  results:tasks,events,unfinished:true
 });
 assert.equal(output.sessionFinished,false);
 assert.equal(output.participant,'anonim');
 const json=JSON.stringify(output);
 assert.ok(!json.includes('deviceId'));
 assert.ok(!json.includes('videoData'));
 assert.ok(!json.includes('IP Address'));
});
