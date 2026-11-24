import test from 'node:test';
import assert from 'node:assert/strict';
import {preflight,sourceAssignment,cueUsesSurface,rebaseEvent,validateCue,viewId,signalFresh,portFamily,type Readiness} from '../src/studio/v51/SignalModel.ts';
const ready:Readiness={fresh:{cam1:true,cam2:true,cam3:true},bindings:{cam1:'a',cam2:'b',cam3:'c'},media:true,session:true,photos:4,consent:true,verified:true,saving:false,recording:false};
test('V5.1 cue plans preserve required engine routes',()=>{for(const cue of ['F1','F2','F3A','F3B'] as const){assert.ok(validateCue(cue).edges.length);assert.equal(preflight(cue,ready),null);}});
test('V5.1 preflight blocks missing cameras, decoded media, consent and recording save',()=>{
 assert.equal(preflight('F1',{...ready,fresh:{...ready.fresh,cam1:false}})?.target,'cam1');
 assert.equal(preflight('F2',{...ready,media:false})?.target,'archive');
 assert.equal(preflight('F3A',{...ready,consent:false})?.target,'capture');
 assert.equal(preflight('F3A',{...ready,verified:false})?.target,'capture');
 assert.equal(preflight('F3B',{...ready,saving:true})?.target,'session');
 assert.equal(preflight('F3B',{...ready,photos:0})?.target,'capture');
});
test('V5.1 typed camera binding rejects shared audience and gesture while preserving other roles',()=>{
 assert.equal(sourceAssignment(ready.bindings,'cam3','b').ok,false);
 const r=sourceAssignment(ready.bindings,'cam1','b');
 assert.ok(r.ok);if(r.ok)assert.equal(r.bindings.cam2,'b');
 assert.equal(viewId('cam2',ready.bindings),'source:b');
 assert.equal(viewId('rec',ready.bindings),'session');
 assert.equal(viewId('floorMix',ready.bindings),'floor');
});
test('V5.1 surfaces and event timing',()=>{
 assert.equal(cueUsesSurface('F2','floor'),false);assert.equal(cueUsesSurface('F3B','floor'),true);
 assert.equal(cueUsesSurface(null,'canvas'),false);
 const e=rebaseEvent({at:2000,kind:'foot',mark:{actor:'A',side:'left',x:.5,y:.5,heading:0,t:2000}},1500);
 assert.equal(e.at,500);if(e.kind==='foot')assert.equal(e.mark.t,500);
 assert.equal(signalFresh({at:100,continuous:true,seq:1},300),true);
 assert.equal(signalFresh({at:100,continuous:false,seq:1},600),false);
 assert.equal(portFamily('gesture'),'pose');
});
