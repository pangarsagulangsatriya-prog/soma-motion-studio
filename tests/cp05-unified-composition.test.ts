import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composerLayerOrder,composerSourceKind,COMPOSE_STAGE_FLOOR,
 COMPOSE_STAGE_INPUT,COMPOSE_STAGE_HYDRA,COMPOSE_STAGE_BODY} from '../src/studio/v3/composeLayerPlan.ts';

const layer=(mediaId:string,name:string,opacity=100,visible=true,blend='source-over')=>
 ({mediaId,name,opacity,visible,blend});
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('CP05: MP4 + footprint + Hydra + imported media are processed bottom-to-top',()=>{
 const layers=[
  layer(COMPOSE_STAGE_INPUT,'MP4',72),
  layer(COMPOSE_STAGE_FLOOR,'Footprints',100),
  layer(COMPOSE_STAGE_HYDRA,'Hydra texture',50,true,'screen'),
  layer('local-image-42','Archive image',80,true,'multiply')
 ];
 const planned=composerLayerOrder(layers,'FLOOR',false,true);
 assert.deepEqual(planned.map(x=>x.kind),['input','floor','hydra','media']);
 assert.deepEqual(planned.map(x=>x.layer.opacity),[72,100,50,80]);
 assert.deepEqual(planned.map(x=>x.layer.blend),['source-over','source-over','screen','multiply']);
});
test('CP05: disabled or zero-alpha layer is excluded without changing underlying order',()=>{
 const layers=[layer(COMPOSE_STAGE_INPUT,'MP4'),layer(COMPOSE_STAGE_HYDRA,'Hydra',0),
  layer('local-photo','Image',100,false),layer(COMPOSE_STAGE_FLOOR,'Floor')];
 assert.deepEqual(composerLayerOrder(layers,'FLOOR',false,true).map(x=>x.kind),['input','floor']);
});
test('CP05: physical output excludes experiment source and unknown virtual source',()=>{
 const stages=[layer(COMPOSE_STAGE_INPUT,'MP4'),layer(COMPOSE_STAGE_HYDRA,'Hydra'),
  layer(COMPOSE_STAGE_FLOOR,'Footprints'),layer('asset','Imported')];
 assert.deepEqual(composerLayerOrder(stages,'FLOOR',true,true),[]);
 assert.deepEqual(composerLayerOrder(stages,'FLOOR',true,false).map(x=>x.kind),['floor','media']);
 assert.equal(composerSourceKind(layer('@stage:untrusted','Unknown'),'FLOOR'),'empty');
 assert.equal(composerSourceKind(layer(COMPOSE_STAGE_BODY,'Leg'),'BODY A'),'body');
});
test('CP05: legacy local presets still recover stage FLOOR and BODY source',()=>{
 assert.equal(composerSourceKind(layer('','Floor path'),'FLOOR'),'floor');
 assert.equal(composerSourceKind(layer('','Body A archive'),'BODY A'),'body');
 assert.equal(composerSourceKind(layer('','Layer'),'FLOOR'),'empty');
});
test('CP05: SurfaceComposer runs all layer sources through same opacity/blend/recipe path',()=>{
 const src=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(src,/for\(const \{layer,kind\} of composerLayerOrder\(/);
 assert.match(src,/ctx\.globalAlpha=Math\.min\(1,Math\.max\(0,layer\.opacity\/100\*envelope\)\)/);
 assert.match(src,/ctx\.globalCompositeOperation=layer\.blend/);
 assert.match(src,/experimentFloorCanvas\?\.current\?\?null/);
 assert.match(src,/kind==='hydra'/);
 assert.match(src,/if\(overlayOnly&&kind!=='media'\)continue/);
 assert.doesNotMatch(src,/if\(offlineRaster!=='none'\)/);
});
test('CP05: Inspector exposes source and opacity plus stack source actions',()=>{
 const src=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(src,/aria-label="Pilih sumber layer"/);
 assert.match(src,/\+ MP4 \/ INPUT/);
 assert.match(src,/\+ Footprints/);
 assert.match(src,/\+ Hydra/);
});
