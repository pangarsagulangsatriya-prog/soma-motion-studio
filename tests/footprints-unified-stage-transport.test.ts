import test from 'node:test';
import assert from 'node:assert/strict';
import {claimDualOutputStatus,readDualOutputStatus,releaseDualOutputStatus,
 reportDualOutputStatus,verifiedDualStatus,watchDualOutputStatus,
 type DualSurfaceState} from '../src/footprints/stage-optics/DualSurfaceTelemetry.ts';
import {deriveUnifiedStageStatus,legacyStageTransportGate,
 type UnifiedContext} from '../src/studio/v3/unifiedStageStatus.ts';
const stage=(surface:'body'|'floor',mode:'blackout'|'live'|'test'='blackout'):DualSurfaceState=>({
 surface,reported:true,opened:true,connected:true,mode,
 qa:'within-provisional-target',reason:'Software channel connected',sampledAtMs:100
});
const ctx=():UnifiedContext=>({
 camera:{on:true,busy:false,error:'',frameFresh:true},
 identity:{count:2,visibleCount:2,ambiguous:false,observedSameFrame:true},
 floor:{calibrated:true,confirmed:true,cameraMatched:true,contacts:10},
 bodyMask:{ready:true,reason:'Mask terbaca'},
 dual:{body:stage('body','blackout'),floor:stage('floor','blackout')},
 hardwareEnabled:true
});
const legacy={opened:true,connected:true,mode:'blackout' as const,approved:true};
test('camera, A/B, calibration and two independent routes share a single truthful status model',()=>{
 const result=deriveUnifiedStageStatus(ctx());
 assert.deepEqual(result.map(v=>v.id),['camera','identity','calibration','body','floor']);
 assert.equal(result[0].detail,'Tracking aktif');
 assert.equal(result[1].detail,'A + B terbaca');
 assert.equal(result[2].detail,'Terkalibrasi (estimasi)');
 assert.equal(result[3].detail,'Blackout diperintahkan');
 assert.ok(result.every(i=>i.level==='ok'));
});
test('tracking lost or identity ambiguity cannot appear as a healthy status',()=>{
 const first=ctx();first.camera.frameFresh=false;
 assert.equal(deriveUnifiedStageStatus(first)[1].level,'idle');
 first.camera.frameFresh=true;first.identity.ambiguous=true;
 assert.equal(deriveUnifiedStageStatus(first)[1].level,'warn');
 first.identity.ambiguous=false;first.identity.observedSameFrame=false;
 assert.equal(deriveUnifiedStageStatus(first)[1].level,'warn');
 first.identity.observedSameFrame=true;first.floor.cameraMatched=false;
 assert.equal(deriveUnifiedStageStatus(first)[2].level,'warn');
 first.floor.cameraMatched=true;first.camera.error='Permission denied';
 assert.equal(deriveUnifiedStageStatus(first)[0].level,'warn');
});
test('production optics hard lock is explicit and cannot be mistaken for LIVE',()=>{
 const s=ctx();s.hardwareEnabled=false;s.dual.body=stage('body','live');
 s.dual.floor=stage('floor','live');
 const indicators=deriveUnifiedStageStatus(s);
 assert.equal(indicators[3].detail,'Terkunci di Production');
 assert.equal(indicators[4].detail,'Terkunci di Production');
 assert.equal(indicators[3].level,'idle');
});
test('connected output reports SOFTWARE command rather than certifying hardware light',()=>{
 const s=ctx();s.dual.body=stage('body','live');
 assert.match(deriveUnifiedStageStatus(s)[3].detail,/diperintahkan/);
 assert.equal(deriveUnifiedStageStatus(s)[3].level,'warn');
 s.dual.floor=stage('floor','test');
 assert.match(deriveUnifiedStageStatus(s)[4].detail,/TEST terbatas/);
});
test('dual surface status ignores stale owners, never replays old live state after closing panel',()=>{
 let changes=0;
 const off=watchDualOutputStatus(()=>{changes++;});
 claimDualOutputStatus('instance-A');
 reportDualOutputStatus('instance-A',stage('body','live'));
 assert.equal(readDualOutputStatus().body.mode,'live');
 reportDualOutputStatus('instance-B',stage('body','blackout'));
 assert.equal(readDualOutputStatus().body.mode,'live');
 releaseDualOutputStatus('instance-B');
 assert.equal(readDualOutputStatus().body.mode,'live');
 releaseDualOutputStatus('instance-A');
 assert.equal(readDualOutputStatus().body.reported,false);
 assert.equal(readDualOutputStatus().body.mode,'offline');
 assert.ok(changes>=3);off();
});
test('telemetry TTL fails closed on missing reports and stale heartbeats',()=>{
 assert.equal(verifiedDualStatus(stage('body','live'),101).mode,'live');
 assert.equal(verifiedDualStatus(stage('body','live'),1001).mode,'offline');
 const disconnected={...stage('floor','live'),connected:false};
 assert.equal(verifiedDualStatus(disconnected,200).mode,'offline');
 const older={...stage('body','live'),sampledAtMs:-1};
 assert.equal(verifiedDualStatus(older,100).mode,'offline');
});
test('legacy projector Live/Hold is denied without connection, QA or safe camera floor context',()=>{
 const valid={cameraOn:true,frameFresh:true,floorConfirmed:true,cameraMatched:true,
  dualOpened:false,legacy};
 assert.equal(legacyStageTransportGate(valid).canLive,true);
 assert.equal(legacyStageTransportGate(valid).canHold,false);
 assert.equal(legacyStageTransportGate({...valid,dualOpened:true}).canLive,false);
 assert.equal(legacyStageTransportGate({...valid,legacy:{...legacy,approved:false}}).canLive,false);
 assert.equal(legacyStageTransportGate({...valid,legacy:{...legacy,connected:false}}).canLive,false);
 assert.equal(legacyStageTransportGate({...valid,cameraMatched:false}).canLive,false);
 assert.equal(legacyStageTransportGate({...valid,frameFresh:false}).canLive,false);
 assert.equal(legacyStageTransportGate({...valid,legacy:{...legacy,mode:'live'}}).canHold,true);
});
