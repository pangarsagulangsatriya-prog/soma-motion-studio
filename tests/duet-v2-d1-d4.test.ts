import test from 'node:test';
import assert from 'node:assert/strict';
import {DuetIdentityManager,duetBoxIoU,expandedDuetRoi,sampleTorsoColor,
 type DuetPerson} from '../src/stage/duetV2Identity.ts';
import {chooseDuetResolution,summarizeDuetBenchmark,duetBenchmarkCsv}
 from '../src/stage/duetV2Benchmark.ts';
import type {DuetV2Frame} from '../src/stage/duetV2Worker.ts';

const person=(x:number,color:[number,number,number],trackerId:number):DuetPerson=>({
 box:{x,y:.22,width:.18,height:.62},score:.94,color,trackerId
});
const blue:[number,number,number]=[.18,.32,.52];
const brown:[number,number,number]=[.43,.34,.27];
test('D2 preserves A/B after raw detection order changes',()=>{
 const track=new DuetIdentityManager();
 let state=track.observe([person(.15,brown,1),person(.65,blue,2)],1);
 assert.equal(state.observedCount,2);
 assert.equal(state.actors[0].status,'visible');
 state=track.observe([person(.63,blue,2),person(.17,brown,1)],101);
 assert.equal(state.observedCount,2);
 assert.equal(state.actors[0].observedIndex,1);
 assert.equal(state.actors[1].observedIndex,0);
 assert.equal(state.actors[0].trackerId,1);
 assert.equal(state.actors[1].trackerId,2);
});
test('D2 keeps one visible actor active when partner disappears',()=>{
 const track=new DuetIdentityManager();
 track.observe([person(.13,brown,1),person(.7,blue,2)],1);
 const partial=track.observe([person(.15,brown,1)],101);
 assert.equal(partial.observedCount,1);
 assert.equal(partial.actors[0].status,'visible');
 assert.equal(partial.actors[1].status,'occluded');
 assert.equal(partial.actors[1].observed,false);
 assert.equal(partial.actors[1].box?.x,.7);
 for(let at=201;at<=1101;at+=100)
  track.observe([person(.15+(at-101)/12000,brown,1)],at);
 const lost=track.observe([person(.24,brown,1)],1201);
 assert.equal(lost.actors[0].status,'visible');
 assert.equal(lost.actors[1].status,'lost');
});
test('D2 a duplicate box cannot fill two actor slots',()=>{
 const track=new DuetIdentityManager();
 const a=person(.3,brown,1);
 const copy=person(.301,brown,1);
 const frame=track.observe([a,copy],1);
 assert.equal(frame.detectedCount,1);
 assert.equal(frame.observedCount,1);
 assert.equal(frame.actors[1].observed,false);
});
test('D2 boxes, padding and color evidence are bounded and finite',()=>{
 const a={x:.05,y:.01,width:.29,height:.96};
 const region=expandedDuetRoi(a);
 assert.ok(region.x>=0&&region.y>=0);
 assert.ok(region.x+region.width<=1&&region.y+region.height<=1);
 assert.equal(duetBoxIoU(a,a),1);
 assert.equal(duetBoxIoU(a,{x:.6,y:.6,width:.1,height:.1}),0);
 const bytes=new Uint8ClampedArray(32*32*4);
 for(let i=0;i<bytes.length;i+=4){
  bytes[i]=40;bytes[i+1]=75;bytes[i+2]=130;bytes[i+3]=255;
 }
 const pixels={width:32,height:32,data:bytes} as ImageData;
 const color=sampleTorsoColor(pixels,person(.2,blue,1));
 assert.ok(color);
 assert.ok(Math.abs(color![0]-40/255)<.001);
 assert.ok(Math.abs(color![2]-130/255)<.001);
});
test('D2 time monotonicity prevents matching across backward seek',()=>{
 const track=new DuetIdentityManager();
 track.observe([person(.25,blue,1)],100);
 assert.throws(()=>track.observe([person(.26,blue,1)],90),/timestamp/);
 track.reset();
 assert.equal(track.observe([person(.26,blue,1)],90).observedCount,1);
});
function mock(timeMs:number,detected:number,pose33=0):DuetV2Frame{
 return {timeMs,resolution:384,people:Array.from({length:detected},
  (_,i)=>person(.2+i*.4,i?blue:brown,i)),
  keypoints:[],details:Array.from({length:pose33},(_,i)=>({
   actor:(i===0?'A':'B') as 'A'|'B',region:{x:0,y:0,width:1,height:1},
   landmarks:[],worldLandmarks:[],quality:.85,source:'crop33' as const
  })),
  identity:{atMs:timeMs,detectedCount:detected,
   observedCount:detected,ambiguous:false,
   actors:[{id:'A',status:'visible',box:null,score:.94,observed:true,
    observedIndex:0,confidence:.94,lastSeenAtMs:timeMs,reason:'',trackerId:1},
   {id:'B',status:detected>1?'visible':'occluded',box:null,score:.94,
    observed:detected>1,observedIndex:detected>1?1:null,confidence:.94,
    lastSeenAtMs:timeMs,reason:'',trackerId:2}]},
  timings:{detectorMs:20,crop33Ms:pose33?14:0,totalMs:pose33?37:22}
 };
}
test('D1 summary counts observed two-person frames, pose33 and percentile; not ground-truth accuracy',()=>{
 const data=[mock(0,2,2),mock(42,1),mock(83,2,2)];
 const report=summarizeDuetBenchmark(384,data);
 assert.equal(report.frames,3);
 assert.equal(report.twoDetected,2);
 assert.equal(report.twoTracked,2);
 assert.equal(report.twoPose33,2);
 assert.equal(report.totalP95Ms,37);
 assert.match(duetBenchmarkCsv([report]),/resolution,frame,time_ms/);
});
test('D1 resolution selection respects two-person coverage and comparative latency',()=>{
 const fast=summarizeDuetBenchmark(384,[mock(0,2),mock(42,1),mock(83,1)]);
 const precise=summarizeDuetBenchmark(512,[mock(0,2),mock(42,2),mock(83,2)]);
 assert.equal(chooseDuetResolution([fast,precise]).resolution,512);
 assert.equal(chooseDuetResolution([fast]).resolution,null);
});
