import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('PF-UX-06: output routes have icon labels and each stays keyboard-accessible',()=>{
 const src=read('../src/studio/v3/OperatorStageConsole.tsx');
 assert.match(src,/PERFORM_DESTINATIONS\.map/);
 assert.match(src,/item\.id==='soma'\?<Monitor/);
 assert.match(src,/item\.id==='resolume'\?<Clapperboard/);
 assert.match(src,/aria-pressed=\{outputRouteMode===item.id\}/);
 assert.match(src,/aria-label=\{item.label\}/);
 assert.doesNotMatch(src,/\{item\.id==='touchdesigner'\?'DATA':'VISUAL'\}/);
});
test('PF-UX-06: lock explanation remains accessible without useless locked CTA',()=>{
 const src=read('../src/studio/v3/OperatorStageConsole.tsx');
 assert.match(src,/destination\.kind!=='info'&&<button/);
 assert.match(src,/className="ops-r1-mini-help"/);
 assert.match(src,/aria-expanded=\{outputDetailsOpen\}/);
 assert.match(src,/className="ops-r1-detail-content"/);
 assert.match(src,/role="status" aria-live="polite"/);
});
test('PF-UX-06: cue synopsis has no permanent paragraph and eight cues remain editable',()=>{
 const src=read('../src/studio/v3/OperatorStageConsole.tsx');
 assert.match(src,/className="ops-r1-next-cue"/);
 assert.match(src,/BERIKUTNYA/);
 assert.match(src,/className="ops-r1-cue-detail-body"/);
 assert.match(src,/performCueScope\(outputRouteMode\)/);
 assert.match(src,/cueGrid\.slots\.map/);
 const detailPosition=src.indexOf('className="ops-r1-cue-detail-body"');
 const scopePosition=src.indexOf('className="ops-r1-cue-scope"');
 assert.ok(detailPosition>=0&&scopePosition>detailPosition);
});
test('PF-UX-06: transient animation only, reduced-motion and visible keyboard focus',()=>{
 const css=read('../src/studio/v3/ops-r1-perform.css');
 assert.match(css,/@keyframes pfux-state-in/);
 assert.match(css,/@keyframes pfux-details-in/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/:focus-visible/);
 assert.doesNotMatch(css,/@keyframes.*infinite/);
 const td=read('../src/studio/v3/TouchDesignerPerformPanel.tsx');
 assert.match(td,/className="soma-td-info-button"/);
 assert.match(td,/className="soma-td-detail-body"/);
 assert.match(td,/STAGE_BLACKOUT_EVENT/);
});
test('PF-UX-06: physical output and emergency commands remain unchanged',()=>{
 const src=read('../src/studio/v3/OperatorStageConsole.tsx');
 assert.match(src,/STAGE_HARDWARE_ENABLED/);
 assert.match(src,/armDualSurfaceLiveFromPerform/);
 assert.match(src,/blackoutAllDualSurfaces\('Tujuan output diganti/);
 assert.match(src,/handleBlackoutAll/);
 assert.match(src,/onRecovery/);
});
