import test from 'node:test';
import assert from 'node:assert/strict';
import {composeInspectorVisible} from '../src/studio/v3/composeLowerBodyModel.ts';

test('LEG A, LEG B and SPLIT always retain the right inspector',()=>{
 for(const view of ['LEG A','LEG B','SPLIT'] as const){
  assert.equal(composeInspectorVisible(view,'black'),true);
  assert.equal(composeInspectorVisible(view,'input'),true);
 }
});
test('FLOOR keeps its controls in every backdrop state',()=>{
 assert.equal(composeInspectorVisible('FLOOR','black'),true);
 assert.equal(composeInspectorVisible('FLOOR','input'),true);
});
test('Skeleton only collapses the right inspector for Input',()=>{
 assert.equal(composeInspectorVisible('SKELETON','black'),true);
 assert.equal(composeInspectorVisible('SKELETON','input'),false);
});
