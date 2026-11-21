import assert from 'node:assert/strict';
import test from 'node:test';
import {canRenderComposeSurface} from '../src/studio/v3/composePreviewGate.ts';
import {safeProjectionPreflight} from '../src/studio/v3/safeProjectionPreflight.ts';
import {inlineSetupHint} from '../src/studio/v3/inlineSetupModel.ts';

test('Compose FLOOR software preview is visible before Map calibration',()=>{
 assert.equal(canRenderComposeSurface({surface:'FLOOR',physical:false,floorReady:false,bodyMaskSafe:false,bodyMaskPresent:false}),true);
});
test('Map physical FLOOR raster remains blocked before calibration',()=>{
 assert.equal(canRenderComposeSurface({surface:'FLOOR',physical:true,floorReady:false,bodyMaskSafe:true,bodyMaskPresent:true}),false);
 assert.equal(canRenderComposeSurface({surface:'FLOOR',physical:true,floorReady:true,bodyMaskSafe:true,bodyMaskPresent:true}),true);
});
test('BODY preview requires validated body mask even in Compose',()=>{
 assert.equal(canRenderComposeSurface({surface:'BODY A',physical:false,floorReady:true,bodyMaskSafe:false,bodyMaskPresent:true}),false);
 assert.equal(canRenderComposeSurface({surface:'BODY B',physical:false,floorReady:true,bodyMaskSafe:true,bodyMaskPresent:false}),false);
});
const base={cameraOn:false,cameraBusy:false,cameraError:'',bodySelected:false,videoReady:false,frameFresh:false,performerCount:2 as const,visibleCount:0,identityAmbiguous:false,identityMatchedFrame:false,floorCalibrated:false,floorConfirmed:false,cameraMatched:false};
test('MP4 loading error stays prominent instead of suggesting video ready',()=>{
 const hint=inlineSetupHint({...base,source:{selection:'video',phase:'error',message:'MP4 rusak'}});
 assert.equal(hint.severity,'warning');assert.equal(hint.id,'source-error');
 assert.match(hint.description,/MP4 rusak/);
});
test('MP4 with no valid frames cannot authorize physical projector',()=>{
 const result=safeProjectionPreflight({source:'video',cameraOn:false,cameraBusy:false,bodySelected:false,frameFresh:false,identities:0,performers:2,identityAmbiguous:false,matchedFrame:false,floorConfirmed:false,cameraMatched:false,hardwareEnabled:true,floorOutput:{connected:false,qa:'not-tested',mode:'offline'} as Parameters<typeof safeProjectionPreflight>[0]['floorOutput']});
 assert.equal(result.physicalReady,false);assert.equal(result.step,'tracking');assert.equal(result.softwareOnly,false);
});
