import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');

test('SOMA black-frame: curated GPU output passes a stable 2D buffer to Compose',()=>{
 const runtime=read('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(runtime,/get compositingSource\(\):HTMLCanvasElement\|null/);
 assert.match(runtime,/materialMode\(this\.settings\)!==null\?this\.sourceCanvas:this\.outputCanvas/);
 assert.match(stage,/hydraStablePreviewCanvas\.current=hydraRuntime\.current\.compositingSource/);
 assert.match(stage,/visualFloorCanvas=\{hydraStablePreviewCanvas\}/);
 assert.match(runtime,/materialHasSignal\(this\.sourceCanvas!,nowMs\)/);
});
test('SOMA black-frame: when WebGL returns empty pixels restore verified artist footprint',()=>{
 const runtime=read('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 assert.match(runtime,/this\.art\.contactCount>0&&!this\.materialHasSignal/);
 assert.match(runtime,/this\.sourceContext\.drawImage\(this\.artCanvas,0,0,640,360\)/);
});
test('SOMA black-frame: empty material returns visible decoded MP4 diagnostic in Compose only',()=>{
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(composer,/visualIsEmpty/);
 assert.match(composer,/materialProbe/);
 assert.match(composer,/Render efek kosong · MP4 ditampilkan sementara/);
 assert.match(composer,/kind==='hydra'\?\(!physical&&\(visualIsWaiting\|\|visualIsEmpty\)\?/);
 assert.match(composer,/videoRef\.current\?\.videoWidth/);
 const plan=read('../src/studio/v3/composeLayerPlan.ts');
 assert.match(plan,/if\(physical&&experiment\)return \[\]/);
 assert.match(plan,/if\(physical&&\(kind==='input'\|\|kind==='hydra'\|\|kind==='scene'\)\)return \[\]/);
});
test('SOMA black-frame: Chromium pixel QA is a required PR check rather than screenshot-only note',()=>{
 const script=read('../scripts/fv-material-pixel-browser-qa.mjs');
 const workflow=read('../.github/workflows/fv-material-pixel-qa.yml');
 assert.match(script,/runtime\.compositingSource/);
 assert.match(script,/assert\.ok\(r\.bright>25/);
 assert.match(script,/assert\.ok\(status\.every\(s=>s\.bright>20\)/);
 assert.match(workflow,/node scripts\/fv-material-pixel-browser-qa\.mjs/);
 assert.doesNotMatch(workflow,/continue-on-error: true/);
});
