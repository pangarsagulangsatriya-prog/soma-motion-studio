import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARTISTIC_CATALOG,catalogRecipe,catalogThumbnailSvg,validateCatalogSceneId} from '../src/footprints/scenes/artisticCatalog.ts';
import {FLOOR_SCENE_IDS,FLOOR_SCENES} from '../src/footprints/scenes/sceneRegistry.ts';
import {COMPOSE_SCENES} from '../src/studio/v3/composeWorkspaceModel.ts';
import {ArtisticFootprintRuntime} from '../src/footprints/scenes/ArtisticFootprintRuntime.ts';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {normalizeHydraFootprintSettings} from '../src/footprints/scenes/hydraFootprintModel.ts';
const textFile=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const sceneIds=ARTISTIC_CATALOG.map(scene=>scene.id);
const busFixture=()=>{
 const engine=new FloorInteractionEngine();engine.reset('video');
 for(let i=0;i<6;i++){
  const input={source:'video' as const,actorId:i%2?'B':'A',foot:(i%2?'right':'left') as 'right'|'left',
   basis:'image-2d' as const,confidence:.91,verified:true,
   x:.19+i*.11,y:.44+(i%2)*.12,atMs:1000+i*120,eventId:'fixed-'+i};
  engine.observe(input);
  assert.ok(engine.contact(input));
  assert.equal(engine.contact(input),null);
 }
 return engine;
};
test('VIS-R3: catalog exactly preserves the original fourteen scene IDs and names',()=>{
 assert.equal(sceneIds.length,14);
 assert.deepEqual(sceneIds,['footprints',...FLOOR_SCENE_IDS]);
 assert.equal(new Set(sceneIds).size,14);
 assert.deepEqual(COMPOSE_SCENES.map(s=>s.id),sceneIds);
 for(const scene of FLOOR_SCENES){
  assert.equal(catalogRecipe(scene.id).title,scene.name);
  assert.equal(catalogRecipe(scene.id).trigger,scene.trigger);
  assert.equal(validateCatalogSceneId(scene.id),true);
 }
 assert.equal(validateCatalogSceneId('unknown'),false);
});
test('VIS-R3: every scene owns distinctive motif, palette and self-contained thumbnail',()=>{
 const motifs=new Set(ARTISTIC_CATALOG.map(s=>s.motif));
 assert.equal(motifs.size,14);
 assert.equal(new Set(ARTISTIC_CATALOG.map(s=>s.paper+':'+s.ink+':'+s.accent)).size,14);
 const thumbs=ARTISTIC_CATALOG.map(catalogThumbnailSvg);
 assert.equal(new Set(thumbs).size,14);
 for(const svg of thumbs){assert.match(svg,/^<svg/);assert.match(svg,/<ellipse/);assert.ok(!svg.includes('<script'));}
});
test('VIS-R3: all 14 scenes consume six verified events as six distinct foot marks',()=>{
 const fixture=busFixture();
 for(const recipe of ARTISTIC_CATALOG){
  const artist=new ArtisticFootprintRuntime();
  artist.ingest(fixture.canonicalRecent,fixture.generation,6000);
  assert.equal(artist.contactCount,6,recipe.id);
  assert.equal(new Set(artist.stampsSnapshot.map(s=>s.id)).size,6,recipe.id);
  artist.ingest(fixture.canonicalRecent,fixture.generation,6500);
  assert.equal(artist.contactCount,6,recipe.id);
 }
});
test('VIS-R3: switching scenes skips stale history, then accepts only a fresh contact',()=>{
 const fixture=busFixture(),artist=new ArtisticFootprintRuntime();
 artist.ingest(fixture.canonicalRecent,fixture.generation,6000);
 assert.equal(artist.contactCount,6);
 artist.skipExisting(fixture.canonicalRecent,fixture.generation);
 artist.ingest(fixture.canonicalRecent,fixture.generation,6100);
 assert.equal(artist.contactCount,0);
 const input={source:'video' as const,actorId:'A',foot:'left' as const,basis:'image-2d' as const,
  verified:true,confidence:.9,x:.83,y:.64,atMs:2500,eventId:'new-contact'};
 assert.ok(fixture.contact(input));
 artist.ingest(fixture.canonicalRecent,fixture.generation,6300);
 assert.equal(artist.contactCount,1);
});
test('VIS-R3: stationary or ambiguous input cannot fabricate contact marks in any scene',()=>{
 const engine=new FloorInteractionEngine();engine.reset('camera');
 for(let time=1000;time<=11000;time+=100)
  engine.observe({source:'camera',actorId:'A',x:.3,y:.4,atMs:time,confidence:.8,basis:'presence-only'});
 for(const recipe of ARTISTIC_CATALOG){
  const artist=new ArtisticFootprintRuntime();artist.ingest(engine.canonicalRecent,engine.generation);
  assert.equal(artist.contactCount,0,recipe.id);
 }
});
test('VIS-R3: source generation resets artistic history without restoring previous contacts',()=>{
 const bus=busFixture(),artist=new ArtisticFootprintRuntime();
 artist.ingest(bus.canonicalRecent,bus.generation);
 assert.equal(artist.contactCount,6);
 bus.reset('simulator');artist.ingest(bus.canonicalRecent,bus.generation);
 assert.equal(artist.contactCount,0);
});
test('VIS-R3: legacy persisted settings remain valid; catalog metadata is bounded',()=>{
 const prev=normalizeHydraFootprintSettings({enabled:true,style:'echo',artwork:'off'});
 assert.equal(prev.catalogVisual,true);assert.equal(prev.catalogScene,'footprints');
 const saved=normalizeHydraFootprintSettings({catalogScene:'living-water',catalogVisual:false,artworkView:'paths'});
 assert.equal(saved.catalogScene,'living-water');assert.equal(saved.catalogVisual,false);
 assert.equal(saved.artworkView,'paths');
 assert.equal(normalizeHydraFootprintSettings({catalogScene:'hacked-scene'}).catalogScene,'footprints');
});
test('VIS-R3: Compose uses software preview; hardware keeps QA-approved cleanFloorOutput',()=>{
 const composer=textFile('../src/studio/v3/SurfaceComposer.tsx');
 const stage=textFile('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const core=textFile('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 assert.match(stage,/floorCanvas=\{cleanFloorOutput\}/);
 assert.match(stage,/previewFloorEnabled=\{hydraSettings\.enabled&&hydraStatus==='ready'\}/);
 assert.match(composer,/!physical&&previewFloorEnabled/);
 assert.match(composer,/catalogThumbnailSvg\(catalogRecipe\(scene\.id\)\)/);
 assert.match(core,/this\.art\.skipExisting\(events,generation\)/);
 assert.ok(!core.includes('getUserMedia('));
});
