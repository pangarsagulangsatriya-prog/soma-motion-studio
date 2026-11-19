import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
const css=read('../src/studio/v3/trk08-mp4-compact.css');
const video=read('../src/studio/v3/FootprintsExperimentalSource.tsx');

test('MP4 Track styling is scoped and cannot change Compose, Map, Perform',()=>{
 assert.match(stage,/import '\.\/trk08-mp4-compact\.css'/);
 assert.match(css,/\[data-workspace=track\]\[data-stage-source=video\]/);
 for(const mode of ['compose','map','perform'])
  assert.doesNotMatch(css,new RegExp('data-workspace='+mode));
});
test('MP4 transport eliminates vertical legacy 320px and 138px flex-basis',()=>{
 assert.match(css,/\.fp-duet-engine-status\{[\s\S]*?flex:none!important;flex-basis:auto!important/);
 assert.match(css,/\.fp-experiment-meta\{[\s\S]*?flex:0 0 auto!important/);
 assert.match(css,/\.fp-experiment-controls\{[\s\S]*?display:grid!important/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)!important/);
 assert.match(css,/\.fp-tracking-details-panel\{[\s\S]*?position:static!important/);
 assert.match(css,/\.fp-duet-engine-status>:is\(b,\.fp-tracking-summary,\.fp-video-actor-status\)\{\s*display:none!important/);
});
test('single actor/foot status ownership with accessible MP4 controls',()=>{
 assert.match(video,/data-player-state=\{kind==='video'/);
 assert.match(video,/aria-pressed=\{playing\}/);
 assert.match(video,/aria-valuetext=\{timecode\(scrubPosition\?\?position\)/);
 assert.match(video,/summary aria-label="Rincian tracking A dan B"/);
 assert.match(stage,/className="soma-track-feedback"/);
 assert.match(stage,/className="soma-track-actor-list"/);
 assert.match(css,/\.fp-experiment-meta\[data-state=ready\]\{\s*display:none!important/);
});
test('motion feedback observes reduced-motion and keyboard accessibility',()=>{
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/:active:not\(:disabled\)/);
 assert.match(css,/:hover/);
});
