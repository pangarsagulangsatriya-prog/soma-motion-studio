import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {createFloorSession} from '../src/footprints/spatial/events.ts';
import {emptyFrame,defaults,type Landmark} from '../src/engine/types.ts';
import {MotionProcessor} from '../src/engine/motion.ts';
import {footSamplesFromLive,footSamplesFromExperiment}
 from '../src/footprints/lines/FootLineSampleAdapter.ts';
import {deriveTrackFeedback,observedLiveTorso}
 from '../src/studio/v3/trackFeedbackModel.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from '../src/studio/v3/experimentSourceModel.ts';

function person(x:number,confidence=.95):Landmark[]{
 const out:Landmark[]=Array.from({length:33},()=>({x,y:.5,z:0,visibility:confidence}));
 for(const i of [11,12])out[i]={x:x+(i===11?-.04:.04),y:.26,z:0,visibility:confidence};
 for(const i of [23,24])out[i]={x:x+(i===23?-.025:.025),y:.52,z:0,visibility:confidence};
 for(const i of [25,26,27,28,29,30,31,32])
  out[i]={x:x+(i%2===1?-.02:.02),y:i>=29?.87:i>=27?.78:.64,
   z:0,visibility:confidence};
 return out;
}
const ids=(at:number,indices:{A:number|null;B:number|null},ambiguous=false):MultiPoseStatus=>({
 mode:2,visible:(['A','B'] as const).filter(id=>indices[id]!==null),
 ambiguous,reason:'Track',ghostCount:0,poseIndices:indices,observedFrameTime:at
});

test('Webcam/HP share observed 2P identity samples, including partial first pose',()=>{
 const partial=person(.24);partial[11].visibility=.1;
 const f={...emptyFrame(),source:'camera' as const,time:120,tracked:false,
  pose:partial,poses:[partial,person(.75)]};
 assert.equal(observedLiveTorso(f),true);
 const identity=ids(120,{A:0,B:1});
 const hp=footSamplesFromLive(f,identity,2,'phone','HP:1',1,'A');
 const cam=footSamplesFromLive(f,identity,2,'camera','WEB:1',1,'A');
 assert.equal(hp.length,2);
 assert.deepEqual(hp.map(p=>[p.foot,p.x,p.y,p.coordinateBasis]),
  cam.map(p=>[p.foot,p.x,p.y,p.coordinateBasis]));
 assert.ok(hp.every(p=>p.actorId==='A'&&p.source==='phone'));
 assert.ok(cam.every(p=>p.actorId==='A'&&p.source==='camera'));
 const feedback=deriveTrackFeedback({selection:'phone',phase:'ready',cameraOn:true,
  frameFresh:true,performerCount:2,liveFrame:f,liveIdentity:identity,
  videoSnapshot:null,videoReady:false});
 assert.equal(feedback.state,'ready');
 assert.equal(feedback.visibleFeet,4);
});
test('Unmatched or ambiguous A/B never feeds the other person\'s footprint',()=>{
 const f={...emptyFrame(),source:'camera' as const,time:140,tracked:true,
  pose:person(.2),poses:[person(.2),person(.8)]};
 assert.equal(footSamplesFromLive(f,ids(100,{A:0,B:1}),2,'phone','s',0,'A').length,0);
 assert.equal(footSamplesFromLive(f,ids(140,{A:0,B:1},true),2,'camera','s',0,'B').length,0);
 const lost=ids(140,{A:null,B:1});
 assert.equal(footSamplesFromLive(f,lost,2,'phone','s',0,'A').length,0);
 const b=footSamplesFromLive(f,lost,2,'phone','s',0,'B');
 assert.equal(b.length,2);assert.ok(b.every(x=>x.actorId==='B'&&x.x>.7));
});
test('MP4 A lost while B visible: B is never borrowed for A footprint',()=>{
 const video={
  kind:'video' as const,ready:true,name:'walk.mp4',
  timeMs:1000,video:{seeking:false} as HTMLVideoElement,
  snapshot:{atMs:1000,ambiguous:false,people:[
   {id:'B' as const,landmarks:person(.8),confidence:.96}
  ]}
 } as ExperimentalFrame;
 assert.equal(footSamplesFromExperiment(video,'clip:1',0,'A').length,0);
 const b=footSamplesFromExperiment(video,'clip:1',0,'B');
 assert.equal(b.length,2);assert.ok(b.every(x=>x.actorId==='B'&&x.x>.7));
 const stale={...video,timeMs:1650} as ExperimentalFrame;
 assert.equal(footSamplesFromExperiment(stale,'clip:1',0,'B').length,0);
 const seeking={...video,video:{seeking:true} as HTMLVideoElement} as ExperimentalFrame;
 assert.equal(footSamplesFromExperiment(seeking,'clip:1',0,'B').length,0);
});
test('Simulator always marks source synthetic and never invents a missing rig',()=>{
 const floor=defaultFloorSpace();
 const sim={
  kind:'simulator',session:createFloorSession(floor),timeMs:100,
  performers:[{id:'A',left:{positionM:{xM:1,yM:1}},right:{positionM:{xM:2,yM:1}}}],
  name:'Puppet',orbit:{}
 } as unknown as ExperimentalFrame;
 const a=footSamplesFromExperiment(sim,'sim',0,'A');
 const b=footSamplesFromExperiment(sim,'sim',0,'B');
 assert.equal(a.length,2);
 assert.ok(a.every(x=>x.coordinateBasis==='simulated'&&x.source==='simulator'));
 assert.equal(b.length,0);
});
test('MotionProcessor chooses 3D landmark index matching the observed body pose',()=>{
 const bad=person(.2,.2),good=person(.8,.96);
 const low=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:.4}));
 const high=Array.from({length:33},(_,i)=>({
  x:0,y:0,z:i===11||i===12?.45:i===23||i===24?0:0,visibility:.95
 }));
 const settings=defaults();settings.input='body';
 const f=new MotionProcessor().process(null,{
  landmarks:[bad,good],worldLandmarks:[low,high]
 },100,settings,30);
 assert.equal(f.pose[23].x,good[23].x);
 assert.equal(f.tracked,true);
 assert.ok(f.features.bend>.8,'bend computed from corresponding pose index 1');
});
test('Rescued 2P crop missing 3D world pose never crashes camera processing',()=>{
 const poor=person(.24,.2),good=person(.75,.96);
 const settings=defaults();settings.input='body';
 const f=new MotionProcessor().process(null,{
  landmarks:[poor,good],worldLandmarks:[[],[]]
 },100,settings,30);
 assert.equal(f.tracked,true);
 assert.equal(f.pose[23].x,good[23].x);
 assert.ok(Number.isFinite(f.features.bend));
});
test('Cross-source contracts: Track mode reaches camera worker, MP4 and simulator',()=>{
 const root=new URL('../src/',import.meta.url);
 const app=readFileSync(new URL('App.tsx',root),'utf8');
 const stage=readFileSync(new URL('studio/v3/FootprintsStageWorkspace.tsx',root),'utf8');
 const source=readFileSync(new URL('studio/v3/FootprintsExperimentalSource.tsx',root),'utf8');
 const tracker=readFileSync(new URL('engine/tracking.ts',root),'utf8');
 const worker=readFileSync(new URL('engine/poseWorker.ts',root),'utf8');
 const runtime=readFileSync(new URL('../public/workers/soma-pose.js',import.meta.url),'utf8');
 assert.match(app,/tracker\.setPerformerCount\(count\)/);
 assert.match(stage,/performerCount=\{performerCount\}/);
 assert.match(source,/engine\.setPerformers\(performerCount\)/);
 assert.match(source,/createFloorSession\(model\.floor,events\)/);
 assert.match(tracker,/this\.poseWorker\.detect\(video,time,this\.projectionEnabled,this\.performerCount\)/);
 assert.match(worker,/id:\s*number/);
 assert.match(worker,/data\.id!==p\.id/);
 assert.match(runtime,/id:m\.id,landmarks:poses/);
 assert.match(runtime,/RESCUE_SPACING_MS = 390/);
});
