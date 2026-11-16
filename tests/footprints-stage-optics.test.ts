import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {assessStageOpticsPlan,defaultStageOpticsPlan,stageOpticsPlanExport,
 validateStageOpticsPlan} from '../src/footprints/stage-optics/StageOpticsPlan.ts';

test('the reference stage produces two independent body zones and an unlit crossing zone',()=>{
 const p=defaultStageOpticsPlan();
 assert.equal(p.floor.widthM,8);assert.equal(p.floor.depthM,6);
 assert.equal(p.layout,'two-projector');
 assert.ok(p.zones.A.xM+p.zones.A.widthM<p.zones.B.xM);
 assert.ok(p.zones.crossing.xM+p.zones.crossing.widthM<=p.floor.widthM);
 assert.ok(p.body.visibleTopM>1.2&&p.body.visibleTopM<1.4);
 assert.equal(assessStageOpticsPlan(p).status,'design-only');
});
test('floor presets 6x4 and 10x7 preserve positive zones fully within physical coordinates',()=>{
 for(const [w,d] of [[6,4],[10,7]]){
  const plan=validateStageOpticsPlan(defaultStageOpticsPlan(defaultFloorSpace(w,d)));
  assert.equal(plan.floor.widthM,w);
  assert.equal(plan.floor.depthM,d);
  for(const zone of [plan.zones.A,plan.zones.B,plan.zones.crossing]){
   assert.ok(zone.widthM>.25);assert.ok(zone.depthM>.25);
   assert.ok(zone.xM>=0&&zone.xM+zone.widthM<=w);
   assert.ok(zone.yM>=0&&zone.yM+zone.depthM<=d);
  }
 }
});
test('hardware throw ratio is an estimate only; impossible listed lens and FOV produce warnings',()=>{
 const plan=defaultStageOpticsPlan();
 const estimate=assessStageOpticsPlan(plan);
 assert.ok(estimate.body.throwRatioEstimate>0);
 assert.ok(estimate.floor.throwRatioEstimate>0);
 assert.ok(estimate.minimumCameraHorizontalFovDeg>0);
 assert.ok(estimate.minimumCameraHorizontalFovDeg<180);
 assert.ok(estimate.warnings.some(w=>w.includes('lensa')||w.includes('Lensa')));
 const p={...plan,equipment:{...plan.equipment,
  bodyThrowRatioMin:3,bodyThrowRatioMax:4,
  floorThrowRatioMin:3,floorThrowRatioMax:4,cameraHorizontalFovDeg:25}};
 const checked=assessStageOpticsPlan(p);
 assert.ok(checked.warnings.some(w=>w.includes('tubuh di luar')));
 assert.ok(checked.warnings.some(w=>w.includes('lantai di luar')));
 assert.ok(checked.warnings.some(w=>w.includes('FOV')));
});
test('switching to three projectors adds a separate B body lens estimate but no live output',()=>{
 const p=defaultStageOpticsPlan();
 assert.equal(assessStageOpticsPlan(p).bodyB,null);
 const three={...p,layout:'three-projector' as const};
 assert.ok(assessStageOpticsPlan(three).bodyB);
 const report=stageOpticsPlanExport(three);
 assert.equal(report.purpose,'rehearsal design only; no live output or calibrated hardware approval');
 assert.equal(report.estimate.status,'design-only');
});
test('rejects off-floor zones, invalid visibility cutoff, unsafe coordinates and partial lens ranges',()=>{
 const p=defaultStageOpticsPlan();
 assert.throws(()=>validateStageOpticsPlan({...p,zones:{...p.zones,
  A:{...p.zones.A,xM:-1}}}));
 assert.throws(()=>validateStageOpticsPlan({...p,body:{...p.body,visibleTopM:3}}));
 assert.throws(()=>validateStageOpticsPlan({...p,devices:{...p.devices,
  camera:{...p.devices.camera,zM:0}}}));
 assert.throws(()=>validateStageOpticsPlan({...p,equipment:{...p.equipment,
  bodyThrowRatioMin:.8,bodyThrowRatioMax:null}}));
 assert.throws(()=>validateStageOpticsPlan({...p,equipment:{...p.equipment,
  cameraHorizontalFovDeg:180}}));
});
test('validate/export copy design without altering stage calibration or hardware settings',()=>{
 const p=defaultStageOpticsPlan();
 const original=JSON.stringify(p);
 const output=stageOpticsPlanExport(p);
 assert.equal(JSON.stringify(p),original);
 assert.equal(output.plan.schema,'soma.footprints.stage-optics');
 assert.equal(output.plan.version,1);
 assert.equal(output.plan.layout,'two-projector');
 assert.ok(output.estimate.assumptions.length>=3);
 output.plan.devices.camera.xM=-12;
 assert.notEqual(p.devices.camera.xM,output.plan.devices.camera.xM);
});
