import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrajectoryInput,type V3InputOptions} from '../src/footprints/lines/v3/SourceFrameNormalizer.ts';
import {adaptFootBrushFrame,type PoseAdapterState} from '../src/footprints/lines/v3/FootBrushPoseAdapter.ts';
import {FootContactGestureEngine} from '../src/footprints/lines/v3/FootContactGestureEngine.ts';
import {buildFootBrushDabs} from '../src/footprints/lines/v3/FootBrushGeometryBuilder.ts';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import type {Landmark,MotionFrame} from '../src/engine/types.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from '../src/studio/v3/experimentSourceModel.ts';
const pose=(x:number):Landmark[]=>{
 const landmarks=Array.from({length:33},()=>({x:.5,y:.5,visibility:1})) as Landmark[];
 for(const offset of [0,1]){
  landmarks[29+offset]={x:x+offset*.14-.015,y:.54,visibility:1};
  landmarks[31+offset]={x:x+offset*.14+.015,y:.46,visibility:1};
  landmarks[27+offset]={x:x+offset*.14,y:.5,visibility:1};
 }
 return landmarks;
};
const status:MultiPoseStatus={mode:2,visible:['A','B'],ambiguous:false,
 reason:'ok',ghostCount:0,poseIndices:{A:0,B:1},observedFrameTime:1000};
const base:V3InputOptions={nowMs:1050,demo:false,demoStart:0,experimentSource:null,
 experiment:null,live:null,cameraOn:true,bodySelected:true,performers:1,
 status,sourceKind:'camera',motionSession:'test'};
function route(input:V3InputOptions){
 const normalized=normalizeTrajectoryInput(input);
 const adapted=adaptFootBrushFrame(normalized.samples,normalized.sourceKey,
  normalized.frameMs);
 return {normalized,adapted};
}
test('webcam and paired phone route through the same FootBrushPoseAdapter',()=>{
 const live={time:1000,source:'camera',tracked:true,pose:pose(.2)} as MotionFrame;
 const webcam=route({...base,live});
 const phone=route({...base,live,sourceKind:'phone'});
 assert.equal(webcam.normalized.source,'camera');
 assert.equal(phone.normalized.source,'phone');
 assert.equal(webcam.adapted.poses.length,2);
 assert.equal(phone.adapted.poses.length,2);
 assert.deepEqual(webcam.adapted.poses.map(p=>[p.foot,p.center,p.headingRad]),
  phone.adapted.poses.map(p=>[p.foot,p.center,p.headingRad]));
 assert.ok(phone.adapted.poses.every(p=>p.provenance==='detected-estimate'));
});
test('MP4 routes through the same adapter with video provenance and pause/seek gates',()=>{
 const video={currentTime:1,readyState:4,seeking:false,paused:false} as HTMLVideoElement;
 const snapshot={segment:0,atMs:1000,ambiguous:false,
  people:[{id:'A',landmarks:pose(.2),confidence:1}]} as
  NonNullable<Extract<ExperimentalFrame,{kind:'video'}>['snapshot']>;
 const frame={kind:'video',snapshot,video,timeMs:1000,ready:true,name:'take'} as ExperimentalFrame;
 const first=route({...base,experimentSource:'video',experiment:frame});
 assert.equal(first.adapted.poses.length,2);
 assert.ok(first.adapted.poses.every(p=>p.provenance==='video-estimate'));
 const paused=normalizeTrajectoryInput({...base,experimentSource:'video',
  experiment:{...frame,video:{...video,paused:true} as HTMLVideoElement} as ExperimentalFrame});
 assert.equal(paused.paused,true);
 const seeking=normalizeTrajectoryInput({...base,experimentSource:'video',
  experiment:{...frame,video:{...video,seeking:true} as HTMLVideoElement} as ExperimentalFrame});
 assert.equal(seeking.seeking,true);assert.equal(seeking.samples.length,0);
});
test('two actors use four distinct actor-foot channels, ambiguity suppresses both',()=>{
 const live={time:1000,source:'camera',tracked:true,pose:pose(.2),
  poses:[pose(.2),pose(.6)]} as MotionFrame;
 const v=route({...base,live,performers:2});
 assert.deepEqual(v.adapted.poses.map(p=>p.actorId+':'+p.foot).sort(),
  ['A:left','A:right','B:left','B:right']);
 assert.equal(route({...base,live,performers:2,
  status:{...status,ambiguous:true}}).adapted.poses.length,0);
});
test('simulator and DEMO supply simulated poses to the same engine',()=>{
 const floor=defaultFloorSpace(8,6);
 const simulator={kind:'simulator',name:'test-3d',timeMs:1000,
  session:{floor},performers:[{id:'A',left:{positionM:{xM:2,yM:3}},
   right:{positionM:{xM:3,yM:3}}}]} as unknown as ExperimentalFrame;
 const sim=route({...base,experimentSource:'simulator',experiment:simulator});
 const demo=route({...base,demo:true,demoStart:0});
 assert.equal(sim.adapted.poses.length,2);assert.equal(demo.adapted.poses.length,2);
 assert.ok([...sim.adapted.poses,...demo.adapted.poses]
  .every(p=>p.provenance==='simulated'));
});
test('camera, phone, video and simulator gesture instances yield same geometry contract',()=>{
 const sourceKinds=['camera','phone','video','simulator'] as const;
 for(const source of sourceKinds){
  const engine=new FootContactGestureEngine();
  const poseAt=(x:number,t:number)=>({
   actorId:'A',foot:'left' as const,sourceKey:'scene',epoch:1,atMs:t,
   coordinateBasis:'image-2d' as const,center:{x,y:.5},
   confidence:.99,provenance:source==='simulator'?'simulated' as const:
    source==='video'?'video-estimate' as const:'detected-estimate' as const
  });
  const fixture=[[1000,.2],[1050,.22],[1100,.25],[1150,.28],[1200,.3],
   [1250,.3],[1300,.3],[1350,.3],[1450,.3]] as const;
  const events=fixture.flatMap(([t,x])=>engine.ingest([poseAt(x,t)]));
  const stamp=events.find(e=>e.kind==='imprint');
  assert.ok(stamp,source+' never stamped');
  assert.equal(buildFootBrushDabs(stamp.from??stamp.pose,stamp.pose,'imprint').length,1);
 }
});
