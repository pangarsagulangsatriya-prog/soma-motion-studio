import test from 'node:test';
import assert from 'node:assert/strict';
import {
 defaultFloorSpace,validateFloorSpace,floorToUV,uvToFloor,
 floorToProjectorUV,projectorUVToFloor,validateCameraFloorCalibration,
 cameraGroundToFloor,stageUVToRawCamera
} from '../src/footprints/spatial/coordinates.ts';
import {
 FootstepEventEngine,validateFloorSession,createFloorSession,validateFootstepEvent,
 canProjectMetric,requireProjectable,isContactStamp
} from '../src/footprints/spatial/events.ts';
import {calibratedGaitContact,legacyV2ToIllustrativeSession,floorSessionToPreviewSamples} from '../src/footprints/spatial/adapters.ts';

const close=(a:number,b:number,eps=1e-8)=>assert.ok(Math.abs(a-b)<=eps, `${a} != ${b}`);
const floor=defaultFloorSpace(8,6);
const quad=[
 {x:.1,y:.12},{x:.89,y:.06},{x:.94,y:.91},{x:.16,y:.84}
] as const;
const cameraQuad=quad.map(p=>({...p})) as unknown as [ {x:number;y:number}, {x:number;y:number}, {x:number;y:number}, {x:number;y:number} ];
const calib={schema:'soma.footprints.camera-floor',version:1,floor,cameraQuad} as const;
const obs=(p:Partial<Parameters<FootstepEventEngine['observe']>[0]>={})=>({
 performerId:'performer-A',foot:'left' as const,timestampMs:0,phase:'stance' as const,
 positionM:{xM:1,yM:2},headingRad:0,source:'simulation' as const,
 positionBasis:'simulated' as const,confidence:1,...p
});

test('floor axes: downstage-left origin, +X right, +Y upstage, values in metres',()=>{
 assert.deepEqual(floorToUV(floor,{xM:0,yM:0}),{x:0,y:1});
 assert.deepEqual(floorToUV(floor,{xM:8,yM:6}),{x:1,y:0});
 assert.deepEqual(uvToFloor(floor,{x:.25,y:.75}),{xM:2,yM:1.5});
 assert.deepEqual(uvToFloor(floor,floorToUV(floor,{xM:5.75,yM:3.8})),{xM:5.75,yM:3.8});
 assert.throws(()=>floorToUV(floor,{xM:-.3,yM:2}));
 assert.throws(()=>uvToFloor(floor,{x:1.1,y:.3}));
 for(const widthM of [NaN,0,-1,101])assert.throws(()=>validateFloorSpace({...floor,widthM}));
 assert.throws(()=>validateFloorSpace({...floor,origin:'upper-left'}));
});

test('skewed floor-to-projector homography follows four physical floor marks and inverse',()=>{
 for(const [point,index] of [[{xM:0,yM:6},0],[{xM:8,yM:6},1],[{xM:8,yM:0},2],[{xM:0,yM:0},3]] as const){
  const p=floorToProjectorUV(floor,point,cameraQuad);close(p.x,cameraQuad[index].x);close(p.y,cameraQuad[index].y);
 }
 for(const at of [{xM:1.2,yM:5.5},{xM:4,yM:3},{xM:7.8,yM:.1}]){
  const restored=projectorUVToFloor(floor,floorToProjectorUV(floor,at,cameraQuad),cameraQuad);
  close(restored.xM,at.xM);close(restored.yM,at.yM);
 }
 assert.throws(()=>floorToProjectorUV(floor,{xM:1,yM:1},
  [cameraQuad[0],cameraQuad[2],cameraQuad[1],cameraQuad[3]]));
});

test('calibration accepts floor-marked camera points but never assumes airborne contact',()=>{
 assert.deepEqual(validateCameraFloorCalibration(calib).floor,floor);
 const ul=cameraGroundToFloor(calib,{cameraUV:cameraQuad[0],phase:'contact',confidence:.8});
 assert.ok(ul);close(ul.xM,0);close(ul.yM,6);
 const dr=cameraGroundToFloor(calib,{cameraUV:cameraQuad[2],phase:'stance',confidence:.8});
 assert.ok(dr);close(dr.xM,8);close(dr.yM,0);
 assert.equal(cameraGroundToFloor(calib,{cameraUV:{x:.5,y:.5},phase:'contact',confidence:.3}),null);
 assert.equal(cameraGroundToFloor(calib,{cameraUV:{x:.98,y:.98},phase:'contact',confidence:.8}),null);
 assert.equal(cameraGroundToFloor(calib,{cameraUV:{x:.5,y:.5},phase:'swing' as 'contact',confidence:.8}),null);
 assert.throws(()=>validateCameraFloorCalibration({...calib,cameraQuad:[cameraQuad[0],cameraQuad[2],cameraQuad[1],cameraQuad[3]]}));
});

test('SOMA 16:9 stage pixels are un-fitted before applying raw-camera floor calibration',()=>{
 const p=stageUVToRawCamera({x:.125,y:.5},4/3);assert.ok(p);close(p.x,0);close(p.y,.5);
 assert.deepEqual(stageUVToRawCamera({x:.5,y:.5},16/9),{x:.5,y:.5});
 assert.equal(stageUVToRawCamera({x:0,y:0},4/3),null);
 assert.equal(stageUVToRawCamera({x:.5,y:.5},NaN),null);
});

test('event state transitions produce one contact for stance, release at last grounded point',()=>{
 const engine=new FootstepEventEngine(floor);
 assert.equal(engine.observe(obs({timestampMs:0,phase:'swing',positionM:null})).length,0);
 const contact=engine.observe(obs({timestampMs:100}));assert.equal(contact.length,1);
 assert.equal(contact[0].kind,'contact');assert.deepEqual(contact[0].positionM,{xM:1,yM:2});
 assert.equal(engine.observe(obs({timestampMs:120})).length,0);
 assert.equal(engine.observe(obs({timestampMs:120})).length,0); // duplicate frame
 const moved=engine.observe(obs({timestampMs:150,positionM:{xM:1.05,yM:2}}));
 assert.equal(moved.length,1);assert.equal(moved[0].kind,'move');
 const release=engine.observe(obs({timestampMs:200,phase:'swing',positionM:null}));
 assert.equal(release.length,1);assert.equal(release[0].kind,'release');
 assert.deepEqual(release[0].positionM,{xM:1.05,yM:2});
 assert.equal(engine.observe(obs({timestampMs:260,phase:'swing',positionM:null})).length,0);
 const second=engine.observe(obs({timestampMs:400,positionM:{xM:1.4,yM:2}}));
 assert.equal(second.length,1);assert.equal(second[0].kind,'contact');
 assert.notEqual(contact[0].id,second[0].id);
});

test('multiple performers and feet do not cross-contact each other',()=>{
 const engine=new FootstepEventEngine(floor);
 const a=engine.observe(obs({performerId:'A',foot:'left',timestampMs:10}));
 const b=engine.observe(obs({performerId:'B',foot:'left',timestampMs:10,positionM:{xM:5,yM:3}}));
 const c=engine.observe(obs({performerId:'A',foot:'right',timestampMs:10,positionM:{xM:1.5,yM:2}}));
 assert.deepEqual([a[0].kind,b[0].kind,c[0].kind],['contact','contact','contact']);
 assert.equal(new Set([a[0].id,b[0].id,c[0].id]).size,3);
 assert.deepEqual(engine.observe(obs({performerId:'A',foot:'left',timestampMs:20})),[]);
});

test('tracking loss does not invent a new ground-contact stamp at reacquisition',()=>{
 const e=new FootstepEventEngine(floor);
 assert.equal(e.observe(obs({timestampMs:0}))[0].kind,'contact');
 e.loseTracking('performer-A','left');
 assert.deepEqual(e.observe(obs({timestampMs:100})),[]);
 assert.deepEqual(e.observe(obs({timestampMs:120,phase:'swing',positionM:null})),[]);
 assert.equal(e.observe(obs({timestampMs:240}))[0].kind,'contact');
 assert.throws(()=>e.observe(obs({timestampMs:260,positionM:{xM:100,yM:2}})));
});

test('new floor session preserves version, timeline, provenance, and cannot project illustrative data',()=>{
 const engine=new FootstepEventEngine(floor);
 const events=[
  ...engine.observe(obs({timestampMs:0})),
  ...engine.observe(obs({timestampMs:20,phase:'swing',positionM:null})),
  ...engine.observe(obs({timestampMs:100}))
 ];
 const session=createFloorSession(floor,events);
 assert.deepEqual(validateFloorSession(JSON.parse(JSON.stringify(session))),session);
 assert.ok(events.every(canProjectMetric));
 assert.equal(events.filter(isContactStamp).length,2);
 assert.throws(()=>validateFloorSession({...session,events:[events[1],events[0]]}));
 assert.throws(()=>validateFloorSession({...session,events:[events[0],events[0]]}));
 assert.throws(()=>validateFloorSession({...session,version:2}));
 assert.throws(()=>validateFootstepEvent({...events[0],confidence:2},floor));
 assert.throws(()=>validateFootstepEvent({...events[0],source:'camera'},floor));
 const predicted=validateFootstepEvent({...events[0],id:'ghost',kind:'prediction'},floor);
 assert.equal(isContactStamp(predicted),false);
});

test('legacy V2 session can be previewed but is never silently treated as physical metres',()=>{
 const recipe={style:'Campuran',palette:0,size:32,mirror:false};
 const samples=[
  {x:.2,y:.4,t:0,side:0,join:false,heading:.25,stamp:true},
  {x:.3,y:.5,t:50,side:0,join:true,heading:.4,stamp:false},
  {x:.7,y:.6,t:200,side:1,join:false,heading:-.2,stamp:true}
 ];
 const session=legacyV2ToIllustrativeSession({schema:'soma.footprints.session',version:2,recipe,samples},floor);
 assert.deepEqual(session.events.map(e=>e.kind),['contact','move','contact']);
 assert.equal(session.events[0].positionM.xM,1.6);
 close(session.events[0].positionM.yM,3.6);
 assert.equal(session.events[1].joinPrevious,true);
 assert.equal(session.events[0].source,'legacy');
 assert.equal(session.events[0].positionBasis,'illustrative');
 assert.equal(canProjectMetric(session.events[0]),false);
 assert.throws(()=>requireProjectable(session.events[0]));
 const preview=floorSessionToPreviewSamples(session);
 assert.equal(preview.length,samples.length);
 preview.forEach((v,i)=>{
  close(v.x,samples[i].x);close(v.y,samples[i].y);close(v.heading,samples[i].heading);
  assert.equal(v.t,samples[i].t);assert.equal(v.side,samples[i].side);
  assert.equal(v.join,samples[i].join);assert.equal(v.stamp,samples[i].stamp);
 });
 assert.deepEqual(validateFloorSession(JSON.parse(JSON.stringify(session))),session);
 assert.throws(()=>floorSessionToPreviewSamples({...session,events:[...session.events,{
  ...session.events[0],id:'second',performerId:'other',timestampMs:210
 }]}));
});

test('camera adapter emits only confidence-gated calibrated contact stamps',()=>{
 const m={
  x:.5,y:.5,t:400,side:0,join:false,heading:0,stamp:true,
  phase:'stance',confidence:.9,relativeSpeed:.01
 } as const;
 const hit=calibratedGaitContact(m,16/9,calib,'performer-A');
 assert.ok(hit);assert.equal(hit.kind,'contact');assert.equal(hit.positionBasis,'calibrated-estimate');
 assert.equal(hit.source,'camera');assert.equal(hit.foot,'left');
 assert.ok(canProjectMetric(hit));
 const noContact=calibratedGaitContact({...m,stamp:false},16/9,calib);
 assert.equal(noContact,null);
 const swing=calibratedGaitContact({...m,phase:'swing'},16/9,calib);
 assert.equal(swing,null);
 assert.equal(calibratedGaitContact({...m,confidence:.2},16/9,calib),null);
 assert.equal(calibratedGaitContact({...m,x:.99,y:.99},16/9,calib),null);
});
