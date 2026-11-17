import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGE_PREVIEW_MODES,parseStagePreviewMode,visiblePreviewSurfaces,previewLabel}
 from '../src/studio/v3/stagePreviewModel.ts';
test('all three stage view modes are explicit and labeled',()=>{
 assert.deepEqual(STAGE_PREVIEW_MODES.map(item=>item.id),['split','body','floor']);
 assert.equal(previewLabel('split'),'BODY + FLOOR');
 assert.equal(previewLabel('body'),'BODY · MASK');
 assert.equal(previewLabel('floor'),'FLOOR · PATH');
});
test('unknown persisted value falls back to split without corrupting stage state',()=>{
 assert.equal(parseStagePreviewMode('invalid'),'split');
 assert.equal(parseStagePreviewMode(null),'split');
 assert.equal(parseStagePreviewMode('floor'),'floor');
 assert.equal(parseStagePreviewMode('body'),'body');
});
test('switching software preview never claims projector readiness',()=>{
 assert.deepEqual(visiblePreviewSurfaces('split'),['body','floor']);
 assert.deepEqual(visiblePreviewSurfaces('floor'),['floor']);
 assert.deepEqual(visiblePreviewSurfaces('body'),['body']);
});
