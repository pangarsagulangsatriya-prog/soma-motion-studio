import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEGACY_VISUAL_STORAGE_KEYS,V5_PRESET_KEY,stripRetiredVisualLayers,
 isRetiredVisualSource,resetOldVisualStorage} from '../src/studio/v3/resetVisualMigration.ts';
import {composerSourceKind,composerLayerOrder} from '../src/studio/v3/composeLayerPlan.ts';
import {defaultPerformCueGrid,normalizePerformCueGrid,performCueAuthorizesLight,
 PERFORM_SCENES} from '../src/studio/v3/performCueModel.ts';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');

test('RESET-00: legacy scene/Hydra layer IDs never produce a renderer',()=>{
 for(const id of ['@stage:hydra','@scene:trace','@scene:snowfall','@scene:fireworks']){
  assert.equal(isRetiredVisualSource(id),true);
  assert.equal(composerSourceKind({mediaId:id,name:'Old effect'},'FLOOR'),'empty');
 }
 assert.equal(isRetiredVisualSource('@stage:floor'),false);
});
test('RESET-00: retained MP4/media transforms and tracking surfaces survive cleanup',()=>{
 const old={
  FLOOR:[
   {id:'base',mediaId:'@stage:floor',opacity:100,recipe:'contact-reveal',motionRecipe:{trigger:'contact'}},
   {id:'video',mediaId:'asset-mp4',opacity:75,recipe:'motion-v2',motionRecipe:{trigger:'pivot'}},
   {id:'old',mediaId:'@stage:hydra',opacity:40},
   {id:'old-scene',mediaId:'@scene:the-swarm',opacity:100}
  ],
  'BODY A':[{id:'body',mediaId:'@stage:body',opacity:100}]
 };
 const cleaned=stripRetiredVisualLayers(old);
 assert.deepEqual(cleaned.FLOOR.map(x=>x.id),['base','video']);
 assert.equal(cleaned.FLOOR[1].mediaId,'asset-mp4');
 assert.equal(cleaned.FLOOR[1].opacity,75);
 assert.ok(!('recipe' in cleaned.FLOOR[0]));
 assert.ok(!('motionRecipe' in cleaned.FLOOR[1]));
 assert.deepEqual(cleaned['BODY A'],old['BODY A']);
 assert.equal(old.FLOOR[0].recipe,'contact-reveal','migration does not mutate originals');
});
test('RESET-00: retired visual preset keys are cleared without touching media storage',()=>{
 const removed:string[]=[];
 resetOldVisualStorage({removeItem:key=>{removed.push(key)}}); 
 assert.deepEqual(removed,LEGACY_VISUAL_STORAGE_KEYS);
 assert.ok(removed.includes(V5_PRESET_KEY));
 assert.ok(!removed.some(k=>/asset|media|camera|stage-profile/.test(k)));
});
test('RESET-00: no gallery, visual Inspector or Hydra GPU engine in Stage/Compose',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const compose=read('../src/studio/v3/SurfaceComposer.tsx');
 for(const legacy of ['SceneEffectBrowser','FlagshipInspector','HydraEffectInspector','ComposedSceneRuntime',
  'SnowfallRenderer','ProceduralSceneRuntime','PersistentHydraFootprintRuntime',
  'ARTISTIC_CATALOG','MOTION_RECIPE_TRIGGERS','Effect Recipe']){
  assert.ok(!stage.includes(legacy)&&!compose.includes(legacy),'Legacy renderer still referenced: '+legacy);
 }
 assert.match(compose,/className="soma-ia-media"/);
 assert.match(compose,/className="s64-upload"/);
 assert.match(compose,/onImportAssets|onRemoveAsset/);
 assert.match(compose,/className="soma-ia-layers"/);
 assert.match(compose,/ComposerEventTimeline capture=\{timelineCapture\}/);
 assert.match(stage,/FloorInteractionEngine/);
 assert.match(stage,/useSharedAssetRegistry/);
});
test('RESET-00: MP4 preview can feed QA-gated output while legacy FLOOR remains available',()=>{
 const layers=[
  {name:'MP4',mediaId:'@stage:input',visible:true,opacity:100,blend:'source-over'},
  {name:'FLOOR',mediaId:'@stage:floor',visible:true,opacity:100,blend:'source-over'}
 ];
 assert.deepEqual(composerLayerOrder(layers,'FLOOR',true,true).map(x=>x.kind),['input','floor']);
 assert.deepEqual(composerLayerOrder(layers,'FLOOR',true,false).map(x=>x.kind),['floor']);
});
test('RESET-00: old Perform visual scenes normalize to diagnostic FLOOR, retaining cue layouts',()=>{
 assert.deepEqual(PERFORM_SCENES,['footprints']);
 const old=defaultPerformCueGrid();
 old.slots[0].scene='snowfall' as typeof old.slots[0]['scene'];
 old.slots[0].view='split';
 const safe=normalizePerformCueGrid(old);
 assert.equal(safe.slots[0].scene,'footprints');
 assert.equal(safe.slots[0].view,'split');
 assert.equal(performCueAuthorizesLight(),false);
});
