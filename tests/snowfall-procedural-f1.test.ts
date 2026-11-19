import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {feedTouchFloorInteraction} from '../src/footprints/scenes/interactionAdapters.ts';
import {SnowfallScene,snowfallOptions,SNOW_GRID} from '../src/footprints/scenes/SnowfallScene.ts';
import {floorPointerCoordinates} from '../src/footprints/scenes/floorPointerCoordinates.ts';

const client=()=>{const bus=new FloorInteractionEngine();bus.reset('touch');return bus;};
const click=(bus:FloorInteractionEngine,index:number,atMs:number,x:number,y:number)=>{
 feedTouchFloorInteraction(bus,{kind:'down',pointerId:index,x,y,atMs});
 feedTouchFloorInteraction(bus,{kind:'up',pointerId:index,x,y,atMs:atMs+45});
};
const ingest=(snow:SnowfallScene,bus:FloorInteractionEngine,enabled=true)=>
 snow.consume(bus.recent,bus.generation,enabled);

test('F1 acceptance: six distinct footsteps produce exactly six persistent marks',()=>{
 const bus=client(),snow=new SnowfallScene();
 assert.equal(snow.width,SNOW_GRID.width);
 assert.equal(snow.height,SNOW_GRID.height);
 for(let i=0;i<6;i++){
  const x=.18+i*.12,y=.36+(i%2)*.20;
  click(bus,i,1000+i*500,x,y);
  ingest(snow,bus);
  assert.equal(snow.count,i+1);
  assert.ok(snow.sample(x,y)<.65,'contact creates a visible depression');
 }
 assert.equal(snow.marks.length,6);
 assert.equal(new Set(snow.marks.map(m=>m.id)).size,6);
 for(let n=0;n<100;n++)ingest(snow,bus);
 assert.equal(snow.count,6,'RAF replay does not re-stamp historical contacts');
 snow.step(4500);
 snow.step(6000,{recoverySeconds:150,snowfall:.3});
 assert.equal(snow.count,6,'snowfall recovery never invents contact');
});
test('F1 stationary presence, movement and unverified contact never leave prints',()=>{
 const bus=new FloorInteractionEngine(),snow=new SnowfallScene();
 bus.reset('camera');
 bus.observe({source:'camera',actorId:'A',x:.3,y:.5,confidence:.9,
  atMs:1000,basis:'calibrated-estimate'});
 for(let i=1;i<30;i++)
  bus.observe({source:'camera',actorId:'A',x:.3,y:.5,
   confidence:.9,atMs:1000+i*200,basis:'calibrated-estimate'});
 bus.observe({source:'camera',actorId:'A',x:.35,y:.5,confidence:.9,
  atMs:7200,basis:'calibrated-estimate'});
 assert.equal(bus.contact({
  source:'camera',actorId:'A',x:.35,y:.5,confidence:.9,
  atMs:7300,basis:'calibrated-estimate',
  eventId:'unverified',foot:'right',verified:false
 }),null);
 ingest(snow,bus);
 assert.equal(snow.count,0);
 assert.equal(snow.marks.length,0);
});
test('F1 A/B six contacts are owned by their actor, foot and source',()=>{
 const bus=new FloorInteractionEngine();bus.reset('camera');
 const snow=new SnowfallScene();
 for(let i=0;i<6;i++){
  const actorId=i%2?'B':'A',foot=i%2?'right':'left';
  const atMs=1500+i*400;
  const event={
   source:'camera' as const,actorId,x:.16+i*.13,y:.32+(i%2)*.3,
   confidence:.93,atMs,basis:'calibrated-estimate' as const,
   eventId:'heel-'+i,foot:foot as 'left'|'right',verified:true
  };
  assert.ok(bus.contact(event));
  assert.equal(bus.contact(event),null,'one contact ID is never emitted twice');
 }
 ingest(snow,bus);
 assert.equal(snow.count,6);
 assert.deepEqual(new Set(snow.marks.map(m=>m.actorId)),new Set(['A','B']));
 assert.equal(snow.marks.filter(m=>m.foot==='left').length,3);
 assert.equal(snow.marks.filter(m=>m.foot==='right').length,3);
});
test('F1 ambiguous crossing/anonymous movement never stamps snow',()=>{
 const bus=new FloorInteractionEngine();bus.reset('video');
 for(const id of ['unassigned-0','unassigned-1'])
  bus.observe({source:'video',actorId:id,x:.45,y:.5,confidence:.65,
   atMs:1000,basis:'image-2d'});
 const scene=new SnowfallScene();ingest(scene,bus);
 assert.equal(scene.count,0);
 bus.keepActors('video',['A','B']);
 assert.equal(scene.count,0);
});
test('F1 source reset and MP4 seek generation discard stale prints',()=>{
 const bus=client(),snow=new SnowfallScene();
 click(bus,1,1000,.2,.4);ingest(snow,bus);
 assert.equal(snow.count,1);
 const original=bus.generation;
 bus.reset('touch');
 assert.ok(bus.generation>original);
 ingest(snow,bus);
 assert.equal(snow.count,0);
 click(bus,1,2000,.8,.7);ingest(snow,bus);
 assert.equal(snow.count,1);
 assert.equal(snow.marks[0].x,.8);
 // Reset button consumes the present rolling buffer once, without ghost stamps.
 snow.reset(bus.generation);ingest(snow,bus,false);ingest(snow,bus);
 assert.equal(snow.count,0);
});
test('F1 paused snow ignores incoming events and never replays them on resume',()=>{
 const bus=client(),snow=new SnowfallScene();
 click(bus,1,1000,.3,.3);ingest(snow,bus);
 snow.setPaused(true);
 click(bus,2,1500,.5,.5);ingest(snow,bus);
 const unchanged=snow.sample(.3,.3);
 const frozenClock=snow.visualTimeMs;
 assert.equal(snow.step(3000,{paused:true}),false);
 assert.equal(snow.sample(.3,.3),unchanged);
 assert.equal(snow.visualTimeMs,frozenClock,'GPU snow clock remains frozen on pause');
 snow.setPaused(false);
 ingest(snow,bus);
 assert.equal(snow.count,1,'paused contact not replayed later');
 click(bus,3,3500,.7,.7);ingest(snow,bus);
 assert.equal(snow.count,2);
});
test('F1 snow refills footprint gradually without removing unique history',()=>{
 const bus=client(),snow=new SnowfallScene();
 click(bus,1,1000,.5,.5);ingest(snow,bus);
 const before=snow.sample(.5,.5);
 snow.step(2000);
 snow.step(52000,{recoverySeconds:12,snowfall:1});
 const after=snow.sample(.5,.5);
 assert.ok(after>before,'snow recovers slowly after frame time');
 assert.ok(after<.95,'a single 0.5s safety frame cannot instantly erase print');
 assert.equal(snow.count,1);
 assert.equal(snowfallOptions({recoverySeconds:500}).recoverySeconds,240);
 assert.equal(snowfallOptions({snowfall:-2}).snowfall,0);
});
test('F1 touch maps real 16:9 artwork and excludes black letterbox regions',()=>{
 const rect={left:100,top:200,width:500,height:400};
 const center=floorPointerCoordinates(350,400,rect)!;
 assert.ok(center.inside);
 assert.ok(Math.abs(center.x-.5)<.001);
 assert.ok(Math.abs(center.y-.5)<.001);
 const letterbox=floorPointerCoordinates(350,210,rect)!;
 assert.equal(letterbox.inside,false);
 assert.equal(letterbox.y,0);
 const corner=floorPointerCoordinates(100,200+(400-500*9/16)/2,rect)!;
 assert.equal(corner.inside,true);
 assert.equal(corner.x,0);
 assert.equal(floorPointerCoordinates(NaN,200,rect),null);
});
test('F1 clean GPU Snowfall never renders diagnostic labels into physical floor',()=>{
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('../src/footprints/scenes/SnowfallRenderer.ts',import.meta.url),'utf8');
 const composer=readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');
 assert.match(stage,/floorScene==='snowfall'\?snowfallCanvas\.current:/);
 assert.match(stage,/floorScene==='footprints'\?floorCanvas\.current:proceduralCanvas\.current/);
 assert.match(stage,/floorCanvas=\{cleanFloorOutput\}/);
 assert.match(stage,/ref=\{snowfallCanvas\}/);
 assert.match(stage,/ref=\{interactionCanvas\}/);
 assert.match(stage,/Reset salju/);
 assert.match(renderer,/getContext\('webgl2'/);
 assert.match(renderer,/texSubImage2D/);
 assert.match(renderer,/gl\.drawArrays/);
 assert.match(renderer,/this\.mode=this\.context&&this\.fallback\?'2d'/);
 assert.doesNotMatch(renderer,/interactionCanvas/);
 assert.match(composer,/kind==='floor'\?\(experiment&&!physical\?experimentFloorCanvas\?\.current\?\?null:floorCanvas\.current\)/);
 assert.match(composer,/if\(experiment&&physical\)return/);
});
