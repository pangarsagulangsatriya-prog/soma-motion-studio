import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 DEFAULT_FULLSCREEN_DIAGNOSTICS,paintFullscreenInputDiagnostics
} from '../src/footprints/lines/FullscreenInputDiagnostics.ts';
import {resolveFullscreenInput} from '../src/footprints/lines/FullscreenInputSource.ts';
import {emptyFrame,type Landmark} from '../src/engine/types.ts';

function mockCanvas(){
 const calls={fill:0,stroke:0,images:0,lines:0,dots:0,labels:[] as string[]};
 const ctx={
  canvas:{width:1600,height:900},globalAlpha:1,fillStyle:'',strokeStyle:'',
  font:'',textBaseline:'',textAlign:'',lineWidth:1,
  save(){},restore(){},setTransform(){},
  fillRect(){calls.fill++;},strokeRect(){calls.stroke++;},
  fillText(s:string){calls.labels.push(s);},
  drawImage(){calls.images++;},beginPath(){},moveTo(){},
  lineTo(){calls.lines++;},stroke(){calls.stroke++;},
  arc(){calls.dots++;},fill(){},clearRect(){}
 } as unknown as CanvasRenderingContext2D;
 return {ctx,calls};
}
const frameSource={image:{} as CanvasImageSource,width:1280,height:720,label:'CAMERA',pose:null};
test('Fullscreen overlay defaults OFF and leaves the single stage canvas untouched',()=>{
 assert.deepEqual(DEFAULT_FULLSCREEN_DIAGNOSTICS,{camera:false,skeleton:false});
 const {ctx,calls}=mockCanvas();
 paintFullscreenInputDiagnostics(ctx,DEFAULT_FULLSCREEN_DIAGNOSTICS,frameSource);
 assert.equal(calls.images,0);
 assert.equal(calls.fill,0);
 assert.equal(calls.stroke,0);
});
test('Opt-in preview draws the decoded camera in an inset, skeleton stays absent',()=>{
 const {ctx,calls}=mockCanvas();
 paintFullscreenInputDiagnostics(ctx,{camera:true,skeleton:false},frameSource);
 assert.equal(calls.images,1);
 assert.equal(calls.dots,0);
 assert.ok(calls.labels.includes('INPUT KAMERA / VIDEO'));
});
test('Skeleton alone uses existing landmark coordinates and no camera pixels',()=>{
 const pose:Landmark[]=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:0}));
 for(const [i,x,y] of [[23,.4,.4],[24,.6,.4],[25,.4,.6],
  [26,.6,.6],[27,.4,.75],[28,.6,.75],[29,.38,.81],[30,.62,.81]]){
  pose[i]={x,y,z:0,visibility:1};
 }
 const {ctx,calls}=mockCanvas();
 paintFullscreenInputDiagnostics(ctx,{camera:false,skeleton:true},{...frameSource,pose});
 assert.equal(calls.images,0);
 assert.ok(calls.lines>=4);
 assert.ok(calls.dots>=5);
});
test('Unavailable input stays explicitly empty and never fabricates skeleton',()=>{
 const {ctx,calls}=mockCanvas();
 paintFullscreenInputDiagnostics(ctx,{camera:true,skeleton:true},
  {image:null,width:0,height:0,label:'NO CAMERA',pose:null});
 assert.equal(calls.images,0);
 assert.equal(calls.dots,0);
 assert.ok(calls.labels.includes('Skeleton belum terbaca'));
});
test('Live input reuses current Track video; stale pose does not linger',()=>{
 const frame={...emptyFrame(),tracked:true,time:1000,source:'camera' as const,
  pose:Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1}))};
 const video={readyState:4,videoWidth:1280,videoHeight:720} as HTMLVideoElement;
 const input={
  videoRef:{current:video},frameRef:{current:frame},
  router:{status:{ambiguous:false,observedFrameTime:1000,poseIndices:{A:0,B:null}}},
  cameraOn:true,experimentSource:null,performerCount:1 as const,
  selectedActor:'A' as const,demo:false
 };
 const live=resolveFullscreenInput(input as Parameters<typeof resolveFullscreenInput>[0],1100);
 assert.equal(live.image,video);
 assert.equal(live.pose?.length,33);
 const stale=resolveFullscreenInput(input as Parameters<typeof resolveFullscreenInput>[0],1600);
 assert.equal(stale.pose,null);
 const off=resolveFullscreenInput({...input,cameraOn:false} as Parameters<typeof resolveFullscreenInput>[0],1100);
 assert.equal(off.image,null);
 assert.equal(off.pose,null);
});
