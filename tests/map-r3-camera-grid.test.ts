import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapGridFractions} from '../src/studio/v3/mapStageModel.ts';

test('MAP-R3 grid is measured in physical meters rather than percent of canvas',()=>{
 assert.equal(mapGridFractions(5,1).length,4);
 assert.equal(mapGridFractions(5,0.5).length,9);
 assert.equal(mapGridFractions(5,0.25).length,19);
 assert.ok(Math.abs(mapGridFractions(5,0.5)[0]-.1)<1e-12);
 assert.ok(Math.abs(mapGridFractions(2.5,0.25).at(-1)!-.9)<1e-12);
 assert.deepEqual(mapGridFractions(0,0.5),[]);
 assert.deepEqual(mapGridFractions(5,0),[]);
 assert.ok(mapGridFractions(20,0.25).length<=80);
});

test('MAP-R3 camera and projector are always visible together with no physical output opened by fullscreen',()=>{
 const read=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8');
 const editor=read('../src/studio/v3/MapWysiwygWorkspace.tsx');
 const router=read('../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx');
 assert.match(editor,/requestFullscreen\?\.\(\)/);
 assert.match(editor,/document\.fullscreenElement===wrapper\.current/);
 assert.match(editor,/containedImageRect/);
 assert.match(editor,/pointerInSource/);
 assert.match(editor,/mapOverlay\('source'\)/);
 assert.match(editor,/mapOverlay\('output'\)/);
 assert.match(editor,/onCommitCameraQuad\(cameraDraftRef\.current\)/);
 assert.match(router,/<MapWysiwygWorkspace/);
 assert.doesNotMatch(router,/className="stage-dual-qa-disclosure"|Uji proyektor/);
 assert.match(router,/allBlackout/);
 const store=read('../src/footprints/stage-optics/DualSurfaceSessionStore.ts');
 assert.match(store,/STAGE_HARDWARE_ENABLED/);
 assert.match(store,/armDualSurfaceLiveFromPerform/);
});
