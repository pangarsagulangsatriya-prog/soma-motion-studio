import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PersistentActorRegistry} from '../src/stage/persistentActorRegistry.ts';
import {ActorMotionStateBuffer} from '../src/stage/actorMotionStateBuffer.ts';
import {MoveNetIdentityTracker} from '../src/stage/moveNetIdentityTracker.ts';
import {pose33AsD2,d2ToVideoActorFrame} from '../src/stage/mediaPipeD2Bridge.ts';
import type {Landmark} from '../src/engine/types.ts';

const pose=(x:number):Landmark[]=>{
 const p:Landmark[]=Array.from({length:33},(_,i)=>({
  x:x+(i%3)*.002,y:.45+(i%5)*.015,z:0,visibility:.96
 }));
 for(const [i,y,dx] of [[11,.28,-.035],[12,.28,.035],
  [23,.52,-.03],[24,.52,.03],[27,.83,-.02],[28,.83,.02]]){
  p[i]={x:x+dx,y,z:0,visibility:.96};
 }
 return p;
};
const actor=(id:'A'|'B',presence:string,rawIndex:number|null,atMs:number|null)=>({
 id,presence,confidence:presence==='visible'?.96:0,rawIndex,lastSeenAtMs:atMs
});
const assignment=(id:'A'|'B',rawIndex:number,x:number)=>({
 id,rawIndex,pose:pose(x),confidence:.96
});

test('S0.6.1: A survives when B alone disappears, B stays independently updated',()=>{
 const registry=new PersistentActorRegistry();
 registry.observe(1000,[actor('A','visible',0,1000),actor('B','visible',1,1000)],
  [assignment('A',0,.2),assignment('B',1,.8)]);
 const before=registry.snapshot;
 assert.equal(registry.registeredCount,2);
 registry.observe(1100,[actor('A','occluded',null,1000),actor('B','visible',0,1100)],
  [assignment('B',0,.76)]);
 const [a,b]=registry.snapshot;
 assert.equal(a.registered,true);
 assert.equal(a.observed,false);
 assert.equal(a.lastObservedAtMs,1000);
 assert.equal(a.ageMs,100);
 assert.equal(a.lastPose![11].x,before[0].lastPose![11].x);
 assert.equal(b.observed,true);
 assert.equal(b.lastObservedAtMs,1100);
 assert.ok(b.observedFrames>before[1].observedFrames);
 assert.ok(b.center!.x<before[1].center!.x);
});

test('S0.6.1: 2 -> 1 -> 0 -> 2 preserves tracks without inventing measured poses',()=>{
 const registry=new PersistentActorRegistry();
 registry.observe(1000,[actor('A','visible',0,1000),actor('B','visible',1,1000)],
  [assignment('A',0,.23),assignment('B',1,.77)]);
 registry.observe(1100,[actor('A','visible',0,1100),actor('B','lost',null,1000)],
  [assignment('A',0,.26)]);
 registry.observe(1300,[actor('A','occluded',null,1100),actor('B','lost',null,1000)],[]);
 const none=registry.snapshot;
 assert.equal(none.filter(x=>x.registered).length,2);
 assert.equal(none.filter(x=>x.observed).length,0);
 assert.ok(none.every(x=>x.rawIndex===null));
 registry.observe(1700,[actor('A','visible',1,1700),actor('B','reacquiring',null,1000)],
  [assignment('A',1,.38)]);
 assert.equal(registry.snapshot[0].lastObservedAtMs,1700);
 assert.equal(registry.snapshot[1].lastObservedAtMs,1000);
 registry.observe(1850,[actor('A','visible',1,1850),actor('B','visible',0,1850)],
  [assignment('A',1,.41),assignment('B',0,.61)]);
 assert.equal(registry.snapshot[0].observed,true);
 assert.equal(registry.snapshot[1].observed,true);
 assert.equal(registry.snapshot[1].lastObservedAtMs,1850);
 assert.ok(registry.snapshot[0].center!.x<registry.snapshot[1].center!.x);
});

test('S0.6.1: missing pose cannot overwrite the other actor or steal same raw index',()=>{
 const r=new PersistentActorRegistry();
 r.observe(100,[actor('A','visible',0,100),actor('B','visible',1,100)],
  [assignment('A',0,.2),assignment('B',1,.8)]);
 r.observe(200,[actor('A','uncertain',null,100),actor('B','visible',0,200)],
  [assignment('B',0,.74)]);
 assert.equal(r.snapshot[0].observed,false);
 assert.equal(r.snapshot[1].observed,true);
 r.observe(300,[actor('A','visible',0,300),actor('B','visible',0,300)],
  [assignment('A',0,.25),assignment('B',0,.73)]);
 assert.equal(r.snapshot.filter(x=>x.observed).length,1);
 assert.equal(r.snapshot[1].lastObservedAtMs,200);
});

test('S0.6.1: registry history survives long loss but resets on seek/segment',()=>{
 const r=new PersistentActorRegistry();
 r.observe(100,[actor('A','visible',0,100),actor('B','not-detected',null,null)],
  [assignment('A',0,.3)]);
 r.observe(6000,[actor('A','lost',null,100),actor('B','not-detected',null,null)],[]);
 assert.equal(r.registeredCount,1);
 assert.equal(r.snapshot[0].ageMs,5900);
 assert.equal(r.snapshot[0].observed,false);
 r.observe(50,[actor('A','not-detected',null,null),actor('B','not-detected',null,null)],[]);
 assert.equal(r.registeredCount,0);
 assert.equal(r.snapshot[0].lastPose,null);
});

test('S0.6.1: consumers cannot mutate registry stored landmarks',()=>{
 const r=new PersistentActorRegistry();
 r.observe(100,[actor('A','visible',0,100),actor('B','not-detected',null,null)],
  [assignment('A',0,.27)]);
 const snapshot=r.snapshot;
 snapshot[0].lastPose![0].x=.999;
 snapshot[0].center!.x=.999;
 assert.ok(Math.abs(r.snapshot[0].lastPose![0].x-.27)<.01);
 assert.ok(r.snapshot[0].center!.x<.4);
});

test('S0.6.1: BODY buffer accepts visible A during globally ambiguous B recovery',()=>{
 const buf=new ActorMotionStateBuffer();
 const r=new PersistentActorRegistry();
 const both=[actor('A','visible',0,1000),actor('B','visible',1,1000)];
 const frame=(atMs:number,states:typeof both,raw:Landmark[][],assigned:ReturnType<typeof assignment>[],ambiguous:boolean)=>{
  const persisted=r.observe(atMs,states,assigned);
  return {atMs,segment:0,ambiguous,rawPoses:raw,persistentActors:persisted,actorStates:states};
 };
 buf.ingest(frame(1000,both,[pose(.20),pose(.80)],
  [assignment('A',0,.20),assignment('B',1,.80)],false));
 const partial=[actor('A','visible',0,1080),actor('B','reacquiring',null,1000)];
 buf.ingest(frame(1080,partial,[pose(.27)],[assignment('A',0,.27)],true));
 const display=buf.present(1100);
 const a=display.actors.find(x=>x.id==='A')!,b=display.actors.find(x=>x.id==='B')!;
 assert.equal(a.tentative,false);
 assert.equal(a.label,'ACTOR A');
 assert.equal(b.tentative,true);
 assert.equal(b.label,'');
 assert.ok(a.pose[11].x>b.pose[11].x-.7);
 assert.ok(!('events' in display));
});

test('S0.6.1: late-mounted BODY preview rehydrates only fresh historical pose',()=>{
 const r=new PersistentActorRegistry(),b=new ActorMotionStateBuffer();
 r.observe(1000,[actor('A','visible',0,1000),actor('B','not-detected',null,null)],
  [assignment('A',0,.2)]);
 const actors=[actor('A','occluded',null,1000),actor('B','not-detected',null,null)];
 b.ingest({atMs:1220,segment:0,ambiguous:false,rawPoses:[],
  actorStates:actors,persistentActors:r.observe(1220,actors,[])});
 const visual=b.present(1240);
 assert.equal(visual.actors.length,1);
 assert.equal(visual.actors[0].tentative,true);
 assert.ok(Math.abs(visual.actors[0].pose[11].x-.165)<.01);
 const stale=new ActorMotionStateBuffer();
 stale.ingest({atMs:1900,segment:0,ambiguous:false,rawPoses:[],
  actorStates:actors,persistentActors:r.observe(1900,actors,[])});
 assert.equal(stale.present(1900).actors.length,0);
});

test('S0.6.1: primary Footprints pipeline passes D2 verified identities to registry',()=>{
 const engine=readFileSync(new URL('../src/stage/VideoPoseGaitEngine.ts',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/studio/v3/FootprintsExperimentalSource.tsx',import.meta.url),'utf8');
 const buffer=readFileSync(new URL('../src/stage/actorMotionStateBuffer.ts',import.meta.url),'utf8');
 assert.match(engine,/new PersistentActorRegistry/);
 assert.match(engine,/this\.actorRegistry\.observe\(atMs,observed\.actors,observed\.assignments\)/);
 assert.match(engine,/persistentActors:this\.actorRegistry\.snapshot/);
 assert.match(engine,/this\.actorRegistry\.reset\(\)/);
 assert.match(buffer,/frame\.persistentActors\?\.find/);
 assert.doesNotMatch(buffer,/if\(frame\.ambiguous\)\{\s*for\(const bank of this\.actors\.values/);
 assert.match(ui,/snapshot\.persistentActors\?\.find/);
 assert.doesNotMatch(ui,/D1MoveNetBenchmark/);
});

test('S0.6.1 registry follows actual D2 assignments with missing B observed count',()=>{
 const tracker=new MoveNetIdentityTracker();
 const registry=new PersistentActorRegistry();
 const observed=(atMs:number,xs:number[])=>{
  const poses=xs.map(pose);
  const pixels={width:640,height:360,data:new Uint8ClampedArray(640*360*4)} as ImageData;
  const d2=tracker.observeDescriptors(
   poses.map(p=>pose33AsD2(p,640,360)),
   poses.map(()=>null),640,360,atMs,.3);
  const d=d2ToVideoActorFrame(d2,poses);
  return {state:registry.observe(atMs,d.actors,d.assignments),d};
 };
 const first=observed(1000,[.2,.8]);
 assert.equal(first.state.filter(x=>x.observed).length,2);
 const second=observed(1100,[.23]);
 assert.equal(second.d.detectedCount,1);
 assert.equal(second.state.filter(x=>x.registered).length,2);
 assert.ok(second.state.some(x=>x.registered&&!x.observed));
});
