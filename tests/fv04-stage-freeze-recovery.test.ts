import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('FV04 freeze: material GPU remains owned by the Stage, never per thumbnail',()=>{
 const stage=read('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 const preview=read('../src/studio/v3/FlagshipLivePreview.tsx');
 assert.match(stage,/new FootprintGpuMaterialRuntime\(document\.createElement\('canvas'\)\)/);
 assert.doesNotMatch(preview,/FootprintGpuMaterialRuntime/);
 assert.match(preview,/THUMBNAIL_FPS=6/);
 assert.match(preview,/ctx\.drawImage\(live,0,0,canvas\.width,canvas\.height\)/);
});
test('FV04 freeze: existing local GPU material does not receive global Hydra noise or double feedback',()=>{
 const runtime=read('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 assert.match(runtime,/if\(materialMode\(this\.settings\)!==null\)\{\s*graph=source\(\)/);
 assert.match(runtime,/else if\(style==='grain'\)/);
 assert.match(runtime,/else if\(style==='echo'\)/);
});
test('FV04 freeze: shader Stage pass throttled to 30 fps; event engine and projectors unchanged',()=>{
 const runtime=read('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 assert.match(runtime,/nowMs-this\.lastFrameMs<1000\/30/);
 assert.match(runtime,/this\.lastFrameMs=0;this\.seen\.clear/);
 assert.match(runtime,/this\.gpuMaterial\?\.reset\(\)/);
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(stage,/hydraRuntime\.current\.tick\(/);
 const plan=read('../src/studio/v3/composeLayerPlan.ts');
 assert.match(plan,/if\(physical&&experiment\)return \[\]/);
});
