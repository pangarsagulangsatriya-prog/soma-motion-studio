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
 const css=read('../src/studio/v3/trk02-layout.css');
 assert.match(stage,/className="fp-stage-video-content"/);
 assert.match(stage,/<canvas ref=\{cameraCanvas\}/);
 assert.match(stage,/className="fp-full-skeleton-switch"/);
 assert.match(stage,/INPUT · VIDEO \+ POSE A\/B/);
 assert.match(css,/data-workspace=track\] \.fp-stage-overview>\.fp-stage-side-previews\{[\s\S]*?display:none!important/);
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
 assert.match(composer,/Layer target/);
 assert.match(composer,/cp02-editor/);
 assert.match(composer,/cp02-inspector/);
 const dock=read('../src/studio/v3/cp02-cp03-composition.css');
 assert.ok(dock.includes('grid-template-columns:minmax(190px,.95fr)'));
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
 const css=read('../src/studio/v3/trk02-layout.css');
 assert.match(stage,/className="soma-track-source-panel"/);
 assert.match(stage,/className="soma-track-source-status"/);
 assert.match(stage,/className="fp-stage-video"/);
 assert.match(stage,/className="soma-track-input-placeholder"/);
 assert.match(css,/TRK-02 — Track owns its desktop\/tablet\/mobile geometry/);
 assert.match(css,/grid-template-columns:minmax\(0,var\(--trk-sidebar\)\) minmax\(0,1fr\)!important/);
 assert.match(css,/data-workspace=track\] \.fp-stage-overview>\.fp-stage-video/);
});

test('Track camera sizing wins against persistent legacy source grid rule',()=>{
 const css=read('../src/studio/v3/trk02-layout.css');
 const legacy=read('../src/studio/v3/persistent-stage-workspace.css');
 assert.match(legacy,/grid-template-columns:minmax\(0,1fr\) minmax\(198px,\.34fr\)!important/);
 const next='.fp-stage-workspace.fp-persistent-layout.soma-ia-four-workspaces[data-workspace=track] .fp-stage-overview:not([hidden])';
 assert.ok(css.includes(next+'{'));
 assert.match(css,/grid-template-columns:minmax\(0,var\(--trk-sidebar\)\) minmax\(0,1fr\)!important/);
 assert.match(css,/grid-column:2!important;/);
 assert.match(css,/grid-row:1\/span 4!important/);
 assert.match(css,/--trk-camera-limit:960px/);
 assert.match(css,/data-workspace=track\] \.fp-stage-bottom-status\{\s*display:none!important/);
});
test('Track microinteractions announce state, support focus and reduced motion',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const css=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(stage,/className="soma-track-source-status" data-phase=\{sourceStatus.phase\}/);
 assert.match(stage,/role="status" aria-live="polite"/);
 assert.match(stage,/aria-pressed=\{skeletonVisible\}/);
 assert.match(css,/soma-track-source-select\[open\]>summary::after/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/animation:soma-track-connecting 1\.6s ease-in-out infinite/);
});
