import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIRST_SETUP_TARGET_MS,PROJECTION_SETUP_START_KEY,
 PROJECTION_SETUP_RESULTS_KEY,startSetupBench,readSetupStart,finishSetupBench}
 from '../src/studio/v3/safeProjectionBench.ts';
const memory=()=>{
 const m=new Map<string,string>();
 return {getItem:(k:string)=>m.get(k)??null,
  setItem:(k:string,v:string)=>{m.set(k,v);},m};
};
test('V3.5 supervised stopwatch starts once and supports explicit new session',()=>{
 const session=memory(),start=1730000000000;
 assert.equal(readSetupStart(session,start),null);
 assert.equal(startSetupBench(session,start),start);
 assert.equal(session.m.get(PROJECTION_SETUP_START_KEY),String(start));
 assert.equal(startSetupBench(session,start+10000),start);
 assert.equal(startSetupBench(session,start+10000,true),start+10000);
 assert.equal(readSetupStart(session,start+10000),start+10000);
 assert.equal(readSetupStart(session,start+10000+3600001),null);
});
test('V3.5 cannot record physical acceptance from software state alone',()=>{
 const session=memory(),local=memory(),start=1730000000000;
 startSetupBench(session,start);
 for(const [softwareLive,operatorObserved] of [[false,true],[true,false],[false,false]]){
  assert.throws(()=>finishSetupBench({startStore:session,resultsStore:local,
   now:start+60000,softwareLive,operatorObserved}));
 }
 assert.equal(local.getItem(PROJECTION_SETUP_RESULTS_KEY),null);
});
test('V3.5 measures under ten minutes as operator-reported UAT, not photon telemetry',()=>{
 const session=memory(),local=memory(),start=1730000000000;
 startSetupBench(session,start);
 const a=finishSetupBench({startStore:session,resultsStore:local,
  now:start+FIRST_SETUP_TARGET_MS-1000,
  softwareLive:true,operatorObserved:true,notes:'kamera rig tetap'});
 assert.equal(a.passedTarget,true);
 assert.equal(a.elapsedMs,599000);
 assert.equal(a.observedByOperator,true);
 assert.equal(a.scope,'FLOOR');
 const b=finishSetupBench({startStore:session,resultsStore:local,
  now:start+FIRST_SETUP_TARGET_MS,softwareLive:true,operatorObserved:true});
 assert.equal(b.passedTarget,false);
 const saved=JSON.parse(local.getItem(PROJECTION_SETUP_RESULTS_KEY)??'[]');
 assert.equal(saved.length,2);
 assert.equal(saved[0].passedTarget,false);
 assert.equal(saved[1].passedTarget,true);
});
test('V3.5 default FLOOR artwork reads original clean canvas, not software interaction overlay',()=>{
 const composer=readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 assert.match(composer,/floorCanvas,cameraOn,bodySelected/);
 assert.match(composer,/s==='FLOOR'&&!readyMedia\('FLOOR'\)/);
 assert.match(composer,/const source=floorCanvas\.current/);
 assert.match(composer,/floorMedia=floorReadyRef\.current/);
 assert.match(stage,/ref=\{floorCanvas\}/);
 assert.match(stage,/ref=\{interactionCanvas\}/);
 assert.doesNotMatch(composer,/interactionCanvas/);
});
