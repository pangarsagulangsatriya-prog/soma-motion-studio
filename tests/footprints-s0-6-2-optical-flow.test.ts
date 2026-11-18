import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SparseVideoOpticalFlow,OPTICAL_FLOW_MAX_AGE_MS}
 from '../src/stage/footprintsVideoOpticalFlow.ts';
import {ActorMotionStateBuffer} from '../src/stage/actorMotionStateBuffer.ts';
import type {PersistentActorState} from '../src/stage/persistentActorRegistry.ts';
import type {Landmark} from '../src/engine/types.ts';

const W=256,H=144,Y=66;
function pose(cx:number):Landmark[]{
 const x=cx/W;
 const pts:Landmark[]=Array.from({length:33},()=>({
  x,y:.52,z:0,visibility:.96
 }));
 for(const [index,dx,yy] of [
  [11,-.036,.30],[12,.036,.30],[23,-.032,.62],[24,.032,.62],
  [27,-.04,.80],[28,.04,.80],[29,-.04,.86],[30,.04,.86],
  [31,-.04,.87],[32,.04,.87]
 ] as const)pts[index]={x:x+dx,y:yy,z:0,visibility:.96};
 return pts;
}
function registered(id:'A'|'B',cx:number,atMs=1000):PersistentActorState{
 const p=pose(cx);
 return {id,registered:true,observed:true,presence:'visible',rawIndex:id==='A'?0:1,
  lastObservedAtMs:atMs,ageMs:0,lastPose:p,
  center:{x:cx/W,y:.46},velocity:{x:0,y:0},
  box:{x:(cx-13)/W,y:.30,width:26/W,height:.34},
  confidence:.96,observedFrames:4};
}
/** Two separately textured moving torsos; background stays completely still. */
function scene(atMs:number,a:{cx:number}|null,b:{cx:number}|null=null){
 const gray=new Uint8Array(W*H).fill(18);
 for(const [actor,code] of [[a,1],[b,2]] as const){
  if(!actor)continue;
  const cx=Math.round(actor.cx);
  for(let yy=-24;yy<=24;yy++)for(let xx=-14;xx<=14;xx++){
   const x=cx+xx,y=Y+yy;
   if(x<0||x>=W||y<0||y>=H)continue;
   const pattern=(xx*41+yy*29+xx*yy*7+code*37)%173;
   gray[y*W+x]=40+((pattern+173)%173);
  }
 }
 return {atMs,width:W,height:H,gray};
}
const assigned=(id:'A'|'B',cx:number,rawIndex:number)=>({
 id,rawIndex,pose:pose(cx),confidence:.96
});
const tracked=(id:'A'|'B',rawIndex:number|null,atMs:number|null)=>({
 id,presence:rawIndex===null?'occluded':'visible',
 rawIndex,lastSeenAtMs:atMs,confidence:rawIndex===null?0:.96
});

test('S0.6.2: actual grayscale patch tracking moves A and B independently between AI frames',()=>{
 const flow=new SparseVideoOpticalFlow();
 const tracks=[registered('A',62),registered('B',194)];
 flow.ingest(scene(1000,{cx:62},{cx:194}),tracks);
 const f1=flow.ingest(scene(1040,{cx:65},{cx:190}),tracks);
 assert.equal(f1.actors.length,2,f1);
 const a=f1.actors.find(x=>x.id==='A')!,b=f1.actors.find(x=>x.id==='B')!;
 assert.ok(Math.abs(a.dx-3/W)<=1/W,{a});
 assert.ok(Math.abs(b.dx+4/W)<=1/W,{b});
 assert.ok(a.inliers>=4&&b.inliers>=4);
 assert.ok(a.confidence>=.46&&b.confidence>=.46);
 const f2=flow.ingest(scene(1080,{cx:69},{cx:187}),tracks);
 assert.equal(f2.actors.length,2);
 assert.ok(Math.abs(f2.actors.find(x=>x.id==='A')!.dx-7/W)<=1/W);
 assert.ok(Math.abs(f2.actors.find(x=>x.id==='B')!.dx+7/W)<=1/W);
});

test('S0.6.2: BODY applies real image shift and leaves verified gait coordinates untouched',()=>{
 const flow=new SparseVideoOpticalFlow();
 const actors=[registered('A',62),registered('B',194)];
 const buffer=new ActorMotionStateBuffer();
 buffer.ingest({atMs:1000,segment:0,ambiguous:false,
  actorStates:[tracked('A',0,1000),tracked('B',1,1000)],
  rawPoses:[pose(62),pose(194)],persistentActors:actors,
  gait:{},events:[],people:[]});
 flow.ingest(scene(1000,{cx:62},{cx:194}),actors);
 const optical=flow.ingest(scene(1080,{cx:68},{cx:190}),actors);
 const output=buffer.present(1080,optical);
 assert.equal(output.actors.length,2);
 const a=output.actors.find(p=>p.id==='A')!;
 assert.equal(a.mode,'flow');
 assert.ok(a.pose[11].x>pose(62)[11].x+.015);
 assert.ok(Math.abs(a.pose[11].x-pose(68)[11].x)<.012);
 assert.equal(a.lockedFeet?.length,0,'visual flow must not fabricate planted feet');
 assert.equal(buffer.latestAtMs,1000,'no new AI observation from flow');
 assert.ok(!('events' in output),'no gait events from flow');
});

test('S0.6.2: while B is missing, A continues measured, B may move by pixels only',()=>{
 const flow=new SparseVideoOpticalFlow();
 const buffer=new ActorMotionStateBuffer();
 const both=[registered('A',62),registered('B',194)];
 flow.ingest(scene(1000,{cx:62},{cx:194}),both);
 buffer.ingest({atMs:1000,segment:0,rawPoses:[pose(62),pose(194)],
  actorStates:[tracked('A',0,1000),tracked('B',1,1000)],ambiguous:false});
 flow.ingest(scene(1040,{cx:65},{cx:190}),both);
 const partial=[registered('A',68,1080),
  {...registered('B',194),observed:false,presence:'occluded' as const,rawIndex:null,
   ageMs:80}];
 buffer.ingest({atMs:1080,segment:0,rawPoses:[pose(68)],
  actorStates:[tracked('A',0,1080),tracked('B',null,1000)],ambiguous:true});
 const optics=flow.ingest(scene(1080,{cx:68},{cx:187}),partial);
 const result=buffer.present(1080,optics);
 assert.equal(result.actors.length,2);
 assert.equal(result.actors.find(p=>p.id==='A')?.tentative,false);
 assert.equal(result.actors.find(p=>p.id==='B')?.tentative,true);
 assert.ok(result.actors.find(p=>p.id==='B')!.pose[11].x<pose(194)[11].x);
});

test('S0.6.2: disappearing textured target does not keep advancing a phantom track',()=>{
 const flow=new SparseVideoOpticalFlow();
 const tracks=[registered('A',62),registered('B',194)];
 flow.ingest(scene(1000,{cx:62},{cx:194}),tracks);
 const after=flow.ingest(scene(1040,{cx:65},null),tracks);
 assert.ok(after.actors.some(a=>a.id==='A'));
 assert.ok(after.actors.every(a=>a.id!=='B'));
});

test('S0.6.2: no registration, blank video, backwards seek and stale flow are rejected',()=>{
 const flow=new SparseVideoOpticalFlow();
 assert.equal(flow.ingest(scene(1000,{cx:62}),[]).actors.length,0);
 const a=registered('A',62,1000);
 flow.ingest(scene(1040,{cx:62}),[a]);
 assert.equal(flow.ingest(scene(1080,{cx:65}),[a]).actors.length,1);
 // A backwards seek must not continue the old flow or keep the old identity.
 assert.equal(flow.ingest(scene(60,{cx:80}),[a]).actors.length,0);
 flow.reset();
 flow.ingest(scene(1000,{cx:62}),[a]);
 assert.equal(flow.ingest(scene(1200,{cx:64}),[a]).actors.length,0,
  'large frame gap invalidates patches');
 assert.equal(flow.ingest(scene(1000,{cx:62}),[a]).actors.length,1,
  'new observed seed after a true seek is allowed');
});

test('S0.6.2: overlap quarantine prevents assigning both visual tracks to one torso',()=>{
 const flow=new SparseVideoOpticalFlow();
 const near=[registered('A',123),registered('B',136)];
 const seedFrame=scene(1000,{cx:123},{cx:136});
 const seeded=flow.ingest(seedFrame,near);
 assert.equal(seeded.actors.length,0,'near-centers cannot both receive A/B flow');
});

test('S0.6.2: optical flow never extends a measured body beyond bounded loss window',()=>{
 const flow=new SparseVideoOpticalFlow(),buffer=new ActorMotionStateBuffer();
 const a=registered('A',62);
 buffer.ingest({atMs:1000,segment:1,rawPoses:[pose(62)],
  actorStates:[tracked('A',0,1000)],ambiguous:false});
 flow.ingest(scene(1000,{cx:62}),[a]);
 let last=flow.snapshot;
 for(let t=1040;t<=1880;t+=40){
  last=flow.ingest(scene(t,{cx:62+(t-1000)/40}),[a]);
 }
 const display=buffer.present(1880,last);
 assert.equal(display.actors.length,1);
 assert.equal(display.actors[0].mode,'flow');
 assert.equal(display.actors[0].tentative,true);
 assert.equal(display.actors[0].label,'');
 assert.ok(display.actors[0].opacity>0);
 const gone=buffer.present(1000+OPTICAL_FLOW_MAX_AGE_MS+2,last);
 assert.equal(gone.actors.length,0);
});

test('S0.6.2: primary Footprints rAF calls tracker, no separate tool or projector route',()=>{
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const buffer=readFileSync(new URL('../src/stage/actorMotionStateBuffer.ts',import.meta.url),'utf8');
 const engine=readFileSync(new URL('../src/stage/VideoPoseGaitEngine.ts',import.meta.url),'utf8');
 assert.match(stage,/new FootprintsVideoOpticalFlow\(\)/);
 assert.match(stage,/flowTracker\.step\(current\.video,atMs,current\.snapshot\?\.persistentActors\?\?\[\]\)/);
 assert.match(stage,/buffer\.present\(atMs,flow\)/);
 assert.match(stage,/flowTracker\.reset\(\)/);
 assert.match(buffer,/flow\.anchorAtMs===latest\.atMs/);
 assert.match(buffer,/this\.footLock\.apply\(id,pose,videoAtMs\)/);
 assert.match(engine,/new PersistentActorRegistry/);
 assert.doesNotMatch(stage,/opencv\.js|cv\.calcOpticalFlowPyrLK/);
});
