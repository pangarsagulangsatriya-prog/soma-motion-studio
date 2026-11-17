import test from 'node:test';
import assert from 'node:assert/strict';
import {footprintsSteps} from '../src/studio/v3/footprintsFlow.ts';
import {LEGACY_INSTRUMENTS,stageBodyPreviewGate} from '../src/studio/v3/footprintsUX.ts';

test('S6.8.7 Footprints uses one source switcher plus two optional local controls',()=>{
 assert.deepEqual(footprintsSteps.map(item=>item.id),['process','compose']);
 assert.deepEqual(footprintsSteps.map(item=>item.title),['Tracking','Visual']);
 assert.equal(new Set(footprintsSteps.map(item=>item.id)).size,2);
 assert.equal(footprintsSteps.some(item=>String(item.id)==='output'),false);
});

test('all four original visual instruments remain available through SOMA Labs',()=>{
 assert.deepEqual(LEGACY_INSTRUMENTS.map(item=>item.id),['liquid','echo','cut','body']);
 assert.ok(LEGACY_INSTRUMENTS.every(item=>item.name.length>0&&item.description.length>0));
});

test('camera source is insufficient for gait output without a fresh Body frame',()=>{
 const base={cameraOn:true,tracked:true,source:'camera',ageMs:45,performerCount:2 as 1|2,
  visibleCount:2,identityAmbiguous:false,matchedFrame:true};
 assert.equal(stageBodyPreviewGate(base),'ready');
 assert.equal(stageBodyPreviewGate({...base,source:'mouse'}),'camera-off');
 assert.equal(stageBodyPreviewGate({...base,visibleCount:1}),'identity-unsafe');
 assert.equal(stageBodyPreviewGate({...base,identityAmbiguous:true}),'identity-unsafe');
 assert.equal(stageBodyPreviewGate({...base,ageMs:700}),'stale');
});
