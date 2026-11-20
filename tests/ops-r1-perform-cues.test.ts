import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {operatorCueAt,operatorShortcut} from '../src/studio/v3/OperatorStageModel.ts';
import {
 defaultPerformCueGrid,normalizePerformCueGrid,updatePerformCueSlot,evaluatePerformReadiness,
 PERFORM_GRID_SIZE,PERFORM_SCENES,performCueAuthorizesLight
} from '../src/studio/v3/performCueModel.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('OPS-R1: eight cue cards preserve stable IDs without deleted visual scenes',()=>{
 const grid=defaultPerformCueGrid();
 assert.equal(grid.schema,'soma.perform-cues');
 assert.equal(grid.slots.length,PERFORM_GRID_SIZE);
 assert.deepEqual(new Set(grid.slots.map(c=>c.id)).size,8);
 assert.deepEqual(PERFORM_SCENES,['footprints']);
 assert.ok(grid.slots.every(s=>PERFORM_SCENES.includes(s.scene)));
});
test('OPS-R1: editing a cue keeps other slots unchanged and persists data only',()=>{
 const grid=defaultPerformCueGrid();
 const next=updatePerformCueSlot(grid,3,{label:'Arsip putus',view:'split'});
 assert.equal(next.slots[3].scene,'footprints');
 assert.equal(next.slots[3].label,'Arsip putus');
 assert.equal(next.slots[3].view,'split');
 assert.deepEqual(grid.slots[0],next.slots[0]);
 assert.equal(performCueAuthorizesLight(),false);
 assert.ok(!JSON.stringify(next).includes('approved'));
 assert.ok(!JSON.stringify(next).includes('armed'));
});
test('OPS-R1: malformed and stale cue profiles do not carry arbitrary scenes or permissions',()=>{
 const grid=defaultPerformCueGrid();
 assert.deepEqual(normalizePerformCueGrid(null),grid);
 assert.deepEqual(normalizePerformCueGrid({schema:'evil',version:1,slots:[]}),grid);
 const injected=structuredClone(grid);
 injected.slots[0].scene='unknown' as typeof injected.slots[0]['scene'];
 injected.slots[1].label='  Custom Cue  ';
 const safe=normalizePerformCueGrid({...injected,releaseApproved:true});
 assert.equal(safe.slots[0].scene,'footprints');
 assert.equal(safe.slots[1].label,'Custom Cue');
 assert.equal('releaseApproved' in safe,false);
 assert.throws(()=>updatePerformCueSlot(grid,99,{view:'split'}));
});
test('OPS-R1: MP4/3D remain software preview with no hardware-ready state',()=>{
 for(const source of ['video','simulator'] as const){
  const result=evaluatePerformReadiness({source,cameraOk:true,identityOk:true,floorOk:true,bodyOutputQa:true,floorOutputQa:true});
  assert.equal(result.state,'preview');
  assert.match(result.reason,/fisik terkunci/);
 }
});
test('OPS-R1: loss of tracking/identity blocks operator preview recovery',()=>{
 const base={source:'webcam' as const,cameraOk:true,identityOk:true,floorOk:true,bodyOutputQa:false,floorOutputQa:false};
 assert.equal(evaluatePerformReadiness(base).state,'qa-required');
 assert.equal(evaluatePerformReadiness({...base,cameraOk:false}).state,'attention');
 assert.equal(evaluatePerformReadiness({...base,identityOk:false}).state,'attention');
 assert.equal(evaluatePerformReadiness({...base,floorOk:false}).state,'attention');
 assert.equal(evaluatePerformReadiness({...base,bodyOutputQa:true,floorOutputQa:true}).state,'qa-required');
});
test('OPS-R1: existing four view cues and blackout hotkey are preserved',()=>{
 assert.equal(operatorCueAt(0).id,'overview');
 assert.equal(operatorCueAt(3).id,'split');
 assert.equal(operatorShortcut('KeyB',false),'blackout');
 assert.equal(operatorShortcut('Escape',false),'blackout');
 assert.equal(operatorShortcut('KeyB',true),null);
 assert.equal(operatorShortcut('ArrowRight',false),'next');
});
test('OPS-R1: cue layouts survive visual reset and blackout remains fail-closed',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const console=read('../src/studio/v3/OperatorStageConsole.tsx');
 assert.doesNotMatch(stage,/selectFloorScene\(slot\.scene\)/);
 assert.match(stage,/setOperatorCue\(\['overview','body','floor','split'\]\.indexOf\(slot\.view\)\)/);
 assert.match(stage,/onBlackoutRef\.current\(\);setPerformBlackout\(true\)/);
 assert.match(stage,/onResume=\{\(\)=>\{if\(performUnsafeRef\.current\)return;/);
 assert.match(stage,/const nextCue=\(\)=>applyPerformSlot/);
 assert.match(stage,/cueNavigationRef\.current\.next\(\)/);
 assert.match(stage,/cueNavigationRef\.current\.previous\(\)/);
 assert.match(console,/disabled=\{activeSlot===cueGrid\.slots\.length-1\}/);
 assert.match(console,/cueGrid\.slots\.map/);
 assert.match(console,/performCueScope\(outputRouteMode\)/);
 assert.match(console,/Tampilan berikutnya/);
 assert.ok(!console.includes('setTransport('));
});
test('OPS-R1: cue recall never activates projector, and Map QA remains separate',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const map=read('../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx');
 assert.match(stage,/setMappingOpen\(true\);setComposerStartQA\(true\)/);
 assert.match(map,/samples\.length<5/);
 assert.match(map,/blackoutObserved/);
 assert.match(map,/experimentLocked&&mode!=='blackout'/);
 assert.ok(!read('../src/studio/v3/performCueModel.ts').includes('setTransport('));
});
