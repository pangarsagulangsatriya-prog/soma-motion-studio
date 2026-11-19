import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Stage 1 source picker belongs to Track and remains keyboard accessible',()=>{
 const nav=read('../src/studio/v3/GlobalNav.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.ok(!nav.includes('<details className="soma-uxr1-source"'));
 assert.match(nav,/title="Ubah sumber di workspace Track"/);
 assert.match(stage,/<details className="soma-ux01-source-switch"/);
 assert.match(stage,/<summary aria-label="Ganti sumber gerak"/);
 assert.match(stage,/onClick=\{e=>\{void chooseSource\(option\.id\)/);
 assert.match(css,/\.soma-ux01-source-switch/);
});

test('Stage 1 no-source: four direct source actions replace empty black previews',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(stage,/SOURCE_CHOICES\.map\(option=><button/);
 assert.match(stage,/void chooseSource\(option.id\)/);
 assert.match(stage,/aria-label="Pilih sumber Stage 1"/);
 assert.match(stage,/data-stage-source=\{sourceStatus\.selection\?\?'none'\}/);
 assert.match(css,/data-workspace=track\] \[data-stage-source=none\]|data-workspace=track\]\[data-stage-source=none\]/);
 assert.match(css,/\.fp-stage-layout\{display:none!important\}/);
 assert.match(css,/data-workspace=compose\] \.fp-stage-layout/);
 assert.match(css,/data-workspace=map\] \.fp-stage-layout/);
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
