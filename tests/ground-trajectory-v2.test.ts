import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GroundTrajectoryEngineV2} from '../src/footprints/lines/v3/GroundTrajectoryEngineV2.ts';
import {PathObservationRouter} from '../src/footprints/lines/v3/PathObservationRouter.ts';
import {ActorPathTracker} from '../src/footprints/lines/v3/ActorPathTracker.ts';
import {accumulateSmallMovement,estimateAmbiguousCenterMovement} from '../src/footprints/lines/v3/TrajectoryFusion.ts';
import type {FootBrushPose} from '../src/footprints/lines/v3/FootBrushPoseAdapter.ts';
const source='video:continuity:0:2';
function pose(actorId:string,foot:'left'|'right',x:number,y:number,time:number,sourceKey=source):FootBrushPose{
 return {actorId,foot,center:{x,y},atMs:time,sourceKey,epoch:0,
  confidence:.96,coordinateBasis:'image-2d',provenance:'video-estimate'};
}
function pair(t:number,center:number,stride=0,src=source):FootBrushPose[]{
 return [pose('A','left',center-.011+stride,.33,t,src),
  pose('A','right',center+.011-stride,.33,t,src),
  pose('B','left',1-center-.011-stride,.66,t,src),
  pose('B','right',1-center+.011+stride,.66,t,src)];
}
test('V2.1 fusion preserves coherent subpixel translation while cancelling jitter',()=>{
 let residual={x:0,y:0},sum=0;
 for(let i=0;i<24;i++){
  const v=accumulateSmallMovement({x:.8,y:0},residual,1.2);
  residual=v.residual;sum+=v.delta.x;
 }
 assert.ok(sum>=18,'repeated 0.8 px steps cannot vanish behind dead zone');
 const opposite=estimateAmbiguousCenterMovement({x:0,y:.5},{x:18,y:2},{x:-18,y:-2},50);
 assert.ok(Math.hypot(opposite.x,opposite.y)<1,'pivot without center translation stays still');
});
test('V2.1 shared trajectory produces two paths from ambiguous lateral travel',()=>{
 const engine=new GroundTrajectoryEngineV2();let pathEvents=[] as string[];
 for(let k=0;k<48;k++){
  const t=1000+k*40,center=.2+k*.0012;
  const poses=pair(t,center,k%2===0?.008:-.008);
  const {events}=engine.ingest(source,t,poses);
  pathEvents.push(...events.map(x=>x.actorId+':'+x.kind));
 }
 const stats=engine.telemetry.snapshot();
 assert.ok(stats.byActor.A.emitted.ADD+stats.byActor.A.emitted.TURN>=5);
 assert.ok(stats.byActor.B.emitted.ADD+stats.byActor.B.emitted.TURN>=5);
 assert.equal(stats.byActor.A.emitted.CUT,0);
 assert.equal(stats.byActor.B.emitted.CUT,0);
 assert.ok(stats.byActor.A.pathLengthPx>20);
 assert.ok(stats.byActor.B.pathLengthPx>20);
 assert.ok(pathEvents.includes('A:START')&&pathEvents.includes('B:START'));
});
test('V2.1 stationary pose has at most one STOP per actor and no repeated ADD',()=>{
 const engine=new GroundTrajectoryEngineV2();
 let all=[] as string[];
 engine.ingest(source,1000,pair(1000,.2));
 engine.ingest(source,1100,pair(1100,.24));
 for(let k=0;k<50;k++){
  const ms=1200+k*40;
  const x=.24+(k%2===0?.000018:-.000018);
  const {events}=engine.ingest(source,ms,pair(ms,x));
  all.push(...events.map(e=>e.kind));
 }
 assert.equal(all.filter(x=>x==='STOP').length<=2);
 assert.equal(all.filter(x=>x==='CUT').length,0);
 assert.ok(all.filter(x=>x==='ADD'||x==='TURN').length<=4);
});
test('V2.1 crossing and large actor jump never draw an unsupported bridge',()=>{
 const eng=new GroundTrajectoryEngineV2();
 eng.ingest(source,1000,pair(1000,.2));
 eng.ingest(source,1100,pair(1100,.22));
 const moved=eng.ingest(source,1200,pair(1200,.8));
 assert.ok(moved.events.some(e=>e.kind==='CUT'));
 assert.ok(!moved.events.some(e=>e.kind==='ADD'||e.kind==='TURN'));
});
test('V2.1 retains one event flow and telemetry for Path Sumi and Dual Trace',()=>{
 for(const label of ['path-sumi','dual-trace']){
  const engine=new GroundTrajectoryEngineV2();
  for(let k=0;k<30;k++)engine.ingest(source,1000+k*50,pair(1000+k*50,.2+k*.002));
  const s=engine.telemetry.snapshot();
  assert.equal(s.validPoseFrames,30,label);
  assert.equal(s.groundObservations,60,label);
  assert.ok(s.byActor.A.emitted.ADD+s.byActor.A.emitted.TURN>0,label);
  assert.ok(s.byActor.B.emitted.ADD+s.byActor.B.emitted.TURN>0,label);
  const before=s.byActor.A.emitted.CUT;
  const cuts=engine.cutAll('seek');
  assert.equal(cuts.length,2);
  assert.equal(engine.telemetry.snapshot().byActor.A.emitted.CUT,before+1);
  assert.equal(engine.telemetry.snapshot().cutReasons.seek,2);
 }
});
test('V2.1 low-confidence, one-foot, source change and time reversal are safe',()=>{
 const r=new PathObservationRouter(),tracker=new ActorPathTracker();
 const t=1000;tracker.ingest(r.ingest(pair(t,.2)),t);
 const low=pose('A','left',.9,.4,1100);low.confidence=.1;
 assert.equal(r.ingest([low]).length,0);
 const one=r.ingest([pose('A','left',.205,.33,1150)]);
 assert.equal(one.length,1);assert.ok(one[0].point.x<410);
 const switched=tracker.ingest(r.ingest(pair(1200,.3,0,'track:camera:new:2')),1200);
 assert.ok(switched.some(e=>e.kind==='CUT'));
 const reversed=tracker.ingest(r.ingest(pair(900,.31,0,'track:camera:new:2')),900);
 assert.ok(reversed.every(e=>e.kind!=='ADD'));
});
test('V2.1 Path and Footprints remain independent in the V2 renderer contract',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync('src/footprints/dual-trace/DualTraceV2Renderer.ts','utf8');
 assert.match(code,/readonly path=\{A:new PersistentPathStore\(\),B:new PersistentPathStore\(\)\}/);
 assert.match(code,/footprintMask=\{A:blank\(\),B:blank\(\)\}/);
 assert.match(code,/clamp\(opts\.pathOpacity\?\?\.95,0,1\)/);
 assert.match(code,/clamp\(opts\.upperOpacity\?\?\.35,0,1\)/);
});
