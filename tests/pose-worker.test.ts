import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/workers/soma-pose.js',import.meta.url),'utf8');
function harness(fail=false){let resultClosed=0,bitmapClosed=0,clock=0;const messages:any[]=[];const values=new Float32Array([0,1,1,0]);const ctx:any={performance:{now:()=>++clock},OffscreenCanvas:class{},Uint8Array,Math,URL,location:{href:"https://example.test/soma-motion-studio/workers/soma-pose.js"}};ctx.self=ctx;ctx.postMessage=(m:any,t:any)=>messages.push({m,t});ctx.importScripts=()=>{ctx.exports={FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{createFromOptions:async()=>({detectForVideo:()=>{if(fail)throw Error('detector failure');return {landmarks:[[{x:.3,y:.5,z:0}]],worldLandmarks:[],segmentationMasks:[{width:2,height:2,getAsFloat32Array:()=>values}],close:()=>{resultClosed++;values.fill(0);}};}})}};};vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,messages,bitmap:{close:()=>bitmapClosed++},counts:()=>({resultClosed,bitmapClosed})};}
test('classic pose worker copies both masks before closing detector buffers and releases bitmap',async()=>{const h=harness();await h.ctx.onmessage({data:{type:'init'}});assert.equal(h.messages[0].m.type,'ready');await h.ctx.onmessage({data:{type:'frame',bitmap:h.bitmap,time:1000,projection:true}});const result=h.messages[1];assert.equal(result.m.projectionMask.width,256);assert.equal(result.m.segmentation.width,96);assert.ok(result.m.projectionMask.data.some((v:number)=>v===255));assert.equal(result.t.length,2);assert.deepEqual(h.counts(),{resultClosed:1,bitmapClosed:1});});
test('worker omits Projection copy when subscriber is inactive',async()=>{const h=harness();await h.ctx.onmessage({data:{type:'init'}});await h.ctx.onmessage({data:{type:'frame',bitmap:h.bitmap,time:1000,projection:false}});assert.equal(h.messages[1].m.projectionMask,undefined);assert.equal(h.messages[1].t.length,1);});
test('worker reports detector failure and still releases camera bitmap',async()=>{const h=harness(true);await h.ctx.onmessage({data:{type:'init'}});await h.ctx.onmessage({data:{type:'frame',bitmap:h.bitmap,time:1000,projection:true}});assert.equal(h.messages[1].m.type,'error');assert.equal(h.counts().bitmapClosed,1);});

test('2P camera worker rescues independently observed second body from opposite crop',async()=>{
 const messages:any[]=[];
 let bitmapClosed=0,cropCalls=0;
 const person=(x:number)=>Array.from({length:33},(_,i)=>({
  x:x+(i===11||i===23?-.02:i===12||i===24?.02:0),
  y:i===11||i===12?.3:i===23||i===24?.52:.8,z:0,visibility:.94
 }));
 class FakeCanvas{
  width:number;height:number;
  constructor(w:number,h:number){this.width=w;this.height=h;}
  getContext(){return {drawImage(){}};}
  transferToImageBitmap(){return {width:this.width,height:this.height,close(){}};}
 }
 const context:any={
  Math,Number,Promise,Uint8Array,Float32Array,OffscreenCanvas:FakeCanvas,
  URL,performance:{now:()=>1000},
  location:{href:'https://example.test/soma-motion-studio/workers/soma-pose.js'}
 };
 context.self=context;
 context.postMessage=(m:any)=>messages.push(m);
 context.importScripts=()=>{context.exports={
  FilesetResolver:{forVisionTasks:async()=>({})},
  PoseLandmarker:{createFromOptions:async(_files:unknown,options:any)=>
   options.runningMode==='IMAGE'?{
    detect(){cropCalls++;return {landmarks:[person(.45)],worldLandmarks:[],
     close(){}};}
   }:{
    detectForVideo(){return {landmarks:[person(.76)],worldLandmarks:[person(.76)],
     segmentationMasks:[],close(){}};}
   }
 }};
 };
 vm.createContext(context);
 vm.runInContext(source,context);
 await context.onmessage({data:{type:'init'}});
 const bitmap=()=>({width:1280,height:720,close(){bitmapClosed++;}});
 await context.onmessage({data:{type:'frame',bitmap:bitmap(),time:100,projection:false,targetCount:2}});
 await Promise.resolve();await Promise.resolve();
 await context.onmessage({data:{type:'frame',bitmap:bitmap(),time:600,projection:false,targetCount:2}});
 assert.equal(messages.at(-1).type,'result');
 assert.equal(messages.at(-1).landmarks.length,2);
 assert.equal(messages.at(-1).rescuedCount,1);
 assert.ok(cropCalls>0);
 const centers=messages.at(-1).landmarks.map((p:any)=>p[23].x);
 assert.ok(Math.abs(centers[0]-centers[1])>.2,'second performer not a clone of the first');
 assert.equal(bitmapClosed,2);
});
test('1P camera worker never starts extra crop inference',async()=>{
 const h=harness();
 await h.ctx.onmessage({data:{type:'init'}});
 await h.ctx.onmessage({data:{type:'frame',bitmap:h.bitmap,time:100,projection:false,targetCount:1}});
 assert.equal(h.messages[1].m.rescuedCount,0);
 assert.equal(h.messages[1].m.landmarks.length,1);
});

test('worker echoes frame request ID on success and failure, preventing stale cross-frame results',async()=>{
 const good=harness();
 await good.ctx.onmessage({data:{type:'init'}});
 await good.ctx.onmessage({data:{type:'frame',id:71,bitmap:good.bitmap,time:100,projection:false,targetCount:1}});
 assert.equal(good.messages[1].m.id,71);
 assert.equal(good.messages[1].m.type,'result');
 const bad=harness(true);
 await bad.ctx.onmessage({data:{type:'init'}});
 await bad.ctx.onmessage({data:{type:'frame',id:72,bitmap:bad.bitmap,time:100,projection:false,targetCount:2}});
 assert.equal(bad.messages[1].m.id,72);
 assert.equal(bad.messages[1].m.type,'error');
});
