import test from 'node:test';
import assert from 'node:assert/strict';
import {EffectRecipeEngine,defaultEffectRecipe,presetEffectRecipe,
 validateEffectRecipe} from '../src/footprints/stage-optics/EffectRecipeEngine.ts';
import {defaultStageMeta,validateStageMeta} from '../src/stage/StageSessionStore.ts';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import type {FootstepEvent} from '../src/footprints/spatial/events.ts';

const base={source:'camera' as const,positionBasis:'calibrated-estimate' as const,
 headingRad:0,confidence:.95,positionM:{xM:2,yM:2}};
const e=(id:string,kind:'contact'|'move'|'release',t:number,
 performerId='A',foot:'left'|'right'='left',mode:'camera'|'simulation'='camera'):FootstepEvent=>({
 ...base,id,kind,timestampMs:t,performerId,foot,source:mode,
 positionBasis:mode==='camera'?'calibrated-estimate':'simulated'
});
const camera=(engine:EffectRecipeEngine,events:FootstepEvent[],nowMs:number,
 motions:{performerId:string;foot:'left'|'right';motion:'hold'|'pivot'|'slide';confidence:number}[]=[],
 trusted=true,contextKey='camera-1')=>
 engine.sync({events,motions,nowMs,contextKey,mode:'camera',trusted,primeExisting:true});
test('S6.3: recipe presets remain strict, defaults are opt-in and reject unsafe values',()=>{
 const config=defaultEffectRecipe();assert.equal(config.enabled,false);
 assert.deepEqual(config.rules.map(r=>r.id),['contact','slide','pivot']);
 const t=validateEffectRecipe(presetEffectRecipe('exchange',true));
 assert.equal(t.rules[2].action,'decay');
 assert.throws(()=>validateEffectRecipe({...t,rules:[t.rules[0],t.rules[0],t.rules[2]]}),/di luar batas|memerlukan/);
 assert.throws(()=>validateEffectRecipe({...t,rules:t.rules.map((r,i)=>i===1?{...r,holdMs:50000}:r)}),/di luar batas/);
 assert.throws(()=>validateEffectRecipe({...t,rules:t.rules.map((r,i)=>i===2?{...r,minConfidence:0}:r)}),/di luar batas/);
});
test('S6.3: contact reveals A independently, then falls through hold and decay to black',()=>{
 const core=new EffectRecipeEngine();
 core.setConfig(presetEffectRecipe('residue',true));
 camera(core,[],1000); // Prime live session; previous events never replay.
 const events=[e('landing-A','contact',1040)];
 let out=camera(core,events,1050);
 assert.equal(out.contacts,1);
 assert.equal(out.body.B,0);
 assert.equal(out.floor.B,0);
 assert.equal(out.body.A,0);
 out=core.snapshot(1270);
 assert.ok(out.body.A>.95);
 assert.ok(out.floor.A>.95);
 assert.ok(core.snapshot(1650).body.A>.95);
 assert.ok(core.snapshot(3500).body.A<.18);
 assert.equal(core.snapshot(5000).floor.A,0);
 const again=camera(core,events,5000);
 assert.equal(again.contacts,1);
});
test('S6.3: a Slide holds only its performer and keeps media frame frozen for the configured time',()=>{
 const core=new EffectRecipeEngine();core.setConfig(presetEffectRecipe('residue',true));
 camera(core,[],1000);
 const a=[e('a','contact',1050,'A'),e('b','contact',1100,'B')];
 camera(core,a,1120);
 let snap=camera(core,a,1410,[
  {performerId:'A',foot:'left',motion:'slide',confidence:.91},
  {performerId:'B',foot:'left',motion:'hold',confidence:.91}
 ]);
 assert.equal(snap.slides,1);
 assert.equal(snap.holdVideo.A,true);
 assert.equal(snap.holdVideo.B,false);
 assert.ok(snap.floor.A>=0);
 snap=camera(core,a,1510,[{performerId:'A',foot:'left',motion:'slide',confidence:.91}]);
 assert.equal(snap.slides,1,'ongoing slide may not retrigger every frame');
 assert.equal(core.snapshot(2750).holdVideo.A,false);
 camera(core,a,2850,[{performerId:'A',foot:'left',motion:'hold',confidence:.91}]);
 snap=camera(core,a,2930,[{performerId:'A',foot:'left',motion:'slide',confidence:.91}]);
 assert.equal(snap.slides,2,'new slide episode may retrigger');
});
test('S6.3: pivot decays BODY for A only, without stamping duplicate contact',()=>{
 const core=new EffectRecipeEngine();core.setConfig(presetEffectRecipe('residue',true));
 camera(core,[],1000);
 const events=[e('a','contact',1100,'A'),e('b','contact',1130,'B')];
 camera(core,events,1150);
 const before=core.snapshot(1350);
 assert.ok(before.body.A>.5&&before.body.B>.5);
 let snap=camera(core,events,1400,[
  {performerId:'A',foot:'left',motion:'pivot',confidence:.98},
  {performerId:'B',foot:'right',motion:'hold',confidence:.97}
 ]);
 assert.equal(snap.pivots,1);assert.equal(snap.contacts,2);
 snap=camera(core,events,1500,[{performerId:'A',foot:'left',motion:'pivot',confidence:.98}]);
 assert.equal(snap.pivots,1);
 assert.ok(core.snapshot(2500).body.A===0);
 assert.ok(core.snapshot(1600).body.B>0);
 camera(core,events,2750,[{performerId:'A',foot:'left',motion:'hold',confidence:.95}]);
 snap=camera(core,events,2800,[{performerId:'A',foot:'left',motion:'pivot',confidence:.98}]);
 assert.equal(snap.pivots,2);
});
test('S6.3: failure causes immediate blackout and consumes stale contacts (no delayed flash)',()=>{
 const core=new EffectRecipeEngine();core.setConfig(presetEffectRecipe('exchange',true));
 camera(core,[],1000);
 const landing=[e('a','contact',1100)];
 camera(core,landing,1150);
 assert.ok(core.snapshot(1300).body.A>0);
 const blocked=camera(core,[...landing,e('b','contact',1500)],1520,[],false);
 assert.equal(blocked.status,'blocked');
 assert.equal(blocked.body.A,0);assert.equal(blocked.floor.A,0);
 assert.equal(blocked.holdVideo.A,false);
 const restored=camera(core,[...landing,e('b','contact',1500)],1620,[],true);
 assert.equal(restored.contacts,0);
 assert.equal(restored.body.A,0);
 const next=camera(core,[...landing,e('b','contact',1500),e('c','contact',1700)],1710);
 assert.equal(next.contacts,1);
});
test('S6.3: old FloorSession contacts are primed/skipped when live mapping panel opens',()=>{
 const core=new EffectRecipeEngine();core.setConfig(presetEffectRecipe('residue',true));
 const old=[e('older','contact',1000)];
 const out=camera(core,old,1500);
 assert.equal(out.contacts,0);
 const next=camera(core,[...old,e('new','contact',1530)],1550);
 assert.equal(next.contacts,1);
 assert.equal(next.body.A,0);
});
test('S6.3: simulation preview cue cannot impersonate live camera',()=>{
 const core=new EffectRecipeEngine();core.setConfig(presetEffectRecipe('residue',true));
 assert.throws(()=>core.preview('pivot','A',500,'camera'),/Simulasi/);
 core.sync({events:[],motions:[],nowMs:500,contextKey:'sim',mode:'simulation',trusted:true});
 core.preview('contact','B',500,'simulation');
 assert.ok(core.snapshot(720).body.B>.9);
 assert.equal(core.snapshot(720).body.A,0);
});
test('S6.3: simulation move event is a Slide, and a new session resets event state',()=>{
 const core=new EffectRecipeEngine();core.setConfig(presetEffectRecipe('exchange',true));
 const feed=[e('sim-a','contact',500,'performer-1','left','simulation'),
  e('sim-slide','move',720,'performer-1','left','simulation')];
 const first=core.sync({events:feed,motions:[],nowMs:760,mode:'simulation',contextKey:'sim',trusted:true});
 assert.equal(first.contacts,1);
 assert.equal(first.slides,1);
 const second=core.sync({events:feed,motions:[],nowMs:100,mode:'simulation',contextKey:'sim',trusted:true});
 assert.equal(second.contacts,0);
 assert.equal(second.slides,0);
});
test('S6.3: old Stage Session V1 upgrades recipe off without removing archives',()=>{
 const original=defaultStageMeta();
 const old={...original};
 delete (old as {effectRecipe?:unknown}).effectRecipe;
 const migrated=validateStageMeta(old);
 assert.deepEqual(migrated.archiveSettings,original.archiveSettings);
 assert.equal(migrated.bridgeHoldMs,original.bridgeHoldMs);
 assert.equal(migrated.effectRecipe.enabled,false);
 assert.equal(migrated.effectRecipe.rules.length,3);
 const saved={...migrated,effectRecipe:presetEffectRecipe('residue',true)};
 assert.equal(validateStageMeta(saved).effectRecipe.enabled,true);
});
test('S6.3: no recipe event duplicates the existing foot contacts',()=>{
 const core=new EffectRecipeEngine();core.setConfig(presetEffectRecipe('residue',true));
 const floor=defaultFloorSpace(8,6);
 assert.equal(floor.widthM,8);
 // Pure engine reads FootstepEvent objects, returns visual envelope only.
 assert.equal(typeof (core as unknown as Record<string,unknown>).ingest,'undefined');
 const events=[e('unique','contact',1200)];
 camera(core,[],1000);const output=camera(core,events,1210);
 assert.equal(output.contacts,1);
 assert.equal(events.length,1);
 assert.equal(events[0].id,'unique');
});
