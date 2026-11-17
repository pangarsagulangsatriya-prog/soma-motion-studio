import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGE_INSPECTOR_TABS,OPERATOR_CUES,operatorCueAt,
 moveOperatorCue,operatorShortcut} from '../src/studio/v3/OperatorStageModel.ts';

test('UX04: five work-specific inspector tabs, with QA/engineering separate from visual',()=>{
 assert.deepEqual(STAGE_INSPECTOR_TABS.map(t=>t.id),
  ['tracking','visual','archive','projection','qa']);
 assert.equal(new Set(STAGE_INSPECTOR_TABS.map(t=>t.id)).size,5);
 assert.ok(STAGE_INSPECTOR_TABS.every(t=>t.label&&t.description));
});
test('UX05: operator cues change monitor layouts only and are deterministic',()=>{
 assert.deepEqual(OPERATOR_CUES.map(x=>x.id),['overview','body','floor','split']);
 assert.equal(operatorCueAt(0).id,'overview');
 assert.equal(operatorCueAt(1).id,'body');
 assert.equal(operatorCueAt(2).id,'floor');
 assert.equal(operatorCueAt(3).id,'split');
 assert.equal(operatorCueAt(-100).id,'overview');
 assert.equal(operatorCueAt(100).id,'split');
 assert.throws(()=>operatorCueAt(NaN));
 assert.ok(OPERATOR_CUES.every(c=>c.description.length>0));
 // Pure cue objects hold no projector transport commands or calibrated output.
 assert.ok(OPERATOR_CUES.every(c=>!('transport' in c)&&!('projector' in c)));
});
test('GO/PREV do not overflow the four rehearsal monitor cues',()=>{
 assert.equal(moveOperatorCue(0,1),1);
 assert.equal(moveOperatorCue(1,1),2);
 assert.equal(moveOperatorCue(2,1),3);
 assert.equal(moveOperatorCue(3,1),3);
 assert.equal(moveOperatorCue(2,-1),1);
 assert.equal(moveOperatorCue(0,-1),0);
});
test('keyboard controls are accessible and never activate output or recorder',()=>{
 assert.equal(operatorShortcut('ArrowRight',false),'next');
 assert.equal(operatorShortcut('Space',false),'next');
 assert.equal(operatorShortcut('ArrowLeft',false),'previous');
 assert.equal(operatorShortcut('KeyB',false),'blackout');
 assert.equal(operatorShortcut('Escape',false),'blackout');
 assert.equal(operatorShortcut('Enter',false),null);
 assert.equal(operatorShortcut('KeyR',false),null);
});
test('editing, modifier keys and modal focus suppress accidental operator shortcuts',()=>{
 assert.equal(operatorShortcut('Space',true),null);
 assert.equal(operatorShortcut('ArrowRight',true),null);
 assert.equal(operatorShortcut('KeyB',true),null);
 assert.equal(operatorShortcut('KeyB',false,true),null);
 assert.equal(operatorShortcut('ArrowRight',false,false,true),null);
 assert.equal(operatorShortcut('Escape',false,false,false,true),null);
});
