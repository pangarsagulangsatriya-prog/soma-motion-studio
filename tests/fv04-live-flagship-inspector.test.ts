import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FLAGSHIP_CONTROLS,flagshipControlPatch,activeFlagshipForSettings} from '../src/studio/v3/flagshipInspectorModel.ts';
import {flagshipHydraPatch} from '../src/studio/v3/flagshipVisualModel.ts';
import {normalizeHydraFootprintSettings} from '../src/footprints/scenes/hydraFootprintModel.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('FV04: three flagships expose only live, meaningful GPU sliders',()=>{
 assert.deepEqual(Object.keys(FLAGSHIP_CONTROLS),['trace','echo','rift']);
 assert.deepEqual(FLAGSHIP_CONTROLS.trace.map(x=>x.key),['mix','distortion']);
 assert.deepEqual(FLAGSHIP_CONTROLS.echo.map(x=>x.key),['feedback','distortion','mix']);
 assert.deepEqual(FLAGSHIP_CONTROLS.rift.map(x=>x.key),['distortion','mix']);
});
test('FV04: profile choice survives adjustment and bounds edits in existing shader setting ranges',()=>{
 for(const id of ['trace','echo','rift'] as const){
  const setting=normalizeHydraFootprintSettings(flagshipHydraPatch(id));
  assert.equal(activeFlagshipForSettings(setting),id);
  const patch=flagshipControlPatch('distortion',.24);
  assert.equal(activeFlagshipForSettings({...setting,...patch}),id);
 }
 assert.deepEqual(flagshipControlPatch('distortion',99),{distortion:.4});
 assert.deepEqual(flagshipControlPatch('feedback',-4),{feedback:0});
 assert.deepEqual(flagshipControlPatch('mix',NaN),{mix:0});
});
test('FV04: thumbnail animation stays lightweight and Stage owns the only GPU material pass',()=>{
 const preview=read('../src/studio/v3/FlagshipLivePreview.tsx');
 assert.doesNotMatch(preview,/new FootprintGpuMaterialRuntime/);
 assert.match(preview,/THUMBNAIL_FPS=6/);
 assert.match(preview,/document\.visibilityState==='hidden'/);
 assert.match(preview,/new IntersectionObserver\(/);
 assert.match(preview,/artistic\.paint\(sample,now/);
 assert.match(preview,/stageRef\.current\?\.current/);
 assert.match(preview,/ctx\.drawImage\(live,0,0,canvas\.width,canvas\.height\)/);
 assert.match(preview,/cancelAnimationFrame\(raf\)/);
 assert.match(preview,/observer\?\.disconnect\(\)/);
 assert.ok(!preview.includes('getUserMedia('));
});
test('FV04: Inspector controls edit real Hydra settings and reset the selected flagship',()=>{
 const inspector=read('../src/studio/v3/FlagshipInspector.tsx');
 assert.match(inspector,/FLAGSHIP_CONTROLS\[id\]\.map/);
 assert.match(inspector,/flagshipControlPatch\(/);
 assert.match(inspector,/onChange\?\.\(flagshipHydraPatch\(id\)\)/);
 assert.match(inspector,/HydraEffectInspector value=\{value\}/);
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(composer,/FlagshipInspector id=\{activeFlagshipForSettings\(hydraSettings\)!\}/);
 assert.match(composer,/stageCanvas=\{visualFloorCanvas\} stageStatus=\{hydraStatus\}/);
});
test('FV04: no bypass of physical QA for Hydra or experimental source',()=>{
 const plan=read('../src/studio/v3/composeLayerPlan.ts');
 assert.match(plan,/if\(physical&&experiment\)return \[\]/);
 assert.match(plan,/if\(physical&&\(kind==='input'\|\|kind==='hydra'\|\|kind==='scene'\)\)return \[\]/);
});
