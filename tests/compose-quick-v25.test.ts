import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const compose=read('../src/studio/v3/SurfaceComposer.tsx');
const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
const quick=read('../src/studio/v3/compose-quick-v25.css');

test('CP-25: Quick mode is default and Advanced remains discoverable',()=>{
 assert.match(compose,/useState<'quick'\|'advanced'>\('quick'\)/);
 assert.match(compose,/data-compose-ui-mode=\{composeUiMode==='quick'/);
 assert.match(compose,/aria-pressed=\{composeUiMode==='quick'\}/);
 assert.match(compose,/aria-pressed=\{composeUiMode==='advanced'\}/);
 assert.match(compose,/>Sederhana<\/button>/);
 assert.match(compose,/>Lanjutan<\/button>/);
 assert.match(compose,/setComposeUiMode\('quick'\);setInspectorTab\('scene'\)/);
});
test('CP-25: Quick keeps real style, footprint and intensity controls wired to existing engine',()=>{
 assert.match(compose,/COMPOSE_VISUAL_STYLES\.map\(\(item,index\)=>/);
 assert.match(compose,/onClick=\{\(\)=>selectVisualStyle\(item\.id\)\}/);
 assert.match(compose,/onClick=\{\(\)=>updateFootprint\(\{style\}\)\}/);
 assert.match(compose,/onChange=\{e=>updateFootprint\(\{life:Number\(e\.target\.value\)\}\)\}/);
 assert.match(compose,/aria-label="Intensitas visual lantai"/);
 assert.match(compose,/onChange=\{e=>updateSteering\(\{glow:Number\(e\.target\.value\)\}\)\}/);
 assert.match(compose,/aria-label="Aktifkan visual lantai"/);
});
test('CP-25: Map calibration navigation goes to Map; legacy Track path stays available for mapping',()=>{
 assert.match(compose,/onClick=\{onOpenMapWorkspace\}>Kalibrasi bidang di Map/);
 assert.match(stage,/onOpenMapWorkspace=\{\(\)=>onNavigateStageWorkspace\('map'\)\}/);
 assert.match(stage,/onOpenMapTrack=\{\(\)=>onNavigateStageWorkspace\('track'\)\}/);
});
test('CP-25: quick hides, but does not remove, advanced drawers or diagnostics',()=>{
 for(const selector of ['.cpux-steer-section','.cpux-timeline-drawer','.soma-ia-layers','.cp02-library']){
  assert.ok(quick.includes(selector),selector);
 }
 for(const preserved of ['Live Steer Pad','ComposerEventTimeline','className="soma-ia-layers"','className="soma-ia-media"','className="cp04-command-menu"']){
  assert.ok(compose.includes(preserved),preserved);
 }
 assert.match(quick,/\[data-compose-ui-mode="quick"\]/);
 assert.match(stage,/import '\.\/compose-quick-v25\.css'/);
 assert.match(quick,/@media\(max-width:1150px\)/);
 assert.match(quick, /@media\(prefers-reduced-motion:reduce\)/);
});
test('CP-25: dark palette remains aligned with SOMA production and the stage canvas remains mounted',()=>{
 for(const color of ['#0d1611','#152119','#38503e','#e8f1e5','#cbe9a7','#92a796'])assert.ok(quick.includes(color),color);
 assert.match(compose,/<canvas width=\{960\} height=\{540\} ref=\{canvas\}/);
 assert.match(compose,/canRenderComposeSurface\(\{/);
});
