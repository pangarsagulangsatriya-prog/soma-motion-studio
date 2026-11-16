import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import type {FootstepEvent} from '../src/footprints/spatial/events.ts';
import {LiveFloorTrackingEngine,type CameraBinding} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
import {StageValidationRecorder,SoftwarePerformanceWindow,stageValidationSummary,percentile}
 from '../src/footprints/validation/StageValidationRecorder.ts';
import {FloorRenderGate,floorPaintKey} from '../src/footprints/live/FloorRenderGate.ts';

const floor=defaultFloorSpace(8,6);
const contact=(id:string,performerId='A',x=2,y=3):FootstepEvent=>({
 id,performerId,foot:'left',kind:'contact',timestampMs:110,
 positionM:{xM:x,yM:y},headingRad:0,source:'camera',
 positionBasis:'calibrated-estimate',confidence:.9
});
test('empty physical validation report never fabricates a centimetre error or latency',()=>{
 const r=new StageValidationRecorder(floor),summary=r.summary;
 assert.equal(summary.matchedContacts,0);
 assert.equal(summary.errorCm.mean,null);
 assert.equal(summary.errorCm.p95,null);
 assert.equal(summary.physicalLatencyMs.p95,null);
 assert.deepEqual(r.report({cameraSetup:'',projectorSetup:'',lighting:'',remarks:''}).contactSamples,[]);
 assert.match(r.report({cameraSetup:'',projectorSetup:'',lighting:'',remarks:''}).caveat,/tanpa sampel/i);
});
test('manually surveyed floor point yields Euclidean centimetres with matched event provenance',()=>{
 const r=new StageValidationRecorder(floor);
 const a=r.addContact(contact('a'),{xM:2.03,yM:3.04},'titik pita F1');
 const b=r.addContact(contact('b','B',4,3),{xM:4,yM:3.10});
 assert.equal(a.errorCm,5);
 assert.equal(b.errorCm,10);
 assert.equal(r.summary.errorCm.mean,7.5);
 assert.equal(r.summary.errorCm.median,7.5);
 assert.equal(r.summary.errorCm.p95,9.75);
 assert.equal(r.summary.errorCm.rmse,7.91);
 assert.equal(r.report({cameraSetup:'C',projectorSetup:'P',lighting:'redu p',remarks:''}).contactSamples[1].performerId,'B');
 assert.throws(()=>r.addContact(contact('a'),{xM:2.1,yM:3}),/sudah/);
 assert.throws(()=>r.addContact(contact('c'),{xM:9,yM:3}),/lantai/);
});
test('prediction, simulation, release, and non-camera provenance cannot masquerade as measured contact',()=>{
 const r=new StageValidationRecorder(floor),a=contact('a');
 for(const override of [
  {kind:'prediction'},{kind:'release'},{source:'simulation',positionBasis:'simulated'},
  {source:'legacy',positionBasis:'illustrative'}
 ]){
  assert.throws(()=>r.addContact({...a,...override} as FootstepEvent,{xM:2,yM:3}),/kamera/);
 }
 assert.equal(r.summary.matchedContacts,0);
});
test('physical camera-to-light latency requires operator-recorded high-speed video frames',()=>{
 const r=new StageValidationRecorder(floor);
 const a=r.addPhysicalLatency(8,120,'satu bidang gambar, peristiwa pijakan ke proyeksi');
 assert.equal(a.latencyMs,66.67);
 const b=r.addPhysicalLatency(5,100);
 assert.equal(b.latencyMs,50);
 assert.equal(r.summary.physicalLatencyMs.median,58.335);
 assert.throws(()=>r.addPhysicalLatency(5,0),/valid/);
 assert.throws(()=>r.addPhysicalLatency(-1,120),/valid/);
 assert.throws(()=>r.addPhysicalLatency(2.2,120),/valid/);
 assert.equal(r.report({cameraSetup:'',projectorSetup:'',lighting:'',remarks:''}).physicalLatencySamples.length,2);
});
test('false contacts, missed contacts, occlusions and ID switches remain operator annotations',()=>{
 const r=new StageValidationRecorder(floor);
 r.addObservation('false-contact','A','tercetak saat berhenti');
 r.addObservation('identity-mismatch','B','pasangan tubuh tertukar di persilangan');
 r.addObservation('missed-contact','A','satu pijakan tidak dicetak');
 r.addObservation('occlusion','both','dua tubuh saling menutupi');
 assert.equal(r.summary.observations['false-contact'],1);
 assert.equal(r.summary.observations['identity-mismatch'],1);
 assert.equal(r.summary.observations['missed-contact'],1);
 assert.equal(r.summary.observations['occlusion'],1);
 assert.equal(r.summary.observations.other,0);
 assert.throws(()=>r.addObservation('other','A',''),/Isi kejadian/);
 r.clear();assert.equal(r.summary.matchedContacts,0);
 assert.equal(r.observations.length,0);
});
test('software metrics are bounded diagnostics and cannot be mistaken for camera-to-photon latency',()=>{
 const s=new SoftwarePerformanceWindow();
 const empty=s.metrics(null);
 assert.equal(empty.renderP95Ms,null);
 assert.equal(empty.pipelineP95Ms,null);
 assert.equal(empty.outputFps,null);
 assert.equal(empty.note,'Software/browser metrics, not camera-to-photon latency');
 for(let i=0;i<210;i++){
  const begin=i*50;
  s.observePaint(begin,begin+(i%2?6:4));
  s.observeCamera({completedAt:begin,inferenceMs:9+i%5,pipelineMs:16+i%4});
 }
 s.observeCamera({completedAt:209*50,inferenceMs:999,pipelineMs:999}); // duplicate timestamp ignored
 const metrics=s.metrics({fps:24,p95Ms:12});
 assert.equal(metrics.fps,20);
 assert.equal(metrics.outputFps,24);
 assert.equal(metrics.outputP95Ms,12);
 assert.equal(metrics.renderMedianMs,5);
 assert.ok((metrics.inferenceP95Ms??0)<15);
 assert.ok((metrics.pipelineP95Ms??0)<21);
});
test('floor paint gating ignores unchanged events but repaints on new contacts/ghosts and heartbeat',()=>{
 const gate=new FloorRenderGate();
 const key=floorPaintKey(1,[],false,8,6,false);
 assert.equal(gate.shouldPaint(key,1000),true);
 assert.equal(gate.shouldPaint(key,1080),false);
 assert.equal(gate.shouldPaint(key,1600),false);
 assert.equal(gate.shouldPaint(key,1900),true);
 assert.equal(gate.shouldPaint(floorPaintKey(2,[],false,8,6,false),1910),true);
 assert.equal(gate.shouldPaint(floorPaintKey(2,['ghost-A'],false,8,6,true),1920),true);
 assert.equal(gate.shouldPaint(floorPaintKey(2,[],false,8,6,true),1930),true);
 assert.equal(gate.shouldPaint(floorPaintKey(2,[],true,8,6,true),1940),true);
 gate.reset();assert.equal(gate.shouldPaint(key,1950),true);
 assert.throws(()=>floorPaintKey(-1,[],false,8,6,false),/Revisi/);
});
test('repeated floor reads return same cached session until contact or reset',()=>{
 const e=new LiveFloorTrackingEngine();
 const binding:CameraBinding={trackId:'stage',deviceId:'camera',width:1280,height:720};
 e.configure({schema:'soma.footprints.camera-floor',version:1,floor,
  cameraQuad:[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}]},binding);
 const initialRevision=e.eventRevision,first=e.session;
 assert.ok(first);assert.strictEqual(e.session,first);
 e.confirm(true);
 const sample={x:.5,y:.5,side:0 as const,t:100,phase:'stance' as const,
  confidence:.95,relativeSpeed:0,heading:0,join:false,stamp:true};
 const event=e.ingest(sample,0,16/9,binding);
 assert.equal(event.filter(x=>x.kind==='contact').length,1);
 assert.equal(e.eventRevision,initialRevision+1);
 const second=e.session;assert.notStrictEqual(second,first);
 assert.strictEqual(e.session,second);
 assert.equal(e.status.contacts,1);
 e.resetSession();assert.equal(e.status.contacts,0);assert.notStrictEqual(e.session,second);
});
test('percentiles return null for missing values and interpolate small samples',()=>{
 assert.equal(percentile([],95),null);
 assert.equal(percentile([10,20],50),15);
 assert.equal(percentile([10,20],95),19.5);
 assert.equal(percentile([Number.NaN],95),null);
});
