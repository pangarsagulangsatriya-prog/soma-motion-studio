import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DualFootTrajectoryEngine} from '../src/footprints/lines/v3/DualFootTrajectoryEngine.ts';
import {resolvePoseFeet,type FootV3Sample} from '../src/footprints/lines/v3/FootPositionResolver.ts';
import {normalizeTrajectoryInput} from '../src/footprints/lines/v3/SourceFrameNormalizer.ts';
import type {Landmark} from '../src/engine/types.ts';
import type {ReplayAnalysisSnapshot} from '../src/stage/VideoPoseGaitEngine.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';

const sample=(foot:'left'|'right',x:number,y:number,atMs:number,actorId='A'):FootV3Sample=>({
 sessionId:'take1',generation:0,source:'camera',actorId,foot,x,y,atMs,
 confidence:.97,coordinateBasis:'image-2d',anchor:'heel-toe-center'
});
const pair=(l:number,r:number,time:number,actor='A')=>[
 sample('left',l,.64,time,actor),sample('right',r,.70,time,actor)
];

test('1P generates independent left/right trajectories; stationary right does not grow',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('webcam-A');
 e.ingestFrame(pair(.20,.75,1000),1000,1005);
 e.ingestFrame(pair(.26,.75,1033),1033,1036);
 assert.equal(e.allStrokes.length,2);
 assert.equal(e.allStrokes.find(s=>s.foot==='left')?.points.length,2);
 assert.equal(e.allStrokes.find(s=>s.foot==='right')?.points.length,1);
 e.ingestFrame(pair(.26,.69,1066),1066,1069);
 assert.equal(e.allStrokes.find(s=>s.foot==='right')?.points.length,2);
});

test('2P keeps four separate actor/foot channels and does not splice them',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('two-performers');
 e.ingestFrame([...pair(.2,.4,1000,'A'),...pair(.6,.8,1000,'B')],1000,1001);
 e.ingestFrame([...pair(.23,.44,1033,'A'),...pair(.64,.84,1033,'B')],1033,1035);
 assert.deepEqual(e.allStrokes.map(s=>s.actorId+':'+s.foot).sort(),
 ['A:left','A:right','B:left','B:right']);
 assert.equal(e.allStrokes.every(s=>s.points.length===2),true);
});

test('lost left cuts only left; reacquiring opens a new stroke without teleport',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('camera');
 e.ingestFrame(pair(.2,.7,1000),1000,1002);
 e.ingestFrame(pair(.24,.7,1033),1033,1036);
 e.ingestFrame([sample('right',.72,.7,1066)],1066,1067);
 assert.equal(e.allStrokes.find(s=>s.foot==='left')?.cutReason,'missing-foot');
 e.ingestFrame(pair(.36,.76,1100),1100,1101);
 const left=e.allStrokes.filter(s=>s.foot==='left');
 assert.equal(left.length,2);
 assert.equal(left[1].points.length,1);
 assert.equal(e.allStrokes.filter(s=>s.foot==='right').length,1);
});

test('MP4 duplicate and pause do not add points; seek/backward closes old path',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('video-clip-01');
 e.ingestFrame(pair(.1,.6,1000),1000,1010);
 e.ingestFrame(pair(.2,.6,1040),1040,1050);
 const count=e.sampleCount;
 e.ingestFrame(pair(.7,.3,1040),1040,1100); // paused duplicated frame
 assert.equal(e.sampleCount,count);
 e.ingestFrame(pair(.1,.6,200),200,1200); // seek backward
 assert.equal(e.allStrokes.filter(s=>s.foot==='left').length,2);
 assert.equal(e.allStrokes[0].cutReason,'seek');
 assert.equal(e.allStrokes.at(-2)?.points.length,1);
});

test('source key change clears old clip, preventing A→A cross-source joining',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('clip-01');
 e.ingestFrame(pair(.2,.7,1000),1000,1001);
 e.ingestFrame(pair(.3,.7,1033),1033,1034);
 e.ensureSource('clip-02');
 assert.equal(e.sampleCount,0);
 e.ingestFrame(pair(.8,.2,100),100,200);
 assert.equal(e.allStrokes.length,2);
 assert.equal(e.allStrokes[0].points.length,1);
});

test('heel-toe pivot keeps position while orientation turns around stable ankle',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('pivot');
 const a:FootV3Sample={...sample('left',.41,.61,1000),ankle:{x:.4,y:.57},headingRad:0};
 const b:FootV3Sample={...sample('left',.424,.621,1033),ankle:{x:.401,y:.57},headingRad:.61};
 e.ingestFrame([a],1000,1000);e.ingestFrame([b],1033,1033);
 const left=e.allStrokes.find(s=>s.foot==='left');
 assert.equal(left?.points.length,1); // pivot not drawn as displacement
 assert.equal(e.diagnostics.at(-1)?.accepted,true);
});

test('jump, gap, anchor changes and stale confidence each prevent forged segments',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('gates');
 e.ingestFrame([sample('left',.2,.5,1000)],1000,1000);
 e.ingestFrame([sample('left',.8,.5,1033)],1033,1033);
 assert.equal(e.allStrokes[0].cutReason,'distance-jump');
 e.ingestFrame([sample('left',.82,.5,1500)],1500,1500);
 assert.equal(e.allStrokes[1].cutReason,'time-gap');
 const ankle={...sample('left',.83,.5,1533),anchor:'ankle-fallback' as const};
 e.ingestFrame([ankle],1533,1533);
 assert.equal(e.allStrokes[2].cutReason,'anchor-change');
 e.ingestFrame([{...ankle,atMs:1566,confidence:.4}],1566,1566);
 assert.equal(e.allStrokes[3].cutReason,'low-confidence');
});

test('pose landmarks produce two annotated channels; fallback is explicit',()=>{
 const pose=Array.from({length:33},()=>({x:.5,y:.5,visibility:1})) as Landmark[];
 pose[29]={x:.2,y:.6,visibility:1};pose[31]={x:.3,y:.6,visibility:1};
 pose[30]={x:.7,y:.6,visibility:1};pose[32]={x:.8,y:.6,visibility:1};
 pose[27]={x:.25,y:.55,visibility:1};pose[28]={x:.75,y:.55,visibility:1};
 const meta={sessionId:'s',generation:0,source:'video' as const,
  atMs:1000,actorId:'A',coordinateBasis:'image-2d' as const};
 const s=resolvePoseFeet(pose,meta);
 assert.equal(s.length,2);assert.equal(s[0].anchor,'heel-toe-center');
 assert.equal(s[0].x,.25);assert.deepEqual(s[0].ankle,{x:.25,y:.55});
 pose[31]={x:.3,y:.6,visibility:.2};
 const fallback=resolvePoseFeet(pose,meta);
 assert.equal(fallback[0].anchor,'ankle-fallback');
});

const status:MultiPoseStatus={
 mode:2,visible:['A','B'],ambiguous:false,reason:'ok',ghostCount:0,
 poseIndices:{A:0,B:1},observedFrameTime:1000
};
const blank={
 segment:0,atMs:1000,people:[],ambiguous:false,performers:2,
 sampledFrames:1
} as unknown as ReplayAnalysisSnapshot;
test('MP4 normalizer handles seeking, lag, pause, 2P and isolated clip epochs',()=>{
 const pose=Array.from({length:33},()=>({x:.5,y:.5,visibility:1})) as Landmark[];
 const snapshot={...blank,people:[
  {id:'A',landmarks:pose,confidence:1},{id:'B',landmarks:pose,confidence:1}
 ]} as ReplayAnalysisSnapshot;
 const video={currentTime:1,readyState:4,seeking:false,paused:false} as HTMLVideoElement;
 const frame={kind:'video' as const,snapshot,video,timeMs:1000,ready:true,name:'take01'};
 const input={nowMs:3000,demo:false,demoStart:0,experimentSource:'video' as const,
  experiment:frame,live:null,cameraOn:false,bodySelected:false,
  performers:2 as const,status,sourceKind:'camera' as const,motionSession:'live'};
 const first=normalizeTrajectoryInput(input);
 assert.equal(first.samples.length,4);
 assert.equal(first.ready,true);
 const paused=normalizeTrajectoryInput({...input,experiment:{...frame,
  video:{...video,paused:true} as HTMLVideoElement}});
 assert.equal(paused.paused,true);
 const seeking=normalizeTrajectoryInput({...input,experiment:{...frame,
  video:{...video,seeking:true} as HTMLVideoElement}});
 assert.equal(seeking.seeking,true);assert.equal(seeking.samples.length,0);
 const lag=normalizeTrajectoryInput({...input,experiment:{...frame,
  video:{...video,currentTime:2.5} as HTMLVideoElement}});
 assert.equal(lag.ready,false);assert.match(lag.status,/tertunda/);
 const changed=normalizeTrajectoryInput({...input,experiment:{...frame,
  snapshot:{...snapshot,segment:1}}});
 assert.notEqual(first.sourceKey,changed.sourceKey);
});

test('retained tracks are memory bounded during long simulated streams',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('30-minute-soak');
 for(let i=0;i<7500;i++){
  const t=1000+i*33;
  const samples=[sample('left',.3+.06*Math.sin(i/23),.5,t),
   sample('right',.7+.06*Math.cos(i/29),.6,t)];
  e.ingestFrame(samples,t,t+3);
 }
 assert.ok(e.sampleCount<=e.maxPoints);
 assert.ok(e.allStrokes.length<=e.maxStrokes);
});
