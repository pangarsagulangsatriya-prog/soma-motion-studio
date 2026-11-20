import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {materialMode,collectMaterialImpulses,MATERIAL_FRAG} from '../src/footprints/scenes/FootprintGpuMaterialRuntime.ts';
import {normalizeHydraFootprintSettings,hydraVisualAuthorizesPhysicalOutput}
 from '../src/footprints/scenes/hydraFootprintModel.ts';
import {flagshipHydraPatch} from '../src/studio/v3/flagshipVisualModel.ts';
import type {FootMotionEventV2} from '../src/footprints/scenes/FootMotionEventV2.ts';

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const make=(id:string,kind:FootMotionEventV2['kind'],x:number,y:number,verified=kind==='contact'):FootMotionEventV2=>({
 schema:'soma.foot-motion-event',version:2,eventId:id,originEventId:id,
 sessionId:'rift-test',generation:1,actorId:'A',foot:'left',kind,
 source:'video',x,y,atMs:1000,speed:.45,confidence:1,
 verified,verification:verified?'video-estimate':'unverified',
 coordinateBasis:'image-2d'
});

test('FV03: RIFT uses distinct GPU material mode and preserves selected Flow graph',()=>{
 const rift=normalizeHydraFootprintSettings(flagshipHydraPatch('rift'));
 const trace=normalizeHydraFootprintSettings(flagshipHydraPatch('trace'));
 assert.equal(materialMode(rift),'rift');
 assert.equal(rift.style,'flow');
 assert.equal(rift.artwork,'negative-memory');
 assert.equal(materialMode(trace),'trace');
 assert.equal(materialMode({...rift,catalogVisual:true}),null);
});
test('FV03: verified contact/slide/pivot provide bounded local influences without duplicates',()=>{
 let impulses=collectMaterialImpulses([],[make('c','contact',.3,.4)],1000);
 impulses=collectMaterialImpulses(impulses,[make('s','slide',.5,.4,false),make('p','pivot',.5,.55,false)],1100);
 assert.deepEqual(impulses.map(i=>i.kind),[0,1,2]);
 assert.ok(impulses[1].dx>0);
 assert.ok(impulses[2].dy>0);
 assert.equal(collectMaterialImpulses(impulses,[make('c','contact',.3,.4)],1200).length,3);
 assert.equal(collectMaterialImpulses(impulses,[make('bad','contact',.3,.4,false)],1200).length,3);
});
test('FV03: UV displacement is bounded to contact influence; untouched archive samples original texture',()=>{
 assert.match(MATERIAL_FRAG,/riftShift\+=zone/);
 assert.match(MATERIAL_FRAG,/float zone=exp\(-dot\(diff,diff\)\*420\.\)/);
 assert.match(MATERIAL_FRAG,/vec2 uvRift=clamp\(st\+clamp\(riftShift/);
 assert.match(MATERIAL_FRAG,/vec3 displaced=texture\(uSource,uvRift\)/);
 assert.match(MATERIAL_FRAG,/vec3 rift=mix\(original,displaced,split\*uMix\)/);
 assert.match(MATERIAL_FRAG,/uMode<1\.5\?mix\(original,echo/);
});
test('FV03: RIFT archive texture is drawn directly from selected Track/import source, never recursion',()=>{
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(composer,/riftSourceRef\.current/);
 assert.match(composer,/experimentInputCanvas\?\.current:mediaEls\.current\.get\(sourceId\)/);
 assert.match(composer,/archiveCtx\.drawImage\(archiveInput,0,0,640,360\)/);
 assert.doesNotMatch(composer,/archiveCtx\)render\(archiveCtx,'FLOOR'/);
 assert.match(composer,/experimentReadyRef\.current/);
 assert.match(composer,/aria-label="RIFT archive source"/);
 assert.match(composer,/onArchiveHydraChangeRef\.current\?\.\(false\)/);
});
test('FV03: Hydra stage preserves RIFT and confines global noise to non-RIFT styles',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const runtime=read('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 assert.match(stage,/const isRift=hydraSettingsRef\.current\.style==='flow'/);
 assert.match(stage,/engine\.generation,now,isRift\)/);
 assert.match(runtime,/const riftArchive=archiveSource&&materialMode\(this\.settings\)==='rift'/);
 assert.match(runtime,/materialSource=this\.gpuMaterial\.paint\(source,fresh,generation,nowMs,this\.settings\)/);
 assert.match(runtime,/else if\(materialMode\(this\.settings\)==='rift'\)/);
 assert.match(runtime,/graph=source\(\)/);
 assert.match(runtime,/this\.gpuMaterial\?\.reset\(\)/);
});
test('FV03: hardware output remains unauthorized',()=>{
 assert.equal(hydraVisualAuthorizesPhysicalOutput(),false);
 const composer=read('../src/studio/v3/composeLayerPlan.ts');
 assert.match(composer,/if\(physical&&\(kind==='input'\|\|kind==='hydra'\|\|kind==='scene'\)\)return \[\]/);
});
