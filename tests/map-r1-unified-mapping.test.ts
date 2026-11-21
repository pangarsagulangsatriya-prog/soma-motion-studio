import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizedPointer,moveMapCorner} from '../src/studio/v3/mapCornerModel.ts';
import {defaultStageSurfacePlan,validateStageSurfacePlan,
 assessSurfaceProof} from '../src/footprints/stage-optics/DualSurfaceCalibration.ts';

const source=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8');
test('MAP-R1: 4-corner drag coordinates clamp to normalized UV with safe invalid-coordinate rejection',()=>{
 assert.deepEqual(normalizedPointer(250,750,1000,1000),{x:.25,y:.75});
 assert.deepEqual(normalizedPointer(-50,1200,1000,1000),{x:0,y:1});
 assert.equal(normalizedPointer(NaN,20,1000,1000),null);
 assert.equal(normalizedPointer(20,20,0,1000),null);
});
test('MAP-R1: moving one corner leaves three independent points unchanged and applies source validation',()=>{
 for(const id of ['body','floor'] as const){
  const plan=defaultStageSurfacePlan(id);
  const old=structuredClone(plan.projectorQuad);
  const next=moveMapCorner(old,0,{x:.1,y:.08});
  assert.deepEqual(next[0],{x:.1,y:.08});
  assert.deepEqual(next.slice(1),old.slice(1));
  assert.deepEqual(old,plan.projectorQuad);
  validateStageSurfacePlan({...plan,projectorQuad:next});
 }
});
test('MAP-R1: crossed or degenerate corners cannot bypass existing projection validator',()=>{
 const plan=defaultStageSurfacePlan('floor');
 const bad=plan.projectorQuad.map(()=>({x:.5,y:.5})) as typeof plan.projectorQuad;
 assert.throws(()=>validateStageSurfacePlan({...plan,projectorQuad:bad}));
 assert.throws(()=>moveMapCorner(plan.sourceQuad,4 as 0,{x:0,y:0}));
});
test('MAP-R1: navigation goes to Stage Map instead of opening legacy Projector workspace',()=>{
 const nav=source('../src/studio/v3/GlobalNav.tsx');
 const app=source('../src/App.tsx');
 const stage=source('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const local=source('../src/studio/v3/StageModuleNav.tsx');
 assert.match(nav,/aria-label="Stage 1"/);
 assert.match(local,/id:'map',label:'Map'/);
 assert.match(app,/onNavigateStageWorkspace=\{workspace=>\{/);
 assert.match(app,/workspace==='map'\?'mapping'/);
 assert.match(stage,/case 'mapping':setView\('stage'\)/);
 assert.match(stage,/<SurfaceComposer embedded mapMode=\{mappingOpen&&!operatorMode\}/);
});
test('MAP-R1: direct 4-point Map monitor uses safe editPlan without duplicate technical editor',()=>{
 const panel=source('../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx');
 assert.match(panel,/onCommitProjectorQuad=\{commitMonitorQuad\}/);
 assert.match(panel,/editPlan\(selected,p=>\(\{\.\.\.p,projectorQuad:quad\}\)\)/);
 assert.doesNotMatch(panel,/Advanced · angka presisi empat titik/);
 assert.match(panel,/urgentBlackout\(id\);/);
});
test('MAP-V5: physical output interlock stays in the engine rather than Map controls',()=>{
 const body=defaultStageSurfacePlan('body'),floor=defaultStageSurfacePlan('floor');
 assert.equal(assessSurfaceProof(body,null,null).status,'incomplete');
 assert.equal(assessSurfaceProof(floor,null,null).status,'incomplete');
 const session=source('../src/footprints/stage-optics/DualSurfaceSessionStore.ts');
 assert.match(session,/assessSurfaceProof/);
 assert.match(session,/armDualSurfaceLiveFromPerform/);
 assert.match(session,/qa.status!=='within-provisional-target'/);
 assert.match(session,/urgentBlackoutDualSurface/);
 const map=source('../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx');
 assert.doesNotMatch(map,/QA Fisik 5 Titik|samples\.length|blackoutObserved|STAGE_HARDWARE_ENABLED&&<details/);
});
test('MAP-V5: workbench has calibration only and navigation handoff lives at the top',()=>{
 const panel=source('../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx');
 const nav=source('../src/studio/v3/StageModuleNav.tsx');
 assert.doesNotMatch(panel,/Teknis &amp; diagnostik|Uji proyektor|className="map-r7-perform-cta"/);
 assert.doesNotMatch(panel,/changeMode\(id,'live'\)|handleEnterPerform/);
 assert.match(nav,/map:\{target:'perform',label:'Lanjut Perform'\}/);
 assert.match(nav,/active!=='perform'&&<button/);
 const css=source('../src/studio/v3/map-wysiwyg.css');
 assert.match(css,/max-width:1252px/);
});
test('MAP-R1: Stage Map uses existing BODY/FLOOR compositor and routing; no extra camera',()=>{
 const composer=source('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(composer,/if\(mapMode\)return <section className="map-r1-workspace"/);
 assert.match(composer,/<DualSurfaceRoutingPanel frameRef=\{stageRoute\} bodyCanvas=\{bodyOutput\}/);
 assert.match(composer,/floorCanvas=\{floorOutput\} legacyProjection=\{projection\} experimentLocked=\{experimentLocked\}/);
  assert.match(composer,/experiment\?experimentFloorCanvas/);
 assert.ok(!source('../src/studio/v3/MapFourCornerEditor.tsx').includes('getUserMedia('));
 assert.doesNotMatch(composer,/SceneEffectBrowser|HydraEffectInspector|ARTISTIC_CATALOG/);
});
