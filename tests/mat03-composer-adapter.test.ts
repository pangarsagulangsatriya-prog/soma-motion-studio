import test from 'node:test';
import assert from 'node:assert/strict';
import {composerLiquidDemoEvents,composerLiquidTrackEvents}
 from '../src/studio/v3/composerLiquidAdapter.ts';
import {collectLiquidImprints} from '../src/footprints/materials/liquidImprintTimeline.ts';
import {liquidMaterialResponse} from '../src/footprints/materials/liquidMaterialResponse.ts';
import type {FootMotionEventV2} from '../src/footprints/scenes/FootMotionEventV2.ts';
import type {TimelineCapture,TimelineEvent} from '../src/studio/v3/composerEventTimelineModel.ts';

const e:FootMotionEventV2={
 schema:'soma.foot-motion-event',version:2,
 eventId:'sess:0:video:A:left:a',originEventId:'a',
 sessionId:'sess',generation:0,source:'video',
 actorId:'A',foot:'left',kind:'contact',x:.41,y:.42,atMs:12345,
 speed:0,confidence:.92,verified:true,verification:'video-estimate',
 coordinateBasis:'image-2d'
};
const event=(kind:TimelineEvent['kind'],atMs:number,id:string):TimelineEvent=>({
 id,atMs,kind,actorId:'A',foot:'left',x:kind==='slide'?.48:.41,
 y:.42,verified:kind==='contact',
 event:{...e,eventId:id,originEventId:id,kind,verified:kind==='contact',
 verification:kind==='contact'?'video-estimate':'unverified'}
});
test('MAT-03 Composer: FOUR demo phases are genuine single-stamp material events',()=>{
 for(const phase of ['contact','slide','pivot','release'] as const){
  const events=composerLiquidDemoEvents(phase,11200,11000);
  assert.equal(collectLiquidImprints(events,11200).length,1);
  const state=liquidMaterialResponse(collectLiquidImprints(events,11200)[0]);
  assert.equal(state.phase,phase);
  assert.ok(events.slice(1).every(e=>!e.verified));
 }
});
test('MAT-03 Composer: verified Track events use correct live and replay clocks',()=>{
 const capture:TimelineCapture={
  session:'sess',originAtMs:50000,
  events:[event('contact',0,'c'),event('slide',100,'s'),event('pivot',120,'p'),event('release',150,'r')]
 };
 const live=composerLiquidTrackEvents(capture,50300,'live');
 const replay=composerLiquidTrackEvents(capture,300,'replay');
 assert.deepEqual(live.map(e=>e.kind),['contact','slide','pivot','release']);
 assert.deepEqual(replay.map(e=>e.kind),live.map(e=>e.kind));
 assert.equal(live[0].atMs,50000);
 assert.equal(replay[0].atMs,0);
 assert.equal(collectLiquidImprints(live,50300).length,1);
 assert.equal(collectLiquidImprints(replay,300).length,1);
 assert.equal(liquidMaterialResponse(collectLiquidImprints(live,50300)[0]).phase,'release');
});
test('MAT-03 Composer: unsupported and unverified events make no projector stamps',()=>{
 const capture:TimelineCapture={
  session:'sess',originAtMs:1000,
  events:[event('presence',0,'p'),{...event('contact',20,'x'),verified:false},
   event('movement',50,'m'),{...event('contact',60,'z'),foot:'unknown'}]
 };
 assert.equal(composerLiquidTrackEvents(capture,1200).length,0);
 assert.deepEqual(collectLiquidImprints(composerLiquidTrackEvents(capture,1200),1200),[]);
});
