import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
 DEFAULT_STAGE_DIMENSIONS,STAGE_DIMENSION_PRESETS,clampStageDimensions,createDefaultMapSim,
 deriveMapStageStatus,emptyQuadHistory,moveMapSimPerformer,pushQuadHistory,
 redoQuadHistory,screenToStageFloor,snapQuadPoint,stageFloorToScreen,
 stepMapSimState,undoQuadHistory
} from '../src/studio/v3/mapStageModel.ts';
import {defaultStageSurfacePlan,validateStageSurfacePlan} from '../src/footprints/stage-optics/DualSurfaceCalibration.ts';
import type {Quad} from '../src/projection/geometry.ts';

const read=(rel:string)=>fs.readFileSync(new URL(rel,import.meta.url),'utf8');

const emptyQa={
 status:'incomplete' as const,count:0,rmseCm:null,p95Cm:null,maximumCm:null,
 missing:['Perlu 5 titik pengukuran fisik.']
};
const passedQa={
 status:'within-provisional-target' as const,count:5,rmseCm:1.2,p95Cm:1.8,maximumCm:2.0,
 missing:[]
};

test('MAP-01 / MAP-08: dominant 4-state status never claims hardware readiness in simulation or uncalibrated states',()=>{
 // No source -> Belum dikalibrasi
 const sNone=deriveMapStageStatus({
  source:'none',cameraOn:false,floorCalibrated:false,hardwareEnabled:true,
  experimentLocked:false,operatorConfirm:false,outputConnected:false,
  outputMode:'blackout',qa:emptyQa,selected:'floor'
 });
 assert.equal(sNone.id,'uncalibrated');
 assert.equal(sNone.label,'Belum dikalibrasi');
 assert.equal(sNone.physicalReady,false);

 // Virtual Map Simulation -> Siap diuji (software only, physicalReady strictly false)
 const sSim=deriveMapStageStatus({
  source:'demo-sim',cameraOn:false,floorCalibrated:false,hardwareEnabled:true,
  experimentLocked:false,operatorConfirm:true,outputConnected:true,
  outputMode:'live',qa:passedQa,selected:'floor'
 });
 assert.equal(sSim.id,'ready-to-test');
 assert.equal(sSim.label,'Siap diuji');
 assert.equal(sSim.physicalReady,false);
 assert.match(sSim.blocker,/terkunci/);

 // Live camera calibrated + output connected + QA incomplete -> Perlu QA fisik
 const sQa=deriveMapStageStatus({
  source:'camera',cameraOn:true,floorCalibrated:true,hardwareEnabled:true,
  experimentLocked:false,operatorConfirm:true,outputConnected:true,
  outputMode:'test',qa:emptyQa,selected:'floor'
 });
 assert.equal(sQa.id,'needs-physical-qa');
 assert.equal(sQa.label,'Perlu QA fisik');
 assert.equal(sQa.physicalReady,false);

 // Live camera calibrated + output connected + operator confirm + 5/5 QA -> Siap Perform
 const sReady=deriveMapStageStatus({
  source:'camera',cameraOn:true,floorCalibrated:true,hardwareEnabled:true,
  experimentLocked:false,operatorConfirm:true,outputConnected:true,
  outputMode:'live',qa:passedQa,selected:'body'
 });
 assert.equal(sReady.id,'ready-perform');
 assert.equal(sReady.label,'Siap Perform');
 assert.equal(sReady.physicalReady,true);
});

test('MAP-02 / MAP-03: stage dimensions support 2x1, 3x1, 3x2, 3x4, 5x5 presets + custom 1..20m and perspective floor round-trips accurately',()=>{
 assert.deepEqual(DEFAULT_STAGE_DIMENSIONS,{widthM:5,depthM:5});
 assert.deepEqual(
  STAGE_DIMENSION_PRESETS.map(p=>`${p.widthM}x${p.depthM}`),
  ['2x1','3x1','3x2','3x4','5x5']
 );
 assert.deepEqual(clampStageDimensions({widthM:8.2,depthM:6.4}),{widthM:8,depthM:6.5});
 assert.deepEqual(clampStageDimensions({widthM:0.5,depthM:99}),{widthM:1,depthM:20});

 const samples=[
  {u:0.15,v:0.2},
  {u:0.5,v:0.5},
  {u:0.85,v:0.85},
  {u:0.25,v:0.75}
 ];
 for(const dims of [{widthM:5,depthM:5},{widthM:3,depthM:1},{widthM:3,depthM:4}]){
  for(const {u,v} of samples){
   const screen=stageFloorToScreen(u,v,960,540,dims);
   const back=screenToStageFloor(screen.x,screen.y,960,540,dims);
   assert.ok(back,'inverse perspective projection returns valid UV');
   assert.ok(Math.abs(back.x-u)<0.01,`u round-trip drift too large (${dims.widthM}x${dims.depthM}): ${back.x} vs ${u}`);
   assert.ok(Math.abs(back.y-v)<0.01,`v round-trip drift too large (${dims.widthM}x${dims.depthM}): ${back.y} vs ${v}`);
  }
 }
});

test('MAP-04 / MAP-05: 2-performer A/B virtual simulation steps cleanly without swapping IDs and emits footprints',()=>{
 const initial=createDefaultMapSim();
 assert.equal(initial.active,false);
 assert.equal(initial.performers[0].id,'A');
 assert.equal(initial.performers[1].id,'B');

 // Inactive sim does not advance
 assert.equal(stepMapSimState(initial,100),initial);

 // Activate and step 1.5s -> should emit new footprints and preserve A/B identity
 let sim={...initial,active:true,playing:true};
 for(let i=0;i<30;i++)sim=stepMapSimState(sim,50);
 assert.equal(sim.performers[0].id,'A');
 assert.equal(sim.performers[1].id,'B');
 assert.ok(sim.footprints.length>initial.footprints.length,'stepping emits footprints');
 assert.ok(sim.footprints.some(f=>f.actorId==='A'));
 assert.ok(sim.footprints.some(f=>f.actorId==='B'));

 // Manual drag moves only target performer and emits footprint on significant move
 const beforeB=sim.performers[1];
 const dragged=moveMapSimPerformer(sim,'A',{x:0.72,y:0.74});
 assert.equal(dragged.performers[0].x,0.72);
 assert.equal(dragged.performers[0].y,0.74);
 assert.deepEqual(dragged.performers[1],beforeB);
});

test('MAP-06 / MAP-07 / MAP-14: quad snap, undo/redo history, and degenerate quad rejection stay deterministic',()=>{
 // Snap snaps when near 5% multiple, preserves precision away from grid
 assert.deepEqual(snapQuadPoint({x:0.245,y:0.506},true),{x:0.25,y:0.5});
 assert.deepEqual(snapQuadPoint({x:0.223,y:0.522},true),{x:0.223,y:0.522});
 assert.deepEqual(snapQuadPoint({x:0.245,y:0.506},false),{x:0.245,y:0.506});

 const q0=defaultStageSurfacePlan('floor').projectorQuad;
 const q1:Quad=[{x:0.05,y:0.05},{x:0.95,y:0.05},{x:0.95,y:0.95},{x:0.05,y:0.95}];
 const q2:Quad=[{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9},{x:0.1,y:0.9}];

 let hist=emptyQuadHistory();
 hist=pushQuadHistory(hist,q0);
 hist=pushQuadHistory(hist,q1);

 const undone=undoQuadHistory(hist,q2);
 assert.ok(undone);
 assert.deepEqual(undone.quad,q1);

 const redone=redoQuadHistory(undone.history,undone.quad);
 assert.ok(redone);
 assert.deepEqual(redone.quad,q2);

 // Degenerate/self-intersecting quad rejected by DualSurfaceCalibration validator
 assert.throws(()=>{
  validateStageSurfacePlan({
   ...defaultStageSurfacePlan('floor'),
   projectorQuad:[{x:0.1,y:0.1},{x:0.9,y:0.9},{x:0.9,y:0.1},{x:0.1,y:0.9}]
  });
 });
});

test('MAP-09..MAP-13 / MAP-16: Map has direct four-corner editing, minimal views and safe optional hardware QA',()=>{
 const panel=read('../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx');
 const monitor=read('../src/studio/v3/MapStageMonitor.tsx');
 const editor=read('../src/studio/v3/MapFourCornerEditor.tsx');

 // Single dominant Stage Map Monitor with 4 view modes & empty-state CTA
 assert.match(monitor,/<Users size=\{11\}\/> Coba simulasi/);
 assert.match(monitor,/\['stage','Atur'\]/);
 assert.match(monitor,/\['align','Bandingkan'\]/);
 assert.match(monitor,/\['output','Hasil'\]/);
 assert.doesNotMatch(monitor,/\['split','Split'\]/);
 assert.match(monitor,/paintAuthenticFootprint/);

 // 3-step rail + single BODY output covering A and B + collapsed Advanced drawer
 assert.match(panel,/<strong>Ukuran ruang<\/strong>/);
 assert.match(panel,/className="map-r4-room-extra"|className="map-r4-disclosure map-r4-room-extra"/);
 assert.match(panel,/Cocokkan sudut/);
 assert.match(panel,/Uji proyektor/);
 assert.match(panel,/Satu output BODY mencakup mask tubuh bawah Performer A dan B/);
 assert.doesNotMatch(panel,/<details className="map-r2-advanced">/);
 assert.ok(!panel.includes('<details className="map-r2-advanced" open'));

 // No permanent 4-card UV grid clutter in MapFourCornerEditor
 assert.ok(!editor.includes('map-r1-corner-card'));
 assert.match(editor,/map-r1-corner-bar/);

 // Calibration-first default: corner handles active immediately on Map entry
 assert.match(panel,/const editingCorners=true/);
 assert.match(panel,/STAGE_DIMENSION_PRESETS/);
 assert.doesNotMatch(panel,/map-r2-nudge-pad/);
 assert.doesNotMatch(panel,/className="map-r4-disclosure map-r4-precision"/);
 assert.match(panel,/Tarik empat sudut pada gambar/);
 assert.doesNotMatch(panel,/Teknis &amp; diagnostik/);
 assert.doesNotMatch(panel,/Grid homografi 3 × 3/);
 assert.match(panel,/title="Buka ruang Perform"/);
 assert.doesNotMatch(panel,/map-r5-model-diagnostics/);
 assert.doesNotMatch(panel,/map-r5-output-diagnostics/);
 assert.doesNotMatch(panel,/stage-dual-perform-quick/);

 // Track-unified botanical-forest palette & centered 1252px layout across Compose & Map
 const composeCss=read('../src/studio/v3/mapping-studio-v4.css');
 const mapCss=read('../src/footprints/stage-optics/dual-surface-routing.css');
 assert.match(composeCss,/--msv4-rail:#121c16/);
 assert.match(composeCss,/--msv4-line:#38503e/);
 assert.match(composeCss,/max-width:1252px/);
 assert.match(mapCss,/#121c16/);
 assert.match(mapCss,/#38503e/);
 assert.match(mapCss,/max-width:1252px/);

 // Architecture boundary: Map modules never open their own camera stream
 assert.ok(!panel.includes('getUserMedia('));
 assert.ok(!monitor.includes('getUserMedia('));
 assert.ok(!editor.includes('getUserMedia('));
});

test('MAP-R7: compact Map keeps one Perform handoff and a readable primary monitor',()=>{
 const panel=read('../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx');
 const nav=read('../src/studio/v3/StageModuleNav.tsx');
 const monitor=read('../src/studio/v3/MapStageMonitor.tsx');
 const styles=read('../src/footprints/stage-optics/dual-surface-routing.css');
 assert.match(panel,/map-r2-status-inline map-r7-status/);
 assert.match(panel,/className="map-r7-perform-cta"/);
 assert.match(panel,/onClick=\{handleEnterPerform\}/);
 assert.match(panel,/QA Fisik 5 Titik/);
 assert.match(panel,/map-r7-qa-count/);
 assert.match(panel,/urgentBlackout\(id\)/);
 assert.match(panel,/stage-dual-check map-r7-safety-check/);
 assert.match(panel,/STAGE_HARDWARE_ENABLED&&<section className="map-r2-step map-r7-qa-step"/);
 assert.doesNotMatch(panel,/stage-dual-setup-uat|stage-dual-profile|map-r2-nudge-pad/);
 assert.doesNotMatch(panel,/stage-dual-emergency map-r2-blackout/);
 assert.doesNotMatch(panel,/className="map-r5-next-action"/);
 assert.doesNotMatch(panel,/map-r2-perform-link/);
 assert.match(nav,/active!=='map'&&<button/);
 assert.match(monitor,/\['stage','Atur'\]/);
 assert.match(monitor,/\['output','Hasil'\]/);
 assert.match(monitor,/\['align','Bandingkan'\]/);
 assert.doesNotMatch(monitor,/Lebar \$\{stageDimensions\.widthM\.toFixed/);
 assert.match(styles,/MAP-R7 — compact operator map/);
});
