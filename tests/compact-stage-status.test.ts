import test from 'node:test';
import assert from 'node:assert/strict';
import {compactFootprintsReadiness,softwareOutputIndicator}
 from '../src/studio/v3/compactStageStatusModel.ts';
import type {DualSurfaceState} from '../src/footprints/stage-optics/DualSurfaceTelemetry.ts';
import type {LegacyOutputStatus} from '../src/studio/v3/unifiedStageStatus.ts';

const base={
 cameraOn:false,cameraBusy:false,cameraError:'',bodySelected:false,
 frameFresh:false,visibleCount:0,performerCount:2 as 1|2,
 identityAmbiguous:false,identityMatchedFrame:false,floorCalibrated:false,floorConfirmed:false,cameraMatched:false
};
const dualState=(surface:'body'|'floor',overrides:Partial<DualSurfaceState>={}):DualSurfaceState=>({
 surface,reported:false,opened:false,connected:false,mode:'offline',qa:'incomplete',
 reason:'',sampledAtMs:0,...overrides
});
const dual={body:dualState('body'),floor:dualState('floor')};
const legacy:LegacyOutputStatus={opened:false,connected:false,mode:'blackout',approved:false};

test('no camera collapses readiness to a single neutral source indicator',()=>{
 const items=compactFootprintsReadiness(base);
 assert.equal(items.length,1);
 assert.deepEqual(items[0]&&[items[0].id,items[0].level],['source','idle']);
 assert.equal(items[0]?.value,'Belum terhubung');
});
test('camera connection never claims Body readiness before Body is selected',()=>{
 const items=compactFootprintsReadiness({...base,cameraOn:true,frameFresh:true});
 assert.equal(items.length,1);assert.equal(items[0]?.level,'warn');
 assert.equal(items[0]?.value,'Pilih Body');
});
test('a busy or failed input is shown as such instead of ready',()=>{
 assert.equal(compactFootprintsReadiness({...base,cameraBusy:true})[0]?.level,'busy');
 assert.equal(compactFootprintsReadiness({...base,cameraOn:true,cameraError:'permission denied'})[0]?.level,'warn');
});
test('camera Body alone cannot imply valid tracking or calibrated floor',()=>{
 const items=compactFootprintsReadiness({...base,cameraOn:true,bodySelected:true});
 assert.deepEqual(items.map(item=>item.id),['source','tracking','floor']);
 assert.equal(items[0]?.level,'ok');
 assert.equal(items[1]?.level,'warn');
 assert.equal(items[2]?.level,'warn');
});
test('identity ambiguity prevents a false green tracking indicator',()=>{
 const items=compactFootprintsReadiness({...base,cameraOn:true,bodySelected:true,
  frameFresh:true,visibleCount:2,identityAmbiguous:true,identityMatchedFrame:true,
  floorCalibrated:true,floorConfirmed:true,cameraMatched:true});
 assert.equal(items[1]?.value,'Identitas ambigu');
 assert.equal(items[1]?.level,'warn');
 assert.equal(items[2]?.level,'ok');
});
test('missing second performer is explicitly called out',()=>{
 const items=compactFootprintsReadiness({...base,cameraOn:true,bodySelected:true,
  frameFresh:true,visibleCount:1,identityMatchedFrame:true});
 assert.equal(items[1]?.value,'Performer kurang');
 assert.match(items[1]?.detail??'',/1 dari 2/);
});
test('floor readiness requires calibration, confirmation, matching camera and fresh frame',()=>{
 const ready={...base,cameraOn:true,bodySelected:true,frameFresh:true,visibleCount:2,identityMatchedFrame:true,
  floorCalibrated:true,floorConfirmed:true,cameraMatched:true};
 assert.equal(compactFootprintsReadiness(ready)[2]?.level,'ok');
 assert.equal(compactFootprintsReadiness({...ready,cameraMatched:false})[2]?.level,'warn');
 assert.equal(compactFootprintsReadiness({...ready,floorConfirmed:false})[2]?.level,'warn');
 assert.equal(compactFootprintsReadiness({...ready,frameFresh:false})[2]?.level,'warn');
});
test('offline software output never appears physically ready',()=>{
 const out=softwareOutputIndicator(legacy,dual);
 assert.equal(out.state,'idle');
 assert.match(out.label,/belum tersambung/);
 assert.match(out.detail,/Projector/);
});
test('legacy LIVE is labeled a software command rather than physical light',()=>{
 const out=softwareOutputIndicator({...legacy,opened:true,connected:true,mode:'live'},dual);
 assert.equal(out.state,'commanded');
 assert.match(out.label,/LIVE diperintahkan/);
 assert.match(out.detail,/belum terukur/);
});
test('mixed BODY/FLOOR software states are kept distinct',()=>{
 const out=softwareOutputIndicator(legacy,{
  body:dualState('body',{reported:true,opened:true,connected:true,mode:'live'}),
  floor:dualState('floor',{reported:true,opened:true,connected:true,mode:'blackout'})
 });
 assert.match(out.label,/BODY LIVE diperintahkan/);
 assert.match(out.label,/FLOOR Blackout diperintahkan/);
 assert.equal(out.state,'commanded');
});
