import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_STUDIO_WORKSPACE,LEGACY_INSTRUMENTS,
 defaultFootprintsWorkspace,stageBodyPreviewGate} from '../src/studio/v3/footprintsUX.ts';
import {requestStageBlackout} from '../src/footprints/stage-optics/StageBlackout.ts';

const base={cameraOn:true,tracked:true,source:'camera',ageMs:50,
 performerCount:2 as 1|2,visibleCount:2,identityAmbiguous:false,matchedFrame:true};
test('Footprints is the initial Studio workspace; four old visuals remain secondary',()=>{
 assert.equal(DEFAULT_STUDIO_WORKSPACE,'footprints');
 assert.equal(defaultFootprintsWorkspace(),true);
 assert.deepEqual(LEGACY_INSTRUMENTS.map(x=>x.id),['liquid','echo','cut','body']);
 assert.equal(new Set(LEGACY_INSTRUMENTS.map(x=>x.id)).size,4);
 assert.ok(LEGACY_INSTRUMENTS.every(x=>x.name.trim()&&x.description.trim()));
 assert.ok(LEGACY_INSTRUMENTS.every(x=>x.id!=='footprints'));
});
test('a fresh camera frame can show a body mask for one or two performers',()=>{
 assert.equal(stageBodyPreviewGate(base),'ready');
 assert.equal(stageBodyPreviewGate({...base,performerCount:1,visibleCount:0,
  identityAmbiguous:true,matchedFrame:false}),'ready');
});
test('the body preview fails closed with no camera, mouse source or stale tracking',()=>{
 assert.equal(stageBodyPreviewGate({...base,cameraOn:false}),'camera-off');
 assert.equal(stageBodyPreviewGate({...base,source:'mouse'}),'camera-off');
 assert.equal(stageBodyPreviewGate({...base,tracked:false}),'stale');
 assert.equal(stageBodyPreviewGate({...base,ageMs:451}),'stale');
 assert.equal(stageBodyPreviewGate({...base,ageMs:-81}),'stale');
 assert.equal(stageBodyPreviewGate({...base,ageMs:NaN}),'stale');
});
test('two-person body preview refuses ambiguous or reordered identities',()=>{
 assert.equal(stageBodyPreviewGate({...base,visibleCount:1}),'identity-unsafe');
 assert.equal(stageBodyPreviewGate({...base,visibleCount:3}),'identity-unsafe');
 assert.equal(stageBodyPreviewGate({...base,identityAmbiguous:true}),'identity-unsafe');
 assert.equal(stageBodyPreviewGate({...base,matchedFrame:false}),'identity-unsafe');
 assert.equal(stageBodyPreviewGate({...base,visibleCount:2,matchedFrame:true}),'ready');
});
test('operator blackout always clears the old Studio projection path',()=>{
 let called=0;
 requestStageBlackout(()=>{called++;});
 assert.equal(called,1);
});
