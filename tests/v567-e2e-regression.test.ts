import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFrame,type Landmark} from '../src/engine/types.ts';
import {MultiPoseGaitRouter} from '../src/footprints/live/MultiPoseGaitRouter.ts';
import {LiveFloorTrackingEngine} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {feedLiveFloorInteractions} from '../src/footprints/scenes/interactionAdapters.ts';
import {FootAudioCursor} from '../src/studio/v3/footMotionAudioModel.ts';
import {deriveTrackFeedback} from '../src/studio/v3/trackFeedbackModel.ts';

const pose=(x:number,liftY=.8):Landmark[]=>Array.from({length:33},(_,i)=>({
 x:x+(i%2===0 ? .02 : -.02)+(i>=31 ? .012 : 0),
 y:[27,29,31].includes(i)?liftY:i>=27 ? .8 : i>=25 ? .65 : i>=23 ? .5 : .35,
 z:0,visibility:.95
}));
const setup=()=>{
 const tracker=new LiveFloorTrackingEngine();
 const binding={trackId:'e2e',deviceId:'fixture',width:1280,height:720};
 const calibration:CameraFloorCalibration={schema:'soma.footprints.camera-floor',version:1,floor:defaultFloorSpace(3,2),cameraQuad:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]};
 tracker.configure(calibration,binding);tracker.confirm(true);
 const router=new MultiPoseGaitRouter(tracker);router.setMode(2);
 const bus=new FloorInteractionEngine();bus.reset('camera');
 const audio=new FootAudioCursor();audio.reset(bus.currentSessionId,[]);
 const step=(time:number,poses:Landmark[][])=>{
  const frame={...emptyFrame(),time,tracked:poses.length>0,pose:poses[0]??[],poses};
  router.observePreview(frame);router.observe(frame,time,16/9,binding);
  feedLiveFloorInteractions(bus,{source:'camera',frame,identity:router.status,previewIdentity:router.previewStatus,
   performerCount:2,tracker,cameraMatched:tracker.isConfirmed,videoAspect:16/9,nowMs:time});
  return audio.consume(bus.currentSessionId,bus.canonicalRecent,'step',time);
 };
 return {tracker,router,bus,audio,step};
};
test('pose → identity → adaptive gait → metric floor → canonical event → audio survives missing A',()=>{
 const s=setup();
 for(const t of [1000,1040,1080,1120])s.step(t,[pose(.2),pose(.8)]);
 const before=s.tracker.status.contacts;assert.equal(before,4);
 const actions=[];
 for(const [t,y] of [[1160,.75],[1200,.68],[1240,.8],[1280,.8],[1320,.8]])actions.push(...s.step(t,[pose(.8,y)]));
 assert.equal(s.tracker.status.contacts,before+1);
 assert.deepEqual(s.router.status.visible,['B']);
 const contacts=actions.filter(a=>a.kind==='contact');
 assert.equal(contacts.length,1);assert.equal(contacts[0].event.actorId,'B');
 assert.equal(contacts[0].event.foot,'left');assert.equal(contacts[0].event.atMs,1320);
 assert.equal(s.step(1360,[pose(.8)]).filter(a=>a.kind==='contact').length,0);
});
test('revoked calibration cannot produce new floor or audio contacts',()=>{
 const s=setup();
 for(const t of [1000,1040,1080,1120])s.step(t,[pose(.2),pose(.8)]);
 const before=s.tracker.status.contacts;s.tracker.revoke('fixture disconnected');
 const actions=[];
 for(const [t,y] of [[1160,.75],[1200,.68],[1240,.8],[1280,.8],[1320,.8]])actions.push(...s.step(t,[pose(.8,y)]));
 assert.equal(s.tracker.status.contacts,before);assert.equal(actions.filter(a=>a.kind==='contact').length,0);
});
test('Track feedback reports observed B with two feet even when global torso tracking is false',()=>{
 const s=setup();s.step(1000,[pose(.2),pose(.8)]);s.step(1040,[pose(.8)]);
 const b=pose(.8);
 const feedback=deriveTrackFeedback({selection:'webcam',phase:'ready',cameraOn:true,frameFresh:true,performerCount:2,
  liveFrame:{...emptyFrame(),time:1040,tracked:false,pose:b,poses:[b]},liveIdentity:s.router.previewStatus,videoSnapshot:null,videoReady:false});
 assert.equal(feedback.visibleFeet,2);assert.equal(feedback.actors.find(a=>a.id==='B')?.state,'visible');
 assert.equal(feedback.actors.find(a=>a.id==='A')?.state,'missing');
});
