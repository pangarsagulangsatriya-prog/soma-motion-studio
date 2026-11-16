import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import {cameraBindingKey,LiveFloorTrackingEngine,type CameraBinding} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
import {chooseFloorArtworkSource,liveFloorArtworkState} from '../src/projection/floorBridge.ts';
import {projectionDefaults,ProjectionModel} from '../src/projection/model.ts';
import {emptyFrame} from '../src/engine/types.ts';
import type {GaitSample} from '../src/footprints/gait-analysis/index.ts';
const floor=defaultFloorSpace(8,6);
const camera:CameraBinding={trackId:'track-alpha',deviceId:'camera-a',width:1280,height:720};
const calibration:CameraFloorCalibration={
 schema:'soma.footprints.camera-floor',version:1,floor,
 cameraQuad:[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}]
};
const gait=(patch:Partial<GaitSample>={}):GaitSample=>({
 x:.5,y:.5,side:0,t:0,phase:'swing',confidence:.92,relativeSpeed:.65,
 heading:0,join:false,stamp:false,...patch
});
const setup=()=>{
 const tracker=new LiveFloorTrackingEngine();
 tracker.configure(calibration,camera);
 tracker.confirm(true);
 return tracker;
};
test('camera binding pins exact stream, device and resolution, not merely the old calibration',()=>{
 assert.ok(cameraBindingKey(camera));
 assert.notEqual(cameraBindingKey(camera),cameraBindingKey({...camera,trackId:'restarted'}));
 assert.notEqual(cameraBindingKey(camera),cameraBindingKey({...camera,width:1920}));
 assert.notEqual(cameraBindingKey(camera),cameraBindingKey({...camera,deviceId:'other'}));
 assert.equal(cameraBindingKey({...camera,width:0}),null);
 assert.equal(cameraBindingKey(null),null);
 const tracker=setup();assert.equal(tracker.isConfirmed,true);
 assert.equal(tracker.checkBinding(camera),true);
 assert.equal(tracker.checkBinding({...camera,trackId:'other'}),false);
 assert.equal(tracker.isConfirmed,false);
 assert.match(tracker.status.reason,/kalibrasikan ulang/i);
});
test('camera needs valid four floor corners and manual confirmation before producing a contact',()=>{
 const e=new LiveFloorTrackingEngine();
 assert.equal(e.ingest(gait({t:10,phase:'stance',stamp:true}),0,16/9,camera).length,0);
 e.configure(calibration,camera);
 assert.equal(e.ingest(gait({t:20,phase:'stance',stamp:true}),0,16/9,camera).length,0);
 assert.throws(()=>e.configure({...calibration,cameraQuad:[
  calibration.cameraQuad[0],calibration.cameraQuad[2],calibration.cameraQuad[1],calibration.cameraQuad[3]
 ]},camera));
 e.confirm(true);
 const hit=e.ingest(gait({t:100,phase:'stance',stamp:true}),0,16/9,camera);
 assert.equal(hit.filter(x=>x.kind==='contact').length,1);
 assert.equal(hit[0].positionBasis,'calibrated-estimate');
 assert.equal(hit[0].source,'camera');
 assert.equal(hit[0].foot,'left');
 assert.ok(Math.abs(hit[0].positionM.xM-4)<.001);
 assert.ok(Math.abs(hit[0].positionM.yM-3)<.001);
 assert.equal(e.session?.events.length,1);
});
test('stance is debounced: standing frames cannot stamp repeatedly; release uses last ground position',()=>{
 const e=setup();
 assert.deepEqual(e.ingest(gait({t:10,phase:'swing'}),0,16/9,camera),[]);
 const first=e.ingest(gait({t:150,phase:'stance',stamp:true}),0,16/9,camera);
 assert.equal(first.length,1);assert.equal(first[0].kind,'contact');
 assert.equal(e.ingest(gait({t:180,phase:'stance',stamp:false}),0,16/9,camera).length,0);
 assert.equal(e.ingest(gait({t:180,phase:'stance',stamp:true}),0,16/9,camera).length,0);
 const release=e.ingest(gait({t:250,phase:'swing',stamp:false,x:.9}),0,16/9,camera);
 assert.equal(release.length,1);assert.equal(release[0].kind,'release');
 assert.deepEqual(release[0].positionM,first[0].positionM);
 const second=e.ingest(gait({t:400,phase:'stance',stamp:true,x:.65}),0,16/9,camera);
 assert.equal(second.filter(x=>x.kind==='contact').length,1);
 assert.equal(e.status.contacts,2);
});
test('lost tracking cannot create a new stamp until swing has been seen again',()=>{
 const e=setup();
 e.ingest(gait({t:10,phase:'stance',stamp:true}),0,16/9,camera);
 assert.equal(e.status.contacts,1);
 e.ingest(null,0,16/9,camera);
 assert.equal(e.ingest(gait({t:50,phase:'stance',stamp:true}),0,16/9,camera).length,0);
 assert.equal(e.status.contacts,1);
 e.ingest(gait({t:80,phase:'swing'}),0,16/9,camera);
 const events=e.ingest(gait({t:220,phase:'stance',stamp:true}),0,16/9,camera);
 assert.equal(events.filter(x=>x.kind==='contact').length,1);
 assert.equal(e.status.contacts,2);
});
test('event engine rejects low-confidence and outside-floor contacts; no old camera position leaks',()=>{
 const e=setup();
 assert.equal(e.ingest(gait({t:10,phase:'stance',stamp:true,confidence:.1}),0,16/9,camera).length,0);
 assert.equal(e.ingest(gait({t:60,phase:'stance',stamp:true,x:.99,y:.99}),0,16/9,camera).length,0);
 assert.equal(e.status.contacts,0);
 e.ingest(gait({t:100,phase:'swing'}),0,16/9,camera);
 const good=e.ingest(gait({t:250,phase:'stance',stamp:true}),0,16/9,camera);
 assert.equal(good.length,1);
 e.resetSession();assert.equal(e.status.contacts,0);
 assert.equal(e.session?.events.length,0);
});
test('two feet maintain independent ground state and V3 export uses monotonically ordered events',()=>{
 const e=setup();
 e.ingest(gait({t:20,side:0,phase:'swing'}),0,16/9,camera);
 e.ingest(gait({t:20,side:1,phase:'swing'}),1,16/9,camera);
 e.ingest(gait({t:150,side:0,phase:'stance',stamp:true,x:.38}),0,16/9,camera);
 e.ingest(gait({t:150,side:1,phase:'stance',stamp:true,x:.62}),1,16/9,camera);
 assert.equal(e.status.contacts,2);
 const session=e.session!;
 assert.equal(session.version,3);
 assert.equal(session.events[0].foot,'left');
 assert.equal(session.events[1].foot,'right');
 assert.ok(session.events[0].timestampMs<=session.events[1].timestampMs);
 assert.equal(new Set(session.events.map(x=>x.id)).size,session.events.length);
});
test('Live Floor source preempts uncalibrated legacy Footprints and uses shared projector state',()=>{
 assert.deepEqual(chooseFloorArtworkSource(false,false,false,true,true,true,false,true),
  {source:'live-floor',canStream:false});
 assert.deepEqual(chooseFloorArtworkSource(false,false,false,true,true,true,true,true),
  {source:'live-floor',canStream:true});
 assert.deepEqual(chooseFloorArtworkSource(true,true,true,true,true,true,true,true),
  {source:'simulator',canStream:true});
 const m=new ProjectionModel();m.setTransport('live');
 const state=m.sample(emptyFrame(),'body',4/3,10);
 const missing=liveFloorArtworkState(state,false);
 assert.equal(missing.blank,true);
 const ready=liveFloorArtworkState(state,true);
 assert.equal(ready.blank,false);
 assert.equal(ready.config.mirror,false);
 assert.match(ready.reason,/kamera/i);
 m.setTransport('blackout');
 assert.equal(liveFloorArtworkState(m.sample(emptyFrame(),'body',4/3,30),true).blank,true);
});
