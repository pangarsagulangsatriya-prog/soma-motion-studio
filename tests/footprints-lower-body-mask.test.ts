import test from 'node:test';
import assert from 'node:assert/strict';
import type {MotionFrame} from '../src/engine/types.ts';
import {buildLowerBodyMask,LOWER_BODY_MASK_DEFAULTS,lowerBodyPosePolygons,
 sampleLowerBodyFrame,validateLowerBodyMaskConfig} from '../src/footprints/stage-optics/LowerBodyMaskEngine.ts';

const settings={...LOWER_BODY_MASK_DEFAULTS};
const pixels=(r:ReturnType<typeof buildLowerBodyMask>)=>
 r.mask.data.filter(v=>v>0).length;
const at=(r:ReturnType<typeof buildLowerBodyMask>,x:number,y:number)=>
 r.mask.data[Math.floor(y*r.mask.height)*r.mask.width+Math.floor(x*r.mask.width)];

test('two simulated legs per person yield isolated lower-body mask, black face and upper chest',()=>{
 const frame=sampleLowerBodyFrame(1000,2,0);
 const result=buildLowerBodyMask(frame,settings,1000,'simulation');
 assert.equal(result.status,'ready');assert.equal(result.poseCount,2);
 assert.ok(pixels(result)>100);
 assert.equal(at(result,.29,.12),0);
 assert.equal(at(result,.72,.12),0);
 assert.equal(at(result,.5,.57),0); // initial separated performers stay isolated
 assert.ok(result.polygons.filter(p=>p.part==='thigh').length===4);
 assert.ok(result.polygons.filter(p=>p.part==='shin').length===4);
 assert.ok(result.polygons.filter(p=>p.part==='foot').length===8);
 assert.ok(result.polygons.every(poly=>poly.points.every(pt=>pt.x>=0&&pt.x<=1&&pt.y>=0&&pt.y<=1)));
});
test('a single performer uses one pose without new camera, no second performer inferred',()=>{
 const frame=sampleLowerBodyFrame(1000,1);
 const result=buildLowerBodyMask(frame,{...settings,performers:1},1000);
 assert.equal(result.status,'ready');
 assert.equal(result.polygons.length,9);
 assert.equal(buildLowerBodyMask(frame,settings,1000).status,'missing');
});
test('two bodies crossing/overlapping fail closed; no mask is emitted',()=>{
 const frame=sampleLowerBodyFrame(1000,2,2.3,true);
 const result=buildLowerBodyMask(frame,settings,1000);
 assert.equal(result.status,'ambiguous');
 assert.equal(pixels(result),0);
 assert.equal(result.polygons.length,0);
});
test('tracking lost, stale frame, wrong source or one missing toe all produce black output',()=>{
 const frame=sampleLowerBodyFrame(1000,2);
 assert.equal(buildLowerBodyMask(null,settings,1000).status,'missing');
 assert.equal(buildLowerBodyMask(frame,settings,1500).status,'stale');
 assert.equal(buildLowerBodyMask({...frame,tracked:false},settings,1000).status,'missing');
 assert.equal(buildLowerBodyMask({...frame,source:'mouse'},settings,1000).status,'missing');
 const poses=frame.poses!.map(p=>p.map(l=>({...l})));
 poses[0][31].visibility=.01;
 const result=buildLowerBodyMask({...frame,poses},settings,1000);
 assert.equal(result.status,'missing');
 assert.equal(pixels(result),0);
});
test('if available, union segmentation clips lower-body geometry; no pixel outside segmentation survives',()=>{
 const frame=sampleLowerBodyFrame(1000,2);
 const bare=buildLowerBodyMask(frame,settings,1000);
 const seg=new Uint8Array(40*30);
 for(let y=0;y<30;y++)for(let x=0;x<20;x++)seg[y*40+x]=255;
 const segmented:MotionFrame={...frame,segmentation:{width:40,height:30,data:seg}};
 const clipped=buildLowerBodyMask(segmented,settings,1000);
 assert.equal(clipped.status,'ready');assert.equal(clipped.segmentationUsed,true);
 assert.ok(pixels(clipped)>0&&pixels(clipped)<pixels(bare));
 for(let y=0;y<clipped.mask.height;y++)
  for(let x=clipped.mask.width/2;x<clipped.mask.width;x++)
   assert.equal(clipped.mask.data[y*clipped.mask.width+x],0);
});
test('segmentation-required mode is black when mask absent; landmark-only preview labels uncertainty',()=>{
 const frame=sampleLowerBodyFrame(1000,2);
 const required=buildLowerBodyMask(frame,{...settings,requireSegmentation:true},1000);
 assert.equal(required.status,'missing');assert.equal(pixels(required),0);
 const allowed=buildLowerBodyMask(frame,settings,1000);
 assert.equal(allowed.status,'ready');
 assert.match(allowed.reason,/landmark/i);
});
test('feather is inward only: never creates pixels outside raw strict geometry',()=>{
 const frame=sampleLowerBodyFrame(1000,1);
 const raw=buildLowerBodyMask(frame,{...settings,performers:1,featherPx:0},1000);
 const blurred=buildLowerBodyMask(frame,{...settings,performers:1,featherPx:4},1000);
 assert.equal(raw.status,'ready');assert.equal(blurred.status,'ready');
 for(let i=0;i<raw.mask.data.length;i++)
  if(raw.mask.data[i]===0)assert.equal(blurred.mask.data[i],0);
});
test('geometry follows pelvis/shoulders, and upper-body extension remains bounded',()=>{
 const frame=sampleLowerBodyFrame(1000,1);
 const shallow=lowerBodyPosePolygons(frame.pose,0,{...settings,performers:1,torsoExtension:0});
 const up=lowerBodyPosePolygons(frame.pose,0,{...settings,performers:1,torsoExtension:.35});
 assert.ok(shallow&&up);
 assert.ok(up.bounds.minY<shallow.bounds.minY);
 assert.ok(up.bounds.minY>.23); // simulation shoulder line, no face projection
});
test('unsafe mask settings are rejected; frame model and original segmentation stay untouched',()=>{
 assert.throws(()=>validateLowerBodyMaskConfig({...settings,torsoExtension:.8}));
 assert.throws(()=>validateLowerBodyMaskConfig({...settings,featherPx:50}));
 assert.throws(()=>validateLowerBodyMaskConfig({...settings,width:0}));
 assert.throws(()=>validateLowerBodyMaskConfig({...settings,minimumVisibility:0}));
 const frame=sampleLowerBodyFrame(1000,2),serialized=JSON.stringify(frame);
 buildLowerBodyMask(frame,settings,1000);
 assert.equal(JSON.stringify(frame),serialized);
});
