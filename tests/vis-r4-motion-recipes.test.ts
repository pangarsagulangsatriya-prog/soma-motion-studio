import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {
 MOTION_RECIPE_DEFAULT,MOTION_RECIPE_TRIGGERS,MOTION_RECIPE_TREATMENTS,
 normalizeMotionRecipeRule,resolveMotionRecipeCue,motionRecipeEnvelope,
 motionRecipeSurfaceMatches,motionRecipeAllowsHardwareOutput
} from '../src/footprints/scenes/motionRecipeModel.ts';
import type {FootMotionEventV2} from '../src/footprints/scenes/FootMotionEventV2.ts';
const source=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const events=()=>{
 const engine=new FloorInteractionEngine();engine.reset('video');
 for(let i=0;i<6;i++){
  const e={source:'video' as const,actorId:i%2?'B':'A',
   foot:(i%2?'right':'left') as 'left'|'right',
   eventId:'step-'+i,atMs:1000+i*120,x:.22+i*.08,y:.56,confidence:.9,
   basis:'image-2d' as const,verified:true};
  assert.ok(engine.contact(e));
 }
 return engine.canonicalRecent;
};
test('VIS-R4: exactly five triggers, five treatments and bounded persisted schema',()=>{
 assert.deepEqual(MOTION_RECIPE_TRIGGERS,['contact','presence','movement','slide','pivot']);
 assert.deepEqual(MOTION_RECIPE_TREATMENTS,['reveal','hold','decay','pulse','distort']);
 assert.equal(MOTION_RECIPE_DEFAULT.verifiedOnly,true);
 assert.deepEqual(normalizeMotionRecipeRule({trigger:'invalid',durationMs:Infinity,strength:NaN}),MOTION_RECIPE_DEFAULT);
 const valid=normalizeMotionRecipeRule({trigger:'movement',treatment:'pulse',durationMs:50000,strength:-3,verifiedOnly:false});
 assert.equal(valid.durationMs,12000);assert.equal(valid.strength,0);assert.equal(valid.verifiedOnly,false);
});
test('VIS-R4: verified six-step fixture triggers six unique contact cues',()=>{
 const list=events(),rule=normalizeMotionRecipeRule({trigger:'contact',treatment:'reveal',verifiedOnly:true});
 const cues=list.map((e,i)=>resolveMotionRecipeCue(e,rule,'FLOOR',2000+i*100));
 assert.equal(cues.filter(Boolean).length,6);
 assert.equal(new Set(cues.filter(Boolean).map(x=>x!.eventId)).size,6);
 assert.ok(cues.every(c=>c?.verified===true));
});
test('VIS-R4: A and B cues stay on their own BODY surface, FLOOR can receive both',()=>{
 for(const e of events()){
  const rule=MOTION_RECIPE_DEFAULT;
  assert.equal(!!resolveMotionRecipeCue(e,rule,'BODY A',2000),e.actorId==='A');
  assert.equal(!!resolveMotionRecipeCue(e,rule,'BODY B',2000),e.actorId==='B');
  assert.ok(resolveMotionRecipeCue(e,rule,'FLOOR',2000));
 }
 assert.equal(motionRecipeSurfaceMatches('BODY A','unassigned-0'),false);
 assert.equal(motionRecipeSurfaceMatches('BODY B','A'),false);
});
test('VIS-R4: unverified contact and ambiguous actor never trigger visual stamps',()=>{
 const seed=events()[0];
 const r=MOTION_RECIPE_DEFAULT;
 assert.equal(resolveMotionRecipeCue({...seed,verified:false,verification:'unverified'},r,'FLOOR',2000),null);
 assert.equal(resolveMotionRecipeCue({...seed,actorId:'unassigned-0'},r,'FLOOR',2000),null);
 assert.equal(resolveMotionRecipeCue(seed,r,'BODY A',2000,false),null);
});
test('VIS-R4: movement/presence are preview inputs; slide/pivot stay experimental',()=>{
 const seed=events()[0];
 const move={...seed,kind:'movement' as const,verified:false,verification:'unverified' as const};
 const r=normalizeMotionRecipeRule({trigger:'movement',treatment:'hold',verifiedOnly:false});
 assert.ok(resolveMotionRecipeCue(move,r,'FLOOR',2000));
 assert.equal(resolveMotionRecipeCue(move,{...r,verifiedOnly:true},'FLOOR',2000),null);
 for(const kind of ['slide','pivot'] as const){
  const candidate={...seed,kind,verified:false,verification:'unverified' as const};
  assert.equal(resolveMotionRecipeCue(candidate,{...r,trigger:kind,verifiedOnly:true},'FLOOR',2000),null);
  assert.ok(resolveMotionRecipeCue(candidate,{...r,trigger:kind,verifiedOnly:false},'FLOOR',2000));
 }
});
test('VIS-R4: time envelopes are bounded and settle at zero',()=>{
 const e=events()[0];
 for(const treatment of MOTION_RECIPE_TREATMENTS){
  const rule=normalizeMotionRecipeRule({trigger:'contact',treatment,durationMs:1200,strength:.75});
  const cue=resolveMotionRecipeCue(e,rule,'FLOOR',2000);
  assert.ok(cue);
  for(const now of [2000,2100,2300,2600,3200,4000]){
   const alpha=motionRecipeEnvelope(cue,now);
   assert.ok(alpha>=0&&alpha<=.75+1e-6,treatment+': '+alpha);
  }
  assert.equal(motionRecipeEnvelope(cue,3200),0);
  assert.equal(motionRecipeAllowsHardwareOutput(cue),false);
 }
});
test('VIS-R4: composer uses canonical FLOOR V2 event bus and keeps legacy presets readable',()=>{
 const stage=source('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const composer=source('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(stage,/motionEvents=\{\(\)=>interactionEngineRef\.current\.canonicalRecent\}/);
 assert.match(stage,/motionSession=\{\(\)=>interactionEngineRef\.current\.currentSessionId\}/);
 assert.match(composer,/activeMotionSession\.current!==session/);
 assert.match(composer,/motionClocks\.current\.clear\(\)/);
 assert.match(composer,/motionClocks\.current\.set\(item\.id,cue\)/);
 assert.match(composer,/layer\.recipe==='motion-v2'/);
 assert.match(composer,/layer\?\.recipe==='motion-v2'/);
 assert.match(composer,/option value="contact-reveal"/);
 assert.match(composer,/option value="motion-v2"/);
 assert.match(composer,/physical\|\|!identitySafeRef\.current\?0:motionRecipeEnvelope/);
});
test('VIS-R4: archival image/video enters existing Hydra, physical route stays clean',()=>{
 const stage=source('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const composer=source('../src/studio/v3/SurfaceComposer.tsx');
 assert.match(stage,/hydraRuntime\.current\.tick\(archiveHydraCanvas\.current/);
 assert.match(stage,/hydraRuntime\.current\.tick\(cleanFloorOutput\.current/);
 assert.match(stage,/floorCanvas=\{cleanFloorOutput\}/);
 assert.match(composer,/kind==='floor'\?\(experiment&&!physical\?experimentFloorCanvas\?\.current\?\?null:floorCanvas\.current\)/);
 assert.match(composer,/if\(experiment&&physical\)return/);
 assert.match(composer,/archiveHydraCanvas\.current=document\.createElement\('canvas'\)/);
 assert.match(composer,/render\(archiveCtx,'FLOOR',640,360,true,false\)/);
 assert.match(composer,/archiveHydraCanvas=|archiveHydraCanvas/);
 assert.ok(!composer.includes('getUserMedia('));
});
