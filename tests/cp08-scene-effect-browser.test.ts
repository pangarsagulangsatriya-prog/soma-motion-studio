import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARTISTIC_CATALOG} from '../src/footprints/scenes/artisticCatalog.ts';
import {composerLayerOrder,composerSourceKind} from '../src/studio/v3/composeLayerPlan.ts';
import {sceneIdFromSource,sceneLayerDescriptor,sceneActionPosition,
 sceneSourceId,syntheticSceneEvents,ComposedSceneRuntime} from '../src/studio/v3/composeSceneEngine.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('CP08: all 14 canonical scenes have stable layer source IDs',()=>{
 assert.equal(ARTISTIC_CATALOG.length,14);
 for(const scene of ARTISTIC_CATALOG){
  const layer=sceneLayerDescriptor(scene.id);
  assert.equal(sceneIdFromSource(layer.mediaId),scene.id);
  assert.equal(layer.mediaId,sceneSourceId(scene.id));
  assert.equal(composerSourceKind(layer,'FLOOR'),'scene');
  assert.equal(layer.blend,'screen');
 }
 assert.equal(sceneIdFromSource('@scene:malicious'),null);
 assert.equal(sceneIdFromSource('@stage:input'),null);
});
test('CP08: layer ordering handles scene as independent source and excludes projector',()=>{
 const layers=[{id:'base',mediaId:'@stage:input',name:'MP4',visible:true,opacity:100,blend:'source-over'},
  {id:'scene',...sceneLayerDescriptor('living-water')},
  {id:'effect',mediaId:'@stage:hydra',name:'Hydra',visible:true,opacity:65,blend:'screen'}];
 assert.deepEqual(composerLayerOrder(layers,'FLOOR',false,true).map(x=>x.kind),['input','scene','hydra']);
 assert.deepEqual(composerLayerOrder(layers,'FLOOR',true,false).map(x=>x.kind),[]);
});
test('CP08: Apply leaves layer count; Replace selects existing index, Add appends',()=>{
 assert.equal(sceneActionPosition('replace',3,1),1);
 assert.equal(sceneActionPosition('replace',3,18),2);
 assert.equal(sceneActionPosition('add',3,1),3);
 assert.equal(sceneActionPosition('replace',0,0),0);
});
test('CP08: actual runtime ingests canonical simulated contact events, not arbitrary decorative SVG',()=>{
 const events=syntheticSceneEvents();
 assert.equal(events.length,5);
 assert.equal(events.every(x=>x.verified&&x.kind==='contact'&&x.source==='simulator'),true);
 const runtime=new ComposedSceneRuntime('ground-smoke');
 runtime.ingest(events,'test-session',1200);
 assert.equal(runtime.contactCount,5);
 runtime.ingest(events,'test-session',1300);
 assert.equal(runtime.contactCount,5,'no duplicated contacts');
 runtime.skipExisting(events,'new-session');
 assert.equal(runtime.contactCount,0,'do not replay old session on new layer');
});
test('CP08: Scene browser and compositor use the same artistic runtime for sample and layer',()=>{
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 const browser=read('../src/studio/v3/SceneEffectBrowser.tsx');
 const engine=read('../src/studio/v3/composeSceneEngine.ts');
 assert.match(browser,/paintSceneSample\(ref\.current,id\)/);
 assert.match(browser,/onAction\(id,'apply'\)/);
 assert.match(browser,/onAction\(id,'replace'\)/);
 assert.match(browser,/onAction\(id,'add'\)/);
 assert.match(engine,/new ArtisticFootprintRuntime\(\)/);
 assert.match(composer,/kind==='scene'&&!physical\?sceneCanvas\(/);
 assert.match(composer,/onSceneAction=\{actOnScene\}/);
 assert.match(composer,/onEffectAction=\{actOnEffect\}/);
 assert.match(composer,/if\(action==='add'&&selectedCount>=24\)/);
});
