import test from 'node:test';
import assert from 'node:assert/strict';
import {identityQuad,type Quad} from '../src/projection/geometry.ts';
import {diagnosticNinePointGrid,defaultFloorStageGrid} from '../src/footprints/stage-optics/floorNinePointGrid.ts';
import {LOWER_BODY_MASK_DEFAULTS,lowerBodyPosePolygons,sampleLowerBodyFrame,buildLowerBodyMask}
 from '../src/footprints/stage-optics/LowerBodyMaskEngine.ts';

test('VC05: 3×3 mapping grid has nine unique points in 5×5 metres',()=>{
 const pts=defaultFloorStageGrid(5,5);assert.equal(pts.length,9);
 assert.deepEqual(pts[0],{id:'G1',xM:0,yM:5});
 assert.deepEqual(pts[4],{id:'G5',xM:2.5,yM:2.5});
 assert.deepEqual(pts[8],{id:'G9',xM:5,yM:0});
});
test('VC05: projector correspondence grid round trips all nine points',()=>{
 const skew:Quad=[{x:.12,y:.18},{x:.89,y:.14},{x:.94,y:.84},{x:.08,y:.91}];
 const result=diagnosticNinePointGrid(identityQuad(),skew);
 assert.equal(result.samples.length,9);assert.equal(result.valid,true);
 assert.ok(result.maxError<1e-5);
 assert.ok(result.reason.includes('tidak mengukur')||result.reason.includes('fisik'));
});
test('VC05: invalid quad fails closed in diagnostic',()=>{
 const zero:Quad=[{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
 assert.equal(diagnosticNinePointGrid(zero,identityQuad()).valid,false);
});
test('VC06: preview thigh cutoff excludes pelvis and starts further down the thighs',()=>{
 const frame=sampleLowerBodyFrame(1000,1);const pose=frame.pose;
 const base=lowerBodyPosePolygons(pose,0,{...LOWER_BODY_MASK_DEFAULTS,performers:1});
 const tuned=lowerBodyPosePolygons(pose,0,{...LOWER_BODY_MASK_DEFAULTS,
  performers:1,torsoExtension:0,thighStartRatio:.28,includePelvis:false});
 assert.ok(base);assert.ok(tuned);
 assert.ok(base.polygons.some(p=>p.part==='pelvis'));
 assert.ok(!tuned.polygons.some(p=>p.part==='pelvis'));
 assert.equal(tuned.polygons.filter(p=>p.part==='thigh').length,2);
 const highBase=Math.min(...base.polygons.flatMap(p=>p.points.map(v=>v.y)));
 const highTuned=Math.min(...tuned.polygons.flatMap(p=>p.points.map(v=>v.y)));
 assert.ok(highTuned>highBase);
});
test('VC06: overlapping two performers never receive valid masks',()=>{
 const frame=sampleLowerBodyFrame(1000,2,0,true);
 const result=buildLowerBodyMask(frame,{...LOWER_BODY_MASK_DEFAULTS,performers:2,
  includePelvis:false,thighStartRatio:.2},1000,'camera');
 assert.notEqual(result.status,'ready');
 assert.ok(result.mask.data.every(x=>x===0));
});
