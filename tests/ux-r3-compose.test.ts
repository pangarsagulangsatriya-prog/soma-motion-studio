import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composerSourceKind,COMPOSE_SOURCE_CHOICES} from '../src/studio/v3/composeLayerPlan.ts';
import {V5_COMPOSER_KEY,V5_PRESET_KEY,isRetiredVisualSource} from '../src/studio/v3/resetVisualMigration.ts';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');

test('RESET-00: all retired visual IDs are invalid as Composer sources',()=>{
 assert.ok(isRetiredVisualSource('@stage:hydra'));
 assert.ok(isRetiredVisualSource('@scene:footprints'));
 for(const id of ['@scene:snowfall','@scene:the-swarm','@scene:living-water'])
  assert.equal(composerSourceKind({mediaId:id,name:'retired'},'FLOOR'),'empty');
 assert.equal(COMPOSE_SOURCE_CHOICES.length,3);
 assert.deepEqual(COMPOSE_SOURCE_CHOICES.map(x=>x.id),['@stage:floor','@stage:input','@stage:body']);
});
test('RESET-00: V5 storage uses a distinct namespace',()=>{
 assert.equal(V5_COMPOSER_KEY,'soma-s64-composer-v5');
 assert.equal(V5_PRESET_KEY,'soma-s64-presets-v5');
});
test('RESET-00: original Stage embeds one Composer with no gallery or parallel source decoder',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(stage,/<SurfaceComposer embedded mapMode=\{mappingOpen&&!operatorMode\}/);
 assert.match(stage,/className="fp-stage-overview" ref=\{composeLayout\.overview\}/);
 assert.match(stage,/hidden=\{operatorMode\|\|view!=='stage'\|\|\(composerOpen&&mappingOpen\)\}/);
 assert.doesNotMatch(composer,/SceneEffectBrowser|ARTISTIC_CATALOG|HydraEffectInspector|FlagshipInspector/);
 assert.ok(!composer.includes('getUserMedia('));
});
test('RESET-00: BODY and FLOOR preview controls, Map and hardware gates remain',()=>{
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(composer,/BODY A/);
 assert.match(composer,/BODY B/);
 assert.match(composer,/FLOOR/);
 assert.match(composer,/SPLIT/);
 assert.match(composer,/experimentLocked=\{experimentLocked\}/);
 assert.match(composer,/canRenderComposeSurface\(\{/);
 const gate=read('../src/studio/v3/composePreviewGate.ts');
 assert.match(gate,/input\.physical\|\|input\.floorReady/);
});
