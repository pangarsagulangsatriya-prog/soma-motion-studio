import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ArtisticFootprintRuntime,ARTISTIC_FOOTPRINT_STYLES,normalizeArtisticFootprintConfig} from '../src/footprints/scenes/ArtisticFootprintRuntime.ts';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {normalizeHydraFootprintSettings} from '../src/footprints/scenes/hydraFootprintModel.ts';

const fixture=()=>{
 const bus=new FloorInteractionEngine();bus.reset('video');
 const obs={source:'video' as const,actorId:'A',confidence:.92,basis:'image-2d' as const};
 for(let i=0;i<6;i++){
  const t=1000+i*100;
  const x=.2+i*.095,y=.42+(i%2)*.08;
  bus.observe({...obs,x,y,atMs:t});
  const input={...obs,eventId:'fixture-step-'+i,foot:(i%2?'right':'left') as 'right'|'left',verified:true,x,y,atMs:t};
  assert.ok(bus.contact(input));
  assert.equal(bus.contact(input),null);
 }
 return bus;
};

test('VIS-R2: 4 flagship scene IDs are unique and stable',()=>{
 assert.deepEqual(ARTISTIC_FOOTPRINT_STYLES.map(s=>s.id),['trace','compression','negative-memory','wave-record']);
 assert.equal(new Set(ARTISTIC_FOOTPRINT_STYLES.map(s=>s.id)).size,4);
});
test('VIS-R2: exactly six contact marks for fixed six-step fixture across all art styles',()=>{
 const bus=fixture();
 for(const style of ARTISTIC_FOOTPRINT_STYLES){
  const scene=new ArtisticFootprintRuntime();
  scene.ingest(bus.canonicalRecent,bus.generation);
  assert.equal(scene.contactCount,6,style.id);
  assert.equal(new Set(scene.stampsSnapshot.map(s=>s.id)).size,6);
  scene.ingest(bus.canonicalRecent,bus.generation);
  assert.equal(scene.contactCount,6,style.id);
 }
});
test('VIS-R2: standing still only produces presence heartbeat, never a new contact',()=>{
 const bus=new FloorInteractionEngine();bus.reset('camera');
 const artist=new ArtisticFootprintRuntime();
 for(let t=1000;t<=11000;t+=100)
  bus.observe({source:'camera',actorId:'A',x:.3,y:.7,confidence:.9,atMs:t,basis:'presence-only'});
 artist.ingest(bus.canonicalRecent,bus.generation);
 assert.equal(artist.contactCount,0);
 assert.equal(artist.pathPointCount,0);
});
test('VIS-R2: contact identity and visibility are preserved under ambiguity',()=>{
 const bus=fixture();
 const artist=new ArtisticFootprintRuntime();artist.ingest(bus.canonicalRecent,bus.generation);
 assert.deepEqual(artist.stampsSnapshot.map(s=>s.foot),['left','right','left','right','left','right']);
 assert.ok(artist.stampsSnapshot.every(s=>s.actorId==='A'));
 const anon=bus.canonicalRecent[0];
 artist.ingest([{...anon,eventId:'false-contact',actorId:'unassigned-0',kind:'contact',foot:'left',verified:true}],bus.generation);
 assert.equal(artist.contactCount,6);
});
test('VIS-R2: new source generation clears contacts and paths; existing events do not recreate stamps',()=>{
 const bus=fixture(),artist=new ArtisticFootprintRuntime();
 artist.ingest(bus.canonicalRecent,bus.generation);
 assert.equal(artist.contactCount,6);
 bus.reset('simulator');
 artist.ingest(bus.canonicalRecent,bus.generation);
 assert.equal(artist.contactCount,0);
 assert.equal(artist.pathPointCount,0);
});
test('VIS-R2: artistic/literal and path/footprint switches validated without extra contacts',()=>{
 const defaults=normalizeArtisticFootprintConfig({style:'trace',view:'paths',treatment:'literal',intensity:4,persistence:-4});
 assert.equal(defaults.view,'paths');assert.equal(defaults.treatment,'literal');
 assert.equal(defaults.intensity,1);assert.equal(defaults.persistence,0);
 const hydra=normalizeHydraFootprintSettings({enabled:true,artwork:'negative-memory',artworkView:'footprints',artworkTreatment:'literal'});
 assert.equal(hydra.artwork,'negative-memory');
 assert.equal(hydra.artworkView,'footprints');assert.equal(hydra.artworkTreatment,'literal');
 assert.equal(normalizeHydraFootprintSettings({artwork:'invalid'}).artwork,'off');
});
test('VIS-R2: renderer stays behind software-only Hydra source and retains existing physical QA feed',()=>{
 const file=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
 const runtime=file('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 const stage=file('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(runtime,/this\.art\.ingest\(events,generation,nowMs\)/);
 assert.match(runtime,/this\.art\.paint\(this\.artCanvas/);
 assert.match(runtime,/this\.engine\.tick\(delta\)/);
 assert.ok(!runtime.includes('getUserMedia('));
 assert.match(stage,/floorCanvas=\{cleanFloorOutput\}/);
 assert.match(stage,/artworkView/);
});
