import {test} from 'node:test';
import assert from 'node:assert/strict';
import {UpperBodyInkModulator} from '../src/footprints/dual-trace/UpperBodyInkModulator.ts';
import type {ActorMotionFrame} from '../src/footprints/lines/v3/ActorMotionFrameBuilder.ts';
const frame=(actorId:'A'|'B',timeMs:number,tilt:number,headX:number):ActorMotionFrame=>({
 actorId,sourceKey:'video:upper-qa:0:2',sourceEpoch:0,timeMs,
 hipPx:{x:500,y:550},identityConfidence:.96,hipConfidence:.95,
 torsoScalePx:120,feetCount:2,footImageAnchorPx:{x:500,y:700},
 shoulderVector:{x:100,y:tilt},headImagePx:{x:headX,y:320}
});
test('GT22 upper motion only changes a bounded factor on path events',()=>{
 const ink=new UpperBodyInkModulator();
 const initial=ink.update([frame('A',1000,0,500),frame('B',1000,0,800)]);
 assert.equal(initial.A,1);assert.equal(initial.B,1);
 const after=ink.update([frame('A',1050,60,535),frame('B',1050,0,800)]);
 assert.ok(after.A>1);
 assert.ok(after.A<=1.22);
 assert.equal(after.B,1,'a moving A must not affect B');
 const standing=ink.update([frame('A',1100,60,535)]);
 assert.ok(standing.A>=1&&standing.A<after.A,'stationary posture does not compound ink');
 ink.reset();assert.equal(ink.update([frame('A',1150,60,535)]).A,1);
});
test('GT22 stale or changed pose source never amplifies a fresh brush segment',()=>{
 const ink=new UpperBodyInkModulator();
 ink.update([frame('A',1000,0,500)]);
 assert.equal(ink.update([{...frame('A',1400,60,535)}]).A,1);
 assert.equal(ink.update([{...frame('A',1450,80,565),sourceKey:'new-clip'}]).A,1);
});
