import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import {identityQuad} from '../src/projection/geometry.ts';
import type {FootstepEvent} from '../src/footprints/spatial/events.ts';
import {CALIBRATION_QA_TARGETS,measureCalibrationQATarget,summarizeCalibrationQA} from '../src/footprints/validation/CalibrationQA.ts';
import {addMovementEvidence,addPhotonEvidence,annotatePhysicalContact,
 assessPhysicalAcceptance,capturePhysicalTrial,exportPhysicalAcceptance,markPhysicalReview,
 removePhysicalContact,removeMovementEvidence,removePhotonEvidence,
 requiredMovementCases,summarizePhysicalTrial} from '../src/footprints/validation/PhysicalAcceptance.ts';

const floor=defaultFloorSpace(8,6),signature='test:fixed-camera-quad-projector';
const camera:CameraFloorCalibration={
 schema:'soma.footprints.camera-floor',version:1,floor,cameraQuad:identityQuad()};
const qa=summarizeCalibrationQA(CALIBRATION_QA_TARGETS.map((x,i)=>
 measureCalibrationQATarget(camera,i,x.uv,signature)),signature);
function cameraEvents(count:number,performerCount:1|2=2):FootstepEvent[]{
 return Array.from({length:count},(_,i)=>({
  id:'cam-'+i,performerId:performerCount===1?'performer-1':i%2===0?'A':'B',
  foot:i%4<2?'left' as const:'right' as const,kind:'contact' as const,
  timestampMs:i*100,positionM:{xM:2+(i%5)*.2,yM:2+(i%3)*.2},
  headingRad:0,source:'camera' as const,positionBasis:'calibrated-estimate' as const,
  confidence:.99
 }));
}
function completeTrial(events:FootstepEvent[],matchCount=events.length,performerCount:1|2=2){
 let trial=capturePhysicalTrial(floor,events,performerCount,signature,'take_real_01.mp4',120,120);
 for(let i=0;i<matchCount;i++){
  const event=events[i];
  trial=annotatePhysicalContact(trial,{
   performerId:event.performerId,foot:event.foot,videoFrame:100+i*10,
   referenceM:event.positionM,matchedEventId:event.id,movement:'normal-walk',
   note:'annotated touchdown '+i
  });
 }
 for(const k of requiredMovementCases(performerCount)){
  if(k==='crossing')trial=addMovementEvidence(trial,k,200,'both','actual crossing filmed');
  else for(const performerId of performerCount===1?['performer-1']:['A','B'])
   trial=addMovementEvidence(trial,k,200,performerId,'frame video checked');
 }
 for(let i=0;i<Math.min(5,matchCount);i++)
  trial=addPhotonEvidence(trial,trial.physicalContacts[i].id,8);
 trial={...trial,checklist:{floorMarkersMeasured:true,fixedCameraAndProjector:true,
  footAndProjectionInSameVideo:true,blackoutAndReconnectionChecked:true}};
 return markPhysicalReview(trial,true,'Operator A','Physical footage reviewed in full');
}
test('no physical evidence does not inherit synthetic QA as stage acceptance',()=>{
 assert.equal(qa.status,'within-provisional-target');
 assert.equal(assessPhysicalAcceptance(null,signature,qa).status,'incomplete');
 const empty=capturePhysicalTrial(floor,[],1,signature,'empty_video.mp4',30,120);
 assert.equal(assessPhysicalAcceptance(empty,signature,qa).status,'incomplete');
 assert.equal(assessPhysicalAcceptance(empty,signature,qa).summary?.precision,null);
});
test('two independent performer sets, 24 video-measured touchdowns, and same-shot timing meet provisional gates',()=>{
 const events=cameraEvents(24),trial=completeTrial(events);
 const sum=summarizePhysicalTrial(trial),decision=assessPhysicalAcceptance(trial,signature,qa);
 assert.equal(sum.cameraContacts,24);assert.equal(sum.physicalContacts,24);
 assert.equal(sum.precision,1);assert.equal(sum.recall,1);
 assert.equal(sum.falseContactsPerMinute,0);assert.equal(sum.errorCm.p95,0);
 assert.equal(sum.lightMs.p95,66.67);
 assert.equal(sum.perPerformer[0].truth,12);
 assert.equal(sum.perPerformer[1].truth,12);
 assert.equal(decision.status,'meets-provisional-gates');
 const report=exportPhysicalAcceptance(trial,signature,qa);
 assert.equal(report.schema,'soma.footprints.physical-acceptance');
 assert.equal(report.assessment.status,'meets-provisional-gates');
 assert.equal(report.trial.reviewComplete,true);
});
test('extra camera stamps lower precision and cause an explicit adjustment decision after review',()=>{
 const events=cameraEvents(32),trial=completeTrial(events,24);
 const sum=summarizePhysicalTrial(trial);
 assert.equal(sum.falseContacts,8);assert.equal(sum.falseContactsPerMinute,4);
 assert.equal(sum.precision,.75);assert.equal(sum.recall,1);
 assert.equal(assessPhysicalAcceptance(trial,signature,qa).status,'needs-adjustment');
});
test('real touchdown without camera match lowers recall, and unmatched event must not be silently counted as true',()=>{
 let trial=completeTrial(cameraEvents(24));
 for(let i=0;i<8;i++)trial={...trial,reviewComplete:false};
 for(let i=0;i<8;i++){
  trial=annotatePhysicalContact(trial,{performerId:i%2?'B':'A',foot:'left',
   videoFrame:400+i*10,referenceM:{xM:3,yM:3},matchedEventId:null,movement:'slow-low-step'});
 }
 trial=markPhysicalReview(trial,true,'Operator A','8 actual misses checked');
 assert.equal(summarizePhysicalTrial(trial).missedContacts,8);
 assert.equal(summarizePhysicalTrial(trial).recall,.75);
 assert.equal(assessPhysicalAcceptance(trial,signature,qa).status,'needs-adjustment');
});
test('an actual physical position drift and long touchdown-to-light delay fail independent limits',()=>{
 const events=cameraEvents(24);
 let trial=completeTrial(events);
 trial={...trial,reviewComplete:false,physicalContacts:trial.physicalContacts.map(c=>({
  ...c,referenceM:{xM:c.referenceM.xM+.3,yM:c.referenceM.yM}
 })),photons:trial.photons.map(p=>({...p,frameDifference:30,latencyMs:250}))};
 trial=markPhysicalReview(trial,true,'Operator A','manual drift and latency');
 assert.equal(summarizePhysicalTrial(trial).errorCm.p95,30);
 const r=assessPhysicalAcceptance(trial,signature,qa);
 assert.equal(r.status,'needs-adjustment');
 assert.ok(r.failed.some(x=>x.includes('posisi')));
 assert.ok(r.failed.some(x=>x.includes('Latensi')));
});
test('stale calibration, no physical checklist, incomplete gait coverage and missing reviewer cannot pass',()=>{
 const good=completeTrial(cameraEvents(24));
 assert.equal(assessPhysicalAcceptance(good,'new-calibration',qa).status,'incomplete');
 assert.equal(assessPhysicalAcceptance(good,signature,null).status,'incomplete');
 assert.equal(assessPhysicalAcceptance({...good,reviewComplete:false},signature,qa).status,'incomplete');
 assert.equal(assessPhysicalAcceptance({...good,sequences:[]},signature,qa).status,'incomplete');
 assert.equal(assessPhysicalAcceptance({...good,sequences:good.sequences.filter(s=>s.performerId!=='B')},
  signature,qa).status,'incomplete');
 assert.equal(assessPhysicalAcceptance(good,signature,{...qa,status:'needs-adjustment'}),
  'needs-adjustment');
 assert.equal(assessPhysicalAcceptance({...good,checklist:{...good.checklist,blackoutAndReconnectionChecked:false}},
  signature,qa).status,'incomplete');
});
test('manual pairing enforces same side/person, unique event, valid markers, video frame and photon origin',()=>{
 const events=cameraEvents(24);
 let trial=capturePhysicalTrial(floor,events,2,signature,'take.mp4',120,120);
 const first=events[0];
 assert.throws(()=>annotatePhysicalContact(trial,{performerId:'B',foot:first.foot,videoFrame:40,
  referenceM:first.positionM,matchedEventId:first.id,movement:'normal-walk'}));
 assert.throws(()=>annotatePhysicalContact(trial,{performerId:first.performerId,foot:first.foot,videoFrame:-1,
  referenceM:first.positionM,matchedEventId:first.id,movement:'normal-walk'}));
 assert.throws(()=>annotatePhysicalContact(trial,{performerId:first.performerId,foot:first.foot,videoFrame:40,
  referenceM:{xM:200,yM:1},matchedEventId:first.id,movement:'normal-walk'}));
 trial=annotatePhysicalContact(trial,{performerId:first.performerId,foot:first.foot,videoFrame:40,
  referenceM:first.positionM,matchedEventId:first.id,movement:'normal-walk'});
 assert.throws(()=>annotatePhysicalContact(trial,{performerId:first.performerId,foot:first.foot,videoFrame:41,
  referenceM:first.positionM,matchedEventId:first.id,movement:'normal-walk'}));
 assert.throws(()=>addPhotonEvidence(trial,'fake-physical',10));
 trial=addPhotonEvidence(trial,trial.physicalContacts[0].id,10);
 assert.throws(()=>addPhotonEvidence(trial,trial.physicalContacts[0].id,11));
 assert.throws(()=>markPhysicalReview(trial,true,'',''));
 assert.throws(()=>capturePhysicalTrial(floor,events,2,'','take.mp4',120,120));
});
test('simulated and predicted events never enter the frozen physical camera-contact snapshot',()=>{
 const camera=cameraEvents(1,1)[0];
 const simulated={...camera,id:'sim-1',source:'simulation' as const,positionBasis:'simulated' as const,kind:'contact' as const,timestampMs:200};
 const predicted={...camera,id:'ghost-1',kind:'prediction' as const,timestampMs:300};
 const trial=capturePhysicalTrial(floor,[camera,simulated,predicted],1,signature,'video.mp4',90,120);
 assert.equal(trial.contacts.length,1);assert.equal(trial.contacts[0].id,camera.id);
});

test('unexpected or misidentified camera contact remains in the false-positive denominator',()=>{
 const proper=cameraEvents(24);
 const rogue:FootstepEvent={...proper.at(-1)!,id:'wrong-identity',performerId:'performer-1',
  timestampMs:proper.at(-1)!.timestampMs+100};
 const frozen=capturePhysicalTrial(floor,[...proper,rogue],2,signature,'two-actors.mp4',120,120);
 assert.equal(frozen.contacts.length,25);
 let checked=completeTrial(proper);
 checked={...checked,contacts:frozen.contacts};
 assert.equal(summarizePhysicalTrial(checked).falseContacts,1);
 assert.equal(summarizePhysicalTrial(checked).precision,.96);
});

test('reopening review permits correction; dependent photon records are removed with the physical touchdown',()=>{
 let trial=completeTrial(cameraEvents(24));
 trial=markPhysicalReview(trial,false,'Operator A','corrected an entry');
 const oldId=trial.physicalContacts[0].id,oldPhotonId=trial.photons[0].id;
 const removed=removePhysicalContact(trial,oldId);
 assert.equal(removed.physicalContacts.length,23);
 assert.ok(!removed.photons.some(x=>x.id===oldPhotonId));
 assert.throws(()=>removePhysicalContact({...trial,reviewComplete:true},oldId));
 const fixed=annotatePhysicalContact(removed,{performerId:'A',foot:'left',
  videoFrame:500,referenceM:{xM:2,yM:2},matchedEventId:'cam-0',movement:'normal-walk'});
 assert.equal(new Set(fixed.physicalContacts.map(x=>x.id)).size,24);
 const afterSequence=removeMovementEvidence(fixed,0);
 assert.equal(afterSequence.sequences.length,fixed.sequences.length-1);
 const lightId=removed.photons[0].id;
 const afterLight=removePhotonEvidence(removed,lightId);
 assert.equal(afterLight.photons.length,removed.photons.length-1);
});
