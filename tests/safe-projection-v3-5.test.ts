import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeProjectionPreflight,shouldLatchProjectionBlackout,
 type SafeProjectionInput} from '../src/studio/v3/safeProjectionPreflight.ts';
import {loadStageOutputDrafts,saveStageOutputDraft,
 stableStageEquipmentKey,matchingStageOutputDraft,validateStageOutputDraft,
 STAGE_OUTPUT_DRAFTS_KEY,type StageOutputDraft}
 from '../src/studio/v3/stageOutputDraftProfiles.ts';
import {defaultStageSurfacePlan} from '../src/footprints/stage-optics/DualSurfaceCalibration.ts';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';

const output=()=>({
 surface:'floor' as const,reported:true,opened:true,connected:true,
 mode:'blackout' as const,qa:'within-provisional-target' as const,
 sampledAtMs:500,reason:'software QA reported'
});
const ready=():SafeProjectionInput=>({
 source:'webcam',cameraOn:true,cameraBusy:false,bodySelected:true,
 frameFresh:true,identities:2,performers:2,identityAmbiguous:false,
 matchedFrame:true,floorConfirmed:true,cameraMatched:true,
 hardwareEnabled:true,floorOutput:output()
});
const memory=()=>{
 const items=new Map<string,string>();
 return {getItem:(k:string)=>items.get(k)??null,setItem:(k:string,v:string)=>{items.set(k,v);},items};
};
const camera=(trackId='track1',device='cam1',width=1280,height=720)=>
 JSON.stringify([trackId,device,width,height]);
const quad=[
 {x:.12,y:.16},{x:.88,y:.16},{x:.89,y:.85},{x:.11,y:.85}
];
const calibration={schema:'soma.footprints.camera-floor',version:1,
 floor:defaultFloorSpace(8,6),cameraQuad:quad};
const floorKey=(cameraKey:string,performers:1|2=2)=>
 JSON.stringify([calibration,cameraKey,performers]);
const equipment=stableStageEquipmentKey(camera(),floorKey(camera()))!;
const draft=():StageOutputDraft=>({
 schema:'soma.stage-output-draft',version:1,id:'main-stage',
 name:'Panggung 8x6',equipmentKey:equipment,
 updatedAt:'2026-11-18T10:00:00.000Z',
 plans:{body:defaultStageSurfacePlan('body'),floor:defaultStageSurfacePlan('floor')}
});
test('V3.5: projector preflight advances camera → tracking → floor → QA',()=>{
 const base=ready();
 assert.equal(safeProjectionPreflight({...base,source:null,cameraOn:false}).action,'choose-camera');
 assert.equal(safeProjectionPreflight({...base,frameFresh:false}).action,'inspect-tracking');
 assert.equal(safeProjectionPreflight({...base,identityAmbiguous:true}).action,'inspect-tracking');
 assert.equal(safeProjectionPreflight({...base,identities:1}).action,'inspect-tracking');
 assert.equal(safeProjectionPreflight({...base,floorConfirmed:false}).action,'confirm-floor');
 assert.equal(safeProjectionPreflight({...base,cameraMatched:false}).action,'confirm-floor');
 const preflight=safeProjectionPreflight(base);
 assert.equal(preflight.action,'open-output-qa');
 assert.equal(preflight.physicalReady,false);
 assert.equal(preflight.progress,4);
});
test('V3.5: MP4/3D pass optical preflight only with ready frames, build opt-in and QA',()=>{
 for(const source of ['video','simulator'] as const){
  const state=safeProjectionPreflight({...ready(),source,
   floorOutput:{...output(),mode:'live'}});
  assert.equal(state.step,'ready');
  assert.equal(state.physicalReady,true);
  assert.equal(state.action,'monitor-output');
 }
 const noPhysical=safeProjectionPreflight({...ready(),hardwareEnabled:false,
  floorOutput:{...output(),mode:'live'}});
 assert.equal(noPhysical.step,'software-only');
 assert.equal(noPhysical.physicalReady,false);
});
test('V3.5: LIVE is indicated only with real QA, connected window and software Live',()=>{
 const a=ready();
 assert.equal(safeProjectionPreflight(a).physicalReady,false);
 assert.equal(safeProjectionPreflight({...a,
  floorOutput:{...output(),mode:'live'}}).physicalReady,true);
 for(const c of [
  {...a,floorOutput:{...output(),mode:'live' as const,connected:false}},
  {...a,floorOutput:{...output(),mode:'live' as const,qa:'incomplete' as const}},
  {...a,frameFresh:false,floorOutput:{...output(),mode:'live' as const}}
 ]){
  assert.equal(safeProjectionPreflight(c).physicalReady,false);
 }
});
test('V3.5: losing tracking, artwork or display latches LIVE blackout',()=>{
 assert.equal(shouldLatchProjectionBlackout({requested:'live',connected:true,
  stageSafe:true,sourceSafe:true}),false);
 for(const args of [
  {requested:'live' as const,connected:false,stageSafe:true,sourceSafe:true},
  {requested:'live' as const,connected:true,stageSafe:false,sourceSafe:true},
  {requested:'live' as const,connected:true,stageSafe:true,sourceSafe:false}
 ])assert.equal(shouldLatchProjectionBlackout(args),true);
 assert.equal(shouldLatchProjectionBlackout({requested:'test',connected:false,
  stageSafe:false,sourceSafe:false}),false);
});
test('V3.5: saved projector draft survives new MediaStreamTrack ID only',()=>{
 const newer=camera('track-new');
 assert.equal(stableStageEquipmentKey(newer,floorKey(newer)),equipment);
 const anotherDevice=camera('track2','cam2');
 assert.notEqual(stableStageEquipmentKey(anotherDevice,floorKey(anotherDevice)),equipment);
 const anotherRaster=camera('track2','cam1',1920,1080);
 assert.notEqual(stableStageEquipmentKey(anotherRaster,floorKey(anotherRaster)),equipment);
 assert.notEqual(stableStageEquipmentKey(camera(),floorKey(camera(),1)),equipment);
 assert.equal(stableStageEquipmentKey(camera(),null),null);
 assert.equal(matchingStageOutputDraft(draft(),equipment),true);
 assert.equal(matchingStageOutputDraft(draft(),'other'),false);
});
test('V3.5: plan storage validates both quads and never stores QA or LIVE authority',()=>{
 const store=memory();
 const a=draft();
 assert.equal(saveStageOutputDraft(store,a).length,1);
 assert.deepEqual(loadStageOutputDrafts(store),[a]);
 const saved=JSON.parse(store.items.get(STAGE_OUTPUT_DRAFTS_KEY)??'[]')[0];
 assert.deepEqual(Object.keys(saved).sort(),['equipmentKey','id','name','plans','schema','updatedAt','version']);
 assert.equal(saved.proofs,undefined);
 assert.equal(saved.authorized,undefined);
 assert.throws(()=>validateStageOutputDraft({...a,
  plans:{...a.plans,floor:{...a.plans.floor,brightness:1}}}));
 assert.throws(()=>validateStageOutputDraft({...a,
  plans:{...a.plans,body:defaultStageSurfacePlan('floor')}}));
 store.setItem(STAGE_OUTPUT_DRAFTS_KEY,'{broken json');
 assert.deepEqual(loadStageOutputDrafts(store),[]);
});
test('V3.5: implementation preserves manual opt-in and distinct clean output',()=>{
 const dual=readFileSync(new URL(
  '../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx',import.meta.url),'utf8');
 const stage=readFileSync(new URL(
  '../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 const projection=readFileSync(new URL(
  '../src/projection/ProjectionOutput.tsx',import.meta.url),'utf8');
 assert.match(dual,/shouldLatchProjectionBlackout/);
 assert.match(dual,/if\(!STAGE_HARDWARE_ENABLED\)/);
 assert.doesNotMatch(dual,/changeMode\(id,'live'\)/);
  assert.match(dual,/Lanjutkan pengaturan LIVE di Perform/);
 assert.match(dual,/assessment\(id\)\.status!=='within-provisional-target'/);
 assert.match(dual,/setProofs\(\{body:null,floor:null\}\)/);
 assert.match(dual,/ids\.forEach\(urgentBlackout\)/);
 assert.match(stage,/safeProjectionPreflight/);
 assert.match(stage,/onBlackout=\{onBlackout\} onClose=\{\(\)=>setMapCameraOpen\(false\)\}/);
 assert.match(projection,/Output proyeksi bersih/);
});
