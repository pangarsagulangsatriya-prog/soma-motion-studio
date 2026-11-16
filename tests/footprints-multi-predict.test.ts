import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFrame,type Landmark} from '../src/engine/types.ts';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import {createFloorSession,type FootstepEvent} from '../src/footprints/spatial/events.ts';
import {TwoPersonIdentityTracker} from '../src/footprints/live/TwoPersonIdentityTracker.ts';
import {GhostFootstepPredictor} from '../src/footprints/live/GhostFootstepPredictor.ts';
import {LiveFloorTrackingEngine,type CameraBinding} from '../src/footprints/live/LiveFloorTrackingEngine.ts';
import {MultiPoseGaitRouter} from '../src/footprints/live/MultiPoseGaitRouter.ts';
import {floorArtworkSVG} from '../src/footprints/simulator/floor-artwork.ts';
const floor=defaultFloorSpace(8,6);
const camera:CameraBinding={trackId:'multi-track',deviceId:'camera-a',width:1280,height:720};
const calibration:CameraFloorCalibration={
 schema:'soma.footprints.camera-floor',version:1,floor,
 cameraQuad:[{x:.02,y:.02},{x:.98,y:.02},{x:.98,y:.98},{x:.02,y:.98}]
};
const p=(x:number,y=.5):Landmark[]=>{
 const pose=Array.from({length:33},()=>({x,y,z:0,visibility:1}));
 pose[23]={x:x-.025,y:.52,z:0,visibility:1};
 pose[24]={x:x+.025,y:.52,z:0,visibility:1};
 pose[11]={x:x-.04,y:.28,z:0,visibility:1};
 pose[12]={x:x+.04,y:.28,z:0,visibility:1};
 for(const i of [27,28,29,30,31,32])pose[i]={x:x+(i%2?-.015:.015),y:.82,z:0,visibility:1};
 return pose;
};
const setup=()=>{
 const e=new LiveFloorTrackingEngine();e.configure(calibration,camera);e.confirm(true);return e;
};
const sample=(side:0|1,t:number,x:number,phase:'stance'|'swing'='stance')=>({
 x,y:.5,side,t,phase,stamp:phase==='stance',heading:0,confidence:.92,
 relativeSpeed:0,join:false
});
const contact=(id:string,foot:'left'|'right',x:number,y:number,time:number):FootstepEvent=>({
 id:'c'+id+foot+time,performerId:id,foot,kind:'contact',timestampMs:time,
 positionM:{xM:x,yM:y},headingRad:Math.PI/2,
 source:'camera',positionBasis:'calibrated-estimate',confidence:.9
});

test('existing MediaPipe two poses retain A/B identity when detection order changes',()=>{
 const ids=new TwoPersonIdentityTracker();
 let v=ids.observe([p(.28),p(.73)],100);
 assert.deepEqual(v.assignments.map(x=>x.id),['A','B']);
 v=ids.observe([p(.74),p(.29)],200); // provider order reversed
 assert.equal(v.ambiguous,false);
 assert.deepEqual(new Map(v.assignments.map(x=>[x.id,x.center.x])),new Map([['A',.29],['B',.74]]));
 v=ids.observe([p(.48),p(.54)],230);
 assert.equal(v.ambiguous,true);
 assert.equal(v.assignments.length,0);
 assert.ok(v.lost.includes('A')&&v.lost.includes('B'));
 const after=v=ids.observe([p(.29),p(.74)],300);
 assert.equal(after.assignments.length,0); // never auto-swap after occlusion
 assert.match(after.reason,/reset identitas/i);
 ids.reset();
 assert.deepEqual(ids.observe([p(.29),p(.74)],400).assignments.map(a=>a.id),['A','B']);
});

test('one missing performer keeps other identity; distant re-entry requires explicit reset',()=>{
 const ids=new TwoPersonIdentityTracker();
 ids.observe([p(.2),p(.8)],20);
 const v=ids.observe([p(.82)],70);
 assert.deepEqual(v.assignments.map(x=>x.id),['B']);
 assert.ok(v.lost.includes('A'));
 const far=ids.observe([p(.45)],900);
 assert.equal(far.assignments.length,0);
 ids.reset();
 assert.equal(ids.observe([p(.45)],950).assignments[0].id,'A');
});

test('separate A and B tracks can produce contacts at same time without mixing soles',()=>{
 const floorEngine=setup();
 const first=floorEngine.ingest(sample(0,110,.3),0,16/9,camera,'A');
 const second=floorEngine.ingest(sample(1,110,.7),1,16/9,camera,'B');
 assert.equal(first.length,1);assert.equal(second.length,1);
 assert.equal(first[0].performerId,'A');assert.equal(second[0].performerId,'B');
 assert.equal(first[0].foot,'left');assert.equal(second[0].foot,'right');
 const saved=floorEngine.session!;
 assert.equal(saved.events.length,2);
 assert.notEqual(saved.events[0].id,saved.events[1].id);
 assert.ok(saved.events[0].timestampMs<saved.events[1].timestampMs);
 floorEngine.losePerformer('A');
 const suppressed=floorEngine.ingest(sample(0,130,.3),0,16/9,camera,'A');
 assert.equal(suppressed.length,0);
 assert.equal(floorEngine.status.activePerformerIds.includes('B'),true);
});

test('independent multi-pose gait analyzers use same camera frame without extra tracker',()=>{
 const engine=setup(),router=new MultiPoseGaitRouter(engine);
 router.setMode(2);
 for(const [t,poses] of [[0,[p(.28),p(.72)]],[80,[p(.73),p(.29)]],[160,[p(.3),p(.74)]]] as const){
  const frame={...emptyFrame(),source:'camera' as const,tracked:true,time:t,
   pose:poses[0],poses};
  router.observe(frame,t,16/9,camera);
 }
 assert.deepEqual(router.status.visible,['A','B']);
 const events=engine.session?.events??[];
 assert.ok(events.some(e=>e.performerId==='A'&&e.kind==='contact'));
 assert.ok(events.some(e=>e.performerId==='B'&&e.kind==='contact'));
 const old=events.length;
 router.observe({...emptyFrame(),source:'camera',time:260,tracked:true,pose:p(.5),
  poses:[p(.47),p(.53)]},260,16/9,camera);
 assert.equal(router.status.ambiguous,true);
 assert.equal(engine.session?.events.length,old);
 router.observe(null,310,16/9,camera);
 assert.equal(router.status.visible.length,0);
});

test('ghost prediction appears only after contact history and swing, stays low confidence and expires',()=>{
 const predictor=new GhostFootstepPredictor(floor);
 const l=contact('A','left',2,2,100),r=contact('A','right',2.35,2.45,250);
 predictor.accept([l]);
 assert.equal(predictor.swing('A','right',260,.9),null);
 predictor.accept([r]);
 const ghost=predictor.swing('A','left',320,.9);
 assert.ok(ghost);
 assert.equal(ghost.kind,'prediction');
 assert.equal(ghost.foot,'left');
 assert.ok(ghost.confidence<=.38);
 assert.ok(ghost.positionM.xM>r.positionM.xM);
 assert.equal(predictor.get(350).length,1);
 assert.equal(predictor.get(800).length,0);
 const before=createFloorSession(floor,[l,r]);
 assert.equal(before.events.length,2);
 predictor.accept([contact('A','left',2.65,2.85,850)]);
 assert.equal(predictor.get(860).length,0);
});

test('ghost never prints a filled sole and is not treated as a contact in exported JSON',()=>{
 const l=contact('A','left',2,2,100),r=contact('A','right',2.35,2.45,240);
 const predictor=new GhostFootstepPredictor(floor);predictor.accept([l,r]);
 const ghost=predictor.swing('A','left',280,.9);
 assert.ok(ghost);
 const saved=createFloorSession(floor,[l,r]);
 assert.equal(saved.events.length,2);
 assert.ok(!JSON.stringify(saved).includes('prediction'));
 const preview=createFloorSession(floor,[...saved.events,ghost]);
 const svg=floorArtworkSVG(preview,{showGrid:false});
 assert.match(svg,/stroke-dasharray/);
 assert.equal((svg.match(/<path d="M/g)||[]).length,2);
 assert.equal(saved.events.filter(e=>e.kind==='contact').length,2);
});
