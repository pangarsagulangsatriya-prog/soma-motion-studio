import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composerLayerOrder,composerSourceKind,COMPOSE_STAGE_FLOOR,
 COMPOSE_STAGE_INPUT,COMPOSE_STAGE_BODY} from '../src/studio/v3/composeLayerPlan.ts';

const layer=(mediaId:string,name:string,opacity=100,visible=true,blend='source-over')=>
 ({mediaId,name,opacity,visible,blend});
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('RESET-00 CP05: video, tracking and imported media preserve bottom-to-top composition',()=>{
 const layers=[layer(COMPOSE_STAGE_INPUT,'MP4',72),layer(COMPOSE_STAGE_FLOOR,'Floor',100),
  layer('@stage:hydra','Retired GPU',100),layer('@scene:snowfall','Retired scene',100),
  layer('local-image-42','Archive',80,true,'multiply')];
 const planned=composerLayerOrder(layers,'FLOOR',false,true);
 assert.deepEqual(planned.map(x=>x.kind),['input','floor','media']);
 assert.deepEqual(planned.map(x=>x.layer.opacity),[72,100,80]);
});
test('RESET-00 CP05: hidden or zero-alpha layers excluded without reordering',()=>{
 const layers=[layer(COMPOSE_STAGE_INPUT,'MP4'),layer('photo','Hidden',100,false),
  layer(COMPOSE_STAGE_FLOOR,'Floor'),layer('photo2','Transparent',0)];
 assert.deepEqual(composerLayerOrder(layers,'FLOOR',false,true).map(x=>x.kind),['input','floor']);
});
test('RESET-00 CP05: physical projection keeps MP4 layers while excluding retired sources',()=>{
 const layers=[layer(COMPOSE_STAGE_INPUT,'MP4'),layer('@stage:hydra','Old Hydra'),
  layer('@scene:footprints','Old scene'),layer(COMPOSE_STAGE_FLOOR,'Floor'),layer('asset','Archive')];
 assert.deepEqual(composerLayerOrder(layers,'FLOOR',true,true).map(x=>x.kind),['input','floor','media']);
 assert.deepEqual(composerLayerOrder(layers,'FLOOR',true,false).map(x=>x.kind),['floor','media']);
 assert.equal(composerSourceKind(layer('@stage:unknown','Unknown'),'FLOOR'),'empty');
 assert.equal(composerSourceKind(layer(COMPOSE_STAGE_BODY,'Leg'),'BODY A'),'body');
});
test('RESET-00 CP05: legacy base tracking layer keeps FLOOR/BODY identification',()=>{
 assert.equal(composerSourceKind(layer('','Floor path'),'FLOOR'),'floor');
 assert.equal(composerSourceKind(layer('','Body A archive'),'BODY A'),'body');
 assert.equal(composerSourceKind(layer('','Layer'),'FLOOR'),'empty');
});
test('RESET-00 CP05: compositor retains alpha, blend, source and media routing',()=>{
 const src=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(src,/for\(const \{layer,kind\} of composerLayerOrder\(/);
 assert.match(src,/ctx\.globalAlpha=Math\.min\(1,Math\.max\(0,layer\.opacity\/100\)\)/);
 assert.match(src,/ctx\.globalCompositeOperation=layer\.blend/);
 assert.match(src,/experimentFloorCanvas\?\.current\?\?null/);
 assert.match(src,/if\(overlayOnly&&kind!=='media'\)continue/);
 assert.doesNotMatch(src,/kind==='hydra'|kind==='scene'|SceneEffectBrowser/);
});
test('RESET-00 CP05: layer editor lists media and tracking only',()=>{
 const src=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(src,/aria-label="Pilih sumber layer"/);
 assert.match(src,/\+ MP4 \/ INPUT/);
 assert.match(src,/\+ FLOOR \/ Track/);
 assert.doesNotMatch(src,/\+ Hydra|\+ Scene|FlagshipInspector/);
});
