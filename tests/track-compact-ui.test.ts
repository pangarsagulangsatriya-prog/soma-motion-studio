import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trackStatus} from '../src/studio/v3/trackViewModel.ts';

const base={selection:null,phase:'idle' as const,message:'Pilih sumber gerak.',
 videoLoaded:false,videoVisible:null,cameraOn:false,frameFresh:false,
 visibleCount:0,performerCount:2 as const};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('empty Track uses a single concise source prompt',()=>{
 assert.deepEqual(trackStatus(base),{label:'Pilih sumber',detail:'',kind:'idle'});
});
test('phone pairing is actionable without repeating the long QR instructions',()=>{
 const status=trackStatus({...base,selection:'phone',phase:'pairing',message:'Scan QR'});
 assert.equal(status.label,'Menunggu HP');
 assert.equal(status.detail,'Buka pairing QR');
 assert.equal(status.kind,'busy');
});
test('camera active is distinct from a validated motion pose',()=>{
 const camera={...base,selection:'webcam' as const,phase:'ready' as const,cameraOn:true};
 assert.deepEqual(trackStatus(camera),{label:'Kamera aktif',detail:'Menunggu pose',kind:'busy'});
 assert.deepEqual(trackStatus({...camera,frameFresh:true,visibleCount:1}),{
  label:'Tracking aktif',detail:'1 / 2 aktor',kind:'ready'});
});
test('MP4 selection is not reported as tracking ready until the pose appears',()=>{
 const video={...base,selection:'video' as const,phase:'experiment' as const};
 assert.equal(trackStatus(video).label,'Belum ada video');
 assert.equal(trackStatus({...video,videoLoaded:true}).kind,'busy');
 assert.deepEqual(trackStatus({...video,videoLoaded:true,videoVisible:2}),{
  label:'Video aktif',detail:'2 / 2 aktor',kind:'ready'});
});
test('source errors show the actual actionable message',()=>{
 const status=trackStatus({...base,selection:'webcam',phase:'error',message:'Izin kamera ditolak'});
 assert.deepEqual(status,{label:'Periksa sumber',detail:'Izin kamera ditolak',kind:'error'});
});
test('Track keeps its advanced tool, preview interactions and safe Composer split',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/track-compact.css');
 assert.match(stage,/import '\.\/track-compact\.css'/);
 assert.match(stage,/inputFocusEnabled/);
 assert.match(stage,/onKeyDown=\{event=>\{if\(event.key==='Escape'\)/);
 assert.match(stage,/if\(await chooseSource\(option.id\)\)/);
 assert.match(stage,/hidden=\{!composerOpen\|\|mappingOpen\}/);
 assert.match(css,/data-workspace=track/);
 assert.match(css,/\.fp-unified-transport\[data-has-input=false\]/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
