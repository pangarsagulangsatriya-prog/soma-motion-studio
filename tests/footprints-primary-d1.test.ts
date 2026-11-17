import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/studio/v3/FootprintsExperimentalSource.tsx',import.meta.url),'utf8');
const lab=readFileSync(new URL('../src/stage/VideoMotionLab.tsx',import.meta.url),'utf8');
const benchmark=readFileSync(new URL('../src/stage/D1MoveNetBenchmark.tsx',import.meta.url),'utf8');

test('D1 MoveNet runs inside primary Footprints video source with its existing MP4',()=>{
 assert.match(source,/import \{D1MoveNetBenchmark\}/);
 assert.match(source,/kind==='video'&&detectorOpen/);
 assert.match(source,/sourceUrl=\{url\}/);
 assert.match(source,/sourceName=\{clip\?\.name\?\?null\}/);
 assert.match(source,/fp-d1-main-panel/);
 assert.match(source,/video\.current\?\.pause\(\)/);
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
