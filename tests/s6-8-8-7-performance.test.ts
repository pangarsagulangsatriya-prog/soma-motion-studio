import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveHandScheduler,ReplayPerformanceMeter,adaptivePoseSmoothingAlpha}
 from '../src/stage/replayPerformance.ts';
test('S6.8.8.7 adaptive hands sample at moderate idle cadence, burst on wrist movement',()=>{
 const hands=new AdaptiveHandScheduler();
 assert.deepEqual(hands.choose(0,0,18),{run:true,intervalMs:320});
 assert.equal(hands.choose(100,0,18).run,false);
 assert.equal(hands.choose(320,0,18).run,true);
 assert.equal(hands.choose(430,.24,18).run,false);
 assert.equal(hands.choose(470,.24,18).run,true);
 hands.setMode('detail');
 assert.deepEqual(hands.choose(500,0,18),{run:true,intervalMs:145});
 assert.equal(hands.choose(630,0,18).run,false);
 assert.equal(hands.choose(645,0,18).run,true);
 hands.setMode('off');
 assert.deepEqual(hands.choose(1200,.6,90),{run:false,intervalMs:0});
});
test('S6.8.8.7 heavy pose AI backs off finger scans without disabling pose',()=>{
 const hands=new AdaptiveHandScheduler();
 assert.deepEqual(hands.choose(0,0,70),{run:true,intervalMs:560});
 assert.equal(hands.choose(400,0,70).run,false);
 assert.equal(hands.choose(560,0,70).run,true);
 assert.equal(hands.choose(700,.3,45).run,false);
 assert.deepEqual(hands.choose(760,.3,45),{run:true,intervalMs:196});
 hands.reset();
 assert.deepEqual(hands.choose(0,.3,45),{run:true,intervalMs:196});
});
test('S6.8.8.7 profiler separates pose, hands, analysis, render and skipped frames',()=>{
 const meter=new ReplayPerformanceMeter();
 meter.setBackend('worker');
 meter.observePresented(1);
 meter.observePresented(5);
 meter.observeBusy();
 meter.observeInference(100,25,12,6,44,true,145);
 meter.observeInference(200,35,0,8,55,false,320);
 meter.observeRender(3.5);
 meter.observeUi(100);meter.observeUi(250);
 const result=meter.snapshot;
 assert.equal(result.backend,'worker');
 assert.equal(result.skippedFrames,4);
 assert.equal(result.processedFrames,2);
 assert.equal(result.presentedFrames,5);
 assert.ok(result.poseMs>25&&result.poseMs<35);
 assert.equal(result.handsMs,12);
 assert.ok(result.analysisMs>6);
 assert.equal(result.renderMs,3.5);
 assert.equal(result.poseFps,10);
 assert.ok(result.uiFps>6);
 assert.equal(result.handIntervalMs,320);
 result.skippedFrames=1000;
 assert.equal(meter.snapshot.skippedFrames,4);
 meter.reset();
 assert.equal(meter.snapshot.processedFrames,0);
 assert.equal(meter.snapshot.backend,'worker');
});
test('S6.8.8.7 high-speed joints use stronger alpha than stationary jitter',()=>{
 const slow=adaptivePoseSmoothingAlpha(.05,.02);
 const fast=adaptivePoseSmoothingAlpha(.05,1.5);
 assert.ok(fast>slow);
 assert.ok(slow>0&&fast<1);
 assert.equal(adaptivePoseSmoothingAlpha(0,1),1);
 assert.equal(adaptivePoseSmoothingAlpha(.05,NaN)>0,true);
});

test('SOMA exposes CPU Worker-fallback reason and preserves it through timeline reset',()=>{
 const meter=new ReplayPerformanceMeter();
 meter.setBackend('main','Worker initialization unavailable: test error');
 assert.match(meter.snapshot.fallbackReason??'',/test error/);
 meter.reset();
 assert.equal(meter.snapshot.backend,'main');
 assert.match(meter.snapshot.fallbackReason??'',/test error/);
 meter.setBackend('worker');
 assert.equal(meter.snapshot.fallbackReason,undefined);
});
