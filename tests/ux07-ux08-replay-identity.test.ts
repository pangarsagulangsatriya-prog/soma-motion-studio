import assert from 'node:assert/strict';
import test from 'node:test';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {feedSimulatorFloorInteractions} from '../src/footprints/scenes/interactionAdapters.ts';

const contact=(engine:FloorInteractionEngine,actorId:string,id:string,atMs=100)=>engine.contact({
 source:'video',actorId,eventId:id,foot:'left',verified:true,
 x:.3,y:.65,confidence:.9,atMs,basis:'image-2d'
});

test('MP4 contact is deduplicated within one playback epoch',()=>{
 const engine=new FloorInteractionEngine();engine.reset('video');
 assert.ok(contact(engine,'A','step-1'));
 assert.equal(contact(engine,'A','step-1'),null);
 assert.equal(engine.snapshot.counts.contact,1);
});

test('MP4 seek clears contacts and increments session generation',()=>{
 const engine=new FloorInteractionEngine();engine.reset('video');
 assert.ok(contact(engine,'A','step-1'));
 const previous=engine.currentSessionId;
 engine.reset('video');
 assert.notEqual(engine.currentSessionId,previous);
 assert.equal(engine.snapshot.events.length,0);
 assert.equal(engine.canonicalRecent.length,0);
 assert.ok(contact(engine,'A','step-1',500));
 assert.equal(engine.snapshot.counts.contact,1);
});

test('source switching cannot leak previous video contacts into camera',()=>{
 const engine=new FloorInteractionEngine();engine.reset('video');
 assert.ok(contact(engine,'A','step-1'));
 engine.reset('camera');
 assert.equal(engine.snapshot.source,'camera');
 assert.equal(engine.snapshot.events.length,0);
 assert.equal(contact(engine,'A','step-2'),null);
});

test('occlusion removes visible position but cannot invent an actor contact',()=>{
 const engine=new FloorInteractionEngine();engine.reset('video');
 engine.observe({source:'video',actorId:'A',x:.2,y:.4,confidence:.9,atMs:100,basis:'image-2d'});
 engine.observe({source:'video',actorId:'B',x:.8,y:.4,confidence:.9,atMs:100,basis:'image-2d'});
 engine.keepActors('video',['A']);
 assert.deepEqual(engine.snapshot.actors,['A']);
 assert.equal(contact(engine,'unassigned-0','ghost-step'),null);
});

test('stationary poses emit presence heartbeats but not duplicate foot contacts',()=>{
 const engine=new FloorInteractionEngine();engine.reset('video');
 const obs={source:'video' as const,actorId:'A',x:.5,y:.5,confidence:.9,basis:'image-2d' as const};
 engine.observe({...obs,atMs:100});
 engine.observe({...obs,atMs:400});
 engine.observe({...obs,atMs:700});
 assert.equal(engine.snapshot.counts.contact,0);
 assert.ok(engine.snapshot.counts.presence>=1);
});

test('motion event identity carries playback generation',()=>{
 const engine=new FloorInteractionEngine();engine.reset('video');
 contact(engine,'B','same-id');const before=engine.canonicalRecent[0].eventId;
 engine.reset('video');contact(engine,'B','same-id');const after=engine.canonicalRecent[0].eventId;
 assert.notEqual(before,after);
 assert.equal(engine.canonicalRecent[0].actorId,'B');
});
