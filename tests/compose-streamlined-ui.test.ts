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
test('Compose always retains the leg inspector for all modes',()=>{
 const ui=composer();
 const style=css();
 assert.match(ui,/data-compose-view=\{monitorView\}/);
 assert.match(ui,/data-compose-dock=\{/);
 assert.match(ui,/hidden=\{!composeInspectorVisible\(monitorView,skeletonBackdrop\)\}/);
 assert.match(ui,/view=\{monitorView==='SKELETON'\?'SPLIT':monitorView\}/);
 assert.match(style,/\.s64-layout\[data-compose-dock="wide"\]/);
 assert.match(style,/\.cp02-inspector\[hidden\]/);
 assert.match(style,/data-compose-view="SKELETON"/);
});
test('Compose LEG A/B and SPLIT keep visible controls and existing masker',()=>{
 const ui=composer();
 assert.doesNotMatch(ui,/legControlsOpen/);
 assert.doesNotMatch(ui,/Atur kaki/);
 assert.match(ui,/composeInspectorVisible/);
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

test('Compose centers the Stage Monitor title above the five view tabs',()=>{
 const ui=composer();
 const style=css();
 assert.match(style,/\.cp02-editor>\.cp-compose-monitor-heading/);
 assert.match(ui,/<div className="cp-compose-monitor-heading cpux-monitor-title"/);
 assert.match(style,/text-align:center!important/);
 assert.match(style,/grid-column:1\/-1!important/);
 assert.match(style,/\.uxr3-compose-preview-bar>\.lb-view-tabs/);
});

test('Stage Monitor title is structurally outside and above the tab row',()=>{
 const src=composer();
 const title=src.indexOf('<div className="cp-compose-monitor-heading cpux-monitor-title"');
 const row=src.indexOf('<div className="uxr3-compose-preview-bar">',title);
 const tabs=src.indexOf('<div className="lb-view-tabs"',row);
 assert.ok(title>0&&row>title&&tabs>row);
});
