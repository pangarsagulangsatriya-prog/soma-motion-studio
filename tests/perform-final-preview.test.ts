import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cueToFinalSurface} from '../src/studio/v3/performFinalPreviewModel.ts';

const read=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8');

test('Perform Final Preview honors cues and never authorizes a projector',()=>{
 assert.equal(cueToFinalSurface('overview'),'floor');
 assert.equal(cueToFinalSurface('floor'),'floor');
 assert.equal(cueToFinalSurface('body'),'body');
 assert.equal(cueToFinalSurface('split'),'split');
 const code=read('../src/studio/v3/PerformFinalPreview.tsx');
 assert.match(code,/document\.fullscreenElement===viewport\.current/);
 assert.match(code,/viewport\.requestFullscreen\?\.\(\)/);
 assert.match(code,/inputRaster\.current/);
 assert.match(code,/floorRaster\.current/);
 assert.match(code,/bodyRaster\.current/);
 assert.match(code,/Skeleton/);
 assert.ok(!code.includes('getUserMedia('));
 assert.ok(!code.includes('armDualSurfaceLiveFromPerform'));
 assert.ok(!code.includes('openDualSurfaceOutputWindow'));
});

test('Perform preserves the mounted composition and shares exact physical source raster',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(stage,/\(composerOpen\|\|operatorMode\)&&<div className="soma-composer-host"/);
 assert.match(stage,/workspaceHidden=\{!composerOpen&&!operatorMode\}/);
 assert.match(stage,/outputBodyRaster=\{performBodyRaster\} outputFloorRaster=\{performFloorRaster\}/);
 assert.match(stage,/onSkeletonChange=\{setSkeletonVisible\}/);
 assert.match(stage,/setSkeletonVisible\(false\)/);
 assert.match(composer,/const bodyOutput=outputBodyRaster\?\?ownBodyOutput/);
 assert.match(composer,/const floorOutput=outputFloorRaster\?\?ownFloorOutput/);
 assert.match(composer,/syncDualSurfaceRuntime\(/);
});
