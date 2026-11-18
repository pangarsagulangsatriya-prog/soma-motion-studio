import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTISTIC_CATALOG} from '../src/footprints/scenes/artisticCatalog.ts';
import {ArtisticFootprintRuntime} from '../src/footprints/scenes/ArtisticFootprintRuntime.ts';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {MOTION_RECIPE_DEFAULT,resolveMotionRecipeCue} from '../src/footprints/scenes/motionRecipeModel.ts';
import {defaultStageSurfacePlan,outputSurfaceDecision} from '../src/footprints/stage-optics/DualSurfaceCalibration.ts';
import {defaultPerformCueGrid,normalizePerformCueGrid,performCueAuthorizesLight} from '../src/studio/v3/performCueModel.ts';
import {COMPOSE_SCENES} from '../src/studio/v3/composeWorkspaceModel.ts';
import {stageHardwareAvailable} from '../src/footprints/stage-optics/StageHardwareGate.ts';
import {emptyQaReleaseRecord,evaluateQaRelease,QA_REQUIRED_IDS,QA_PHYSICAL_IDS,parseQaReleaseRecord} from '../src/studio/v3/qaReleaseGate.ts';

const sixSteps=()=>{
 const engine=new FloorInteractionEngine();engine.reset('video');
 for(let i=0;i<6;i++){
  const input={source:'video' as const,actorId:i%2===0?'A':'B',
   eventId:'qa-step-'+i,foot:i%2===0?'left' as const:'right' as const,
   verified:true,basis:'image-2d' as const,
   x:.18+i*.105,y:i%2===0?.38:.63,atMs:1000+i*180,confidence:.95};
  engine.observe(input);
  assert.ok(engine.contact(input),'step '+i);
  assert.equal(engine.contact(input),null,'duplicate event '+i);
 }
 return engine;
};

test('QA-R1 E2E: 14 Compose scenes, six contacts each, no marks added by replay',()=>{
 const bus=sixSteps();
 assert.equal(ARTISTIC_CATALOG.length,14);
 assert.deepEqual(ARTISTIC_CATALOG.map(s=>s.id),COMPOSE_SCENES.map(s=>s.id));
 const events=bus.canonicalRecent;
 assert.equal(events.filter(e=>e.kind==='contact').length,6);
 assert.equal(new Set(events.filter(e=>e.kind==='contact').map(e=>e.eventId)).size,6);
 for(const recipe of ARTISTIC_CATALOG){
  const runtime=new ArtisticFootprintRuntime();
  runtime.ingest(events,bus.generation,5000);
  assert.equal(runtime.contactCount,6,recipe.id);
  runtime.ingest(events,bus.generation,5100);
  assert.equal(runtime.contactCount,6,'replay '+recipe.id);
  runtime.skipExisting(events,bus.generation);
  runtime.ingest(events,bus.generation,5200);
  assert.equal(runtime.contactCount,0,'switch '+recipe.id);
 }
});

test('QA-R1 E2E: 10 seconds still and identity ambiguity do not stamp contacts',()=>{
 const bus=new FloorInteractionEngine();bus.reset('camera');
 for(let ms=1000;ms<=11000;ms+=100){
  bus.observe({source:'camera',actorId:'A',x:.45,y:.48,atMs:ms,confidence:.9,basis:'presence-only'});
 }
 assert.equal(bus.canonicalRecent.filter(e=>e.kind==='contact').length,0);
 const artist=new ArtisticFootprintRuntime();
 artist.ingest(bus.canonicalRecent,bus.generation);
 assert.equal(artist.contactCount,0);
 const ambiguous=bus.contact({source:'camera',actorId:'unassigned-0',eventId:'false-step',
  foot:'left',verified:true,basis:'image-2d',x:.5,y:.5,atMs:11100,confidence:.8});
 assert.equal(ambiguous,null);
});

test('QA-R1 E2E: two actor surfaces keep A/B independent across six steps',()=>{
 const bus=sixSteps(),events=bus.canonicalRecent.filter(e=>e.kind==='contact');
 assert.deepEqual(events.map(e=>e.actorId),['A','B','A','B','A','B']);
 assert.deepEqual(events.map(e=>e.foot),['left','right','left','right','left','right']);
 const layerA=events.map(e=>resolveMotionRecipeCue(e,MOTION_RECIPE_DEFAULT,'BODY A',6000)).filter(Boolean);
 const layerB=events.map(e=>resolveMotionRecipeCue(e,MOTION_RECIPE_DEFAULT,'BODY B',6000)).filter(Boolean);
 assert.equal(layerA.length,3);assert.equal(layerB.length,3);
 assert.ok(layerA.every(c=>c?.actorId==='A'));
 assert.ok(layerB.every(c=>c?.actorId==='B'));
 assert.ok(events.every(e=>resolveMotionRecipeCue(e,MOTION_RECIPE_DEFAULT,'FLOOR',6000)));
});

test('QA-R1 E2E: MP4 ↔ simulator ↔ camera source sessions never reuse IDs',()=>{
 const bus=sixSteps();const old=bus.canonicalRecent.map(e=>e.eventId);
 const oldSession=bus.currentSessionId,oldGeneration=bus.generation;
 bus.reset('simulator');
 assert.notEqual(bus.currentSessionId,oldSession);
 assert.ok(bus.generation>oldGeneration);
 assert.equal(bus.canonicalRecent.length,0);
 bus.reset('camera');
 assert.equal(bus.canonicalRecent.length,0);
 assert.ok(!bus.canonicalRecent.some(e=>old.includes(e.eventId)));
});

test('QA-R1 E2E: cue recall cannot transfer optical QA or enable physical light',()=>{
 const cues=defaultPerformCueGrid();
 assert.equal(cues.slots.length,8);
 const restored=normalizePerformCueGrid({...cues,hardwareArmed:true,approved:true});
 assert.equal('hardwareArmed' in restored,false);
 assert.equal('approved' in restored,false);
 assert.equal(performCueAuthorizesLight(),false);
 for(const surface of ['body','floor'] as const){
  const plan=defaultStageSurfacePlan(surface);
  const result=outputSurfaceDecision({plan,signature:null,proof:null,
   requested:'live',connected:true,cameraSafe:true,sourceFresh:true,
   bridgeSafe:true,operatorArmed:true});
  assert.equal(result.mode,'blackout',surface);
  assert.equal(result.assessment.required,5);
 }
 assert.equal(stageHardwareAvailable(false,undefined),false);
 assert.equal(stageHardwareAvailable(false,'disabled'),false);
});

test('QA-R1 release: every physical/browser check starts pending after CI',()=>{
 const record=emptyQaReleaseRecord('abc123');
 assert.deepEqual(record.items.map(e=>e.id),QA_REQUIRED_IDS);
 assert.equal(record.items.filter(e=>e.status==='pending').length,QA_REQUIRED_IDS.length);
 const assessed=evaluateQaRelease(record,'abc123');
 assert.equal(assessed.eligible,false);
 assert.equal(assessed.automatedPass,false);
 assert.equal(assessed.physicalPass,false);
 assert.ok(QA_PHYSICAL_IDS.every(id=>assessed.blocking.some(m=>m.includes(id))));
});

test('QA-R1 release: code pass alone never authorizes deployment',()=>{
 const record=emptyQaReleaseRecord('abc123');
 record.items.find(x=>x.id==='automated')!.status='pass';
 const assessment=evaluateQaRelease(record,'abc123');
 assert.equal(assessment.automatedPass,true);
 assert.equal(assessment.eligible,false);
 assert.equal(assessment.physicalPass,false);
});

test('QA-R1 release: malformed evidence and stale commit fail closed',()=>{
 const record=emptyQaReleaseRecord('abc123');
 assert.throws(()=>parseQaReleaseRecord({...record,items:[...record.items,record.items[0]]}));
 assert.throws(()=>parseQaReleaseRecord({...record,items:record.items.slice(1)}));
 assert.ok(evaluateQaRelease(record,'new-commit').blocking.some(x=>x.includes('Commit berubah')));
});

test('QA-R1 release: unsigned physical results cannot clear release gate',()=>{
 const record=emptyQaReleaseRecord('abc123');
 for(const item of record.items){item.status='pass';item.operator='tester';item.device='rig-1';
  item.recordedAt='2026-11-18T00:00:00Z';item.artifact='evidence/id';item.notes='observed';}
 record.metrics={freshSetupSeconds:560,repeatSetupSeconds:110,previewFpsP10:32,gpuMemoryGrowthMb:5};
 record.items.find(x=>x.id==='body-five-point')!.operator='';
 const assessment=evaluateQaRelease(record,'abc123');
 assert.equal(assessment.eligible,false);
 assert.equal(assessment.physicalPass,false);
 assert.ok(assessment.blocking.some(x=>x.includes('body-five-point')));
});
