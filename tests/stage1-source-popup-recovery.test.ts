import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Stage 1 SOURCE: header popup is not clipped and closed menu is hidden',()=>{
 const css=read('../src/studio/v3/ux-r1-unified-shell.css');
 const nav=read('../src/studio/v3/GlobalNav.tsx');
 assert.match(css,/\.soma-primary-header \.soma-uxr1-health\{overflow:visible\}/);
 assert.match(css,/\.soma-uxr1-source:not\(\[open\]\)>\.soma-uxr1-source-menu\{display:none\}/);
 assert.match(css,/\.soma-uxr1-source\[open\]>/);
 assert.match(nav,/<summary title="Satu sumber untuk Track, Compose, Map, Perform">SOURCE:/);
 assert.match(nav,/onSelectSource\(option.id\)/);
 assert.match(nav,/closest\('details'\)\?\.removeAttribute\('open'\)/);
});

test('Stage 1 no-source: four direct source actions replace empty black previews',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(stage,/SOURCE_CHOICES\.map\(option=><button/);
 assert.match(stage,/void chooseSource\(option.id\)/);
 assert.match(stage,/aria-label="Pilih sumber Stage 1"/);
 assert.match(stage,/data-stage-source=\{sourceStatus\.selection\?\?'none'\}/);
 assert.match(css,/data-workspace=track\]\[data-stage-source=none\] \.fp-stage-layout\{display:none\}/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(stage,/sourceStatus\.selection!==null&&!experimentalKind&&<QuickStageSetup/);
});

test('Stage 1 preview: HOLD is transient and overlay text fits the canvas',()=>{
 const app=read('../src/App.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(app,/\.\.\.d,\.\.\.v,hold:false,colors/);
 assert.match(app,/JSON\.stringify\(\{\.\.\.footprintConfig,hold:false\}\)/);
 assert.equal((stage.match(/footprint\.hold&&sourceStatus\.selection!==null&&<span className="fp-stage-hold-label">/g)||[]).length,2);
 assert.match(css,/\.fp-stage-canvas-area>\.fp-stage-hold-label\{/);
 assert.match(css,/position:absolute;inset:auto 14px 14px/);
 assert.match(css,/overflow-wrap:anywhere;white-space:normal/);
});
