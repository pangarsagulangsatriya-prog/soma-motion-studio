import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composeExperimentRaster,composeExperimentStatus,composeExperimentAllowsPhysicalOutput} from '../src/studio/v3/composeExperimentRaster.ts';

test('MP4 preview chooses shared INPUT, FLOOR, BODY without camera calibration',()=>{
 assert.equal(composeExperimentRaster({source:'video',view:'input',selected:'FLOOR',physical:false}),'input');
 assert.equal(composeExperimentRaster({source:'video',view:'surface',selected:'FLOOR',physical:false}),'floor');
 assert.equal(composeExperimentRaster({source:'video',view:'surface',selected:'BODY A',physical:false}),'body');
 assert.equal(composeExperimentRaster({source:'video',view:'surface',selected:'BODY B',physical:false}),'body');
});
test('3D preview reuses source canvases while physical output stays blocked',()=>{
 assert.equal(composeExperimentRaster({source:'simulator',view:'surface',selected:'FLOOR',physical:false}),'floor');
 for(const source of ['video','simulator'] as const){
  assert.equal(composeExperimentRaster({source,view:'surface',selected:'FLOOR',physical:true}),'none');
  assert.equal(composeExperimentAllowsPhysicalOutput(source),false);
 }
 assert.equal(composeExperimentAllowsPhysicalOutput(null),true);
});
test('Offline MP4 readiness is explicit and avoids live camera error',()=>{
 assert.match(composeExperimentStatus('video',false,'FLOOR'),/MP4 belum menghasilkan frame/);
 assert.match(composeExperimentStatus('video',true,'FLOOR'),/preview software/);
});
test('Track passes original MP4 decoded raster to Compose; no separate decoder',()=>{
 const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(stage,/experimentInputCanvas=\{cameraCanvas\} experimentFloorCanvas=\{floorCanvas\}/);
 assert.match(stage,/experimentSource=\{experimentalKind\}/);
 assert.match(composer,/experimentFloorCanvas\?\.current\?\?floorCanvas\.current/);
 assert.match(composer,/composeExperimentRaster\(/);
 assert.match(composer,/experimentSource&&<button type="button"/);
});
