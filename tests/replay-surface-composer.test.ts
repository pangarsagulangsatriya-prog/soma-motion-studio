import test from 'node:test';
import assert from 'node:assert/strict';
import {
 defaultReplayComposition,illustrateFloorPoint,mediaSourceId,normalizeReplayComposition,
 replayEventEnvelope,safeReplayFrame
} from '../src/stage/replaySurfaceLogic.ts';
import type {ReplayGaitEvent} from '../src/stage/videoGaitAnalysis.ts';
import type {ReplayAnalysisSnapshot} from '../src/stage/VideoPoseGaitEngine.ts';
const evt=(performer:'A'|'B',kind:ReplayGaitEvent['kind'],atMs=1000):ReplayGaitEvent=>({
 id:performer+kind,atMs,performer,foot:'left',kind,confidence:.93,x:.5,y:.75,
 headingRad:0,basis:'video-2d-estimate'
});
const snapshot=(count:1|2=1):ReplayAnalysisSnapshot=>({
 atMs:1200,segment:2,sampledFrames:8,performers:count,ambiguous:false,
 status:'frame siap',events:[evt('A','contact')],
 people:count===1?[{id:'A',landmarks:[],confidence:1}]:
 [{id:'A',landmarks:[],confidence:1},{id:'B',landmarks:[],confidence:1}],
 gait:{}
});
test('replay composer starts with independent A/B and blank illustrative FLOOR',()=>{
 const value=defaultReplayComposition();
 assert.equal(value['BODY A'].length,1);
 assert.equal(value['BODY B'].length,1);
 assert.equal(value.FLOOR.length,1);
 assert.equal(value['BODY A'][0].assetId,mediaSourceId);
 assert.equal(value.FLOOR[0].assetId,'');
});
test('stale or ambiguous video frames cannot render body or floor',()=>{
 assert.equal(safeReplayFrame(true,snapshot(1),1200,1),true);
 assert.equal(safeReplayFrame(true,snapshot(1),1700,1),false);
 assert.equal(safeReplayFrame(false,snapshot(1),1200,1),false);
 assert.equal(safeReplayFrame(true,{...snapshot(2),ambiguous:true},1200,2),false);
 assert.equal(safeReplayFrame(true,{...snapshot(2),people:[snapshot(2).people[0]]},1200,2),false);
 assert.equal(safeReplayFrame(true,snapshot(2),1200,2),true);
 assert.equal(safeReplayFrame(true,snapshot(1),1200,2),false);
});
test('Contact/Slide/Pivot bindings respect performer identity and video clock',()=>{
 const e=[evt('A','contact'),evt('B','slide',1200),evt('A','pivot',1400)];
 assert.ok(replayEventEnvelope(e,'BODY A','contact-reveal',1200)>.5);
 assert.equal(replayEventEnvelope(e,'BODY B','contact-reveal',1200),0);
 assert.equal(replayEventEnvelope(e,'BODY A','slide-hold',1500),0);
 assert.equal(replayEventEnvelope(e,'BODY B','slide-hold',1500),1);
 assert.ok(replayEventEnvelope(e,'BODY A','pivot-decay',1600)>.7);
 assert.equal(replayEventEnvelope(e,'BODY A','pivot-decay',5000),0);
 assert.equal(replayEventEnvelope(e,'FLOOR','slide-hold',1500),1);
 assert.equal(replayEventEnvelope(e,'FLOOR','none',999999),1);
});
test('S6.4 presets transfer safe settings, not stale browser media IDs',()=>{
 const imported=normalizeReplayComposition({
  'BODY A':[{
   id:'old-layer',name:'Archive',mediaId:'blob:stale',mask:'polygon',
   points:[[.2,.2],[.8,.2],[.5,.7]],opacity:230,scale:999,
   x:-200,rotation:25,blend:'screen',recipe:'contact-reveal'
  }],
  FLOOR:[{name:'paths',assetId:'',opacity:65,recipe:'slide-hold'}]
 });
 assert.equal(imported['BODY A'][0].assetId,mediaSourceId);
 assert.equal(imported['BODY A'][0].opacity,100);
 assert.equal(imported['BODY A'][0].scale,300);
 assert.equal(imported['BODY A'][0].x,-150);
 assert.equal(imported['BODY A'][0].mask,'polygon');
 assert.deepEqual(imported['BODY A'][0].points,[[.2,.2],[.8,.2],[.5,.7]]);
 assert.equal(imported.FLOOR[0].assetId,'');
 assert.equal(imported.FLOOR[0].recipe,'slide-hold');
 assert.equal(imported['BODY B'].length,1);
});
test('floor positions are clamped and explicitly non-metric',()=>{
 assert.deepEqual(illustrateFloorPoint(-10,-10),{x:.035,y:.035});
 assert.deepEqual(illustrateFloorPoint(10,10),{x:.965,y:.965});
 const p=illustrateFloorPoint(.5,.64);
 assert.equal(p.x,.5);
 assert.ok(p.y>0&&p.y<1);
});
