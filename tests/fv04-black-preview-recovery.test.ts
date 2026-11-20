import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('Black preview recovery: synthetic thumbnail events use current performance clock',()=>{
 const src=read('../src/studio/v3/FlagshipLivePreview.tsx');
 assert.match(src,/const thumbnailEpoch=performance\.now\(\)/);
 assert.match(src,/artistic\.ingest\(events,0,thumbnailEpoch\)/);
 assert.match(src,/now-thumbnailEpoch>18000/);
 assert.match(src,/artistic\.paint\(sample,now/);
});
test('Black preview recovery: scene change seeds only recent verified contacts',()=>{
 const src=read('../src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
 assert.match(src,/events\.filter\(event=>event\.kind==='contact'&&event\.verified\)\.slice\(-12\)/);
 assert.match(src,/this\.art\.ingest\(recent,generation,nowMs\)/);
 assert.doesNotMatch(src,/else this\.art\.skipExisting\(events,generation\)/);
});
test('Black preview recovery: Stage shows MP4 until a new verified contact exists',()=>{
 const src=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(src,/lastVerifiedContactRef/);
 assert.match(src,/event\.kind==='contact'&&event\.verified/);
 assert.match(src,/now-lastVerifiedContactRef\.current\.seenAtMs>20000/);
 assert.match(src,/kind==='hydra'\?\(!physical&&\(visualIsWaiting\|\|visualIsEmpty\)\?/);
 assert.match(src,/experimentInputCanvas\?\.current\?\?null/);
 assert.match(src,/MP4 aktif · Menunggu Contact terverifikasi/);
 assert.match(src,/stageStatus=\{visualWaitingForContact\?'waiting-contact':hydraStatus\}/);
});
test('Black preview recovery: hardware output restrictions remain intact',()=>{
 const src=read('../src/studio/v3/composeLayerPlan.ts');
 assert.match(src,/if\(physical&&experiment\)return \[\]/);
 assert.match(src,/if\(physical&&\(kind==='input'\|\|kind==='hydra'\|\|kind==='scene'\)\)return \[\]/);
});
