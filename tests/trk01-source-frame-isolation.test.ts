import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {activeExperimentKind,currentExperimentFrameForClip,canPaintVideoFrame,
 type ExperimentalFrame} from '../src/studio/v3/experimentSourceModel.ts';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const clipA={name:'scene.mp4'} as File;
const clipB={name:'scene.mp4'} as File;
const decoder=(props:Partial<{readyState:number;videoWidth:number;seeking:boolean}>= {})=>
 ({readyState:2,videoWidth:960,seeking:false,...props} as HTMLVideoElement);
const videoFrame=(clip:File,video=decoder(),ready=true):ExperimentalFrame=>({
 kind:'video',clip,video,ready,snapshot:null,timeMs:0,name:clip.name
});

test('MP4 frame belongs to the same File object, not the same filename',()=>{
 const frame=videoFrame(clipA);
 assert.equal(currentExperimentFrameForClip('video',frame,clipA),frame);
 assert.equal(currentExperimentFrameForClip('video',frame,clipB),null);
 assert.equal(currentExperimentFrameForClip('video',frame,null),null);
 assert.equal(currentExperimentFrameForClip('simulator',frame,clipA),null);
 assert.equal(currentExperimentFrameForClip(null,frame,clipA),null);
});

test('MP4 cannot paint metadata, undecoded media, or a seeking decoder',()=>{
 assert.equal(canPaintVideoFrame(videoFrame(clipA,decoder({readyState:1}))),false);
 assert.equal(canPaintVideoFrame(videoFrame(clipA,decoder({videoWidth:0}))),false);
 assert.equal(canPaintVideoFrame(videoFrame(clipA,decoder({seeking:true}))),false);
 assert.equal(canPaintVideoFrame(videoFrame(clipA,decoder(),false)),false);
 assert.equal(canPaintVideoFrame(videoFrame(clipA)),true);
 assert.equal(canPaintVideoFrame(null),false);
});

test('simulator frame cannot be misclassified as an MP4 image',()=>{
 const frame={kind:'simulator',timeMs:0} as unknown as ExperimentalFrame;
 assert.equal(currentExperimentFrameForClip('simulator',frame,null),frame);
 assert.equal(canPaintVideoFrame(frame),false);
});

test('source transitions clear all three canvases before next paint',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(stage,/useLayoutEffect\(\(\)=>\{[\s\S]*?experimentFrameRef\.current=null;/);
 assert.match(stage,/\[cameraCanvas\.current,bodyCanvas\.current,floorCanvas\.current\]/);
 assert.match(stage,/\[sourceStatus\.selection,experimentClip\]/);
 assert.match(stage,/experimentFrameRef\.current=null;setExperimentFrame\(null\);setExperimentClip\(clip\)/);
 assert.match(stage,/onClip=\{onExperimentClip\}/);
 assert.match(stage,/if\(!canPaintVideoFrame\(current\)\)/);
});

test('live camera only paints the active ready webcam/phone session',()=>{
 const app=read('../src/App.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(app,/op===cameraOperation\.current&&requestedFootprintsChoice\.current==='webcam'/);
 assert.match(app,/op===cameraOperation\.current&&requestedFootprintsChoice\.current==='phone'/);
 assert.match(stage,/sourceStatus\.phase==='ready'/);
 assert.match(stage,/if\(!touchDemo&&cameraSourceReady&&bodySelected\)/);
 assert.match(stage,/const videoAvailable=!!\(cameraSourceReady&&v/);
});

test('unready camera and MP4 overlays completely conceal previous source pixels',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/track-compact.css');
 assert.match(stage,/sourceStatus\.phase!=='ready'/);
 assert.match(stage,/experimentalKind==='video'&&!canPaintVideoFrame\(selectedExperimentFrame\)/);
 assert.match(css,/background:#020403!important;gap:0!important/);
});

test('source switch keeps blackout, tracking reset and distinct source session',()=>{
 const app=read('../src/App.tsx');
 assert.match(app,/async function switchFootprintsSource\(/);
 assert.match(app,/requestedFootprintsChoice\.current=next/);
 assert.match(app,/multiPoseRouter\.reset\(\);setLiveFloorApproval\(null\)/);
 assert.match(app,/stopCamera\(\);\s*clearInputFrame\('body'\)/);
 assert.match(app,/requestStageBlackout\(\(\)=>projection\.setTransport\('blackout'\)\)/);
 assert.equal(activeExperimentKind('webcam'),null);
 assert.equal(activeExperimentKind('video'),'video');
});
