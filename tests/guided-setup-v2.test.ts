import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGuideGates,type GuideConditions} from '../src/stage/guidedSetupGates.ts';
const baseline=():GuideConditions=>({
 source:'laptop',cameraOn:true,phoneActive:false,videoReady:true,
 calibrated:true,confirmed:true,cameraMatched:true,frameFresh:true,
 tracked:true,performers:1,identityStable:true,contactCount:3,
 archiveA:true,archiveB:false,skipArchive:false
});
test('no active camera stays on Input, even with stored calibration',()=>{
 const x=baseline();x.cameraOn=false;
 const result=evaluateGuideGates(x);
 assert.equal(result.maxStep,0);
 assert.equal(result.tracking.ready,false);
 assert.equal(result.stage.ready,false);
});
test('video connection advances only to Tracking until calibrated and contact arrives',()=>{
 const c=baseline();c.calibrated=false;c.confirmed=false;c.contactCount=0;
 assert.equal(evaluateGuideGates(c).maxStep,1);
 c.calibrated=true;c.confirmed=true;
 assert.match(evaluateGuideGates(c).tracking.reason,/pijakan/);
 c.contactCount=1;
 assert.equal(evaluateGuideGates(c).maxStep,2);
});
test('camera binding mismatch or stale frames always fail closed',()=>{
 const c=baseline();c.cameraMatched=false;
 assert.equal(evaluateGuideGates(c).tracking.ready,false);
 c.cameraMatched=true;c.frameFresh=false;
 assert.equal(evaluateGuideGates(c).stage.ready,false);
});
test('PHONE input requires real phone stream and LAPTOP input rejects phone stream',()=>{
 const c=baseline();c.source='phone';
 assert.equal(evaluateGuideGates(c).maxStep,0);
 c.phoneActive=true;
 assert.equal(evaluateGuideGates(c).maxStep,2);
 c.source='laptop';
 assert.equal(evaluateGuideGates(c).maxStep,0);
});
test('two performers need stable identity A/B and two archives or explicit skip',()=>{
 const c=baseline();c.performers=2;c.identityStable=false;
 assert.equal(evaluateGuideGates(c).maxStep,1);
 c.identityStable=true;
 assert.equal(evaluateGuideGates(c).stage.ready,false);
 c.archiveB=true;
 assert.equal(evaluateGuideGates(c).stage.ready,true);
 c.archiveA=false;c.archiveB=false;c.skipArchive=true;
 assert.equal(evaluateGuideGates(c).stage.ready,true);
});
test('simulation cannot authorize stage setup or physical projector output',()=>{
 const c=baseline();c.source='simulation';
 const result=evaluateGuideGates(c);
 assert.equal(result.input.ready,false);
 assert.equal(result.stage.ready,false);
});
