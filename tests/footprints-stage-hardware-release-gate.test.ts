import test from 'node:test';
import assert from 'node:assert/strict';
import {stageHardwareAvailable} from '../src/footprints/stage-optics/StageHardwareGate.ts';

test('stage optical output requires explicit opt-in in any production build',()=>{
 assert.equal(stageHardwareAvailable(false,undefined),false);
 assert.equal(stageHardwareAvailable(false,''),false);
 assert.equal(stageHardwareAvailable(false,'true'),false);
 assert.equal(stageHardwareAvailable(false,'disabled'),false);
 assert.equal(stageHardwareAvailable(false,'enabled'),true);
});
test('local development can commission a supervised rig with existing QA gates',()=>{
 assert.equal(stageHardwareAvailable(true,undefined),true);
 assert.equal(stageHardwareAvailable(true,'disabled'),true);
});
