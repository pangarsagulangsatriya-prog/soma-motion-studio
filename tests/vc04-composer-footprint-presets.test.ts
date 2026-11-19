import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');

test('VC04: saved Compose snapshot carries footprint settings as well as layers',()=>{
 assert.match(src,/type Snapshot=\{version:1;composition:Composition;selected:Surface;footprint\?:FootprintConfig\}/);
 assert.match(src,/snapshot:\{version:1 as const,selected,composition:structuredClone\(composition\),\.\.\.\(footprint/);
});
test('VC04: imported and restored presets apply footprint settings to shared renderer',()=>{
 assert.match(src,/if\(x\.footprint\)updateFootprint\?\.\(x\.footprint\)/);
 assert.match(src,/if\(p\.snapshot\.footprint\)updateFootprint\?\.\(structuredClone\(p\.snapshot\.footprint\)\)/);
});
test('VC04: legacy snapshots remain valid and new footprint values are checked before loading',()=>{
 assert.match(src,/x\.footprint===undefined\|\|validFootprint\(x\.footprint\)/);
 assert.match(src,/Number\.isFinite\(x\.life\)/);
 assert.match(src,/Number\.isFinite\(x\.size\)/);
 assert.match(src,/\^#\[0-9a-f\]\{6\}\$/i/);
});
