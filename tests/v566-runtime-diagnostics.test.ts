import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeDiagnostics} from '../src/studio/v3/runtimeDiagnostics.ts';
import {emptyFrame} from '../src/engine/types.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';
import type {LiveFloorStatus} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
const pose=()=>Array.from({length:33},()=>({x:.5,y:.7,z:0,visibility:.95}));
const floor:LiveFloorStatus={calibrated:false,confirmed:false,cameraMatched:false,tracking:false,contacts:0,events:0,lastSeenMs:null,activePerformerIds:[],reason:'Menunggu',footMotions:[]};
const identity:MultiPoseStatus={mode:2,visible:['B'],ambiguous:false,reason:'fixture',ghostCount:0,poseIndices:{A:null,B:0},observedFrameTime:1000};
const frame={...emptyFrame(),time:1000,tracked:false,pose:pose(),poses:[pose()],fps:24,telemetry:{backend:'worker' as const,capturedAt:1000,completedAt:1040,inferenceMs:30,pipelineMs:40,skippedFrames:2}};
const input={frame,identity,floor,cameraMatched:false,now:1050,cameraReady:true,performers:2 as const,paintFps:17};
test('independent B and partial global tracking retain truthful foot counts',()=>{
 const d=runtimeDiagnostics(input);assert.equal(d.detected,1);assert.equal(d.assigned,1);
 assert.equal(d.validFeet,2);assert.equal(d.gaitFeet,2);assert.equal(d.backend,'worker');
 assert.equal(d.actors[0].state,'missing');assert.equal(d.actors[1].state,'observed');
});
test('stale frames and mismatched identity never claim valid feet',()=>{
 const stale=runtimeDiagnostics({...input,now:1500});assert.equal(stale.detected,0);assert.equal(stale.validFeet,0);assert.equal(stale.inferenceMs,null);
 const mismatch=runtimeDiagnostics({...input,identity:{...identity,observedFrameTime:999}});assert.equal(mismatch.validFeet,0);assert.equal(mismatch.detected,1);
});
test('visible feet are distinct from gait and calibrated contact eligibility',()=>{
 const p=pose();p[23].visibility=0;p[24].visibility=0;
 const d=runtimeDiagnostics({...input,frame:{...frame,poses:[p]}});
 assert.equal(d.validFeet,2);assert.equal(d.gaitFeet,0);assert.match(d.blocker,/Pinggul/);
});
test('missing visibility does not become full confidence',()=>{
 const p=pose();const noVisibility=p.map(({x,y,z})=>({x,y,z}));
 const d=runtimeDiagnostics({...input,frame:{...frame,poses:[noVisibility]}});
 assert.equal(d.validFeet,0);assert.equal(d.actors[1].feet[0].confidence,null);
});
