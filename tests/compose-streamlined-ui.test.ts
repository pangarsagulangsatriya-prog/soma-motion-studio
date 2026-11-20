import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMPOSE_VIEW_TABS} from '../src/studio/v3/composeLowerBodyModel.ts';

const composer=()=>readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');
const css=()=>readFileSync(new URL('../src/studio/v3/cpux-compose-focus.css',import.meta.url),'utf8');

test('Compose navigation keeps five relevant modes and SPLIT',()=>{
 assert.deepEqual(COMPOSE_VIEW_TABS.map(({id})=>id),
  ['FLOOR','LEG A','LEG B','SPLIT','SKELETON']);
 assert.equal(COMPOSE_VIEW_TABS.some(x=>x.id==='FOOT'),false);
 const ui=composer();
 assert.doesNotMatch(ui,/>CAM · \{experimentSource/);
 assert.match(ui,/COMPOSE_VIEW_TABS\.map/);
});
test('Compose SKELETON uses full-width monitor without legacy lower-body inspector',()=>{
 const ui=composer();
 const style=css();
 assert.match(ui,/data-compose-view=\{monitorView\}/);
 assert.match(ui,/data-compose-dock=\{/);
 assert.match(ui,/hidden=\{monitorView==='SKELETON'\|\|/);
 assert.match(style,/\.s64-layout\[data-compose-dock="wide"\]/);
 assert.match(style,/\.cp02-inspector\[hidden\]/);
 assert.match(style,/data-compose-view="SKELETON"/);
});
test('Compose LEG A/B and SPLIT retain opt-in controls, never disable masker',()=>{
 const ui=composer();
 assert.match(ui,/setLegControlsOpen\(false\)/);
 assert.match(ui,/aria-expanded=\{legControlsOpen\}/);
 assert.match(ui,/Atur kaki/);
 assert.match(ui,/LowerBodyQuickInspector/);
 assert.match(ui,/renderLowerBodyStageMonitor/);
 assert.match(ui,/paintComposeSkeletonMonitor/);
});
test('Compose skeleton black/input toggle stays adjacent to monitor modes',()=>{
 const ui=composer();
 assert.match(ui,/aria-label="Latar skeleton"/);
 assert.match(ui,/setSkeletonBackdrop\('black'\)/);
 assert.match(ui,/setSkeletonBackdrop\('input'\)/);
 assert.match(css(),/\.uxr3-compose-preview-bar>\.cp-compose-skeleton-controls/);
});
