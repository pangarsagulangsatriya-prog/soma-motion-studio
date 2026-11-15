import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyConnectionRequired,cameraView,completionRate,formatElapsed,keyboardIsInControl,nextTab,patternExportReady,stoppingVideoRequiresConfirmation} from '../src/studio/v3/interaction.ts';

test('camera states have clear labels and prioritize busy/error over lost tracking',()=>{
 const base={source:'camera' as const,busy:false,error:'',cameraOn:false,tracked:false,input:'body'};
 assert.equal(cameraView(base).state,'off');
 assert.equal(cameraView({...base,busy:true,error:'Izin ditolak'}).state,'loading');
 assert.equal(cameraView({...base,error:'Izin ditolak'}).state,'error');
 assert.match(cameraView({...base,cameraOn:true}).label,/tubuh/i);
 assert.equal(cameraView({...base,cameraOn:true,tracked:true}).state,'tracking');
 assert.equal(cameraView({...base,cameraOn:true,hadTracking:true,tracked:false}).state,'lost');
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

test('keyboard tab navigation wraps through available contextual inspector tabs',()=>{
 const all=['style','material','response'] as const;
 assert.equal(nextTab(all,'style',1),'material');
 assert.equal(nextTab(all,'style',-1),'response');
 assert.equal(nextTab(['style','response'] as const,'style',-1),'response');
 assert.equal(nextTab(all,'response',1),'style');
});

test('native keyboard actions are protected from stage-wide shortcuts',()=>{
 assert.equal(keyboardIsInControl('SUMMARY',false,true),true); // Space must open a dropdown
 assert.equal(keyboardIsInControl('BUTTON',false,true),true);
 assert.equal(keyboardIsInControl('INPUT',false,true),true);
 assert.equal(keyboardIsInControl('A',false,true),true);
 assert.equal(keyboardIsInControl('DIV',true,false),true);
 assert.equal(keyboardIsInControl('DIV',false,true),true); // custom tab or menu item
 assert.equal(keyboardIsInControl('DIV',false,false),false); // live stage shortcut still works
 assert.equal(keyboardIsInControl('BODY',false,false),false);
});
test('usability task pass rate reports only observed completions',()=>{
 assert.equal(completionRate(0,5),0);
 assert.equal(completionRate(4,5),.8);
 assert.equal(completionRate(5,5),1);
 assert.equal(completionRate(9,5),1);
 assert.equal(completionRate(0,0),0);
});
