import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CameraHubRegistry,CAMERA_HUB_MAX_REGISTERED,cameraSourceId}
 from '../src/camera-hub/CameraHubRegistry.ts';
import type {CameraSlot} from '../src/camera-hub/CameraHubRegistry.ts';

const fakeStream=()=>{
 let stopped=0;
 const track={readyState:'live',muted:false,enabled:true,
  stop(){stopped++;this.readyState='ended';}};
 const stream={getVideoTracks:()=>[track],
  getTracks:()=>[track]} as unknown as MediaStream;
 return {stream,track,stops:()=>stopped};
};
const connected=(hub:CameraHubRegistry,slot:CameraSlot,device:string,
 stream:MediaStream,now=300)=>hub.observe({
 slot,cameraId:cameraSourceId(device),name:device,kind:'usb',
 stream,fresh:true,now,deviceId:device
});
test('Hub registers at most ten devices, deduplicates and never claims connection',()=>{
 const hub=new CameraHubRegistry();const updates:number[]=[];
 const off=hub.subscribe(()=>updates.push(hub.getSnapshot().records.length));
 hub.discover(Array.from({length:11},(_,index)=>({
  kind:'videoinput',deviceId:'usb-'+index,label:'Kamera '+index
 })).concat([{kind:'videoinput',deviceId:'usb-0',label:'Duplicate'}]));
 const snapshot=hub.getSnapshot();
 assert.equal(CAMERA_HUB_MAX_REGISTERED,10);
 assert.equal(snapshot.records.length,10);
 assert.equal(snapshot.connected,0);
 assert.equal(snapshot.routed,0);
 assert.equal(new Set(snapshot.records.map(r=>r.cameraId)).size,10);
 assert.ok(snapshot.records.every(r=>r.state==='discovered'&&r.generation===0));
 assert.ok(updates.length>0);
 off();hub.dispose();
});
test('A Stage observes exactly its existing stream without taking ownership',()=>{
 const hub=new CameraHubRegistry(),cam=fakeStream();
 const success=connected(hub,'stage1.track','u-1',cam.stream);
 assert.equal(success,true);
 assert.equal(hub.getSnapshot().connected,1);
 assert.equal(hub.getSnapshot().routed,1);
 assert.equal(hub.preview(cameraSourceId('u-1')),cam.stream);
 assert.deepEqual(hub.getSnapshot().records[0].assignments,['stage1.track']);
 assert.equal(hub.getAssignment('stage1.track'),cameraSourceId('u-1'));
 const generation=hub.getSnapshot().records[0].generation;
 assert.equal(hub.canAssign(cameraSourceId('u-1'),'stage2.visual',generation).accepted,true);
 hub.release('stage1.track');
 assert.equal(cam.stops(),0,'Hub must never stop a Stage-owned camera');
 assert.equal(hub.getSnapshot().connected,0);
 assert.equal(hub.preview(cameraSourceId('u-1')),null);
});
test('F3 Camera A/B must be different, rejected replacement keeps prior B lease',()=>{
 const hub=new CameraHubRegistry();
 const a=fakeStream(),b=fakeStream();
 assert.equal(connected(hub,'f3.cameraA','a',a.stream),true);
 assert.equal(connected(hub,'f3.cameraB','b',b.stream),true);
 assert.equal(connected(hub,'f3.cameraB','a',a.stream),false);
 assert.equal(hub.getAssignment('f3.cameraA'),cameraSourceId('a'));
 assert.equal(hub.getAssignment('f3.cameraB'),cameraSourceId('b'));
 assert.equal(hub.getSnapshot().routed,2);
 assert.deepEqual(hub.canAssign(cameraSourceId('a'),'f3.cameraB',
  hub.getSnapshot().records.find(r=>r.cameraId===cameraSourceId('a'))!.generation),
  {accepted:false,reason:'CONFLICT'});
 hub.release('f3.cameraB');
 assert.equal(hub.getSnapshot().connected,1);
 assert.equal(a.stops()+b.stops(),0);
});
test('More than 2 simultaneous distinct routed feeds are rejected by allocator',()=>{
 const hub=new CameraHubRegistry();
 const sources=[fakeStream(),fakeStream(),fakeStream()];
 assert.equal(connected(hub,'stage1.track','a',sources[0].stream),true);
 assert.equal(connected(hub,'f3.cameraA','b',sources[1].stream),true);
 hub.discover([{kind:'videoinput',deviceId:'c',label:'C'}]);
 const c=hub.getSnapshot().records.find(r=>r.cameraId===cameraSourceId('c'))!;
 assert.deepEqual(hub.canAssign(c.cameraId,'f3.cameraB',c.generation),
  {accepted:false,reason:'OVER_CAPACITY'});
 assert.equal(hub.canAssign(c.cameraId,'stage1.track',c.generation).accepted,false,
  'must not silently steal a source while two other streams are active');
});
test('Freezing or stopping an observed stream does not turn an old frame into live',()=>{
 const hub=new CameraHubRegistry(),camera=fakeStream();
 connected(hub,'stage1.track','one',camera.stream,1000);
 const original=hub.getSnapshot().records[0].generation;
 assert.equal(hub.heartbeat('stage1.track',cameraSourceId('one'),1200,true),true);
 assert.equal(hub.heartbeat('stage1.track',cameraSourceId('one'),2400,false),false);
 assert.equal(hub.getSnapshot().records[0].state,'stale');
 assert.equal(hub.getSnapshot().records[0].lastFrameAt,null);
 assert.equal(hub.getSnapshot().records[0].generation,original+1);
 assert.equal(hub.canAssign(cameraSourceId('one'),'f3.cameraA',original).accepted,false);
 camera.track.muted=true;
 assert.equal(hub.heartbeat('stage1.track',cameraSourceId('one'),2600,true),false);
 assert.equal(hub.getSnapshot().connected,0);
 hub.markInterrupted('stage1.track','Wi-Fi hilang');
 assert.equal(hub.getSnapshot().records[0].state,'recovering');
 hub.release('stage1.track');
 assert.equal(camera.stops(),0);
});
test('Hub observer isolation: releasing one consumer never stops another stream',()=>{
 const hub=new CameraHubRegistry(),stream=fakeStream();
 connected(hub,'stage1.track','shared',stream.stream);
 connected(hub,'stage2.visual','shared',stream.stream);
 assert.equal(hub.getSnapshot().records[0].assignments.length,2);
 hub.release('stage1.track');
 assert.deepEqual(hub.getSnapshot().records[0].assignments,['stage2.visual']);
 assert.equal(hub.getSnapshot().records[0].state,'routed');
 assert.equal(stream.stops(),0);
});
test('Camera Hub in root and nav; Stage adapters observe existing streams',()=>{
 const source=(path:string)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
 const root=source('main.tsx'),panel=source('camera-hub/CameraHubControl.tsx'),
  app=source('App.tsx'),f3=source('f3/F3CaptureWorkspace.tsx'),
  nav=source('studio/v3/GlobalNav.tsx');
 assert.match(root,/<CameraHubProvider>/);
 assert.match(panel,/aria-label=\{'Camera Hub/);
 assert.match(nav,/<CameraHubControl/);
 assert.match(nav,/onHubUseStageOne/);
 assert.match(app,/cameraHub.observe\(/);
 assert.match(app,/cameraHub.heartbeat\(/);
 assert.match(app,/onHubUseStageOne=\{id=>/);
 assert.match(f3,/cameraHub.observe\(/);
 assert.match(f3,/cameraHub.release\('f3.cameraA'\)/);
 assert.doesNotMatch(panel,/getUserMedia\(/);
});
