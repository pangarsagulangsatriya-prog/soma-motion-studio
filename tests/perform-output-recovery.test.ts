import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
 deriveSurfaceBadge,evaluatePerformOutputSummary
} from '../src/studio/v3/performOutputModel.ts';
import type {SurfaceDeviceState} from '../src/footprints/stage-optics/DualSurfaceSessionStore.ts';

const read=(rel:string)=>fs.readFileSync(new URL(rel,import.meta.url),'utf8');

const offlineDevice:SurfaceDeviceState={
 connected:false,opened:false,viewport:null,mode:'blackout',reason:'Output belum dibuka.'
};
const blackoutDevice:SurfaceDeviceState={
 connected:true,opened:true,viewport:{width:1280,height:720,dpr:1},mode:'blackout',reason:'Blackout.'
};
const testDevice:SurfaceDeviceState={
 connected:true,opened:true,viewport:{width:1280,height:720,dpr:1},mode:'test',reason:'Test pattern.'
};
const liveDevice:SurfaceDeviceState={
 connected:true,opened:true,viewport:{width:1280,height:720,dpr:1},mode:'live',reason:'LIVE.'
};

test('PF-01 / PF-18 / PF-19: build-locked stays safe, ready MP4 and 3D can open a QA-gated output',()=>{
 const buildLocked=evaluatePerformOutputSummary({
  hardwareEnabled:false,source:'webcam',cameraOk:true,identityOk:true,floorOk:true,
  floorDevice:offlineDevice,bodyDevice:offlineDevice,floorQaOk:true,bodyQaOk:true,operatorConfirm:true
 });
 assert.equal(buildLocked.primaryAction.kind,'build-locked');
 assert.equal(buildLocked.globalStatus.label,'Preview siap');
 assert.equal(buildLocked.canOpenOutput,false);

 for(const simSource of ['video','simulator'] as const){
  const sim=evaluatePerformOutputSummary({
   hardwareEnabled:true,source:simSource,cameraOk:true,identityOk:true,floorOk:true,
   floorDevice:offlineDevice,bodyDevice:offlineDevice,floorQaOk:true,bodyQaOk:true,operatorConfirm:true
  });
  assert.equal(sim.primaryAction.kind,'open-output');
  assert.equal(sim.globalStatus.label,'Preview siap');
  assert.equal(sim.canOpenOutput,true);
 }
});

test('PF-02 / PF-08 / PF-09: dynamic Perform CTA guides setup -> open output -> Map QA -> explicit LIVE -> monitor',()=>{
 const noCam=evaluatePerformOutputSummary({
  hardwareEnabled:true,source:null,cameraOk:false,identityOk:false,floorOk:false,
  floorDevice:offlineDevice,bodyDevice:offlineDevice,floorQaOk:false,bodyQaOk:false,operatorConfirm:false
 });
 assert.equal(noCam.primaryAction.kind,'fix-setup');
 assert.equal(noCam.globalStatus.label,'Belum siap');

 const readyToOpen=evaluatePerformOutputSummary({
  hardwareEnabled:true,source:'webcam',cameraOk:true,identityOk:true,floorOk:true,
  floorDevice:offlineDevice,bodyDevice:offlineDevice,floorQaOk:false,bodyQaOk:false,operatorConfirm:false
 });
 assert.equal(readyToOpen.primaryAction.kind,'open-output');
 assert.equal(readyToOpen.primaryAction.label,'Buka Output Proyektor');

 const connectedNeedsQa=evaluatePerformOutputSummary({
  hardwareEnabled:true,source:'webcam',cameraOk:true,identityOk:true,floorOk:true,
  floorDevice:blackoutDevice,bodyDevice:offlineDevice,floorQaOk:false,bodyQaOk:false,operatorConfirm:false
 });
 assert.equal(connectedNeedsQa.primaryAction.kind,'run-qa');
 assert.equal(connectedNeedsQa.floorBadge.status,'Blackout');
 assert.equal(connectedNeedsQa.bodyBadge.status,'Offline');

 const qaPassedReadyForLive=evaluatePerformOutputSummary({
  hardwareEnabled:true,source:'webcam',cameraOk:true,identityOk:true,floorOk:true,
  floorDevice:blackoutDevice,bodyDevice:testDevice,floorQaOk:true,bodyQaOk:false,operatorConfirm:false
 });
 assert.equal(qaPassedReadyForLive.primaryAction.kind,'arm-live');
 assert.equal(qaPassedReadyForLive.bodyBadge.status,'Test');

 const activeLive=evaluatePerformOutputSummary({
  hardwareEnabled:true,source:'webcam',cameraOk:true,identityOk:true,floorOk:true,
  floorDevice:liveDevice,bodyDevice:blackoutDevice,floorQaOk:true,bodyQaOk:false,operatorConfirm:true
 });
 assert.equal(activeLive.primaryAction.kind,'monitor-live');
 assert.equal(activeLive.globalStatus.label,'LIVE');
 assert.equal(deriveSurfaceBadge('floor',liveDevice).status,'LIVE');
});

test('PF-03 / PF-06 / UI-CONSISTENCY: Perform reuses DualSurfaceSessionStore, never opens extra camera, and shares unified 1252px minimal chrome across all 4 workspaces',()=>{
 const consoleSrc=read('../src/studio/v3/OperatorStageConsole.tsx');
 const storeSrc=read('../src/footprints/stage-optics/DualSurfaceSessionStore.ts');
 const navCss=read('../src/studio/v3/ia-r1-four-workspaces.css');
 const trackCss=read('../src/studio/v3/trk09-ux-polish.css');
 const composeCss=read('../src/studio/v3/mapping-studio-v4.css');
 const mapCss=read('../src/footprints/stage-optics/dual-surface-routing.css');
 const performCss=read('../src/studio/v3/ops-r1-perform.css');

 // Single output store ownership, zero duplicate ProjectionLink or getUserMedia in Perform
 assert.match(consoleSrc,/openDualSurfaceOutputWindow/);
 assert.match(consoleSrc,/blackoutAllDualSurfaces/);
 assert.match(consoleSrc,/armDualSurfaceLiveFromPerform/);
 assert.ok(!consoleSrc.includes('new ProjectionLink'));
 assert.ok(!consoleSrc.includes('getUserMedia('));
 assert.match(storeSrc,/links\[id\]\.focusOutput\(\)/);

 // Unified 1252px centered nav + headers + laptop-safe monitor height caps
 for(const css of [navCss,trackCss,composeCss,mapCss,performCss]){
  assert.match(css,/max-width:1252px/);
 }
 assert.match(composeCss,/@media\(max-height:850px\)/);
 assert.match(performCss,/@media\(max-height:850px\)/);
});
