import test from 'node:test';
import assert from 'node:assert/strict';
import {subscribeReplayFrames} from '../src/stage/replayFrameClock.ts';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {feedVideoFloorInteractions} from '../src/footprints/scenes/interactionAdapters.ts';
import {ArtisticFootprintRuntime} from '../src/footprints/scenes/ArtisticFootprintRuntime.ts';

test('REC-01 hidden video watchdog advances, deduplicates, pauses and cancels both clocks',()=>{
 const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
 let serial=0;const frames=new Map<number,FrameRequestCallback>();
 globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};
 globalThis.cancelAnimationFrame=id=>{frames.delete(id);};
 let decoded:VideoFrameRequestCallback|undefined,cancelled=false;
 const video={paused:false,seeking:false,readyState:2,currentTime:0,
  requestVideoFrameCallback(fn:VideoFrameRequestCallback){decoded=fn;return 99;},
  cancelVideoFrameCallback(){cancelled=true;}};
 const calls:number[]=[];
 const tick=(now:number)=>{const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn(now));};
 try{
  const stop=subscribeReplayFrames(video as any,time=>calls.push(time));
  tick(0);video.currentTime=.1;tick(100);tick(110);
  assert.deepEqual(calls,[0,.1]);
  decoded!(120,{mediaTime:.1,presentedFrames:3} as any);
  video.currentTime=.2;tick(150);assert.equal(calls.length,2);
  tick(400);assert.deepEqual(calls,[0,.1,.2]);
  video.paused=true;video.currentTime=.3;tick(600);
  video.paused=false;video.seeking=true;tick(700);
  assert.equal(calls.length,3);
  video.seeking=false;video.currentTime=.05;tick(800);
  assert.equal(calls.at(-1),.05);
  stop();assert.equal(cancelled,true);assert.equal(frames.size,0);
 }finally{globalThis.requestAnimationFrame=oldRaf;globalThis.cancelAnimationFrame=oldCancel;}
});
const sample=(sessionId='clip-1',segment=1,events:any[]=[])=>({
 kind:'video',video:null,ready:true,name:'test',timeMs:1000,
 snapshot:{sessionId,segment,atMs:1000,rawPoses:[],people:[],ambiguous:false,events}
} as any);
const contacts=Array.from({length:6},(_,i)=>({id:'step-'+i,performer:i%2?'B':'A',foot:i%2?'right':'left',
 kind:'contact',atMs:1000,confidence:.9,x:.1+i*.12,y:.6}));
test('REC-01 six verified replay contacts make six marks; repeat frames and ten seconds idle add none',()=>{
 const bus=new FloorInteractionEngine();bus.reset('video');
 const frame=sample('clip-1',1,contacts),art=new ArtisticFootprintRuntime();
 feedVideoFloorInteractions(bus,frame);art.ingest(bus.canonicalRecent,bus.generation);
 assert.equal(bus.snapshot.counts.contact,6);assert.equal(art.contactCount,6);
 for(let ms=1000;ms<=11000;ms+=100){
  feedVideoFloorInteractions(bus,{...frame,timeMs:ms,snapshot:{...frame.snapshot,atMs:ms}});
  art.ingest(bus.canonicalRecent,bus.generation);
 }
 assert.equal(bus.snapshot.counts.contact,6);assert.equal(art.contactCount,6);
});
test('REC-01 seek and retry reset bus before an empty/stale snapshot; new segment is ingested once',()=>{
 const bus=new FloorInteractionEngine();bus.reset('video');
 feedVideoFloorInteractions(bus,sample('clip-1',1,contacts));
 const first=bus.currentSessionId;
 const seeking=sample('clip-1',2);seeking.timeMs=5000;seeking.snapshot.atMs=0;
 feedVideoFloorInteractions(bus,seeking);
 assert.notEqual(bus.currentSessionId,first);assert.equal(bus.snapshot.counts.contact,0);
 feedVideoFloorInteractions(bus,sample('clip-1',2,contacts));
 feedVideoFloorInteractions(bus,sample('clip-1',2,contacts));
 assert.equal(bus.snapshot.counts.contact,6);
 const second=bus.currentSessionId;
 feedVideoFloorInteractions(bus,sample('clip-2',2));
 assert.notEqual(bus.currentSessionId,second);assert.equal(bus.snapshot.counts.contact,0);
});
