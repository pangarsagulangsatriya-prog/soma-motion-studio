import test from 'node:test';
import assert from 'node:assert/strict';
import {checkIdentityObservation,ReplayIdentityGate} from '../src/stage/videoReplayIdentityQA.ts';
import {buildReplayEventExport,replayEventsCsv,type ReplayArchiveSegment} from '../src/stage/videoReplayExport.ts';
import type {ReplayOverlayPerson,ReplayAnalysisSnapshot} from '../src/stage/VideoPoseGaitEngine.ts';
import type {ReplayGaitEvent} from '../src/stage/videoGaitAnalysis.ts';
const person=(id:'A'|'B',x:number):ReplayOverlayPerson=>{
 const points=Array.from({length:33},()=>({x,y:.55,z:0,visibility:1}));
 points[23]={x:x-.02,y:.58,z:0,visibility:1};
 points[24]={x:x+.02,y:.58,z:0,visibility:1};
 return {id,landmarks:points,confidence:.96};
};
const e=(segment:number,performer:'A'|'B',kind:'contact'|'slide',atMs:number):ReplayGaitEvent=>({
 id:'video:'+segment+':'+performer+':left:'+atMs+':'+kind,
 atMs,performer,foot:'left',kind,confidence:.87,x:.4,y:.7,
 headingRad:.2,basis:'video-2d-estimate'
});
test('identity QA needs three consecutive reliable A/B frames',()=>{
 const qa=new ReplayIdentityGate();
 const a=person('A',.2),b=person('B',.78);
 assert.equal(qa.observe([a,b],2,false),false);
 assert.equal(qa.observe([a,b],2,false),false);
 assert.equal(qa.snapshot.state,'warming');
 assert.equal(qa.observe([a,b],2,false),true);
 assert.equal(qa.snapshot.state,'stable');
 assert.equal(qa.snapshot.stableFrames,1);
});
test('missing B or close bodies clear warmup and cannot pass',()=>{
 const qa=new ReplayIdentityGate();
 const a=person('A',.2),b=person('B',.78);
 qa.observe([a,b],2,false);
 assert.equal(qa.observe([a],2,false),false);
 assert.equal(qa.snapshot.streak,0);
 assert.equal(qa.observe([a,person('B',.25)],2,false),false);
 assert.equal(qa.snapshot.state,'partial');
 assert.equal(qa.observe([a,b],2,false),false);
});
test('ambiguous crossing locks A/B until explicit reset',()=>{
 const qa=new ReplayIdentityGate();const a=person('A',.2),b=person('B',.8);
 for(let i=0;i<3;i++)qa.observe([a,b],2,false);
 assert.equal(qa.observe([],2,true),false);
 assert.equal(qa.snapshot.state,'locked');
 assert.equal(qa.observe([a,b],2,false),false);
 assert.equal(qa.snapshot.state,'locked');
 qa.reset('seek',4000);
 assert.equal(qa.snapshot.lastResetAtMs,4000);
 assert.equal(qa.observe([a,b],2,false),false);
 assert.equal(qa.snapshot.state,'warming');
});
test('duplicate IDs and weak confidence are rejected',()=>{
 const a=person('A',.25),b=person('B',.75);
 assert.equal(checkIdentityObservation([a,a],2,false).valid,false);
 assert.equal(checkIdentityObservation([{...a,confidence:.3},b],2,false).valid,false);
});
test('export preserves event segment and reset reason; never claims metric floor',()=>{
 const qa=new ReplayIdentityGate();qa.reset('Loop ke tanda IN',950);
 const archive:ReplayArchiveSegment={
  segment:2,firstAtMs:300,lastAtMs:1000,sampledFrames:10,
  endReason:'Loop ke tanda IN',events:[e(2,'A','contact',700)],identityQA:qa.snapshot
 };
 const snapshot:ReplayAnalysisSnapshot={
  atMs:850,segment:3,sampledFrames:6,performers:2,
  people:[person('A',.2),person('B',.7)],events:[e(3,'B','slide',800)],
  status:'stable',ambiguous:false,gait:{},qa:qa.snapshot
 };
 const report=buildReplayEventExport({
  file:{name:'footage.mp4',bytes:100000,mime:'video/mp4',lastModified:123},
  video:{durationSeconds:10,width:1920,height:1080},
  snapshot,archives:[archive],requestedAt:'2026-11-17T00:00:00.000Z'
 });
 assert.equal(report.schema,'soma.video-replay-qa');
 assert.equal(report.summary.segments,2);
 assert.equal(report.summary.events,2);
 assert.equal(report.summary.counts.contact,1);
 assert.equal(report.summary.counts.slide,1);
 assert.deepEqual(report.events.map(x=>x.segment),[2,3]);
 assert.equal(report.segments[0].endReason,'Loop ke tanda IN');
 assert.equal(report.flags.physicalProjectionAuthorized,false);
 assert.equal(report.flags.physicalFloorCalibrated,false);
 const csv=replayEventsCsv(report);
 assert.match(csv,/video_time_ms/);
 assert.match(csv,/Loop ke tanda IN/);
 assert.match(csv,/video-2d-estimate/);
});
