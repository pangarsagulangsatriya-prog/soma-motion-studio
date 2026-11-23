import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeSourceFrameGeometryV24,sourceUVToStageUV,stageUVToSourceUV}
 from '../src/footprints/spatial/SourceFrameGeometryV24.ts';

for(const [w,h,orientation,mirror] of [
 [640,360,0,false],[1920,1080,0,true],
 [1080,1920,0,false],[1080,1920,90,false],
 [720,1280,270,true],[1280,720,180,true]
] as const){
 test('SP24 source geometry reversible '+[w,h,orientation,mirror].join(':'),()=>{
  const geometry=makeSourceFrameGeometryV24(w,h,orientation,mirror);
  for(const point of [{x:0,y:0},{x:1,y:1},{x:.25,y:.75},{x:.65,y:.36}]){
   const stage=sourceUVToStageUV(point,geometry);
   assert.ok(stage);
   const restored=stageUVToSourceUV(stage,geometry);
   assert.ok(restored);
   assert.ok(Math.abs(restored.x-point.x)<1e-8);
   assert.ok(Math.abs(restored.y-point.y)<1e-8);
  }
  assert.ok(geometry.version);
 });
}
test('SP24 portrait source rejects point in letterboxed margin',()=>{
 const g=makeSourceFrameGeometryV24(1080,1920);
 assert.ok(g.contentRect.width<1);
 assert.equal(stageUVToSourceUV({x:.02,y:.5},g),null);
});
test('SP24 orientation/mirror changes profile version, preview size does not',()=>{
 const g=makeSourceFrameGeometryV24(640,360);
 assert.notEqual(g.version,makeSourceFrameGeometryV24(640,360,0,true).version);
 assert.notEqual(g.version,makeSourceFrameGeometryV24(640,360,90).version);
 assert.equal(g.version,makeSourceFrameGeometryV24(640,360).version);
});
test('SP24 rejects nonphysical source geometry',()=>{
 assert.throws(()=>makeSourceFrameGeometryV24(0,360));
 assert.throws(()=>makeSourceFrameGeometryV24(-100,50));
});
