import test from 'node:test';
import assert from 'node:assert/strict';
import {GaitAnalyzer} from '../src/footprints/gait-analysis/index.ts';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {feedLiveFloorInteractions} from '../src/footprints/scenes/interactionAdapters.ts';
import {LiveFloorTrackingEngine} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import {emptyFrame,type MotionFrame} from '../src/engine/types.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';
function frame(time:number,y=.8,x=.25):MotionFrame{
 const pose=Array.from({length:33},(_,i)=>({x:x+(i===31 ? .02 : 0),y:i>=27 ? y : i>=25 ? .65 : i>=23 ? .5 : .35,z:0,visibility:.95}));
 return {...emptyFrame(),time,tracked:true,pose,poses:[pose]};
}
const identity:MultiPoseStatus={mode:1,visible:[],ambiguous:false,reason:'test',ghostCount:0,poseIndices:{A:null,B:null},observedFrameTime:null};
const binding={trackId:'fixture',deviceId:'fixture',width:640,height:480};
function floor(){
 const tracker=new LiveFloorTrackingEngine();
 const calibration:CameraFloorCalibration={schema:'soma.footprints.camera-floor',version:1,floor:defaultFloorSpace(3,2),cameraQuad:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]};
 tracker.configure(calibration,binding);tracker.confirm(true);return tracker;
}
test('stable landing inside cooldown is retained until eligible, then stamped once',()=>{
 const gait=new GaitAnalyzer();
 const sequence=[[1000,.8],[1120,.8],[1160,.68],[1200,.8],[1240,.8],[1350,.8],[1450,.8],[1500,.8]];
 const result=sequence.map(([t,y])=>gait.observe(frame(t,y),0,t,16/9));
 assert.deepEqual(result.filter(s=>s?.stamp).map(s=>s?.t),[1120,1450]);
});
test('presence uses raw 4:3 camera UV without undoing a nonexistent stage fit',()=>{
 const tracker=floor(),engine=new FloorInteractionEngine();engine.reset('camera');
 const f=frame(10000);
 feedLiveFloorInteractions(engine,{source:'camera',frame:f,identity,performerCount:1,tracker,cameraMatched:true,videoAspect:4/3,nowMs:10020});
 const e=engine.recent.find(x=>x.kind==='presence');
 assert.ok(e);assert.ok(Math.abs(e.x-.25)<1e-6);assert.ok(Math.abs(e.y-.8)<1e-6);
});
test('live contacts use capture-domain time and stale history never enters audio bus',()=>{
 const tracker=floor(),engine=new FloorInteractionEngine();engine.reset('phone');
 const stamp=(t:number)=>({x:.25,y:.8,heading:0,side:0 as const,t,join:false,stamp:true,phase:'stance' as const,confidence:.95,relativeSpeed:0});
 tracker.ingest(stamp(10000),0,16/9,binding);
 const feed=(now:number)=>feedLiveFloorInteractions(engine,{source:'phone',frame:frame(now),identity,performerCount:1,tracker,cameraMatched:true,videoAspect:16/9,nowMs:now});
 feed(11000);assert.equal(engine.recent.filter(x=>x.kind==='contact').length,0);
 tracker.ingest({...stamp(11020),stamp:false,phase:'swing'},0,16/9,binding);
 tracker.ingest(stamp(11100),0,16/9,binding);feed(11120);feed(11140);
 const contacts=engine.recent.filter(x=>x.kind==='contact');
 assert.equal(contacts.length,1);assert.equal(contacts[0].atMs,11100);
});
