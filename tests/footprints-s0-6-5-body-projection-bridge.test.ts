import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LiveBodyProjectionBridge} from '../src/stage/liveBodyProjectionBridge.ts';
import type {BodyMaskActor,BodyMaskPresentation} from '../src/stage/persistentBodyMaskEngine.ts';
import type {PersistentActorState} from '../src/stage/persistentActorRegistry.ts';
import type {VideoActorState} from '../src/stage/videoAutoActorTracker.ts';

const box=(x:number)=>({minX:x-.05,maxX:x+.05,minY:.25,maxY:.75});
const mask=(id:'A'|'B',x:number,mode:BodyMaskActor['mode']='measured',
 atMs=1000,alpha=.9,tentative=false):BodyMaskActor=>({
 id,mode,sourceAtMs:1000,atMs,ageMs:atMs-1000,alpha,confidence:.95,
 dx:0,dy:0,tentative,bounds:box(x),
 polygons:[{points:[{x:x-.05,y:.3},{x:x+.05,y:.3},{x:x+.05,y:.7}]}] as BodyMaskActor['polygons']
});
const registered=(id:'A'|'B',presence:VideoActorState['presence']='visible',
 observed=true):PersistentActorState=>({
 id,registered:true,observed,presence,rawIndex:observed?(id==='A'?0:1):null,
 lastObservedAtMs:1000,ageMs:0,lastPose:Array.from({length:33},()=>({
  x:id==='A'?.2:.8,y:.5,z:0,visibility:.95})),
 center:{x:id==='A'?.2:.8,y:.5},velocity:{x:0,y:0},
 box:null,confidence:.95,observedFrames:5
});
const state=(id:'A'|'B',presence:VideoActorState['presence']='visible'):VideoActorState=>({
 id,presence,confidence:.95,rawIndex:presence==='visible'?(id==='A'?0:1):null,
 lastSeenAtMs:1000
});
function deliver(bridge:LiveBodyProjectionBridge,atMs:number,
 actors:BodyMaskActor[],states=[state('A'),state('B')],
 registeredActors=[registered('A'),registered('B')],segment=1){
 const masks:BodyMaskPresentation={atMs,actors,source:'software-video',
  physicalOutputAllowed:false};
 return bridge.present({atMs,segment,masks,actorStates:states,
  persistentActors:registeredActors});
}
test('S0.6.5 sends independently measured A/B masks to clean BODY raster',()=>{
 const bridge=new LiveBodyProjectionBridge();
 const result=deliver(bridge,1000,[mask('A',.2),mask('B',.8)]);
 assert.deepEqual(result.actors.map(x=>x.id),['A','B']);
 assert.ok(result.gates.every(g=>g.status==='live'));
 assert.equal(result.physicalOutputAllowed,false);
 assert.equal(result.source,'software-video');
});
test('S0.6.5 blocks only uncertain B while measured A keeps rendering',()=>{
 const bridge=new LiveBodyProjectionBridge();
 const result=deliver(bridge,1000,[mask('A',.2),mask('B',.8)],
  [state('A'),state('B','reacquiring')]);
 assert.deepEqual(result.actors.map(x=>x.id),['A']);
 assert.equal(result.gates.find(g=>g.id==='B')?.status,'blocked');
});
test('S0.6.5 bounded occlusion fades; stale actor disappears',()=>{
 const bridge=new LiveBodyProjectionBridge();
 deliver(bridge,1000,[mask('A',.2),mask('B',.8)]);
 const hold=deliver(bridge,1130,[mask('A',.2,'held',1130,.8,true)],
  [state('A','occluded'),state('B','lost')],
  [registered('A','occluded',false),registered('B','lost',false)]);
 assert.equal(hold.actors.length,1);
 assert.equal(hold.gates[0].status,'held');
 assert.ok(hold.actors[0].alpha<.8);
 const expired=deliver(bridge,1300,[mask('A',.2,'held',1300,.8,true)],
  [state('A','occluded'),state('B','lost')],
  [registered('A','occluded',false),registered('B','lost',false)]);
 assert.equal(expired.actors.length,0);
});
test('BODY flicker regression: verified actor stays bounded through ordinary AI sample gaps',()=>{
 const bridge=new LiveBodyProjectionBridge();
 deliver(bridge,1000,[mask('A',.2),mask('B',.8)]);
 for(const atMs of [1080,1160,1200]){
  const out=deliver(bridge,atMs,[
   mask('A',.2,'held',atMs,.9,true),
   mask('B',.8,'held',atMs,.9,true)
  ]);
  assert.deepEqual(out.actors.map(a=>a.id),['A','B']);
  assert.ok(out.actors.every(a=>a.alpha>0&&!a.tentative));
  assert.ok(out.gates.every(g=>g.status==='held'));
  assert.equal(out.physicalOutputAllowed,false);
 }
 const stale=deliver(bridge,1300,[
  mask('A',.2,'held',1300,.9,true),
  mask('B',.8,'held',1300,.9,true)
 ]);
 assert.equal(stale.actors.length,0);
});
test('BODY flicker regression: optical flow preserves actor identity palette after age 145ms',()=>{
 const bridge=new LiveBodyProjectionBridge();
 deliver(bridge,1000,[mask('A',.2),mask('B',.8)]);
 const out=deliver(bridge,1180,[
  mask('A',.24,'propagated',1180,.75,true),
  mask('B',.76,'propagated',1180,.75,true)
 ]);
 assert.deepEqual(out.actors.map(a=>a.id),['A','B']);
 assert.ok(out.actors.every(a=>!a.tentative));
 assert.ok(out.gates.every(g=>g.status==='continuity'));
});
test('S0.6.5 optical flow accepts only matching actor measurement anchors',()=>{
 const bridge=new LiveBodyProjectionBridge();
 const accepted=deliver(bridge,1080,[mask('A',.28,'propagated',1080,.7,true)]);
 assert.deepEqual(accepted.actors.map(a=>a.id),['A']);
 assert.equal(accepted.gates[0].status,'continuity');
 const bad=mask('A',.35,'propagated',1120,.7,true);
 bad.sourceAtMs=900;
 const rejected=deliver(bridge,1120,[bad]);
 assert.equal(rejected.actors.length,0);
});
test('S0.6.5 crossing cannot blend overlapping A/B output pixels',()=>{
 const bridge=new LiveBodyProjectionBridge();
 const out=deliver(bridge,1000,[mask('A',.48),mask('B',.52)]);
 assert.equal(out.actors.length,0);
 assert.ok(out.gates.every(g=>g.status==='blocked'));
});
test('S0.6.5 segment change clears continuity; rewind blacks the frame',()=>{
 const bridge=new LiveBodyProjectionBridge();
 deliver(bridge,1000,[mask('A',.2)]);
 const seek=deliver(bridge,500,[mask('A',.2,'held',500,.8,true)]);
 assert.equal(seek.actors.length,0);
 assert.ok(seek.gates.every(g=>g.status==='blocked'));
 const newSegment=deliver(bridge,1000,[mask('A',.2)],undefined,undefined,2);
 assert.equal(newSegment.actors.length,1);
});
test('S0.6.5 connects main BODY rAF and rejects unassigned raw diagnostic poses',()=>{
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const painter=readFileSync(new URL('../src/studio/v3/experimentStagePainter.ts',import.meta.url),'utf8');
 const projection=readFileSync(new URL('../src/projection/useProjection.ts',import.meta.url),'utf8');
 assert.match(stage,/new LiveBodyProjectionBridge\(\)/);
 assert.match(stage,/bodyBridge\.present\(/);
 assert.match(stage,/paintExperimentBody\(body,frame,skeletonVisible,\s*motion,bodyOutput\?\?undefined,true\)/);
 assert.match(painter,/if\(cleanBodyOutput\)/);
 // The measured 33-joint diagnostic must not go black when a geometrical
 // silhouette is unavailable, while silhouette mode still uses A/B mask gates.
 assert.match(painter,/if\(skeleton\)\{/);
 assert.match(painter,/drawBufferedBodies\(ctx,rect,motion,frame\)/);
 assert.match(painter,/if\(masks\?\.actors\.length\)/);
 assert.match(projection,/physicalOutputPermitted\(latest\.current\.sourceChoice\)/);
});
