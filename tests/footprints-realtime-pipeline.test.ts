import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import {LiveFloorTrackingEngine,type CameraBinding} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
import {FloorRepaintScheduler} from '../src/footprints/live/FloorRepaintScheduler.ts';
import {ArtworkTransferWindow} from '../src/projection/ArtworkTransferWindow.ts';
import {FloorRealtimeTimingWindow,type FloorUpdate} from '../src/footprints/live/FloorRealtimeDiagnostics.ts';
import {liveFloorArtworkState} from '../src/projection/floorBridge.ts';
import {ProjectionModel} from '../src/projection/model.ts';
import {shouldTransmitArtwork} from '../src/projection/channel.ts';
import {emptyFrame} from '../src/engine/types.ts';
import type {GaitSample} from '../src/footprints/gait-analysis/index.ts';

const floor=defaultFloorSpace(8,6);
const binding:CameraBinding={trackId:'realtime-track',deviceId:'cam',width:1280,height:720};
const calibration:CameraFloorCalibration={schema:'soma.footprints.camera-floor',version:1,
 floor,cameraQuad:[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}]};
const gait=(t:number,phase:'stance'|'swing',stamp=phase==='stance'):GaitSample=>({
 x:.5,y:.5,side:0,t,phase,stamp,confidence:.9,relativeSpeed:phase==='swing'?.65:.01,
 heading:0,join:false
});
const setup=()=>{const engine=new LiveFloorTrackingEngine();engine.configure(calibration,binding);engine.confirm(true);return engine;};
test('engine notifies subscribers immediately when a real contact or release changes the session',()=>{
 const engine=setup(),updates:FloorUpdate[]=[];
 const unsubscribe=engine.subscribe(u=>updates.push(u));
 assert.equal(engine.ingest(gait(30,'swing'),0,16/9,binding).length,0);
 assert.equal(updates.length,0,'swing without an existing contact does not require repaint');
 const frameStart=performance.now()-20;
 const hit=engine.ingest(gait(120,'stance'),0,16/9,binding,'performer-1',frameStart);
 assert.equal(hit.length,1);
 assert.equal(updates.length,1);
 assert.equal(updates[0].kind,'events');
 assert.equal(updates[0].contactCount,1);
 assert.equal(updates[0].cameraFrameSubmittedAtMs,frameStart);
 assert.equal(updates[0].revision,engine.eventRevision);
 const before=engine.eventRevision;
 engine.ingest(gait(160,'stance',false),0,16/9,binding);
 assert.equal(updates.length,1,'standing still must not stamp again');
 assert.equal(engine.eventRevision,before);
 const release=engine.ingest(gait(310,'swing',false),0,16/9,binding);
 assert.equal(release.length,1);
 assert.equal(release[0].kind,'release');
 assert.equal(updates.length,2);
 assert.equal(updates[1].contactCount,0);
 unsubscribe();
 engine.ingest(gait(480,'stance'),0,16/9,binding);
 assert.equal(updates.length,2,'unsubscribed UI receives no updates');
});
test('renderer is queued on next frame, never redrawn more than once for burst events',()=>{
 let id=0,paints=0,cancels=0;
 const queue=new Map<number,()=>void>();
 const scheduler=new FloorRepaintScheduler(cb=>{queue.set(++id,cb);return id;},n=>{
  cancels++;queue.delete(n);
 },()=>{paints++;});
 scheduler.invalidate();scheduler.invalidate();scheduler.invalidate();
 assert.equal(queue.size,1);assert.equal(paints,0);
 queue.get(1)!();queue.delete(1);
 assert.equal(paints,1);
 scheduler.invalidate();assert.equal(queue.size,1);
 scheduler.dispose();
 assert.equal(cancels,1);assert.equal(paints,1);
 assert.equal(queue.size,0);
 scheduler.invalidate();assert.equal(queue.size,0);
});
test('RAF ID zero is valid, and disposing before the callback prevents stale projection',()=>{
 let pending:(()=>void)|undefined, cancelled:number|null=null,paints=0;
 const scheduler=new FloorRepaintScheduler(cb=>{pending=cb;return 0;},id=>{cancelled=id;},()=>paints++);
 scheduler.invalidate();assert.equal(scheduler.pending,true);
 scheduler.invalidate();
 scheduler.dispose();assert.equal(cancelled,0);
 pending?.();assert.equal(paints,0);
});
test('latency ring only measures monotonic browser spans and labels physical delay unavailable',()=>{
 const tracker=new FloorRealtimeTimingWindow();
 let metrics=tracker.metrics;
 assert.equal(metrics.eventToRasterP95Ms,null);
 assert.equal(metrics.frameSubmitToRasterP95Ms,null);
 const update:FloorUpdate={kind:'events',revision:7,emittedAtMs:100,
  cameraFrameSubmittedAtMs:60,eventCount:1,contactCount:1};
 tracker.observe(update);tracker.painted(114);
 metrics=tracker.metrics;
 assert.equal(metrics.inputSamples,1);assert.equal(metrics.paintSamples,1);
 assert.equal(metrics.eventToRasterP50Ms,14);
 assert.equal(metrics.eventToRasterP95Ms,14);
 assert.equal(metrics.frameSubmitToRasterP95Ms,54);
 tracker.observe({...update,emittedAtMs:200,cameraFrameSubmittedAtMs:250});
 tracker.painted(216); // invalid camera frame time cannot create a negative duration
 assert.equal(tracker.metrics.eventToRasterP95Ms,15.9);
 assert.equal(tracker.metrics.frameSubmitToRasterP95Ms,54);
 assert.match(tracker.metrics.note,/not physical camera-to-photon/i);
 tracker.clear();
 assert.equal(tracker.metrics.inputSamples,0);
 assert.equal(tracker.metrics.eventToRasterP50Ms,null);
});
test('timing ring caps memory even after a fifteen-minute-style burst',()=>{
 const tracker=new FloorRealtimeTimingWindow();
 for(let i=0;i<1000;i++){
  tracker.observe({kind:'events',revision:i,emittedAtMs:i*10,
   cameraFrameSubmittedAtMs:i*10-6,eventCount:1,contactCount:1});
  tracker.painted(i*10+2);
 }
 assert.equal(tracker.metrics.inputSamples,1000);
 assert.equal(tracker.metrics.paintSamples,180);
 assert.equal(tracker.metrics.eventToRasterP95Ms,2);
 assert.equal(tracker.metrics.frameSubmitToRasterP95Ms,8);
});
test('missing camera approval, Hold and Blackout still prohibit transfers after realtime contacts',()=>{
 const model=new ProjectionModel();model.setTransport('live');
 const raw=model.sample(emptyFrame(),'body',16/9,120);
 const blocked=liveFloorArtworkState(raw,false);
 assert.equal(blocked.blank,true);
 assert.equal(shouldTransmitArtwork(blocked),false);
 const ready=liveFloorArtworkState(raw,true);
 assert.equal(ready.blank,false);
 assert.equal(shouldTransmitArtwork(ready),true);
 for(const transport of ['hold','blackout'] as const){
  model.setTransport(transport);
  const state=liveFloorArtworkState(model.sample(emptyFrame(),'body',16/9,250),true);
  assert.equal(shouldTransmitArtwork(state),false);
 }
 const engine=setup();
 const updates:FloorUpdate[]=[];engine.subscribe(v=>updates.push(v));
 engine.ingest(gait(90,'stance'),0,16/9,binding);
 const old=engine.status.contacts;
 engine.checkBinding({...binding,trackId:'changed'});
 assert.equal(engine.isConfirmed,false);
 assert.equal(engine.ingest(gait(310,'stance'),0,16/9,binding).length,0);
 assert.equal(engine.status.contacts,old);
 assert.equal(updates.at(-1)?.kind,'revoke');
});

test('projector bitmap acknowledgement measures transfer processing only, with bounded samples',()=>{
 const a=new ArtworkTransferWindow();
 assert.equal(a.metrics.bitmapAckP95Ms,null);
 assert.equal(a.metrics.samples,0);
 a.markSent(5,100);a.markAck(5,109);
 a.markSent(6,200);a.markAck(6,229);
 assert.equal(a.metrics.bitmapAckMedianMs,19);
 assert.equal(a.metrics.bitmapAckP95Ms,28);
 assert.equal(a.metrics.samples,2);
 assert.match(a.metrics.note,/NOT projector-photon latency/);
 a.markAck(6,400);assert.equal(a.metrics.samples,2,'duplicate ACK must be ignored');
 a.markSent(7,500);a.markFailed(7);a.markAck(7,510);
 assert.equal(a.metrics.samples,2);
 a.markSent(8,610);a.markAck(8,601);
 assert.equal(a.metrics.samples,2,'negative interval must be ignored');
 for(let i=0;i<250;i++){a.markSent(100+i,1000+i*30);a.markAck(100+i,1003+i*30);}
 assert.equal(a.metrics.samples,180);
 a.reset();assert.equal(a.metrics.samples,0);
});
test('the measurement queue discards events shown only in test-marker or revoked calibration mode',()=>{
 const a=new FloorRealtimeTimingWindow();
 a.observe({kind:'events',revision:2,emittedAtMs:100,
  cameraFrameSubmittedAtMs:80,eventCount:1,contactCount:1});
 a.dropPending();
 a.painted(500);
 assert.equal(a.metrics.paintSamples,0);
 assert.equal(a.metrics.eventToRasterP95Ms,null);
 a.observe({kind:'events',revision:3,emittedAtMs:600,
  cameraFrameSubmittedAtMs:585,eventCount:1,contactCount:1});
 a.painted(611);
 assert.equal(a.metrics.eventToRasterP95Ms,11);
 assert.equal(a.metrics.frameSubmitToRasterP95Ms,26);
});
