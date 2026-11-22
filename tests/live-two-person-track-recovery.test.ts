import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFrame,type Landmark} from '../src/engine/types.ts';
import {TwoPersonIdentityTracker} from '../src/footprints/live/TwoPersonIdentityTracker.ts';
import {MultiPoseGaitRouter} from '../src/footprints/live/MultiPoseGaitRouter.ts';
import {LiveFloorTrackingEngine} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
import {deriveTrackFeedback,liveSkeletonPresentation} from '../src/studio/v3/trackFeedbackModel.ts';

function pose(x:number,dropShoulder=false):Landmark[]{
 const p:Landmark[]=Array.from({length:33},()=>({x,y:.5,z:0,visibility:.95}));
 for(const i of [11,12])p[i]={x:x+(i===11?-.04:.04),y:.27,z:0,visibility:.95};
 for(const i of [23,24])p[i]={x:x+(i===23?-.025:.025),y:.52,z:0,visibility:.95};
 for(const i of [27,28,29,30,31,32])p[i]={
  x:x+(i%2===0?.022:-.022),y:i>28?.87:.78,z:0,visibility:.95
 };
 if(dropShoulder)p[11].visibility=.08;
 return p;
}
const frame=(poses:Landmark[][],time:number)=>({
 ...emptyFrame(),source:'camera' as const,tracked:poses.length>0,
 time,pose:poses[0]??[],poses
});
const feedback=(f:ReturnType<typeof frame>,router:MultiPoseGaitRouter)=>
 deriveTrackFeedback({selection:'phone',phase:'ready',cameraOn:true,
  frameFresh:true,performerCount:2,liveFrame:f,liveIdentity:router.status,
  videoSnapshot:null,videoReady:false});

test('2P identification works in Track BEFORE camera/floor calibration',()=>{
 const floor=new LiveFloorTrackingEngine(),router=new MultiPoseGaitRouter(floor);
 router.setMode(2);
 const f=frame([pose(.26),pose(.74)],100);
 router.observe(f,100,16/9,null);
 const status=router.status;
 assert.deepEqual(status.visible,['A','B']);
 assert.equal(status.ambiguous,false);
 assert.deepEqual(status.poseIndices,{A:0,B:1});
 assert.equal(status.observedFrameTime,100);
 assert.equal(floor.isConfirmed,false);
 assert.equal(floor.status.events,0,'Track must not create calibrated contacts');
 const output=feedback(f,router);
 assert.equal(output.state,'ready');
 assert.equal(output.visibleFeet,4);
 const skeleton=liveSkeletonPresentation(f,status,2,true);
 assert.deepEqual(skeleton.colors,['#d4edb3','#88d6e2']);
});
test('Head/one shoulder cropped at edge: two distinct hip-centered people still qualify',()=>{
 const detector=new TwoPersonIdentityTracker();
 const result=detector.observe([pose(.20,true),pose(.74)],100);
 assert.equal(result.ambiguous,false);
 assert.equal(result.assignments.length,2);
 assert.deepEqual(result.assignments.map(a=>a.id),['A','B']);
});
test('A alone remains partial while B is missing; no invented B or floor event',()=>{
 const floor=new LiveFloorTrackingEngine(),router=new MultiPoseGaitRouter(floor);
 router.setMode(2);
 const f=frame([pose(.28)],100);
 router.observe(f,100,16/9,null);
 assert.deepEqual(router.status.visible,['A']);
 assert.deepEqual(router.status.poseIndices,{A:0,B:null});
 assert.equal(router.status.observedFrameTime,100);
 const status=feedback(f,router);
 assert.equal(status.state,'framing');
 assert.equal(status.visibleFeet,2);
 assert.match(status.hint??'',/Aktor B belum terbaca/);
 assert.deepEqual(status.actors.map(a=>[a.id,a.state,a.feet]),
  [['A','visible',2],['B','missing',0]]);
 assert.equal(floor.status.events,0);
 const painted=liveSkeletonPresentation(f,router.status,2,true);
 assert.equal(painted.poses.length,1);
 assert.equal(painted.colors[0],'#aab8ad','unverified A/B color stays neutral');
});
test('Second person entering later gets B; alternating raw pose order does not swap',()=>{
 const router=new MultiPoseGaitRouter(new LiveFloorTrackingEngine());
 router.setMode(2);
 router.observe(frame([pose(.25)],100),100,16/9,null);
 router.observe(frame([pose(.27),pose(.74)],166),166,16/9,null);
 const f=frame([pose(.75),pose(.29)],233);
 router.observe(f,233,16/9,null);
 assert.deepEqual(router.status.visible,['A','B']);
 assert.deepEqual(router.status.poseIndices,{A:1,B:0});
 assert.equal(feedback(f,router).state,'ready');
});
test('Crossed close silhouettes suppress identity and contact; cannot label duplicate B',()=>{
 const floor=new LiveFloorTrackingEngine(),router=new MultiPoseGaitRouter(floor);
 router.setMode(2);
 router.observe(frame([pose(.2),pose(.8)],100),100,16/9,null);
 const crossing=frame([pose(.47),pose(.53)],166);
 router.observe(crossing,166,16/9,null);
 assert.equal(router.status.ambiguous,true);
 assert.deepEqual(router.status.visible,[]);
 assert.deepEqual(router.status.poseIndices,{A:null,B:null});
 assert.equal(feedback(crossing,router).state,'uncertain');
 assert.equal(floor.status.events,0);
});
