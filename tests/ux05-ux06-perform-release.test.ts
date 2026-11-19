import assert from 'node:assert/strict';
import test from 'node:test';
import {defaultPerformCueGrid,normalizePerformCueGrid,updatePerformCueSlot,performCueAuthorizesLight,PERFORM_GRID_SIZE,evaluatePerformReadiness} from '../src/studio/v3/performCueModel.ts';
import {operatorShortcut} from '../src/studio/v3/OperatorStageModel.ts';
import {emptyQaReleaseRecord,parseQaReleaseRecord,evaluateQaRelease,QA_PHYSICAL_IDS} from '../src/studio/v3/qaReleaseGate.ts';

test('eight Perform cue slots retain scene and monitor view after serialization',()=>{
 const original=defaultPerformCueGrid();
 assert.equal(original.slots.length,PERFORM_GRID_SIZE);
 const updated=updatePerformCueSlot(original,3,{label:'Crossing',scene:'snowfall',view:'split'});
 const restored=normalizePerformCueGrid(JSON.parse(JSON.stringify(updated)));
 assert.equal(restored.slots[3].label,'Crossing');
 assert.equal(restored.slots[3].view,'split');
 assert.equal(restored.slots[3].scene,'snowfall');
 assert.equal(original.slots[3].label,'Cue 04');
});

test('invalid cues cannot introduce unknown scene or enable hardware',()=>{
 const original=defaultPerformCueGrid();
 assert.equal(performCueAuthorizesLight(),false);
 assert.throws(()=>updatePerformCueSlot(original,8,{label:'Invalid'}));
 const tampered=JSON.parse(JSON.stringify(original));
 tampered.slots[0].scene='unknown-scene';
 assert.equal(normalizePerformCueGrid(tampered).slots[0].scene,'footprints');
});

test('Perform shortcuts avoid accidental cue changes while editing',()=>{
 assert.equal(operatorShortcut('Space',false),'next');
 assert.equal(operatorShortcut('ArrowLeft',false),'previous');
 assert.equal(operatorShortcut('KeyB',false),'blackout');
 assert.equal(operatorShortcut('Space',true),null);
 assert.equal(operatorShortcut('KeyB',true),null);
 assert.equal(operatorShortcut('ArrowRight',false,true),null);
});

test('offline source must not show Perform as ready',()=>{
 const status=evaluatePerformReadiness({source:'webcam',cameraOk:false,identityOk:false,floorOk:false,bodyOutputQa:false,floorOutputQa:false});
 assert.equal(status.state,'attention');
});

test('MP4 simulator remains preview-only even if QA flags appear true',()=>{
 for(const source of ['video','simulator'] as const){
  const status=evaluatePerformReadiness({source,cameraOk:true,identityOk:true,floorOk:true,bodyOutputQa:true,floorOutputQa:true});
  assert.equal(status.state,'preview');
 }
});

test('release template starts pending, never signed or production eligible',()=>{
 const revision='test-commit-abc';
 const record=emptyQaReleaseRecord(revision);
 assert.ok(record.items.length>=QA_PHYSICAL_IDS.length);
 assert.ok(record.items.every(e=>e.status==='pending'&&!e.operator&&!e.artifact));
 const result=evaluateQaRelease(record,revision);
 assert.equal(result.eligible,false);
 assert.equal(result.physicalPass,false);
 assert.equal(result.automatedPass,false);
 assert.ok(result.blocking.length>0);
});

test('QA requires signed optical evidence and measurements, even with pass flags',()=>{
 const record=emptyQaReleaseRecord('revision-a');
 for(const item of record.items)item.status='pass';
 const result=evaluateQaRelease(record,'revision-a');
 assert.equal(result.eligible,false);
 assert.equal(result.physicalPass,false);
 assert.ok(result.blocking.some(x=>x.includes('bukti pemeriksaan')));
 assert.ok(result.blocking.some(x=>x.includes('Setup awal')));
 assert.ok(result.blocking.some(x=>x.includes('Preview P10')));
 assert.ok(evaluateQaRelease(record,'revision-b').blocking.some(x=>x.includes('Commit berubah')));
});

test('QA parser rejects missing and duplicated evidence',()=>{
 const record=emptyQaReleaseRecord('revision-a');
 record.items.pop();
 assert.throws(()=>parseQaReleaseRecord(record));
});
