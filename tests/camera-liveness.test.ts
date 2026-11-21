import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CameraLiveness} from '../src/engine/cameraLiveness.ts';
test('brief pauses recover; a frozen camera expires after eight seconds',()=>{
 const watch=new CameraLiveness();
 assert.equal(watch.sample(1,0),false);
 assert.equal(watch.sample(1,3000),false);
 assert.equal(watch.sample(2,4000),false);
 assert.equal(watch.sample(2,11999),false);
 assert.equal(watch.sample(2,12000),true);
});
test('a hidden browser cannot produce a false camera disconnect',()=>{
 const watch=new CameraLiveness();watch.sample(1,0);
 assert.equal(watch.sample(1,20000,false),false);
 assert.equal(watch.sample(1,30000),false);
 assert.equal(watch.sample(2,30100),false);
});
