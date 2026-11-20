import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composeSkeletonRect,liveComposeSkeleton,videoComposeSkeleton,
 paintComposeSkeletonMonitor} from '../src/studio/v3/composeSkeletonMonitor.ts';
import type {MotionFrame} from '../src/engine/types.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from '../src/studio/v3/experimentSourceModel.ts';

const pose=Array.from({length:33},(_,i)=>({x:.2+i*.01,y:.3+i*.007,visibility:1}));
const identity:MultiPoseStatus={mode:1,visible:['A'],ambiguous:false,reason:'',
 ghostCount:0,poseIndices:{A:0,B:null},observedFrameTime:1000};

test('SKELETON: measured joints align to the input frame with contain letterboxing',()=>{
 assert.deepEqual(composeSkeletonRect(960,540,768,432),
  {x:0,y:0,width:960,height:540});
 const portrait=composeSkeletonRect(960,540,480,640);
 assert.equal(portrait.height,540);
 assert.equal(portrait.width,405);
 assert.equal(portrait.x,277.5);
 assert.equal(composeSkeletonRect(960,540,0,1080).width,0);
});
test('SKELETON: fresh camera pose visible, stale or disconnected input clears',()=>{
 const live={source:'camera',tracked:true,time:1000,pose,poses:[pose]} as MotionFrame;
 assert.equal(liveComposeSkeleton(live,identity,1,1180,true).poses.length,1);
 assert.equal(liveComposeSkeleton(live,identity,1,1500,true).poses.length,0);
 assert.equal(liveComposeSkeleton(live,identity,1,1180,false).poses.length,0);
 assert.equal(liveComposeSkeleton({...live,source:'simulation'} as unknown as MotionFrame,
  identity,1,1180,true).poses.length,0);
});
test('SKELETON: MP4 samples follow actual playhead and never survive seeks',()=>{
 const snapshot={atMs:1200,rawPoses:[pose],
  actorStates:[{id:'A',presence:'visible',rawIndex:0}],ambiguous:false};
 const video={readyState:4,seeking:false,currentTime:1.2,videoWidth:1280,videoHeight:720};
 const clip={kind:'video',ready:true,snapshot,video} as unknown as ExperimentalFrame;
 assert.equal(videoComposeSkeleton(clip).poses.length,1);
 assert.equal(videoComposeSkeleton({...clip,video:{...video,seeking:true}} as unknown as ExperimentalFrame).poses.length,0);
 assert.equal(videoComposeSkeleton({...clip,video:{...video,currentTime:5}} as unknown as ExperimentalFrame).poses.length,0);
});
test('SKELETON: imported image background never inherits unrelated tracking poses',()=>{
 let drawn=0;
 const ctx={
  save(){},restore(){},setTransform(){},fillRect(){},drawImage(){drawn++;},
  fillStyle:'',globalAlpha:1
 } as unknown as CanvasRenderingContext2D;
 const source={naturalWidth:640,naturalHeight:480} as unknown as HTMLImageElement;
 const result=paintComposeSkeletonMonitor(ctx,960,540,{
  backdrop:'input',input:source,inputFromTrack:false,
  liveFrame:{source:'camera',tracked:true,time:1000,pose,poses:[pose]} as MotionFrame,
  identity,performers:1,nowMs:1100,cameraActive:true,experimentFrame:null
 });
 assert.deepEqual(result,{detected:0,inputReady:true});
 assert.equal(drawn,1);
 const black=paintComposeSkeletonMonitor(ctx,960,540,{
  backdrop:'black',input:source,inputFromTrack:false,
  liveFrame:null,identity,performers:1,nowMs:1100,cameraActive:false,experimentFrame:null
 });
 assert.equal(black.detected,0);
 assert.equal(drawn,1,'black default must not draw the source pixels');
});
test('SKELETON: Compose has explicit black/input switch and no simulated skeleton event test',()=>{
 const src=readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const helper=readFileSync(new URL('../src/studio/v3/composeSkeletonMonitor.ts',import.meta.url),'utf8');
 assert.match(src,/useState<ComposeSkeletonBackdrop>\('black'\)/);
 assert.match(src,/activeView==='SKELETON'/);
 assert.match(src,/paintComposeSkeletonMonitor/);
 assert.match(src,/aria-label="Latar skeleton"/);
 assert.match(src,/onClick=\{\(\)=>setSkeletonBackdrop\('input'\)\}/);
 assert.match(src,/Belum dilacak/);
 assert.match(src,/input:!blackoutRef.current&&previewLiveRef.current\?source:null/);
 assert.match(stage,/experimentFrameRef=\{experimentFrameRef\}/);
 assert.match(helper,/drawSkeletonBodies/);
 assert.match(helper,/if\(!config.inputFromTrack\)return/);
});
