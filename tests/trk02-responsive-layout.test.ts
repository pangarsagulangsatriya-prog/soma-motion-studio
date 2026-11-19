import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const layout=read('../src/studio/v3/trk02-layout.css');
const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
const prior=read('../src/studio/v3/ia-r1-four-workspaces.css');
const persistent=read('../src/studio/v3/persistent-stage-workspace.css');

test('TRK-02 is the last imported stylesheet and only scopes Track',()=>{
 const imports=[...stage.matchAll(/import '\.\/([\w-]+\.css)'/g)].map(m=>m[1]);
 assert.deepEqual(imports.slice(-2),['trk02-layout.css','trk03-source-flow.css']);
 assert.match(layout,/\.fp-stage-workspace\.fp-persistent-layout\.soma-ia-four-workspaces\[data-workspace=track\]/);
 assert.ok(!layout.includes('[data-workspace=compose]'));
 assert.ok(!layout.includes('[data-workspace=map]'));
 assert.ok(!layout.includes('[data-workspace=perform]'));
});

test('desktop uses bounded 272px source rail and 960px 16:9 input',()=>{
 assert.match(layout,/--trk-sidebar:272px;/);
 assert.match(layout,/--trk-gap:20px;/);
 assert.match(layout,/--trk-camera-limit:960px;/);
 assert.match(layout,/max-width:1360px;/);
 assert.match(layout,/grid-template-columns:minmax\(0,var\(--trk-sidebar\)\) minmax\(0,1fr\)!important/);
 assert.match(layout,/max-width:var\(--trk-camera-limit\)!important/);
 assert.match(layout,/aspect-ratio:16\/9!important/);
 assert.match(layout,/object-fit:contain!important/);
 assert.match(layout,/overflow-x:clip/);
});

test('short laptop viewport caps camera width rather than distorting pixels',()=>{
 assert.match(layout,/@media\(max-height:850px\) and \(min-width:851px\)/);
 assert.match(layout,/--trk-camera-limit:760px/);
 assert.match(layout,/@media\(max-height:700px\) and \(min-width:851px\)/);
 assert.match(layout,/--trk-camera-limit:620px/);
 assert.match(layout,/height:auto!important/);
});

test('tablet and phones stack source/preview/upload/help in document order',()=>{
 assert.match(layout,/@media\(max-width:850px\)/);
 for(const expected of [
  '.fp-stage-overview>.soma-track-source-panel',
  '.fp-stage-overview>.fp-stage-video',
  '.fp-stage-overview>.fp-experiment-dock',
  '.fp-stage-overview>.fp-inline-assistant'
 ])assert.ok(layout.includes(expected),expected);
 assert.match(layout,/grid-row:1!important;max-width:none!important/);
 assert.match(layout,/grid-column:1!important;grid-row:2!important/);
 assert.match(layout,/grid-column:1!important;grid-row:3!important/);
 assert.match(layout,/grid-column:1!important;grid-row:4!important/);
 assert.match(layout,/@media\(max-width:430px\)/);
});

test('Track inspector cannot permanently resize or overlap mobile preview',()=>{
 assert.match(layout,/\.fp-stage-layout>\.fp-stage-inspector:not\(\[data-panel-hidden=true\]\)/);
 assert.match(layout,/position:absolute!important/);
 assert.match(layout,/position:relative!important;inset:auto!important/);
 assert.match(layout,/max-height:none!important/);
 assert.match(layout,/width:100%!important/);
});

test('no source keeps its one source picker and camera preview visible',()=>{
 assert.doesNotMatch(prior,/\[data-stage-source=none\] \.fp-stage-layout\{display:none!important\}/);
 assert.match(layout,/\.fp-stage-overview:not\(\[hidden\]\)\{/);
 assert.match(layout,/\.fp-stage-overview>\.fp-stage-side-previews\{\s*display:none!important/);
 assert.match(stage,/className="soma-track-source-panel"/);
 assert.match(stage,/className="fp-stage-video"/);
});

test('TRK-02 retires old conflicting grid constraints and keeps Compose geometry',()=>{
 assert.doesNotMatch(prior,/WYSIWYG Track: source\/status at left/);
 assert.doesNotMatch(prior,/grid-template-columns:minmax\(260px,292px\)/);
 assert.match(persistent,/grid-template-columns:minmax\(0,1fr\) minmax\(198px,\.34fr\)!important/);
 assert.match(prior,/data-workspace=compose\] \.s64-embedded \.s64-layout/);
 assert.match(prior,/data-workspace=compose\] \.fp-stage-overview/);
});
