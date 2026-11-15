import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyConnectionRequired,cameraView,formatElapsed,patternExportReady,stoppingVideoRequiresConfirmation} from '../src/studio/v3/interaction.ts';

test('camera states have clear labels and prioritize busy/error over lost tracking',()=>{
 const base={source:'camera' as const,busy:false,error:'',cameraOn:false,tracked:false,input:'body'};
 assert.equal(cameraView(base).state,'off');
 assert.equal(cameraView({...base,busy:true,error:'Izin ditolak'}).state,'loading');
 assert.equal(cameraView({...base,error:'Izin ditolak'}).state,'error');
 assert.match(cameraView({...base,cameraOn:true}).label,/tubuh/i);
 assert.equal(cameraView({...base,cameraOn:true,tracked:true}).state,'tracking');
 assert.equal(cameraView({...base,source:'mouse'}).state,'mouse');
 assert.match(cameraView({...base,cameraOn:true,input:'face'}).label,/wajah/i);
});
test('Footprints always offers Body connection when selected without camera',()=>{
 assert.equal(bodyConnectionRequired('footprints','mouse',false),true);
 assert.equal(bodyConnectionRequired('footprints','hands',true),true);
 assert.equal(bodyConnectionRequired('footprints','body',false),true);
 assert.equal(bodyConnectionRequired('footprints','body',true),false);
 assert.equal(bodyConnectionRequired('liquid','hands',false),false);
});
test('pattern export cannot be activated before valid movement samples',()=>{
 assert.equal(patternExportReady(true,0),false);
 assert.equal(patternExportReady(true,25),true);
 assert.equal(patternExportReady(false,25),false);
 assert.equal(patternExportReady(true,NaN),false);
 assert.equal(patternExportReady(true,-5),false);
});
test('recording timer and scene-exit confirmation keep correct behaviour',()=>{
 assert.equal(formatElapsed(0),'00:00');
 assert.equal(formatElapsed(79.8),'01:19');
 assert.equal(formatElapsed(-1),'00:00');
 assert.equal(formatElapsed(NaN),'00:00');
 assert.equal(stoppingVideoRequiresConfirmation(true,'footprints','liquid'),true);
 assert.equal(stoppingVideoRequiresConfirmation(true,'footprints','footprints'),false);
 assert.equal(stoppingVideoRequiresConfirmation(false,'footprints','liquid'),false);
});
