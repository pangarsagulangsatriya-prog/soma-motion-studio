import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {materialMode,collectMaterialImpulses,MAX_MATERIAL_IMPULSES,MATERIAL_LIFE_MS,
 MATERIAL_FRAG,MATERIAL_VERT} from '../src/footprints/scenes/FootprintGpuMaterialRuntime.ts';
import type {FootMotionEventV2} from '../src/footprints/scenes/FootMotionEventV2.ts';
import {flagshipHydraPatch} from '../src/studio/v3/flagshipVisualModel.ts';
import {normalizeHydraFootprintSettings,hydraVisualAuthorizesPhysicalOutput} from '../src/footprints/scenes/hydraFootprintModel.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const event=(id:string,kind:FootMotionEventV2['kind'],x:number,y:number,verified=kind==='contact'):FootMotionEventV2=>({
 schema:'soma.foot-motion-event',version:2,eventId:id,originEventId:id,
 sessionId:'fv02-test',generation:0,actorId:'A',foot:'left',kind,source:'simulator',x,y,
 speed:.4,atMs:1000,confidence:1,verified,
 verification:verified?'simulated':'unverified',coordinateBasis:'simulated'
});
test('FV02: TRACE and ECHO select distinct GPU material passes; RIFT stays on legacy Flow until FV03',()=>{
 const trace=normalizeHydraFootprintSettings(flagshipHydraPatch('trace'));
 const echo=normalizeHydraFootprintSettings(flagshipHydraPatch('echo'));
 const rift=normalizeHydraFootprintSettings(flagshipHydraPatch('rift'));
 assert.equal(materialMode(trace),'trace');
 assert.equal(materialMode(echo),'echo');
 assert.equal(materialMode(rift),null);
 assert.equal(materialMode({...trace,catalogVisual:true}),null);
});
test('FV02: six verified contacts yield six bounded impulses, repeated input does not double-stamp',()=>{
 let out=collectMaterialImpulses([],Array.from({length:6},(_,i)=>event('c'+i,'contact',.2+i*.07,.4)),1000);
 assert.equal(out.length,6);
 out=collectMaterialImpulses(out,Array.from({length:6},(_,i)=>event('c'+i,'contact',.2+i*.07,.4)),1100);
 assert.equal(out.length,6);
 assert.equal(out.every(p=>p.kind===0),true);
});
test('FV02: slide and pivot perturb active field; presence and unverified contacts are rejected',()=>{
 let out=collectMaterialImpulses([],[event('c','contact',.3,.4)],1000);
 out=collectMaterialImpulses(out,[event('slide','slide',.5,.42,false),event('pivot','pivot',.49,.49,false),
 event('presence','presence',.2,.2,false),event('bad','contact',.5,.5,false)],1200);
 assert.deepEqual(out.map(p=>p.kind),[0,1,2]);
 assert.ok(out[1].dx>0);
 assert.ok(Math.hypot(out[2].dx,out[2].dy)>0);
});
test('FV02: impulse count, age and coordinates bounded for GPU uniforms',()=>{
 const events=Array.from({length:MAX_MATERIAL_IMPULSES+16},(_,i)=>event('i'+i,'contact',i/100,.5));
 let out=collectMaterialImpulses([],events,1000);
 assert.equal(out.length,MAX_MATERIAL_IMPULSES);
 out=collectMaterialImpulses(out,[],1000+MATERIAL_LIFE_MS+1);
 assert.equal(out.length,0);
 assert.equal(collectMaterialImpulses([],[event('invalid','slide',2,.5,false)],1000).length,0);
});
test('FV02: fragment GPU shader uses SDF shapes, erosion and sampled previous framebuffer',()=>{
 assert.match(MATERIAL_VERT,/#version 300 es/);
 assert.match(MATERIAL_FRAG,/footprintSdf/);
 assert.match(MATERIAL_FRAG,/erosion\+=/);
 assert.match(MATERIAL_FRAG,/texture\(uPrevious,advected\)/);
 assert.match(MATERIAL_FRAG,/uDelta/);
 assert.match(MATERIAL_FRAG,/vec3\(0\.\),vec3\(1\.\)/);
});
test('FV02: Stage owns one Hydra instance and an offscreen two-frame GPU material pass',()=>{
 const runtime=read('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 const gpu=read('../src/footprints/scenes/FootprintGpuMaterialRuntime.ts');
 assert.match(runtime,/new FootprintGpuMaterialRuntime\(document\.createElement\('canvas'\)\)/);
 assert.match(runtime,/materialSource=this\.gpuMaterial\.paint\(/);
 assert.match(runtime,/this\.sourceContext\.drawImage\(materialSource,0,0,640,360\)/);
 assert.match(runtime,/this\.engine\.tick\(delta\)/);
 assert.match(gpu,/gl\.bindFramebuffer\(gl\.FRAMEBUFFER,this\.buffers\[target\]\)/);
 assert.match(gpu,/gl\.blitFramebuffer\(/);
 assert.match(gpu,/this\.reset\(\)/);
 assert.match(runtime,/this\.gpuMaterial\?\.dispose\(\)/);
 assert.ok(!runtime.includes('getUserMedia('));
 assert.equal(hydraVisualAuthorizesPhysicalOutput(),false);
});
