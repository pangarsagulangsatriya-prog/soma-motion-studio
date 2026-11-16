import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {validateFloorSession} from '../src/footprints/spatial/events.ts';
import {
 initialCamera,initialPerformers,cameraBasis,project3D,unprojectFloor,
 hitFoot,buildLimb,clampOnFloor
} from '../src/footprints/simulator/scene3d.ts';
import {DirectPuppetSession,replayPoseAt} from '../src/footprints/simulator/puppet-controller.ts';
import {floorArtworkSVG,floorArtworkSummary,visibleFootsteps} from '../src/footprints/simulator/floor-artwork.ts';

const floor=defaultFloorSpace(8,6),cam=initialCamera();
const near=(a:number,b:number,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);

test('3D orbit projects grounded points to screen and raycast returns physical metres',()=>{
 for(const yaw of [0,-.55,1.2]){
  const camera={...cam,yawRad:yaw,elevationRad:1.1};
  for(const point of [{xM:1,yM:1},{xM:4,yM:3},{xM:7,yM:5}]){
   const screen=project3D({x:point.xM,y:point.yM,z:0},camera,floor,960,600);
   assert.ok(screen&&screen.depth>0);
   const landed=unprojectFloor(screen,camera,floor,960,600);
   assert.ok(landed);near(landed.xM,point.xM);near(landed.yM,point.yM);
  }
 }
 assert.equal(unprojectFloor({x:NaN,y:2},cam,floor,960,600),null);
 assert.equal(project3D({x:1,y:1,z:0},cam,floor,0,600),null);
 assert.throws(()=>cameraBasis({...cam,distanceM:-1},floor));
});

test('lower body rigs show independent feet, and clicking ankle chooses correct foot',()=>{
 const people=initialPerformers(floor);
 assert.equal(people.length,2);
 for(const p of people){
  const left=buildLimb(p,'left'),right=buildLimb(p,'right');
  assert.ok(left.hip.z>left.knee.z&&left.knee.z>left.ankle.z);
  assert.ok(right.hip.z>right.knee.z&&right.knee.z>right.ankle.z);
  const pt=project3D(left.ankle,cam,floor,960,600);
  assert.ok(pt);
  const hit=hitFoot(pt,people,2,cam,floor,960,600,17);
  assert.deepEqual(hit,{performerId:p.id,foot:'left'});
 }
 assert.deepEqual(clampOnFloor({xM:-2,yM:12},floor),{xM:.12,yM:5.88});
});

test('Direct Puppet: lift -> drag -> land produces one contact, no duplicate while standing',()=>{
 const s=new DirectPuppetSession(floor);
 const key={performerId:'A',foot:'left'} as const;
 assert.equal(s.events.length,0);
 assert.equal(s.lift(key,10),true);
 assert.equal(s.lift(key,11),false);
 assert.equal(s.getFoot(key)?.heightM,.38);
 const point={xM:2.8,yM:2.4};
 assert.equal(s.move(key,point,50),true);
 assert.equal(s.land(key,90),true);
 assert.equal(s.getFoot(key)?.heightM,0);
 assert.equal(s.land(key,91),false);
 assert.equal(s.events.filter(x=>x.kind==='contact').length,1);
 assert.equal(s.events.filter(x=>x.kind==='swing').length>=2,true);
 const contact=s.events.find(x=>x.kind==='contact')!;
 assert.deepEqual(contact.positionM,point);
 assert.equal(contact.positionBasis,'simulated');
 assert.deepEqual(validateFloorSession(JSON.parse(JSON.stringify(s.session))),s.session);
 assert.equal(s.lift(key,120),true);
 assert.equal(s.land(key,130),true);
 assert.equal(s.events.filter(x=>x.kind==='contact').length,2);
 assert.equal(s.events.filter(x=>x.kind==='release').length,1);
});

test('two performers can step independently without mixing contact events',()=>{
 const s=new DirectPuppetSession(floor);
 for(const [performerId,foot,x,y] of [
  ['A','left',2,2],['B','right',6,4],['A','right',3,2]
 ] as const){
  const who={performerId,foot};
  s.lift(who,20);s.move(who,{xM:x,yM:y},40);s.land(who,60);
 }
 assert.equal(s.events.filter(e=>e.kind==='contact').length,3);
 assert.equal(new Set(s.events.filter(e=>e.kind==='contact').map(e=>e.performerId)).size,2);
 const replay=replayPoseAt(floor,s.events,999999);
 near(replay[1].right.positionM.xM,6);near(replay[1].right.positionM.yM,4);
 const saved=s.session;
 const imported=new DirectPuppetSession(floor);
 imported.importSession(saved);
 assert.deepEqual(imported.session,saved);
 imported.lift({performerId:'A',foot:'left'},300);
 imported.land({performerId:'A',foot:'left'},310);
 assert.deepEqual(validateFloorSession(imported.session).floor,floor);
});

test('world-space timeline replay follows foot swing and contact states',()=>{
 const s=new DirectPuppetSession(floor),who={performerId:'A',foot:'left'} as const;
 s.lift(who,15);
 s.move(who,{xM:2.5,yM:3.9},40);
 const atSwing=replayPoseAt(floor,s.events,s.durationMs)[0].left;
 assert.ok(atSwing.heightM>.1);
 assert.ok(Math.abs(atSwing.positionM.yM-3.9)<1e-8);
 s.land(who,90);
 const down=replayPoseAt(floor,s.events,s.durationMs)[0].left;
 assert.equal(down.heightM,0);
 assert.ok(visibleFootsteps(s.session).length===1);
});

test('floor renderer produces 2D vector footprints for two rigs with deterministic output',()=>{
 const s=new DirectPuppetSession(floor);
 for(const who of [{performerId:'A',foot:'left'},{performerId:'B',foot:'right'}] as const){
  s.lift(who,100);s.land(who,140);
 }
 const output=floorArtworkSVG(s.session,{showGrid:false});
 assert.match(output,/<svg/);assert.match(output,/M-.2 .48/);
 assert.match(output,/#E6EBD9/);assert.match(output,/#7FB0CB/);
 assert.equal(output,floorArtworkSVG(s.session,{showGrid:false}));
 const summary=floorArtworkSummary(s.session);
 assert.equal(summary.contacts,2);
 assert.equal(summary.performers,2);
 const cutoff=s.events.find(e=>e.kind==='contact')!.timestampMs-.5;
 assert.equal(visibleFootsteps(s.session,cutoff).length,0);
 assert.equal((floorArtworkSVG(s.session,{showGrid:false,maxTimeMs:cutoff}).match(/M-.2 .48/g)||[]).length,0);
 assert.throws(()=>floorArtworkSVG(s.session,{width:10,height:20}));
});

test('reset and new floor size reinitialize event engine, import rejects invalid session',()=>{
 const s=new DirectPuppetSession(floor);
 s.lift({performerId:'A',foot:'left'},10);
 s.land({performerId:'A',foot:'left'},20);
 assert.ok(s.events.length);
 s.setFloor(defaultFloorSpace(6,4));
 assert.equal(s.events.length,0);
 assert.equal(s.floor.widthM,6);
 const who={performerId:'A',foot:'right'} as const;
 s.lift(who,30);s.land(who,40);
 assert.equal(s.events.filter(e=>e.kind==='contact').length,1);
 assert.throws(()=>s.importSession({version:99}));
});
