import test from 'node:test';
import assert from 'node:assert/strict';
import {activeExperimentKind,allowPhysicalOutputFromExperiment,experimentFrameLabel}
 from '../src/studio/v3/experimentSourceModel.ts';
test('integrated input classification does not alter live camera route',()=>{
 assert.equal(activeExperimentKind('webcam'),null);
 assert.equal(activeExperimentKind('phone'),null);
 assert.equal(activeExperimentKind(null),null);
 assert.equal(activeExperimentKind('video'),'video');
 assert.equal(activeExperimentKind('simulator'),'simulator');
});
test('physical output is not enabled by experimental source selection',()=>{
 assert.equal(allowPhysicalOutputFromExperiment(),false);
});
test('2D video input cannot be mislabeled as a calibrated floor',()=>{
 assert.match(experimentFrameLabel('video'),/VIDEO 2D/);
 assert.match(experimentFrameLabel('video'),/ILUSTRATIF/);
 assert.match(experimentFrameLabel('simulator'),/METRIK VIRTUAL/);
});
