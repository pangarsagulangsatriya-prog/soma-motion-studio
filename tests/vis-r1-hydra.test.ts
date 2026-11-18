import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 HYDRA_FOOTPRINT_DEFAULTS,HYDRA_FOOTPRINT_STYLES,
 normalizeHydraFootprintSettings,accumulateHydraMotion,
 HYDRA_MOTION_IDLE,hydraVisualAuthorizesPhysicalOutput
} from '../src/footprints/scenes/hydraFootprintModel.ts';
const code=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('VIS-R1: Hydra defaults off; new scenes cannot bypass output QA',()=>{
 assert.equal(HYDRA_FOOTPRINT_DEFAULTS.enabled,false);
 assert.equal(hydraVisualAuthorizesPhysicalOutput(),false);
 assert.ok(HYDRA_FOOTPRINT_STYLES.length>=4);
});
test('VIS-R1: limits are finite and feedback/distortion cannot exceed guardrails',()=>{
 const p=normalizeHydraFootprintSettings({enabled:true,style:'flow',mix:4,feedback:2,distortion:20,motion:-1,quality:'ultra'});
 assert.equal(p.style,'flow');assert.equal(p.enabled,true);
 assert.equal(p.feedback,.65);assert.equal(p.distortion,.4);
 assert.equal(p.mix,1);assert.equal(p.motion,0);assert.equal(p.quality,'medium');
 assert.equal(normalizeHydraFootprintSettings({mix:NaN}).mix,HYDRA_FOOTPRINT_DEFAULTS.mix);
 assert.equal(normalizeHydraFootprintSettings({feedback:Infinity}).feedback,HYDRA_FOOTPRINT_DEFAULTS.feedback);
});
test('VIS-R1: verified contacts increase energy; stationary presence cannot stamp',()=>{
 const idle=accumulateHydraMotion(HYDRA_MOTION_IDLE,[{kind:'presence',x:.5,y:.5,speed:0,verified:false}],1000,0);
 assert.equal(idle.contacts,0);assert.equal(idle.energy,0);
 const step=accumulateHydraMotion(idle,[{kind:'contact',x:.2,y:.7,speed:0,verified:true}],1000,1000);
 assert.equal(step.contacts,1);assert.equal(step.x,.2);assert.equal(step.y,.7);
 const falseContact=accumulateHydraMotion(idle,[{kind:'contact',x:.3,y:.6,speed:0,verified:false}],1000,1000);
 assert.equal(falseContact.contacts,0);
});
test('VIS-R1: static stage composition uses persistent Hydra runtime and no second camera source',()=>{
 const runtime=code('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 const stage=code('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(runtime,/autoLoop:false/);
 assert.match(runtime,/makeGlobal:false/);
 assert.match(runtime,/import\('hydra-synth'\)/);
 assert.match(runtime,/this\.engine\.tick\(delta\)/);
 assert.ok(!runtime.includes('getUserMedia('));
 assert.match(stage,/hydraRuntime\.current\.tick\(cleanFloorOutput\.current/);
 assert.match(stage,/engine\.canonicalRecent/);
 assert.match(stage,/floorCanvas=\{cleanFloorOutput\}/);
});
test('VIS-R1: output fallback keeps original FLOOR raster and respects explicit enable',()=>{
 const stage=code('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(stage,/data-hydra-visible=\{hydraSettings\.enabled&&hydraStatus==="ready"\}/);
 assert.match(stage,/setHydraStatus\('off'\)/);
 const runtime=code('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 assert.match(runtime,/status='fallback'/);
 assert.match(runtime,/dispose\(\)/);
});
