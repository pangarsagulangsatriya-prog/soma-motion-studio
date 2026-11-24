import test from 'node:test';
import assert from 'node:assert/strict';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {PainterlyImpressionEngine} from '../src/footprints/lines/v3/PainterlyImpressionEngine.ts';
import {LiveFloorTrackingEngine} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import {feedLiveFloorInteractions} from '../src/footprints/scenes/interactionAdapters.ts';
import {emptyFrame} from '../src/engine/types.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';

test('canonical snapshots remain stable and bounded across polling and reset',()=>{
 const bus=new FloorInteractionEngine();bus.reset('camera');
 for(let i=0;i<500;i++)bus.observe({source:'camera',actorId:'A',x:i%2 ? .2 : .8,y:.6,confidence:.9,atMs:i*33,basis:'image-2d'});
 const snapshot=bus.canonicalRecent;
 assert.equal(snapshot.length,480);assert.equal(bus.canonicalRecent,snapshot);
 const first=snapshot[0].eventId;
 bus.observe({source:'camera',actorId:'A',x:.8,y:.6,confidence:.9,atMs:17000,basis:'image-2d'});
 assert.equal(snapshot[0].eventId,first);assert.notEqual(bus.canonicalRecent,snapshot);
 const session=bus.currentSessionId;bus.reset('camera');
 assert.notEqual(bus.currentSessionId,session);assert.equal(bus.canonicalRecent.length,0);
 assert.equal(snapshot.length,480);
});
test('late contact can be polled twice on same pose but stamped only once',()=>{
 const bus=new FloorInteractionEngine(),ink=new PainterlyImpressionEngine();
 bus.reset('video');ink.ensureSource('fixture');
 ink.ingestFrame([],1000,'video');ink.ingestContacts(bus.canonicalRecent,'video',1000);
 bus.contact({source:'video',actorId:'B',foot:'left',eventId:'late',x:.2,y:.6,confidence:.95,atMs:990,basis:'image-2d',verified:true});
 ink.ingestContacts(bus.canonicalRecent,'video',1000);ink.ingestContacts(bus.canonicalRecent,'video',1000);
 assert.equal(ink.count,1);assert.equal(ink.impressions[0].actorId,'B');
});
test('recent floor window and partial B identity deliver only fresh B contact',()=>{
 const tracker=new LiveFloorTrackingEngine();
 const binding={trackId:'sync',deviceId:'sync',width:1280,height:720};
 const calibration:CameraFloorCalibration={schema:'soma.footprints.camera-floor',version:1,floor:defaultFloorSpace(3,2),cameraQuad:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]};
 tracker.configure(calibration,binding);tracker.confirm(true);
 const stamp=(t:number)=>({x:.4,y:.8,heading:0,side:0 as const,t,join:false,stamp:true,phase:'stance' as const,confidence:.95,relativeSpeed:0});
 tracker.ingest(stamp(1000),0,16/9,binding,'A');
 tracker.ingest(stamp(2000),0,16/9,binding,'B');
 assert.deepEqual(tracker.recentEventsSince(1550).map(e=>e.performerId),['B']);
 const bus=new FloorInteractionEngine();bus.reset('phone');
 const pose=Array.from({length:33},()=>({x:.4,y:.8,z:0,visibility:.95}));
 const frame={...emptyFrame(),source:'camera' as const,tracked:true,time:2020,pose,poses:[pose]};
 const identity:MultiPoseStatus={mode:2,visible:['B'],ambiguous:false,reason:'fixture',ghostCount:0,poseIndices:{A:null,B:0},observedFrameTime:2020};
 const input={source:'phone' as const,frame,identity,performerCount:2 as const,tracker,cameraMatched:true,videoAspect:16/9,nowMs:2020};
 feedLiveFloorInteractions(bus,input);feedLiveFloorInteractions(bus,input);
 assert.deepEqual(bus.canonicalRecent.filter(e=>e.kind==='contact').map(e=>e.actorId),['B']);
});
