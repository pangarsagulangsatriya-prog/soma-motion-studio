import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyReplayState,replayDiscontinuity,replayEventsForSample,replayEventCounts}
 from '../src/stage/videoGaitAnalysis.ts';
import type {GaitSample} from '../src/footprints/gait-analysis/index.ts';
const gait=(overrides:Partial<GaitSample>={}):GaitSample=>({
 t:1000,x:.5,y:.6,side:0,heading:0,join:false,stamp:false,
 phase:'stance',confidence:.9,relativeSpeed:.04,motionKind:'hold',
 ...overrides
});
test('contact is emitted only for the gait analyzer stamp',()=>{
 const previous=emptyReplayState();
 assert.equal(replayEventsForSample(gait(),previous,'A','left',2).length,0);
 const events=replayEventsForSample(gait({stamp:true}),previous,'A','left',2);
 assert.deepEqual(events.map(x=>x.kind),['contact']);
 assert.deepEqual(events.map(x=>x.basis),['video-2d-estimate']);
 assert.equal(events[0].id,'video:2:A:left:1000:contact');
});
test('slide/pivot/swing are rising-edge hypotheses, not repeated every frame',()=>{
 const previous=emptyReplayState();
 const slide=gait({motionKind:'slide'});
 assert.equal(replayEventsForSample(slide,previous,'A','left',2)[0].kind,'slide');
 assert.deepEqual(replayEventsForSample(slide,{phase:'stance',motion:'slide',confidence:.9},'A','left',2),[]);
 const pivot=gait({motionKind:'pivot'});
 assert.deepEqual(replayEventsForSample(pivot,{phase:'stance',motion:'slide',confidence:1},'B','right',2).map(x=>x.kind),['pivot']);
 const swing=gait({motionKind:'step',phase:'swing'});
 assert.deepEqual(replayEventsForSample(swing,{phase:'stance',motion:'hold',confidence:1},'A','right',2).map(x=>x.kind),['swing']);
 assert.deepEqual(replayEventsForSample(swing,{phase:'swing',motion:'step',confidence:1},'A','right',2),[]);
});
test('occluded low confidence landmark samples cannot produce events',()=>{
 assert.equal(replayEventsForSample(gait({stamp:true,confidence:.3}),emptyReplayState(),'A','left',1).length,0);
});
test('IDs isolate performer and foot on the same media timestamp',()=>{
 const a=replayEventsForSample(gait({stamp:true}),emptyReplayState(),'A','left',1)[0];
 const b=replayEventsForSample(gait({stamp:true}),emptyReplayState(),'B','right',1)[0];
 assert.notEqual(a.id,b.id);
 assert.deepEqual(replayEventCounts([a,b]),{contact:2,swing:0,slide:0,pivot:0});
});
test('seeking backward or dropping frames resets temporal continuity',()=>{
 assert.equal(replayDiscontinuity(-1,10),false);
 assert.equal(replayDiscontinuity(1000,1000),false);
 assert.equal(replayDiscontinuity(1000,960),true);
 assert.equal(replayDiscontinuity(1000,1200),false);
 assert.equal(replayDiscontinuity(1000,1600),true);
 assert.equal(replayDiscontinuity(1000,NaN),true);
});

import {replayNeedsIdentityReset,replayNeedsGaitWarmup}
 from '../src/stage/videoGaitAnalysis.ts';
test('Slow Worker/CPU sampling gaps preserve actor identity but invalidate gait derivatives',()=>{
 assert.equal(replayNeedsIdentityReset(1000,1500),false);
 assert.equal(replayNeedsGaitWarmup(1000,1500),true);
 assert.equal(replayNeedsIdentityReset(1500,1510),false);
 assert.equal(replayNeedsGaitWarmup(1500,1510),false);
 assert.equal(replayNeedsIdentityReset(1500,1000),true);
 assert.equal(replayNeedsIdentityReset(-1,800),false);
 assert.equal(replayNeedsIdentityReset(1500,NaN),true);
 assert.equal(replayNeedsGaitWarmup(1500,NaN),false);
});
