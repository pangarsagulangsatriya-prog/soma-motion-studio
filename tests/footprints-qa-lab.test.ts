import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {validateFloorSession} from '../src/footprints/spatial/events.ts';
import {DirectPuppetSession,replayPoseAt} from '../src/footprints/simulator/puppet-controller.ts';
import {floorArtworkSVG} from '../src/footprints/simulator/floor-artwork.ts';
import {floorRasterPoint} from '../src/footprints/simulator/floorCanvas.ts';
import {createQAScenario,QA_DURATION_MS,QA_FAULTS,qaContactCounts,
 qaEventIndexAt,qaEventsAt,qaBodyPosition,qaOutputTransportAt,qaPhaseAt}
 from '../src/footprints/simulator/QAScenario.ts';
import {runSimulationQA} from '../src/footprints/simulator/SimulationQAReport.ts';
import {effectiveFloorTransport} from '../src/projection/floorBridge.ts';
import {shouldTransmitArtwork,shouldRefreshFloorArtwork} from '../src/projection/channel.ts';

const floor=defaultFloorSpace(8,6);
const scenario=createQAScenario(floor,true),report=runSimulationQA(scenario);
test('S5.6 runs 900,000ms of dual-person simulation in a valid event session',()=>{
 assert.equal(scenario.durationMs,QA_DURATION_MS);
 assert.equal(scenario.durationMs,900000);
 assert.equal(scenario.source,'simulation');
 assert.equal(validateFloorSession(scenario.session).events.length,scenario.session.events.length);
 assert.ok(scenario.session.events.length>1500);
 const counts=qaContactCounts(scenario);
 for(const performer of ['A','B'] as const){
  assert.ok(counts[performer].left>200);
  assert.ok(counts[performer].right>200);
 }
 assert.equal(scenario.session.events.some(e=>e.kind==='prediction'),false);
 assert.equal(scenario.session.events.every(e=>e.source==='simulation'&&e.positionBasis==='simulated'),true);
 assert.equal(scenario.session.events.at(-1)!.timestampMs>897000,true);
});
test('deterministic scenario reproduces identical event histories without webcam or randomness',()=>{
 const next=createQAScenario(floor,true);
 assert.deepEqual(next.session,scenario.session);
 assert.deepEqual(next.faults,scenario.faults);
 assert.deepEqual(runSimulationQA(next).checks,report.checks);
});
test('all software assertions pass, and report makes no physical cm or camera-photon claim',()=>{
 assert.equal(report.ok,true,JSON.stringify(report.checks.filter(c=>!c.pass),null,2));
 assert.equal(report.passed,report.total);
 assert.ok(report.total>=9);
 assert.equal(report.physicalAccuracyCm,null);
 assert.equal(report.physicalLatencyMs,null);
 assert.match(report.note,/sintetis|synthetic/i);
 assert.equal(report.contactCount,scenario.session.events.filter(e=>e.kind==='contact').length);
 assert.ok(report.skippedSteps>0);
});
test('tracking, crossing and camera-change windows contain zero contacts, followed by fresh A/B cycles',()=>{
 const blocks=QA_FAULTS.filter(f=>['tracking-loss','identity-crossing','camera-change'].includes(f.id));
 for(const f of blocks){
  const inWindow=scenario.session.events.filter(e=>e.kind==='contact'&&
   e.timestampMs>=f.startMs&&e.timestampMs<f.endMs);
  assert.equal(inWindow.length,0,f.name);
  for(const id of ['A','B']){
   assert.ok(scenario.session.events.some(e=>e.kind==='contact'&&e.performerId===id&&
    e.timestampMs>=f.endMs&&e.timestampMs<f.endMs+5000),f.name+' '+id);
  }
 }
});
test('two person paths use real metric coordinates and phases switch on schedule',()=>{
 for(const t of [0,12500,180000,360000,540000,720000,900000]){
  for(const id of ['A','B'] as const){
   const point=qaBodyPosition(id,t,floor);
   assert.ok(point.xM>0&&point.xM<floor.widthM);
   assert.ok(point.yM>0&&point.yM<floor.depthM);
   const raster=floorRasterPoint(floor,point);
   assert.ok(raster.x>=0&&raster.x<=1280&&raster.y>=0&&raster.y<=720);
  }
 }
 assert.equal(qaPhaseAt(0).name,'Labour');
 assert.equal(qaPhaseAt(540000).name,'Crossing');
 assert.equal(qaPhaseAt(900000).name,'Return Pressure');
});
test('timeline seek uses inclusive upper-bound and exact contact count at 15:00',()=>{
 const events=scenario.session.events;
 assert.equal(qaEventIndexAt(events,-1),0);
 assert.equal(qaEventIndexAt(events,0),0);
 assert.equal(qaEventIndexAt(events,QA_DURATION_MS),events.length);
 const mid=qaEventsAt(scenario,450000);
 assert.ok(mid.length>0&&mid.length<events.length);
 assert.equal(mid.every(e=>e.timestampMs<=450000),true);
 assert.equal(qaEventsAt(scenario,900000).length,events.length);
 const rigs=replayPoseAt(floor,mid,450000);
 assert.equal(rigs.length,2);
 assert.notDeepEqual(rigs[0].left.positionM,rigs[1].left.positionM);
});
test('scripted transport faults NEVER override a manual projector blackout or hold',()=>{
 const expected=[
  [10000,'live'],[220500,'blackout'],[427000,'blackout'],
  [610000,'blackout'],[735000,'hold'],[813000,'blackout']
 ] as const;
 for(const [time,transport] of expected){
  assert.equal(qaOutputTransportAt(time,true,true),transport);
  assert.equal(qaOutputTransportAt(time,false,true),'blackout');
  assert.equal(effectiveFloorTransport('blackout',transport),'blackout');
  assert.equal(effectiveFloorTransport('hold',transport),transport==='blackout'?'blackout':'hold');
  const final=effectiveFloorTransport('live',transport);
  assert.equal(final,transport);
  assert.equal(shouldTransmitArtwork({transport:final,blank:final==='blackout',pattern:false}),
   final==='live');
 }
 assert.equal(effectiveFloorTransport('blackout','live'),'blackout');
 assert.equal(effectiveFloorTransport('hold','live'),'hold');
 assert.equal(shouldRefreshFloorArtwork('same','same',200),false);
 assert.equal(shouldRefreshFloorArtwork('changed','same',200),true);
});
test('camera and identity faults stay dark until explicit synthetic recovery milestones',()=>{
 assert.equal(qaOutputTransportAt(433000,true,true),'blackout');
 assert.equal(qaOutputTransportAt(437900,true,true),'blackout');
 assert.equal(qaOutputTransportAt(438000,true,true),'live');
 assert.equal(qaOutputTransportAt(617000,true,true),'blackout');
 assert.equal(qaOutputTransportAt(624900,true,true),'blackout');
 assert.equal(qaOutputTransportAt(625000,true,true),'live');
 assert.ok(!scenario.session.events.some(e=>e.kind==='contact'&&e.timestampMs>=426000&&e.timestampMs<438000));
 assert.ok(!scenario.session.events.some(e=>e.kind==='contact'&&e.timestampMs>=609000&&e.timestampMs<625000));
});
test('fault toggle leaves full 15 minutes running and restores continuous live transport',()=>{
 const plain=createQAScenario(floor,false),summary=runSimulationQA(plain);
 assert.equal(plain.faults.length,0);
 assert.equal(plain.skippedSteps,0);
 assert.equal(summary.ok,true,JSON.stringify(summary.checks.filter(c=>!c.pass)));
 assert.ok(plain.session.events.length>=scenario.session.events.length);
 for(const t of [220500,427000,610000,735000,813000])
  assert.equal(qaOutputTransportAt(t,true,false),'live');
});
test('shared SVG renderer consumes synthetic event contract without confusing ghosts/physical evidence',()=>{
 const partial=qaEventsAt(scenario,35000);
 const svg=floorArtworkSVG({...scenario.session,events:partial},{width:960,height:720,showGrid:false});
 assert.match(svg,/<svg/);
 assert.match(svg,/#E6EBD9/);
 assert.match(svg,/#7FB0CB/);
 assert.ok(svg.length>2000);
 const manual=new DirectPuppetSession(floor),who={performerId:'A',foot:'left'} as const;
 manual.lift(who,100);manual.land(who,230);
 assert.equal(manual.session.events.filter(e=>e.kind==='contact').length,1);
 assert.equal(manual.session.events.every(e=>e.source==='simulation'),true);
});
