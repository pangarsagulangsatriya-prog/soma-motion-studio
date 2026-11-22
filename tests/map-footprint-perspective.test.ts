import test from 'node:test';
import assert from 'node:assert/strict';
import {homography,transform,type Quad} from '../src/projection/geometry.ts';
import {EXAMPLE_MAP_FOOTPRINTS,mapTrackedFootPreview,
 paintMapPerspectiveFootprints,perspectiveFootPoint}
 from '../src/studio/v3/mapFootprintPerspective.ts';
import type {Landmark} from '../src/engine/types.ts';

const camera:Quad=[
 {x:.15,y:.16},{x:.85,y:.3},{x:.93,y:.94},{x:.03,y:.88}
];
const output:Quad=[
 {x:.12,y:.12},{x:.85,y:.29},{x:.96,y:.93},{x:.06,y:.87}
];
const dims={widthM:5,depthM:5};
function poseAtFloor(u:number,v:number):Landmark[]{
 const array=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
 const mat=homography(camera);
 // Heel is towards the bottom of a footprint. Toe points towards far end.
 const heel=transform(mat,{x:u-.002,y:v+.025});
 const toe=transform(mat,{x:u+.002,y:v-.025});
 array[29]={...heel,z:0,visibility:.98};
 array[31]={...toe,z:0,visibility:.98};
 return array;
}
test('Map: five clearly marked demo footprints show realistic perspective at rest',()=>{
 assert.equal(EXAMPLE_MAP_FOOTPRINTS.length,5);
 assert.ok(EXAMPLE_MAP_FOOTPRINTS.every(f=>f.source==='example'));
 const near=EXAMPLE_MAP_FOOTPRINTS[4],far=EXAMPLE_MAP_FOOTPRINTS[0];
 const nearTop=perspectiveFootPoint(near,{x:0,y:-.8},dims,output);
 const nearHeel=perspectiveFootPoint(near,{x:0,y:.8},dims,output);
 const farTop=perspectiveFootPoint(far,{x:0,y:-.8},dims,output);
 const farHeel=perspectiveFootPoint(far,{x:0,y:.8},dims,output);
 assert.ok(nearTop&&nearHeel&&farTop&&farHeel);
 assert.ok(Math.hypot(nearTop!.x-nearHeel!.x,nearTop!.y-nearHeel!.y)>0);
 assert.notEqual(
  Math.hypot(nearTop!.x-nearHeel!.x,nearTop!.y-nearHeel!.y).toFixed(4),
  Math.hypot(farTop!.x-farHeel!.x,farTop!.y-farHeel!.y).toFixed(4),
  'perspective must alter foot length at different positions');
});
test('Map: camera heel-to-toe is remapped back to real floor heading before warping',()=>{
 const mapped=mapTrackedFootPreview(poseAtFloor(.42,.62),camera,dims);
 assert.equal(mapped.length,1);
 assert.equal(mapped[0].source,'tracked');
 assert.equal(mapped[0].foot,'left');
 assert.ok(Math.abs(mapped[0].uv.x-.42)<.004);
 assert.ok(Math.abs(mapped[0].uv.y-.62)<.004);
 assert.ok(Math.abs(mapped[0].headingRad)<.25,
  'heading uses calibrated floor vector rather than distorted camera direction');
 const point=perspectiveFootPoint(mapped[0],{x:0,y:0},dims,output);
 const target=transform(homography(output),mapped[0].uv);
 assert.ok(point&&Math.abs(point.x-target.x)<1e-8&&Math.abs(point.y-target.y)<1e-8);
 const shifted:Quad=[{x:.18,y:.09},{x:.75,y:.08},{x:.94,y:.94},{x:.06,y:.82}];
 const warped=perspectiveFootPoint(mapped[0],{x:.3,y:-.4},dims,shifted);
 const original=perspectiveFootPoint(mapped[0],{x:.3,y:-.4},dims,output);
 assert.ok(warped&&original&&Math.hypot(warped.x-original.x,warped.y-original.y)>.01,
  'changing output corners must deform the same observed shoe');
});
test('Map: off-floor and weak landmarks cannot be presented as live shoe tracking',()=>{
 const weak=poseAtFloor(.55,.55);
 weak[31].visibility=.2;
 assert.equal(mapTrackedFootPreview(weak,camera,dims).length,0);
 assert.equal(mapTrackedFootPreview(poseAtFloor(-.4,.3),camera,dims).length,0);
});
test('Map: anatomical contour + five toes warp vertex by vertex, never write output raster',()=>{
 const records={fills:0,segments:0};
 const ctx={
  globalAlpha:1,globalCompositeOperation:'source-over',fillStyle:'',strokeStyle:'',
  save(){},restore(){},beginPath(){},moveTo(){},
  lineTo(){records.segments++;},closePath(){},fill(){records.fills++;}
 } as unknown as CanvasRenderingContext2D;
 const drawn=paintMapPerspectiveFootprints(ctx,EXAMPLE_MAP_FOOTPRINTS,output,dims,
  {x:0,y:0,width:640,height:360});
 assert.equal(drawn,5);
 assert.equal(records.fills,5*6);
 assert.ok(records.segments>5*90,'outline and toe vertices must be individually warped');
 assert.equal(paintMapPerspectiveFootprints(ctx,EXAMPLE_MAP_FOOTPRINTS,
  [{x:0,y:0},{x:0,y:0},{x:1,y:1},{x:0,y:1}],dims,
  {x:0,y:0,width:640,height:360}),0);
});
