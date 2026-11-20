import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARTISTIC_CATALOG} from '../src/footprints/scenes/artisticCatalog.ts';
import {FLAGSHIP_RECIPES,flagshipHydraPatch,isFlagshipId} from '../src/studio/v3/flagshipVisualModel.ts';
import {normalizeHydraFootprintSettings,hydraVisualAuthorizesPhysicalOutput} from '../src/footprints/scenes/hydraFootprintModel.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('FV01: flagship catalog contains exactly TRACE ECHO RIFT with distinct Hydra graphs and textures',()=>{
 assert.deepEqual(FLAGSHIP_RECIPES.map(p=>p.id),['trace','echo','rift']);
 assert.equal(new Set(FLAGSHIP_RECIPES.map(p=>p.graph)).size,3);
 assert.equal(new Set(FLAGSHIP_RECIPES.map(p=>p.artwork)).size,3);
 assert.equal(isFlagshipId('trace'),true);
 assert.equal(isFlagshipId('grain'),false);
});
test('FV01: selected flagship explicitly sets Hydra graph and disables legacy catalog override',()=>{
 for(const recipe of FLAGSHIP_RECIPES){
  const patch=flagshipHydraPatch(recipe.id);
  const normalized=normalizeHydraFootprintSettings(patch);
  assert.equal(normalized.enabled,true);
  assert.equal(normalized.style,recipe.graph);
  assert.equal(normalized.artwork,recipe.artwork);
  assert.equal(normalized.catalogVisual,false);
 }
 const runtime=read('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 assert.match(runtime,/const selected:HydraFootprintStyle=this\.settings\.style/);
 assert.doesNotMatch(runtime,/motifStyle===null\?this\.settings\.style/);
 assert.match(runtime,/this\.applyGraph\(selected\)/);
});
test('FV01: all 14 legacy scene IDs remain registered for saved compositions',()=>{
 assert.equal(ARTISTIC_CATALOG.length,14);
 const browser=read('../src/studio/v3/SceneEffectBrowser.tsx');
 assert.match(browser,/<details className="fv01-legacy"/);
 assert.match(browser,/ARTISTIC_CATALOG\.filter/);
 assert.match(browser,/onAction\(id,'replace'\)/);
 assert.match(browser,/onAction\(id,'add'\)/);
});
test('FV01: flagship card uses production artistic texture painter and only 3 primary cards',()=>{
 const browser=read('../src/studio/v3/SceneEffectBrowser.tsx');
 const preview=read('../src/studio/v3/FlagshipLivePreview.tsx');
 assert.match(preview,/const artistic=new ArtisticFootprintRuntime\(\)/);
 assert.match(preview,/artistic\.paint\(source,now/);
 assert.match(preview,/material\?\.paint\(source,events,0,now/);
 assert.match(browser,/flagships\.map\(p=><article/);
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(composer,/onFlagshipApply=\{actOnFlagship\}/);
 assert.match(composer,/onHydraSettingsChange\(flagshipHydraPatch\(id\)\)/);
 assert.match(composer,/makeLayer\(COMPOSE_STAGE_HYDRA/);
});
test('FV01: preview effects do not unlock physical projector',()=>{
 assert.equal(hydraVisualAuthorizesPhysicalOutput(),false);
 const model=read('../src/studio/v3/composeLayerPlan.ts');
 assert.match(model,/if\(physical&&\(kind==='input'\|\|kind==='hydra'\|\|kind==='scene'\)\)return \[\]/);
});
