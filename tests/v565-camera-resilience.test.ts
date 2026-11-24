import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveFrameGate,nextInferenceInterval} from '../src/engine/liveFrameGate.ts';
import {CameraLiveness} from '../src/engine/cameraLiveness.ts';

test('inference result cannot resurrect a stale camera frame',()=>{
 const gate=new LiveFrameGate();
 assert.equal(gate.accept(100,140),true);
 gate.invalidate(600);
 assert.equal(gate.accept(500,650),false);
 assert.equal(gate.accept(650,700),true);
 assert.equal(gate.accept(650,705),false);
});
test('late, future and non-finite inference results are rejected',()=>{
 const gate=new LiveFrameGate();
 assert.equal(gate.accept(100,451),false);
 assert.equal(gate.accept(500,499),false);
 assert.equal(gate.accept(NaN,500),false);
 assert.equal(gate.accept(500,850),true);
});
test('adaptive inference pacing is bounded under load',()=>{
 assert.equal(nextInferenceInterval(10,true),33);
 assert.equal(nextInferenceInterval(80,true),84);
 assert.equal(nextInferenceInterval(80,false),100);
 assert.equal(nextInferenceInterval(500,true),150);
 assert.equal(nextInferenceInterval(NaN,false),33);
});
test('phone decoder watchdog resumes with a fresh timeout',()=>{
 const watch=new CameraLiveness(3200);
 assert.equal(watch.sample(5,0),false);
 assert.equal(watch.sample(5,3100),false);
 assert.equal(watch.sample(5,5000,false),false);
 assert.equal(watch.sample(5,20000),false);
 assert.equal(watch.sample(5,23199),false);
 assert.equal(watch.sample(5,23200),true);
 assert.equal(watch.sample(6,23300),false);
});
