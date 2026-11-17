import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplayEventExport} from '../src/stage/videoReplayExport.ts';
import {fromReplayReport,parseReferenceReport,selectReferenceSegment,comparisonWindow,
 contactMetrics,referenceContacts,liveContacts,validLiveEvent,safeLiveCapture,
 liveTimeline,normalizedLivePath} from '../src/stage/rehearsalComparisonModel.ts';
import type {ReplayAnalysisSnapshot} from '../src/stage/VideoPoseGaitEngine.ts';
import type {FootstepEvent} from '../src/footprints/spatial/events.ts';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {LiveFloorTrackingEngine} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
const reference=()=>{
 const snapshot:ReplayAnalysisSnapshot={
  atMs:9000,segment:1,firstAtMs:0,sampledFrames:110,performers:1,
  people:[],ambiguous:false,gait:{},status:'ready',
  events:[
   {id:'a',kind:'contact',atMs:1000,performer:'A',foot:'left',
    confidence:.9,x:.4,y:.75,headingRad:0,basis:'video-2d-estimate'},
   {id:'b',kind:'contact',atMs:2000,performer:'A',foot:'right',
    confidence:.8,x:.5,y:.75,headingRad:0,basis:'video-2d-estimate'},
   {id:'c',kind:'slide',atMs:2500,performer:'A',foot:'right',
    confidence:.9,x:.6,y:.7,headingRad:0,basis:'video-2d-estimate'}
  ]
 };
 return buildReplayEventExport({
  file:{name:'walking.mp4',bytes:12000,mime:'video/mp4',lastModified:0},
  video:{durationSeconds:12,width:1920,height:1080},snapshot,archives:[],
  requestedAt:'2026-11-17T00:00:00.000Z'
 });
};
const live=(timestampMs:number,performerId='performer-1',kind:'contact'|'move'='contact'):FootstepEvent=>({
 id:performerId+kind+timestampMs,performerId,kind,foot:'left',timestampMs,
 positionM:{xM:2,yM:1},headingRad:0,source:'camera',
 positionBasis:'calibrated-estimate',confidence:.91
});
test('S6.5.5 QA JSON can be imported as a reference without frame mixing',()=>{
 const parsed=fromReplayReport(reference());
 assert.equal(parsed.segments.length,1);
 assert.equal(parsed.events.length,3);
 assert.equal(selectReferenceSegment(parsed,1)?.durationMs,9000);
 assert.equal(comparisonWindow(parsed,1,30000),9000);
 assert.equal(comparisonWindow(parsed,1,3000),3000);
 assert.equal(referenceContacts(parsed,1,'A').length,2);
 assert.equal(referenceContacts(parsed,1,'B').length,0);
});
test('rejects spoofed projection flags, missing segments and invalid coordinates',()=>{
 const forged={...reference(),flags:{...reference().flags,physicalProjectionAuthorized:true}};
 assert.throws(()=>parseReferenceReport(forged),/metadata/i);
 const malformed={...reference(),events:[{...reference().events[0],x:4}]};
 assert.throws(()=>parseReferenceReport(malformed),/event/i);
 const missing={...reference(),schema:'some-other-schema'};
 assert.throws(()=>parseReferenceReport(missing),/JSON Event QA/);
});
test('cadence and pauses are computed from comparable windows',()=>{
 const m=contactMetrics([
  {timeMs:0,foot:'left',confidence:.9},
  {timeMs:500,foot:'right',confidence:.9},
  {timeMs:2500,foot:'left',confidence:.9}
 ],0,5000);
 assert.equal(m.count,3);assert.equal(m.cadence,36);
 assert.deepEqual(m.intervalsMs,[500,2000]);
 assert.equal(m.pauseCount,1);assert.equal(m.pauseDurationMs,2000);
 assert.equal(m.medianIntervalMs,1250);
 assert.equal(m.left,2);assert.equal(m.right,1);
});
test('only calibrated camera events from current capture can be used',()=>{
 assert.equal(validLiveEvent(live(1200),1000,5000,1),true);
 assert.equal(validLiveEvent(live(500),1000,5000,1),false);
 assert.equal(validLiveEvent(live(1200,'B'),1000,5000,1),false);
 assert.equal(validLiveEvent({...live(1200),source:'simulation'},1000,5000,1),false);
 assert.equal(validLiveEvent({...live(1200),positionBasis:'illustrative'},1000,5000,1),false);
 assert.equal(liveContacts([live(1200),live(1800,'B')],'A').length,1);
 assert.equal(liveTimeline([live(1200)],1000,1000,'A',1).length,1);
});
test('camera/physical calibration and A/B matching gate capture',()=>{
 const ready={cameraOn:true,bodySelected:true,frameSource:'camera',
  frameTracked:true,frameAgeMs:90,floorConfirmed:true,cameraMatched:true,
  performerCount:2 as 1|2,identityAmbiguous:false,
  visibleIds:['A','B'],frameMatched:true};
 assert.equal(safeLiveCapture(ready).ready,true);
 assert.equal(safeLiveCapture({...ready,frameAgeMs:800}).ready,false);
 assert.equal(safeLiveCapture({...ready,identityAmbiguous:true}).ready,false);
 assert.equal(safeLiveCapture({...ready,visibleIds:['A']}).ready,false);
 assert.equal(safeLiveCapture({...ready,cameraMatched:false}).ready,false);
});
test('metric floor visual is normalized only in its own coordinate system',()=>{
 const floor=defaultFloorSpace(8,6);
 const route=normalizedLivePath([live(1000)],floor,'A');
 assert.deepEqual(route,[{x:.25,y:1-1/6}]);
 assert.deepEqual(normalizedLivePath([live(1000)],null,'A'),[]);
});

test('cadence stays unavailable when fewer than two contacts are observed',()=>{
 assert.equal(contactMetrics([],0,10000).cadence,null);
 assert.equal(contactMetrics([{timeMs:400,foot:'left',confidence:.9}],0,10000).cadence,null);
});
test('FloorSession epoch changes independently of event count on reset',()=>{
 const engine=new LiveFloorTrackingEngine();
 const initial=engine.sessionEpoch;
 engine.resetSession();
 assert.equal(engine.sessionEpoch,initial+1);
 engine.resetSession();
 assert.equal(engine.sessionEpoch,initial+2);
});
