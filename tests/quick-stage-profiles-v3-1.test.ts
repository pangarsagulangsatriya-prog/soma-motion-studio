import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {QUICK_STAGE_PROFILES_KEY,validateQuickStageProfile,loadQuickStageProfiles,
 storeQuickStageProfile,quickStageMatchesCamera,quickStageDiagnostics,
 type QuickStageProfile} from '../src/studio/v3/quickStageProfiles.ts';
import {readFileSync} from 'node:fs';
const profile=(deviceId='cam-01',width=1280,height=720):QuickStageProfile=>({
 schema:'soma.quick-stage-profile',version:1,id:'main-floor',name:'Panggung utama',
 camera:{deviceId,label:'Kamera overhead',width,height},
 calibration:{schema:'soma.footprints.camera-floor',version:1,
 floor:defaultFloorSpace(8,6),
 cameraQuad:[{x:.12,y:.18},{x:.88,y:.18},{x:.88,y:.82},{x:.12,y:.82}]},
 performers:2,updatedAt:'2026-11-18T08:00:00.000Z'
});
const memory=()=>{
 const db=new Map<string,string>();
 return {getItem:(key:string)=>db.get(key)??null,
  setItem:(key:string,val:string)=>{db.set(key,val);},db};
};
test('V3.1 saves and restores a validated local geometry profile',()=>{
 const storage=memory(),p=profile();
 const stored=storeQuickStageProfile(storage,p);
 assert.equal(stored.length,1);
 assert.deepEqual(loadQuickStageProfiles(storage),[p]);
 assert.equal(JSON.parse(storage.db.get(QUICK_STAGE_PROFILES_KEY)??'[]')[0].camera.deviceId,'cam-01');
});
test('V3.1 protects profiles against wrong device / resolution / ephemeral track IDs',()=>{
 const p=profile();
 assert.equal(quickStageMatchesCamera(p,{trackId:'new-track',deviceId:'cam-01',
  width:1280,height:720}),true);
 assert.equal(quickStageMatchesCamera(p,{trackId:'old-track',deviceId:'cam-02',
  width:1280,height:720}),false);
 assert.equal(quickStageMatchesCamera(p,{trackId:'old-track',deviceId:'cam-01',
  width:1920,height:1080}),false);
 assert.equal(quickStageMatchesCamera(profile(''),{trackId:'foo',deviceId:'',
  width:1280,height:720}),false);
 assert.equal(quickStageMatchesCamera(p,null),false);
});
test('V3.1 rejects malformed four-point calibration and damaged local storage',()=>{
 const p=profile();
 assert.throws(()=>validateQuickStageProfile({...p,
  calibration:{...p.calibration,cameraQuad:[{x:1,y:1}]}}));
 const storage=memory();
 storage.setItem(QUICK_STAGE_PROFILES_KEY,'{broken');
 assert.deepEqual(loadQuickStageProfiles(storage),[]);
 storage.setItem(QUICK_STAGE_PROFILES_KEY,JSON.stringify([{...p,
  calibration:{...p.calibration,cameraQuad:[]}},p]));
 assert.deepEqual(loadQuickStageProfiles(storage),[p]);
});
test('V3.1 status never treats saved profile, video-only or disconnected projector as ready',()=>{
 const input={cameraOn:true,cameraBusy:false,cameraError:'',bodySelected:true,
  videoReady:true,frameFresh:true,performerCount:2,visibleCount:2,
  identityAmbiguous:false,identityMatchedFrame:true,
  floorCalibrated:true,floorConfirmed:false,
  cameraMatched:true,outputConnected:false};
 const result=quickStageDiagnostics(input);
 assert.deepEqual(result.map(x=>x.state),['ready','ready','pending','pending']);
 assert.equal(quickStageDiagnostics({...input,floorConfirmed:true,
  outputConnected:true}).filter(x=>x.state==='ready').length,4);
 assert.equal(quickStageDiagnostics({...input,cameraError:'Akses ditolak'})[0].state,'warning');
 assert.equal(quickStageDiagnostics({...input,visibleCount:1})[1].state,'pending');
 assert.equal(quickStageDiagnostics({...input,identityAmbiguous:true})[1].state,'pending');
 assert.equal(quickStageDiagnostics({...input,identityMatchedFrame:false})[1].state,'pending');
});
test('V3.1 remains a local UI transaction and preserves original physical-output gates',()=>{
 const ui=readFileSync(new URL('../src/studio/v3/QuickStageSetup.tsx',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ui,/onBlackout\(\)/);
 assert.match(ui,/tracker\.configure\(selected\.calibration,binding\)/);
 assert.doesNotMatch(ui,/tracker\.confirm\(true\)/);
 assert.match(app,/onSelectCameraDevice=\{selectFootprintsCameraDevice\}/);
 assert.doesNotMatch(stage,/<QuickStageSetup/);
 assert.match(stage,/<MapCameraCalibration/);
 assert.match(ui,/profil lantai|Profil lantai/);
});
