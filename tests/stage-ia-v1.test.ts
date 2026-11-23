import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STAGE_NEXT,stageNavigationReadiness} from '../src/studio/v3/stageInformationArchitecture.ts';

test('IA-P0-01: main action visits every stage in order',()=>{
 assert.deepEqual([STAGE_NEXT.track.target,STAGE_NEXT.compose.target,STAGE_NEXT.map.target],
  ['compose','map','perform']);
 assert.equal(STAGE_NEXT.perform.target,'map');
});
test('IA-P0-02: camera/floor ready does not silently mark Compose, Map or LIVE ready',()=>{
 const source={sourceReady:true,composeRasterReady:false,outputQuadSaved:false,
  outputQaValid:false,physicalLiveCommanded:false};
 assert.deepEqual(stageNavigationReadiness(source),{
  trackReady:true,composeReady:false,mapReady:false,outputLive:false
 });
 assert.deepEqual(stageNavigationReadiness({...source,composeRasterReady:true}),{
  trackReady:true,composeReady:true,mapReady:false,outputLive:false
 });
 const map=stageNavigationReadiness({...source,composeRasterReady:true,outputQuadSaved:true});
 assert.equal(map.mapReady,true);assert.equal(map.outputLive,false);
 assert.equal(stageNavigationReadiness({...source,composeRasterReady:true,
  outputQuadSaved:true,outputQaValid:true,physicalLiveCommanded:true}).outputLive,true);
});
test('IA-P0-02: invalid source blocks downstream readiness even if other flags are true',()=>{
 const r=stageNavigationReadiness({sourceReady:false,composeRasterReady:true,
  outputQuadSaved:true,outputQaValid:true,physicalLiveCommanded:true});
 assert.equal(r.trackReady,false);assert.equal(r.composeReady,false);
 assert.equal(r.mapReady,false);assert.equal(r.outputLive,false);
});
test('IA-P0-03: MP4 floor profile is owned by Track, while Compose consumes its prop',()=>{
 const track=readFileSync('src/studio/v3/FootprintsStageWorkspace.tsx','utf8');
 const compose=readFileSync('src/studio/v3/SurfaceComposer.tsx','utf8');
 assert.match(track,/VideoSpatialCalibration frameRef=\{experimentFrameRef\}/);
 assert.match(track,/videoFloorProfile=\{videoFloorProfile\}/);
 assert.match(compose,/videoFloorProfile\?:VideoFloorProfile\|null/);
 assert.doesNotMatch(compose,/<VideoSpatialCalibration /);
 assert.doesNotMatch(compose,/\[videoFloorProfile,setVideoFloorProfile\]=useState/);
});
test('IA-P0-04: source camera quad stays read-only in normal Map',()=>{
 const map=readFileSync('src/studio/v3/MapWysiwygWorkspace.tsx','utf8');
 assert.match(map,/allowLegacyCameraEditing=false/);
 assert.match(map,/Ubah bidang kamera di Track/);
 assert.match(map,/projectorEdit/);
 assert.match(map,/Tes tapak/);
});
test('IA-P0-05: Map saved status never claims ready-perform from floor confirmation',()=>{
 const output=readFileSync('src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx','utf8');
 assert.doesNotMatch(output,/data-status=\{floorTracker\?\.isConfirmed\?'ready-perform'/);
 assert.match(output,/data-status=\{mapOutputSaved\?'output-quad-saved':'output-quad-draft'\}/);
 assert.match(output,/onMapOutputSaved\?\.\(\)/);
 assert.match(output,/urgentBlackout/);
});
