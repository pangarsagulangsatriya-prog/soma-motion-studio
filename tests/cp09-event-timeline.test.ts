import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyTimelineCapture,collectTimelineEvents,timelineAt,timelineStep,
 timelineFootprintVisibility,reconstructTimelineFootprints,MAX_TIMELINE_EVENTS} from '../src/studio/v3/composerEventTimelineModel.ts';
import type {FootMotionEventV2} from '../src/footprints/scenes/FootMotionEventV2.ts';
const ev=(id:string,kind:FootMotionEventV2['kind'],atMs:number,actorId='A',foot:'left'|'right'='left'):FootMotionEventV2=>({
 schema:'soma.foot-motion-event',version:2,eventId:id,originEventId:id,sessionId:'run1',
 generation:1,actorId,foot,kind,source:'video',x:.3,y:.5,atMs,speed:.5,
 confidence:1,verified:kind==='contact',verification:kind==='contact'?'video-estimate':'unverified',
 coordinateBasis:'image-2d'
});
test('CP09: capture is session-scoped and repeated polling does not duplicate contacts',()=>{
 const events=[ev('1','contact',100),ev('2','slide',200),ev('3','pivot',300),ev('4','release',400)];
 let c=collectTimelineEvents(emptyTimelineCapture(),events,'A',1000);
 assert.equal(c.events.length,4);
 c=collectTimelineEvents(c,events,'A',1100);assert.equal(c.events.length,4);
 c=collectTimelineEvents(c,[ev('new','contact',500)],'A',1800);
 assert.equal(c.events[4].atMs,800);
 assert.equal(collectTimelineEvents(c,events,'B',2200).events.length,4);
});
test('CP09: seek reconstructs contact, slide, pivot and release without duplicating imprints',()=>{
 let c=emptyTimelineCapture('run1');
 c=collectTimelineEvents(c,[ev('c','contact',1)],'run1',1000);
 c=collectTimelineEvents(c,[ev('s','slide',2)],'run1',1100);
 c=collectTimelineEvents(c,[ev('p','pivot',3)],'run1',1200);
 c=collectTimelineEvents(c,[ev('r','release',4)],'run1',1300);
 assert.equal(timelineAt(c,50).length,1);
 assert.equal(reconstructTimelineFootprints(c,250).imprints.length,1);
 assert.equal(reconstructTimelineFootprints(c,350).imprints[0].releasedAtMs,300);
 assert.equal(timelineFootprintVisibility(c,1600,900).length,0);
 assert.equal(timelineFootprintVisibility(c,500,900).length,1);
});
test('CP09: play pause speed and end stop are deterministic',()=>{
 assert.deepEqual(timelineStep(100,100,1000,2),{positionMs:300,playing:true});
 assert.deepEqual(timelineStep(950,100,1000,1),{positionMs:1000,playing:false});
 assert.deepEqual(timelineStep(950,100,1000,1,true),{positionMs:50,playing:true});
 assert.deepEqual(timelineStep(0,100,0),{positionMs:0,playing:false});
});
test('CP09: captures bounded event history',()=>{
 const events=Array.from({length:MAX_TIMELINE_EVENTS+20},(_,i)=>ev('e'+i,'contact',i));
 const c=collectTimelineEvents(emptyTimelineCapture('A'),events,'A',1000);
 assert.equal(c.events.length,MAX_TIMELINE_EVENTS);
});
test('CP09: Composer timeline shares capture with scene layers and never arms projector',()=>{
 const s=readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');
 assert.match(s,/ComposerEventTimeline capture=\{timelineCapture\}/);
 assert.match(s,/collectTimelineEvents\(previous,events,session,performance\.now\(\)\)/);
 assert.match(s,/timelineAt\(timelineCaptureRef\.current,timelinePositionRef\.current\)/);
 assert.match(s,/timelineFootprintVisibility\(/);
 assert.match(s,/timelineModeRef\.current==='replay'&&!physical\?null/);
 const scene=readFileSync(new URL('../src/studio/v3/composeSceneEngine.ts',import.meta.url),'utf8');
 assert.match(scene,/replay\(events:readonly TimelineEvent\[\]\)/);
 const physical=readFileSync(new URL('../src/studio/v3/composeLayerPlan.ts',import.meta.url),'utf8');
 assert.match(physical,/if\(physical&&experiment\)return \[\]/);
});
