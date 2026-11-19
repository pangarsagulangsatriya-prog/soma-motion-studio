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
 assert.match(stage,/<details className="soma-ux01-source-switch soma-track-source-select"/);
 assert.match(stage,/<summary aria-label="Ganti sumber gerak"/);
 assert.match(stage,/onClick=\{async event=>\{/);
 assert.match(stage,/if\(await chooseSource\(option\.id\)\)/);
 assert.match(css,/\.soma-ux01-source-switch/);
});

test('Stage 1 no-source: the left source/status panel and right camera stay visible',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/trk02-layout.css');
 assert.match(stage,/SOURCE_CHOICES\.map\(option=><button/);
 assert.match(stage,/await chooseSource\(option.id\)/);
 assert.match(stage,/aria-label="Pilih sumber dan lihat status tracking"/);
 assert.match(stage,/data-stage-source=\{sourceStatus\.selection\?\?'none'\}/);
 assert.match(stage,/className="soma-track-source-status"/);
 assert.match(stage,/className="fp-stage-video"/);
 assert.match(css,/TRK-02 — Track owns its desktop\/tablet\/mobile geometry/);
 assert.match(css,/grid-template-columns:minmax\(0,var\(--trk-sidebar\)\) minmax\(0,1fr\)!important/);
 assert.match(stage,/sourceStatus\.selection!==null&&!experimentalKind&&cameraOn&&<QuickStageSetup/);
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
