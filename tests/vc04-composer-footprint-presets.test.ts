import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripRetiredVisualLayers,V5_COMPOSER_KEY,V5_PRESET_KEY} from '../src/studio/v3/resetVisualMigration.ts';
const src=readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');
test('RESET-00 VC04: retained Stage compositions preserve only layout/media, not FX presets',()=>{
 assert.match(src,/type Snapshot=\{version:1;composition:Composition;selected:Surface;footprint\?:FootprintConfig\}/);
 assert.match(src,/const key=V5_COMPOSER_KEY/);
 assert.doesNotMatch(src,/savePreset|soma-ia-presets|HydraEffectInspector/);
 assert.equal(V5_COMPOSER_KEY,'soma-s64-composer-v5');
 assert.equal(V5_PRESET_KEY,'soma-s64-presets-v5');
});
test('RESET-00 VC04: restored media layout strips old visual recipes before use',()=>{
 const input={FLOOR:[{id:'asset',mediaId:'asset-video',recipe:'contact-reveal',opacity:90},{id:'old',mediaId:'@stage:hydra',opacity:50}]};
 const output=stripRetiredVisualLayers(input);
 assert.deepEqual(output.FLOOR.map(layer=>layer.id),['asset']);
 assert.equal(output.FLOOR[0].opacity,90);
 assert.ok(!('recipe' in output.FLOOR[0]));
 assert.equal(input.FLOOR[0].recipe,'contact-reveal');
});
test('RESET-00 VC04: legacy snapshot footprint validation still prevents malformed data',()=>{
 assert.match(src,/x\.footprint===undefined\|\|validFootprint\(x\.footprint\)/);
 assert.match(src,/Number\.isFinite\(x\.life\)/);
 assert.match(src,/Number\.isFinite\(x\.size\)/);
 assert.ok(src.includes('x.colors?.[k]'));
});
