import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/studio/v3/FootprintsExperimentalSource.tsx',import.meta.url),'utf8');
const lab=readFileSync(new URL('../src/stage/VideoMotionLab.tsx',import.meta.url),'utf8');
const benchmark=readFileSync(new URL('../src/stage/D1MoveNetBenchmark.tsx',import.meta.url),'utf8');

test('Footprints has one active MP4 movement engine with built-in D2, no diagnostic toggle',()=>{
 const engine=readFileSync(new URL('../src/stage/VideoPoseGaitEngine.ts',import.meta.url),'utf8');
 assert.match(source,/new VideoPoseGaitEngine/);
 assert.match(source,/fp-duet-engine-status/);
 assert.doesNotMatch(source,/D1MoveNetBenchmark/);
 assert.match(engine,/new MoveNetIdentityTracker/);
 assert.match(engine,/observeDescriptors\(mapped,descriptors,width,height,atMs\)/);
});

test('D1 is no longer duplicated in the advanced Video Motion Lab',()=>{
 assert.doesNotMatch(lab,/D1MoveNetBenchmark/);
});

test('D1 retains both MoveNet resolutions and never alters physical projection',()=>{
 assert.match(benchmark,/config\(384\)/);
 assert.match(benchmark,/config\(512\)/);
 assert.match(benchmark,/enableTracking:false/);
 assert.match(benchmark,/Tidak menyentuh|tidak menyentuh/);
});
