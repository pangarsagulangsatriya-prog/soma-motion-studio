import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPOSE_SCENES,COMPOSE_PREVIEWS,isComposeSceneId,composePreviewSelection} from '../src/studio/v3/composeWorkspaceModel.ts';
import {FLOOR_SCENE_IDS} from '../src/footprints/scenes/sceneRegistry.ts';
import {readFileSync} from 'node:fs';

test('UX-R3: Compose exposes Footprints and all 13 existing FLOOR scene IDs once',()=>{
 const ids=COMPOSE_SCENES.map(scene=>scene.id);
 assert.equal(ids.length,14);
 assert.equal(new Set(ids).size,14);
 assert.ok(ids.includes('footprints'));
 for(const id of FLOOR_SCENE_IDS)assert.ok(ids.includes(id),id);
});
test('UX-R3: scene IDs preserve existing compatibility and reject invalid values',()=>{
 for(const scene of COMPOSE_SCENES)assert.equal(isComposeSceneId(scene.id),true);
 assert.equal(isComposeSceneId('Footprints Legacy'),false);
 assert.equal(isComposeSceneId('unknown-effect'),false);
});
test('UX-R3: BODY A, BODY B, FLOOR and SPLIT remain distinct preview targets',()=>{
 assert.deepEqual(COMPOSE_PREVIEWS,['BODY A','BODY B','FLOOR','SPLIT']);
 for(const mode of COMPOSE_PREVIEWS)assert.equal(composePreviewSelection('FLOOR',mode),mode);
});
test('UX-R3: compositor is embedded in original FootprintsStageWorkspace, not a second input engine',()=>{
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const composer=readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');
 assert.match(stage,/<SurfaceComposer embedded sceneId=\{floorScene\}/);
 assert.match(stage,/className="fp-stage-overview" hidden=\{view!=='stage'\|\|\(composerOpen&&mappingOpen\)\}/);
 assert.match(stage,/onSceneChange=\{selectFloorScene\}/);
 assert.match(composer,/COMPOSE_SCENES\.map\(/);
 assert.ok(!composer.includes('getUserMedia('));
});
test('UX-R3: experimental output stays hardware gated by the existing composer',()=>{
 const composer=readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');
 assert.match(composer,/experimentLocked=\{experimentLocked\}/);
 assert.match(composer,/canRenderComposeSurface\(\{/);
 const gate=readFileSync(new URL('../src/studio/v3/composePreviewGate.ts',import.meta.url),'utf8');
 assert.match(gate,/input\.physical\|\|input\.floorReady/);
});
