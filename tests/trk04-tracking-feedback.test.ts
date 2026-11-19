import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveTrackFeedback,liveSkeletonPresentation,visiblePoseFeet} from '../src/studio/v3/trackFeedbackModel.ts';
import type {Landmark,MotionFrame} from '../src/engine/types.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';
import type {ReplayAnalysisSnapshot} from '../src/stage/VideoPoseGaitEngine.ts';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const pose=():Landmark[]=>Array.from({length:33},(_,i)=>({
 x:.40+(i%2)*.08,y:.40+(i%3)*.08,z:0,visibility:.95
}));
const liveFrame=(poses:Landmark[][]):MotionFrame=>({
 source:'camera',time:100,tracked:true,
 pose:poses[0]??[],poses
} as MotionFrame);
const identity=(props:Partial<MultiPoseStatus>={}):MultiPoseStatus=>({
 mode:2,visible:['A','B'],ambiguous:false,reason:'',
 ghostCount:0,poseIndices:{A:0,B:1},observedFrameTime:100,...props
});
const base={
 selection:'webcam' as const,phase:'ready' as const,cameraOn:true,
 frameFresh:true,performerCount:1 as 1|2,
 liveFrame:liveFrame([pose()]),liveIdentity:identity({mode:1}),
 videoSnapshot:null,videoReady:false
};

test('observed ankle, heel and toe landmarks count two image-visible feet',()=>{
 assert.equal(visiblePoseFeet(pose()),2);
 const one=pose();one[31].visibility=.11;
 assert.equal(visiblePoseFeet(one),1);
 const missing=pose();missing[27].x=1.05;missing[28].y=.99;
 assert.equal(visiblePoseFeet(missing),0);
 assert.equal(visiblePoseFeet([]),0);
});

test('Track reports framing without inventing a floor contact',()=>{
 const one=pose();one[31].visibility=.2;
 const status=deriveTrackFeedback({...base,liveFrame:liveFrame([one])});
 assert.equal(status.state,'framing');
 assert.equal(status.visibleFeet,1);
 assert.equal(status.expectedFeet,2);
 assert.equal(status.actors[0].state,'partial');
 assert.match(status.hint??'',/telapak/);
 const ready=deriveTrackFeedback(base);
 assert.equal(ready.state,'ready');
 assert.equal(ready.label,'Kaki terlihat 2/2');
 assert.equal(ready.hint,null);
});

test('camera connected without a fresh tracked frame does not show valid feet',()=>{
 const waiting=deriveTrackFeedback({...base,frameFresh:false});
 assert.equal(waiting.state,'waiting');
 assert.equal(waiting.visibleFeet,0);
 assert.equal(waiting.actors.length,0);
 const idle=deriveTrackFeedback({...base,selection:null});
 assert.equal(idle.state,'idle');
 assert.equal(idle.visibleFeet,0);
});

test('dual A/B landmarks follow stable identity assignments, not pose array order',()=>{
 const a=pose();a[31].visibility=.01;
 const b=pose();
 const status=deriveTrackFeedback({
  ...base,performerCount:2,liveFrame:liveFrame([a,b]),
  liveIdentity:identity({poseIndices:{A:1,B:0}})
 });
 assert.equal(status.state,'framing');
 assert.deepEqual(status.actors.map(actor=>[actor.id,actor.feet]),
  [['A',2],['B',1]]);
});

test('ambiguous or stale A/B associations cannot claim actor feet',()=>{
 const both=liveFrame([pose(),pose()]);
 for(const id of [identity({ambiguous:true}),identity({observedFrameTime:90})]){
  const status=deriveTrackFeedback({
   ...base,performerCount:2,liveFrame:both,liveIdentity:id
  });
  assert.equal(status.state,'uncertain');
  assert.equal(status.visibleFeet,0);
  assert.deepEqual(status.actors.map(a=>a.state),['unstable','unstable']);
 }
});

test('video actor landmarks use named A/B from the analyzed snapshot',()=>{
 const clipPeople=[
  {id:'B' as const,landmarks:pose(),confidence:.9},
  {id:'A' as const,landmarks:pose(),confidence:.9}
 ];
 const snapshot={people:clipPeople,ambiguous:false} as ReplayAnalysisSnapshot;
 const status=deriveTrackFeedback({...base,
  selection:'video',phase:'experiment',videoReady:true,performerCount:2,
  videoSnapshot:snapshot
 });
 assert.equal(status.state,'ready');
 assert.equal(status.visibleFeet,4);
 assert.deepEqual(status.actors.map(a=>a.id),['A','B']);
 const uncertain=deriveTrackFeedback({...base,
  selection:'video',phase:'experiment',videoReady:true,performerCount:2,
  videoSnapshot:{...snapshot,ambiguous:true}
 });
 assert.equal(uncertain.state,'uncertain');
 assert.equal(uncertain.visibleFeet,0);
});

test('one visible performer and missing B give positioning guidance',()=>{
 const onlyA=identity({visible:['A'],poseIndices:{A:0,B:null},observedFrameTime:null});
 const status=deriveTrackFeedback({
  ...base,performerCount:2,
  liveFrame:liveFrame([pose()]),liveIdentity:onlyA
 });
 assert.equal(status.state,'framing');
 assert.equal(status.label,'Aktor 1/2');
 assert.match(status.hint??'',/kedua aktor/);
 assert.equal(status.visibleFeet,0);
});

test('MP4 with only A visible requests both performers before foot evaluation',()=>{
 const snapshot={people:[{id:'A',landmarks:pose(),confidence:.9}],
  ambiguous:false} as ReplayAnalysisSnapshot;
 const status=deriveTrackFeedback({
  ...base,selection:'video',phase:'experiment',
  videoReady:true,videoSnapshot:snapshot,performerCount:2
 });
 assert.equal(status.state,'framing');
 assert.equal(status.label,'Aktor 1/2');
 assert.equal(status.actors[1].state,'missing');
});

test('skeleton stays keyed to A/B when raw pose order switches',()=>{
 const a=pose(),b=pose();
 const ordered=liveSkeletonPresentation(liveFrame([a,b]),identity(),2);
 const swapped=liveSkeletonPresentation(liveFrame([b,a]),
  identity({poseIndices:{A:1,B:0}}),2);
 assert.deepEqual(ordered.poses,[a,b]);
 assert.deepEqual(swapped.poses,[a,b]);
 assert.deepEqual(ordered.colors,['#d4edb3','#88d6e2']);
 const uncertain=liveSkeletonPresentation(liveFrame([b,a]),
  identity({ambiguous:true}),2);
 assert.deepEqual(uncertain.colors,['#aab8ad','#aab8ad']);
});

test('simulator explicitly reports synthetic motion without measured feet',()=>{
 const status=deriveTrackFeedback({...base,
  selection:'simulator',phase:'experiment',performerCount:2
 });
 assert.equal(status.state,'synthetic');
 assert.equal(status.label,'Gerak simulasi');
 assert.equal(status.visibleFeet,0);
 assert.equal(status.expectedFeet,0);
});

test('Track footer reads actual diagnostics, preserves Compose and physical safety',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/trk04-feedback.css');
 assert.match(stage,/const feedback=deriveTrackFeedback\(/);
 assert.match(stage,/liveIdentity:identityStatus/);
 assert.match(stage,/videoReady:canPaintVideoFrame\(selectedExperimentFrame\)/);
 assert.match(stage,/!composerOpen&&!operatorMode\?/);
 assert.match(stage,/className="soma-track-actor-chip" data-state=\{actor.state\}/);
 assert.match(stage,/experimentalKind&&<span className="soma-track-feedback-safety"/);
 assert.match(stage,/aria-pressed=\{skeletonVisible\}/);
 assert.match(stage,/liveSkeletonPresentation\(f,identities,performerCount\)/);
 assert.match(stage,/data-actor=\{actor.id\}/);
 assert.match(css,/data-workspace=track/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/:focus-visible/);
});
