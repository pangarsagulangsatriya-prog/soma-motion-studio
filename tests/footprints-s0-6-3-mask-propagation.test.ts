import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PersistentBodyMaskEngine,rasterBodyMask,paintIndependentBodyMasks}
 from '../src/stage/persistentBodyMaskEngine.ts';
import {sampleLowerBodyFrame} from '../src/footprints/stage-optics/LowerBodyMaskEngine.ts';
import type {PersistentActorState} from '../src/stage/persistentActorRegistry.ts';
import type {OpticalFlowFrame} from '../src/stage/footprintsVideoOpticalFlow.ts';
import type {Landmark} from '../src/engine/types.ts';

const FRAME=sampleLowerBodyFrame(1000,2);
function pose(id:'A'|'B',offsetX=0):Landmark[]{
 const i=id==='A'?0:1;
 return FRAME.poses![i].map(p=>({...p,x:p.x+offsetX}));
}
function actor(id:'A'|'B',atMs=1000,observed=true,offset=0):PersistentActorState{
 return {id,registered:true,observed,
  presence:observed?'visible':'occluded',rawIndex:observed?(id==='A'?0:1):null,
  lastObservedAtMs:atMs,ageMs:0,lastPose:pose(id,offset),
  center:{x:id==='A'?.29+offset:.72+offset,y:.44},
  velocity:{x:0,y:0},box:null,confidence:.95,observedFrames:5};
}
function frame(atMs:number,states:PersistentActorState[],segment=1){
 return {atMs,segment,persistentActors:states};
}
function flow(atMs:number,actors:Array<{
 id:'A'|'B';anchorAtMs:number;dx:number;dy?:number;confidence?:number
}>):OpticalFlowFrame{
 return {atMs,actors:actors.map(a=>({
  id:a.id,anchorAtMs:a.anchorAtMs,trackedAtMs:atMs,
  dx:a.dx,dy:a.dy??0,confidence:a.confidence??.93,inliers:10
 }))};
}
const lit=(data:Uint8Array)=>data.filter(v=>v>0).length;
const center=(r:{bounds:{minX:number;maxX:number}})=>
 (r.bounds.minX+r.bounds.maxX)/2;

test('S0.6.3 creates two independent alpha masks, each with pelvis, thighs, shins, feet',()=>{
 const mask=new PersistentBodyMaskEngine();
 mask.ingest(frame(1000,[actor('A'),actor('B')]));
 const out=mask.present(1040);
 assert.deepEqual(out.actors.map(a=>a.id),['A','B']);
 assert.equal(out.source,'software-video');
 assert.equal(out.physicalOutputAllowed,false);
 assert.ok(out.actors.every(a=>a.mode==='measured'&&a.alpha>.8));
 assert.ok(out.actors.every(a=>a.polygons.length>=8));
 assert.ok(out.actors.every(a=>a.polygons.every(p=>p.points.length>=3)));
 assert.ok(center(out.actors[0])<center(out.actors[1]));
 const rasterA=rasterBodyMask(out.actors[0],160,90);
 const rasterB=rasterBodyMask(out.actors[1],160,90);
 assert.equal(rasterA.previewOnly,true);
 assert.equal(rasterB.previewOnly,true);
 assert.ok(lit(rasterA.data)>90);
 assert.ok(lit(rasterB.data)>90);
 let overlap=0;for(let i=0;i<rasterA.data.length;i++)
  if(rasterA.data[i]&&rasterB.data[i])overlap++;
 assert.equal(overlap,0,'isolated A/B masks must not merge when separated');
});

test('S0.6.3 B mask propagates by optical flow while A is remeasured independently',()=>{
 const mask=new PersistentBodyMaskEngine();
 mask.ingest(frame(1000,[actor('A'),actor('B')]));
 const before=mask.present(1040);
 const lostB=actor('B',1000,false);
 mask.ingest(frame(1080,[actor('A',1080,true,.025),lostB]));
 const optical=flow(1120,[{id:'B',anchorAtMs:1000,dx:-.048}]);
 const result=mask.present(1120,optical);
 assert.deepEqual(result.actors.map(a=>a.id),['A','B']);
 const a=result.actors[0],b=result.actors[1];
 assert.equal(a.mode,'measured');
 assert.equal(b.mode,'propagated');
 assert.equal(a.sourceAtMs,1080);
 assert.equal(b.sourceAtMs,1000);
 assert.ok(center(a)>center(before.actors[0])+.02);
 assert.ok(center(b)<center(before.actors[1])-.04);
 assert.equal(b.dx,-.048);
 assert.equal(b.tentative,true);
 assert.equal(mask.registeredCount,2);
});

test('S0.6.3 mask remains visible across brief pose dropout, then fades monotonically',()=>{
 const mask=new PersistentBodyMaskEngine();
 mask.ingest(frame(1000,[actor('A'),actor('B')]));
 mask.ingest(frame(1100,[actor('A',1000,false),actor('B',1000,false)]));
 const ages=[1170,1280,1380,1490,1600,1640].map(t=>mask.present(t).actors[0]?.alpha??0);
 assert.ok(ages[0]>.7);
 for(let i=1;i<ages.length;i++)assert.ok(ages[i]<=ages[i-1]+1e-8);
 assert.ok(ages.at(-1)!>0);
 assert.equal(mask.present(1651).actors.length,0);
});

test('S0.6.3 fresh optical evidence extends shape but stale/disappeared flow never keeps ghost forever',()=>{
 const mask=new PersistentBodyMaskEngine();
 mask.ingest(frame(1000,[actor('A'),actor('B')]));
 let out=mask.present(1800,flow(1800,[{id:'A',anchorAtMs:1000,dx:.055},
  {id:'B',anchorAtMs:1000,dx:-.032}]));
 assert.equal(out.actors.length,2);
 assert.ok(out.actors.every(a=>a.mode==='propagated'));
 assert.ok(out.actors.every(a=>a.alpha>0));
 // One late visual frame may reuse an earlier displacement, never reassign IDs.
 out=mask.present(1860);
 assert.equal(out.actors.length,2);
 assert.ok(out.actors.every(a=>a.mode==='propagated'));
 assert.equal(mask.present(1910).actors.length,0);
 assert.equal(mask.present(1981,flow(1981,[{id:'A',anchorAtMs:1000,dx:.07}])).actors.length,0);
});

test('S0.6.3 old flow from A cannot translate B or attach to a newer measured anchor',()=>{
 const mask=new PersistentBodyMaskEngine();
 mask.ingest(frame(1000,[actor('A'),actor('B')]));
 mask.ingest(frame(1080,[actor('A',1080,true,.01),actor('B',1000,false)]));
 const oldFlow=flow(1120,[{id:'A',anchorAtMs:1000,dx:.13},
  {id:'B',anchorAtMs:1000,dx:-.02}]);
 const out=mask.present(1120,oldFlow);
 assert.equal(out.actors[0].mode,'measured');
 assert.equal(out.actors[1].mode,'propagated');
 assert.equal(out.actors[0].dx,0);
 assert.equal(out.actors[1].dx,-.02);
});

test('S0.6.3 overlapping crossing masks quarantine propagated uncertainty per actor',()=>{
 const mask=new PersistentBodyMaskEngine();
 mask.ingest(frame(1000,[actor('A'),actor('B')]));
 // Move B towards freshly observed A: for visual safety, old B's propagated
 // region cannot illuminate space that might now belong to A.
 mask.ingest(frame(1080,[actor('A',1080,true,.16),actor('B',1000,false)]));
 const out=mask.present(1120,flow(1120,[{id:'B',anchorAtMs:1000,dx:-.27}]));
 // .27 exceeds the optical-flow displacement cap; B must hold its old region.
 assert.equal(out.actors.find(a=>a.id==='B')?.mode,'held');
 // A and B remain independent; one invalid B estimate cannot erase A.
 assert.equal(out.actors.find(a=>a.id==='A')?.mode,'measured');
});

test('S0.6.3 source seek and changed playback segment reset independent masks',()=>{
 const mask=new PersistentBodyMaskEngine();
 mask.ingest(frame(1000,[actor('A'),actor('B')],1));
 assert.equal(mask.present(1020).actors.length,2);
 mask.ingest(frame(1100,[actor('A',1000,false),actor('B',1000,false)],1));
 mask.ingest(frame(80,[],2));
 assert.equal(mask.registeredCount,0);
 assert.equal(mask.present(90).actors.length,0);
 mask.ingest(frame(140,[actor('B',140,true)],2));
 assert.deepEqual(mask.present(150).actors.map(a=>a.id),['B']);
 mask.reset();
 assert.equal(mask.present(150).actors.length,0);
});

test('S0.6.3 invalid landmark geometry is ignored without erasing a previous valid mask',()=>{
 const mask=new PersistentBodyMaskEngine();
 mask.ingest(frame(1000,[actor('A')]));
 const bad=actor('A',1080,true);
 bad.lastPose![31].visibility=0;
 mask.ingest(frame(1080,[bad]));
 const out=mask.present(1110);
 assert.equal(out.actors.length,1);
 assert.equal(out.actors[0].sourceAtMs,1000);
 assert.equal(out.actors[0].mode,'held');
});

test('S0.6.3 masks are integrated into the actual BODY/CAMERA rAF, not a separate tool',()=>{
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const painter=readFileSync(new URL('../src/studio/v3/experimentStagePainter.ts',import.meta.url),'utf8');
 const mask=readFileSync(new URL('../src/stage/persistentBodyMaskEngine.ts',import.meta.url),'utf8');
 assert.match(stage,/new PersistentBodyMaskEngine\(\)/);
 assert.match(stage,/maskTracker\.ingest\(/);
 assert.match(stage,/maskTracker\.present\(atMs,flow\)/);
 assert.match(stage,/paintExperimentBody\(body,frame,skeletonVisible,\s*motion,bodyOutput\?\?undefined,true\)/);
 assert.match(stage,/paintExperimentCamera\(cam,frame,skeletonVisible,motion,masks\)/);
 assert.match(stage,/maskTracker\.reset\(\)/);
 assert.match(painter,/paintIndependentBodyMasks\(ctx,masks/);
 assert.match(mask,/physicalOutputAllowed:false/);
 assert.doesNotMatch(stage,/setMaskMode\(|newMaskPanel/);
});
