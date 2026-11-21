import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_COMPOSE_IMPORTS,MAX_COMPOSE_IMPORT_SIZE,SHARED_TRACK_MP4_ID,trackAssetFromClip,
 importedAssetFromFile,sharedAssetChoices,sharedAssetKind} from '../src/studio/v3/sharedAssetModel.ts';

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');

test('CP06: Track MP4 appears under a stable shared source ID and has no duplicated blob URL',()=>{
 const clip={name:'footwork A-B.mp4',size:52_000_000,type:'video/mp4'};
 const asset=trackAssetFromClip(clip);
 assert.equal(asset?.id,SHARED_TRACK_MP4_ID);
 assert.equal(asset?.name,'footwork A-B.mp4');
 assert.equal(asset?.origin,'track');
 assert.equal(asset?.url,undefined);
 assert.equal(trackAssetFromClip(null),null);
 assert.equal(trackAssetFromClip({...clip,name:'new.mp4'})?.id,asset?.id);
});
test('CP06: imported images/videos have reusable, independent IDs and validation',()=>{
 const image=importedAssetFromFile({name:'archive.png',type:'image/png',size:1234},'asset-img','blob:one');
 const video=importedAssetFromFile({name:'walking.mp4',type:'video/mp4',size:12345},'asset-vid','blob:two');
 assert.equal(image?.origin,'import');assert.equal(image?.kind,'image');
 assert.equal(video?.kind,'video');assert.equal(video?.url,'blob:two');
 assert.equal(importedAssetFromFile({name:'unsafe.exe',type:'application/octet-stream',size:300},'x','blob:x'),null);
 assert.equal(importedAssetFromFile({name:'huge.mp4',type:'video/mp4',size:MAX_COMPOSE_IMPORT_SIZE+1},'x','blob:x'),null);
 assert.equal(sharedAssetKind('','clip.webm'),'video');
 assert.equal(MAX_COMPOSE_IMPORTS,48);
});
test('CP06: source choices include the Track clip exactly once and imported assets by name',()=>{
 const track=trackAssetFromClip({name:'Tracking 01.mp4',size:50,type:'video/mp4'});
 const imported=importedAssetFromFile({name:'texture.png',size:1,type:'image/png'},'image-1','blob:img');
 assert.ok(track&&imported);
 assert.deepEqual(sharedAssetChoices([track,imported]),[
  {id:SHARED_TRACK_MP4_ID,label:'Track MP4 · Tracking 01.mp4'},
  {id:'image-1',label:'texture.png'}
 ]);
});
test('CP06: Track owns video, Composer imports registered assets without starting second Track decoder',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 const registry=read('../src/studio/v3/useSharedAssetRegistry.ts');
 assert.match(stage,/useSharedAssetRegistry\(experimentalKind==='video'\?experimentClip:null\)/);
 assert.match(stage,/sharedAssets=\{sharedAssetRegistry\.assets\}/);
 assert.match(composer,/if\(m\.origin==='track'\|\|!m\.url/);
 assert.match(composer,/media\.map\(m=><div className="cp06-asset"/);
 assert.match(composer,/onImportAssets\(files\)/);
 assert.match(composer,/sharedAssetChoices\(media\)/);
 assert.match(registry,/URL\.revokeObjectURL\(url\)/);
});
test("CP06: shared MP4 source remains opt-in and rejects a raw live-camera input",()=>{
 const plan=read('../src/studio/v3/composeLayerPlan.ts');
 assert.doesNotMatch(plan,/if\(physical&&experiment\)return \[\]/);
 assert.match(plan,/if\(physical&&kind==='input'&&!experiment\)return \[\]/);
 assert.match(plan,/@stage:hydra/);
 assert.match(plan,/@scene:/);
});
