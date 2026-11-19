import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Track selects source from one canonical picker, keeping four supported sources',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const sources=read('../src/studio/v3/sourceSwitchModel.ts');
 assert.match(stage,/<details className="soma-ux01-source-switch soma-track-source-select"/);
 assert.match(stage,/SOURCE_CHOICES\.map\(option=><button/);
 for(const id of ['webcam','phone','video','simulator'])assert.ok(sources.includes(id),id);
});

test('Track uses one mounted camera/video/simulator canvas with skeleton toggle',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(stage,/className="fp-stage-video-content"/);
 assert.match(stage,/<canvas ref=\{cameraCanvas\}/);
 assert.match(stage,/className="fp-full-skeleton-switch"/);
 assert.match(stage,/INPUT · VIDEO \+ POSE A\/B/);
 assert.match(css,/data-workspace=track\] \.fp-stage-side-previews\{\s*display:none!important/);
 assert.match(css,/data-workspace=track\] \.fp-stage-video-content\{[\s\S]*?aspect-ratio:16\/9/);
});

test('Track hides secondary previews but keeps engine BODY/FLOOR raster canvases mounted',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(stage,/<canvas ref=\{bodyCanvas\}/);
 assert.match(stage,/<canvas ref=\{floorCanvas\}/);
 assert.match(stage,/hidden=\{!composerOpen\|\|mappingOpen\} aria-hidden=\{!composerOpen\|\|mappingOpen\}/);
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(css,/data-workspace=track\] \.fp-stage-overview > \.fp-stage-side-previews/);
 assert.match(css,/\.fp-stage-side-previews\[hidden\]\{/);
 assert.match(stage,/motionEvents=\{\(\)=>interactionEngineRef\.current\.canonicalRecent\}/);
});

test('Compose keeps three columns: Scene Library / Stage Preview / Inspector',()=>{
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(composer,/<h3>Scene Library<\/h3>/);
 assert.match(composer,/STAGE PREVIEW|Stage Preview/);
 assert.match(composer,/INSPECTOR|Inspector/);
 assert.match(css,/data-workspace=compose\] \.s64-embedded \.s64-layout\{grid-template-columns:minmax\(176px,220px\) minmax\(0,1fr\) minmax\(186px,238px\)/);
});

test('Compose exposes original three monitors only when editor is active',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(stage,/hidden=\{view!=='stage'\|\|\(composerOpen&&mappingOpen\)\}/);
 assert.match(css,/data-workspace=compose\] \.fp-stage-overview > \.fp-stage-side-previews:not\(\[hidden\]\)/);
 for(const cls of ['fp-preview-floor','fp-preview-body','fp-stage-video']){
  assert.match(css,new RegExp('data-workspace=compose\\] \\.'+cls));
 }
});

test('Track follows WYSIWYG source/status rail and one camera input preview',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(stage,/className="soma-track-source-panel"/);
 assert.match(stage,/className="soma-track-source-status"/);
 assert.match(stage,/className="fp-stage-video"/);
 assert.match(stage,/className="soma-track-input-placeholder"/);
 assert.match(css,/WYSIWYG Track: source\/status at left/);
 assert.match(css,/grid-template-columns:minmax\(236px,292px\) minmax\(0,1fr\)!important/);
 assert.match(css,/data-workspace=track\] \.fp-stage-overview>\.fp-stage-video/);
});
