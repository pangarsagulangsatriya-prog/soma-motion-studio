import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 hubDisplayName,hubSourceAvailable,hubFrameIsFresh,hubBodyCount
} from '../src/studio/v3/cameraHubModel.ts';
import type {MotionFrame} from '../src/engine/types.ts';
const src=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Hub CRUD: alias normalizes blank, caps names and prevents same device twice',()=>{
 assert.equal(hubDisplayName('   '),'Kamera baru');
 assert.equal(hubDisplayName('  Kamera B  '),'Kamera B');
 assert.equal(hubDisplayName('a'.repeat(100)).length,64);
 assert.equal(hubSourceAvailable('',[]),false);
 assert.equal(hubSourceAvailable('cam-B',[{deviceId:'cam-A'}]),true);
 assert.equal(hubSourceAvailable('cam-A',[{deviceId:'cam-A'}]),false);
});
test('Hub skeleton uses actual measured body poses and never stale detections',()=>{
 assert.equal(hubFrameIsFresh(100,700),true);
 assert.equal(hubFrameIsFresh(100,800),false);
 assert.equal(hubFrameIsFresh(0,120),false);
 assert.equal(hubFrameIsFresh(900,850),false);
 assert.equal(hubBodyCount(null),0);
 assert.equal(hubBodyCount({tracked:false,poses:[Array(33).fill({x:.5,y:.5})]} as MotionFrame),0);
 assert.equal(hubBodyCount({tracked:true,pose:Array(33).fill({x:.5,y:.5})} as MotionFrame),1);
 assert.equal(hubBodyCount({tracked:true,poses:[
  Array(33).fill({x:.5,y:.5}),Array(33).fill({x:.5,y:.5}),
  Array(33).fill({x:.5,y:.5})
 ]} as MotionFrame),2);
});
test('Hub owns camera registry in App, maintains streams across sidebar switches, and reuses Track engine',()=>{
 const app=src('../src/App.tsx'),hub=src('../src/studio/v3/CameraHubWorkspace.tsx'),
  registry=src('../src/studio/v3/CameraHubRegistry.ts');
 assert.match(app,/hubRegistryRef=useRef<CameraHubRegistry\|null>/);
 assert.match(app,/registry=\{hubRegistry\}/);
 assert.match(app,/onSelectStageOne=\{async id=>/);
 assert.match(registry,/import \{CameraTracker\} from '\.\.\/\.\.\/engine\/tracking\.ts'/);
 assert.match(registry,/new CameraTracker\(\)/);
 assert.match(registry,/entry\.tracker\.start\(entry\.video/);
 assert.match(registry,/entry\.tracker\.stop\(entry\.video\)/);
 assert.match(hub,/className="ch-node-preview"/);
 assert.match(hub,/drawSkeletonBodies\(ctx,poses/);
 assert.match(hub,/registry\.remove\(selectedNode\.id\)/);
 assert.match(hub,/registry\.rename\(selectedNode\.id,renameValue\)/);
 assert.match(hub,/registry\.replace\(selectedNode\.id/);
 assert.match(hub,/registry\.disconnect\(selectedNode\.id\)/);
 assert.match(hub,/registry\.setSkeleton\(selectedNode\.id/);
});
