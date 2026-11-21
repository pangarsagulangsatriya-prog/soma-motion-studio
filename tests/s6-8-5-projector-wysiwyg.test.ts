import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultStageSurfacePlan,stageSurfaceState,validateStageSurfacePlan,
 assessSurfaceProof,outputSurfaceDecision} from '../src/footprints/stage-optics/DualSurfaceCalibration.ts';
import {dualPhysicalOutputAllowed,previewSignal,previewCaption,previewArtworkMatrix,previewBrightness}
 from '../src/footprints/stage-optics/projectorWysiwygModel.ts';
import {artworkMatrix} from '../src/projection/artwork.ts';
import {projectionMatrix} from '../src/projection/model.ts';

test('S6.8.5 projector: blackout software never appears as sent artwork',()=>{
 for(const mode of ['blackout','offline','unknown','hold']){
  assert.equal(previewSignal('sent',mode),'blackout');
 }
 assert.equal(previewSignal('sent','test'),'test');
 assert.equal(previewSignal('sent','live'),'artwork');
 assert.equal(previewSignal('draft','blackout'),'artwork');
 assert.match(previewCaption('sent','blackout'),/BLACKOUT/);
 assert.match(previewCaption('draft','live'),/tidak dikirim/);
});

test('S6.8.5 projector: preview uses the identical matrix and brightness as output',()=>{
 for(const surface of ['body','floor'] as const){
  const plan=defaultStageSurfacePlan(surface);
  assert.deepEqual(
   previewArtworkMatrix(plan,480,270),
   artworkMatrix(stageSurfaceState(plan,'live',true).config,480,270)
  );
  assert.equal(previewBrightness(plan),plan.brightness);
  assert.equal(stageSurfaceState(plan,'blackout',false).blank,true);
 }
});

test('S6.8.5 projector: corner changes alter WYSIWYG matrix, remain validated',()=>{
 const plan=defaultStageSurfacePlan('floor');
 const modified=validateStageSurfacePlan({...plan,
  projectorQuad:[
   {x:.12,y:.08},{x:.90,y:.09},{x:.88,y:.91},{x:.1,y:.89}
  ]
 });
 assert.notDeepEqual(previewArtworkMatrix(plan,480,270),
  previewArtworkMatrix(modified,480,270));
 const cfg=stageSurfaceState(modified,'live',true).config;
 const expected=projectionMatrix(cfg,{mask:{width:1,height:1,data:new Uint8Array(1)},
  aspect:16/9,time:0});
 assert.equal(expected.length,9);
 assert.ok(previewArtworkMatrix(modified,480,270).every(Number.isFinite));
});

test('S6.8.5 projector: MP4 and 3D still require explicit operator confirmation',()=>{
 assert.equal(dualPhysicalOutputAllowed(true,true,true),true);
 assert.equal(dualPhysicalOutputAllowed(true,true,false),false);
 assert.equal(dualPhysicalOutputAllowed(false,false,true),false);
 assert.equal(dualPhysicalOutputAllowed(true,false,false),false);
 assert.equal(dualPhysicalOutputAllowed(true,false,true),true);
});

test('S6.8.5 projector: five-point QA remains mandatory before Live',()=>{
 const plan=defaultStageSurfacePlan('body');
 const assessment=assessSurfaceProof(plan,null,null);
 assert.equal(assessment.status,'incomplete');
 const decision=outputSurfaceDecision({
  plan,signature:null,proof:null,requested:'live',connected:true,
  cameraSafe:true,bridgeSafe:true,operatorArmed:true,sourceFresh:true
 });
 assert.equal(decision.mode,'blackout');
 assert.ok(decision.assessment.missing.length>0);
});

test('S6.8.5 projector: test and live remain blocked on stale frames',()=>{
 const plan=defaultStageSurfacePlan('floor');
 for(const requested of ['test','live'] as const){
  const decision=outputSurfaceDecision({
   plan,signature:null,proof:null,requested,connected:true,
   cameraSafe:false,sourceFresh:false,bridgeSafe:false,operatorArmed:false
  });
  assert.equal(decision.mode,'blackout');
 }
});
