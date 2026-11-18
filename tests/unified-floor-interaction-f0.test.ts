import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyFrame,type Landmark} from '../src/engine/types.ts';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {createFloorSession,type FootstepEvent} from '../src/footprints/spatial/events.ts';
import {initialPerformers,initialCamera} from '../src/footprints/simulator/scene3d.ts';
import {FloorInteractionEngine,floorEventCanStamp,floorEventPhysicalOutputAuthorized}
 from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {feedLiveFloorInteractions,feedVideoFloorInteractions,feedSimulatorFloorInteractions,
 feedTouchFloorInteraction} from '../src/footprints/scenes/interactionAdapters.ts';
import type {LiveFloorTrackingEngine} from '../src/footprints/live/LiveFloorTrackingEngine.ts';

const pose=(x:number):Landmark[]=>Array.from({length:33},(_,i)=>({
 x,y:.32+i/100,z:0,visibility:.95
}));
const observed=(source:'camera'|'phone'|'video'|'simulator'|'touch',id:string,x:number,t:number)=>({
 source,actorId:id,x,y:.5,confidence:.9,atMs:t,basis:'presence-only' as const
});
const floor=defaultFloorSpace(8,6);
const contact=(source:'camera'|'simulation',id:string,performerId:string,atMs:number):FootstepEvent=>({
 id,source,performerId,foot:'left',kind:'contact',timestampMs:atMs,
 positionM:{xM:2,yM:3},headingRad:0,
 positionBasis:source==='simulation'?'simulated':'calibrated-estimate',confidence:.9
});
const liveTracker=(events:FootstepEvent[],confirmed=true):LiveFloorTrackingEngine=>{
 return {isConfirmed:confirmed,calibrationData:null,floor,
  session:createFloorSession(floor,events)} as unknown as LiveFloorTrackingEngine;
};
const identity=(ambiguous=false)=>({
 mode:2 as const,visible:ambiguous?[]:['A','B'],
 ambiguous,reason:'test',ghostCount:0,
 poseIndices:{A:0,B:1},observedFrameTime:1000
});
test('F0 source bus emits presence then movement, never contact from motion alone',()=>{
 const engine=new FloorInteractionEngine();engine.reset('camera');
 assert.equal(engine.observe(observed('camera','A',.3,1000))?.kind,'presence');
 assert.equal(engine.observe(observed('camera','A',.3,1010)),null);
 assert.equal(engine.observe(observed('camera','A',.4,1100))?.kind,'movement');
 assert.equal(engine.observe(observed('camera','A',.4,1550))?.kind,'presence');
 assert.equal(engine.snapshot.counts.contact,0);
 assert.equal(engine.snapshot.actors.length,1);
 assert.equal(engine.observe(observed('video','A',.4,1200)),null);
});
test('F0 source identity change prunes old slots without resetting persisted events',()=>{
 const engine=new FloorInteractionEngine();engine.reset('camera');
 engine.observe(observed('camera','unassigned-0',.25,100));
 engine.observe(observed('camera','unassigned-1',.75,100));
 engine.keepActors('camera',['A','B']);
 assert.equal(engine.snapshot.actors.length,0);
 assert.equal(engine.snapshot.events.length,2);
 engine.observe(observed('camera','A',.22,200));
 engine.observe(observed('camera','B',.78,200));
 assert.deepEqual(engine.snapshot.actors.sort(),['A','B']);
});
test('F0 two actors are isolated and invalid input is refused',()=>{
 const engine=new FloorInteractionEngine();engine.reset('touch');
 engine.observe(observed('touch','pointer-1',.2,100));
 engine.observe(observed('touch','pointer-2',.8,100));
 assert.deepEqual(engine.snapshot.actors.sort(),['pointer-1','pointer-2']);
 assert.equal(engine.observe({...observed('touch','pointer-3',-1,200)}),null);
 const first=feedTouchFloorInteraction(engine,{kind:'down',pointerId:1,x:.25,y:.2,atMs:110});
 const second=feedTouchFloorInteraction(engine,{kind:'down',pointerId:2,x:.78,y:.4,atMs:110});
 assert.equal(first,undefined);assert.equal(second,undefined);
 assert.equal(engine.snapshot.counts.touch,2);
 feedTouchFloorInteraction(engine,{kind:'move',pointerId:1,x:.35,y:.2,atMs:210});
 assert.equal(engine.snapshot.counts.touch,2);
 assert.ok(engine.snapshot.counts.movement>=1);
 feedTouchFloorInteraction(engine,{kind:'up',pointerId:1,x:.35,y:.2,atMs:220});
 assert.equal(engine.snapshot.actors.includes('pointer-1'),false);
 for(const e of engine.snapshot.events.filter(x=>x.kind==='touch'))assert.equal(floorEventCanStamp(e),true);
});
test('F0 frame-safe A/B camera presence and no stamps when identities cross',()=>{
 const engine=new FloorInteractionEngine();engine.reset('camera');
 const f={...emptyFrame(),tracked:true,time:1000,pose:pose(.2),poses:[pose(.2),pose(.8)]};
 feedLiveFloorInteractions(engine,{
  source:'camera',frame:f,identity:identity(true),performerCount:2,
  tracker:liveTracker([contact('camera','1','A',1000)]),cameraMatched:true,
  videoAspect:16/9,nowMs:1020
 });
 assert.deepEqual(engine.snapshot.actors.sort(),['unassigned-0','unassigned-1']);
 assert.equal(engine.snapshot.counts.contact,0);
 engine.reset('camera');
 feedLiveFloorInteractions(engine,{
  source:'camera',frame:f,identity:identity(false),performerCount:2,
  tracker:liveTracker([contact('camera','1','A',1000),contact('camera','2','B',1000)]),
  cameraMatched:true,videoAspect:16/9,nowMs:1020
 });
 assert.deepEqual(engine.snapshot.actors.sort(),['A','B']);
 assert.equal(engine.snapshot.counts.contact,2);
});
test('F0 MP4 and 3D adapters use exact same event contract and deduplicate contacts',()=>{
 const engine=new FloorInteractionEngine();
 const raw=[pose(.24),pose(.75)];
 const snapshot={
  atMs:1000,segment:0,ambiguous:false,
  people:[{id:'A',landmarks:raw[0],confidence:.95},
   {id:'B',landmarks:raw[1],confidence:.96}],rawPoses:raw,
  events:[{id:'video:0:A:left:1000:contact',atMs:1000,performer:'A',
   foot:'left',kind:'contact',confidence:.8,x:.2,y:.6,headingRad:0,basis:'video-2d-estimate'}]
 };
 const videoFrame={kind:'video' as const,snapshot,video:null,timeMs:1020,
  ready:true,name:'clip'};
 engine.reset('video');
 feedVideoFloorInteractions(engine,videoFrame as any);
 feedVideoFloorInteractions(engine,videoFrame as any);
 assert.equal(engine.snapshot.actors.length,2);
 assert.equal(engine.snapshot.counts.contact,1);
 assert.equal(engine.snapshot.events.find(e=>e.kind==='contact')?.basis,'image-2d');
 const simEvents=[contact('simulation','sim-1','A',1000)];
 const sim={kind:'simulator' as const,session:createFloorSession(floor,simEvents),
  performers:initialPerformers(floor),orbit:initialCamera(),timeMs:1000,name:'puppet'};
 engine.reset('simulator');
 feedSimulatorFloorInteractions(engine,sim);
 feedSimulatorFloorInteractions(engine,sim);
 assert.equal(engine.snapshot.actors.length,2);
 assert.equal(engine.snapshot.counts.contact,1);
 assert.equal(engine.snapshot.events.find(e=>e.kind==='contact')?.basis,'simulated');
});
test('F0 contact source switch and replay seek cannot silently duplicate',()=>{
 const engine=new FloorInteractionEngine();engine.reset('phone');
 assert.equal(engine.contact({...observed('phone','A',.2,10),
  eventId:'x',foot:'left',verified:false}),null);
 assert.equal(engine.contact({...observed('phone','A',.2,10),
  eventId:'x',foot:'left',verified:true}),null);
 engine.reset('touch');
 feedTouchFloorInteraction(engine,{kind:'down',pointerId:3,x:.5,y:.5,atMs:100});
 assert.equal(engine.snapshot.counts.touch,1);
 assert.equal(engine.snapshot.events.every(e=>!floorEventPhysicalOutputAuthorized(e)),true);
 engine.reset('video');
 assert.equal(engine.snapshot.events.length,0);
 assert.equal(engine.snapshot.actors.length,0);
});
test('F0 preview and Touch mode exist on the original Floor stage, not a second projector',()=>{
 const s=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 assert.match(s,/feedLiveFloorInteractions/);
 assert.match(s,/feedVideoFloorInteractions/);
 assert.match(s,/feedSimulatorFloorInteractions/);
 assert.match(s,/feedTouchFloorInteraction/);
 assert.match(s,/ref=\{interactionCanvas\}/);
 assert.match(s,/Touch Demo/);
 assert.match(s,/onBlackout/);
});
