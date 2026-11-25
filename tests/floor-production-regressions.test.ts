import test from 'node:test';
import assert from 'node:assert/strict';
import {transform} from '../src/projection/geometry.ts';
import {ProjectionLink} from '../src/projection/channel.ts';
import {canOutputVideoFrame,type ExperimentalFrame} from '../src/studio/v3/experimentSourceModel.ts';
import {stageSurfaceState,defaultStageSurfacePlan} from '../src/footprints/stage-optics/DualSurfaceCalibration.ts';

test('homography rejects a near-zero homogeneous denominator independent of matrix scale',()=>{
 const m=[1,0,0,0,1,0,1,0,-1];
 for(const factor of [1,1e-15,1e15]){
  const matrix=m.map(n=>n*factor);
  assert.ok(Number.isNaN(transform(matrix,{x:1+1e-14,y:.5}).x));
  assert.deepEqual(transform(matrix,{x:2,y:1}),{x:2,y:1});
 }
});
test('Direct MP4 permit expires with a stalled decoder clock; deliberate pause can hold decoded artwork',()=>{
 const video={readyState:2,paused:false,videoWidth:160,seeking:false,error:null};
 const frame={kind:'video',video,decoded:{atMs:100,mediaTime:1},ready:true} as unknown as ExperimentalFrame;
 assert.equal(canOutputVideoFrame(frame,1100),true);
 assert.equal(canOutputVideoFrame(frame,1300),false);
 video.paused=true;assert.equal(canOutputVideoFrame(frame,9000),true);
 video.seeking=true;assert.equal(canOutputVideoFrame(frame,9000),false);
});
test('bitmap pending before Blackout is closed and never posted after re-arm',async(t)=>{
 const port=new ProjectionLink(),posted:unknown[]=[];
 const child={closed:false,postMessage:(m:unknown)=>posted.push(m)};
 Object.assign(port,{child,lastSeen:Date.now()});
 const oldBitmap={close:t.mock.fn()};
 let resolve!:(image:typeof oldBitmap)=>void;
 const copy=new Promise<typeof oldBitmap>(done=>{resolve=done;});
 Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:()=>copy});
 t.after(()=>Reflect.deleteProperty(globalThis,'createImageBitmap'));
 const plan=defaultStageSurfacePlan('floor'),live=stageSurfaceState(plan,'live',true);
 port.sendArtwork(live,{dataset:{}} as HTMLCanvasElement,100);
 port.send(stageSurfaceState(plan,'blackout',false),110,true);
 port.send(live,120,true);
 resolve(oldBitmap);await copy;await Promise.resolve();
 assert.equal(oldBitmap.close.mock.callCount(),1);
 assert.deepEqual(posted,[]);assert.equal(port.receivedFrames,0);
});
