import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {FLOOR_SCENES,FLOOR_SCENE_IDS,FLOOR_SCENE_PRESETS,validateFloorScenePreset,
 isFloorSceneId,loadFloorPresets,saveFloorPreset,FLOOR_PRESETS_STORAGE_KEY}
 from '../src/footprints/scenes/sceneRegistry.ts';
import {ProceduralSceneRuntime} from '../src/footprints/scenes/ProceduralSceneRuntime.ts';
import {FloorAudioReactive} from '../src/footprints/scenes/FloorAudioReactive.ts';
const memory=()=>{const map=new Map<string,string>();
 return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},map};};
const presence=(bus:FloorInteractionEngine,actor:string,x:number,at:number)=>{
 bus.observe({source:'touch',actorId:actor,x,y:.5,atMs:at,confidence:1,basis:'simulated'});
};
const contact=(bus:FloorInteractionEngine,id:string,actor:string,x:number,at:number)=>{
 bus.contact({source:'touch',actorId:actor,x,y:.5,atMs:at,confidence:1,
  basis:'simulated',kind:'touch',foot:'left',verified:true,eventId:id});
};
test('F5 registry exactly matches all thirteen named rows in PRD',()=>{
 assert.equal(FLOOR_SCENES.length,13);
 assert.deepEqual(FLOOR_SCENES.map(s=>s.id),[...FLOOR_SCENE_IDS]);
 assert.equal(new Set(FLOOR_SCENES.map(s=>s.id)).size,13);
 assert.deepEqual(FLOOR_SCENES.map(s=>s.name),[
  'Snowfall','Christmas','Hanukkah','Spring Garden','Fall Leaves','The Swarm',
  'Ectoplasmic Fog','Ground Smoke','Cursed Fluid','Living Water',
  'Fireworks','Pool Splash','Fireflies'
 ]);
 for(const s of FLOOR_SCENES){
  assert.equal(isFloorSceneId(s.id),true);
  assert.ok(s.description.length>12);
  assert.match(s.defaultColor,/^#[0-9a-f]{6}$/i);
 }
 assert.equal(isFloorSceneId('footprints'),false);
 assert.equal(isFloorSceneId('fantasy'),false);
});
test('F5 every registered scene accepts the same F0 bus, switches without resetting source',()=>{
 const bus=new FloorInteractionEngine();bus.reset('touch');
 const runtime=new ProceduralSceneRuntime();
 const generation=bus.generation;
 for(const scene of FLOOR_SCENES.filter(s=>s.id!=='snowfall')){
  runtime.setScene(scene.id,generation);
  runtime.skipExisting(bus.recent,generation);
  const old=runtime.contactCount;
  presence(bus,'A',.2+old*.01,bus.recent.length*100+1000);
  contact(bus,'contact-'+scene.id,'A',.3,bus.recent.length*100+1100);
  runtime.ingest(bus.recent,generation);
  runtime.step(1000);runtime.step(1033,{intensity:.8,quality:'low'});
  assert.equal(runtime.sceneId,scene.id);
  assert.equal(runtime.contactCount,old+1);
  assert.equal(bus.generation,generation,'source bus must not restart on scene select');
  runtime.ingest(bus.recent,generation);
  assert.equal(runtime.contactCount,1,'repeated frame cannot duplicate contact');
 }
});
test('F5 presence and movement do not invent contact in burst scenes',()=>{
 const bus=new FloorInteractionEngine();bus.reset('touch');
 const runtime=new ProceduralSceneRuntime();runtime.setScene('fireworks',bus.generation);
 for(let i=0;i<30;i++){
  presence(bus,'A',.4+(i%4)*.004,1000+i*200);
  runtime.ingest(bus.recent,bus.generation);
 }
 assert.equal(runtime.contactCount,0);
 assert.ok(runtime.interactionCount>0);
 contact(bus,'only-one','A',.5,8000);
 runtime.ingest(bus.recent,bus.generation);
 assert.equal(runtime.contactCount,1);
 for(let i=0;i<10;i++)runtime.ingest(bus.recent,bus.generation);
 assert.equal(runtime.contactCount,1);
});
test('F5 source generation invalidation and scene switch skip historical marks',()=>{
 const bus=new FloorInteractionEngine();bus.reset('touch');
 const runtime=new ProceduralSceneRuntime();
 runtime.setScene('spring-garden',bus.generation);
 contact(bus,'one','A',.3,100);
 runtime.ingest(bus.recent,bus.generation);
 assert.equal(runtime.contactCount,1);
 runtime.setScene('fall-leaves',bus.generation);
 runtime.skipExisting(bus.recent,bus.generation);
 runtime.ingest(bus.recent,bus.generation);
 assert.equal(runtime.contactCount,0);
 contact(bus,'two','A',.4,220);
 runtime.ingest(bus.recent,bus.generation);
 assert.equal(runtime.contactCount,1);
 bus.reset('touch');
 runtime.ingest(bus.recent,bus.generation);
 assert.equal(runtime.contactCount,0);
});
test('F5 paused runtime never prints queued events when resumed',()=>{
 const bus=new FloorInteractionEngine();bus.reset('touch');
 const runtime=new ProceduralSceneRuntime();
 runtime.setScene('pool-splash',bus.generation);
 contact(bus,'first','A',.2,100);runtime.ingest(bus.recent,bus.generation);
 runtime.step(1000);runtime.step(1033);
 const time=runtime.clock;
 contact(bus,'during-pause','A',.4,120);runtime.ingest(bus.recent,bus.generation,false);
 runtime.step(5000,{paused:true});
 assert.equal(runtime.clock,time);
 runtime.ingest(bus.recent,bus.generation,true);
 assert.equal(runtime.contactCount,1);
 contact(bus,'after','A',.6,180);runtime.ingest(bus.recent,bus.generation);
 assert.equal(runtime.contactCount,2);
});
test('F5 preset schema, clamping and local persistence remain independent of optical QA',()=>{
 const store=memory(),p=FLOOR_SCENE_PRESETS[0];
 assert.equal(FLOOR_SCENE_PRESETS.length,4);
 assert.deepEqual(saveFloorPreset(store,p),[p]);
 assert.deepEqual(loadFloorPresets(store),[p]);
 assert.deepEqual(Object.keys(JSON.parse(store.map.get(FLOOR_PRESETS_STORAGE_KEY)??'[]')[0]).sort(),
  ['audioMix','intensity','name','persistence','quality','radius','sceneId','schema','version']);
 assert.throws(()=>validateFloorScenePreset({...p,intensity:Infinity}));
 assert.throws(()=>validateFloorScenePreset({...p,sceneId:'unknown'}));
 assert.throws(()=>validateFloorScenePreset({...p,name:'x'.repeat(65)}));
 store.setItem(FLOOR_PRESETS_STORAGE_KEY,'garbage');
 assert.deepEqual(loadFloorPresets(store),[]);
});
test('F6 audio meter does not enable recording or produce contact events on its own',()=>{
 const meter=new FloorAudioReactive();
 assert.equal(meter.sample('off'),0);
 assert.equal(meter.sample('soma',null),0);
 assert.equal(meter.microphoneActive,false);
 const bus=new FloorInteractionEngine();bus.reset('touch');
 assert.equal(bus.snapshot.counts.contact+bus.snapshot.counts.touch,0);
});
test('F5 single canvas, shared output, quality controls and opt-in mic are wired',()=>{
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/studio/v3/FloorSceneAdvancedControls.tsx',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(stage,/proceduralRuntime\.ingest\(bus\.recent,bus\.generation,!paused\)/);
 assert.match(stage,/proceduralRuntime\.paint\(canvas/);
 assert.match(stage,/data-procedural=\{/);
 assert.match(stage,/floorCanvas=\{cleanFloorOutput\}/);
 assert.match(stage,/ref=\{proceduralCanvas\}/);
 assert.match(stage,/FLOOR_SCENES\.map/);
 assert.match(stage,/audioMeter\.current\.enableMicrophone\(\)/);
 assert.match(ui,/Sumber audio scene FLOOR/);
 assert.match(ui,/Preset scene FLOOR/);
 assert.match(app,/audioAnalyser=\{audioOn\?engine\.analyser:null\}/);
});
