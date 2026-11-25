import test from 'node:test';
import assert from 'node:assert/strict';
import {identityQuad} from '../src/projection/geometry.ts';
import {assessSurfaceProof,defaultStageSurfacePlan,emptySurfaceProof,outputSurfaceDecision,
 recordSurfaceSample,stageSurfaceReport,stageSurfaceSignature,stageSurfaceState,cleanFeedSurfaceState,
 SURFACE_TARGETS,validateStageSurfacePlan,type StageSurface,type StageOutputContext,
 type SurfaceProof} from '../src/footprints/stage-optics/DualSurfaceCalibration.ts';

const stageContext=(token='body-window-1'):StageOutputContext=>({
 cameraBinding:'camera-track-1280x720',floorContext:'floor-corners-fixed',
 windowSession:token,viewport:{width:1280,height:720,dpr:1}
});
function proof(surface:StageSurface,cm=2):{
 plan:ReturnType<typeof defaultStageSurfacePlan>,signature:string,proof:SurfaceProof}{
 const plan=defaultStageSurfacePlan(surface);
 const signature=stageSurfaceSignature(plan,stageContext(surface+'-window-1'))!;
 let data=emptySurfaceProof(plan,signature);
 for(const target of SURFACE_TARGETS[surface])
  data=recordSurfaceSample(data,target.id,cm,0);
 data={...data,reviewer:'Operator Panggung',completedAt:new Date(0).toISOString(),
  checklist:{fixedOptics:true,blackoutObserved:true,noUnsafeSpill:true}};
 return {plan,signature,proof:data};
}
const decision=(p:ReturnType<typeof proof>,overrides:Partial<Parameters<typeof outputSurfaceDecision>[0]>={})=>
 outputSurfaceDecision({plan:p.plan,signature:p.signature,proof:p.proof,
  requested:'live',connected:true,cameraSafe:true,bridgeSafe:true,
  operatorArmed:true,sourceFresh:true,...overrides});

test('body and floor have distinct calibration, five independent interior physical checks and safe brightness cap',()=>{
 const body=defaultStageSurfacePlan('body'),floor=defaultStageSurfacePlan('floor');
 assert.equal(body.surface,'body');assert.equal(floor.surface,'floor');
 assert.equal(SURFACE_TARGETS.body.length,5);
 assert.equal(SURFACE_TARGETS.floor.length,5);
 assert.ok(body.brightness<=.6&&floor.brightness<=.6);
 assert.equal(stageSurfaceSignature(body,stageContext('body')),
  stageSurfaceSignature(body,stageContext('body')));
 assert.notEqual(stageSurfaceSignature(body,stageContext('body')),
  stageSurfaceSignature(floor,stageContext('floor')));
 assert.equal(stageSurfaceSignature(body,{...stageContext(),cameraBinding:null}),null);
 assert.deepEqual(validateStageSurfacePlan(body).sourceQuad,identityQuad());
});
test('neither output receives live or test photons on missing camera, unsafe source, missing proof or no opt-in',()=>{
 const p=proof('body');
 assert.equal(decision(p).mode,'live');
 assert.equal(decision(p,{cameraSafe:false}).mode,'blackout');
 assert.equal(decision(p,{bridgeSafe:false}).mode,'blackout');
 assert.equal(decision(p,{sourceFresh:false}).mode,'blackout');
 assert.equal(decision(p,{operatorArmed:false}).mode,'blackout');
 assert.equal(decision(p,{connected:false}).mode,'blackout');
 assert.equal(decision(p,{proof:null}).mode,'blackout');
 assert.equal(decision(p,{requested:'blackout'}).mode,'blackout');
 assert.equal(decision(p,{requested:'test'}).mode,'test');
 assert.equal(decision(p,{requested:'test',cameraSafe:false}).mode,'blackout');
});
test('operator must physically mark five measured points, named review and three hardware checks',()=>{
 const body=defaultStageSurfacePlan('body');
 const signature=stageSurfaceSignature(body,stageContext())!;
 let record=emptySurfaceProof(body,signature);
 assert.equal(assessSurfaceProof(body,signature,record).status,'incomplete');
 for(const t of SURFACE_TARGETS.body)
  record=recordSurfaceSample(record,t.id,0,0);
 assert.equal(assessSurfaceProof(body,signature,record).status,'incomplete');
 record={...record,reviewer:'Tester',completedAt:'2026-11-17',
  checklist:{fixedOptics:true,blackoutObserved:true,noUnsafeSpill:false}};
 assert.equal(assessSurfaceProof(body,signature,record).status,'incomplete');
 record={...record,checklist:{...record.checklist,noUnsafeSpill:true}};
 assert.equal(assessSurfaceProof(body,signature,record).status,'within-provisional-target');
});
test('changed target quad, camera identity, floor setup, output instance or viewport invalidates approval',()=>{
 const p=proof('floor');
 assert.equal(decision(p).mode,'live');
 assert.equal(decision(p,{signature:stageSurfaceSignature(p.plan,stageContext('new-window'))}).mode,'blackout');
 assert.equal(decision(p,{signature:stageSurfaceSignature(p.plan,{
  ...stageContext('floor-window-1'),cameraBinding:'camera-resized'
 })}).mode,'blackout');
 assert.equal(decision(p,{signature:stageSurfaceSignature(p.plan,{
  ...stageContext('floor-window-1'),floorContext:'recalibrated'
 })}).mode,'blackout');
 assert.equal(decision(p,{signature:stageSurfaceSignature(p.plan,{
  ...stageContext('floor-window-1'),
  viewport:{width:1920,height:1080,dpr:1}
 })}).mode,'blackout');
 const changed=validateStageSurfacePlan({...p.plan,projectorQuad:[
  {x:.05,y:.02},{x:.95,y:.02},{x:.95,y:.95},{x:.05,y:.95}
 ]});
 assert.equal(outputSurfaceDecision({plan:changed,
  signature:stageSurfaceSignature(changed,stageContext('floor-window-1')),
  proof:p.proof,requested:'live',connected:true,cameraSafe:true,
  bridgeSafe:true,operatorArmed:true,sourceFresh:true}).mode,'blackout');
});
test('excess physical error fails provisional thresholds and cannot arm either surface',()=>{
 for(const surface of ['body','floor'] as const){
  const p=proof(surface,40),result=assessSurfaceProof(p.plan,p.signature,p.proof);
  assert.equal(result.status,'needs-adjustment');
  assert.equal(decision(p).mode,'blackout');
  assert.ok(result.rmseCm!>30&&result.p95Cm!>30);
 }
});
test('reject missing sample, invalid quad, excessively bright output, unknown measurement',()=>{
 const p=proof('body');
 assert.throws(()=>recordSurfaceSample(p.proof,'BAD',0,0));
 assert.throws(()=>recordSurfaceSample(p.proof,'B1',Infinity,0));
 assert.throws(()=>validateStageSurfacePlan({...p.plan,brightness:1}));
 assert.throws(()=>validateStageSurfacePlan({...p.plan,sourceQuad:[
  {x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}
 ]}));
 const newer=recordSurfaceSample(p.proof,'B1',10,3);
 assert.equal(newer.completedAt,null);
 assert.equal(newer.samples.length,5);
});
test('body artwork only transmits with approved live/test; never uses full-viewport pattern',()=>{
 const plan=defaultStageSurfacePlan('body');
 const live=stageSurfaceState(plan,'live',true);
 assert.equal(live.transport,'live');assert.equal(live.blank,false);
 assert.equal(live.pattern,false);
 assert.equal(live.config.registration.enabled,true);
 assert.equal(live.config.mirror,false);
 assert.ok(live.config.brightness<=.6);
 const testing=stageSurfaceState(plan,'test',true);
 assert.equal(testing.transport,'live');assert.equal(testing.pattern,false);
 const blackout=stageSurfaceState(plan,'live',false);
 assert.equal(blackout.transport,'blackout');assert.equal(blackout.blank,true);
 assert.equal(stageSurfaceState(plan,'blackout',true).blank,true);
});
test('report includes manual evidence and provisional result only, never Production authorization',()=>{
 const p=proof('floor');
 const report=stageSurfaceReport(p.plan,p.proof,stageContext('floor-window-1'));
 assert.equal(report.schema,'soma.footprints.dual-surface-qa');
 assert.equal(report.assessment.status,'within-provisional-target');
 assert.match(report.caveat,/Tidak menyatakan penerimaan Production/);
 assert.equal(report.proof?.samples.length,5);
 assert.equal(report.plan.surface,'floor');
});

// Resolume/OBS receives unwarped, full-brightness source art; Map warp stays physical.
test('Clean Feed stays unwarped 16:9 and avoids physical mapping state',()=>{
 const plan=defaultStageSurfacePlan('floor');
 const s=cleanFeedSurfaceState(plan);
 assert.equal(s.transport,'live');
 assert.equal(s.blank,false);
 assert.equal(s.config.registration.enabled,false);
 assert.equal(s.config.mirror,false);
 assert.equal(s.config.brightness,1);
 assert.equal(s.config.resolution,plan.resolution);
 assert.deepEqual(s.config.quad,identityQuad());
 assert.equal(s.config.placement.scale,1);
});

test('unsigned, incomplete or incorrectly typed checklist cannot authorize the FLOOR permit',()=>{
 const example=proof('floor');
 for(const checklist of [{},{fixedOptics:true,blackoutObserved:true},
  {fixedOptics:true,blackoutObserved:'false',noUnsafeSpill:true}]){
  const record={...example.proof,checklist} as typeof example.proof;
  assert.equal(assessSurfaceProof(example.plan,example.signature,record).status,'incomplete');
 }
 const unsigned={...example.proof,completedAt:null};
 assert.equal(assessSurfaceProof(example.plan,example.signature,unsigned).status,'incomplete');
});
