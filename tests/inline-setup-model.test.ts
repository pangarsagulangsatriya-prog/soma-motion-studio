import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineSetupHint} from '../src/studio/v3/inlineSetupModel.ts';
const base={
 source:{selection:null,phase:'idle',message:'Pilih sumber gerak.'} as const,
 cameraOn:false,cameraBusy:false,cameraError:'',bodySelected:false,
 videoReady:false,frameFresh:false,performerCount:1 as const,
 visibleCount:0,identityAmbiguous:false,identityMatchedFrame:false,
 floorCalibrated:false,floorConfirmed:false,cameraMatched:false
};
const webcam={selection:'webcam',phase:'ready',message:'Webcam tersambung.'} as const;
test('unselected source gets one clear next step',()=>{
 const result=inlineSetupHint(base);
 assert.equal(result.id,'source');assert.equal(result.action,'source');
});
test('phone pairing takes priority over stale tracking and floor state',()=>{
 assert.equal(inlineSetupHint({...base,source:{selection:'phone',phase:'pairing',message:'Scan QR'} as const}).id,'pairing');
});
test('camera errors and busy states cannot claim readiness',()=>{
 assert.equal(inlineSetupHint({...base,source:webcam,cameraError:'Izin ditolak'}).id,'error');
 assert.equal(inlineSetupHint({...base,source:webcam,cameraBusy:true}).id,'connecting');
 assert.equal(inlineSetupHint({...base,source:webcam,cameraOn:true,videoReady:false}).id,'frame');
});
test('camera with no BODY mode, fresh pose, or valid identities shows next action',()=>{
 const live={...base,source:webcam,cameraOn:true,videoReady:true};
 assert.equal(inlineSetupHint(live).id,'body');
 assert.equal(inlineSetupHint({...live,bodySelected:true}).id,'pose');
 assert.equal(inlineSetupHint({...live,bodySelected:true,frameFresh:true,identityAmbiguous:true}).id,'identity');
 assert.equal(inlineSetupHint({...live,bodySelected:true,frameFresh:true,identityMatchedFrame:true}).id,'performers');
});
test('four point calibration, camera match and manual confirmation stay mandatory',()=>{
 const live={...base,source:webcam,cameraOn:true,videoReady:true,bodySelected:true,
  frameFresh:true,identityMatchedFrame:true,visibleCount:1};
 assert.equal(inlineSetupHint(live).id,'floor');
 assert.equal(inlineSetupHint({...live,floorCalibrated:true}).id,'source-mismatch');
 assert.equal(inlineSetupHint({...live,floorCalibrated:true,cameraMatched:true}).id,'floor-confirm');
 assert.equal(inlineSetupHint({...live,floorCalibrated:true,cameraMatched:true,floorConfirmed:true}).id,'preview');
});
test('labs do not masquerade as live input nor projector readiness',()=>{
 for(const selection of ['video','simulator'] as const){
  const h=inlineSetupHint({...base,source:{selection,phase:'lab',message:'Lab'}});
  assert.equal(h.id,'lab');assert.equal(h.action,'source');
 }
});
