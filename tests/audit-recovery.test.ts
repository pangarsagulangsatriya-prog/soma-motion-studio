import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 getDualSurfaceState,patchDualSurfaceState,resetDualSurfaceSessionForTest
} from '../src/footprints/stage-optics/DualSurfaceSessionStore.ts';
import {defaultStageSurfacePlan} from '../src/footprints/stage-optics/DualSurfaceCalibration.ts';

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');

test('AUDIT-RECOVERY F-01: DualSurfaceSessionStore preserves edited quads and selected surface across Map unmounts',()=>{
 resetDualSurfaceSessionForTest();
 const edited=defaultStageSurfacePlan('floor');
 edited.projectorQuad[0]={x:.14,y:.18};
 patchDualSurfaceState({
  selected:'floor',
  plans:{...getDualSurfaceState().plans,floor:edited}
 });
 const snapshot=getDualSurfaceState();
 assert.equal(snapshot.selected,'floor');
 assert.deepEqual(snapshot.plans.floor.projectorQuad[0],{x:.14,y:.18});
 resetDualSurfaceSessionForTest();
});

test('AUDIT-RECOVERY F-01/F-03: Stage 1 keeps SurfaceComposer mounted and avoids spurious blackout/toast on internal tab switch',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const app=read('../src/App.tsx');
 assert.match(stage,/className="soma-composer-host" hidden=\{!composerOpen\|\|operatorMode\}/);
 assert.match(stage,/if\(request\.tool!=='tracking'&&request\.tool!=='composer'&&request\.tool!=='mapping'\)onBlackout\(\)/);
 assert.match(app,/const alreadyActive=footprintsActive;/);
 assert.match(app,/if\(!alreadyActive\)notify\(/);
 assert.match(app,/if\(!footprintsActive\|\|archiveActive\|\|projectionActive\)/);
});

test('AUDIT-RECOVERY F-02/F-05: Compose defaults to FLOOR surface and Track liquid mode, compositing verified Track imprints into floorOutput',()=>{
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(composer,/useEffect\(\(\)=>\{setPreviewArrangement\('surface'\);\},\[experimentSource\]\)/);
 assert.match(composer,/useState<ComposerLiquidMode>\('track'\)/);
 assert.match(composer,/ctx\.drawImage\(liquidCanvas\.current,0,0,floor\.width,floor\.height\)/);
});

test('AUDIT-RECOVERY F-04/F-07/F-09/F-10: Perform 2-column layout, humanized source labels, Track Reset A/B, and collapsed desktop sidebar',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const consoleSrc=read('../src/studio/v3/OperatorStageConsole.tsx');
 const nav=read('../src/studio/v3/GlobalNav.tsx');
 const performCss=read('../src/studio/v3/ops-r1-perform.css');
 assert.match(stage,/SOURCE_CHOICES\.find\(option=>option\.id===sourceStatus\.selection\)\?\.label\?\?'Belum dipilih'/);
 assert.match(stage,/Baca ulang kedua orang/);
 assert.match(consoleSrc,/Edit Compose/);
 assert.doesNotMatch(consoleSrc,/Kembali Build/);
 assert.match(nav,/localStorage\.getItem\(NAV_KEY\)==='true'/);
 assert.match(nav,/Sumber: \{sourceLabel\}/);
 assert.match(performCss,/grid-template-columns:minmax\(0,1\.35fr\) minmax\(360px,450px\)/);
});

test('UX-BENCHMARK: Sequential pipeline CTA, Track Motion HUD, and Compose direct Jejak Lantai sculpting',()=>{
 const nav=read('../src/studio/v3/StageModuleNav.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const composer=read('../src/studio/v3/SurfaceComposer.tsx');
 const composeCss=read('../src/studio/v3/cpux-compose-focus.css');
 assert.match(nav,/soma-stage-next-cta/);
 assert.match(nav,/track:\{target:'map',label:'Lanjut Map'\}/);
 assert.match(nav,/Lanjut Map/);
 assert.match(nav,/Masuk Perform/);
 assert.match(stage,/soma-track-motion-hud/);
 assert.match(stage,/onPerformerCount\(n\)/);
 assert.doesNotMatch(stage,/Kalibrasi Lantai 4 Sudut/);
 assert.match(stage,/soma-input-check/);
 assert.match(composer,/cpux-footprint-sculpt/);
 assert.match(composer,/Gaya jejak lantai/);
 assert.match(composeCss,/\.cp04-inspector-tabs\{\s*order:0;/);
});

test('UX-BENCHMARK: MadMapper-class 4-corner warp editor (live backdrop, patterns, arrow nudge, reset), 5-step Map stepper, and Perform Active->Next strip',()=>{
 const editor=read('../src/studio/v3/MapFourCornerEditor.tsx');
 const panel=read('../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx');
 const consoleSrc=read('../src/studio/v3/OperatorStageConsole.tsx');
 assert.match(editor,/AlignmentOverlay='grid'\|'crosshair'\|'checker'\|'off'/);
 assert.match(editor,/ArrowLeft/);
 assert.match(editor,/Reset Quad/);
 assert.match(editor,/map-r1-backdrop/);
 assert.doesNotMatch(panel,/stage-dual-stepper/);
 assert.match(panel,/Cocokkan sudut/);
 assert.match(panel,/onCommitProjectorQuad=\{commitMonitorQuad\}/);
 assert.doesNotMatch(panel,/MapFourCornerEditor key/);
 assert.match(consoleSrc,/ops-r1-next-cue/);
 assert.match(consoleSrc,/BERIKUTNYA/);
 assert.match(consoleSrc,/ops-r1-kbd/);
});

